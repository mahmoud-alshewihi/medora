"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui/primitives";

type Opt = { id: string; name: string };
export function StockForms({ items, branches, lockBranch }: { items: Opt[]; branches: Opt[]; lockBranch: boolean }) {
  const router = useRouter(); const [mode, setMode] = useState<"receive" | "consume">("receive");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setMsg(""); setBusy(true); const form = e.currentTarget; const f = new FormData(form);
    const base = { itemId: String(f.get("itemId")), branchId: String(f.get("branchId")), quantity: Number(f.get("quantity")) };
    try {
      if (mode === "receive") await api("/api/inventory/receive", { body: { ...base, batchNumber: String(f.get("batchNumber")), expiresOn: String(f.get("expiresOn") || "") || null } });
      else await api("/api/inventory/consume", { body: { ...base, reason: String(f.get("reason") || "") || undefined } });
      setMsg(mode === "receive" ? "Stock received" : "Stock consumed"); form.reset(); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="inline-flex overflow-hidden rounded-md border" role="group" aria-label="Stock action">{(["receive", "consume"] as const).map((m) => <button type="button" key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={"px-3 py-1.5 text-sm capitalize " + (mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{m === "receive" ? <T>Receive stock</T> : <T>Consume / use</T>}</button>)}</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs"><T>Item</T><Select name="itemId" required className="mt-1 w-56">{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></label>
        <label className="text-xs"><T>Branch</T><Select name="branchId" required className="mt-1 w-40">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
        <label className="text-xs"><T>Quantity</T><Input name="quantity" type="number" min={1} step={1} required className="mt-1 w-24" /></label>
        {mode === "receive" ? <><label className="text-xs"><T>Batch number</T><Input name="batchNumber" required maxLength={40} className="mt-1 w-36" /></label><label className="text-xs"><T>Expiry date</T><Input name="expiresOn" type="date" className="mt-1 w-40" /></label></>
          : <label className="text-xs"><T>Reason</T><Input name="reason" maxLength={200} className="mt-1 w-48" /></label>}
        <Button type="submit" disabled={busy}>{busy ? <T>Saving...</T> : mode === "receive" ? <T>Receive</T> : <T>Consume</T>}</Button>
      </div>
      {lockBranch && <p className="text-xs text-muted-foreground"><T>Your account is limited to its own branch.</T></p>}
      {msg && <p role="status" className="text-sm text-green-700">{msg}</p>}{err && <p role="alert" className="text-sm text-red-600">{err}</p>}
    </form>
  );
}
