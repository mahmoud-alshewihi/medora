import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/tz";
import { Card } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { ReportFilters } from "@/components/shell/filters";
import { pageAccess } from "@/server/auth/page-guard";
import { financialSummary, appointmentSummary, doctorPerformance, branchPerformance, paymentMethods } from "@/server/reports/service";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("reports.view"); const sp = await searchParams;
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } });
  const today = todayIn(clinic.timezone);
  const from = sp.from && ISO.test(sp.from) ? sp.from : today.slice(0, 8) + "01"; const to = sp.to && ISO.test(sp.to) ? sp.to : today;
  const f = { from, to, branchId: sp.branchId || null, doctorId: sp.doctorId || null };
  const [branches, doctorsList, fin, appts, docs, brs, methods] = await Promise.all([
    db.branch.findMany({ where: { clinicId: ctx.clinicId } }), db.doctor.findMany({ where: { clinicId: ctx.clinicId } }),
    financialSummary(ctx, f), appointmentSummary(ctx, f), doctorPerformance(ctx, f), branchPerformance(ctx, f), paymentMethods(ctx, f),
  ]);
  const m = (v: string) => formatMoney(v, clinic.currency);
  const q = new URLSearchParams({ from, to, ...(sp.branchId ? { branchId: sp.branchId } : {}), ...(sp.doctorId ? { doctorId: sp.doctorId } : {}) }).toString();
  return (
    <div className="space-y-5"><div className="flex items-end justify-between"><h1 className="text-2xl font-semibold">Reports</h1><a className="no-print text-sm underline" href={`/api/reports/export?${q}`}>Export CSV</a></div>
      <ReportFilters action="/admin/reports" from={from} to={to} branchId={sp.branchId} doctorId={sp.doctorId} branches={branches} doctors={doctorsList} lockBranch={!!ctx.branchId} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{([["Revenue (net of refunds)", m(fin.revenue)], ["Refunds", m(fin.refunds)], ["Expenses", m(fin.expenses)], ["Net income", m(fin.net)], ["Outstanding", m(fin.outstanding)]] as [string, string][]).map(([k, v]) => <Card key={k} className="p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-xl font-semibold">{v}</p></Card>)}</div>
      <p className="text-xs text-muted-foreground">Appointments in range: <code>{JSON.stringify(appts)}</code></p>
      <h2 className="font-medium">Doctors</h2><DataTable head={["Doctor", "Completed", "Cancelled"]} rows={docs.map((d) => [d.name, d.completed, d.cancelled])} />
      <h2 className="font-medium">Branches</h2><DataTable head={["Branch", "Revenue", "Expenses"]} rows={brs.map((d) => [d.name, m(String(d.revenue)), m(String(d.expenses))])} />
      <h2 className="font-medium">Payment methods</h2><DataTable head={["Data"]} rows={methods.map((d, i) => [<code key={i} className="text-xs">{JSON.stringify(d)}</code>])} />
    </div>
  );
}
