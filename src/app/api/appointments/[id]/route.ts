import { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { changeStatus, parseStartsAt, rescheduleAppointment } from "@/server/appointments/service";
import { secured } from "@/server/http/handler";
import { can } from "@/server/auth/permissions";
import { forbidden } from "@/lib/errors";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), to: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("reschedule"), startsAt: z.string() }),
]);

export const GET = secured("appointment.read", {}, async ({ ctx, params }) => {
  const a = await db.appointment.findFirst({ where: { id: params.id!, clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { history: { orderBy: { createdAt: "asc" } }, patient: { select: { id: true, fullName: true, mrn: true } }, doctor: { select: { fullName: true } } } });
  if (!a) throw notFound("Appointment");
  return a;
});
export const PATCH = secured("appointment.read", { body }, async ({ ctx, params, body }) => {
  if (body.action === "reschedule") {
    if (!can(ctx.role, "appointment.write")) throw forbidden();
    return rescheduleAppointment({ clinicId: ctx.clinicId, appointmentId: params.id!, startsAt: parseStartsAt(body.startsAt), actorUserId: ctx.userId, branchId: ctx.branchId });
  }
  // check-in / queue moves need check-in permission; everything else needs write
  const needs = ["CHECKED_IN", "WAITING"].includes(body.to) ? "appointment.checkin" : "appointment.write";
  if (!can(ctx.role, needs)) throw forbidden();
  return changeStatus({ clinicId: ctx.clinicId, appointmentId: params.id!, to: body.to, note: body.note, actorUserId: ctx.userId, branchId: ctx.branchId });
});
