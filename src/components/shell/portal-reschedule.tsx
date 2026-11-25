"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input } from "@/components/ui/primitives";

interface Slots { slots: { time: string; startsAt: string }[]; closedReason?: string }

export function RescheduleButton({ appointmentId, slug, doctorId, branchId }: { appointmentId: string; slug: string; doctorId: string; branchId: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [date, setDate] = useState(""); const [slots, setSlots] = useState<Slots | null>(null);
  const [startsAt, setStartsAt] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSlots(null); setStartsAt("");
    if (!open || !date) return;
    let live = true;
    api<Slots>(`/api/public/slots?clinicSlug=${slug}&doctorId=${doctorId}&branchId=${branchId}&date=${date}`).then((r) => { if (live) setSlots(r); }).catch((x) => { if (live) setErr(x instanceof Error ? x.message : "Could not load times"); });
    return () => { live = false; };
  }, [open, date, slug, doctorId, branchId]);
  async function save() {
    setBusy(true); setErr("");
    try { await api("/api/portal/appointments", { method: "PATCH", body: { action: "reschedule", appointmentId, startsAt } }); setOpen(false); router.refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>Reschedule</Button>;
  return (
    <div className="space-y-2 rounded border p-2">
      <Input type="date" aria-label="New date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
      {slots && (slots.slots.length ? <div role="radiogroup" aria-label="New time" className="flex flex-wrap gap-1">{slots.slots.map((s) => <button type="button" key={s.startsAt} role="radio" aria-checked={startsAt === s.startsAt} onClick={() => setStartsAt(s.startsAt)} className={"rounded border px-2 py-0.5 text-xs " + (startsAt === s.startsAt ? "bg-primary text-primary-foreground" : "")}>{s.time}</button>)}</div> : <p className="text-xs text-muted-foreground">{slots.closedReason ?? "No available times on this date."}</p>)}
      <div className="flex gap-2"><Button disabled={busy || !startsAt} onClick={save}><T>Confirm</T></Button><Button variant="outline" onClick={() => setOpen(false)}>Close</Button></div>
      {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
