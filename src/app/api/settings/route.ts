import { db } from "@/lib/db";
import { clinicSettingsInput, updateClinicSettings } from "@/server/staff/service";
import { secured } from "@/server/http/handler";

export const GET = secured("clinic.settings", {}, async ({ ctx }) => db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } }));
export const PATCH = secured("clinic.settings", { body: clinicSettingsInput }, async ({ ctx, body }) => updateClinicSettings(ctx.clinicId, ctx.userId, body));
