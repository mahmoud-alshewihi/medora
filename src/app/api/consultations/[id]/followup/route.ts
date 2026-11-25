import { z } from "zod";
import { parseStartsAt } from "@/server/appointments/service";
import { scheduleFollowUp } from "@/server/clinical/service";
import { secured } from "@/server/http/handler";

export const POST = secured("consultation.write", { body: z.object({ startsAt: z.string() }) }, async ({ ctx, params, body }) => scheduleFollowUp(ctx, params.id!, parseStartsAt(body.startsAt)));
