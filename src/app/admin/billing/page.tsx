import { PageTitle } from "@/components/shell/page-title";
import Link from "next/link";
import { FileText, MoreHorizontal, Receipt, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, Button, Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { CashCloseForm } from "@/components/shell/finance-ui";
import { can } from "@/server/auth/permissions";
import { pageAccess } from "@/server/auth/page-guard";
import { clinicTz } from "@/lib/clinic-time";
import { dayRangeUtc, todayIn } from "@/lib/tz";
import { getLocale } from "@/lib/i18n/server";
import { T } from "@/components/t";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const STATUSES = ["", "ISSUED", "PARTIALLY_PAID", "PAID", "REFUNDED", "VOID"] as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("billing.read"); const sp = await searchParams;
  const loc = await getLocale();
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") && sp.status ? sp.status : undefined;
  const scope = { clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) };
  const tz = await clinicTz(ctx.clinicId);
  const { start, end } = dayRangeUtc(todayIn(tz), tz);
  const [rows, outstandingAgg, todayAgg, count] = await Promise.all([
    db.invoice.findMany({ where: { ...scope, ...(status ? { status: status as never } : {}) }, include: { patient: { select: { fullName: true } } }, orderBy: { issuedAt: "desc" }, take: 100 }),
    db.invoice.aggregate({ where: { ...scope, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, _sum: { total: true, paidAmount: true, refundedAmount: true } }),
    db.payment.aggregate({ where: { ...scope, paidAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.invoice.count({ where: scope }),
  ]);
  const outstanding = (outstandingAgg._sum.total?.toNumber() ?? 0) - (outstandingAgg._sum.paidAmount?.toNumber() ?? 0) + (outstandingAgg._sum.refundedAmount?.toNumber() ?? 0);
  const currency = rows[0]?.currency ?? "EGP";
  const fm = (v: number | string) => formatMoney(String(v), currency);
  const dateFmt = new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const branches = can(ctx.role, "cash.close") ? await db.branch.findMany({ where: { clinicId: ctx.clinicId, ...(ctx.branchId ? { id: ctx.branchId } : {}) }, select: { id: true, name: true } }) : [];
  return (
    <div className="space-y-4">
      <PageTitle>Invoices</PageTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Wallet className="h-3.5 w-3.5" /><T>Collected today</T></p><p className="tnum mt-1 text-xl font-bold">{fm(todayAgg._sum?.amount?.toString() ?? "0")}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Receipt className="h-3.5 w-3.5" /><T>Outstanding</T></p><p className="tnum mt-1 text-xl font-bold">{fm(outstanding.toFixed(2))}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><FileText className="h-3.5 w-3.5" /><T>Total invoices</T></p><p className="tnum mt-1 text-xl font-bold">{count}</p></div>
      </div>
      {branches.length > 0 && <CashCloseForm branches={branches} />}
      {/* status filter pills */}
      <div className="no-print flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Link key={s || "all"} href={s ? `?status=${s}` : "?"} aria-current={(status ?? "") === s ? "true" : undefined}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", (status ?? "") === s ? "border-primary bg-primary-soft text-primary" : "bg-card text-muted-foreground hover:text-foreground")}>
            {s ? <T>{s.replace(/_/g, " ")}</T> : <T>All</T>}
          </Link>
        ))}
      </div>
      <DataTable
        head={["Number", "Patient", "Issued", "Total", "Paid", "Remaining", "Status", ""]}
        empty="No invoices found"
        rows={rows.map((i) => {
          const remaining = i.total.sub(i.paidAmount).add(i.refundedAmount);
          return [
            <Link key="n" href={`/admin/billing/${i.id}`} className="tnum font-semibold text-primary transition-colors hover:text-primary-strong">{i.number}</Link>,
            i.patient.fullName,
            <span key="d" className="tnum text-muted-foreground">{dateFmt.format(i.issuedAt)}</span>,
            <span key="t" className="tnum font-medium">{formatMoney(i.total.toString(), i.currency)}</span>,
            <span key="p" className="tnum text-success">{formatMoney(i.paidAmount.toString(), i.currency)}</span>,
            <span key="r" className={cn("tnum", remaining.gt(0) ? "font-semibold text-warn" : "text-muted-foreground")}>{formatMoney(remaining.toString(), i.currency)}</span>,
            <Badge key={i.id} value={i.status} />,
            <Menu key="a">
              <MenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions"><MoreHorizontal className="h-4 w-4" /></Button></MenuTrigger>
              <MenuContent>
                <MenuItem asChild><Link href={`/admin/billing/${i.id}`} className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><T>Open invoice</T></Link></MenuItem>
              </MenuContent>
            </Menu>,
          ];
        })}
      />
    </div>
  );
}
