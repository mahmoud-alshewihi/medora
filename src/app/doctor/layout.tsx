import { AppShell } from "@/components/shell/app-shell";
import { pageRole } from "@/server/auth/page-guard";
export default async function L({ children }: { children: React.ReactNode }) {
  const ctx = await pageRole("DOCTOR");
  return <AppShell title="doctor" user={ctx.userName} nav={[{ href: "/doctor", key: "doctor" }]}>{children}</AppShell>;
}
