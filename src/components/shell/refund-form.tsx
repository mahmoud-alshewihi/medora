"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input } from "@/components/ui/primitives";

export function RefundForm({ paymentId, max }: { paymentId: string; max: string }) {
  const router = useRouter(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const key = useRef(crypto.randomUUID());
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true); const f = new FormData(e.currentTarget);
    try { await api(`/api/payments/${paymentId}/refunds`, { body: { amount: String(f.get("amount")), reason: String(f.get("reason")), idempotencyKey: key.current } }); key.current = crypto.randomUUID(); router.refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="no-print mt-1 flex flex-wrap items-end gap-2 text-xs">
      <label><T>Refund</T><Input name="amount" required inputMode="decimal" defaultValue={max} className="ms-1 w-24" aria-label={`Refund amount ${paymentId}`} /></label>
      <label><T>Reason</T><Input name="reason" required minLength={2} className="ms-1 w-44" aria-label={`Refund reason ${paymentId}`} /></label>
      <Button type="submit" variant="outline" disabled={busy}><T>Refund</T></Button>
      {err && <span role="alert" className="text-red-600">{err}</span>}
    </form>
  );
}
