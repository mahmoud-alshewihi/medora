import { exportPatientsCsv } from "@/server/patients/service";
import { secured } from "@/server/http/handler";

export const GET = secured("patient.import_export", {}, async ({ ctx }) => new Response(await exportPatientsCsv(ctx), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="patients.csv"', "Cache-Control": "no-store" } }));
