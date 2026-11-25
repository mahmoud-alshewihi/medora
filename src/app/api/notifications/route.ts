import { db } from "@/lib/db";
import { getAccessContext } from "@/server/auth/access";
import { unauthorized } from "@/lib/errors";
import { open } from "@/server/http/handler";

// Notifications are per-user; any authenticated user may read their own. Scoped strictly by session userId.
export const GET = open(async (req) => {
  const ctx = await getAccessContext(); if (!ctx) throw unauthorized();
  const u = new URL(req.url); const unreadOnly = u.searchParams.get("unread") === "true";
  const where = { userId: ctx.userId, ...(unreadOnly ? { readAt: null } : {}) };
  const [unread, rows] = await Promise.all([db.notification.count({ where: { userId: ctx.userId, readAt: null } }), db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: Math.min(100, Number(u.searchParams.get("limit") ?? 30)) })]);
  return { unread, rows };
});
export const POST = open(async () => { // mark all as read
  const ctx = await getAccessContext(); if (!ctx) throw unauthorized();
  const r = await db.notification.updateMany({ where: { userId: ctx.userId, readAt: null }, data: { readAt: new Date() } });
  return { updated: r.count };
});
