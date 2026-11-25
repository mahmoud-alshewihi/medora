import { PageTitle } from "@/components/shell/page-title";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageAccess } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";
export default async function BillingPage() {
  const ctx = await pageAccess("billing.read");
  const rows = await db.invoice.findMany({ where: { clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { patient: { select: { fullName: true } } }, orderBy: { issuedAt: "desc" }, take: 100 });
  return (
    <div className="space-y-4"><PageTitle>Invoices</PageTitle>
      <DataTable head={["Number", "Patient", "Total", "Paid", "Status"]} rows={rows.map((i) => [<Link key={i.id + "l"} className="text-primary underline" href={`/admin/billing/${i.id}`}>{i.number}</Link>, i.patient.fullName, formatMoney(i.total.toString(), i.currency), formatMoney(i.paidAmount.toString(), i.currency), <Badge key={i.id} value={i.status} />])} />
    </div>
  );
}
