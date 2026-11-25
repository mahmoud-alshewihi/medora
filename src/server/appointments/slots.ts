import type { AppointmentStatus, Prisma, PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/lib/db";
import { fromMinutes, toMinutes, utcToZonedParts, weekdayOf, zonedToUtc, dayRangeUtc } from "@/lib/tz";
import { ACTIVE_STATUSES } from "./transitions";

export interface Slot { time: string; startsAt: string; endsAt: string }
export interface SlotQuery { clinicId: string; doctorId: string; branchId: string; date: string; durationMin?: number; excludeAppointmentId?: string; now?: Date; client?: PrismaClient | Prisma.TransactionClient }

type Hours = Record<string, [string, string] | undefined>;

/** Returns why a date is closed, or null when open. */
async function closedReason(q: SlotQuery, tz: string, db: PrismaClient | Prisma.TransactionClient): Promise<string | null> {
  const day = new Date(q.date + "T00:00:00.000Z");
  const [holiday, vacation] = await Promise.all([
    db.holiday.findFirst({ where: { clinicId: q.clinicId, date: day, OR: [{ branchId: null }, { branchId: q.branchId }] } }),
    db.doctorVacation.findFirst({ where: { doctorId: q.doctorId, startDate: { lte: day }, endDate: { gte: day } } }),
  ]);
  void tz;
  if (holiday) return `Holiday: ${holiday.name}`;
  if (vacation) return "Doctor on vacation";
  return null;
}

/** Computes bookable slots for a doctor at a branch on a clinic-local date. Everything comes from the database. */
export async function computeSlots(q: SlotQuery): Promise<{ slots: Slot[]; closedReason?: string }> {
  const db = q.client ?? defaultDb;
  const [clinic, doctor, branch] = await Promise.all([
    db.clinic.findUnique({ where: { id: q.clinicId }, select: { timezone: true } }),
    db.doctor.findFirst({ where: { id: q.doctorId, clinicId: q.clinicId, active: true } }),
    db.branch.findFirst({ where: { id: q.branchId, clinicId: q.clinicId, active: true } }),
  ]);
  if (!clinic || !doctor || !branch) return { slots: [] };
  const tz = clinic.timezone;
  const reason = await closedReason(q, tz, db);
  if (reason) return { slots: [], closedReason: reason };

  const weekday = weekdayOf(q.date);
  const schedules = await db.doctorSchedule.findMany({ where: { doctorId: q.doctorId, branchId: q.branchId, weekday } });
  if (!schedules.length) return { slots: [] };
  const branchHours = (branch.workingHours as Hours | null)?.[String(weekday)];
  if (!branchHours) return { slots: [], closedReason: "Branch closed" };

  const { start, end } = dayRangeUtc(q.date, tz);
  const busy = await db.appointment.findMany({
    where: { doctorId: q.doctorId, status: { in: ACTIVE_STATUSES as AppointmentStatus[] }, startsAt: { lt: end }, endsAt: { gt: start },
      ...(q.excludeAppointmentId ? { id: { not: q.excludeAppointmentId } } : {}) },
    select: { startsAt: true, endsAt: true },
  });
  const dur = q.durationMin ?? doctor.slotDurationMin;
  const now = q.now ?? new Date();
  const out: Slot[] = [];
  for (const s of schedules) {
    const open = Math.max(toMinutes(s.startTime), toMinutes(branchHours[0]));
    const close = Math.min(toMinutes(s.endTime), toMinutes(branchHours[1]));
    for (let t = open; t + dur <= close; t += doctor.slotDurationMin) {
      if (s.breakStart && s.breakEnd && t < toMinutes(s.breakEnd) && t + dur > toMinutes(s.breakStart)) continue;
      const startsAt = zonedToUtc(q.date, fromMinutes(t), tz);
      const endsAt = new Date(startsAt.getTime() + dur * 60000);
      if (startsAt <= now) continue;
      if (busy.some((b) => b.startsAt < endsAt && b.endsAt > startsAt)) continue;
      out.push({ time: fromMinutes(t), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    }
  }
  out.sort((a, b) => a.time.localeCompare(b.time));
  return { slots: out };
}

/** True if the exact [startsAt, startsAt+dur) window is a valid bookable slot (used inside the booking transaction). */
export async function isSlotBookable(q: SlotQuery & { startsAt: Date }): Promise<boolean> {
  const clinic = await defaultDb.clinic.findUnique({ where: { id: q.clinicId }, select: { timezone: true } });
  if (!clinic) return false;
  const parts = utcToZonedParts(q.startsAt, clinic.timezone);
  const { slots } = await computeSlots({ ...q, date: parts.date });
  return slots.some((s) => s.startsAt === q.startsAt.toISOString());
}
