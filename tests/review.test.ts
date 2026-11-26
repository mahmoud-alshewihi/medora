/* v0.14 independent-review regression tests (findings #1-#6, #10). Each asserts CORRECT behavior;
   pre-fix runs demonstrate the bug, post-fix runs must pass. */
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createStaff, setStaffStatus } from "@/server/staff/service";
import { createInvoice, recordPayment, refundPayment } from "@/server/billing/service";
import { bookAppointment } from "@/server/appointments/service";
import { at, futureDate, makeClinic } from "./helpers";

describe("review #1: staff privilege hierarchy", () => {
  it("a branch manager cannot suspend the clinic owner", async () => {
    const w = await makeClinic("RevHier");
    await expect(setStaffStatus(w.clinic.id, w.users.manager.id, w.users.owner.id, "SUSPENDED", "BRANCH_MANAGER", w.b1.id))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await db.user.findUniqueOrThrow({ where: { id: w.users.owner.id } })).status).toBe("ACTIVE");
  });
  it("the owner can still suspend a manager", async () => {
    const w = await makeClinic("RevHierOk");
    await setStaffStatus(w.clinic.id, w.users.owner.id, w.users.manager.id, "SUSPENDED", "CLINIC_OWNER", null);
    expect((await db.user.findUniqueOrThrow({ where: { id: w.users.manager.id } })).status).toBe("SUSPENDED");
  });
});

describe("review #2: staff branch isolation", () => {
  it("a branch manager cannot create staff pinned to another branch", async () => {
    const w = await makeClinic("RevStaffBr");
    await expect(createStaff(w.clinic.id, w.users.manager.id, "BRANCH_MANAGER",
      { fullName: "New Rec", email: "newrec@t.test", password: "password123", role: "RECEPTIONIST", branchId: w.b2.id }, w.b1.id))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.user.findUnique({ where: { email: "newrec@t.test" } })).toBeNull();
  });
  it("a branch manager cannot suspend staff of another branch", async () => {
    const w = await makeClinic("RevStaffSus");
    // receptionist is pinned to b1; manager is pinned to b1 too, so use a b2-pinned target:
    const rec2 = await db.user.create({ data: { id: crypto.randomUUID(), name: "Rec Two", email: "rec2@t.test", emailVerified: true } });
    const role = await db.role.findUniqueOrThrow({ where: { key: "RECEPTIONIST" } });
    await db.membership.create({ data: { userId: rec2.id, roleId: role.id, clinicId: w.clinic.id, branchId: w.b2.id } });
    await expect(setStaffStatus(w.clinic.id, w.users.manager.id, rec2.id, "SUSPENDED", "BRANCH_MANAGER", w.b1.id))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await db.user.findUniqueOrThrow({ where: { id: rec2.id } })).status).toBe("ACTIVE");
  });
  it("a branch manager can still manage staff in their own branch", async () => {
    const w = await makeClinic("RevStaffOwn");
    await setStaffStatus(w.clinic.id, w.users.manager.id, w.users.receptionist.id, "SUSPENDED", "BRANCH_MANAGER", w.b1.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: w.users.receptionist.id } })).status).toBe("SUSPENDED");
  });
});

describe("review #3: refund branch authorization", () => {
  it("a branch-scoped actor cannot refund a payment of another branch's invoice", async () => {
    const w = await makeClinic("RevRefBr");
    const inv = await createInvoice({ clinicId: w.clinic.id, branchId: w.b2.id, patientId: w.patient.id, items: [{ description: "x", quantity: 1, unitPrice: "100" }] });
    await recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "100", method: "CARD", idempotencyKey: "rev-ref-pay-1" });
    const pay = await db.payment.findFirstOrThrow({ where: { invoiceId: inv.id } });
    await expect(refundPayment({ clinicId: w.clinic.id, paymentId: pay.id, amount: "10", reason: "cross-branch", idempotencyKey: "rev-ref-1", branchId: w.b1.id }))
      .rejects.toMatchObject({ status: 404 });
    expect(await db.refund.count({ where: { paymentId: pay.id } })).toBe(0);
  });
});

describe("review #5: payment after refund vs invoice_amounts_valid", () => {
  it("re-paying the refunded balance succeeds and keeps the books consistent", async () => {
    const w = await makeClinic("RevPayRef");
    const inv = await createInvoice({ clinicId: w.clinic.id, branchId: w.b1.id, patientId: w.patient.id, items: [{ description: "x", quantity: 1, unitPrice: "100" }] });
    await recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "100", method: "CARD", idempotencyKey: "rev-pr-pay-1" });
    const pay = await db.payment.findFirstOrThrow({ where: { invoiceId: inv.id } });
    await refundPayment({ clinicId: w.clinic.id, paymentId: pay.id, amount: "60", reason: "partial", idempotencyKey: "rev-pr-ref-1" });
    // The patient still owes 60; paying it must not violate the DB constraint.
    await recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "60", method: "CARD", idempotencyKey: "rev-pr-pay-2" });
    const after = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.paidAmount.toFixed(2)).toBe("160.00");
    expect(after.refundedAmount.toFixed(2)).toBe("60.00");
    expect(after.status).toBe("PAID");
    // Beyond outstanding is still rejected cleanly.
    await expect(recordPayment({ clinicId: w.clinic.id, invoiceId: inv.id, amount: "1", method: "CARD", idempotencyKey: "rev-pr-pay-3" }))
      .rejects.toMatchObject({ code: "OVERPAYMENT" });
  });
});

describe("review #6: invoice branch consistency", () => {
  it("an invoice for an appointment must use the appointment's branch", async () => {
    const w = await makeClinic("RevInvBr");
    const appt = await bookAppointment({ clinicId: w.clinic.id, branchId: w.b1.id, doctorId: w.doctor.id, patientId: w.patient.id, startsAt: at(futureDate(13), "10:00"), source: "RECEPTION" });
    await expect(createInvoice({ clinicId: w.clinic.id, branchId: w.b2.id, patientId: w.patient.id, appointmentId: appt.id, items: [{ description: "x", quantity: 1, unitPrice: "100" }] }))
      .rejects.toMatchObject({ status: 400 });
    expect(await db.invoice.count({ where: { appointmentId: appt.id } })).toBe(0);
  });
});
