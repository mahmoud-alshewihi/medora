"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight, Home } from "lucide-react";
import { useTx } from "@/components/t";
import type { ShellItem } from "./shell-frame";

const PRETTY: Record<string, string> = {
  admin: "Dashboard", doctor: "My day", portal: "My portal", platform: "Clinics", reception: "Reception", notifications: "Notifications",
  patients: "Patients", appointments: "Appointments", billing: "Billing", expenses: "Expenses", inventory: "Inventory", reports: "Reports",
  staff: "Staff", settings: "Settings", book: "Book appointment", consult: "Consultation", new: "New",
};

export function Breadcrumbs({ items }: { items: ShellItem[] }) {
  const path = usePathname();
  const tx = useTx();
  const segs = path.split("/").filter(Boolean);
  if (!segs.length) return null;
  const home = items[0]?.href ?? "/";
  const crumbs = segs.map((s, i) => {
    const href = "/" + segs.slice(0, i + 1).join("/");
    const label = PRETTY[s] ?? (s.length > 18 ? "Details" : s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " "));
    return { href, label };
  });
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-[13px] text-muted-foreground sm:flex">
      <Link href={home} className="rounded p-1 transition-colors hover:bg-muted hover:text-foreground" aria-label="Home"><Home className="h-4 w-4" /></Link>
      {crumbs.map((c, i) => (
        <Fragment key={c.href}>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 rtl:-scale-x-100" aria-hidden />
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground" aria-current="page">{tx(c.label)}</span>
          ) : (
            <Link href={c.href} className="rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground">{tx(c.label)}</Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
