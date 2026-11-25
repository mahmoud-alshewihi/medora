import { saveConsultation, consultationUpdate } from "@/server/clinical/service";
import { secured } from "@/server/http/handler";

export const PATCH = secured("consultation.write", { body: consultationUpdate }, async ({ ctx, params, body }) => saveConsultation(ctx, params.id!, body));
