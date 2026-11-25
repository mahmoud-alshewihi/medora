import { redirect } from "next/navigation";
import type { RoleKey } from "@prisma/client";
import { getAccessContext } from "./access";
import { can, homeFor, type Permission } from "./permissions";
import { assertClinicUsable } from "./access";
import { AppError } from "@/lib/errors";

/** Server-component guard: redirects anonymous users to /login and users lacking the permission to their own home. */
export async function pageAccess(permission: Permission) {
  const ctx = await getAccessContext();
  if (!ctx) redirect("/login");
  if (!can(ctx.role, permission)) redirect(homeFor(ctx.role));
  if (!ctx.clinicId) redirect(homeFor(ctx.role));
  try { await assertClinicUsable(ctx.clinicId, { write: false }); } catch (e) { if (e instanceof AppError) redirect("/login?error=" + e.code); throw e; }
  return ctx as typeof ctx & { clinicId: string };
}
export async function pageRole(role: RoleKey) {
  const ctx = await getAccessContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== role) redirect(homeFor(ctx.role));
  return ctx;
}
