import { z } from "zod";
import { fullReport } from "@/server/reports/service";
import { secured } from "@/server/http/handler";

const reportQuery = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), branchId: z.string().optional(), doctorId: z.string().optional() });
export const GET = secured("reports.view", {}, async ({ ctx, url }) => fullReport(ctx, reportQuery.parse(Object.fromEntries(url.searchParams))));
