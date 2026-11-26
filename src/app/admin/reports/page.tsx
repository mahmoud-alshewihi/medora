import { PageTitle } from "@/components/shell/page-title";
import { Download, TrendingDown, TrendingUp, Wallet, Receipt, RotateCcw } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/tz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { ReportFilters } from "@/components/shell/filters";
import { BarsChart, DonutChart, TrendChart } from "@/components/charts/charts";
import { MethodBadge } from "@/components/shell/method-badge";
import { pageAccess } from "@/server/auth/page-guard";
import { financialSummary, appointmentSummary, doctorPerformance, branchPerformance, paymentMethods, revenueTrend, appointmentTrend } from "@/server/reports/service";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const C = { teal: "hsl(var(--chart-1))", navy: "hsl(var(--chart-2))", amber: "hsl(var(--chart-3))", red: "hsl(var(--chart-4))", violet: "hsl(var(--chart-5))" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("reports.view"); const sp = await searchParams;
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } });
  const today = todayIn(clinic.timezone);
  const from = sp.from && ISO.test(sp.from) ? sp.from : today.slice(0, 8) + "01"; const to = sp.to && ISO.test(sp.to) ? sp.to : today;
  const f = { from, to, branchId: sp.branchId || null, doctorId: sp.doctorId || null };
  const [branches, doctorsList, fin, appts, docs, brs, methods, revTrend, apptTrend] = await Promise.all([
    db.branch.findMany({ where: { clinicId: ctx.clinicId } }), db.doctor.findMany({ where: { clinicId: ctx.clinicId } }),
    financialSummary(ctx, f), appointmentSummary(ctx, f), doctorPerformance(ctx, f), branchPerformance(ctx, f), paymentMethods(ctx, f),
    revenueTrend(ctx, f), appointmentTrend(ctx, f),
  ]);
  const m = (v: string) => formatMoney(v, clinic.currency);
  const q = new URLSearchParams({ from, to, ...(sp.branchId ? { branchId: sp.branchId } : {}), ...(sp.doctorId ? { doctorId: sp.doctorId } : {}) }).toString();
  const finStats = [
    { label: "Revenue (net of refunds)", value: m(fin.revenue), icon: TrendingUp },
    { label: "Refunds", value: m(fin.refunds), icon: RotateCcw },
    { label: "Expenses", value: m(fin.expenses), icon: TrendingDown },
    { label: "Net income", value: m(fin.net), icon: Wallet },
    { label: "Outstanding", value: m(fin.outstanding), icon: Receipt },
  ];
  const apptDonut = [
    { name: "Completed", value: appts.completed, color: C.teal },
    { name: "Cancelled", value: appts.cancelled, color: C.red },
    { name: "No-show", value: appts.noShow, color: C.amber },
    { name: "Other", value: Math.max(0, appts.total - appts.completed - appts.cancelled - appts.noShow), color: C.navy },
  ].filter((x) => x.value > 0);
  const methodColors = [C.teal, C.navy, C.amber, C.violet, C.red];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle>Reports</PageTitle>
        <a className="no-print inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-[13px] font-medium shadow-xs transition-colors hover:bg-muted" href={`/api/reports/export?${q}`}>
          <Download className="h-3.5 w-3.5 text-muted-foreground" /><T>Export CSV</T>
        </a>
      </div>
      <ReportFilters action="/admin/reports" from={from} to={to} branchId={sp.branchId} doctorId={sp.doctorId} branches={branches} doctors={doctorsList} lockBranch={!!ctx.branchId} />

      {/* financial KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {finStats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card px-4 py-3 shadow-xs">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><s.icon className="h-3.5 w-3.5" /><T>{s.label}</T></p>
            <p className="tnum mt-1 whitespace-nowrap text-lg font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle><T>Revenue vs expenses</T></CardTitle></CardHeader>
          <CardContent><TrendChart money data={revTrend} series={[{ key: "revenue", color: C.teal, name: "Revenue" }, { key: "expenses", color: C.red, name: "Expenses" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Payment methods</T></CardTitle></CardHeader>
          <CardContent>
            <DonutChart data={methods.map((d, i) => ({ name: d.method.replace(/_/g, " "), value: Number(d.count), color: methodColors[i % methodColors.length] }))} centerValue={String(methods.reduce((a, d) => a + Number(d.count), 0))} centerLabel="payments" />
            <ul className="mt-2 space-y-1.5">
              {methods.map((d) => (
                <li key={d.method} className="flex items-center justify-between text-[13px]">
                  <MethodBadge method={d.method} />
                  <span className="tnum"><b>{d.count}</b> · {m(d.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle><T>Appointment activity</T></CardTitle></CardHeader>
          <CardContent><TrendChart data={apptTrend} series={[{ key: "completed", color: C.teal, name: "Completed" }, { key: "cancelled", color: C.red, name: "Cancelled" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Cancellation analysis</T></CardTitle></CardHeader>
          <CardContent>
            <DonutChart data={apptDonut} centerValue={`${appts.cancellationRate}%`} centerLabel="cancellation rate" />
            <ul className="mt-2 space-y-1.5">
              {apptDonut.map((s) => (
                <li key={s.name} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /><T>{s.name}</T></span>
                  <b className="tnum">{s.value}</b>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><T>Doctor performance</T></CardTitle></CardHeader>
          <CardContent><BarsChart layout="vertical" data={docs.slice(0, 8).map((d) => ({ name: d.name.replace("Dr. ", ""), completed: d.completed, cancelled: d.cancelled }))} xKey="name" series={[{ key: "completed", color: C.teal, name: "Completed" }, { key: "cancelled", color: C.red, name: "Cancelled" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Branch performance</T></CardTitle></CardHeader>
          <CardContent><BarsChart money data={brs.map((d) => ({ name: d.name, revenue: Number(d.revenue), expenses: Number(d.expenses) }))} xKey="name" series={[{ key: "revenue", color: C.teal, name: "Revenue" }, { key: "expenses", color: C.navy, name: "Expenses" }]} /></CardContent>
        </Card>
      </div>

      {/* detail tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><T>Doctors</T></CardTitle></CardHeader>
          <CardContent><DataTable head={["Doctor", "Completed", "Cancelled"]} rows={docs.map((d) => [d.name, <span key="c" className="tnum">{d.completed}</span>, <span key="x" className="tnum">{d.cancelled}</span>])} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Branches</T></CardTitle></CardHeader>
          <CardContent><DataTable head={["Branch", "Revenue", "Expenses"]} rows={brs.map((d) => [d.name, <span key="r" className="tnum">{m(String(d.revenue))}</span>, <span key="e" className="tnum">{m(String(d.expenses))}</span>])} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
