"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { T } from "@/components/t";
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
  if (done) return (
    <Card className="mt-6" role="status">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success"><Check className="h-7 w-7" /></span>
        <h2 className="text-xl font-bold"><T>Booking confirmed</T></h2>
        <p className="text-sm"><T>Your booking reference is</T> <b className="tnum font-mono text-lg text-primary">{done.reference}</b>. <T>Keep it for check-in.</T></p>
        <p className="max-w-sm text-sm text-muted-foreground"><T>The clinic will confirm shortly. No email is sent unless the clinic has configured an email provider.</T></p>
      </CardContent>
    </Card>
  );
  const docName = doctors.find((d) => d.id === doctorId)?.fullName;
  return (
    <div className="mt-5">
      <ol className="mb-5 flex items-center" aria-label="Booking progress">
        {steps.map((s, i) => (
          <li key={s} className={"flex items-center " + (i < steps.length - 1 ? "flex-1" : "")}>
            <span className="flex flex-col items-center gap-1">
              <span className={"grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition " + (i < step ? "bg-primary text-white" : i === step ? "bg-primary text-white ring-4 ring-primary/20" : "bg-muted text-muted-foreground")}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={"hidden text-[11px] sm:block " + (i === step ? "font-semibold text-primary" : "text-muted-foreground")}><T>{s}</T></span>
            </span>
            {i < steps.length - 1 ? <span className={"mx-1.5 mb-4 h-0.5 flex-1 rounded sm:mb-5 " + (i < step ? "bg-primary" : "bg-muted")} aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <Card>
        <CardHeader><CardTitle><T>{steps[step]!}</T></CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && <Field label={<T>Clinic branch</T>} htmlFor="b"><Select id="b" value={branchId} onChange={(e) => { setBranchId(e.target.value); setDoctorId(""); }}><option value=""><T>Select branch</T></option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>}
          {step === 1 && <Field label={<T>Medical specialty</T>} htmlFor="s"><Select id="s" value={specialtyId} onChange={(e) => { setSpecialtyId(e.target.value); setDoctorId(""); }}><option value=""><T>Select specialty</T></option>{specialties.filter((s) => doctors.some((d) => d.specialtyId === s.id && d.branchIds.includes(branchId))).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
          {step === 2 && <Field label={<T>Doctor</T>} htmlFor="d"><Select id="d" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}><option value=""><T>Select doctor</T></option>{docs.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</Select></Field>}
          {step === 3 && <Field label={<T>Appointment date</T>} htmlFor="dt"><Input id="dt" type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setStartsAt(""); }} /></Field>}
          {step === 4 && (slots.isLoading ? <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div> : slots.error ? <ErrorState message="Could not load time slots" onRetry={() => void slots.refetch()} /> :
            slots.data?.slots.length ? <div role="radiogroup" aria-label="Available times" className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.data.slots.map((s) => <button key={s.startsAt} role="radio" aria-checked={startsAt === s.startsAt} onClick={() => { setStartsAt(s.startsAt); setTime(s.time); }} className={"tnum rounded-md border px-2 py-2 text-sm font-medium transition " + (startsAt === s.startsAt ? "border-primary bg-primary text-white shadow-xs" : "hover:border-primary/40 hover:bg-primary-soft/40")}>{s.time}</button>)}</div>
              : <p className="text-sm text-muted-foreground">{slots.data?.closedReason ?? <T>No available times on this date. Try another date.</T>}</p>)}
          {step === 5 && <div className="space-y-3"><Field label={<T>Full name</T>}><Input required value={p.fullName} onChange={(e) => setP({ ...p, fullName: e.target.value })} /></Field><Field label={<T>Phone</T>}><Input required inputMode="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field><Field label={<T>Email (optional)</T>}><Input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field><Field label={<T>Reason for visit (optional)</T>}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>}
          {step === 6 && (
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 rounded-lg bg-muted/50 p-4 text-sm">
              <dt className="text-muted-foreground"><T>Branch</T></dt><dd className="font-medium">{branches.find((b) => b.id === branchId)?.name}</dd>
              <dt className="text-muted-foreground"><T>Doctor</T></dt><dd className="font-medium">{docName}</dd>
              <dt className="text-muted-foreground"><T>When</T></dt><dd className="tnum font-medium">{date} · {time}</dd>
              <dt className="text-muted-foreground"><T>Patient</T></dt><dd className="font-medium">{p.fullName} <span className="tnum text-muted-foreground">({p.phone})</span></dd>
            </dl>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="outline" disabled={step === 0 || (!!preset && step === 1)} onClick={() => setStep(step - 1)}><T>Back</T></Button>
            {step < 6 ? <Button disabled={(step === 0 && !branchId) || (step === 1 && !specialtyId) || (step === 2 && !doctorId) || (step === 3 && !date) || (step === 4 && !startsAt) || (step === 5 && (p.fullName.trim().length < 2 || p.phone.trim().length < 6))} onClick={() => setStep(step + 1)}><T>Next</T></Button>
              : <Button disabled={busy} onClick={() => void confirm()}>{busy ? <T>Booking...</T> : <T>Confirm appointment</T>}</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
