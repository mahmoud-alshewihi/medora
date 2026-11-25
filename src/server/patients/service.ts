import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { parseCsv, toCsv } from "@/lib/csv";
import { audit } from "@/server/audit/audit";
import { can } from "@/server/auth/permissions";
import type { AccessContext } from "@/server/auth/access";
import { enforcePlanLimit } from "@/server/platform/service";
import { patientInput, type PatientInput } from "./schemas";

async function nextMrn(tx: Prisma.TransactionClient, clinicId: string) {
  const row = await tx.counter.upsert({ where: { key: `mrn:${clinicId}` }, create: { key: `mrn:${clinicId}`, value: 1 }, update: { value: { increment: 1 } } });
  return `P-${String(row.value).padStart(6, "0")}`;
}

const dateOrNull = (s?: string | null) => (s ? new Date(s + "T00:00:00.000Z") : null);

export async function registerPatient(clinicId: string, input: PatientInput, actorUserId?: string | null, linkUserId?: string | null) {
  await enforcePlanLimit(clinicId, "patients");
  return db.$transaction(async (tx) => {
    const mrn = await nextMrn(tx, clinicId);
    const p = await tx.patient.create({
      data: { clinicId, mrn, fullName: input.fullName, gender: input.gender ?? null, dateOfBirth: dateOrNull(input.dateOfBirth), phone: input.phone ?? null, email: input.email ?? null,
        nationalId: input.nationalId ?? null, address: input.address ?? null, emergencyContactName: input.emergencyContactName ?? null, emergencyContactPhone: input.emergencyContactPhone ?? null,
        emergencyContactRelation: input.emergencyContactRelation ?? null, allergies: input.allergies ?? [], chronicConditions: input.chronicConditions ?? [], medicalHistory: input.medicalHistory ?? null, userId: linkUserId ?? null },
    });
    await audit({ clinicId, userId: actorUserId, action: "patient.create", entity: "Patient", entityId: p.id, metadata: { mrn } }, tx);
    return p;
  });
}

export async function updatePatient(ctx: AccessContext & { clinicId: string }, id: string, input: Partial<PatientInput>) {
  const p = await db.patient.findFirst({ where: { id, clinicId: ctx.clinicId } });
  if (!p) throw notFound("Patient");
  const medicalTouched = input.allergies !== undefined || input.chronicConditions !== undefined || input.medicalHistory !== undefined;
  if (medicalTouched && !can(ctx.role, "medical.write")) throw forbidden("Not allowed to edit medical fields");
  const { dateOfBirth, ...rest } = input;
  const updated = await db.patient.update({ where: { id }, data: { ...rest, ...(dateOfBirth !== undefined ? { dateOfBirth: dateOrNull(dateOfBirth) } : {}) } });
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "patient.update", entity: "Patient", entityId: id, metadata: { fields: Object.keys(input) } });
  return updated;
}

export async function searchPatients(clinicId: string, q: { q?: string; page: number; pageSize: number; sort: "fullName" | "createdAt" | "mrn"; dir: "asc" | "desc"; archived: "true" | "false"; gender?: "MALE" | "FEMALE" | "OTHER" }) {
  const where: Prisma.PatientWhereInput = {
    clinicId, archivedAt: q.archived === "true" ? { not: null } : null, ...(q.gender ? { gender: q.gender } : {}),
    ...(q.q ? { OR: [{ fullName: { contains: q.q, mode: "insensitive" } }, { phone: { contains: q.q } }, { mrn: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({ where, orderBy: { [q.sort]: q.dir }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
      select: { id: true, mrn: true, fullName: true, gender: true, dateOfBirth: true, phone: true, email: true, createdAt: true, archivedAt: true } }),
  ]);
  return { total, page: q.page, pageSize: q.pageSize, rows };
}

export async function setArchived(ctx: AccessContext & { clinicId: string }, id: string, archived: boolean) {
  const p = await db.patient.findFirst({ where: { id, clinicId: ctx.clinicId } });
  if (!p) throw notFound("Patient");
  await db.patient.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: archived ? "patient.archive" : "patient.restore", entity: "Patient", entityId: id });
}

/**
 * Medical-record authorization beyond the role permission:
 *  - DOCTOR: only patients with whom they have (or had) an appointment.
 *  - NURSE: only patients with an appointment at their branch (or any branch if unrestricted).
 *  - Others holding medical.read (owner): any patient in their clinic.
 * Returns true if allowed, never throws for "no".
 */
export async function canAccessMedical(ctx: AccessContext & { clinicId: string }, patientId: string): Promise<boolean> {
  if (!can(ctx.role, "medical.read")) return false;
  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: ctx.clinicId }, select: { id: true } });
  if (!patient) return false;
  if (ctx.role === "DOCTOR") {
    const doc = await db.doctor.findFirst({ where: { userId: ctx.userId, clinicId: ctx.clinicId }, select: { id: true } });
    if (!doc) return false;
    return (await db.appointment.count({ where: { patientId, doctorId: doc.id, clinicId: ctx.clinicId } })) > 0;
  }
  if (ctx.role === "NURSE") {
    return (await db.appointment.count({ where: { patientId, clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) } })) > 0;
  }
  return true;
}

export async function getPatientProfile(ctx: AccessContext & { clinicId: string }, id: string) {
  const base = await db.patient.findFirst({ where: { id, clinicId: ctx.clinicId } });
  if (!base) throw notFound("Patient");
  const medical = await canAccessMedical(ctx, id);
  const showBilling = can(ctx.role, "billing.read");
  const [appointments, invoices] = await Promise.all([
    db.appointment.findMany({ where: { patientId: id, clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, orderBy: { startsAt: "desc" }, take: 50, include: { doctor: { select: { fullName: true } }, branch: { select: { name: true } } } }),
    showBilling ? db.invoice.findMany({ where: { patientId: id, clinicId: ctx.clinicId }, orderBy: { issuedAt: "desc" }, take: 50 }) : Promise.resolve([]),
  ]);
  const outstanding = invoices.filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID").reduce((a, i) => a.add(i.total.sub(i.paidAmount.sub(i.refundedAmount))), new Prisma.Decimal(0));
  const out: Record<string, unknown> = {
    id: base.id, mrn: base.mrn, fullName: base.fullName, gender: base.gender, dateOfBirth: base.dateOfBirth, phone: base.phone, email: base.email, address: base.address,
    emergencyContact: { name: base.emergencyContactName, phone: base.emergencyContactPhone, relation: base.emergencyContactRelation }, archivedAt: base.archivedAt,
    appointments: appointments.map((a) => ({ id: a.id, reference: a.reference, startsAt: a.startsAt, status: a.status, doctor: a.doctor.fullName, branch: a.branch.name })),
    billing: showBilling ? { outstanding: outstanding.toFixed(2), invoices: invoices.map((i) => ({ id: i.id, number: i.number, status: i.status, total: i.total.toFixed(2), issuedAt: i.issuedAt })) } : null,
    medicalAccess: medical,
  };
  if (medical) {
    const [records, consultations, prescriptions, attachments, notes] = await Promise.all([
      db.medicalRecord.findMany({ where: { patientId: id, clinicId: ctx.clinicId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.consultation.findMany({ where: { patientId: id, clinicId: ctx.clinicId }, orderBy: { createdAt: "desc" }, take: 20, include: { doctor: { select: { fullName: true } } } }),
      db.prescription.findMany({ where: { patientId: id, clinicId: ctx.clinicId }, orderBy: { issuedAt: "desc" }, take: 20, include: { items: true } }),
      db.patientAttachment.findMany({ where: { patientId: id, clinicId: ctx.clinicId }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, patientVisible: true } }),
      db.patientNote.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    Object.assign(out, { nationalId: base.nationalId, allergies: base.allergies, chronicConditions: base.chronicConditions, medicalHistory: base.medicalHistory, records, consultations, prescriptions, attachments, notes });
    await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "medical.read", entity: "Patient", entityId: id });
  }
  return out;
}

const CSV_COLUMNS = ["mrn", "fullName", "gender", "dateOfBirth", "phone", "email", "address"];

export async function exportPatientsCsv(ctx: AccessContext & { clinicId: string }) {
  const rows = await db.patient.findMany({ where: { clinicId: ctx.clinicId, archivedAt: null }, orderBy: { mrn: "asc" } });
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "patient.export", entity: "Patient", metadata: { count: rows.length } });
  return toCsv(rows.map((p) => ({ mrn: p.mrn, fullName: p.fullName, gender: p.gender, dateOfBirth: p.dateOfBirth?.toISOString().slice(0, 10), phone: p.phone, email: p.email, address: p.address })), CSV_COLUMNS);
}

export async function importPatientsCsv(ctx: AccessContext & { clinicId: string }, text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw badRequest("CSV has no data rows");
  if (rows.length > 5001) throw badRequest("Import limited to 5000 rows");
  const header = rows[0]!.map((h) => h.trim());
  if (!header.includes("fullName")) throw badRequest("CSV must have a fullName column");
  const errors: { row: number; message: string }[] = [];
  let created = 0;
  for (let i = 1; i < rows.length; i++) {
    const rec = Object.fromEntries(header.map((h, j) => [h, rows[i]![j]?.trim() || null]));
    const parsed = patientInput.safeParse({ fullName: rec.fullName, gender: rec.gender?.toUpperCase() ?? null, dateOfBirth: rec.dateOfBirth, phone: rec.phone, email: rec.email, address: rec.address });
    if (!parsed.success) { errors.push({ row: i + 1, message: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") }); continue; }
    await registerPatient(ctx.clinicId, parsed.data, ctx.userId);
    created++;
  }
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "patient.import", entity: "Patient", metadata: { created, errors: errors.length } });
  return { created, errors };
}
