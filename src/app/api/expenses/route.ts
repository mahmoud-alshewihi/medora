import { z } from "zod";
import { db } from "@/lib/db";
import { createExpense } from "@/server/billing/service";
import { secured } from "@/server/http/handler";

export const GET = secured("expense.manage", {}, async ({ ctx }) => db.expense.findMany({ where: { clinicId: ctx.clinicId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, orderBy: { incurredOn: "desc" }, take: 200, include: { category: true } }));
export const POST = secured("expense.manage", { body: z.object({ categoryId: z.string(), branchId: z.string().nullable().optional(), description: z.string().min(2).max(200), amount: z.union([z.string(), z.number()]), incurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) },
  async ({ ctx, body }) => createExpense({ clinicId: ctx.clinicId, actorUserId: ctx.userId, ...body, branchId: ctx.branchId ?? body.branchId }));
