import { z } from "zod";
import { recordPayment } from "@/server/billing/service";
import { secured } from "@/server/http/handler";

export const POST = secured("payment.record", { body: z.object({ amount: z.union([z.string(), z.number()]), method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_WALLET"]), idempotencyKey: z.string().min(8).max(100), reference: z.string().max(100).nullable().optional() }) },
  async ({ ctx, params, body }) => recordPayment({ clinicId: ctx.clinicId, invoiceId: params.id!, actorUserId: ctx.userId, branchId: ctx.branchId, ...body }));
