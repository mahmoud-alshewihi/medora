import { PageTitle } from "@/components/shell/page-title";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Input } from "@/components/ui/primitives";
import { pageAccess } from "@/server/auth/page-guard";
import { queueForBranch } from "@/server/appointments/service";
import { db } from "@/lib/db";
import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { dayRangeUtc, todayIn } from "@/lib/tz";
import { CallButton, CheckInButton } from "@/components/shell/reception-actions";
import { T } from "@/components/t";
import { Users, Clock, Search, CalendarCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function Reception() {
  const ctx = await pageAccess("queue.manage");
  const tz = await clinicTz(ctx.clinicId);
  const today = todayIn(tz);
  const { start, end } = dayRangeUtc(today, tz);
  const [q, expected] = await Promise.all([
    queueForBranch(ctx.clinicId, ctx.branchId ?? null),
    db.appointment.findMany({
      where: { clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}), startsAt: { gte: start, lt: end }, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { patient: { select: { fullName: true, mrn: true } }, doctor: { select: { fullName: true } } }, orderBy: { startsAt: "asc" }, take: 60,
    }),
  ]);
  const waiting = q.filter((w) => w.status === "WAITING" || w.status === "CHECKED_IN").length;
  return (
    <div className="space-y-5"><AutoRefresh seconds={15} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle>Live queue</PageTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground"><T>Refreshes every 15s</T> · {today}</p>
        </div>
        {/* quick patient lookup -> real patients search */}
        <form action="/admin/patients" className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" placeholder="Find a patient…" className="w-64 ps-9" />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Users className="h-3.5 w-3.5" /><T>In queue</T></p><p className="tnum mt-1 text-2xl font-bold">{q.length}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock className="h-3.5 w-3.5" /><T>Waiting / called</T></p><p className="tnum mt-1 text-2xl font-bold">{waiting}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarCheck className="h-3.5 w-3.5" /><T>Expected today</T></p><p className="tnum mt-1 text-2xl font-bold">{expected.length}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><T>Waiting queue</T></CardTitle></CardHeader>
          <CardContent>
            {q.length ? (
              <ol className="space-y-2">
                {q.map((w, i) => (
                  <li key={w.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
                    <span className="tnum grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{w.queueNumber ?? i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{w.patient.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{w.doctor.fullName}{w.estimatedWaitMin != null ? ` · ~${w.estimatedWaitMin} min` : ""}</p>
                    </div>
                    <Badge value={w.status} />
                    {w.status === "CHECKED_IN" ? <CallButton id={w.id} /> : null}
                  </li>
                ))}
              </ol>
            ) : <EmptyState title="Nobody is waiting" hint="Checked-in patients appear here." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><T>Expected today</T></CardTitle></CardHeader>
          <CardContent>
            {expected.length ? (
              <ul className="space-y-2">
                {expected.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="tnum w-12 shrink-0 text-sm font-bold">{fmtLocal(a.startsAt, tz).slice(11, 16)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.patient.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.doctor.fullName}</p>
                    </div>
                    <Badge value={a.status} />
                    <CheckInButton id={a.id} />
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No more expected arrivals today" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
