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
      <p className="w-full text-xs text-muted-foreground">Doctors need specialty, fee and schedules; add them through POST /api/staff (doctor form not built yet).</p>
      {err && <p role="alert" className="w-full text-sm text-red-600">{err}</p>}
    </form>
  );
}
