import { getPatientProfile, updatePatient } from "@/server/patients/service";
import { patientInput } from "@/server/patients/schemas";
import { secured } from "@/server/http/handler";

export const GET = secured("patient.read", {}, async ({ ctx, params }) => getPatientProfile(ctx, params.id!));
export const PATCH = secured("patient.write", { body: patientInput.partial() }, async ({ ctx, params, body }) => updatePatient(ctx, params.id!, body));
