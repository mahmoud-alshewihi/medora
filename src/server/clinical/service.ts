import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import type { AccessContext } from "@/server/auth/access";
import { bookAppointment, changeStatus } from "@/server/appointments/service";
import { createInvoice } from "@/server/billing/service";
import { z } from "zod";

type Ctx = AccessContext & { clinicId: string };

export const vitalsSchema = z.object({
  bpSystolic: z.number().int().min(40).max(300).optional(), bpDiastolic: z.number().int().min(20).max(200).optional(),
  heartRate: z.number().int().min(20).max(300).optional(), tempC: z.number().min(30).max(45).optional(),
  weightKg: z.number().min(0.3).max(400).optional(), heightCm: z.number().min(20).max(260).optional(), spo2: z.number().int().min(50).max(100).optional(),
}).strict();

export const consultationUpdate = z.object({
  complaint: z.string().max(2000).nullable().optional(), clinicalNotes: z.string().max(10000).nullable().optional(),
  vitals: vitalsSchema.optional(), diagnosis: z.string().max(2000).nullable().optional(), treatmentPlan: z.string().max(5000).nullable().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const prescriptionInput = z.object({
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({ medication: z.string().trim().min(1).max(120), dosage: z.string().trim().min(1).max(60), frequency: z.string().trim().min(1).max(60), duration: z.string().trim().min(1).max(60), instructions: z.string().max(300).optional() })).min(1).max(20),
});

export async function doctorFor(ctx: Ctx) {
  const d = await db.doctor.findFirst({ where: { userId: ctx.userId, clinicId: ctx.clinicId } });
  if (!d) throw forbidden("No doctor profile linked to this account");
  return d;
}

async function ownAppointment(ctx: Ctx, appointmentId: string) {
  const doctor = await doctorFor(ctx);
  const a = await db.appointment.findFirst({ where: { id: appointmentId, clinicId: ctx.clinicId, doctorId: doctor.id }, include: { patient: true, consultation: true } });
  if (!a) throw notFound("Appointment");
  return { doctor, a };
}

export async function startConsultation(ctx: Ctx, appointmentId: string) {
  const { doctor, a } = await ownAppointment(ctx, appointmentId);
  if (a.status === "CHECKED_IN" || a.status === "WAITING") await changeStatus({ clinicId: ctx.clinicId, appointmentId, to: "IN_PROGRESS", actorUserId: ctx.userId });
  else if (a.status !== "IN_PROGRESS") throw conflict("INVALID_TRANSITION", `Cannot start a consultation for an appointment in status ${a.status}`);
  const c = await db.consultation.upsert({ where: { appointmentId }, create: { appointmentId, clinicId: ctx.clinicId, patientId: a.patientId, doctorId: doctor.id, complaint: a.reason }, update: {} });
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "consultation.start", entity: "Consultation", entityId: c.id });
  return c;
}

async function openConsultation(ctx: Ctx, consultationId: string) {
  const doctor = await doctorFor(ctx);
  const c = await db.consultation.findFirst({ where: { id: consultationId, clinicId: ctx.clinicId, doctorId: doctor.id }, include: { appointment: true } });
  if (!c) throw notFound("Consultation");
  return { doctor, c };
}

export async function saveConsultation(ctx: Ctx, consultationId: string, raw: z.infer<typeof consultationUpdate>) {
  const parsed = consultationUpdate.safeParse(raw);
  if (!parsed.success) throw badRequest("Invalid consultation data", parsed.error.flatten());
  const input = parsed.data;
  const { c } = await openConsultation(ctx, consultationId);
  if (c.completedAt) throw conflict("CONSULTATION_COMPLETED", "Consultation is already completed");
  const { vitals, followUpDate, ...rest } = input;
  const u = await db.consultation.update({ where: { id: c.id }, data: { ...rest, ...(vitals ? { vitals } : {}), ...(followUpDate !== undefined ? { followUpDate: followUpDate ? new Date(followUpDate + "T00:00:00.000Z") : null } : {}) } });
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "consultation.update", entity: "Consultation", entityId: c.id, metadata: { fields: Object.keys(input) } });
  return u;
}

export async function createPrescription(ctx: Ctx, consultationId: string, input: z.infer<typeof prescriptionInput>) {
  const { doctor, c } = await openConsultation(ctx, consultationId);
  return db.$transaction(async (tx) => {
    const row = await tx.counter.upsert({ where: { key: `rx:${ctx.clinicId}` }, create: { key: `rx:${ctx.clinicId}`, value: 1 }, update: { value: { increment: 1 } } });
    const rx = await tx.prescription.create({
      data: { clinicId: ctx.clinicId, consultationId: c.id, patientId: c.patientId, doctorId: doctor.id, number: `RX-${ctx.clinicId.slice(-4).toUpperCase()}-${String(row.value).padStart(6, "0")}`, notes: input.notes, items: { create: input.items } },
      include: { items: true },
    });
    await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "prescription.create", entity: "Prescription", entityId: rx.id }, tx);
    return rx;
  });
}

export async function requestLab(ctx: Ctx, consultationId: string, testName: string, notes?: string) {
  const { c } = await openConsultation(ctx, consultationId);
  if (!testName.trim()) throw badRequest("Test name required");
  const r = await db.laboratoryRequest.create({ data: { clinicId: ctx.clinicId, consultationId: c.id, patientId: c.patientId, testName, notes } });
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "lab.request", entity: "LaboratoryRequest", entityId: r.id });
  return r;
}

export async function scheduleFollowUp(ctx: Ctx, consultationId: string, startsAt: Date) {
  const { doctor, c } = await openConsultation(ctx, consultationId);
  return bookAppointment({ clinicId: ctx.clinicId, branchId: c.appointment.branchId, doctorId: doctor.id, patientId: c.patientId, startsAt, source: "FOLLOW_UP", reason: "Follow-up", actorUserId: ctx.userId });
}

/** Completes consultation + appointment, writes diagnosis to the medical record and makes sure an invoice exists. */
export async function completeConsultation(ctx: Ctx, consultationId: string) {
  const { doctor, c } = await openConsultation(ctx, consultationId);
  if (c.completedAt) throw conflict("CONSULTATION_COMPLETED", "Already completed");
  if (c.appointment.status !== "IN_PROGRESS") throw conflict("INVALID_TRANSITION", "Appointment is not in progress");
  if (!c.diagnosis?.trim()) throw badRequest("A diagnosis (clinician entered) is required to complete a consultation");
  return db.$transaction(async (tx) => {
    await changeStatus({ clinicId: ctx.clinicId, appointmentId: c.appointmentId, to: "COMPLETED", actorUserId: ctx.userId }, tx);
    const done = await tx.consultation.update({ where: { id: c.id }, data: { completedAt: new Date() } });
    await tx.medicalRecord.create({ data: { patientId: c.patientId, clinicId: ctx.clinicId, kind: "DIAGNOSIS", title: c.diagnosis!.slice(0, 120), body: [c.diagnosis, c.treatmentPlan].filter(Boolean).join("\n\n"), authorDoctorId: doctor.id } });
    const existing = await tx.invoice.findUnique({ where: { appointmentId: c.appointmentId } });
    let invoiceId = existing?.id;
    if (!existing) {
      const svc = c.appointment.serviceId ? await tx.service.findUnique({ where: { id: c.appointment.serviceId } }) : null;
      const items = [{ description: `Consultation - ${doctor.fullName}`, quantity: 1, unitPrice: doctor.consultationFee.toString() }, ...(svc ? [{ serviceId: svc.id, quantity: 1 }] : [])];
      const inv = await createInvoice({ clinicId: ctx.clinicId, branchId: c.appointment.branchId, patientId: c.patientId, appointmentId: c.appointmentId, items, actorUserId: ctx.userId }, tx);
      invoiceId = inv.id;
    }
    await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "consultation.complete", entity: "Consultation", entityId: c.id }, tx);
    return { consultation: done, invoiceId };
  });
}

export function prescriptionPrintData(rxId: string, clinicId: string) {
  return db.prescription.findFirst({
    where: { id: rxId, clinicId },
    include: { items: true, doctor: { include: { specialty: true } }, patient: true, consultation: { include: { appointment: { include: { branch: true } } } } },
  }).then(async (rx) => {
    if (!rx) return null;
    const clinic = await db.clinic.findUniqueOrThrow({ where: { id: clinicId } });
    return { rx, clinic };
  });
}
export type { Prisma };
