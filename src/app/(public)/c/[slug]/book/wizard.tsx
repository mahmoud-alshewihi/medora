"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, ErrorState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/api-client";

interface Props { slug: string; branches: { id: string; name: string }[]; specialties: { id: string; name: string }[]; doctors: { id: string; fullName: string; specialtyId: string; branchIds: string[] }[]; presetDoctor?: string }
interface Slots { slots: { time: string; startsAt: string }[]; closedReason?: string }

export function BookingWizard({ slug, branches, specialties, doctors, presetDoctor }: Props) {
  const preset = doctors.find((d) => d.id === presetDoctor);
  const [step, setStep] = useState(preset ? 1 : 0);
  const [branchId, setBranchId] = useState(preset?.branchIds[0] ?? "");
  const [specialtyId, setSpecialtyId] = useState(preset?.specialtyId ?? "");
  const [doctorId, setDoctorId] = useState(preset?.id ?? "");
  const [date, setDate] = useState(""); const [startsAt, setStartsAt] = useState(""); const [time, setTime] = useState("");
  const [p, setP] = useState({ fullName: "", phone: "", email: "" }); const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ reference: string } | null>(null); const [busy, setBusy] = useState(false);
  const steps = ["Branch", "Specialty", "Doctor", "Date", "Time", "Your details", "Review"];
  const docs = doctors.filter((d) => d.specialtyId === specialtyId && d.branchIds.includes(branchId));
  const today = new Date().toISOString().slice(0, 10);
  const slots = useQuery({ queryKey: ["slots", slug, doctorId, branchId, date], enabled: !!(doctorId && branchId && date), queryFn: () => api<Slots>(`/api/public/slots?clinicSlug=${slug}&doctorId=${doctorId}&branchId=${branchId}&date=${date}`) });
  async function confirm() {
    setBusy(true);
    try { const r = await api<{ reference: string }>("/api/public/book", { body: { clinicSlug: slug, branchId, doctorId, startsAt, reason: reason || undefined, patient: p } }); setDone(r); toast.success("Appointment booked"); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Booking failed"); if (e instanceof ApiError && e.status === 409) { setStep(4); void slots.refetch(); } }
    finally { setBusy(false); }
  }
  if (done) return <Card className="mt-6 space-y-2 p-6" role="status"><h2 className="text-xl font-semibold">Booking confirmed</h2><p>Your booking reference is <b className="font-mono text-lg">{done.reference}</b>. Keep it for check-in.</p><p className="text-sm text-muted-foreground">The clinic will confirm shortly. No email is sent unless the clinic has configured an email provider.</p></Card>;
  const docName = doctors.find((d) => d.id === doctorId)?.fullName;
  return (
    <div className="mt-4">
      <ol className="mb-4 flex flex-wrap gap-2 text-xs">{steps.map((s, i) => <li key={s} className={"rounded px-2 py-1 " + (i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{i + 1}. {s}</li>)}</ol>
      <Card className="space-y-4 p-5">
        {step === 0 && <Field label="Clinic branch" htmlFor="b"><Select id="b" value={branchId} onChange={(e) => { setBranchId(e.target.value); setDoctorId(""); }}><option value="">Select branch</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>}
        {step === 1 && <Field label="Medical specialty" htmlFor="s"><Select id="s" value={specialtyId} onChange={(e) => { setSpecialtyId(e.target.value); setDoctorId(""); }}><option value="">Select specialty</option>{specialties.filter((s) => doctors.some((d) => d.specialtyId === s.id && d.branchIds.includes(branchId))).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
        {step === 2 && <Field label="Doctor" htmlFor="d"><Select id="d" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}><option value="">Select doctor</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</Select></Field>}
        {step === 3 && <Field label="Appointment date" htmlFor="dt"><Input id="dt" type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setStartsAt(""); }} /></Field>}
        {step === 4 && (slots.isLoading ? <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div> : slots.error ? <ErrorState message="Could not load time slots" onRetry={() => void slots.refetch()} /> :
          slots.data?.slots.length ? <div role="radiogroup" aria-label="Available times" className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.data.slots.map((s) => <button key={s.startsAt} role="radio" aria-checked={startsAt === s.startsAt} onClick={() => { setStartsAt(s.startsAt); setTime(s.time); }} className={"rounded-md border px-2 py-2 text-sm " + (startsAt === s.startsAt ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{s.time}</button>)}</div>
            : <p className="text-sm text-muted-foreground">{slots.data?.closedReason ?? "No available times on this date. Try another date."}</p>)}
        {step === 5 && <div className="space-y-3"><Field label="Full name"><Input required value={p.fullName} onChange={(e) => setP({ ...p, fullName: e.target.value })} /></Field><Field label="Phone"><Input required inputMode="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field><Field label="Email (optional)"><Input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field><Field label="Reason for visit (optional)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>}
        {step === 6 && <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm"><dt className="text-muted-foreground">Branch</dt><dd>{branches.find((b) => b.id === branchId)?.name}</dd><dt className="text-muted-foreground">Doctor</dt><dd>{docName}</dd><dt className="text-muted-foreground">When</dt><dd>{date} at {time}</dd><dt className="text-muted-foreground">Patient</dt><dd>{p.fullName} ({p.phone})</dd></dl>}
        <div className="flex justify-between pt-2"><Button variant="outline" disabled={step === 0 || (!!preset && step === 1)} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 6 ? <Button disabled={(step === 0 && !branchId) || (step === 1 && !specialtyId) || (step === 2 && !doctorId) || (step === 3 && !date) || (step === 4 && !startsAt) || (step === 5 && (p.fullName.trim().length < 2 || p.phone.trim().length < 6))} onClick={() => setStep(step + 1)}>Next</Button>
            : <Button disabled={busy} onClick={() => void confirm()}>{busy ? "Booking..." : "Confirm appointment"}</Button>}</div>
      </Card>
    </div>
  );
}
