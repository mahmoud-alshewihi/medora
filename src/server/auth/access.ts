import { headers } from "next/headers";
import type { RoleKey } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, forbidden, unauthorized } from "@/lib/errors";
import { auth } from "./auth";
import { can, type Permission } from "./permissions";

export interface AccessContext {
  userId: string; userName: string; email: string;
  role: RoleKey; clinicId: string | null; branchId: string | null; membershipId: string;
}

export async function getAccessContext(h?: Headers): Promise<AccessContext | null> {
  const session = await auth.api.getSession({ headers: h ?? (await headers()) });
  if (!session) return null;
  return loadContext(session.user.id, h ?? (await headers()));
}

export async function loadContext(userId: string, h?: Headers): Promise<AccessContext | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") return null;
  const memberships = await db.membership.findMany({
    where: { userId, active: true }, include: { role: true, clinic: { select: { status: true, subscription: true } } },
    orderBy: { createdAt: "asc" },
  });
  const wanted = h?.get("x-clinic-id");
  const m = (wanted && memberships.find((x) => x.clinicId === wanted)) || memberships[0];
  if (!m) return null;
  return { userId, userName: user.name, email: user.email, role: m.role.key, clinicId: m.clinicId, branchId: m.branchId, membershipId: m.id };
}

/** Enforces clinic status + subscription limits for tenant users (not super admins). */
export async function assertClinicUsable(clinicId: string, opts: { write: boolean }) {
  const clinic = await db.clinic.findUnique({ where: { id: clinicId }, include: { subscription: true } });
  if (!clinic) throw new AppError(404, "NOT_FOUND", "Clinic not found");
  if (clinic.status !== "ACTIVE") throw new AppError(403, "CLINIC_SUSPENDED", "This clinic account is suspended");
  const sub = clinic.subscription;
  if (!sub || sub.status === "CANCELLED") throw new AppError(402, "SUBSCRIPTION_INACTIVE", "No active subscription");
  if (sub.expiresAt < new Date() || sub.status === "EXPIRED") {
    if (opts.write) throw new AppError(402, "SUBSCRIPTION_EXPIRED", "Subscription expired: the clinic is read-only until renewed");
  }
}

/**
 * Central server-side gate. Verifies session, active user, permission, and tenant/subscription state.
 * Returns a context whose clinicId must be used in every query.
 */
export async function requireAccess(permission: Permission, opts: { write?: boolean; ctx?: AccessContext | null } = {}): Promise<AccessContext & { clinicId: string }> {
  const ctx = opts.ctx !== undefined ? opts.ctx : await getAccessContext();
  if (!ctx) throw unauthorized();
  if (!can(ctx.role, permission)) throw forbidden();
  if (!ctx.clinicId) throw forbidden("No clinic context");
  await assertClinicUsable(ctx.clinicId, { write: opts.write ?? false });
  return ctx as AccessContext & { clinicId: string };
}

export async function requirePlatformAdmin(ctx?: AccessContext | null) {
  const c = ctx ?? (await getAccessContext());
  if (!c) throw unauthorized();
  if (c.role !== "SUPER_ADMIN") throw forbidden();
  return c;
}

/** Branch restriction helper: returns a Prisma filter fragment for branch-scoped staff. */
export function branchScope(ctx: AccessContext): { branchId?: string } {
  return ctx.branchId ? { branchId: ctx.branchId } : {};
}
export function assertBranchAllowed(ctx: AccessContext, branchId: string | null | undefined) {
  if (ctx.branchId && branchId && ctx.branchId !== branchId) throw forbidden("Outside your branch");
}
