import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { requirePlatformAdmin } from "@/server/auth/access";
import { platformStats } from "@/server/platform/service";
import { open } from "@/server/http/handler";

const onboard = z.object({ name: z.string().min(2).max(120), slug: z.string().regex(/^[a-z0-9-]{3,40}$/), planId: z.string(), ownerName: z.string().min(2), ownerEmail: z.string().email(), ownerPassword: z.string().min(8).max(100), firstBranch: z.string().min(2).max(80).default("Main Branch") });
export const GET = open(async () => {
  await requirePlatformAdmin();
  // Deliberately aggregates only: no patient or medical data crosses this boundary.
  const clinics = await db.clinic.findMany({ include: { subscription: { include: { plan: true } }, _count: { select: { branches: true, doctors: true, patients: true } } }, orderBy: { createdAt: "desc" } });
  return { stats: await platformStats(), clinics: clinics.map((c) => ({ id: c.id, name: c.name, slug: c.slug, status: c.status, plan: c.subscription?.plan.name, subscriptionStatus: c.subscription?.status, expiresAt: c.subscription?.expiresAt, counts: c._count })), plans: await db.subscriptionPlan.findMany() };
});
export const POST = open(async (req) => {
  const admin = await requirePlatformAdmin();
  const b = onboard.parse(await req.json());
  if (await db.clinic.findUnique({ where: { slug: b.slug } })) throw conflict("SLUG_TAKEN", "Slug already in use");
  if (await db.user.findUnique({ where: { email: b.ownerEmail.toLowerCase() } })) throw conflict("EMAIL_TAKEN", "Owner email already in use");
  const role = await db.role.findUniqueOrThrow({ where: { key: "CLINIC_OWNER" } }); const hash = await hashPassword(b.ownerPassword);
  const clinic = await db.$transaction(async (tx) => {
    const c = await tx.clinic.create({ data: { name: b.name, slug: b.slug } });
    await tx.branch.create({ data: { clinicId: c.id, name: b.firstBranch, workingHours: Object.fromEntries([0, 1, 2, 3, 4].map((d) => [String(d), ["09:00", "17:00"]])) } });
    await tx.subscription.create({ data: { clinicId: c.id, planId: b.planId, status: "TRIALING", startsAt: new Date(), expiresAt: new Date(Date.now() + 30 * 86400000) } });
    const uid = randomUUID();
    await tx.user.create({ data: { id: uid, name: b.ownerName, email: b.ownerEmail.toLowerCase(), emailVerified: false } });
    await tx.account.create({ data: { id: randomUUID(), accountId: uid, providerId: "credential", userId: uid, password: hash } });
    await tx.membership.create({ data: { userId: uid, roleId: role.id, clinicId: c.id } });
    await audit({ userId: admin.userId, action: "platform.clinic.onboard", entity: "Clinic", entityId: c.id }, tx);
    return c;
  });
  return { id: clinic.id };
});
