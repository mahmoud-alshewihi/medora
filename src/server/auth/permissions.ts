import type { RoleKey } from "@prisma/client";

export const PERMISSIONS = [
  "platform.manage",
  "clinic.settings", "staff.manage", "audit.view",
  "patient.read", "patient.write", "patient.archive", "patient.import_export",
  "medical.read", "medical.write",
  "appointment.read", "appointment.write", "appointment.checkin", "queue.manage",
  "consultation.write",
  "billing.read", "billing.write", "payment.record", "refund.create", "expense.manage", "cash.close",
  "inventory.read", "inventory.manage", "inventory.adjust",
  "reports.view", "dashboard.view",
  "portal.self",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const all = PERMISSIONS.filter((p) => p !== "platform.manage" && p !== "portal.self");

/**
 * Role -> permission matrix. Single source of truth; seeded into Role/Permission tables for visibility
 * and enforced server-side by `requireAccess`.
 * Note SUPER_ADMIN deliberately has NO patient/medical/billing permissions.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  SUPER_ADMIN: ["platform.manage"],
  CLINIC_OWNER: [...all],
  BRANCH_MANAGER: all.filter((p) => !["clinic.settings", "medical.read", "medical.write", "consultation.write"].includes(p)),
  DOCTOR: ["patient.read", "medical.read", "medical.write", "appointment.read", "appointment.write", "consultation.write", "queue.manage"],
  RECEPTIONIST: ["patient.read", "patient.write", "appointment.read", "appointment.write", "appointment.checkin", "queue.manage", "billing.read", "billing.write", "payment.record"],
  ACCOUNTANT: ["billing.read", "billing.write", "payment.record", "refund.create", "expense.manage", "cash.close", "reports.view", "dashboard.view", "inventory.read"],
  NURSE: ["patient.read", "medical.read", "appointment.read", "appointment.checkin", "queue.manage", "inventory.read"],
  PATIENT: ["portal.self"],
};

export const can = (role: RoleKey, perm: Permission) => ROLE_PERMISSIONS[role].includes(perm);
export const STAFF_ROLES: RoleKey[] = ["CLINIC_OWNER", "BRANCH_MANAGER", "DOCTOR", "RECEPTIONIST", "ACCOUNTANT", "NURSE"];

export function homeFor(role: RoleKey): string {
  switch (role) {
    case "SUPER_ADMIN": return "/platform";
    case "PATIENT": return "/portal";
    case "DOCTOR": return "/doctor";
    case "RECEPTIONIST": case "NURSE": return "/reception";
    default: return "/admin";
  }
}
