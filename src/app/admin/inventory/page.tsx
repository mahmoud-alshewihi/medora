import { PageTitle } from "@/components/shell/page-title";
import { AlertTriangle, Boxes, PackageCheck, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { StockForms } from "@/components/shell/stock-forms";
import { PurchaseOrderForm, ReceivePoButton } from "@/components/shell/finance-ui";
import { getLocale } from "@/lib/i18n/server";
import { can } from "@/server/auth/permissions";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { pageAccess } from "@/server/auth/page-guard";
import { expiringBatches, stockSummary } from "@/server/inventory/service";
import { DataTable } from "@/components/shell/data-table";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
export default async function InventoryPage() {
  const ctx = await pageAccess("inventory.read");
  const [stock, exp] = await Promise.all([stockSummary(ctx.clinicId, ctx.branchId), expiringBatches(ctx.clinicId, 60, ctx.branchId)]);
  const [itemsList, branchesList] = await Promise.all([db.inventoryItem.findMany({ where: { clinicId: ctx.clinicId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }), db.branch.findMany({ where: { clinicId: ctx.clinicId, ...(ctx.branchId ? { id: ctx.branchId } : {}) }, select: { id: true, name: true } })]);
  const [suppliers, pos] = await Promise.all([db.supplier.findMany({ where: { clinicId: ctx.clinicId }, select: { id: true, name: true }, orderBy: { name: "asc" } }), db.purchaseOrder.findMany({ where: { clinicId: ctx.clinicId }, include: { supplier: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 })]);
  await getLocale();
  const low = stock.filter((s) => s.low).length;
  const manage = can(ctx.role, "inventory.manage");
  return (
    <div className="space-y-4">
      <PageTitle>Inventory</PageTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Boxes className="h-3.5 w-3.5" /><T>Stock rows</T></p><p className="tnum mt-1 text-xl font-bold">{stock.length}</p></div>
        <div className={`rounded-lg border px-4 py-3 shadow-xs ${low ? "border-warn/40 bg-warn-soft/40" : "bg-card"}`}><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /><T>Below minimum</T></p><p className="tnum mt-1 text-xl font-bold">{low}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><PackageCheck className="h-3.5 w-3.5" /><T>Expiring in 60d</T></p><p className="tnum mt-1 text-xl font-bold">{exp.length}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Truck className="h-3.5 w-3.5" /><T>Suppliers</T></p><p className="tnum mt-1 text-xl font-bold">{suppliers.length}</p></div>
      </div>

      {manage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle><T>Stock movements</T></CardTitle></CardHeader><CardContent><StockForms items={itemsList} branches={branchesList} lockBranch={!!ctx.branchId} /></CardContent></Card>
          <Card><CardContent className="pt-5"><PurchaseOrderForm suppliers={suppliers} branches={branchesList} items={itemsList} /></CardContent></Card>
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle><T>Stock levels</T></CardTitle></CardHeader>
        <CardContent>
          <DataTable
            head={["Item", "SKU", "Branch", "Quantity", "Minimum", "Level"]}
            empty="No stock yet"
            rows={stock.slice(0, 200).map((s) => [
              <span key="n" className="font-medium">{s.name}</span>,
              <span key="s" className="tnum text-muted-foreground">{s.sku}</span>,
              s.branchName,
              <span key="q" className={`tnum font-semibold ${s.low ? "text-warn" : ""}`}>{s.qty}</span>,
              <span key="m" className="tnum text-muted-foreground">{s.minStock}</span>,
              <Badge key={s.itemId + s.branchId} value={s.low ? "LOW" : "OK"} />,
            ])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle><T>Purchase orders</T></CardTitle></CardHeader>
        <CardContent>
          <DataTable
            head={["Number", "Supplier", "Status", ""]}
            empty="No purchase orders"
            rows={pos.map((o) => [
              <span key="n" className="tnum font-medium">{o.number}</span>, o.supplier.name, <Badge key={o.id} value={o.status} />,
              o.status === "ORDERED" && manage ? <ReceivePoButton key={o.id + "r"} id={o.id} /> : "",
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
