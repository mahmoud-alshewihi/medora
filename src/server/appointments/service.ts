import { randomBytes } from "node:crypto";
import { Prisma, type AppointmentSource, type AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, badRequest, conflict, notFound } from "@/lib/errors";
import { dayRangeUtc, todayIn, utcToZonedParts } from "@/lib/tz";
import { audit } from "@/server/audit/audit";
import { notify, staffWithPermission } from "@/server/notifications/service";
import { computeSlots } from "./slots";
import { ACTIVE_STATUSES, canTransition } from "./transitions";

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function bookingReference() {
  const b = randomBytes(8);
  return "MED-" + Array.from(b, (x) => REF_ALPHABET[x % REF_ALPHABET.length]).join("");
}

export interface BookInput {
  clinicId: string; branchId: string; doctorId: string; patientId: string; startsAt: Date;
  serviceId?: string | null; reason?: string | null; source: AppointmentSource; actorUserId?: string | null;
  status?: AppointmentStatus; durationMin?: number;
}

function mapDbConflict(e: unknown): never {
  const msg = String((e as { message?: string })?.message ?? "");
  if (msg.includes("appointment_doctor_no_overlap") || (e as { code?: string }).code === "P2010" || msg.includes("23P01")) {
    throw conflict("SLOT_TAKEN", "That time slot is no longer available");
  }
  throw e;
}

export async function bookAppointment(input: BookInput) {
  const { clinicId } = input;
  const [patient, doctor, branch, service] = await Promise.all([
    db.patient.findFirst({ where: { id: input.patientId, clinicId, archivedAt: null } }),
    db.doctor.findFirst({ where: { id: input.doctorId, clinicId, active: true } }),
    db.branch.findFirst({ where: { id: input.branchId, clinicId, active: true } }),
    input.serviceId ? db.service.findFirst({ where: { id: input.serviceId, clinicId, active: true } }) : Promise.resolve(null),
  ]);
  if (!patient) throw notFound("Patient");
  if (!doctor) throw notFound("Doctor");
  if (!branch) throw notFound("Branch");
  if (input.serviceId && !service) throw notFound("Service");
  const dur = input.durationMin ?? service?.durationMin ?? doctor.slotDurationMin;
  const endsAt = new Date(input.startsAt.getTime() + dur * 60000);

  try {
    const appt = await db.$transaction(async (tx) => {
      // Serialise concurrent bookings for the same doctor (works across all branches).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"doctor:" + doctor.id}))`;
      const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { timezone: true } });
      const parts = utcToZonedParts(input.startsAt, clinic.timezone);
      const walkIn = input.source === "WALK_IN";
      if (!walkIn) {
        const { slots, closedReason } = await computeSlots({ clinicId, doctorId: doctor.id, branchId: branch.id, date: parts.date, durationMin: dur, client: tx });
        if (!slots.some((s) => s.startsAt === input.startsAt.toISOString())) {
          throw conflict("SLOT_UNAVAILABLE", closedReason ?? "Selected time is outside working hours or already booked");
        }
      } else {
        const overlap = await tx.appointment.findFirst({
          where: { doctorId: doctor.id, status: { in: ACTIVE_STATUSES }, startsAt: { lt: endsAt }, endsAt: { gt: input.startsAt } },
        });
        if (overlap) throw conflict("SLOT_TAKEN", "Doctor is busy at that time");
      }
      const status: AppointmentStatus = input.status ?? (input.source === "ONLINE" || input.source === "PORTAL" ? "PENDING" : "CONFIRMED");
      const a = await tx.appointment.create({
        data: { clinicId, branchId: branch.id, doctorId: doctor.id, patientId: patient.id, serviceId: service?.id, reference: bookingReference(),
          startsAt: input.startsAt, endsAt, status, source: input.source, reason: input.reason ?? null, createdById: input.actorUserId ?? null },
      });
      await tx.appointmentStatusHistory.create({ data: { appointmentId: a.id, toStatus: status, actorUserId: input.actorUserId ?? null, note: "Created" } });
      await audit({ clinicId, userId: input.actorUserId, action: "appointment.create", entity: "Appointment", entityId: a.id, metadata: { source: input.source } }, tx);
      const staff = await staffWithPermission(clinicId, ["CLINIC_OWNER", "BRANCH_MANAGER", "RECEPTIONIST"], branch.id, tx);
      const docUser = doctor.userId ? [doctor.userId] : [];
      await notify({ clinicId, userIds: [...staff, ...docUser], type: "APPOINTMENT_NEW", title: "New appointment",
        body: `${patient.fullName} with ${doctor.fullName} on ${parts.date} ${parts.time} (${a.reference})`, link: `/admin/appointments?ref=${a.reference}` }, tx);
      if (patient.userId) {
        await notify({ clinicId, userIds: [patient.userId], type: "APPOINTMENT_CONFIRMED", title: "Appointment booked",
          body: `Your appointment ${a.reference} on ${parts.date} ${parts.time} is ${status === "PENDING" ? "awaiting confirmation" : "confirmed"}.`, link: "/portal/appointments" }, tx);
      }
      return a;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
    return appt;
  } catch (e) {
    if (e instanceof AppError) throw e;
    return mapDbConflict(e);
  }
}

export async function changeStatus(args: {
  clinicId: string; appointmentId: string; to: AppointmentStatus; actorUserId?: string | null; note?: string; branchId?: string | null; patientUserId?: string;
}) {
  return db.$transaction(async (tx) => {
    const a = await tx.appointment.findFirst({ where: { id: args.appointmentId, clinicId: args.clinicId }, include: { patient: true, doctor: true } });
    if (!a) throw notFound("Appointment");
    if (args.branchId && a.branchId !== args.branchId) throw notFound("Appointment");
    if (args.patientUserId && a.patient.userId !== args.patientUserId) throw notFound("Appointment");
    if (!canTransition(a.status, args.to)) throw conflict("INVALID_TRANSITION", `Cannot change status from ${a.status} to ${args.to}`);
    const data: Prisma.AppointmentUpdateInput = { status: args.to };
    if (args.to === "CHECKED_IN") {
      data.checkedInAt = new Date();
      const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: args.clinicId }, select: { timezone: true } });
      const qd = new Date(todayIn(clinic.timezone) + "T00:00:00.000Z");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"queue:" + a.branchId + ":" + qd.toISOString()}))`;
      const max = await tx.appointment.aggregate({ where: { branchId: a.branchId, queueDate: qd }, _max: { queueNumber: true } });
      data.queueNumber = (max._max.queueNumber ?? 0) + 1;
      data.queueDate = qd;
    }
    if (args.to === "IN_PROGRESS") data.startedAt = new Date();
    if (args.to === "COMPLETED") data.completedAt = new Date();
    if (args.to === "CANCELLED") data.cancelReason = args.note ?? null;
    await tx.appointment.update({ where: { id: a.id }, data });
    await tx.appointmentStatusHistory.create({ data: { appointmentId: a.id, fromStatus: a.status, toStatus: args.to, actorUserId: args.actorUserId ?? null, note: args.note } });
    await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: `appointment.${args.to.toLowerCase()}`, entity: "Appointment", entityId: a.id }, tx);

    const staff = await staffWithPermission(args.clinicId, ["CLINIC_OWNER", "BRANCH_MANAGER", "RECEPTIONIST"], a.branchId, tx);
    if (args.to === "CHECKED_IN") {
      await notify({ clinicId: args.clinicId, userIds: [...staff, ...(a.doctor.userId ? [a.doctor.userId] : [])], type: "PATIENT_CHECKIN",
        title: "Patient checked in", body: `${a.patient.fullName} checked in for ${a.doctor.fullName}`, link: "/reception" }, tx);
    }
    if (args.to === "CANCELLED") {
      await notify({ clinicId: args.clinicId, userIds: [...staff, ...(a.patient.userId ? [a.patient.userId] : []), ...(a.doctor.userId ? [a.doctor.userId] : [])],
        type: "APPOINTMENT_CANCELLED", title: "Appointment cancelled", body: `${a.reference} (${a.patient.fullName}) was cancelled`, link: "/admin/appointments" }, tx);
    }
    if (args.to === "CONFIRMED" && a.patient.userId) {
      await notify({ clinicId: args.clinicId, userIds: [a.patient.userId], type: "APPOINTMENT_CONFIRMED", title: "Appointment confirmed", body: `Your appointment ${a.reference} is confirmed.`, link: "/portal/appointments" }, tx);
    }
    return tx.appointment.findUniqueOrThrow({ where: { id: a.id } });
  });
}

export async function rescheduleAppointment(args: { clinicId: string; appointmentId: string; startsAt: Date; actorUserId?: string | null; branchId?: string | null; patientUserId?: string }) {
  const a = await db.appointment.findFirst({ where: { id: args.appointmentId, clinicId: args.clinicId }, include: { patient: true, doctor: true, branch: true } });
  if (!a || (args.branchId && a.branchId !== args.branchId) || (args.patientUserId && a.patient.userId !== args.patientUserId)) throw notFound("Appointment");
  if (a.status !== "PENDING" && a.status !== "CONFIRMED") throw conflict("INVALID_TRANSITION", `Appointments in status ${a.status} cannot be rescheduled`);
  const dur = (a.endsAt.getTime() - a.startsAt.getTime()) / 60000;
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"doctor:" + a.doctorId}))`;
      const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: args.clinicId }, select: { timezone: true } });
      const parts = utcToZonedParts(args.startsAt, clinic.timezone);
      const { slots } = await computeSlots({ clinicId: args.clinicId, doctorId: a.doctorId, branchId: a.branchId, date: parts.date, durationMin: dur, excludeAppointmentId: a.id, client: tx });
      if (!slots.some((s) => s.startsAt === args.startsAt.toISOString())) throw conflict("SLOT_UNAVAILABLE", "Selected time is not available");
      const updated = await tx.appointment.update({ where: { id: a.id }, data: { startsAt: args.startsAt, endsAt: new Date(args.startsAt.getTime() + dur * 60000), reminderSentAt: null } });
      await tx.appointmentStatusHistory.create({ data: { appointmentId: a.id, fromStatus: a.status, toStatus: a.status, actorUserId: args.actorUserId ?? null, note: `Rescheduled from ${a.startsAt.toISOString()}` } });
      await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "appointment.reschedule", entity: "Appointment", entityId: a.id }, tx);
      return updated;
    });
  } catch (e) {
    if (e instanceof AppError) throw e;
    return mapDbConflict(e);
  }
}

export async function queueForBranch(clinicId: string, branchId: string | null, date?: string) {
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { timezone: true } });
  const day = date ?? todayIn(clinic.timezone);
  const { start, end } = dayRangeUtc(day, clinic.timezone);
  const waiting = await db.appointment.findMany({
    where: { clinicId, ...(branchId ? { branchId } : {}), startsAt: { gte: start, lt: end }, status: { in: ["CHECKED_IN", "WAITING", "IN_PROGRESS"] } },
    include: { patient: { select: { id: true, fullName: true } }, doctor: { select: { id: true, fullName: true, slotDurationMin: true } } },
    orderBy: [{ queueNumber: "asc" }],
  });
  const perDoctorAhead = new Map<string, number>();
  return waiting.map((w) => {
    const ahead = perDoctorAhead.get(w.doctorId) ?? 0;
    if (w.status !== "IN_PROGRESS") perDoctorAhead.set(w.doctorId, ahead + 1);
    return { ...w, estimatedWaitMin: w.status === "IN_PROGRESS" ? 0 : ahead * w.doctor.slotDurationMin };
  });
}

export function parseStartsAt(v: string): Date {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest("Invalid date/time");
  return d;
}
