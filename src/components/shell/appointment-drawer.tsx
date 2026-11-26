"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Stethoscope, UserRound } from "lucide-react";
import { Badge, Button, Sheet, Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";
import { T, useTx } from "@/components/t";
import { toast } from "sonner";

interface Detail {
  id: string; startsAt: string; status: string; reference?: string | null; notes?: string | null;
  patient: { id: string; fullName: string; mrn: string }; doctor: { fullName: string };
  history: { id: string; from: string | null; to: string; note: string | null; createdAt: string }[];
}

const NEXT: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["WAITING", "CANCELLED"], WAITING: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"], COMPLETED: [], CANCELLED: [], NO_SHOW: [],
};

export function AppointmentDrawer({ id, open, onOpenChange }: { id: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [d, setD] = React.useState<Detail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();
  const tx = useTx();

  React.useEffect(() => {
    if (!open || !id) return;
    setD(null);
    api<Detail>(`/api/appointments/${id}`).then(setD).catch((e) => toast.error(e.message ?? "Failed"));
  }, [open, id]);

  const move = async (to: string) => {
    if (!d) return;
    setBusy(true);
    try {
      await api(`/api/appointments/${d.id}`, { method: "PATCH", body: { action: "status", to } });
      toast.success(tx("Status updated"));
      const fresh = await api<Detail>(`/api/appointments/${d.id}`); setD(fresh);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={tx("Appointment details")}>
      {!d ? <div className="space-y-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24" /></div> : (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold tracking-tight">{d.patient.fullName}</p>
              <p className="tnum text-[13px] text-muted-foreground">{d.patient.mrn}{d.reference ? ` · ${d.reference}` : ""}</p>
            </div>
            <Badge value={d.status} />
          </div>
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /><span className="tnum">{new Date(d.startsAt).toLocaleString()}</span></p>
            <p className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" />{d.doctor.fullName}</p>
            <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /><a className="text-primary hover:underline" href={`/admin/patients/${d.patient.id}`}><T>Open patient profile</T></a></p>
          </div>
          {NEXT[d.status]?.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><T>Change status</T></p>
              <div className="flex flex-wrap gap-2">
                {NEXT[d.status].map((to) => (
                  <Button key={to} size="sm" variant={to === "CANCELLED" || to === "NO_SHOW" ? "outline" : "primary"} disabled={busy} onClick={() => void move(to)}>
                    <T>{to.replace(/_/g, " ")}</T>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><T>History</T></p>
            {d.history.length ? (
              <ol className="relative space-y-3 border-s-2 ps-4">
                {d.history.map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                    <p>{h.from ? <><Badge value={h.from} /> → </> : null}<Badge value={h.to} /></p>
                    <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}{h.note ? ` · ${h.note}` : ""}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-muted-foreground"><T>No history yet</T></p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
