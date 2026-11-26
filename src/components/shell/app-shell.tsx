import { getT } from "@/lib/i18n/server";
import type { Key } from "@/lib/i18n/dict";
import { ShellFrame } from "./shell-frame";

export interface NavItem { href: string; key: Key | string }
export async function AppShell({ nav, title, user, children }: { nav: NavItem[]; title: string; user: string; children: React.ReactNode }) {
  const { l, t } = await getT();
  const label = (k: string) => { try { return t(k as Key) ?? k; } catch { return k; } };
  return (
    <ShellFrame
      items={nav.map((n) => ({ href: n.href, key: n.key as string, label: label(n.key as string) }))}
      userName={user}
      roleTitle={title}
      locale={l}
      signOutLabel={t("signOut")}
    >
      {children}
    </ShellFrame>
  );
}
