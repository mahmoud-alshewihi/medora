import { patientInput, patientQuery } from "@/server/patients/schemas";
import { registerPatient, searchPatients } from "@/server/patients/service";
import { secured } from "@/server/http/handler";

export const GET = secured("patient.read", {}, async ({ ctx, url }) => searchPatients(ctx.clinicId, patientQuery.parse(Object.fromEntries(url.searchParams))));
export const POST = secured("patient.write", { body: patientInput }, async ({ ctx, body }) => registerPatient(ctx.clinicId, body, ctx.userId));
