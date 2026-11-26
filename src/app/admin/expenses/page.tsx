import { PageTitle } from "@/components/shell/page-title";
import { Receipt, Tags, TrendingDown } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { ExpenseForm } from "@/components/shell/expense-form";
import { pageAccess } from "@/server/auth/page-guard";
import { todayIn } from "@/lib/tz";
import { clinicTz } from "@/lib/clinic-time";
import { getLocale } from "@/lib/i18n/server";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
export default async function ExpensesPage() {
  const ctx = await pageAccess("expense.manage");
  const tz = await clinicTz(ctx.clinicId);
  const monthStart = todayIn(tz).slice(0, 8) + "01";
  const loc = await getLocale();
  const dateFmt = new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const scope = { clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) };
  const [rows, categories, branches, clinic, monthAgg] = await Promise.all([
    db.expense.findMany({ where: scope, orderBy: { incurredOn: "desc" }, take: 100, include: { category: true } }),
    db.expenseCategory.findMany({ where: { clinicId: ctx.clinicId }, orderBy: { name: "asc" } }),
    db.branch.findMany({ where: { clinicId: ctx.clinicId } }), db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } }),
    db.expense.aggregate({ where: { ...scope, incurredOn: { gte: new Date(monthStart + "T00:00:00.000Z") } }, _sum: { amount: true }, _count: true }),
  ]);
  const m = (v: { toString(): string } | string) => formatMoney(v.toString(), clinic.currency);
  return (
    <div className="space-y-4">
      <PageTitle>Expenses</PageTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><TrendingDown className="h-3.5 w-3.5" /><T>This month</T></p><p className="tnum mt-1 text-xl font-bold">{m(monthAgg._sum.amount?.toString() ?? "0")}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Receipt className="h-3.5 w-3.5" /><T>Entries this month</T></p><p className="tnum mt-1 text-xl font-bold">{monthAgg._count}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Tags className="h-3.5 w-3.5" /><T>Categories</T></p><p className="tnum mt-1 text-xl font-bold">{categories.length}</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle><T>Add expense</T></CardTitle></CardHeader>
        <CardContent><ExpenseForm categories={categories} branches={branches} lockBranch={!!ctx.branchId} /></CardContent>
      </Card>
      <DataTable
        head={["Date", "Category", "Description", "Branch", "Amount"]}
        empty="No expenses recorded"
        rows={rows.map((e) => [
          <span key="d" className="tnum text-muted-foreground">{dateFmt.format(e.incurredOn)}</span>,
          <span key="c" className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{e.category.name}</span>,
          e.description,
          <span key="b" className="text-muted-foreground">{branches.find((b) => b.id === e.branchId)?.name ?? "—"}</span>,
          <span key="a" className="tnum font-medium">{m(e.amount)}</span>,
        ])}
      />
    </div>
  );
}
