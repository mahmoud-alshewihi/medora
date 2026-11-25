"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input } from "@/components/ui/primitives";

export function SettingsForm({ c }: { c: { name: string; phone: string | null; email: string | null; address: string | null; invoicePrefix: string; primaryColor: string } }) {
  const router = useRouter(); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setMsg(""); setBusy(true); const f = new FormData(e.currentTarget);
    try {
      await api("/api/settings", { method: "PATCH", body: { name: String(f.get("name")), phone: String(f.get("phone") || "") || null, email: String(f.get("email") || "") || null, address: String(f.get("address") || "") || null, invoicePrefix: String(f.get("invoicePrefix")), primaryColor: String(f.get("primaryColor")) } });
      setMsg("Settings saved"); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="grid max-w-xl gap-3 rounded-lg border bg-card p-4">
      <label className="text-sm"><T>Clinic name</T><Input name="name" required defaultValue={c.name} className="mt-1" /></label>
      <label className="text-sm"><T>Phone</T><Input name="phone" defaultValue={c.phone ?? ""} className="mt-1" /></label>
      <label className="text-sm"><T>Email</T><Input name="email" type="email" defaultValue={c.email ?? ""} className="mt-1" /></label>
      <label className="text-sm"><T>Address</T><Input name="address" defaultValue={c.address ?? ""} className="mt-1" /></label>
      <label className="text-sm"><T>Invoice prefix</T><Input name="invoicePrefix" required defaultValue={c.invoicePrefix} className="mt-1" /></label>
      <label className="text-sm"><T>Brand colour</T><Input name="primaryColor" required defaultValue={c.primaryColor} pattern="#[0-9a-fA-F]{6}" className="mt-1" /></label>
      <Button type="submit" disabled={busy}>{busy ? <T>Saving...</T> : <T>Save settings</T>}</Button>
      {msg && <p role="status" className="text-sm text-green-700"><T>{msg}</T></p>}{err && <p role="alert" className="text-sm text-red-600"><T>{err}</T></p>}
    </form>
  );
}
