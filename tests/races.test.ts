/* Phase 3 concurrency regression tests. Each test asserts the CORRECT behavior;
   pre-fix runs demonstrate the bug (test fails), post-fix runs must pass. */
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { receivePurchaseOrder, receiveStock, transferStock } from "@/server/inventory/service";
import { recordPayment, closeCashRegister, createInvoice, refundPayment } from "@/server/billing/service";
import { registerPatient } from "@/server/patients/service";
import { bookAppointment, changeStatus } from "@/server/appointments/service";
import { at, futureDate, makeClinic } from "./helpers";

describe("concurrency: purchase order receive", () => {
  it("5 concurrent receives add stock exactly once", async () => {
    const w = await makeClinic("RacePO");
    const cat = await db.inventoryCategory.create({ data: { clinicId: w.clinic.id, name: "C" } });
    const item = await db.inventoryItem.create({ data: { clinicId: w.clinic.id, categoryId: cat.id, sku: "R-PO", name: "Bandage" } });
    const sup = await db.supplier.create({ data: { clinicId: w.clinic.id, name: "S" } });
    const po = await db.purchaseOrder.create({ data: { clinicId: w.clinic.id, supplierId: sup.id, branchId: w.b1.id, number: "PO-RACE", status: "ORDERED", lines: { create: [{ itemId: item.id, quantity: 25, unitCost: "1", batchNumber: "RB" }] } } });
    const res = await Promise.allSettled(Array.from({ length: 5 }, () => receivePurchaseOrder({ clinicId: w.clinic.id, orderId: po.id })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const batch = await db.inventoryBatch.findFirstOrThrow({ where: { itemId: item.id, batchNumber: "RB" } });
    expect(batch.quantity).toBe(25);
  });
});

describe("concurrency: payment idempotency", () => {
  it("10 concurrent payments with one idempotency key: one created, nine clean duplicates, no 500", async () => {
    const w = await makeClinic("RacePay");
    const inv = await createInvoice({ clinicId: w.clinic.id, branchId: w.b1.id, patientId: w.patient.id, items: [{ description: "x", quantity: 1, unitPrice: "1000" }] });
    const res = await Promise.allSettled(Array.from({ length: 10 }, () =>
      recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "100", method: "CARD", idempotencyKey: "race-key-0001" })));
    const rejected = res.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected.map((r) => String(r.reason))).toEqual([]); // no P2002 / 500 leaks
    const payments = await db.payment.findMany({ where: { invoiceId: inv.id } });
    expect(payments).toHaveLength(1);
    const after = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.paidAmount.toFixed(2)).toBe("100.00");
  });
});

describe("concurrency: cash close vs payment", () => {
  it("a payment racing the close is either counted in expected cash or rejected - never silently lost", async () => {
    const w = await makeClinic("RaceCash");
    let inconsistent = 0;
    for (let round = 0; round < 15; round++) {
      const inv = await createInvoice({ clinicId: w.clinic.id, branchId: w.b1.id, patientId: w.patient.id, items: [{ description: "x", quantity: 1, unitPrice: "50" }] });
      const [closeRes, payRes] = await Promise.allSettled([
        closeCashRegister({ clinicId: w.clinic.id, branchId: w.b1.id, countedCash: "0" }),
        recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "50", method: "CASH", idempotencyKey: `race-cash-${round}` }),
      ]);
      const reg = await db.cashRegister.findFirstOrThrow({ where: { branchId: w.b1.id }, include: { payments: true } });
      if (payRes.status === "fulfilled") {
        // Payment recorded: it must either be inside a still-open register, or counted in the closed one.
        const counted = reg.closedAt === null || reg.payments.some((p) => p.idempotencyKey === `race-cash-${round}`) &&
          reg.expectedCash!.gte((reg.payments.find((p) => p.idempotencyKey === `race-cash-${round}`)?.amount ?? 0));
        if (!counted) inconsistent++;
        // Reopen for the next round.
        await db.cashRegister.update({ where: { id: reg.id }, data: { closedAt: null } });
      } else {
        // Rejected payment must be because the register was closed.
        expect(((payRes as PromiseRejectedResult).reason as { code?: string }).code).toBe("REGISTER_CLOSED");
        await db.cashRegister.update({ where: { id: reg.id }, data: { closedAt: null } });
      }
      void closeRes;
    }
    expect(inconsistent).toBe(0);
  });
});

describe("concurrency: plan limits", () => {
  it("20 concurrent registrations against a limit of 5 free slots create exactly 5", async () => {
    const w = await makeClinic("RaceLim", { planMaxPatients: 7 }); // 2 seeded patients + 5 free
    const res = await Promise.allSettled(Array.from({ length: 20 }, (_, i) =>
      registerPatient(w.clinic.id, { fullName: `Concurrent ${i}` })));
    const ok = res.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(5);
    expect(await db.patient.count({ where: { clinicId: w.clinic.id } })).toBe(7);
  });
});

describe("concurrency: 50 simultaneous bookings for one slot", () => {
  it("exactly one booking wins the slot, 49 get a clean conflict", async () => {
    const w = await makeClinic("RaceBook50");
    const startsAt = at(futureDate(9), "10:00");
    const res = await Promise.allSettled(Array.from({ length: 50 }, () =>
      bookAppointment({ clinicId: w.clinic.id, branchId: w.b1.id, doctorId: w.doctor.id, patientId: w.patient.id, startsAt, source: "RECEPTION" })));
    const ok = res.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    for (const r of res.filter((x) => x.status === "rejected") as PromiseRejectedResult[]) {
      expect(["SLOT_UNAVAILABLE", "SLOT_TAKEN"]).toContain((r.reason as { code?: string }).code);
    }
    const count = await db.appointment.count({ where: { doctorId: w.doctor.id, startsAt, status: { in: ["PENDING", "CONFIRMED"] } } });
    expect(count).toBe(1);
  }, 30000);
});

describe("concurrency: same doctor, same time, different branches", () => {
  it("cross-branch double-booking is impossible", async () => {
    const w = await makeClinic("RaceXBranch");
    const startsAt = at(futureDate(10), "11:00");
    const res = await Promise.allSettled([w.b1, w.b2].map((b) =>
      bookAppointment({ clinicId: w.clinic.id, branchId: b.id, doctorId: w.doctor.id, patientId: w.patient.id, startsAt, source: "RECEPTION" })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const count = await db.appointment.count({ where: { doctorId: w.doctor.id, startsAt, status: { in: ["PENDING", "CONFIRMED"] } } });
    expect(count).toBe(1);
  });
});

describe("concurrency: duplicate invoice for one appointment", () => {
  it("5 concurrent creates: one invoice, four clean INVOICE_EXISTS conflicts, no unmapped DB errors", async () => {
    const w = await makeClinic("RaceInv");
    const appt = await bookAppointment({ clinicId: w.clinic.id, branchId: w.b1.id, doctorId: w.doctor.id, patientId: w.patient.id, startsAt: at(futureDate(11), "09:30"), source: "RECEPTION" });
    const res = await Promise.allSettled(Array.from({ length: 5 }, () =>
      createInvoice({ clinicId: w.clinic.id, branchId: w.b1.id, patientId: w.patient.id, appointmentId: appt.id, items: [{ description: "x", quantity: 1, unitPrice: "100" }] })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of res.filter((x) => x.status === "rejected") as PromiseRejectedResult[]) {
      expect((r.reason as { code?: string }).code).toBe("INVOICE_EXISTS"); // no raw P2002 leaks
    }
    expect(await db.invoice.count({ where: { appointmentId: appt.id } })).toBe(1);
  });
});

describe("concurrency: concurrent refunds on one payment", () => {
  it("refunds never exceed the refundable amount", async () => {
    const w = await makeClinic("RaceRef");
    const inv = await createInvoice({ clinicId: w.clinic.id, branchId: w.b1.id, patientId: w.patient.id, items: [{ description: "x", quantity: 1, unitPrice: "100" }] });
    await recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "100", method: "CARD", idempotencyKey: "ref-race-pay" });
    const pay = await db.payment.findFirstOrThrow({ where: { invoiceId: inv.id } });
    const res = await Promise.allSettled(Array.from({ length: 3 }, (_, i) =>
      refundPayment({ clinicId: w.clinic.id, paymentId: pay.id, amount: "60", reason: `race ${i}`, idempotencyKey: `ref-race-${i}` })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of res.filter((x) => x.status === "rejected") as PromiseRejectedResult[]) {
      expect((r.reason as { code?: string }).code).toBe("REFUND_EXCEEDS_PAYMENT");
    }
    const after = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.refundedAmount.toFixed(2)).toBe("60.00");
  });
});

describe("concurrency: concurrent transfers of one batch", () => {
  it("batch of 10, three concurrent transfers of 10: exactly one succeeds, quantities stay consistent", async () => {
    const w = await makeClinic("RaceTr");
    const cat = await db.inventoryCategory.create({ data: { clinicId: w.clinic.id, name: "C" } });
    const item = await db.inventoryItem.create({ data: { clinicId: w.clinic.id, categoryId: cat.id, sku: "R-TR", name: "Gauze" } });
    await receiveStock({ clinicId: w.clinic.id, itemId: item.id, branchId: w.b1.id, batchNumber: "TB", quantity: 10 });
    const batch = await db.inventoryBatch.findFirstOrThrow({ where: { itemId: item.id, branchId: w.b1.id } });
    const res = await Promise.allSettled(Array.from({ length: 3 }, () =>
      transferStock({ clinicId: w.clinic.id, batchId: batch.id, toBranchId: w.b2.id, quantity: 10 })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const src = await db.inventoryBatch.findUniqueOrThrow({ where: { id: batch.id } });
    const dst = await db.inventoryBatch.findFirstOrThrow({ where: { itemId: item.id, branchId: w.b2.id } });
    expect(src.quantity + dst.quantity).toBe(10);
    expect(src.quantity).toBe(0);
  });
});

describe("concurrency: conflicting status updates", () => {
  it("check-in vs no-show on one appointment: exactly one wins, history stays linear", async () => {
    // CHECKED_IN and NO_SHOW are mutually exclusive even sequentially: neither is reachable from the other.
    const w = await makeClinic("RaceStat");
    const appt = await bookAppointment({ clinicId: w.clinic.id, branchId: w.b1.id, doctorId: w.doctor.id, patientId: w.patient.id, startsAt: at(futureDate(12), "14:00"), source: "RECEPTION" });
    const res = await Promise.allSettled([
      changeStatus({ clinicId: w.clinic.id, appointmentId: appt.id, to: "CHECKED_IN" }),
      changeStatus({ clinicId: w.clinic.id, appointmentId: appt.id, to: "NO_SHOW" }),
    ]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = res.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((loser.reason as { code?: string }).code).toBe("INVALID_TRANSITION");
    const after = await db.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(["CHECKED_IN", "NO_SHOW"]).toContain(after.status);
    // History must be linear: Created + exactly one transition ending at the current status.
    const hist = await db.appointmentStatusHistory.findMany({ where: { appointmentId: appt.id }, orderBy: { createdAt: "asc" } });
    expect(hist).toHaveLength(2);
    expect(hist[1]!.toStatus).toBe(after.status);
  });
});
