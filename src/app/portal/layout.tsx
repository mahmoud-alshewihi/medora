import { AppShell } from "@/components/shell/app-shell";
import { pageRole } from "@/server/auth/page-guard";
export default async function L({ children }: { children: React.ReactNode }) {
  const ctx = await pageRole("PATIENT");
  return <AppShell title="patient portal" user={ctx.userName} nav={[{ href: "/portal", key: "portal" }]}>{children}</AppShell>;
}
