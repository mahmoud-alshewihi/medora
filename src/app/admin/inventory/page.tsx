import { Badge } from "@/components/ui/primitives";
import { pageAccess } from "@/server/auth/page-guard";
import { expiringBatches, stockSummary } from "@/server/inventory/service";
import { DataTable } from "@/components/shell/data-table";

export const dynamic = "force-dynamic";
export default async function InventoryPage() {
  const ctx = await pageAccess("inventory.read");
  const [stock, exp] = await Promise.all([stockSummary(ctx.clinicId, ctx.branchId), expiringBatches(ctx.clinicId, 60, ctx.branchId)]);
  const low = stock.filter((s) => s.low).length;
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Inventory</h1>
      <p className="text-sm text-muted-foreground">{stock.length} item/branch rows, {low} below minimum stock, {exp.length} batches expiring within 60 days. Stock changes are available through /api/inventory (forms not built yet).</p>
      <DataTable head={["Item", "SKU", "Branch", "Quantity", "Minimum", "Level"]} rows={stock.slice(0, 200).map((s) => [s.name, s.sku, s.branchName, s.qty, s.minStock, <Badge key={s.itemId + s.branchId} value={s.low ? "LOW" : "OK"} />])} />
    </div>
  );
}
