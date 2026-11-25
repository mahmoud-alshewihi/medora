import { randomUUID } from "node:crypto";
import type { RoleKey } from "@prisma/client";
import { db } from "@/lib/db";
import { ROLE_PERMISSIONS } from "@/server/auth/permissions";
import type { AccessContext } from "@/server/auth/access";

export async function ensureRoles() {
  const ids = {} as Record<RoleKey, string>;
  for (const key of Object.keys(ROLE_PERMISSIONS) as RoleKey[]) {
    const r = await db.role.upsert({ where: { key }, create: { key, name: key }, update: {} });
    ids[key] = r.id;
  }
  return ids;
}

export function futureDate(daysAhead = 7) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return d.toISOString().slice(0, 10);
}

export type World = Awaited<ReturnType<typeof makeClinic>>;

/** Builds an isolated clinic: 2 branches, doctor with schedule on both branches every weekday, patient, staff users for each role. */
export async function makeClinic(label: string, opts: { tax?: string; planMaxPatients?: number; subscription?: "ACTIVE" | "EXPIRED" } = {}) {
  const roleIds = await ensureRoles();
  const sfx = randomUUID().slice(0, 8);
  const plan = await db.subscriptionPlan.upsert({ where: { code: "test-plan" }, create: { code: "test-plan", name: "Test", priceMonthly: "0", maxBranches: 10, maxDoctors: 10, maxPatients: 100000 }, update: {} });
  const planLimited = opts.planMaxPatients !== undefined
    ? await db.subscriptionPlan.create({ data: { code: `lim-${sfx}`, name: "Limited", priceMonthly: "0", maxBranches: 10, maxDoctors: 10, maxPatients: opts.planMaxPatients } })
    : plan;
  const clinic = await db.clinic.create({ data: { slug: `${label}-${sfx}`, name: `${label} Clinic`, taxRatePercent: opts.tax ?? "0", invoicePrefix: label.slice(0, 3).toUpperCase() } });
  const expired = opts.subscription === "EXPIRED";
  await db.subscription.create({ data: { clinicId: clinic.id, planId: planLimited.id, status: expired ? "EXPIRED" : "ACTIVE", startsAt: new Date(Date.now() - 86400000 * 30), expiresAt: new Date(Date.now() + (expired ? -86400000 : 86400000 * 300)) } });
  const hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), ["08:00", "20:00"]]));
  const [b1, b2] = await Promise.all([1, 2].map((n) => db.branch.create({ data: { clinicId: clinic.id, name: `Branch ${n}`, workingHours: hours } })));
  const spec = await db.specialty.create({ data: { clinicId: clinic.id, name: "General" } });
  const mkUser = async (role: RoleKey, branchId: string | null = null) => {
    const u = await db.user.create({ data: { id: randomUUID(), name: `${role} ${sfx}`, email: `${role.toLowerCase()}-${sfx}@t.test`, emailVerified: true } });
    await db.membership.create({ data: { userId: u.id, roleId: roleIds[role], clinicId: role === "SUPER_ADMIN" ? null : clinic.id, branchId } });
    return u;
  };
  const doctorUser = await mkUser("DOCTOR");
  const doctor = await db.doctor.create({ data: { clinicId: clinic.id, userId: doctorUser.id, fullName: "Dr. Test", specialtyId: spec.id, consultationFee: "400", commissionPercent: "25", slotDurationMin: 30 } });
  for (const b of [b1!, b2!]) for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    await db.doctorSchedule.create({ data: { doctorId: doctor.id, branchId: b.id, weekday, startTime: "09:00", endTime: "17:00", breakStart: "13:00", breakEnd: "13:30" } });
  }
  const patientUser = await mkUser("PATIENT");
  const patient = await db.patient.create({ data: { clinicId: clinic.id, mrn: `P-${sfx}`, fullName: "Pat Ient", phone: "+201000000000", userId: patientUser.id } });
  const patient2 = await db.patient.create({ data: { clinicId: clinic.id, mrn: `Q-${sfx}`, fullName: "Other Patient", phone: "+201000000001" } });
  const users = {
    owner: await mkUser("CLINIC_OWNER"), manager: await mkUser("BRANCH_MANAGER", b1!.id), receptionist: await mkUser("RECEPTIONIST", b1!.id),
    accountant: await mkUser("ACCOUNTANT"), nurse: await mkUser("NURSE", b1!.id), doctor: doctorUser, patient: patientUser, superAdmin: await mkUser("SUPER_ADMIN"),
  };
  const ctx = (role: keyof typeof users, role2: RoleKey): AccessContext & { clinicId: string } => ({
    userId: users[role].id, userName: users[role].name, email: users[role].email, role: role2, clinicId: clinic.id, branchId: role === "manager" || role === "receptionist" || role === "nurse" ? b1!.id : null, membershipId: "m",
  });
  const ctxs = {
    owner: ctx("owner", "CLINIC_OWNER"), manager: ctx("manager", "BRANCH_MANAGER"), receptionist: ctx("receptionist", "RECEPTIONIST"), accountant: ctx("accountant", "ACCOUNTANT"),
    nurse: ctx("nurse", "NURSE"), doctor: ctx("doctor", "DOCTOR"), patient: ctx("patient", "PATIENT"),
    superAdmin: { ...ctx("superAdmin", "SUPER_ADMIN"), clinicId: null } as unknown as AccessContext,
  };
  const service = await db.service.create({ data: { clinicId: clinic.id, specialtyId: spec.id, name: "X-ray", price: "150.00", durationMin: 30 } });
  return { clinic, b1: b1!, b2: b2!, spec, doctor, doctorUser, patient, patient2, users, ctxs, service };
}

/** Returns the UTC start for HH:mm on `date` in Africa/Cairo (the default clinic timezone). */
import { zonedToUtc } from "@/lib/tz";
export const at = (date: string, hhmm: string) => zonedToUtc(date, hhmm, "Africa/Cairo");
