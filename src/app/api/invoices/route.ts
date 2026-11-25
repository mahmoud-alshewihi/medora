import { z } from "zod";
import { db } from "@/lib/db";
import { assertBranchAllowed } from "@/server/auth/access";
import { createInvoice } from "@/server/billing/service";
import { secured } from "@/server/http/handler";

const create = z.object({ branchId: z.string(), patientId: z.string(), appointmentId: z.string().nullable().optional(), discount: z.union([z.string(), z.number()]).optional(), notes: z.string().max(500).nullable().optional(),
  items: z.array(z.object({ serviceId: z.string().nullable().optional(), description: z.string().max(200).optional(), quantity: z.number().int().min(1).max(1000), unitPrice: z.union([z.string(), z.number()]).optional() })).min(1).max(50) });
export const POST = secured("billing.write", { body: create }, async ({ ctx, body }) => { assertBranchAllowed(ctx, body.branchId); return createInvoice({ clinicId: ctx.clinicId, actorUserId: ctx.userId, ...body }); });

export const GET = secured("billing.read", {}, async ({ ctx, url }) => {
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1)); const pageSize = Math.min(100, Number(url.searchParams.get("pageSize") ?? 25));
  const where = { clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}), ...(status ? { status: status as never } : {}) };
  const [total, rows] = await Promise.all([db.invoice.count({ where }), db.invoice.findMany({ where, orderBy: { issuedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { patient: { select: { fullName: true, mrn: true } } } })]);
  return { total, rows };
});
