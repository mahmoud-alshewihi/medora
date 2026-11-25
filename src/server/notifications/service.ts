import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "./providers";

type Tx = PrismaClient | Prisma.TransactionClient;

export interface NotifyInput {
  clinicId: string; userIds: string[]; type: NotificationType; title: string; body: string; link?: string; dedupeKey?: string;
}

/** Creates in-app notifications (respecting preferences). Email is attempted only if the user opted in and a provider exists. */
export async function notify(input: NotifyInput, tx: Tx = db) {
  const unique = [...new Set(input.userIds)];
  if (!unique.length) return 0;
  const prefs = await tx.notificationPreference.findMany({ where: { userId: { in: unique }, type: input.type } });
  const prefMap = new Map(prefs.map((p) => [p.userId, p]));
  let created = 0;
  for (const userId of unique) {
    const pref = prefMap.get(userId);
    if (pref && !pref.inApp) continue;
    try {
      await tx.notification.create({
        data: { clinicId: input.clinicId, userId, type: input.type, title: input.title, body: input.body, link: input.link,
          dedupeKey: input.dedupeKey, deliveryStatus: pref?.email ? "EMAIL_PENDING" : "IN_APP_ONLY" },
      });
      created++;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue; // duplicate dedupeKey
      throw e;
    }
  }
  return created;
}

/** Sends pending email notifications; marks them truthfully. */
export async function dispatchPendingEmails(limit = 50) {
  const pending = await db.notification.findMany({ where: { deliveryStatus: "EMAIL_PENDING" }, include: { user: true }, take: limit });
  for (const n of pending) {
    const r = await sendEmail({ to: n.user.email, subject: n.title, text: n.body });
    await db.notification.update({ where: { id: n.id }, data: { deliveryStatus: r.delivered ? "EMAIL_SENT" : "EMAIL_NOT_DELIVERED" } });
  }
  return pending.length;
}

export async function staffWithPermission(clinicId: string, roleKeys: string[], branchId?: string | null, tx: Tx = db) {
  const ms = await tx.membership.findMany({
    where: { clinicId, active: true, role: { key: { in: roleKeys as never[] } }, user: { status: "ACTIVE" },
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}) },
    select: { userId: true },
  });
  return ms.map((m) => m.userId);
}
