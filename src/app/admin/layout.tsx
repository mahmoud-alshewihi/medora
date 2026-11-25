import { AppShell } from "@/components/shell/app-shell";
import { can } from "@/server/auth/permissions";
import { getAccessContext } from "@/server/auth/access";
import { redirect } from "next/navigation";
import { homeFor } from "@/server/auth/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAccessContext();
  if (!ctx) redirect("/login");
  if (!ctx.clinicId || ["PATIENT", "SUPER_ADMIN", "DOCTOR"].includes(ctx.role)) redirect(homeFor(ctx.role));
  const items = [
    { href: "/admin", key: "dashboard", p: "dashboard.view" }, { href: "/admin/patients", key: "patients", p: "patient.read" }, { href: "/admin/appointments", key: "appointments", p: "appointment.read" },
    { href: "/reception", key: "reception", p: "queue.manage" }, { href: "/admin/billing", key: "billing", p: "billing.read" }, { href: "/admin/expenses", key: "expenses", p: "expense.manage" },
    { href: "/admin/inventory", key: "inventory", p: "inventory.read" }, { href: "/admin/reports", key: "reports", p: "reports.view" }, { href: "/admin/staff", key: "staff", p: "staff.manage" }, { href: "/admin/settings", key: "settings", p: "clinic.settings" },
  ] as const;
  return <AppShell title={ctx.role.replace(/_/g, " ").toLowerCase()} user={ctx.userName} nav={items.filter((i) => can(ctx.role, i.p)).map(({ href, key }) => ({ href, key }))}>{children}</AppShell>;
}
