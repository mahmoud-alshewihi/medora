import { AppShell } from "@/components/shell/app-shell";
import { pageRole } from "@/server/auth/page-guard";
export default async function L({ children }: { children: React.ReactNode }) {
  const ctx = await pageRole("SUPER_ADMIN");
  return <AppShell title="platform admin" user={ctx.userName} nav={[{ href: "/platform", key: "platform" }]}>{children}</AppShell>;
}
