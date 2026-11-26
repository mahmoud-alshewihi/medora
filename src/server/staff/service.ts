import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { RoleKey } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { STAFF_ROLES } from "@/server/auth/permissions";
import { enforcePlanLimit } from "@/server/platform/service";

export const staffInput = z.object({
  fullName: z.string().trim().min(2).max(120), email: z.string().email(), password: z.string().min(8).max(100),
  role: z.enum(["CLINIC_OWNER", "BRANCH_MANAGER", "DOCTOR", "RECEPTIONIST", "ACCOUNTANT", "NURSE"]),
  branchId: z.string().nullable().optional(), jobTitle: z.string().max(80).optional(), phone: z.string().max(30).optional(),
  doctor: z.object({ specialtyId: z.string(), consultationFee: z.union([z.string(), z.number()]), commissionPercent: z.union([z.string(), z.number()]).default(0), slotDurationMin: z.number().int().min(5).max(120).default(30), bio: z.string().max(1000).optional(), qualifications: z.string().max(500).optional(), yearsExperience: z.number().int().min(0).max(70).default(0),
    schedules: z.array(z.object({ branchId: z.string(), weekday: z.number().int().min(0).max(6), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), breakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(), breakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional() })).default([]) }).optional(),
});

export async function createStaff(clinicId: string, actorUserId: string, actorRole: RoleKey, input: z.infer<typeof staffInput>, actorBranchId?: string | null) {
  if (!STAFF_ROLES.includes(input.role)) throw badRequest("Invalid staff role");
  // Only owners can create other owners/managers.
  if (["CLINIC_OWNER", "BRANCH_MANAGER"].includes(input.role) && actorRole !== "CLINIC_OWNER") throw forbidden("Only the clinic owner can create owners or managers");
  // Branch-pinned actors (e.g. branch managers) can only create staff and schedules in their own branch.
  if (actorBranchId) {
    if (input.branchId !== actorBranchId) throw forbidden("You can only create staff in your own branch");
    for (const s of input.doctor?.schedules ?? []) if (s.branchId !== actorBranchId) throw forbidden("You can only schedule doctors in your own branch");
  }
  if (input.role === "DOCTOR") { if (!input.doctor) throw badRequest("Doctor profile is required"); await enforcePlanLimit(clinicId, "doctors"); }
  if (input.branchId && !(await db.branch.findFirst({ where: { id: input.branchId, clinicId } }))) throw notFound("Branch");
  const specialty = input.doctor ? await db.specialty.findFirst({ where: { id: input.doctor.specialtyId, clinicId } }) : null;
  if (input.doctor && !specialty) throw notFound("Specialty");
  for (const s of input.doctor?.schedules ?? []) if (!(await db.branch.findFirst({ where: { id: s.branchId, clinicId } }))) throw notFound("Branch");
  if (await db.user.findUnique({ where: { email: input.email.toLowerCase() } })) throw conflict("EMAIL_TAKEN", "An account with this email already exists");
  const role = await db.role.findUniqueOrThrow({ where: { key: input.role } });
  const hash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const id = randomUUID();
    await tx.user.create({ data: { id, name: input.fullName, email: input.email.toLowerCase(), emailVerified: false } });
    await tx.account.create({ data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash } });
    await tx.membership.create({ data: { userId: id, roleId: role.id, clinicId, branchId: input.branchId ?? null } });
    let doctorId: string | undefined;
    if (input.role === "DOCTOR" && input.doctor) {
      const d = input.doctor;
      const doc = await tx.doctor.create({ data: { clinicId, userId: id, fullName: input.fullName, specialtyId: d.specialtyId, consultationFee: String(d.consultationFee), commissionPercent: String(d.commissionPercent), slotDurationMin: d.slotDurationMin, bio: d.bio, qualifications: d.qualifications, yearsExperience: d.yearsExperience } });
      await tx.doctorSchedule.createMany({ data: d.schedules.map((s) => ({ ...s, doctorId: doc.id })) });
      doctorId = doc.id;
    } else {
      await tx.employee.create({ data: { clinicId, userId: id, branchId: input.branchId ?? null, fullName: input.fullName, jobTitle: input.jobTitle ?? input.role, phone: input.phone } });
    }
    await audit({ clinicId, userId: actorUserId, action: "staff.create", entity: "User", entityId: id, metadata: { role: input.role } }, tx);
    return { userId: id, doctorId };
  });
}

export async function setStaffStatus(clinicId: string, actorUserId: string, targetUserId: string, status: "ACTIVE" | "SUSPENDED", actorRole: RoleKey, actorBranchId?: string | null) {
  if (targetUserId === actorUserId) throw badRequest("You cannot change your own account status");
  const m = await db.membership.findFirst({ where: { userId: targetUserId, clinicId }, include: { role: true } });
  if (!m) throw notFound("Staff member");
  // Only owners can suspend/reactivate owners or managers.
  if (["CLINIC_OWNER", "BRANCH_MANAGER"].includes(m.role.key) && actorRole !== "CLINIC_OWNER") throw forbidden("Only the clinic owner can change an owner or manager status");
  // Branch-pinned actors can only touch staff pinned to their own branch.
  if (actorBranchId && m.branchId !== actorBranchId) throw forbidden("Outside your branch");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetUserId }, data: { status } });
    if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId: targetUserId } });
    await audit({ clinicId, userId: actorUserId, action: `staff.${status.toLowerCase()}`, entity: "User", entityId: targetUserId }, tx);
  });
}

export async function listStaff(clinicId: string, branchId?: string | null) {
  const ms = await db.membership.findMany({ where: { clinicId, role: { key: { not: "PATIENT" } }, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}) }, include: { user: { select: { id: true, name: true, email: true, status: true } }, role: true, branch: { select: { name: true } } }, orderBy: { createdAt: "asc" } });
  return ms.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, status: m.user.status, role: m.role.key, branch: m.branch?.name ?? "All branches" }));
}

export const clinicSettingsInput = z.object({
  name: z.string().min(2).max(120), nameAr: z.string().max(120).nullable().optional(), description: z.string().max(1000).nullable().optional(), phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(), address: z.string().max(300).nullable().optional(), currency: z.string().length(3).regex(/^[A-Z]{3}$/), timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Unknown timezone"),
  locale: z.enum(["en", "ar"]), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), invoicePrefix: z.string().min(2).max(8).regex(/^[A-Z0-9]+$/), invoiceFooter: z.string().max(300).nullable().optional(), taxRatePercent: z.union([z.string(), z.number()]),
}).partial();
export async function updateClinicSettings(clinicId: string, actorUserId: string, input: z.infer<typeof clinicSettingsInput>) {
  const { taxRatePercent, ...rest } = input;
  if (taxRatePercent !== undefined && (Number(taxRatePercent) < 0 || Number(taxRatePercent) > 100)) throw badRequest("Tax rate must be between 0 and 100");
  const c = await db.clinic.update({ where: { id: clinicId }, data: { ...rest, ...(taxRatePercent !== undefined ? { taxRatePercent: String(taxRatePercent) } : {}) } });
  await audit({ clinicId, userId: actorUserId, action: "settings.update", entity: "Clinic", entityId: clinicId, metadata: { fields: Object.keys(input) } });
  return c;
}
