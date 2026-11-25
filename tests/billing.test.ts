import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { closeCashRegister, createInvoice, recordPayment, refundPayment, voidInvoice } from "@/server/billing/service";
import { makeClinic, type World } from "./helpers";

let w: World;
beforeAll(async () => { w = await makeClinic("Bill", { tax: "14" }); });

const mkInvoice = (over: Partial<Parameters<typeof createInvoice>[0]> = {}) =>
  createInvoice({ clinicId: w.clinic.id, branchId: w.b1.id, patientId: w.patient.id, items: [{ serviceId: w.service.id, quantity: 2 }], ...over });
const pay = (invoiceId: string, amount: string, key: string, method: "CASH" | "CARD" = "CARD") =>
  recordPayment({ clinicId: w.clinic.id, invoiceId, amount, method, idempotencyKey: key });

describe("invoice calculations (server side)", () => {
  it("computes subtotal, discount, tax and total from DB prices", async () => {
    const inv = await mkInvoice({ discount: "50" });
    expect(inv.subtotal.toFixed(2)).toBe("300.00");
    expect(inv.taxAmount.toFixed(2)).toBe("35.00"); // 14% of 250
    expect(inv.total.toFixed(2)).toBe("285.00");
    expect(inv.number).toMatch(/^BIL-\d{4}-\d{6}$/);
    expect(inv.status).toBe("ISSUED");
  });
  it("rejects invalid discounts and quantities", async () => {
    await expect(mkInvoice({ discount: "999" })).rejects.toMatchObject({ status: 400 });
    await expect(mkInvoice({ discount: "-5" })).rejects.toMatchObject({ status: 400 });
    await expect(mkInvoice({ items: [{ serviceId: w.service.id, quantity: 0 }] })).rejects.toMatchObject({ status: 400 });
  });
  it("cannot invoice another clinic's patient", async () => {
    const o = await makeClinic("Oth");
    await expect(mkInvoice({ patientId: o.patient.id })).rejects.toMatchObject({ status: 404 });
  });
});

describe("payments", () => {
  it("supports partial then full payment with correct statuses and balances", async () => {
    const inv = await mkInvoice();
    const first = await pay(inv.id, "100.00", "pay-key-0001");
    expect(first.duplicate).toBe(false);
    let cur = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(cur.status).toBe("PARTIALLY_PAID");
    expect(cur.paidAmount.toFixed(2)).toBe("100.00");
    await pay(inv.id, cur.total.sub(cur.paidAmount).toFixed(2), "pay-key-0002");
    cur = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(cur.status).toBe("PAID");
  });
  it("prevents overpayment, zero and negative payments", async () => {
    const inv = await mkInvoice();
    await expect(pay(inv.id, "100000", "pay-key-0003")).rejects.toMatchObject({ code: "OVERPAYMENT" });
    await expect(pay(inv.id, "0", "pay-key-0004")).rejects.toMatchObject({ status: 400 });
    await expect(pay(inv.id, "-5", "pay-key-0005")).rejects.toMatchObject({ status: 400 });
  });
  it("is idempotent: same key returns same payment, no double charge", async () => {
    const inv = await mkInvoice();
    const a = await pay(inv.id, "50.00", "idem-key-0001");
    const b = await pay(inv.id, "50.00", "idem-key-0001");
    expect(b.duplicate).toBe(true);
    expect(b.payment.id).toBe(a.payment.id);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: inv.id } })).paidAmount.toFixed(2)).toBe("50.00");
    await expect(pay(inv.id, "60.00", "idem-key-0001")).rejects.toMatchObject({ code: "IDEMPOTENCY_MISMATCH" });
  });
  it("duplicate concurrent submissions with different keys cannot exceed the total", async () => {
    const inv = await mkInvoice();
    const total = inv.total.toFixed(2);
    const res = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => pay(inv.id, total, `race-key-000${i}`)));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const cur = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(cur.paidAmount.toFixed(2)).toBe(total);
  });
  it("records payments as offline (never claims online processing)", async () => {
    const inv = await mkInvoice();
    const { payment } = await pay(inv.id, "10.00", "offline-key-01");
    expect(payment.kind).toBe("OFFLINE_RECORDED");
  });
  it("refuses payments on void invoices and voiding paid invoices", async () => {
    const inv = await mkInvoice();
    await voidInvoice({ clinicId: w.clinic.id, invoiceId: inv.id });
    await expect(pay(inv.id, "10", "void-key-0001")).rejects.toMatchObject({ code: "INVOICE_NOT_PAYABLE" });
    const inv2 = await mkInvoice();
    await pay(inv2.id, "10", "void-key-0002");
    await expect(voidInvoice({ clinicId: w.clinic.id, invoiceId: inv2.id })).rejects.toMatchObject({ code: "INVOICE_HAS_PAYMENTS" });
  });
  it("cannot pay another clinic's invoice (IDOR)", async () => {
    const o = await makeClinic("Idor");
    const inv = await createInvoice({ clinicId: o.clinic.id, branchId: o.b1.id, patientId: o.patient.id, items: [{ serviceId: o.service.id, quantity: 1 }] });
    await expect(recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "10", method: "CASH", idempotencyKey: "idor-key-0001" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("refunds", () => {
  it("allows partial refund, blocks exceeding the payment, updates invoice and commission", async () => {
    const inv = await mkInvoice({ items: [{ description: "Visit", quantity: 1, unitPrice: "100.00" }] });
    const { payment } = await pay(inv.id, inv.total.toFixed(2), "refund-pay-01");
    const r = await refundPayment({ clinicId: w.clinic.id, paymentId: payment.id, amount: "30", reason: "Overcharge", idempotencyKey: "refund-key-01" });
    expect(r.duplicate).toBe(false);
    await expect(refundPayment({ clinicId: w.clinic.id, paymentId: payment.id, amount: "100", reason: "x", idempotencyKey: "refund-key-02" })).rejects.toMatchObject({ code: "REFUND_EXCEEDS_PAYMENT" });
    const dup = await refundPayment({ clinicId: w.clinic.id, paymentId: payment.id, amount: "30", reason: "Overcharge", idempotencyKey: "refund-key-01" });
    expect(dup.duplicate).toBe(true);
    const cur = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(cur.refundedAmount.toFixed(2)).toBe("30.00");
    expect(cur.status).toBe("PARTIALLY_PAID");
    await expect(refundPayment({ clinicId: w.clinic.id, paymentId: payment.id, amount: "10", reason: "", idempotencyKey: "refund-key-03" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("cash register", () => {
  it("closes with expected cash from recorded cash payments and blocks later cash payments", async () => {
    const c = await makeClinic("Cash");
    const inv = await createInvoice({ clinicId: c.clinic.id, branchId: c.b1.id, patientId: c.patient.id, items: [{ description: "Visit", quantity: 1, unitPrice: "200.00" }] });
    await recordPayment({ clinicId: c.clinic.id, invoiceId: inv.id, amount: "120", method: "CASH", idempotencyKey: "cash-key-0001" });
    await recordPayment({ clinicId: c.clinic.id, invoiceId: inv.id, amount: "30", method: "CARD", idempotencyKey: "cash-key-0002" });
    const r = await closeCashRegister({ clinicId: c.clinic.id, branchId: c.b1.id, countedCash: "115" });
    expect(r.register.expectedCash?.toFixed(2)).toBe("120.00");
    expect(r.variance.toFixed(2)).toBe("-5.00");
    await expect(recordPayment({ clinicId: c.clinic.id, invoiceId: inv.id, amount: "10", method: "CASH", idempotencyKey: "cash-key-0003" })).rejects.toMatchObject({ code: "REGISTER_CLOSED" });
    await expect(closeCashRegister({ clinicId: c.clinic.id, branchId: c.b1.id, countedCash: "1" })).rejects.toMatchObject({ code: "REGISTER_CLOSED" });
  });
});
