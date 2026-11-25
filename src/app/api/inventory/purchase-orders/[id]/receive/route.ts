import { receivePurchaseOrder } from "@/server/inventory/service";
import { secured } from "@/server/http/handler";

export const POST = secured("inventory.manage", {}, async ({ ctx, params }) => ({ id: await receivePurchaseOrder({ clinicId: ctx.clinicId, orderId: params.id!, actorUserId: ctx.userId }) }));
