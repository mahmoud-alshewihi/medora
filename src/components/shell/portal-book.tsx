"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui/primitives";

interface Slots { slots: { time: string; startsAt: string }[]; closedReason?: string }

export function PortalBook({ slug, branches, doctors }: { slug: string; branches: { id: string; name: string }[]; doctors: { id: string; fullName: string }[] }) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? ""); const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [date, setDate] = useState(""); const [slots, setSlots] = useState<Slots | null>(null); const [startsAt, setStartsAt] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSlots(null); setStartsAt("");
    if (!(branchId && doctorId && date)) return;
    let live = true;
    api<Slots>(`/api/public/slots?clinicSlug=${slug}&doctorId=${doctorId}&branchId=${branchId}&date=${date}`).then((r) => { if (live) setSlots(r); }).catch((x) => { if (live) setErr(x instanceof Error ? x.message : "Could not load slots"); });
    return () => { live = false; };
  }, [slug, branchId, doctorId, date]);
  async function book(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setMsg(""); setBusy(true); const f = new FormData(e.currentTarget);
    try { await api("/api/portal/appointments", { body: { branchId, doctorId, startsAt, reason: String(f.get("reason") || "") || null } }); setMsg("Appointment booked"); router.refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Booking failed"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={book} className="grid max-w-xl gap-3 rounded-lg border bg-card p-4">
      <label className="text-sm"><T>Branch</T><Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-1">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
      <label className="text-sm"><T>Doctor</T><Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="mt-1">{doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</Select></label>
      <label className="text-sm"><T>Date</T><Input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="mt-1" /></label>
      {slots && (slots.slots.length ? <div role="radiogroup" aria-label="Available times" className="flex flex-wrap gap-2">{slots.slots.map((s) => <button type="button" key={s.startsAt} role="radio" aria-checked={startsAt === s.startsAt} onClick={() => setStartsAt(s.startsAt)} className={"rounded border px-2 py-1 text-sm " + (startsAt === s.startsAt ? "bg-primary text-primary-foreground" : "")}>{s.time}</button>)}</div> : <p className="text-sm text-muted-foreground">{slots.closedReason ?? "No available times on this date."}</p>)}
      <label className="text-sm"><T>Reason (optional)</T><Input name="reason" maxLength={300} className="mt-1" /></label>
      <Button type="submit" disabled={busy || !startsAt}>{busy ? <T>Booking...</T> : <T>Book appointment</T>}</Button>
      {msg && <p role="status" className="text-sm text-green-700"><T>{msg}</T></p>}{err && <p role="alert" className="text-sm text-red-600"><T>{err}</T></p>}
    </form>
  );
}
