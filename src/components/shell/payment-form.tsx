"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui/primitives";

export function PaymentForm({ invoiceId, remaining }: { invoiceId: string; remaining: string }) {
  const router = useRouter();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID()); // one key per form instance: double-clicks cannot double-charge
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/invoices/${invoiceId}/payments`, { body: { amount: String(f.get("amount")), method: String(f.get("method")), idempotencyKey: key.current, reference: String(f.get("reference") || "") || null } });
      key.current = crypto.randomUUID(); router.refresh(); e.currentTarget.reset();
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="no-print flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <label className="text-xs">Amount<Input name="amount" required inputMode="decimal" defaultValue={remaining} className="mt-1 w-32" /></label>
      <label className="text-xs">Method<Select name="method" className="mt-1 w-44"><option value="CASH">Cash</option><option value="CARD">Card (recorded offline)</option><option value="BANK_TRANSFER">Bank transfer</option><option value="MOBILE_WALLET">Mobile wallet</option></Select></label>
      <label className="text-xs">Reference<Input name="reference" className="mt-1 w-40" /></label>
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Record payment"}</Button>
      {err && <p role="alert" className="w-full text-sm text-red-600">{err}</p>}
    </form>
  );
}
