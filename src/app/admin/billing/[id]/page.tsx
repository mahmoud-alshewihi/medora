import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Card } from "@/components/ui/primitives";
import { RefundForm } from "@/components/shell/refund-form";
import { PaymentForm } from "@/components/shell/payment-form";
import { can } from "@/server/auth/permissions";
import { pageAccess } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageAccess("billing.read"); const { id } = await params;
  const inv = await db.invoice.findFirst({ where: { id, clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { patient: true, items: true, payments: { include: { refunds: true } }, clinic: true } });
  if (!inv) notFound();
  const m = (v: { toString(): string }) => formatMoney(v.toString(), inv.currency);
  const remaining = inv.total.sub(inv.paidAmount).add(inv.refundedAmount);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between"><div><h1 className="text-2xl font-semibold">Invoice {inv.number}</h1><p className="text-sm text-muted-foreground">{inv.clinic.name} &middot; {inv.patient.fullName} ({inv.patient.mrn})</p></div><Badge value={inv.status} /></div>
      <Card className="p-4"><table className="w-full text-sm"><tbody>{inv.items.map((i) => <tr key={i.id} className="border-b"><td className="py-1">{i.description}</td><td className="text-end">{m(i.lineTotal)}</td></tr>)}
        <tr><td className="pt-2">Subtotal</td><td className="text-end">{m(inv.subtotal)}</td></tr><tr><td>Discount</td><td className="text-end">-{m(inv.discountAmount)}</td></tr><tr><td>Tax</td><td className="text-end">{m(inv.taxAmount)}</td></tr>
        <tr className="font-semibold"><td>Total</td><td className="text-end">{m(inv.total)}</td></tr><tr><td>Paid</td><td className="text-end">{m(inv.paidAmount)}</td></tr><tr><td>Refunded</td><td className="text-end">{m(inv.refundedAmount)}</td></tr></tbody></table></Card>
      <Card className="p-4"><h2 className="mb-2 font-medium">Payments</h2>{inv.payments.length ? <ul className="text-sm">{inv.payments.map((p) => <li key={p.id} className="py-1">{p.receiptNumber} &middot; {p.method} &middot; {m(p.amount)}{p.refunds.length > 0 && <span className="text-muted-foreground"> (refunded {m(p.refunds.reduce((a, r) => a.add(r.amount), p.amount.mul(0)))})</span>}{can(ctx.role, "refund.create") && p.amount.sub(p.refunds.reduce((a, r) => a.add(r.amount), p.amount.mul(0))).gt(0) && <RefundForm paymentId={p.id} max={p.amount.sub(p.refunds.reduce((a, r) => a.add(r.amount), p.amount.mul(0))).toFixed(2)} />}</li>)}</ul> : <p className="text-sm text-muted-foreground">No payments yet</p>}</Card>
      {can(ctx.role, "payment.record") && remaining.gt(0) && inv.status !== "VOID" && <PaymentForm invoiceId={inv.id} remaining={remaining.toFixed(2)} />}
      <p className="no-print text-xs text-muted-foreground">Use your browser&apos;s Print to produce a printable copy.</p>
    </div>
  );
}
