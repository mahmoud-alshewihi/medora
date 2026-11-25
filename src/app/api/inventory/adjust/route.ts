import { z } from "zod";
import { adjustStock } from "@/server/inventory/service";
import { secured } from "@/server/http/handler";

export const POST = secured("inventory.adjust", { body: z.object({ batchId: z.string(), delta: z.number().int(), reason: z.string().min(2).max(300) }) }, async ({ ctx, body }) => adjustStock({ clinicId: ctx.clinicId, actorUserId: ctx.userId, branchId: ctx.branchId, ...body }));
