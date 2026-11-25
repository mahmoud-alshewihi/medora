import { pageAccess } from "@/server/auth/page-guard";
import { expiringBatches, stockSummary } from "@/server/inventory/service";
import { DataTable } from "@/components/shell/data-table";

export const dynamic = "force-dynamic";
export default async function InventoryPage() {
  const ctx = await pageAccess("inventory.read");
  const [stock, exp] = await Promise.all([stockSummary(ctx.clinicId, ctx.branchId), expiringBatches(ctx.clinicId, 60, ctx.branchId)]);
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Inventory</h1>
      <DataTable head={["Item", "Data"]} rows={stock.slice(0, 100).map((s, i) => [String((s as { name?: string }).name ?? i), <code key={i} className="text-xs">{JSON.stringify(s)}</code>])} />
      <h2 className="font-medium">Expiring within 60 days: {exp.length}</h2>
    </div>
  );
}
