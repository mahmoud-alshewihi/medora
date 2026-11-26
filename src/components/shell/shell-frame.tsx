"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Menu as MenuIcon, Search, Activity, Boxes, Building2, CalendarDays, CreditCard, LayoutDashboard, Receipt, Settings, Stethoscope, UserCog, Users, BarChart3, ClipboardList, HeartPulse, CalendarPlus, Bell, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "@/components/t";
import { Button, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/primitives";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle, LocaleToggle, SignOutButton } from "./toggles";
import { CommandPalette } from "./command-palette";
import { Breadcrumbs } from "./breadcrumbs";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, patients: Users, appointments: CalendarDays, reception: ClipboardList, billing: CreditCard, expenses: Receipt, inventory: Boxes,
  reports: BarChart3, staff: UserCog, settings: Settings, doctor: Stethoscope, portal: HeartPulse, book: CalendarPlus, platform: Building2, notifications: Bell,
};

const GROUPS: { label: string; keys: string[] }[] = [
  { label: "", keys: ["dashboard"] },
  { label: "Clinical", keys: ["patients", "appointments", "reception", "doctor", "portal", "book"] },
  { label: "Finance", keys: ["billing", "expenses"] },
  { label: "Operations", keys: ["inventory", "reports", "staff"] },
  { label: "", keys: ["settings", "platform", "notifications"] },
];

export interface ShellItem { href: string; key: string; label: string }

function groupItems(items: ShellItem[]) {
  if (items.length <= 5) return [{ label: "", items }];
  const out: { label: string; items: ShellItem[] }[] = [];
  const used = new Set<string>();
  for (const g of GROUPS) {
    const gi = items.filter((i) => g.keys.includes(i.key) && !used.has(i.key));
    gi.forEach((i) => used.add(i.key));
    if (gi.length) out.push({ label: g.label, items: gi });
  }
  const rest = items.filter((i) => !used.has(i.key));
  if (rest.length) out.push({ label: "", items: rest });
  return out;
}

function NavSection({ items, collapsed }: { items: ShellItem[]; collapsed: boolean }) {
  const path = usePathname();
  const roots = new Set(["/admin", "/doctor", "/portal", "/platform", "/reception"]);
  return (
    <>
      {items.map((n) => {
        const Icon = ICONS[n.key] ?? Activity;
        const active = roots.has(n.href) ? path === n.href : path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} title={collapsed ? n.label : undefined}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-fast",
              collapsed && "lg:justify-center lg:px-0",
              active ? "bg-primary-soft font-semibold text-primary" : "text-foreground/75 hover:bg-muted hover:text-foreground")}>
            {active ? <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-primary" aria-hidden /> : null}
            <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
            <span className={cn("truncate", collapsed && "lg:hidden")}>{n.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function SidebarBody({ items, collapsed, brandTitle }: { items: ShellItem[]; collapsed: boolean; brandTitle: string }) {
  const groups = groupItems(items);
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2.5 px-4 pb-4 pt-5", collapsed && "lg:justify-center lg:px-2")}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-strong text-sm font-bold text-primary-foreground shadow-sm">M</span>
        <div className={cn("min-w-0", collapsed && "lg:hidden")}>
          <p className="truncate text-sm font-bold tracking-tight">Medora</p>
          <p className="truncate text-xs capitalize text-muted-foreground">{brandTitle}</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map((g, gi) => (
          <div key={gi} className="space-y-0.5">
            {g.label ? <p className={cn("px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80", collapsed && "lg:hidden")}><T>{g.label}</T></p> : gi > 0 ? <div className={cn("mx-2 my-1 hidden border-t", collapsed && "lg:block")} /> : null}
            <NavSection items={g.items} collapsed={collapsed} />
          </div>
        ))}
      </nav>
    </div>
  );
}

function ProfileMenu({ userName, roleTitle, signOutLabel }: { userName: string; roleTitle: string; signOutLabel: string }) {
  const initials = userName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-0.5 pe-2 transition-colors hover:bg-muted focus-visible:outline-2" aria-label="Account menu">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-xs font-bold text-white dark:bg-primary-soft dark:text-primary">{initials}</span>
        </button>
      </MenuTrigger>
      <MenuContent>
        <div className="px-2.5 py-2">
          <p className="text-sm font-semibold">{userName}</p>
          <p className="text-xs capitalize text-muted-foreground">{roleTitle}</p>
        </div>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/notifications" className="flex items-center gap-2"><Bell className="h-4 w-4 text-muted-foreground" /><T>Notifications</T></Link>
        </MenuItem>
        <MenuSeparator />
        <div className="px-1 py-0.5"><SignOutButton label={signOutLabel} /></div>
      </MenuContent>
    </Menu>
  );
}

export function ShellFrame({ items, userName, roleTitle, locale, signOutLabel, children }: {
  items: ShellItem[]; userName: string; roleTitle: string; locale: "en" | "ar"; signOutLabel: string; children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const path = usePathname();

  React.useEffect(() => { setCollapsed(localStorage.getItem("medora.sidebar") === "1"); }, []);
  React.useEffect(() => { setMobileOpen(false); }, [path]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => setCollapsed((c) => { localStorage.setItem("medora.sidebar", c ? "0" : "1"); return !c; });

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[auto_1fr]">
      {/* desktop sidebar */}
      <aside className={cn("no-print sticky top-0 hidden h-screen border-e bg-card transition-[width] duration-med ease-smooth lg:block", collapsed ? "w-[68px]" : "w-[248px]")}>
        <SidebarBody items={items} collapsed={collapsed} brandTitle={roleTitle} />
        <button onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -end-3 top-7 z-10 grid h-6 w-6 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground">
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="overlay-in absolute inset-0 bg-navy/50 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <div className="sheet-in absolute inset-y-0 start-0 w-72 border-e bg-card"><SidebarBody items={items} collapsed={false} brandTitle={roleTitle} /></div>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur-md sm:px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}><MenuIcon className="h-5 w-5" /></Button>
          <Breadcrumbs items={items} />
          <div className="flex-1" />
          <button onClick={() => setPaletteOpen(true)}
            className="hidden h-8 items-center gap-2 rounded-md border bg-muted/50 px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex">
            <Search className="h-3.5 w-3.5" /><span className="hidden md:inline"><T>Search</T></span>
            <kbd className="hidden rounded border bg-card px-1 text-[10px] font-semibold md:inline">⌘K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search" onClick={() => setPaletteOpen(true)}><Search className="h-4 w-4" /></Button>
          <NotificationBell />
          <ThemeToggle />
          <LocaleToggle current={locale} />
          <ProfileMenu userName={userName} roleTitle={roleTitle} signOutLabel={signOutLabel} />
        </header>
        <main className="fade-in mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={items} />
    </div>
  );
}
