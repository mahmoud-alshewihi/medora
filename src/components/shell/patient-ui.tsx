"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui/primitives";

type P = { id: string; fullName: string; gender: string | null; dateOfBirth: string | null; phone: string | null; email: string | null; address: string | null };

export function PatientEditForm({ p }: { p: P }) {
  const router = useRouter(); const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setOk(""); setBusy(true); const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    try {
      await api("/api/patients/" + p.id, { method: "PATCH", body: { fullName: v("fullName"), gender: v("gender") || null, dateOfBirth: v("dob") || null, phone: v("phone") || null, email: v("email") || null, address: v("address") || null } });
      setOk("Saved."); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="text-xs"><T>Full name</T><Input name="fullName" defaultValue={p.fullName} required className="mt-1 w-48" /></label>
      <label className="text-xs"><T>Gender</T><Select name="gender" defaultValue={p.gender ?? ""} className="mt-1 w-32"><option value="">-</option><option value="MALE"><T>Male</T></option><option value="FEMALE"><T>Female</T></option><option value="OTHER"><T>Other</T></option></Select></label>
      <label className="text-xs"><T>Date of birth</T><Input name="dob" type="date" defaultValue={p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : ""} className="mt-1 w-40" /></label>
      <label className="text-xs"><T>Phone</T><Input name="phone" defaultValue={p.phone ?? ""} className="mt-1 w-40" /></label>
      <label className="text-xs"><T>Email</T><Input name="email" type="email" defaultValue={p.email ?? ""} className="mt-1 w-52" /></label>
      <label className="text-xs"><T>Address</T><Input name="address" defaultValue={p.address ?? ""} className="mt-1 w-64" /></label>
      <Button type="submit" disabled={busy}>{busy ? <T>Saving...</T> : <T>Save changes</T>}</Button>
      {ok && <p role="status" className="w-full text-sm text-green-700"><T>{ok}</T></p>}
      {err && <p role="alert" className="w-full text-sm text-red-600"><T>{err}</T></p>}
    </form>
  );
}

export function PatientImport() {
  const router = useRouter(); const [msg, setMsg] = useState(""); const [errs, setErrs] = useState<{ row: number; message: string }[]>([]); const [busy, setBusy] = useState(false); const [bad, setBad] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(""); setErrs([]); setBad(false);
    const file = (new FormData(e.currentTarget).get("file") as File | null);
    if (!file || file.size === 0) { setBad(true); setMsg("Choose a CSV file first"); return; }
    setBusy(true);
    try {
      const r = await api<{ created: number; errors: { row: number; message: string }[] }>("/api/patients/import", { raw: await file.text() });
      setMsg(`Imported ${r.created} patient(s); ${r.errors.length} row(s) skipped.`); setErrs(r.errors.slice(0, 20)); router.refresh();
    } catch (x) { setBad(true); setMsg(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium"><T>Import patients from CSV</T></summary>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">First row must be headers. Columns: fullName (required), gender, dateOfBirth (YYYY-MM-DD), phone, email, address. Max 5000 rows.</p>
        <div className="flex items-center gap-2"><input name="file" type="file" accept=".csv,text/csv" className="text-sm" /><Button type="submit" disabled={busy}>{busy ? <T>Importing...</T> : <T>Import</T>}</Button></div>
        {msg && <p role={bad ? "alert" : "status"} className={bad ? "text-sm text-red-600" : "text-sm text-green-700"}><T>{msg}</T></p>}
        {errs.length > 0 && <ul className="list-disc ps-5 text-xs text-red-600">{errs.map((x) => <li key={x.row}>Row {x.row}: {x.message}</li>)}</ul>}
      </form>
    </details>
  );
}
