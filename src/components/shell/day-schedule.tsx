"use client";
import * as React from "react";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { T } from "@/components/t";
import { AppointmentDrawer } from "./appointment-drawer";

export interface DayRow { id: string; time: string; sortKey: number; patient: string; doctor: string; branch: string; status: string }

export const STATUS_TONE: Record<string, string> = {
  PENDING: "border-s-warn", CONFIRMED: "border-s-info", CHECKED_IN: "border-s-[hsl(var(--chart-5))]", WAITING: "border-s-[hsl(var(--chart-5))]",
  IN_PROGRESS: "border-s-primary", COMPLETED: "border-s-success", CANCELLED: "border-s-danger", NO_SHOW: "border-s-muted-foreground",
};

export function DaySchedule({ rows, nowMinutes }: { rows: DayRow[]; nowMinutes: number | null }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  if (!rows.length) return <EmptyState title="No appointments on this day" hint="Try another date or doctor." />;
  const sorted = [...rows].sort((a, b) => a.sortKey - b.sortKey);
  let nowInserted = false;
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <ol className="divide-y">
        {sorted.map((a) => {
          const showNow = nowMinutes !== null && !nowInserted && a.sortKey > nowMinutes;
          if (showNow) nowInserted = true;
          return (
            <React.Fragment key={a.id}>
              {showNow ? <NowLine minutes={nowMinutes} /> : null}
              <li>
                <button onClick={() => setOpenId(a.id)}
                  className={cn("flex w-full items-center gap-3 border-s-4 px-4 py-3 text-start transition-colors hover:bg-muted/50", STATUS_TONE[a.status] ?? "border-s-muted-foreground")}>
                  <span className="tnum w-14 shrink-0 text-sm font-bold tracking-tight">{a.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.patient}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.doctor} · {a.branch}</span>
                  </span>
                  <Badge value={a.status} />
                </button>
              </li>
            </React.Fragment>
          );
        })}
        {nowMinutes !== null && !nowInserted ? <NowLine minutes={nowMinutes} /> : null}
      </ol>
      <AppointmentDrawer id={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}

function NowLine({ minutes }: { minutes: number }) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return (
    <li className="flex items-center gap-2 bg-danger-soft/40 px-4 py-1" aria-label="Current time">
      <span className="tnum text-[11px] font-bold text-danger">{hh}:{mm}</span>
      <span className="h-px flex-1 bg-danger/60" />
      <span className="text-[11px] font-medium text-danger"><T>Now</T></span>
    </li>
  );
}
