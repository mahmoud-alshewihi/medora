import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getAccessContext } from "@/server/auth/access";
import { homeFor } from "@/server/auth/permissions";

export default async function L({ children }: { children: React.ReactNode }) {
  const ctx = await getAccessContext();
  if (!ctx) redirect("/login");
  const home = homeFor(ctx.role);
  const key = home === "/admin" ? "dashboard" : home.slice(1);
  return <AppShell title={ctx.role.replace(/_/g, " ").toLowerCase()} user={ctx.userName} nav={[{ href: home, key }, { href: "/notifications", key: "notifications" }]}>{children}</AppShell>;
}
