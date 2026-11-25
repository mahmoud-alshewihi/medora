import { z } from "zod";
import { receiveStock } from "@/server/inventory/service";
import { assertBranchAllowed } from "@/server/auth/access";
import { secured } from "@/server/http/handler";

export const POST = secured("inventory.manage", { body: z.object({ itemId: z.string(), branchId: z.string(), batchNumber: z.string().min(1).max(40), expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), quantity: z.number().int().min(1) }) },
  async ({ ctx, body }) => { assertBranchAllowed(ctx, body.branchId); return receiveStock({ clinicId: ctx.clinicId, actorUserId: ctx.userId, ...body }); });
