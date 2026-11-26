import { listStaff, createStaff, staffInput, setStaffStatus } from "@/server/staff/service";
import { z } from "zod";
import { secured } from "@/server/http/handler";

export const GET = secured("staff.manage", {}, async ({ ctx }) => listStaff(ctx.clinicId, ctx.branchId));
export const POST = secured("staff.manage", { body: staffInput }, async ({ ctx, body }) => createStaff(ctx.clinicId, ctx.userId, ctx.role, body, ctx.branchId));
export const PATCH = secured("staff.manage", { body: z.object({ userId: z.string(), status: z.enum(["ACTIVE", "SUSPENDED"]) }) }, async ({ ctx, body }) => { await setStaffStatus(ctx.clinicId, ctx.userId, body.userId, body.status, ctx.role, ctx.branchId); return { ok: true }; });
