import { db } from "@/lib/db";
import { getAccessContext } from "@/server/auth/access";
import { notFound, unauthorized } from "@/lib/errors";
import { open } from "@/server/http/handler";

export const PATCH = open(async (_req, params) => {
  const ctx = await getAccessContext(); if (!ctx) throw unauthorized();
  const r = await db.notification.updateMany({ where: { id: params.id!, userId: ctx.userId }, data: { readAt: new Date() } });
  if (!r.count) throw notFound("Notification");
  return { ok: true };
});
