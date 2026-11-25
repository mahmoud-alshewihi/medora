import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { getAccessContext } from "@/server/auth/access";
import { unauthorized } from "@/lib/errors";
import { open } from "@/server/http/handler";

export const GET = open(async () => {
  const ctx = await getAccessContext(); if (!ctx) throw unauthorized();
  const prefs = await db.notificationPreference.findMany({ where: { userId: ctx.userId } });
  return Object.values(NotificationType).map((type) => ({ type, inApp: prefs.find((p) => p.type === type)?.inApp ?? true, email: prefs.find((p) => p.type === type)?.email ?? false }));
});
export const PUT = open(async (req) => {
  const ctx = await getAccessContext(); if (!ctx) throw unauthorized();
  const body = z.array(z.object({ type: z.nativeEnum(NotificationType), inApp: z.boolean(), email: z.boolean() })).parse(await req.json());
  for (const p of body) await db.notificationPreference.upsert({ where: { userId_type: { userId: ctx.userId, type: p.type } }, create: { userId: ctx.userId, ...p }, update: { inApp: p.inApp, email: p.email } });
  return { ok: true };
});
