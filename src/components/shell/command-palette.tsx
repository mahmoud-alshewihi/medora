"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { T, useTx } from "@/components/t";
import { api } from "@/lib/api-client";
import type { ShellItem } from "./shell-frame";

interface PatientHit { id: string; fullName: string; mrn: string; phone: string }

export function CommandPalette({ open, onOpenChange, items }: { open: boolean; onOpenChange: (o: boolean) => void; items: ShellItem[] }) {
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [patients, setPatients] = React.useState<PatientHit[]>([]);
  const router = useRouter();
  const tx = useTx();

  const navHits = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => i.label.toLowerCase().includes(needle) || i.key.includes(needle));
  }, [q, items]);

  React.useEffect(() => {
    if (!open) { setQ(""); setPatients([]); setActive(0); }
  }, [open]);

  React.useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) { setPatients([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api<{ rows: PatientHit[] }>(`/api/patients?q=${encodeURIComponent(needle)}&pageSize=5`)
        .then((r) => setPatients(r.rows.slice(0, 5)))
        .catch(() => setPatients([])); // roles without patient.read simply see no patient hits
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const total = navHits.length + patients.length;
  const go = (href: string) => { onOpenChange(false); router.push(href); };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-in fixed inset-0 z-40 bg-navy/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-lg -translate-x-1/2 rounded-xl border bg-card shadow-xl">
          <Dialog.Title className="sr-only">{tx("Search")}</Dialog.Title>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, total - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (active < navHits.length && navHits[active]) go(navHits[active].href);
                  else if (patients[active - navHits.length]) go(`/admin/patients/${patients[active - navHits.length].id}`);
                }
              }}
              placeholder={tx("Search pages and patients…")}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {navHits.length ? (
              <>
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80"><T>Pages</T></p>
                {navHits.map((n, i) => (
                  <button key={n.href} onClick={() => go(n.href)} onMouseEnter={() => setActive(i)}
                    className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm", i === active ? "bg-primary-soft text-primary" : "text-foreground/85")}>
                    <span>{n.label}</span>
                    {i === active ? <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                  </button>
                ))}
              </>
            ) : null}
            {patients.length ? (
              <>
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80"><T>Patients</T></p>
                {patients.map((p, i) => {
                  const idx = navHits.length + i;
                  return (
                    <button key={p.id} onClick={() => go(`/admin/patients/${p.id}`)} onMouseEnter={() => setActive(idx)}
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm", idx === active ? "bg-primary-soft text-primary" : "text-foreground/85")}>
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{p.fullName}</span>
                      <span className="text-xs text-muted-foreground">{p.mrn} · {p.phone}</span>
                    </button>
                  );
                })}
              </>
            ) : null}
            {!total ? <p className="px-2.5 py-8 text-center text-sm text-muted-foreground"><T>No results</T></p> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
