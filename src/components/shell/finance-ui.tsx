"use client";
import { T } from "@/components/t";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Input, Select } from "@/components/ui/primitives";

type Opt = { id: string; name: string };

export function CashCloseForm({ branches }: { branches: Opt[] }) {
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(""); setErr(""); const f = new FormData(e.currentTarget);
    if (!window.confirm("Close the cash register for today with this count?")) return;
    setBusy(true);
    try {
      const r = await api<{ expected: string; counted: string; variance: string }>("/api/cash/close", { body: { branchId: String(f.get("branchId")), countedCash: String(f.get("counted")) } });
      setMsg(`Closed. Expected ${r.expected}, counted ${r.counted}, variance ${r.variance}.`);
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium"><T>Close cash register</T></summary>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs"><T>Branch</T><Select name="branchId" className="mt-1 w-44">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
        <label className="text-xs"><T>Counted cash</T><Input name="counted" type="number" min="0" step="0.01" required className="mt-1 w-32" /></label>
        <Button type="submit" disabled={busy}>{busy ? <T>Closing...</T> : <T>Close register</T>}</Button>
        {msg && <p role="status" className="w-full text-sm text-green-700"><T>{msg}</T></p>}{err && <p role="alert" className="w-full text-sm text-red-600"><T>{err}</T></p>}
      </form>
    </details>
  );
}

export function PurchaseOrderForm({ suppliers, branches, items }: { suppliers: Opt[]; branches: Opt[]; items: Opt[] }) {
  const router = useRouter(); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(""); setErr(""); setBusy(true); const form = e.currentTarget; const f = new FormData(form);
    try {
      await api("/api/inventory/purchase-orders", { body: { supplierId: String(f.get("supplierId")), branchId: String(f.get("branchId")), lines: [{ itemId: String(f.get("itemId")), quantity: Number(f.get("qty")), unitCost: String(f.get("cost")) }] } });
      setMsg("Purchase order created."); form.reset(); router.refresh();
    } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium"><T>New purchase order</T></summary>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs"><T>Supplier</T><Select name="supplierId" className="mt-1 w-48">{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
        <label className="text-xs"><T>Deliver to</T><Select name="branchId" className="mt-1 w-40">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
        <label className="text-xs"><T>Item</T><Select name="itemId" className="mt-1 w-48">{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></label>
        <label className="text-xs"><T>Order quantity</T><Input name="qty" type="number" min="1" step="1" required className="mt-1 w-24" /></label>
        <label className="text-xs"><T>Unit cost</T><Input name="cost" type="number" min="0" step="0.01" required className="mt-1 w-28" /></label>
        <Button type="submit" disabled={busy}>{busy ? <T>Saving...</T> : <T>Create order</T>}</Button>
        {msg && <p role="status" className="w-full text-sm text-green-700"><T>{msg}</T></p>}{err && <p role="alert" className="w-full text-sm text-red-600"><T>{err}</T></p>}
      </form>
    </details>
  );
}

export function ReceivePoButton({ id }: { id: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function go() {
    if (!window.confirm("Mark this order as received and add its stock?")) return;
    setBusy(true); setErr("");
    try { await api(`/api/inventory/purchase-orders/${id}/receive`, { method: "POST", body: {} }); router.refresh(); } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); } finally { setBusy(false); }
  }
  return <span><Button variant="outline" onClick={go} disabled={busy}><T>Receive</T></Button>{err && <span role="alert" className="ms-2 text-xs text-red-600"><T>{err}</T></span>}</span>;
}
