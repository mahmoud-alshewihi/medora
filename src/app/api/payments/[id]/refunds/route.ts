import { z } from "zod";
import { refundPayment } from "@/server/billing/service";
import { secured } from "@/server/http/handler";

export const POST = secured("refund.create", { body: z.object({ amount: z.union([z.string(), z.number()]), reason: z.string().min(2).max(300), idempotencyKey: z.string().min(8).max(100) }) },
  async ({ ctx, params, body }) => refundPayment({ clinicId: ctx.clinicId, paymentId: params.id!, actorUserId: ctx.userId, branchId: ctx.branchId, ...body }));
