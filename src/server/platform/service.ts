import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/server/audit/audit";

export type Limit = "branches" | "doctors" | "patients";

/** Server-side subscription usage limit. Throws 402 when the clinic's plan is exhausted. */
export async function enforcePlanLimit(clinicId: string, what: Limit) {
  const sub = await db.subscription.findUnique({ where: { clinicId }, include: { plan: true } });
  if (!sub) throw new AppError(402, "SUBSCRIPTION_INACTIVE", "No active subscription");
  const [count, max] = await (async () => {
    if (what === "branches") return [await db.branch.count({ where: { clinicId, active: true } }), sub.plan.maxBranches] as const;
    if (what === "doctors") return [await db.doctor.count({ where: { clinicId, active: true } }), sub.plan.maxDoctors] as const;
    return [await db.patient.count({ where: { clinicId } }), sub.plan.maxPatients] as const;
  })();
  if (count >= max) throw new AppError(402, "PLAN_LIMIT_REACHED", `Your plan allows at most ${max} ${what}`);
}

export async function setClinicStatus(clinicId: string, status: "ACTIVE" | "SUSPENDED", actorUserId: string) {
  const c = await db.clinic.findUnique({ where: { id: clinicId } });
  if (!c) throw notFound("Clinic");
  const u = await db.clinic.update({ where: { id: clinicId }, data: { status } });
  await audit({ clinicId: null, userId: actorUserId, action: `platform.clinic.${status.toLowerCase()}`, entity: "Clinic", entityId: clinicId });
  return u;
}

export async function setSubscription(clinicId: string, args: { planId: string; status: "TRIALING" | "ACTIVE" | "EXPIRED" | "CANCELLED"; expiresAt: Date }, actorUserId: string) {
  const plan = await db.subscriptionPlan.findUnique({ where: { id: args.planId } });
  if (!plan) throw notFound("Plan");
  const s = await db.subscription.upsert({ where: { clinicId }, create: { clinicId, planId: plan.id, status: args.status, startsAt: new Date(), expiresAt: args.expiresAt }, update: { planId: plan.id, status: args.status, expiresAt: args.expiresAt } });
  await audit({ userId: actorUserId, action: "platform.subscription.update", entity: "Subscription", entityId: s.id, metadata: { status: args.status } });
  return s;
}

export async function platformStats() {
  const [clinics, active, patients, appts, users] = await Promise.all([db.clinic.count(), db.clinic.count({ where: { status: "ACTIVE" } }), db.patient.count(), db.appointment.count(), db.user.count()]);
  return { clinics, activeClinics: active, patients, appointments: appts, users };
}
