import { z } from "zod";
import { toCsv } from "@/lib/csv";
import { badRequest } from "@/lib/errors";
import { fullReport } from "@/server/reports/service";
import { secured } from "@/server/http/handler";

const q = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), branchId: z.string().optional(), doctorId: z.string().optional(), section: z.enum(["trend", "doctors", "branches", "methods", "outstanding", "inventory", "commissions", "appointments"]) });
export const GET = secured("reports.view", {}, async ({ ctx, url }) => {
  const { section, ...f } = q.parse(Object.fromEntries(url.searchParams));
  const r = await fullReport(ctx, f);
  const map = {
    trend: [r.trend, ["date", "revenue", "expenses"]], doctors: [r.doctors, ["name", "total", "completed", "cancelled", "revenue", "commission"]], branches: [r.branches, ["name", "appointments", "revenue", "expenses", "net"]],
    methods: [r.methods, ["method", "amount", "count"]], outstanding: [r.outstanding, ["number", "patient", "mrn", "issuedAt", "total", "outstanding"]], inventory: [r.inventory, ["type", "movements", "netQuantity"]],
    commissions: [r.commissions, ["doctor", "invoices", "commission"]], appointments: [r.appointmentsTrend, ["date", "total", "completed", "cancelled"]],
  } as const;
  const e = map[section]; if (!e) throw badRequest("Unknown section");
  return new Response(toCsv(e[0] as never, [...e[1]]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${section}-${f.from}_${f.to}.csv"`, "Cache-Control": "no-store" } });
});
