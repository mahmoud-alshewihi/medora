import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { redact } from "@/lib/logger";

export async function audit(
  entry: { clinicId?: string | null; userId?: string | null; action: string; entity: string; entityId?: string; metadata?: Record<string, unknown>; ip?: string | null },
  tx: PrismaClient | Prisma.TransactionClient = db,
) {
  await tx.auditLog.create({
    data: { clinicId: entry.clinicId ?? null, userId: entry.userId ?? null, action: entry.action, entity: entry.entity,
      entityId: entry.entityId, metadata: entry.metadata ? (redact(entry.metadata) as Prisma.InputJsonValue) : undefined, ip: entry.ip ?? null },
  });
}
