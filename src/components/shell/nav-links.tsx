"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Boxes, Building2, CalendarDays, CreditCard, LayoutDashboard, Receipt, Settings, Stethoscope, UserCog, Users, BarChart3, ClipboardList, HeartPulse, CalendarPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, patients: Users, appointments: CalendarDays, reception: ClipboardList, billing: CreditCard, expenses: Receipt, inventory: Boxes,
  reports: BarChart3, staff: UserCog, settings: Settings, doctor: Stethoscope, portal: HeartPulse, book: CalendarPlus, platform: Building2,
};
export function NavLinks({ items }: { items: { href: string; key: string; label: string }[] }) {
  const path = usePathname();
  const roots = new Set(["/admin", "/doctor", "/portal", "/platform", "/reception"]);
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible">
      {items.map((n) => {
        const Icon = ICONS[n.key] ?? Activity;
        const active = roots.has(n.href) ? path === n.href : path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-primary text-primary-foreground font-medium" : "text-foreground/80 hover:bg-muted")}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />{n.label}
          </Link>
        );
      })}
    </nav>
  );
}
