"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input, Textarea } from "@/components/ui/primitives";

type C = { id: string; complaint: string | null; clinicalNotes: string | null; diagnosis: string | null; treatmentPlan: string | null; completedAt: string | null };

export function ConsultWorkspace({ appointmentId, consultation, canStart }: { appointmentId: string; consultation: C | null; canStart: boolean }) {
  const router = useRouter(); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true); setErr(""); setMsg("");
    try { await fn(); setMsg(label); router.refresh(); } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  const num = (f: FormData, k: string) => { const v = String(f.get(k) || ""); return v ? Number(v) : undefined; };
  if (!consultation) {
    return canStart ? <div><Button disabled={busy} onClick={() => run("Consultation started", () => api("/api/consultations", { body: { appointmentId } }))}>Start consultation</Button>{err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}</div>
      : <p className="text-sm text-muted-foreground">This appointment cannot be started (patient must be checked in or waiting).</p>;
  }
  const done = !!consultation.completedAt; const cid = consultation.id;
  return (
    <div className="space-y-5">
      <form className="grid gap-3 rounded-lg border bg-card p-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
        const vitals = Object.fromEntries(Object.entries({ bpSystolic: num(f, "bpSystolic"), bpDiastolic: num(f, "bpDiastolic"), heartRate: num(f, "heartRate"), tempC: num(f, "tempC"), weightKg: num(f, "weightKg") }).filter(([, v]) => v !== undefined));
        run("Notes saved", () => api(`/api/consultations/${cid}`, { method: "PATCH", body: { complaint: String(f.get("complaint") || "") || null, clinicalNotes: String(f.get("clinicalNotes") || "") || null, diagnosis: String(f.get("diagnosis") || "") || null, treatmentPlan: String(f.get("treatmentPlan") || "") || null, vitals } })); }}>
        <h2 className="font-medium">Consultation</h2>
        <label className="text-sm">Complaint<Textarea name="complaint" defaultValue={consultation.complaint ?? ""} disabled={done} /></label>
        <div className="flex flex-wrap gap-2 text-xs"><label>BP sys<Input name="bpSystolic" type="number" disabled={done} className="mt-1 w-20" /></label><label>BP dia<Input name="bpDiastolic" type="number" disabled={done} className="mt-1 w-20" /></label><label>HR<Input name="heartRate" type="number" disabled={done} className="mt-1 w-20" /></label><label>Temp C<Input name="tempC" type="number" step="0.1" disabled={done} className="mt-1 w-20" /></label><label>Weight kg<Input name="weightKg" type="number" step="0.1" disabled={done} className="mt-1 w-24" /></label></div>
        <label className="text-sm">Clinical notes<Textarea name="clinicalNotes" defaultValue={consultation.clinicalNotes ?? ""} disabled={done} /></label>
        <label className="text-sm">Diagnosis (entered by the clinician)<Textarea name="diagnosis" defaultValue={consultation.diagnosis ?? ""} disabled={done} /></label>
        <label className="text-sm">Treatment plan<Textarea name="treatmentPlan" defaultValue={consultation.treatmentPlan ?? ""} disabled={done} /></label>
        {!done && <Button type="submit" disabled={busy}>Save notes</Button>}
      </form>
      {!done && <>
        <form className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          run("Prescription added", async () => { await api(`/api/consultations/${cid}/prescriptions`, { body: { items: [{ medication: String(f.get("medication")), dosage: String(f.get("dosage")), frequency: String(f.get("frequency")), duration: String(f.get("duration")) }] } }); form.reset(); }); }}>
          <h2 className="w-full font-medium">Prescription</h2>
          <label className="text-xs">Medication<Input name="medication" required className="mt-1 w-44" /></label><label className="text-xs">Dosage<Input name="dosage" required className="mt-1 w-28" /></label><label className="text-xs">Frequency<Input name="frequency" required className="mt-1 w-32" /></label><label className="text-xs">Duration<Input name="duration" required className="mt-1 w-28" /></label>
          <Button type="submit" disabled={busy}>Add prescription</Button>
        </form>
        <form className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          run("Lab requested", async () => { await api(`/api/consultations/${cid}/labs`, { body: { testName: String(f.get("testName")) } }); form.reset(); }); }}>
          <h2 className="w-full font-medium">Lab request</h2><label className="text-xs">Test<Input name="testName" required className="mt-1 w-56" /></label><Button type="submit" disabled={busy}>Request lab</Button>
        </form>
        <Button disabled={busy} onClick={() => run("Consultation completed and invoice created", () => api(`/api/consultations/${cid}/complete`, { body: {} }))}>Complete consultation</Button>
      </>}
      {done && <p className="text-sm text-green-700">This consultation is completed.</p>}
      {msg && <p role="status" className="text-sm text-green-700">{msg}</p>}{err && <p role="alert" className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
