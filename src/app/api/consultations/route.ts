import { z } from "zod";
import { startConsultation } from "@/server/clinical/service";
import { secured } from "@/server/http/handler";

export const POST = secured("consultation.write", { body: z.object({ appointmentId: z.string() }) }, async ({ ctx, body }) => startConsultation(ctx, body.appointmentId));
