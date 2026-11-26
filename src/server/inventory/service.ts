import { Prisma, type StockMovementType } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { notify, staffWithPermission } from "@/server/notifications/service";

type Tx = Prisma.TransactionClient;

async function lockBatch(tx: Tx, batchId: string) {
  const rows = await tx.$queryRaw<{ id: string; quantity: number }[]>`SELECT id, quantity FROM "InventoryBatch" WHERE id = ${batchId} FOR UPDATE`;
  return rows[0];
}

async function move(tx: Tx, a: { clinicId: string; batchId: string; delta: number; type: StockMovementType; reason?: string | null; refId?: string; actorUserId?: string | null }) {
  const locked = await lockBatch(tx, a.batchId);
  if (!locked) throw notFound("Batch");
  const batch = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: a.batchId }, include: { item: true } });
  if (batch.item.clinicId !== a.clinicId) throw notFound("Batch");
  const after = locked.quantity + a.delta;
  if (after < 0) throw conflict("INSUFFICIENT_STOCK", `Insufficient stock: batch ${batch.batchNumber} has ${locked.quantity}`);
  await tx.inventoryBatch.update({ where: { id: batch.id }, data: { quantity: after } });
  return tx.stockMovement.create({ data: { clinicId: a.clinicId, itemId: batch.itemId, batchId: batch.id, branchId: batch.branchId, type: a.type, quantityDelta: a.delta, balanceAfter: after, reason: a.reason ?? null, refId: a.refId, actorUserId: a.actorUserId ?? null } });
}

export async function adjustStock(args: { clinicId: string; batchId: string; delta: number; reason: string; actorUserId?: string | null; branchId?: string | null }) {
  if (!Number.isInteger(args.delta) || args.delta === 0) throw badRequest("Adjustment must be a non-zero integer");
  if (!args.reason.trim()) throw badRequest("A reason is required for stock adjustments");
  return db.$transaction(async (tx) => {
    if (args.branchId) {
      const b = await tx.inventoryBatch.findUnique({ where: { id: args.batchId } });
      if (!b || b.branchId !== args.branchId) throw notFound("Batch");
    }
    const m = await move(tx, { clinicId: args.clinicId, batchId: args.batchId, delta: args.delta, type: args.delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", reason: args.reason, actorUserId: args.actorUserId });
    await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "inventory.adjust", entity: "InventoryBatch", entityId: args.batchId, metadata: { delta: args.delta, reason: args.reason } }, tx);
    return m;
  });
}

export async function receiveStock(args: { clinicId: string; itemId: string; branchId: string; batchNumber: string; expiresOn?: string | null; quantity: number; actorUserId?: string | null; refId?: string }, outer?: Tx) {
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) throw badRequest("Quantity must be a positive integer");
  const run = async (tx: Tx) => {
    const item = await tx.inventoryItem.findFirst({ where: { id: args.itemId, clinicId: args.clinicId } });
    const branch = await tx.branch.findFirst({ where: { id: args.branchId, clinicId: args.clinicId } });
    if (!item || !branch) throw notFound("Item or branch");
    const batch = await tx.inventoryBatch.upsert({
      where: { itemId_branchId_batchNumber: { itemId: item.id, branchId: branch.id, batchNumber: args.batchNumber } },
      create: { itemId: item.id, branchId: branch.id, batchNumber: args.batchNumber, expiresOn: args.expiresOn ? new Date(args.expiresOn + "T00:00:00.000Z") : null, quantity: 0 },
      update: {},
    });
    return move(tx, { clinicId: args.clinicId, batchId: batch.id, delta: args.quantity, type: "PURCHASE_RECEIPT", refId: args.refId, actorUserId: args.actorUserId, reason: "Goods received" });
  };
  return outer ? run(outer) : db.$transaction(run);
}

/** FEFO consumption: draws from earliest-expiring batches first; fails atomically if stock is insufficient. */
export async function consumeStock(args: { clinicId: string; itemId: string; branchId: string; quantity: number; reason?: string; actorUserId?: string | null; actorBranchId?: string | null }) {
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) throw badRequest("Quantity must be a positive integer");
  if (args.actorBranchId && args.actorBranchId !== args.branchId) throw forbidden("Outside your branch");
  return db.$transaction(async (tx) => {
    const batches = await tx.inventoryBatch.findMany({ where: { itemId: args.itemId, branchId: args.branchId, quantity: { gt: 0 }, item: { clinicId: args.clinicId } }, orderBy: [{ expiresOn: { sort: "asc", nulls: "last" } }] });
    let left = args.quantity;
    const out = [];
    for (const b of batches) {
      if (left <= 0) break;
      const take = Math.min(left, b.quantity);
      out.push(await move(tx, { clinicId: args.clinicId, batchId: b.id, delta: -take, type: "CONSUMPTION", reason: args.reason, actorUserId: args.actorUserId }));
      left -= take;
    }
    if (left > 0) throw conflict("INSUFFICIENT_STOCK", `Insufficient stock: short by ${left}`);
    return out;
  });
}

export async function transferStock(args: { clinicId: string; batchId: string; toBranchId: string; quantity: number; actorUserId?: string | null; actorBranchId?: string | null }) {
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) throw badRequest("Quantity must be a positive integer");
  return db.$transaction(async (tx) => {
    const src = await tx.inventoryBatch.findFirst({ where: { id: args.batchId, item: { clinicId: args.clinicId } } });
    if (!src) throw notFound("Batch");
    if (args.actorBranchId && src.branchId !== args.actorBranchId) throw forbidden("Outside your branch");
    if (src.branchId === args.toBranchId) throw badRequest("Source and destination branch are the same");
    const dest = await tx.branch.findFirst({ where: { id: args.toBranchId, clinicId: args.clinicId } });
    if (!dest) throw notFound("Destination branch");
    const target = await tx.inventoryBatch.upsert({
      where: { itemId_branchId_batchNumber: { itemId: src.itemId, branchId: dest.id, batchNumber: src.batchNumber } },
      create: { itemId: src.itemId, branchId: dest.id, batchNumber: src.batchNumber, expiresOn: src.expiresOn, quantity: 0 }, update: {},
    });
    // Lock both batches in deterministic id order so opposite-direction transfers cannot deadlock.
    await tx.$queryRaw`SELECT id FROM "InventoryBatch" WHERE id IN (${src.id}, ${target.id}) ORDER BY id FOR UPDATE`;
    await move(tx, { clinicId: args.clinicId, batchId: src.id, delta: -args.quantity, type: "TRANSFER_OUT", reason: `Transfer to ${dest.name}`, actorUserId: args.actorUserId });
    await move(tx, { clinicId: args.clinicId, batchId: target.id, delta: args.quantity, type: "TRANSFER_IN", reason: "Transfer in", actorUserId: args.actorUserId });
    await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "inventory.transfer", entity: "InventoryBatch", entityId: src.id, metadata: { qty: args.quantity, to: dest.id } }, tx);
    return { from: src.id, to: target.id };
  });
}

export async function receivePurchaseOrder(args: { clinicId: string; orderId: string; actorUserId?: string | null }) {
  return db.$transaction(async (tx) => {
    // Atomically claim the receipt: only one concurrent caller can flip ORDERED -> RECEIVED.
    const claimed = await tx.$executeRaw`UPDATE "PurchaseOrder" SET status = 'RECEIVED', "receivedAt" = now() WHERE id = ${args.orderId} AND "clinicId" = ${args.clinicId} AND status = 'ORDERED'`;
    if (claimed === 0) {
      const po = await tx.purchaseOrder.findFirst({ where: { id: args.orderId, clinicId: args.clinicId } });
      if (!po) throw notFound("Purchase order");
      if (po.status === "RECEIVED") throw conflict("PO_ALREADY_RECEIVED", "Purchase order already received");
      throw conflict("PO_CANCELLED", "Purchase order was cancelled");
    }
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: args.orderId }, include: { lines: true } });
    for (const l of po.lines) {
      await receiveStock({ clinicId: args.clinicId, itemId: l.itemId, branchId: po.branchId, batchNumber: l.batchNumber ?? `PO-${po.number}`, expiresOn: l.expiresOn?.toISOString().slice(0, 10) ?? null, quantity: l.quantity, actorUserId: args.actorUserId, refId: po.id }, tx);
    }
    await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "purchase_order.receive", entity: "PurchaseOrder", entityId: po.id }, tx);
    return po.id;
  });
}

export async function stockSummary(clinicId: string, branchId?: string | null) {
  const rows = await db.$queryRaw<{ itemId: string; name: string; sku: string; branchId: string; branchName: string; qty: bigint; minStock: number }[]>`
    SELECT i.id AS "itemId", i.name, i.sku, b.id AS "branchId", b.name AS "branchName", COALESCE(SUM(ib.quantity),0) AS qty, i."minStock"
    FROM "InventoryItem" i CROSS JOIN "Branch" b
    LEFT JOIN "InventoryBatch" ib ON ib."itemId" = i.id AND ib."branchId" = b.id
    WHERE i."clinicId" = ${clinicId} AND b."clinicId" = ${clinicId} AND i.active
      ${branchId ? Prisma.sql`AND b.id = ${branchId}` : Prisma.empty}
    GROUP BY i.id, b.id ORDER BY i.name, b.name`;
  return rows.map((r) => ({ ...r, qty: Number(r.qty), low: Number(r.qty) < r.minStock }));
}

export async function expiringBatches(clinicId: string, withinDays = 60, branchId?: string | null) {
  const limit = new Date(Date.now() + withinDays * 86400000);
  return db.inventoryBatch.findMany({
    where: { quantity: { gt: 0 }, expiresOn: { lte: limit }, item: { clinicId }, ...(branchId ? { branchId } : {}) },
    include: { item: { select: { name: true, sku: true } }, branch: { select: { name: true } } }, orderBy: { expiresOn: "asc" },
  });
}

/** Generates (deduped) low-stock and expiring-stock notifications. */
export async function runInventoryAlerts(clinicId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const staff = await staffWithPermission(clinicId, ["CLINIC_OWNER", "BRANCH_MANAGER"]);
  let n = 0;
  for (const s of (await stockSummary(clinicId)).filter((x) => x.low)) {
    n += await notify({ clinicId, userIds: staff, type: "INVENTORY_LOW", title: "Low stock", body: `${s.name} at ${s.branchName}: ${s.qty} left (min ${s.minStock})`, link: "/admin/inventory", dedupeKey: `low:${s.itemId}:${s.branchId}:${day}` });
  }
  for (const b of await expiringBatches(clinicId, 30)) {
    n += await notify({ clinicId, userIds: staff, type: "INVENTORY_EXPIRING", title: "Stock expiring", body: `${b.item.name} batch ${b.batchNumber} at ${b.branch.name} expires ${b.expiresOn?.toISOString().slice(0, 10)}`, link: "/admin/inventory", dedupeKey: `exp:${b.id}:${day}` });
  }
  return n;
}
