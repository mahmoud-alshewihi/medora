import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/tz";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { ReportFilters } from "@/components/shell/filters";
import { BarsChart, TrendChart } from "@/components/charts/charts";
import { pageAccess } from "@/server/auth/page-guard";
import { dashboard } from "@/server/reports/service";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("dashboard.view"); const sp = await searchParams;
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } });
  const today = todayIn(clinic.timezone);
  const from = sp.from && ISO.test(sp.from) ? sp.from : today.slice(0, 8) + "01"; const to = sp.to && ISO.test(sp.to) ? sp.to : today;
  const [branches, doctors] = await Promise.all([db.branch.findMany({ where: { clinicId: ctx.clinicId } }), db.doctor.findMany({ where: { clinicId: ctx.clinicId } })]);
  const d = await dashboard(ctx, { from, to, branchId: sp.branchId || null, doctorId: sp.doctorId || null });
  const m = (v: string) => formatMoney(v, d.currency);
  const kpi: [string, string][] = [["Total patients", String(d.kpis.totalPatients)], ["Today's appointments", String(d.kpis.todayAppointments)], ["Completed (range)", String(d.kpis.completed)], ["Cancelled (range)", String(d.kpis.cancelled)], ["Waiting now", String(d.kpis.waiting)],
    ["Revenue (range)", m(d.kpis.monthlyRevenue)], ["Outstanding", m(d.kpis.outstanding)], ["Operating expenses", m(d.kpis.expenses)], ["Net income", m(d.kpis.net)]];
  return (
    <div className="space-y-5"><AutoRefresh seconds={30} />
      <div className="flex items-end justify-between"><h1 className="text-2xl font-semibold">Dashboard</h1><p className="text-xs text-muted-foreground">Auto-refreshes every 30s &middot; {from} to {to}</p></div>
      <ReportFilters action="/admin" from={from} to={to} branchId={sp.branchId} doctorId={sp.doctorId} branches={branches} doctors={doctors} lockBranch={!!ctx.branchId} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{kpi.map(([k, v]) => <Card key={k} className="p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-xl font-semibold">{v}</p></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><h2 className="mb-2 font-medium">Revenue vs expenses</h2><TrendChart data={d.revenueTrend} series={[{ key: "revenue", color: "#0f766e", name: "Revenue" }, { key: "expenses", color: "#1e3a5f", name: "Expenses" }]} /></Card>
        <Card className="p-4"><h2 className="mb-2 font-medium">Appointments</h2><TrendChart data={d.appointmentTrend} series={[{ key: "total", color: "#0f766e", name: "Total" }, { key: "completed", color: "#15803d", name: "Completed" }, { key: "cancelled", color: "#b91c1c", name: "Cancelled" }]} /></Card>
        <Card className="p-4"><h2 className="mb-2 font-medium">Doctor performance</h2><BarsChart data={d.doctorPerformance.slice(0, 8).map((x) => ({ name: x.name.replace("Dr. ", ""), completed: x.completed, cancelled: x.cancelled }))} xKey="name" series={[{ key: "completed", color: "#0f766e", name: "Completed" }, { key: "cancelled", color: "#b91c1c", name: "Cancelled" }]} /></Card>
        <Card className="p-4"><h2 className="mb-2 font-medium">Branch performance</h2><BarsChart data={d.branchPerformance.map((x) => ({ name: x.name, revenue: Number(x.revenue), expenses: Number(x.expenses) }))} xKey="name" series={[{ key: "revenue", color: "#0f766e", name: "Revenue" }, { key: "expenses", color: "#1e3a5f", name: "Expenses" }]} /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><h2 className="mb-2 font-medium">Upcoming appointments</h2>{d.upcoming.length ? <ul className="divide-y text-sm">{d.upcoming.map((a) => <li key={a.id} className="flex items-center justify-between py-2"><span>{a.patient.fullName} <span className="text-muted-foreground">with {a.doctor.fullName}</span></span><span className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{a.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span><Badge value={a.status} /></span></li>)}</ul> : <EmptyState title="No upcoming appointments" />}</Card>
        <Card className="p-4"><h2 className="mb-2 font-medium">Recent activity</h2>{d.recent.length ? <ul className="divide-y text-sm">{d.recent.map((r) => <li key={r.id} className="flex justify-between py-2"><span>{r.action} <span className="text-muted-foreground">{r.entity}</span></span><span className="text-xs text-muted-foreground">{r.user?.name ?? "system"}</span></li>)}</ul> : <EmptyState title="No activity yet" />}</Card>
      </div>
    </div>
  );
}
