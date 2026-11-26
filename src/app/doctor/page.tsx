import { PageTitle } from "@/components/shell/page-title";
import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, PlayCircle, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { pageRole } from "@/server/auth/page-guard";
import { doctorFor } from "@/server/clinical/service";
import { dayRangeUtc, todayIn } from "@/lib/tz";
import { getLocale } from "@/lib/i18n/server";
import { T } from "@/components/t";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const edge: Record<string, string> = {
  PENDING: "border-s-warn", CONFIRMED: "border-s-info", CHECKED_IN: "border-s-[hsl(var(--chart-5))]", WAITING: "border-s-[hsl(var(--chart-5))]",
  IN_PROGRESS: "border-s-primary", COMPLETED: "border-s-success", CANCELLED: "border-s-danger", NO_SHOW: "border-s-muted-foreground",
};

export default async function DoctorHome() {
  const ctx = await pageRole("DOCTOR");
  const doctor = await doctorFor({ ...ctx, clinicId: ctx.clinicId! });
  const tz = await clinicTz(ctx.clinicId!);
  const loc = await getLocale();
  const today = todayIn(tz);
  const { start, end } = dayRangeUtc(today, tz);
  const rows = await db.appointment.findMany({ where: { doctorId: doctor.id, startsAt: { gte: start, lt: end } }, include: { patient: true }, orderBy: { startsAt: "asc" } });
  const waiting = rows.filter((a) => ["CHECKED_IN", "WAITING"].includes(a.status));
  const inProgress = rows.find((a) => a.status === "IN_PROGRESS");
  const done = rows.filter((a) => a.status === "COMPLETED").length;
  const nextUp = inProgress ?? waiting[0] ?? rows.find((a) => ["PENDING", "CONFIRMED"].includes(a.status));
  const dateLine = new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date());
  return (
    <div className="space-y-5"><AutoRefresh seconds={30} />
      <div>
        <PageTitle>My day</PageTitle>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{dateLine} · {doctor.fullName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: CalendarDays, label: "Today's appointments", value: rows.length },
          { icon: Users, label: "Waiting", value: waiting.length },
          { icon: PlayCircle, label: "In progress", value: rows.filter((a) => a.status === "IN_PROGRESS").length },
          { icon: CheckCircle2, label: "Completed", value: done },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card px-4 py-3 shadow-xs">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><s.icon className="h-3.5 w-3.5" /><T>{s.label}</T></p>
            <p className="tnum mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {nextUp ? (
        <Card className="border-primary/30 bg-primary-soft/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary"><T>{nextUp.status === "IN_PROGRESS" ? "In consultation now" : "Next up"}</T></p>
              <p className="mt-1 text-lg font-bold tracking-tight">{nextUp.patient.fullName}</p>
              <p className="tnum text-[13px] text-muted-foreground">{fmtLocal(nextUp.startsAt, tz).slice(11, 16)} · <Badge value={nextUp.status} /></p>
            </div>
            <Link href={`/doctor/consult/${nextUp.id}`} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-strong">
              <T>Open consultation</T><ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>{"Today's schedule"}</CardTitle></CardHeader>
        <CardContent>
          {rows.length ? (
            <ol className="divide-y rounded-lg border">
              {rows.map((a) => (
                <li key={a.id} className={cn("flex items-center gap-3 border-s-4 px-4 py-3", edge[a.status] ?? "border-s-muted-foreground", nextUp?.id === a.id && "bg-primary-soft/20")}>
                  <span className="tnum w-14 shrink-0 text-sm font-bold">{fmtLocal(a.startsAt, tz).slice(11, 16)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.patient.fullName}</span>
                  <Badge value={a.status} />
                  <Link href={`/doctor/consult/${a.id}`} className="inline-flex h-8 items-center gap-1 rounded-md border bg-card px-3 text-[13px] font-medium shadow-xs transition-colors hover:bg-muted"><T>Open</T></Link>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No appointments today" />}
        </CardContent>
      </Card>
    </div>
  );
}
