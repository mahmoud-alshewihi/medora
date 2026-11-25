import { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { secured } from "@/server/http/handler";

export const GET = secured("inventory.read", {}, async ({ ctx }) => db.purchaseOrder.findMany({ where: { clinicId: ctx.clinicId }, include: { supplier: true, lines: { include: { item: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 }));
export const POST = secured("inventory.manage", { body: z.object({ supplierId: z.string(), branchId: z.string(), lines: z.array(z.object({ itemId: z.string(), quantity: z.number().int().min(1), unitCost: z.union([z.string(), z.number()]), batchNumber: z.string().max(40).optional(), expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })).min(1) }) }, async ({ ctx, body }) => {
  const [s, b, items] = await Promise.all([db.supplier.findFirst({ where: { id: body.supplierId, clinicId: ctx.clinicId } }), db.branch.findFirst({ where: { id: body.branchId, clinicId: ctx.clinicId } }), db.inventoryItem.count({ where: { clinicId: ctx.clinicId, id: { in: body.lines.map((l) => l.itemId) } } })]);
  if (!s || !b || items !== new Set(body.lines.map((l) => l.itemId)).size) throw notFound("Supplier, branch or item");
  const n = await db.purchaseOrder.count({ where: { clinicId: ctx.clinicId } });
  return db.purchaseOrder.create({ data: { clinicId: ctx.clinicId, supplierId: s.id, branchId: b.id, number: `PO-${String(n + 1).padStart(5, "0")}-${Date.now().toString(36).toUpperCase()}`, status: "ORDERED", lines: { create: body.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitCost: String(l.unitCost), batchNumber: l.batchNumber, expiresOn: l.expiresOn ? new Date(l.expiresOn + "T00:00:00Z") : null })) } } });
});
