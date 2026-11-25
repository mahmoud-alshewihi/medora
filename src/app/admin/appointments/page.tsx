import Link from "next/link";
import { db } from "@/lib/db";
import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { dayRangeUtc, todayIn } from "@/lib/tz";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Input, Select } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageAccess } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dot: Record<string, string> = { PENDING: "bg-amber-500", CONFIRMED: "bg-sky-600", CHECKED_IN: "bg-indigo-500", WAITING: "bg-indigo-500", IN_PROGRESS: "bg-teal-600", COMPLETED: "bg-green-600", CANCELLED: "bg-red-500", NO_SHOW: "bg-slate-500" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("appointment.read"); const sp = await searchParams;
  const tz = await clinicTz(ctx.clinicId);
  const view = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const day = sp.date && ISO.test(sp.date) ? sp.date : todayIn(tz);
  const doctors = await db.doctor.findMany({ where: { clinicId: ctx.clinicId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });
  const doctorId = sp.doctorId && doctors.some((d) => d.id === sp.doctorId) ? sp.doctorId : undefined;
  // range of days shown
  let first = day, count = 1;
  if (view === "week") { const wd = new Date(day + "T12:00:00Z").getUTCDay(); first = addDays(day, -wd); count = 7; }
  if (view === "month") { const m0 = day.slice(0, 8) + "01"; const wd = new Date(m0 + "T12:00:00Z").getUTCDay(); first = addDays(m0, -wd); count = 42; }
  const start = dayRangeUtc(first, tz).start; const end = dayRangeUtc(addDays(first, count - 1), tz).end;
  const rows = await db.appointment.findMany({ where: { clinicId: ctx.clinicId, startsAt: { gte: start, lt: end }, ...(doctorId ? { doctorId } : {}), ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { patient: true, doctor: true, branch: true }, orderBy: { startsAt: "asc" }, take: 1500 });
  const byDay = new Map<string, typeof rows>();
  for (const a of rows) { const k = fmtLocal(a.startsAt, tz).slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), a]); }
  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const qs = (d: string, v = view) => `?view=${v}&date=${d}${doctorId ? `&doctorId=${doctorId}` : ""}`;
  const prev = view === "month" ? addDays(day.slice(0, 8) + "01", -1) : addDays(day, -step); const next = view === "month" ? addDays(day.slice(0, 8) + "01", 32) : addDays(day, step);
  const today = todayIn(tz);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Appointments</h1><p className="text-sm text-muted-foreground">{view === "month" ? day.slice(0, 7) : view === "week" ? `Week of ${first}` : day} &middot; {rows.length} appointments &middot; times in {tz}</p></div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border" role="group" aria-label="View">{(["day", "week", "month"] as const).map((v) => <Link key={v} href={qs(day, v)} aria-current={view === v ? "true" : undefined} className={cn("px-3 py-1.5 text-sm capitalize", view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{v}</Link>)}</div>
          <Link className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" href={qs(prev)} aria-label="Previous">&lsaquo; Prev</Link><Link className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" href={qs(today)}>Today</Link><Link className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" href={qs(next)} aria-label="Next">Next &rsaquo;</Link>
        </div></div>
      <form className="no-print flex flex-wrap items-end gap-2"><input type="hidden" name="view" value={view} />
        <label className="text-xs">Date<Input type="date" name="date" defaultValue={day} className="mt-1 w-44" /></label>
        <label className="text-xs">Doctor<Select name="doctorId" defaultValue={doctorId ?? ""} className="mt-1 w-52"><option value="">All doctors</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</Select></label>
        <Button type="submit">Apply</Button></form>
      {view === "day" && <DataTable empty="No appointments on this day" head={["Time", "Patient", "Doctor", "Branch", "Status"]} rows={rows.map((a) => [fmtLocal(a.startsAt, tz).slice(11), a.patient.fullName, a.doctor.fullName, a.branch.name, <Badge key={a.id} value={a.status} />])} />}
      {view === "week" && (
        <div className="grid gap-2 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(first, i)).map((d) => { const list = byDay.get(d) ?? []; return (
            <Card key={d} className={cn("min-h-40 p-2", d === today && "ring-2 ring-primary")}>
              <Link href={qs(d, "day")} className="mb-1 block text-xs font-semibold hover:underline">{new Date(d + "T12:00:00Z").toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} <span className="font-normal text-muted-foreground">({list.length})</span></Link>
              {list.length === 0 ? <p className="text-xs text-muted-foreground">Free</p> : <ul className="space-y-1">{list.slice(0, 12).map((a) => <li key={a.id} className="flex items-start gap-1 rounded bg-muted/50 px-1.5 py-1 text-xs"><span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", dot[a.status])} aria-label={a.status} /><span><b>{fmtLocal(a.startsAt, tz).slice(11)}</b> {a.patient.fullName}<span className="block text-muted-foreground">{a.doctor.fullName}</span></span></li>)}{list.length > 12 && <li className="text-xs text-muted-foreground">+{list.length - 12} more, open the day</li>}</ul>}
            </Card>); })}
        </div>)}
      {view === "month" && (
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <div key={w}>{w}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">{Array.from({ length: 42 }, (_, i) => addDays(first, i)).map((d) => { const list = byDay.get(d) ?? []; const inMonth = d.slice(0, 7) === day.slice(0, 7);
            return <Link key={d} href={qs(d, "day")} className={cn("min-h-20 rounded-md border bg-card p-1.5 text-xs hover:bg-muted", !inMonth && "opacity-40", d === today && "ring-2 ring-primary")}><span className="font-medium">{Number(d.slice(8))}</span>{list.length > 0 && <span className="mt-1 block rounded bg-primary/10 px-1 py-0.5 text-primary">{list.length} appt{list.length > 1 ? "s" : ""}</span>}</Link>; })}</div>
        </div>)}
      {rows.length === 0 && view !== "day" && <EmptyState title="No appointments in this range" hint="Try another date or doctor." />}
    </div>
  );
}
