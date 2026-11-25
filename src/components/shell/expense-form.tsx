"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui/primitives";

export function ExpenseForm({ categories, branches, lockBranch }: { categories: { id: string; name: string }[]; branches: { id: string; name: string }[]; lockBranch: boolean }) {
  const router = useRouter(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true); const form = e.currentTarget; const f = new FormData(form);
    try {
      await api("/api/expenses", { body: { categoryId: String(f.get("categoryId")), branchId: lockBranch ? null : String(f.get("branchId") || "") || null, description: String(f.get("description")), amount: String(f.get("amount")), incurredOn: String(f.get("incurredOn")) } });
      form.reset(); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <label className="text-xs"><T>Category</T><Select name="categoryId" required className="mt-1 w-40">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>
      {!lockBranch && <label className="text-xs"><T>Branch</T><Select name="branchId" className="mt-1 w-40"><option value=""><T>Clinic-wide</T></option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>}
      <label className="text-xs"><T>Description</T><Input name="description" required minLength={2} className="mt-1 w-56" /></label>
      <label className="text-xs"><T>Amount</T><Input name="amount" required inputMode="decimal" className="mt-1 w-28" /></label>
      <label className="text-xs"><T>Date</T><Input type="date" name="incurredOn" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-40" /></label>
      <Button type="submit" disabled={busy}>{busy ? <T>Saving...</T> : <T>Add expense</T>}</Button>
      {err && <p role="alert" className="w-full text-sm text-red-600"><T>{err}</T></p>}
    </form>
  );
}
