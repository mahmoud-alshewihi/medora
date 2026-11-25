import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { adjustStock, consumeStock, receivePurchaseOrder, receiveStock, stockSummary, transferStock, runInventoryAlerts } from "@/server/inventory/service";
import { futureDate, makeClinic, type World } from "./helpers";

let w: World; let itemId: string;
beforeAll(async () => {
  w = await makeClinic("Inv");
  const cat = await db.inventoryCategory.create({ data: { clinicId: w.clinic.id, name: "Cons" } });
  const item = await db.inventoryItem.create({ data: { clinicId: w.clinic.id, categoryId: cat.id, sku: "G-1", name: "Gloves", minStock: 50 } });
  itemId = item.id;
});
const recv = (qty: number, batch: string, exp: string | null = futureDate(200), branchId = w.b1.id) => receiveStock({ clinicId: w.clinic.id, itemId, branchId, batchNumber: batch, expiresOn: exp, quantity: qty });

describe("stock ledger", () => {
  it("records receipts with running balance", async () => {
    const m = await recv(40, "B1");
    expect(m.balanceAfter).toBe(40);
    const m2 = await recv(10, "B1");
    expect(m2.balanceAfter).toBe(50);
  });
  it("prevents negative stock on adjustments and requires a reason", async () => {
    const b = await db.inventoryBatch.findFirstOrThrow({ where: { itemId, batchNumber: "B1" } });
    await expect(adjustStock({ clinicId: w.clinic.id, batchId: b.id, delta: -51, reason: "loss" })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(adjustStock({ clinicId: w.clinic.id, batchId: b.id, delta: -1, reason: " " })).rejects.toMatchObject({ status: 400 });
    const ok = await adjustStock({ clinicId: w.clinic.id, batchId: b.id, delta: -5, reason: "Damaged" });
    expect(ok.balanceAfter).toBe(45);
    expect((await db.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } })).quantity).toBe(45);
  });
  it("concurrent consumption can never drive stock below zero", async () => {
    const w2 = await makeClinic("InvR");
    const cat = await db.inventoryCategory.create({ data: { clinicId: w2.clinic.id, name: "C" } });
    const it2 = await db.inventoryItem.create({ data: { clinicId: w2.clinic.id, categoryId: cat.id, sku: "R-1", name: "Syringe" } });
    await receiveStock({ clinicId: w2.clinic.id, itemId: it2.id, branchId: w2.b1.id, batchNumber: "R", quantity: 10 });
    const res = await Promise.allSettled(Array.from({ length: 6 }, () => consumeStock({ clinicId: w2.clinic.id, itemId: it2.id, branchId: w2.b1.id, quantity: 3 })));
    const ok = res.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(3);
    const b = await db.inventoryBatch.findFirstOrThrow({ where: { itemId: it2.id } });
    expect(b.quantity).toBe(1);
  });
  it("FEFO consumption draws earliest expiry first", async () => {
    await recv(20, "LATE", futureDate(400));
    await recv(20, "SOON", futureDate(40));
    await consumeStock({ clinicId: w.clinic.id, itemId, branchId: w.b1.id, quantity: 10 });
    const soon = await db.inventoryBatch.findFirstOrThrow({ where: { itemId, batchNumber: "SOON" } });
    const late = await db.inventoryBatch.findFirstOrThrow({ where: { itemId, batchNumber: "LATE" } });
    expect(soon.quantity).toBe(10);
    expect(late.quantity).toBe(20);
  });
  it("transfers stock between branches atomically with two ledger rows", async () => {
    const src = await db.inventoryBatch.findFirstOrThrow({ where: { itemId, batchNumber: "LATE" } });
    await transferStock({ clinicId: w.clinic.id, batchId: src.id, toBranchId: w.b2.id, quantity: 8 });
    const dst = await db.inventoryBatch.findFirstOrThrow({ where: { itemId, branchId: w.b2.id, batchNumber: "LATE" } });
    expect(dst.quantity).toBe(8);
    expect((await db.inventoryBatch.findUniqueOrThrow({ where: { id: src.id } })).quantity).toBe(12);
    await expect(transferStock({ clinicId: w.clinic.id, batchId: src.id, toBranchId: w.b2.id, quantity: 500 })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect((await db.inventoryBatch.findUniqueOrThrow({ where: { id: src.id } })).quantity).toBe(12);
  });
  it("cannot touch another clinic's batch", async () => {
    const other = await makeClinic("InvX");
    const b = await db.inventoryBatch.findFirstOrThrow({ where: { itemId } });
    await expect(adjustStock({ clinicId: other.clinic.id, batchId: b.id, delta: 1, reason: "x" })).rejects.toMatchObject({ status: 404 });
  });
  it("purchase order receipt adds stock once", async () => {
    const sup = await db.supplier.create({ data: { clinicId: w.clinic.id, name: "Sup" } });
    const po = await db.purchaseOrder.create({ data: { clinicId: w.clinic.id, supplierId: sup.id, branchId: w.b1.id, number: "PO-1", status: "ORDERED", lines: { create: [{ itemId, quantity: 25, unitCost: "3", batchNumber: "POB" }] } } });
    await receivePurchaseOrder({ clinicId: w.clinic.id, orderId: po.id });
    expect((await db.inventoryBatch.findFirstOrThrow({ where: { itemId, batchNumber: "POB" } })).quantity).toBe(25);
    await expect(receivePurchaseOrder({ clinicId: w.clinic.id, orderId: po.id })).rejects.toMatchObject({ code: "PO_ALREADY_RECEIVED" });
  });
  it("flags low stock and generates deduped alerts", async () => {
    const s = await stockSummary(w.clinic.id, w.b2.id);
    expect(s.find((x) => x.itemId === itemId)?.low).toBe(true);
    const first = await runInventoryAlerts(w.clinic.id);
    const second = await runInventoryAlerts(w.clinic.id);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });
});
