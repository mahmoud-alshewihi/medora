"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui/primitives";

export function StaffStatusButton({ userId, status }: { userId: string; status: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function toggle() {
    setBusy(true); setErr("");
    try { await api("/api/staff", { method: "PATCH", body: { userId, status: status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } }); router.refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return <span><Button variant="outline" onClick={toggle} disabled={busy}>{status === "ACTIVE" ? "Suspend" : "Reactivate"}</Button>{err && <span role="alert" className="ms-2 text-xs text-red-600">{err}</span>}</span>;
}

export function StaffForm({ branches }: { branches: { id: string; name: string }[] }) {
  const router = useRouter(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true); const form = e.currentTarget; const f = new FormData(form);
    try {
      await api("/api/staff", { body: { fullName: String(f.get("fullName")), email: String(f.get("email")), password: String(f.get("password")), role: String(f.get("role")), branchId: String(f.get("branchId") || "") || null } });
      form.reset(); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <label className="text-xs">Full name<Input name="fullName" required className="mt-1 w-44" /></label>
      <label className="text-xs">Email<Input name="email" type="email" required className="mt-1 w-52" /></label>
      <label className="text-xs">Temporary password<Input name="password" type="password" required minLength={8} className="mt-1 w-40" /></label>
      <label className="text-xs">Role<Select name="role" className="mt-1 w-40"><option value="RECEPTIONIST">Receptionist</option><option value="ACCOUNTANT">Accountant</option><option value="NURSE">Nurse</option><option value="BRANCH_MANAGER">Branch manager</option></Select></label>
      <label className="text-xs">Branch<Select name="branchId" className="mt-1 w-40"><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add staff"}</Button>
            {err && <p role="alert" className="w-full text-sm text-red-600">{err}</p>}
    </form>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function DoctorForm({ branches, specialties }: { branches: { id: string; name: string }[]; specialties: { id: string; name: string }[] }) {
  const router = useRouter(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [ok, setOk] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setOk(""); const form = e.currentTarget; const f = new FormData(form);
    const days = DAYS.map((_, i) => i).filter((i) => f.get("day" + i));
    if (days.length === 0) { setErr("Choose at least one working day"); return; }
    const branchId = String(f.get("branchId"));
    setBusy(true);
    try {
      await api("/api/staff", { body: {
        fullName: String(f.get("fullName")), email: String(f.get("email")), password: String(f.get("password")), role: "DOCTOR", branchId,
        doctor: { specialtyId: String(f.get("specialtyId")), consultationFee: String(f.get("fee")), commissionPercent: String(f.get("commission") || "0"), slotDurationMin: Number(f.get("slot")), yearsExperience: Number(f.get("years") || 0),
          schedules: days.map((weekday) => ({ branchId, weekday, startTime: String(f.get("start")), endTime: String(f.get("end")) })) },
      } });
      form.reset(); setOk("Doctor added. They can now be booked in the working hours you set."); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium">Add a doctor</summary>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">Full name<Input name="fullName" required className="mt-1 w-44" /></label>
        <label className="text-xs">Email<Input name="email" type="email" required className="mt-1 w-52" /></label>
        <label className="text-xs">Temporary password<Input name="password" type="password" required minLength={8} className="mt-1 w-40" /></label>
        <label className="text-xs">Specialty<Select name="specialtyId" required className="mt-1 w-40">{specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
        <label className="text-xs">Branch<Select name="branchId" required className="mt-1 w-40">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
        <label className="text-xs">Consultation fee<Input name="fee" type="number" min="0" step="0.01" required className="mt-1 w-28" /></label>
        <label className="text-xs">Commission %<Input name="commission" type="number" min="0" max="100" step="0.5" defaultValue="0" className="mt-1 w-24" /></label>
        <label className="text-xs">Slot (min)<Input name="slot" type="number" min="5" max="120" step="5" defaultValue="30" className="mt-1 w-20" /></label>
        <label className="text-xs">Years of experience<Input name="years" type="number" min="0" defaultValue="0" className="mt-1 w-24" /></label>
        <label className="text-xs">From<Input name="start" type="time" defaultValue="09:00" required className="mt-1 w-28" /></label>
        <label className="text-xs">To<Input name="end" type="time" defaultValue="17:00" required className="mt-1 w-28" /></label>
        <fieldset className="flex w-full flex-wrap gap-3 text-xs"><legend className="mb-1">Working days</legend>
          {DAYS.map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name={"day" + i} defaultChecked={i >= 0 && i <= 4} />{d}</label>)}
        </fieldset>
        <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add doctor"}</Button>
        {ok && <p role="status" className="w-full text-sm text-green-700">{ok}</p>}
        {err && <p role="alert" className="w-full text-sm text-red-600">{err}</p>}
      </form>
    </details>
  );
}
