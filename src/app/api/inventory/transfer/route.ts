import { z } from "zod";
import { transferStock } from "@/server/inventory/service";
import { secured } from "@/server/http/handler";

export const POST = secured("inventory.manage", { body: z.object({ batchId: z.string(), toBranchId: z.string(), quantity: z.number().int().min(1) }) }, async ({ ctx, body }) => transferStock({ clinicId: ctx.clinicId, actorUserId: ctx.userId, ...body }));
