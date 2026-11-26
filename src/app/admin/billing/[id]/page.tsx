import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { RefundForm } from "@/components/shell/refund-form";
import { PaymentForm } from "@/components/shell/payment-form";
import { MethodBadge } from "@/components/shell/method-badge";
import { can } from "@/server/auth/permissions";
import { pageAccess } from "@/server/auth/page-guard";
import { getLocale } from "@/lib/i18n/server";
import { T } from "@/components/t";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pageAccess("billing.read"); const { id } = await params;
  const inv = await db.invoice.findFirst({ where: { id, clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { patient: true, items: true, payments: { include: { refunds: true } }, clinic: true, branch: true } });
  if (!inv) notFound();
  const loc = await getLocale();
  const m = (v: { toString(): string }) => formatMoney(v.toString(), inv.currency);
  const remaining = inv.total.sub(inv.paidAmount).add(inv.refundedAmount);
  const dateFmt = new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="tnum text-xl font-bold tracking-tight sm:text-2xl"><T>Invoice</T> {inv.number}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {inv.clinic.name} · {inv.branch.name} · <span className="tnum">{dateFmt.format(inv.issuedAt)}</span>
          </p>
          <Link href={`/admin/patients/${inv.patient.id}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-strong">
            <UserRound className="h-4 w-4" />{inv.patient.fullName} <span className="tnum text-muted-foreground">({inv.patient.mrn})</span>
          </Link>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge value={inv.status} className="text-sm" />
          <span className="no-print inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Printer className="h-3.5 w-3.5" /><T>{"Use your browser's Print for a copy"}</T></span>
        </div>
      </div>

      {/* items + totals */}
      <Card>
        <CardHeader><CardTitle><T>Items</T></CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {inv.items.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-2">{i.description}{i.quantity > 1 ? <span className="tnum text-muted-foreground"> × {i.quantity}</span> : null}</td>
                  <td className="tnum py-2 text-end font-medium">{m(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground"><T>Subtotal</T></dt><dd className="tnum">{m(inv.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground"><T>Discount</T></dt><dd className="tnum text-success">-{m(inv.discountAmount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground"><T>Tax</T></dt><dd className="tnum">{m(inv.taxAmount)}</dd></div>
            <div className="flex justify-between border-t pt-2 text-base font-bold"><dt><T>Total</T></dt><dd className="tnum">{m(inv.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground"><T>Paid</T></dt><dd className="tnum text-success">{m(inv.paidAmount)}</dd></div>
            {inv.refundedAmount.gt(0) ? <div className="flex justify-between"><dt className="text-muted-foreground"><T>Refunded</T></dt><dd className="tnum text-danger">{m(inv.refundedAmount)}</dd></div> : null}
            <div className={cn("flex justify-between rounded-lg px-3 py-2 font-semibold", remaining.gt(0) ? "bg-warn-soft text-warn" : "bg-success-soft text-success")}>
              <dt><T>Remaining</T></dt><dd className="tnum">{m(remaining)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* payments */}
      <Card>
        <CardHeader><CardTitle><T>Payments</T></CardTitle></CardHeader>
        <CardContent>
          {inv.payments.length ? (
            <ul className="space-y-2">
              {inv.payments.map((p) => {
                const refunded = p.refunds.reduce((a, r) => a.add(r.amount), p.amount.mul(0));
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <MethodBadge method={p.method} />
                      <span className="tnum font-semibold">{m(p.amount)}</span>
                      <span className="tnum text-xs text-muted-foreground">{p.receiptNumber}</span>
                      {refunded.gt(0) ? <span className="text-xs text-danger">(<T>refunded</T> {m(refunded)})</span> : null}
                    </div>
                    {can(ctx.role, "refund.create") && p.amount.sub(refunded).gt(0) ? <RefundForm paymentId={p.id} max={p.amount.sub(refunded).toFixed(2)} /> : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-muted-foreground"><T>No payments yet</T></p>}
        </CardContent>
      </Card>

      {can(ctx.role, "payment.record") && remaining.gt(0) && inv.status !== "VOID" ? (
        <Card>
          <CardHeader><CardTitle><T>Record payment</T></CardTitle></CardHeader>
          <CardContent><PaymentForm invoiceId={inv.id} remaining={remaining.toFixed(2)} /></CardContent>
        </Card>
      ) : null}
    </div>
  );
}
