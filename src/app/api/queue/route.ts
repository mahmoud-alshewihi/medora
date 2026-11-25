import { queueForBranch } from "@/server/appointments/service";
import { secured } from "@/server/http/handler";

export const GET = secured("queue.manage", {}, async ({ ctx, url }) => queueForBranch(ctx.clinicId, ctx.branchId ?? url.searchParams.get("branchId"), url.searchParams.get("date") ?? undefined));
