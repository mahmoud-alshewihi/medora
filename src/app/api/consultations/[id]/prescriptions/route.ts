import { createPrescription, prescriptionInput } from "@/server/clinical/service";
import { secured } from "@/server/http/handler";

export const POST = secured("consultation.write", { body: prescriptionInput }, async ({ ctx, params, body }) => createPrescription(ctx, params.id!, body));
