import { z } from "zod";
import { assertBranchAllowed } from "@/server/auth/access";
import { closeCashRegister } from "@/server/billing/service";
import { secured } from "@/server/http/handler";

export const POST = secured("cash.close", { body: z.object({ branchId: z.string(), countedCash: z.union([z.string(), z.number()]) }) },
  async ({ ctx, body }) => { assertBranchAllowed(ctx, body.branchId); const r = await closeCashRegister({ clinicId: ctx.clinicId, actorUserId: ctx.userId, ...body }); return { expected: r.register.expectedCash?.toFixed(2), counted: r.register.countedCash?.toFixed(2), variance: r.variance.toFixed(2) }; });
