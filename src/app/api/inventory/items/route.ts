import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/server/audit/audit";
import { stockSummary } from "@/server/inventory/service";
import { secured } from "@/server/http/handler";

export const GET = secured("inventory.read", {}, async ({ ctx }) => ({ summary: await stockSummary(ctx.clinicId, ctx.branchId), categories: await db.inventoryCategory.findMany({ where: { clinicId: ctx.clinicId } }),
  batches: await db.inventoryBatch.findMany({ where: { item: { clinicId: ctx.clinicId }, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { item: { select: { name: true, sku: true } }, branch: { select: { name: true } } }, orderBy: [{ expiresOn: "asc" }], take: 500 }) }));
export const POST = secured("inventory.manage", { body: z.object({ categoryId: z.string(), sku: z.string().min(1).max(40), name: z.string().min(2).max(120), unit: z.string().max(20).default("unit"), minStock: z.number().int().min(0) }) }, async ({ ctx, body }) => {
  const cat = await db.inventoryCategory.findFirst({ where: { id: body.categoryId, clinicId: ctx.clinicId } });
  if (!cat) throw (await import("@/lib/errors")).notFound("Category");
  const it = await db.inventoryItem.create({ data: { ...body, clinicId: ctx.clinicId } });
  await audit({ clinicId: ctx.clinicId, userId: ctx.userId, action: "inventory.item.create", entity: "InventoryItem", entityId: it.id });
  return it;
});
