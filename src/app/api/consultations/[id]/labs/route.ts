import { z } from "zod";
import { requestLab } from "@/server/clinical/service";
import { secured } from "@/server/http/handler";

export const POST = secured("consultation.write", { body: z.object({ testName: z.string().trim().min(1).max(120), notes: z.string().max(500).optional() }) }, async ({ ctx, params, body }) => requestLab(ctx, params.id!, body.testName, body.notes));
