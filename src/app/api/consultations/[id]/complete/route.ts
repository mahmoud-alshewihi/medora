import { completeConsultation } from "@/server/clinical/service";
import { secured } from "@/server/http/handler";

export const POST = secured("consultation.write", {}, async ({ ctx, params }) => completeConsultation(ctx, params.id!));
