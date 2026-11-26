import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ClipboardList, CreditCard, TrendingDown, TrendingUp, Users, Wallet, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { fmtLocal } from "@/lib/clinic-time";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/tz";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { ReportFilters } from "@/components/shell/filters";
import { BarsChart, DonutChart, TrendChart } from "@/components/charts/charts";
import { pageAccess } from "@/server/auth/page-guard";
import { dashboard } from "@/server/reports/service";
import { getLocale } from "@/lib/i18n/server";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const C = { teal: "hsl(var(--chart-1))", navy: "hsl(var(--chart-2))", amber: "hsl(var(--chart-3))", red: "hsl(var(--chart-4))", violet: "hsl(var(--chart-5))" };

function Delta({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev || prev <= 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  if (!isFinite(pct)) return null;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${good ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("dashboard.view"); const sp = await searchParams;
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } });
  const today = todayIn(clinic.timezone);
  const from = sp.from && ISO.test(sp.from) ? sp.from : today.slice(0, 8) + "01"; const to = sp.to && ISO.test(sp.to) ? sp.to : today;
  const [branches, doctors, loc] = await Promise.all([db.branch.findMany({ where: { clinicId: ctx.clinicId } }), db.doctor.findMany({ where: { clinicId: ctx.clinicId } }), getLocale()]);
  const d = await dashboard(ctx, { from, to, branchId: sp.branchId || null, doctorId: sp.doctorId || null });
  const m = (v: string) => formatMoney(v, d.currency);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: clinic.timezone }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLine = new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: clinic.timezone }).format(new Date());
  const firstName = ctx.userName.split(" ")[0];
  const prev = d.previous;
  const num = (v: string) => Number(v);

  const statusData = [
    { name: "Completed", value: d.appointments.byStatus.COMPLETED ?? 0, color: C.teal },
    { name: "Confirmed", value: (d.appointments.byStatus.CONFIRMED ?? 0) + (d.appointments.byStatus.PENDING ?? 0), color: C.navy },
    { name: "Checked in", value: (d.appointments.byStatus.CHECKED_IN ?? 0) + (d.appointments.byStatus.WAITING ?? 0) + (d.appointments.byStatus.IN_PROGRESS ?? 0), color: C.amber },
    { name: "Cancelled", value: (d.appointments.byStatus.CANCELLED ?? 0) + (d.appointments.byStatus.NO_SHOW ?? 0), color: C.red },
  ].filter((s) => s.value > 0);

  const alerts: { tone: "warn" | "danger" | "info"; text: string; href: string }[] = [];
  if (d.kpis.waiting > 0) alerts.push({ tone: "info", text: `${d.kpis.waiting} patient${d.kpis.waiting > 1 ? "s are" : " is"} waiting now`, href: "/reception" });
  if (d.appointments.cancellationRate >= 10) alerts.push({ tone: "warn", text: `Cancellation rate is ${d.appointments.cancellationRate}% in this period`, href: "/admin/appointments" });
  if (num(d.kpis.net) < 0) alerts.push({ tone: "danger", text: `Expenses exceed revenue by ${m(String(Math.abs(num(d.kpis.net))))} in this period`, href: "/admin/reports" });

  const stats = [
    { label: "Revenue (range)", value: m(d.kpis.monthlyRevenue), icon: Wallet, delta: <Delta cur={num(d.kpis.monthlyRevenue)} prev={num(prev.revenue)} /> },
    { label: "Net income", value: m(d.kpis.net), icon: d.kpis.net.startsWith("-") ? TrendingDown : TrendingUp, delta: <Delta cur={num(d.kpis.net)} prev={num(prev.net)} /> },
    { label: "Today's appointments", value: String(d.kpis.todayAppointments), icon: CalendarDays, delta: null },
    { label: "Waiting now", value: String(d.kpis.waiting), icon: ClipboardList, delta: null },
  ];
  const secondary: [string, string][] = [
    ["Total patients", String(d.kpis.totalPatients)],
    ["Completed (range)", String(d.kpis.completed)],
    ["Cancelled (range)", `${d.kpis.cancelled} (${d.appointments.cancellationRate}%)`],
    ["Outstanding", m(d.kpis.outstanding)],
    ["Operating expenses", m(d.kpis.expenses)],
  ];

  return (
    <div className="space-y-5"><AutoRefresh seconds={30} />
      {/* header: greeting + quick actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 aria-label="Dashboard" className="text-xl font-bold tracking-tight sm:text-2xl"><T>{greeting}</T>, {firstName}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{dateLine} · <T>Auto-refreshes every 30s</T></p>
        </div>
        <div className="flex gap-2">
          <Link href="/reception" className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-[13px] font-medium shadow-xs transition-colors hover:bg-muted"><ClipboardList className="h-3.5 w-3.5 text-primary" /><T>Live queue</T></Link>
          <Link href="/admin/patients" className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-[13px] font-medium shadow-xs transition-colors hover:bg-muted"><Users className="h-3.5 w-3.5 text-primary" /><T>Patients</T></Link>
          <Link href="/admin/billing" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-strong"><CreditCard className="h-3.5 w-3.5" /><T>Billing</T></Link>
        </div>
      </div>

      <ReportFilters action="/admin" from={from} to={to} branchId={sp.branchId} doctorId={sp.doctorId} branches={branches} doctors={doctors} lockBranch={!!ctx.branchId} />

      {/* primary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground"><T>{s.label}</T></p>
              <s.icon className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="tnum whitespace-nowrap text-lg font-bold tracking-tight sm:text-xl">{s.value}</p>
              {s.delta}
            </div>
          </Card>
        ))}
      </div>
      {/* secondary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {secondary.map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-card/60 px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground"><T>{k}</T></p>
            <p className="tnum mt-0.5 whitespace-nowrap text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {/* main analytics row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle><T>Revenue vs expenses</T></CardTitle></CardHeader>
          <CardContent><TrendChart money data={d.revenueTrend} series={[{ key: "revenue", color: C.teal, name: "Revenue" }, { key: "expenses", color: C.red, name: "Expenses" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Appointment status</T></CardTitle></CardHeader>
          <CardContent>
            <DonutChart data={statusData} centerValue={String(d.appointments.total)} centerLabel="total" />
            <ul className="mt-2 space-y-1.5">
              {statusData.map((s) => (
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
          <CardHeader><CardTitle><T>Appointment activity</T></CardTitle></CardHeader>
          <CardContent><TrendChart data={d.appointmentTrend} series={[{ key: "total", color: C.navy, name: "Total" }, { key: "completed", color: C.teal, name: "Completed" }, { key: "cancelled", color: C.red, name: "Cancelled" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Doctor performance</T></CardTitle></CardHeader>
          <CardContent><BarsChart layout="vertical" data={d.doctorPerformance.slice(0, 8).map((x) => ({ name: x.name.replace("Dr. ", ""), completed: x.completed, cancelled: x.cancelled }))} xKey="name" series={[{ key: "completed", color: C.teal, name: "Completed" }, { key: "cancelled", color: C.red, name: "Cancelled" }]} /></CardContent>
        </Card>
      </div>

      {/* operations row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle><T>Upcoming appointments</T></CardTitle></CardHeader>
          <CardContent>
            {d.upcoming.length ? <ul className="-my-1 divide-y">{d.upcoming.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium">{a.patient.fullName}</span>
                <span className="flex shrink-0 items-center gap-2"><span className="text-xs text-muted-foreground">{fmtLocal(a.startsAt, clinic.timezone)}</span><Badge value={a.status} /></span>
              </li>))}</ul> : <EmptyState title="No upcoming appointments" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Recent activity</T></CardTitle></CardHeader>
          <CardContent>
            {d.recent.length ? <ul className="-my-1 divide-y">{d.recent.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0 truncate">{r.action} <span className="text-muted-foreground">{r.entity}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.user?.name ?? "system"}</span>
              </li>))}</ul> : <EmptyState title="No activity yet" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Operational alerts</T></CardTitle></CardHeader>
          <CardContent>
            {alerts.length ? (
              <ul className="space-y-2">
                {alerts.map((a, i) => (
                  <li key={i}>
                    <Link href={a.href} className={`flex items-start gap-2.5 rounded-lg border p-3 text-[13px] transition-colors hover:bg-muted/60 ${a.tone === "danger" ? "border-danger/30 bg-danger-soft/40" : a.tone === "warn" ? "border-warn/30 bg-warn-soft/40" : "border-info/30 bg-info-soft/40"}`}>
                      {a.tone === "danger" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : a.tone === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />}
                      <T>{a.text}</T>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success-soft/40 p-3 text-[13px]"><CheckCircle2 className="h-4 w-4 text-success" /><T>No operational alerts right now</T></div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle><T>Branch performance</T></CardTitle></CardHeader>
        <CardContent><BarsChart money data={d.branchPerformance.map((x) => ({ name: x.name, revenue: Number(x.revenue), expenses: Number(x.expenses) }))} xKey="name" series={[{ key: "revenue", color: C.teal, name: "Revenue" }, { key: "expenses", color: C.navy, name: "Expenses" }]} /></CardContent>
      </Card>
    </div>
  );
}
