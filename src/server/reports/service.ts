import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { D } from "@/lib/money";
import { dayRangeUtc, todayIn } from "@/lib/tz";
import type { AccessContext } from "@/server/auth/access";

export interface ReportFilters { from: string; to: string; branchId?: string | null; doctorId?: string | null }
type Ctx = AccessContext & { clinicId: string };

const num = (v: unknown) => Number(v ?? 0);

function scope(ctx: Ctx, f: ReportFilters) {
  // Branch-restricted staff are always pinned to their own branch regardless of the requested filter.
  const branchId = ctx.branchId ?? f.branchId ?? null;
  return { branchId, doctorId: f.doctorId ?? null };
}

async function range(ctx: Ctx, f: ReportFilters) {
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId }, select: { timezone: true, currency: true } });
  return { tz: clinic.timezone, currency: clinic.currency, start: dayRangeUtc(f.from, clinic.timezone).start, end: dayRangeUtc(f.to, clinic.timezone).end };
}

export function previousPeriod(f: ReportFilters): ReportFilters {
  const a = Date.UTC(+f.from.slice(0, 4), +f.from.slice(5, 7) - 1, +f.from.slice(8, 10));
  const b = Date.UTC(+f.to.slice(0, 4), +f.to.slice(5, 7) - 1, +f.to.slice(8, 10));
  const days = Math.round((b - a) / 86400000) + 1;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { ...f, from: iso(a - days * 86400000), to: iso(a - 86400000) };
}

export async function financialSummary(ctx: Ctx, f: ReportFilters) {
  const { start, end } = await range(ctx, f);
  const { branchId, doctorId } = scope(ctx, f);
  const bF = branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty;
  const dF = doctorId ? Prisma.sql`AND a."doctorId" = ${doctorId}` : Prisma.empty;
  const [pay] = await db.$queryRaw<{ s: Prisma.Decimal | null }[]>`
    SELECT SUM(p.amount) s FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId" LEFT JOIN "Appointment" a ON a.id = i."appointmentId"
    WHERE p."clinicId" = ${ctx.clinicId} AND p."paidAt" >= ${start} AND p."paidAt" < ${end} ${bF} ${dF}`;
  const [ref] = await db.$queryRaw<{ s: Prisma.Decimal | null }[]>`
    SELECT SUM(r.amount) s FROM "Refund" r JOIN "Payment" p ON p.id = r."paymentId" JOIN "Invoice" i ON i.id = p."invoiceId" LEFT JOIN "Appointment" a ON a.id = i."appointmentId"
    WHERE r."clinicId" = ${ctx.clinicId} AND r."createdAt" >= ${start} AND r."createdAt" < ${end} ${bF} ${dF}`;
  const [out] = await db.$queryRaw<{ s: Prisma.Decimal | null; c: bigint }[]>`
    SELECT SUM(i.total - (i."paidAmount" - i."refundedAmount")) s, COUNT(*) c FROM "Invoice" i LEFT JOIN "Appointment" a ON a.id = i."appointmentId"
    WHERE i."clinicId" = ${ctx.clinicId} AND i.status IN ('ISSUED','PARTIALLY_PAID') ${bF} ${dF}`;
  // Expenses are clinic/branch level and not attributable to a doctor.
  const expWhere: Prisma.ExpenseWhereInput = { clinicId: ctx.clinicId, incurredOn: { gte: new Date(f.from + "T00:00:00.000Z"), lte: new Date(f.to + "T00:00:00.000Z") }, ...(branchId ? { branchId } : {}) };
  const exp = await db.expense.aggregate({ where: expWhere, _sum: { amount: true } });
  const revenue = D(pay?.s).sub(D(ref?.s));
  const expenses = D(exp._sum.amount);
  return { revenue: revenue.toFixed(2), refunds: D(ref?.s).toFixed(2), expenses: expenses.toFixed(2), net: revenue.sub(expenses).toFixed(2), outstanding: D(out?.s).toFixed(2), outstandingCount: num(out?.c) };
}

export async function appointmentSummary(ctx: Ctx, f: ReportFilters) {
  const { start, end } = await range(ctx, f);
  const { branchId, doctorId } = scope(ctx, f);
  const where: Prisma.AppointmentWhereInput = { clinicId: ctx.clinicId, startsAt: { gte: start, lt: end }, ...(branchId ? { branchId } : {}), ...(doctorId ? { doctorId } : {}) };
  const g = await db.appointment.groupBy({ by: ["status"], where, _count: true });
  const by = Object.fromEntries(g.map((x) => [x.status, x._count]));
  const total = g.reduce((a, x) => a + x._count, 0);
  const cancelled = by.CANCELLED ?? 0;
  return { total, byStatus: by, completed: by.COMPLETED ?? 0, cancelled, noShow: by.NO_SHOW ?? 0, cancellationRate: total ? +(cancelled / total * 100).toFixed(1) : 0 };
}

export async function dashboard(ctx: Ctx, f: ReportFilters) {
  const { tz, currency, start, end } = await range(ctx, f);
  const { branchId, doctorId } = scope(ctx, f);
  const today = dayRangeUtc(todayIn(tz), tz);
  const apWhere: Prisma.AppointmentWhereInput = { clinicId: ctx.clinicId, ...(branchId ? { branchId } : {}), ...(doctorId ? { doctorId } : {}) };
  const [totalPatients, todayCount, waiting, fin, finPrev, appts, apptsPrev, upcoming, recent] = await Promise.all([
    db.patient.count({ where: { clinicId: ctx.clinicId, archivedAt: null } }),
    db.appointment.count({ where: { ...apWhere, startsAt: { gte: today.start, lt: today.end } } }),
    db.appointment.count({ where: { ...apWhere, startsAt: { gte: today.start, lt: today.end }, status: { in: ["CHECKED_IN", "WAITING"] } } }),
    financialSummary(ctx, f), financialSummary(ctx, previousPeriod(f)),
    appointmentSummary(ctx, f), appointmentSummary(ctx, previousPeriod(f)),
    db.appointment.findMany({ where: { ...apWhere, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } }, orderBy: { startsAt: "asc" }, take: 8, include: { patient: { select: { fullName: true } }, doctor: { select: { fullName: true } } } }),
    db.auditLog.findMany({ where: { clinicId: ctx.clinicId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, action: true, entity: true, createdAt: true, user: { select: { name: true } } } }),
  ]);
  void start; void end;
  return {
    currency, range: f,
    kpis: { totalPatients, todayAppointments: todayCount, completed: appts.completed, cancelled: appts.cancelled, waiting, monthlyRevenue: fin.revenue, outstanding: fin.outstanding, expenses: fin.expenses, net: fin.net },
    previous: { revenue: finPrev.revenue, expenses: finPrev.expenses, net: finPrev.net, appointments: apptsPrev.total },
    appointments: appts, upcoming, recent,
    revenueTrend: await revenueTrend(ctx, f), appointmentTrend: await appointmentTrend(ctx, f),
    doctorPerformance: await doctorPerformance(ctx, f), branchPerformance: await branchPerformance(ctx, f),
  };
}

export async function revenueTrend(ctx: Ctx, f: ReportFilters) {
  const { tz, start, end } = await range(ctx, f);
  const { branchId, doctorId } = scope(ctx, f);
  const bF = branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty;
  const dF = doctorId ? Prisma.sql`AND a."doctorId" = ${doctorId}` : Prisma.empty;
  const pay = await db.$queryRaw<{ d: string; s: Prisma.Decimal }[]>`
    SELECT to_char((p."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') d, SUM(p.amount) s
    FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId" LEFT JOIN "Appointment" a ON a.id = i."appointmentId"
    WHERE p."clinicId" = ${ctx.clinicId} AND p."paidAt" >= ${start} AND p."paidAt" < ${end} ${bF} ${dF} GROUP BY 1 ORDER BY 1`;
  const exp = await db.$queryRaw<{ d: string; s: Prisma.Decimal }[]>`
    SELECT to_char(e."incurredOn", 'YYYY-MM-DD') d, SUM(e.amount) s FROM "Expense" e
    WHERE e."clinicId" = ${ctx.clinicId} AND e."incurredOn" >= ${new Date(f.from + "T00:00:00.000Z")} AND e."incurredOn" <= ${new Date(f.to + "T00:00:00.000Z")}
    ${branchId ? Prisma.sql`AND e."branchId" = ${branchId}` : Prisma.empty} GROUP BY 1 ORDER BY 1`;
  const days = new Map<string, { date: string; revenue: number; expenses: number }>();
  for (const r of pay) days.set(r.d, { date: r.d, revenue: num(r.s), expenses: 0 });
  for (const r of exp) days.set(r.d, { ...(days.get(r.d) ?? { date: r.d, revenue: 0, expenses: 0 }), expenses: num(r.s) });
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function appointmentTrend(ctx: Ctx, f: ReportFilters) {
  const { tz, start, end } = await range(ctx, f);
  const { branchId, doctorId } = scope(ctx, f);
  const rows = await db.$queryRaw<{ d: string; total: bigint; completed: bigint; cancelled: bigint }[]>`
    SELECT to_char((a."startsAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') d, COUNT(*) total,
      COUNT(*) FILTER (WHERE a.status = 'COMPLETED') completed, COUNT(*) FILTER (WHERE a.status = 'CANCELLED') cancelled
    FROM "Appointment" a WHERE a."clinicId" = ${ctx.clinicId} AND a."startsAt" >= ${start} AND a."startsAt" < ${end}
    ${branchId ? Prisma.sql`AND a."branchId" = ${branchId}` : Prisma.empty} ${doctorId ? Prisma.sql`AND a."doctorId" = ${doctorId}` : Prisma.empty} GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ date: r.d, total: num(r.total), completed: num(r.completed), cancelled: num(r.cancelled) }));
}

export async function doctorPerformance(ctx: Ctx, f: ReportFilters) {
  const { start, end } = await range(ctx, f);
  const { branchId, doctorId } = scope(ctx, f);
  const rows = await db.$queryRaw<{ id: string; name: string; total: bigint; completed: bigint; cancelled: bigint; revenue: Prisma.Decimal | null; commission: Prisma.Decimal | null }[]>`
    SELECT d.id, d."fullName" name,
      (SELECT COUNT(*) FROM "Appointment" a WHERE a."doctorId" = d.id AND a."startsAt" >= ${start} AND a."startsAt" < ${end} ${branchId ? Prisma.sql`AND a."branchId" = ${branchId}` : Prisma.empty}) total,
      (SELECT COUNT(*) FROM "Appointment" a WHERE a."doctorId" = d.id AND a.status = 'COMPLETED' AND a."startsAt" >= ${start} AND a."startsAt" < ${end} ${branchId ? Prisma.sql`AND a."branchId" = ${branchId}` : Prisma.empty}) completed,
      (SELECT COUNT(*) FROM "Appointment" a WHERE a."doctorId" = d.id AND a.status = 'CANCELLED' AND a."startsAt" >= ${start} AND a."startsAt" < ${end} ${branchId ? Prisma.sql`AND a."branchId" = ${branchId}` : Prisma.empty}) cancelled,
      (SELECT SUM(p.amount) FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId" JOIN "Appointment" a ON a.id = i."appointmentId" WHERE a."doctorId" = d.id AND p."paidAt" >= ${start} AND p."paidAt" < ${end} ${branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty}) revenue,
      (SELECT SUM(c.amount) FROM "Commission" c WHERE c."doctorId" = d.id AND c."createdAt" >= ${start} AND c."createdAt" < ${end}) commission
    FROM "Doctor" d WHERE d."clinicId" = ${ctx.clinicId} ${doctorId ? Prisma.sql`AND d.id = ${doctorId}` : Prisma.empty} ORDER BY revenue DESC NULLS LAST, name`;
  return rows.map((r) => ({ id: r.id, name: r.name, total: num(r.total), completed: num(r.completed), cancelled: num(r.cancelled), revenue: D(r.revenue).toFixed(2), commission: D(r.commission).toFixed(2) }));
}

export async function branchPerformance(ctx: Ctx, f: ReportFilters) {
  const { start, end } = await range(ctx, f);
  const { branchId } = scope(ctx, f);
  const rows = await db.$queryRaw<{ id: string; name: string; appointments: bigint; revenue: Prisma.Decimal | null; expenses: Prisma.Decimal | null }[]>`
    SELECT b.id, b.name,
      (SELECT COUNT(*) FROM "Appointment" a WHERE a."branchId" = b.id AND a."startsAt" >= ${start} AND a."startsAt" < ${end}) appointments,
      (SELECT SUM(p.amount) FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId" WHERE i."branchId" = b.id AND p."paidAt" >= ${start} AND p."paidAt" < ${end}) revenue,
      (SELECT SUM(e.amount) FROM "Expense" e WHERE e."branchId" = b.id AND e."incurredOn" >= ${new Date(f.from + "T00:00:00.000Z")} AND e."incurredOn" <= ${new Date(f.to + "T00:00:00.000Z")}) expenses
    FROM "Branch" b WHERE b."clinicId" = ${ctx.clinicId} ${branchId ? Prisma.sql`AND b.id = ${branchId}` : Prisma.empty} ORDER BY b.name`;
  return rows.map((r) => ({ id: r.id, name: r.name, appointments: num(r.appointments), revenue: D(r.revenue).toFixed(2), expenses: D(r.expenses).toFixed(2), net: D(r.revenue).sub(D(r.expenses)).toFixed(2) }));
}

export async function paymentMethods(ctx: Ctx, f: ReportFilters) {
  const { start, end } = await range(ctx, f);
  const { branchId } = scope(ctx, f);
  const rows = await db.$queryRaw<{ method: string; s: Prisma.Decimal; c: bigint }[]>`
    SELECT p.method::text method, SUM(p.amount) s, COUNT(*) c FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId"
    WHERE p."clinicId" = ${ctx.clinicId} AND p."paidAt" >= ${start} AND p."paidAt" < ${end} ${branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty} GROUP BY 1 ORDER BY 2 DESC`;
  return rows.map((r) => ({ method: r.method, amount: D(r.s).toFixed(2), count: num(r.c) }));
}

export async function patientGrowth(ctx: Ctx, f: ReportFilters) {
  const { start, end } = await range(ctx, f);
  const { branchId, doctorId } = scope(ctx, f);
  const rows = await db.$queryRaw<{ isnew: boolean; c: bigint }[]>`
    SELECT (p."createdAt" >= ${start}) isnew, COUNT(DISTINCT p.id) c FROM "Patient" p JOIN "Appointment" a ON a."patientId" = p.id
    WHERE p."clinicId" = ${ctx.clinicId} AND a."startsAt" >= ${start} AND a."startsAt" < ${end}
    ${branchId ? Prisma.sql`AND a."branchId" = ${branchId}` : Prisma.empty} ${doctorId ? Prisma.sql`AND a."doctorId" = ${doctorId}` : Prisma.empty} GROUP BY 1`;
  return { newPatients: num(rows.find((r) => r.isnew)?.c), returningPatients: num(rows.find((r) => !r.isnew)?.c) };
}

export async function outstandingInvoices(ctx: Ctx, f: ReportFilters) {
  const { branchId, doctorId } = scope(ctx, f);
  const rows = await db.invoice.findMany({
    where: { clinicId: ctx.clinicId, status: { in: ["ISSUED", "PARTIALLY_PAID"] }, ...(branchId ? { branchId } : {}), ...(doctorId ? { appointment: { doctorId } } : {}) },
    include: { patient: { select: { fullName: true, mrn: true } } }, orderBy: { issuedAt: "asc" }, take: 500,
  });
  return rows.map((i) => ({ id: i.id, number: i.number, patient: i.patient.fullName, mrn: i.patient.mrn, issuedAt: i.issuedAt.toISOString().slice(0, 10), total: i.total.toFixed(2), outstanding: i.total.sub(i.paidAmount.sub(i.refundedAmount)).toFixed(2) }));
}

export async function inventoryMovements(ctx: Ctx, f: ReportFilters) {
  const { start, end } = await range(ctx, f);
  const { branchId } = scope(ctx, f);
  const rows = await db.stockMovement.groupBy({ by: ["type"], where: { clinicId: ctx.clinicId, createdAt: { gte: start, lt: end }, ...(branchId ? { branchId } : {}) }, _sum: { quantityDelta: true }, _count: true });
  return rows.map((r) => ({ type: r.type, movements: r._count, netQuantity: r._sum.quantityDelta ?? 0 }));
}

export async function commissionReport(ctx: Ctx, f: ReportFilters) {
  const { start, end } = await range(ctx, f);
  const { doctorId } = scope(ctx, f);
  const rows = await db.commission.groupBy({ by: ["doctorId"], where: { clinicId: ctx.clinicId, createdAt: { gte: start, lt: end }, ...(doctorId ? { doctorId } : {}) }, _sum: { amount: true }, _count: true });
  const docs = await db.doctor.findMany({ where: { id: { in: rows.map((r) => r.doctorId) } }, select: { id: true, fullName: true } });
  return rows.map((r) => ({ doctor: docs.find((d) => d.id === r.doctorId)?.fullName ?? r.doctorId, invoices: r._count, commission: D(r._sum.amount).toFixed(2) }));
}

export async function fullReport(ctx: Ctx, f: ReportFilters) {
  const [financial, previousFinancial, appointments, previousAppointments, trend, appointmentsTrend, doctors, branches, methods, patients, outstanding, inventory, commissions] = await Promise.all([
    financialSummary(ctx, f), financialSummary(ctx, previousPeriod(f)), appointmentSummary(ctx, f), appointmentSummary(ctx, previousPeriod(f)),
    revenueTrend(ctx, f), appointmentTrend(ctx, f), doctorPerformance(ctx, f), branchPerformance(ctx, f), paymentMethods(ctx, f), patientGrowth(ctx, f),
    outstandingInvoices(ctx, f), inventoryMovements(ctx, f), commissionReport(ctx, f),
  ]);
  return { range: f, previousRange: previousPeriod(f), financial, previousFinancial, appointments, previousAppointments, trend, appointmentsTrend, doctors, branches, methods, patients, outstanding, inventory, commissions };
}
