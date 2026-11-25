import { z } from "zod";
import { setArchived } from "@/server/patients/service";
import { secured } from "@/server/http/handler";

export const POST = secured("patient.archive", { body: z.object({ archived: z.boolean() }) }, async ({ ctx, params, body }) => { await setArchived(ctx, params.id!, body.archived); return { ok: true }; });
