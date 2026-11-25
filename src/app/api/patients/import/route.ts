import { importPatientsCsv } from "@/server/patients/service";
import { secured } from "@/server/http/handler";
import { badRequest } from "@/lib/errors";

export const POST = secured("patient.import_export", {}, async ({ ctx, req }) => {
  const text = await req.text();
  if (text.length > 2_000_000) throw badRequest("CSV too large");
  return importPatientsCsv(ctx, text);
});
