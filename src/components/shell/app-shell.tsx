import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { Key } from "@/lib/i18n/dict";
import { LocaleToggle, SignOutButton, ThemeToggle } from "./toggles";
import { NotificationBell } from "./notification-bell";

export interface NavItem { href: string; key: Key | string }
export async function AppShell({ nav, title, user, children }: { nav: NavItem[]; title: string; user: string; children: React.ReactNode }) {
  const { l, t } = await getT();
  const label = (k: string) => (k in ({} as Record<string, never>) ? k : (() => { try { return t(k as Key) ?? k; } catch { return k; } })());
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="no-print border-e bg-card lg:min-h-screen">
        <div className="flex items-center gap-2 px-4 py-4"><span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">M</span><div><p className="text-sm font-semibold leading-none">Medora</p><p className="text-xs text-muted-foreground">{title}</p></div></div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible">
          {nav.map((n) => <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-muted">{label(n.key as string)}</Link>)}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="no-print flex items-center justify-between border-b bg-card px-4 py-2">
          <span className="text-sm text-muted-foreground">{user}</span>
          <div className="flex items-center gap-1"><NotificationBell /><LocaleToggle current={l} /><ThemeToggle /><SignOutButton label={t("signOut")} /></div>
        </header>
        <main className="fade-in mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
