import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertBranchAllowed } from "@/server/auth/access";
import { bookAppointment, parseStartsAt } from "@/server/appointments/service";
import { dayRangeUtc } from "@/lib/tz";
import { secured } from "@/server/http/handler";

const query = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), branchId: z.string().optional(), doctorId: z.string().optional(), status: z.string().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(500).default(200) });
export const GET = secured("appointment.read", {}, async ({ ctx, url }) => {
  const q = query.parse(Object.fromEntries(url.searchParams));
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId }, select: { timezone: true } });
  const where: Prisma.AppointmentWhereInput = { clinicId: ctx.clinicId, startsAt: { gte: dayRangeUtc(q.from, clinic.timezone).start, lt: dayRangeUtc(q.to, clinic.timezone).end },
    ...(ctx.branchId ? { branchId: ctx.branchId } : q.branchId ? { branchId: q.branchId } : {}), ...(q.doctorId ? { doctorId: q.doctorId } : {}), ...(q.status ? { status: q.status as never } : {}) };
  const [total, rows] = await Promise.all([db.appointment.count({ where }), db.appointment.findMany({ where, orderBy: { startsAt: "asc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
    include: { patient: { select: { id: true, fullName: true, mrn: true } }, doctor: { select: { id: true, fullName: true } }, branch: { select: { id: true, name: true } } } })]);
  return { total, rows };
});

const create = z.object({ branchId: z.string(), doctorId: z.string(), patientId: z.string(), startsAt: z.string(), serviceId: z.string().nullable().optional(), reason: z.string().max(500).nullable().optional(), walkIn: z.boolean().optional() });
export const POST = secured("appointment.write", { body: create }, async ({ ctx, body }) => {
  assertBranchAllowed(ctx, body.branchId);
  const walkIn = body.walkIn === true;
  const a = await bookAppointment({ clinicId: ctx.clinicId, branchId: body.branchId, doctorId: body.doctorId, patientId: body.patientId, startsAt: parseStartsAt(body.startsAt), serviceId: body.serviceId, reason: body.reason, source: walkIn ? "WALK_IN" : "RECEPTION", actorUserId: ctx.userId, status: walkIn ? "CHECKED_IN" : undefined });
  return a;
});
