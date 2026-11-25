import { z } from "zod";
import { consumeStock } from "@/server/inventory/service";
import { secured } from "@/server/http/handler";

export const POST = secured("inventory.manage", { body: z.object({ itemId: z.string(), branchId: z.string(), quantity: z.number().int().min(1), reason: z.string().max(200).optional() }) }, async ({ ctx, body }) => consumeStock({ clinicId: ctx.clinicId, actorUserId: ctx.userId, ...body }));
