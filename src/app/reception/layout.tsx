import { AppShell } from "@/components/shell/app-shell";
import { pageAccess } from "@/server/auth/page-guard";
export default async function L({ children }: { children: React.ReactNode }) {
  const ctx = await pageAccess("queue.manage");
  return <AppShell title="reception" user={ctx.userName} nav={[{ href: "/reception", key: "reception" }, { href: "/admin/appointments", key: "appointments" }, { href: "/admin/patients", key: "patients" }]}>{children}</AppShell>;
}
