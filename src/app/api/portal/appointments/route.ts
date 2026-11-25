import { z } from "zod";
import { parseStartsAt } from "@/server/appointments/service";
import { portalBook, portalCancel, portalReschedule } from "@/server/portal/service";
import { secured } from "@/server/http/handler";

export const POST = secured("portal.self", { body: z.object({ branchId: z.string(), doctorId: z.string(), startsAt: z.string(), reason: z.string().max(300).nullable().optional() }) }, async ({ ctx, body }) => portalBook(ctx, { ...body, startsAt: parseStartsAt(body.startsAt) }));
export const PATCH = secured("portal.self", { body: z.discriminatedUnion("action", [z.object({ action: z.literal("cancel"), appointmentId: z.string() }), z.object({ action: z.literal("reschedule"), appointmentId: z.string(), startsAt: z.string() })]) },
  async ({ ctx, body }) => (body.action === "cancel" ? portalCancel(ctx, body.appointmentId) : portalReschedule(ctx, body.appointmentId, parseStartsAt(body.startsAt))));
