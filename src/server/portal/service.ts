import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import type { AccessContext } from "@/server/auth/access";
import { outstandingOf } from "@/server/billing/service";
import { bookAppointment, changeStatus, rescheduleAppointment } from "@/server/appointments/service";

type Ctx = AccessContext & { clinicId: string };

export async function myPatient(ctx: Ctx) {
  const p = await db.patient.findFirst({ where: { userId: ctx.userId, clinicId: ctx.clinicId, archivedAt: null } });
  if (!p) throw forbidden("No patient record linked to this account");
  return p;
}

/** Everything here is hard-scoped by the patient linked to the session user, never by a client-supplied patientId. */
export async function portalOverview(ctx: Ctx) {
  const p = await myPatient(ctx);
  const [appointments, invoices, prescriptions, documents, notifications, clinic] = await Promise.all([
    db.appointment.findMany({ where: { patientId: p.id }, orderBy: { startsAt: "desc" }, take: 100, include: { doctor: { select: { fullName: true } }, branch: { select: { name: true, address: true } } } }),
    db.invoice.findMany({ where: { patientId: p.id, status: { not: "DRAFT" } }, orderBy: { issuedAt: "desc" }, take: 100, include: { payments: { select: { id: true, receiptNumber: true, amount: true, method: true, paidAt: true } } } }),
    db.prescription.findMany({ where: { patientId: p.id }, orderBy: { issuedAt: "desc" }, take: 50, include: { items: true, doctor: { select: { fullName: true } } } }),
    db.patientAttachment.findMany({ where: { patientId: p.id, patientVisible: true }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } }),
    db.notification.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId }, select: { name: true, phone: true, email: true, address: true } }),
  ]);
  const outstanding = invoices.reduce((a, i) => a.add(outstandingOf(i)), (await import("@/lib/money")).D(0));
  return { patient: { id: p.id, mrn: p.mrn, fullName: p.fullName, phone: p.phone, email: p.email, dateOfBirth: p.dateOfBirth }, appointments, invoices, prescriptions, documents, notifications, clinic, outstanding: outstanding.toFixed(2) };
}

export async function portalBook(ctx: Ctx, a: { branchId: string; doctorId: string; startsAt: Date; reason?: string | null }) {
  const p = await myPatient(ctx);
  return bookAppointment({ clinicId: ctx.clinicId, patientId: p.id, branchId: a.branchId, doctorId: a.doctorId, startsAt: a.startsAt, reason: a.reason, source: "PORTAL", actorUserId: ctx.userId });
}
export async function portalCancel(ctx: Ctx, appointmentId: string) {
  const p = await myPatient(ctx);
  const ap = await db.appointment.findFirst({ where: { id: appointmentId, patientId: p.id } });
  if (!ap) throw notFound("Appointment");
  return changeStatus({ clinicId: ctx.clinicId, appointmentId, to: "CANCELLED", actorUserId: ctx.userId, note: "Cancelled by patient", patientUserId: ctx.userId });
}
export async function portalReschedule(ctx: Ctx, appointmentId: string, startsAt: Date) {
  await myPatient(ctx);
  return rescheduleAppointment({ clinicId: ctx.clinicId, appointmentId, startsAt, actorUserId: ctx.userId, patientUserId: ctx.userId });
}
