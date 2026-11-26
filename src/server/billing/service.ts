import { Prisma, type InvoiceStatus, type PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, badRequest, conflict, notFound } from "@/lib/errors";
import { D, computeInvoiceTotals, round2 } from "@/lib/money";
import { clinicToday } from "@/server/common/clinic";
import { audit } from "@/server/audit/audit";
import { notify, staffWithPermission } from "@/server/notifications/service";

type Tx = Prisma.TransactionClient;

async function nextNumber(tx: Tx, key: string, prefix: string): Promise<string> {
  const row = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return `${prefix}-${String(row.value).padStart(6, "0")}`;
}

export interface InvoiceLineInput { serviceId?: string | null; description?: string; quantity: number; unitPrice?: string | number }

export async function createInvoice(args: {
  clinicId: string; branchId: string; patientId: string; appointmentId?: string | null;
  items: InvoiceLineInput[]; discount?: string | number; notes?: string | null; actorUserId?: string | null; dueDate?: Date | null;
}, outer?: Tx) {
  const run = async (tx: Tx) => {
    const [clinic, patient, branch] = await Promise.all([
      tx.clinic.findUniqueOrThrow({ where: { id: args.clinicId } }),
      tx.patient.findFirst({ where: { id: args.patientId, clinicId: args.clinicId } }),
      tx.branch.findFirst({ where: { id: args.branchId, clinicId: args.clinicId } }),
    ]);
    if (!patient) throw notFound("Patient");
    if (!branch) throw notFound("Branch");
    if (!args.items.length) throw badRequest("Invoice needs at least one line item");
    if (args.appointmentId) {
      const ap = await tx.appointment.findFirst({ where: { id: args.appointmentId, clinicId: args.clinicId, patientId: args.patientId } });
      if (!ap) throw notFound("Appointment");
      if (ap.branchId !== args.branchId) throw badRequest("Invoice branch must match the appointment branch");
      const existing = await tx.invoice.findUnique({ where: { appointmentId: args.appointmentId } });
      if (existing) throw conflict("INVOICE_EXISTS", "This appointment already has an invoice");
    }
    const services = await tx.service.findMany({ where: { id: { in: args.items.map((i) => i.serviceId).filter((x): x is string => !!x) }, clinicId: args.clinicId } });
    const lines = args.items.map((i) => {
      if (!Number.isInteger(i.quantity) || i.quantity < 1) throw badRequest("Quantity must be a positive integer");
      const svc = i.serviceId ? services.find((s) => s.id === i.serviceId) : undefined;
      if (i.serviceId && !svc) throw notFound("Service");
      const price = i.unitPrice !== undefined ? D(i.unitPrice) : svc?.price;
      if (price === undefined) throw badRequest("Line needs a service or a unit price");
      if (price.isNegative()) throw badRequest("Unit price cannot be negative");
      return { serviceId: svc?.id ?? null, description: i.description ?? svc?.name ?? "Item", quantity: i.quantity, unitPrice: round2(price) };
    });
    let totals;
    try { totals = computeInvoiceTotals(lines, args.discount ?? 0, clinic.taxRatePercent); }
    catch (e) { throw badRequest((e as Error).message); }
    const year = new Date().getUTCFullYear();
    const number = await nextNumber(tx, `invoice:${clinic.id}:${year}`, `${clinic.invoicePrefix}-${year}`);
    const inv = await tx.invoice.create({
      data: {
        clinicId: clinic.id, branchId: branch.id, patientId: patient.id, appointmentId: args.appointmentId ?? null, number,
        status: totals.total.isZero() ? "PAID" : "ISSUED", currency: clinic.currency, subtotal: totals.subtotal,
        discountAmount: totals.discountAmount, taxAmount: totals.taxAmount, total: totals.total, notes: args.notes ?? null,
        createdById: args.actorUserId ?? null, dueDate: args.dueDate ?? null,
        items: { create: lines.map((l, i) => ({ ...l, lineTotal: totals.lineTotals[i]! })) },
      },
      include: { items: true },
    });
    await audit({ clinicId: clinic.id, userId: args.actorUserId, action: "invoice.create", entity: "Invoice", entityId: inv.id, metadata: { number, total: inv.total.toString() } }, tx);
    return inv;
  };
  try {
    return outer ? await run(outer) : await db.$transaction(run);
  } catch (e) {
    // Two concurrent creates for the same appointment both pass the existence check; the unique index decides. Map it to a clean conflict.
    if ((e as { code?: string }).code === "P2002" && args.appointmentId && String((e as { message?: string }).message ?? "").includes("appointmentId"))
      throw conflict("INVOICE_EXISTS", "This appointment already has an invoice");
    throw e;
  }
}

export const outstandingOf = (inv: { total: Prisma.Decimal; paidAmount: Prisma.Decimal; refundedAmount: Prisma.Decimal; status: InvoiceStatus }) =>
  inv.status === "VOID" ? D(0) : inv.total.sub(inv.paidAmount.sub(inv.refundedAmount));

function statusFor(total: Prisma.Decimal, paid: Prisma.Decimal, refunded: Prisma.Decimal): InvoiceStatus {
  if (paid.gt(0) && refunded.eq(paid)) return "REFUNDED";
  const net = paid.sub(refunded);
  if (net.gte(total)) return "PAID";
  if (net.gt(0)) return "PARTIALLY_PAID";
  return "ISSUED";
}

async function syncCommission(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { appointment: { include: { doctor: true } } } });
  const doctor = inv.appointment?.doctor;
  if (!doctor) return;
  const net = inv.paidAmount.sub(inv.refundedAmount);
  // Commission accrues on money actually collected (net of refunds).
  const amount = round2(net.mul(doctor.commissionPercent).div(100));
  await tx.commission.upsert({
    where: { invoiceId_doctorId: { invoiceId, doctorId: doctor.id } },
    create: { clinicId: inv.clinicId, doctorId: doctor.id, invoiceId, percent: doctor.commissionPercent, amount },
    update: { amount, percent: doctor.commissionPercent },
  });
}

/** Records an OFFLINE payment (cash/card terminal/bank transfer/wallet receipt). No external processing is performed. */
export async function recordPayment(args: {
  clinicId: string; invoiceId: string; amount: string | number; method: PaymentMethod; idempotencyKey: string;
  reference?: string | null; actorUserId?: string | null; branchId?: string | null;
}) {
  if (!args.idempotencyKey || args.idempotencyKey.length < 8) throw badRequest("idempotencyKey is required (min 8 chars)");
  const amount = round2(D(args.amount));
  if (amount.lte(0)) throw badRequest("Payment amount must be greater than zero");
  // A concurrent same-key request can win the unique constraint mid-transaction; Postgres then aborts
  // the transaction, so retry the whole transaction once - the duplicate check at the top resolves it.
  for (let attempt = 0; ; attempt++) {
    try {
      return await runPaymentTx();
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 1) continue;
      if ((e as { code?: string }).code === "P2002") throw conflict("IDEMPOTENCY_MISMATCH", "This idempotency key was already used for a different payment");
      throw e;
    }
  }

  async function runPaymentTx() {
  return db.$transaction(async (tx) => {
    const dup = await tx.payment.findUnique({ where: { clinicId_idempotencyKey: { clinicId: args.clinicId, idempotencyKey: args.idempotencyKey } } });
    if (dup) {
      if (dup.invoiceId !== args.invoiceId || !dup.amount.eq(amount)) throw conflict("IDEMPOTENCY_MISMATCH", "This idempotency key was already used for a different payment");
      return { payment: dup, duplicate: true };
    }
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Invoice" WHERE id = ${args.invoiceId} AND "clinicId" = ${args.clinicId} FOR UPDATE`;
    if (!locked.length) throw notFound("Invoice");
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: args.invoiceId }, include: { patient: true } });
    if (args.branchId && inv.branchId !== args.branchId) throw notFound("Invoice");
    if (inv.status === "VOID" || inv.status === "DRAFT") throw conflict("INVOICE_NOT_PAYABLE", `Invoice is ${inv.status}`);
    const outstanding = outstandingOf(inv);
    if (amount.gt(outstanding)) throw conflict("OVERPAYMENT", `Payment exceeds outstanding balance (${outstanding.toFixed(2)})`);
    const paid = inv.paidAmount.add(amount);
    const receiptNumber = await nextNumber(tx, `receipt:${args.clinicId}`, "RCT");
    let registerId: string | undefined;
    if (args.method === "CASH") {
      const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: args.clinicId }, select: { timezone: true } });
      const businessDate = new Date(clinicToday(clinic.timezone) + "T00:00:00.000Z");
      const reg = await tx.cashRegister.upsert({
        where: { branchId_businessDate: { branchId: inv.branchId, businessDate } },
        create: { clinicId: args.clinicId, branchId: inv.branchId, businessDate }, update: {},
      });
      // Serialise with a concurrent register close: the row lock makes either the payment or the close win cleanly.
      const regLocked = await tx.$queryRaw<{ id: string; closedAt: Date | null }[]>`SELECT id, "closedAt" FROM "CashRegister" WHERE id = ${reg.id} FOR UPDATE`;
      if (regLocked[0]?.closedAt) throw conflict("REGISTER_CLOSED", "Today's cash register is closed for this branch");
      registerId = reg.id;
    }
    const payment = await tx.payment.create({
      data: { invoiceId: inv.id, clinicId: args.clinicId, amount, method: args.method, reference: args.reference ?? null,
        idempotencyKey: args.idempotencyKey, receiptNumber, receivedById: args.actorUserId ?? null, cashRegisterId: registerId },
    });
    const status = statusFor(inv.total, paid, inv.refundedAmount);
    await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status } });
    await syncCommission(tx, inv.id);
    await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "payment.record", entity: "Payment", entityId: payment.id, metadata: { amount: amount.toString(), method: args.method, invoice: inv.number } }, tx);
    return { payment, duplicate: false };
  });
  }
}

export async function refundPayment(args: { clinicId: string; paymentId: string; amount: string | number; reason: string; idempotencyKey: string; actorUserId?: string | null; branchId?: string | null }) {
  const amount = round2(D(args.amount));
  if (amount.lte(0)) throw badRequest("Refund amount must be greater than zero");
  if (!args.reason.trim()) throw badRequest("A refund reason is required");
  for (let attempt = 0; ; attempt++) {
    try {
      return await runRefundTx();
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 1) continue;
      if ((e as { code?: string }).code === "P2002") throw conflict("IDEMPOTENCY_MISMATCH", "This idempotency key was already used for a different refund");
      throw e;
    }
  }

  async function runRefundTx() {
  return db.$transaction(async (tx) => {
    const dup = await tx.refund.findUnique({ where: { clinicId_idempotencyKey: { clinicId: args.clinicId, idempotencyKey: args.idempotencyKey } } });
    if (dup) {
      if (dup.paymentId !== args.paymentId || !dup.amount.eq(amount)) throw conflict("IDEMPOTENCY_MISMATCH", "This idempotency key was already used for a different refund");
      return { refund: dup, duplicate: true };
    }
    const p0 = await tx.payment.findFirst({ where: { id: args.paymentId, clinicId: args.clinicId } });
    if (!p0) throw notFound("Payment");
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${p0.invoiceId} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: p0.id }, include: { refunds: true, invoice: { select: { branchId: true } } } });
    if (args.branchId && payment.invoice.branchId !== args.branchId) throw notFound("Payment");
    const already = payment.refunds.reduce((a, r) => a.add(r.amount), D(0));
    if (amount.gt(payment.amount.sub(already))) throw conflict("REFUND_EXCEEDS_PAYMENT", "Refund exceeds the refundable amount of this payment");
    const refund = await tx.refund.create({ data: { paymentId: payment.id, clinicId: args.clinicId, amount, reason: args.reason, idempotencyKey: args.idempotencyKey, createdById: args.actorUserId ?? null } });
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
    const refunded = inv.refundedAmount.add(amount);
    await tx.invoice.update({ where: { id: inv.id }, data: { refundedAmount: refunded, status: statusFor(inv.total, inv.paidAmount, refunded) } });
    await syncCommission(tx, inv.id);
    await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "refund.create", entity: "Refund", entityId: refund.id, metadata: { amount: amount.toString(), payment: payment.receiptNumber } }, tx);
    return { refund, duplicate: false };
  });
  }
}

export async function voidInvoice(args: { clinicId: string; invoiceId: string; actorUserId?: string | null }) {
  const inv = await db.invoice.findFirst({ where: { id: args.invoiceId, clinicId: args.clinicId } });
  if (!inv) throw notFound("Invoice");
  if (inv.paidAmount.gt(0)) throw conflict("INVOICE_HAS_PAYMENTS", "Refund payments before voiding an invoice");
  const r = await db.invoice.update({ where: { id: inv.id }, data: { status: "VOID" } });
  await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "invoice.void", entity: "Invoice", entityId: inv.id });
  return r;
}

export async function closeCashRegister(args: { clinicId: string; branchId: string; countedCash: string | number; actorUserId?: string | null; date?: string }) {
  const counted = round2(D(args.countedCash));
  if (counted.isNegative()) throw badRequest("Counted cash cannot be negative");
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: args.clinicId }, select: { timezone: true } });
  const businessDate = new Date((args.date ?? clinicToday(clinic.timezone)) + "T00:00:00.000Z");
  return db.$transaction(async (tx) => {
    const reg = await tx.cashRegister.findFirst({ where: { branchId: args.branchId, businessDate, clinicId: args.clinicId } });
    if (!reg) throw notFound("Cash register for that day");
    // Lock the register row: a concurrent cash payment either lands before the close (and is counted) or is rejected after it.
    const regLocked = await tx.$queryRaw<{ id: string; closedAt: Date | null }[]>`SELECT id, "closedAt" FROM "CashRegister" WHERE id = ${reg.id} FOR UPDATE`;
    if (regLocked[0]?.closedAt) throw conflict("REGISTER_CLOSED", "Register already closed");
    const payments = await tx.payment.findMany({ where: { cashRegisterId: reg.id }, include: { refunds: true } });
    const cashIn = payments.reduce((a, p) => a.add(p.amount), D(0));
    const cashOut = payments.reduce((a, p) => a.add(p.refunds.reduce((x, r) => x.add(r.amount), D(0))), D(0));
    const expected = reg.openingBalance.add(cashIn).sub(cashOut);
    const closed = await tx.cashRegister.update({ where: { id: reg.id }, data: { expectedCash: expected, countedCash: counted, closedAt: new Date(), closedById: args.actorUserId ?? null } });
    await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "cash.close", entity: "CashRegister", entityId: reg.id, metadata: { expected: expected.toString(), counted: counted.toString() } }, tx);
    return { register: closed, variance: counted.sub(expected) };
  });
}

export async function createExpense(args: { clinicId: string; branchId?: string | null; categoryId: string; description: string; amount: string | number; incurredOn: string; actorUserId?: string | null }) {
  const amount = round2(D(args.amount));
  if (amount.lte(0)) throw badRequest("Expense amount must be greater than zero");
  const cat = await db.expenseCategory.findFirst({ where: { id: args.categoryId, clinicId: args.clinicId } });
  if (!cat) throw notFound("Expense category");
  if (args.branchId && !(await db.branch.findFirst({ where: { id: args.branchId, clinicId: args.clinicId } }))) throw notFound("Branch");
  const e = await db.expense.create({ data: { clinicId: args.clinicId, branchId: args.branchId ?? null, categoryId: cat.id, description: args.description, amount, incurredOn: new Date(args.incurredOn + "T00:00:00.000Z"), createdById: args.actorUserId ?? null } });
  await audit({ clinicId: args.clinicId, userId: args.actorUserId, action: "expense.create", entity: "Expense", entityId: e.id, metadata: { amount: amount.toString() } });
  return e;
}

/** Creates in-app reminders for invoices outstanding beyond `olderThanDays` (deduped per invoice per day). */
export async function notifyOutstandingInvoices(clinicId: string, olderThanDays = 7) {
  const cutoff = new Date(Date.now() - olderThanDays * 86400000);
  const open = await db.invoice.findMany({ where: { clinicId, status: { in: ["ISSUED", "PARTIALLY_PAID"] }, issuedAt: { lt: cutoff } }, include: { patient: { select: { fullName: true } } }, take: 200 });
  const staff = await staffWithPermission(clinicId, ["CLINIC_OWNER", "ACCOUNTANT"]);
  let n = 0;
  const day = new Date().toISOString().slice(0, 10);
  for (const inv of open) {
    n += await notify({ clinicId, userIds: staff, type: "INVOICE_OUTSTANDING", title: "Outstanding invoice", body: `${inv.number} (${inv.patient.fullName}) has ${outstandingOf(inv).toFixed(2)} ${inv.currency} outstanding`, link: `/admin/billing/${inv.id}`, dedupeKey: `inv-out:${inv.id}:${day}` });
  }
  return n;
}
export { AppError };
