import { PageTitle } from "@/components/shell/page-title";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { dayRangeUtc, todayIn } from "@/lib/tz";
import { cn } from "@/lib/utils";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui/primitives";
import { DaySchedule } from "@/components/shell/day-schedule";
import { pageAccess } from "@/server/auth/page-guard";
import { getLocale } from "@/lib/i18n/server";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const soft: Record<string, string> = {
  PENDING: "bg-warn-soft text-warn", CONFIRMED: "bg-info-soft text-info", CHECKED_IN: "bg-primary-soft text-primary", WAITING: "bg-warn-soft text-warn",
  IN_PROGRESS: "bg-primary-soft text-primary", COMPLETED: "bg-success-soft text-success", CANCELLED: "bg-danger-soft text-danger", NO_SHOW: "bg-muted text-muted-foreground",
};

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("appointment.read"); const sp = await searchParams;
  const tz = await clinicTz(ctx.clinicId);
  const loc = await getLocale();
  const view = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const day = sp.date && ISO.test(sp.date) ? sp.date : todayIn(tz);
  const branches = await db.branch.findMany({ where: { clinicId: ctx.clinicId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const doctors = await db.doctor.findMany({ where: { clinicId: ctx.clinicId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });
  const doctorId = sp.doctorId && doctors.some((d) => d.id === sp.doctorId) ? sp.doctorId : undefined;
  const branchId = !ctx.branchId && sp.branchId && branches.some((b) => b.id === sp.branchId) ? sp.branchId : undefined;
  let first = day, count = 1;
  if (view === "week") { const wd = new Date(day + "T12:00:00Z").getUTCDay(); first = addDays(day, -wd); count = 7; }
  if (view === "month") { const m0 = day.slice(0, 8) + "01"; const wd = new Date(m0 + "T12:00:00Z").getUTCDay(); first = addDays(m0, -wd); count = 42; }
  const start = dayRangeUtc(first, tz).start; const end = dayRangeUtc(addDays(first, count - 1), tz).end;
  const rows = await db.appointment.findMany({
    where: { clinicId: ctx.clinicId, startsAt: { gte: start, lt: end }, ...(doctorId ? { doctorId } : {}), ...(branchId ? { branchId } : {}), ...(ctx.branchId ? { branchId: ctx.branchId } : {}) },
    include: { patient: true, doctor: true, branch: true }, orderBy: { startsAt: "asc" }, take: 1500,
  });
  const byDay = new Map<string, typeof rows>();
  for (const a of rows) { const k = fmtLocal(a.startsAt, tz).slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), a]); }
  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const qs = (d: string, v = view) => `?view=${v}&date=${d}${doctorId ? `&doctorId=${doctorId}` : ""}${branchId ? `&branchId=${branchId}` : ""}`;
  const prev = view === "month" ? addDays(day.slice(0, 8) + "01", -1) : addDays(day, -step);
  const next = view === "month" ? addDays(day.slice(0, 8) + "01", 32) : addDays(day, step);
  const today = todayIn(tz);
  const hmNow = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date()).split(":").map(Number);
  const nowMinutes = day === today ? hmNow[0] * 60 + hmNow[1] : null;
  const dayRows = rows.map((a) => {
    const hm = fmtLocal(a.startsAt, tz).slice(11, 16);
    return { id: a.id, time: hm, sortKey: Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)), patient: a.patient.fullName, doctor: a.doctor.fullName, branch: a.branch.name, status: a.status };
  });
  const dayLabel = new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(day + "T12:00:00Z"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle>Appointments</PageTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{view === "month" ? day.slice(0, 7) : view === "week" ? <><T>Week of</T> {first} → {addDays(first, 6)}</> : dayLabel} · <span className="tnum">{rows.length}</span> <T>appointments</T> · {tz}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="View">
            {(["day", "week", "month"] as const).map((v) => (
              <Link key={v} href={qs(day, v)} aria-current={view === v ? "true" : undefined}
                className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium capitalize transition-colors", view === v ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}><T>{v}</T></Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Link className="grid h-8 w-8 place-items-center rounded-md border bg-card shadow-xs transition-colors hover:bg-muted" href={qs(prev)} aria-label="Previous"><ChevronLeft className="h-4 w-4 rtl:-scale-x-100" /></Link>
            <Link className="h-8 rounded-md border bg-card px-3 text-[13px] font-medium leading-8 shadow-xs transition-colors hover:bg-muted" href={qs(today)}><T>Today</T></Link>
            <Link className="grid h-8 w-8 place-items-center rounded-md border bg-card shadow-xs transition-colors hover:bg-muted" href={qs(next)} aria-label="Next"><ChevronRight className="h-4 w-4 rtl:-scale-x-100" /></Link>
          </div>
        </div>
      </div>

      <form className="no-print flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <input type="hidden" name="view" value={view} />
        <label className="text-xs font-medium text-muted-foreground"><T>Date</T><Input type="date" name="date" defaultValue={day} className="mt-1 w-44" /></label>
        <label className="text-xs font-medium text-muted-foreground"><T>Doctor</T><Select name="doctorId" defaultValue={doctorId ?? ""} className="mt-1 w-52"><option value="">{loc === "ar" ? "كل الأطباء" : "All doctors"}</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</Select></label>
        {!ctx.branchId ? <label className="text-xs font-medium text-muted-foreground"><T>Branch</T><Select name="branchId" defaultValue={branchId ?? ""} className="mt-1 w-44"><option value="">{loc === "ar" ? "كل الفروع" : "All branches"}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label> : null}
        <Button type="submit" size="sm" className="h-9"><T>Apply</T></Button>
      </form>

      {/* status legend */}
      <div className="no-print flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(soft).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-full", v.split(" ")[0])} /><T>{k.replace(/_/g, " ")}</T></span>)}
      </div>

      {view === "day" && <DaySchedule rows={dayRows} nowMinutes={nowMinutes} />}

      {view === "week" && (
        <div className="grid gap-2 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(first, i)).map((d) => { const list = byDay.get(d) ?? []; return (
            <Card key={d} className={cn("min-h-40 p-2", d === today && "ring-2 ring-primary")}>
              <Link href={qs(d, "day")} className="mb-1.5 block rounded-md px-1 py-0.5 text-xs font-semibold transition-colors hover:bg-muted">
                {new Date(d + "T12:00:00Z").toLocaleDateString(loc === "ar" ? "ar-EG" : "en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                <span className="font-normal text-muted-foreground"> ({list.length})</span>
              </Link>
              {list.length === 0 ? <p className="px-1 text-xs text-muted-foreground"><T>Free</T></p> : (
                <ul className="space-y-1">
                  {list.slice(0, 12).map((a) => (
                    <li key={a.id} className={cn("rounded-md px-1.5 py-1 text-xs", soft[a.status] ?? "bg-muted")}>
                      <b className="tnum">{fmtLocal(a.startsAt, tz).slice(11, 16)}</b> {a.patient.fullName}
                      <span className="block opacity-75">{a.doctor.fullName}</span>
                    </li>
                  ))}
                  {list.length > 12 && <li className="px-1 text-xs text-muted-foreground">+{list.length - 12} <T>more, open the day</T></li>}
                </ul>
              )}
            </Card>); })}
        </div>
      )}

      {view === "month" && (
        <Card className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
            {(loc === "ar" ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, i) => addDays(first, i)).map((d) => { const list = byDay.get(d) ?? []; const inMonth = d.slice(0, 7) === day.slice(0, 7);
              return (
                <Link key={d} href={qs(d, "day")} className={cn("min-h-20 rounded-lg border bg-card p-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted/50", !inMonth && "opacity-40", d === today && "border-primary ring-1 ring-primary")}>
                  <span className={cn("tnum font-semibold", d === today && "text-primary")}>{Number(d.slice(8))}</span>
                  {list.length > 0 && <span className="tnum mt-1 block w-fit rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">{list.length}</span>}
                </Link>); })}
          </div>
        </Card>
      )}

      {rows.length === 0 && view !== "day" && <EmptyState title="No appointments in this range" hint="Try another date or doctor." />}
    </div>
  );
}
