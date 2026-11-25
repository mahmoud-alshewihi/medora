import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { DataTable } from "@/components/shell/data-table";
import { ExpenseForm } from "@/components/shell/expense-form";
import { pageAccess } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";
export default async function ExpensesPage() {
  const ctx = await pageAccess("expense.manage");
  const [rows, categories, branches, clinic] = await Promise.all([
    db.expense.findMany({ where: { clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, orderBy: { incurredOn: "desc" }, take: 100, include: { category: true } }),
    db.expenseCategory.findMany({ where: { clinicId: ctx.clinicId }, orderBy: { name: "asc" } }),
    db.branch.findMany({ where: { clinicId: ctx.clinicId } }), db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } }),
  ]);
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Expenses</h1>
      <ExpenseForm categories={categories} branches={branches} lockBranch={!!ctx.branchId} />
      <DataTable head={["Date", "Category", "Description", "Amount"]} rows={rows.map((e) => [e.incurredOn.toISOString().slice(0, 10), e.category.name, e.description, formatMoney(e.amount.toString(), clinic.currency)])} />
    </div>
  );
}
