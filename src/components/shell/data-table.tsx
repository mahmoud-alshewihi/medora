"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { T, useTx } from "@/components/t";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Menu, MenuTrigger, MenuContent } from "@/components/ui/primitives";

export interface Col { key: string; label: string; sortable?: boolean; hideable?: boolean }

export function DataTable({ head, rows, empty = "Nothing here yet", page, total, pageSize, toolbar, rowKey, searchable }: {
  head: (string | Col)[];
  rows: React.ReactNode[][];
  empty?: string;
  page?: number; total?: number; pageSize?: number;
  toolbar?: React.ReactNode;
  rowKey?: (i: number) => string;
  searchable?: boolean;
}) {
  const cols: Col[] = head.map((h, i) => (typeof h === "string" ? { key: `c${i}`, label: h } : h));
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tx = useTx();
  const [pending, start] = React.useTransition();
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [q, setQ] = React.useState(sp.get("q") ?? "");

  const go = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    start(() => router.push(`${pathname}?${p.toString()}`));
  };
  const sort = sp.get("sort"); const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const toggleSort = (key: string) => go((p) => {
    if (sort !== key) { p.set("sort", key); p.set("dir", "asc"); }
    else if (dir === "asc") { p.set("dir", "desc"); }
    else { p.delete("sort"); p.delete("dir"); }
    p.delete("page");
  });
  const visible = cols.filter((c) => !hidden.has(c.key));
  const pages = total && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const cur = page ?? 1;

  return (
    <div className="space-y-3">
      {/* toolbar: search + column visibility + page-supplied filters */}
      <div className="flex flex-wrap items-center gap-2">
        {searchable ? (
        <form
          className="relative min-w-52 flex-1 sm:max-w-xs"
          onSubmit={(e) => { e.preventDefault(); go((p) => { q ? p.set("q", q) : p.delete("q"); p.delete("page"); }); }}
        >
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={tx("Search")}
            className="h-9 w-full rounded-md border border-input bg-card ps-9 pe-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
          />
        </form>
        ) : null}
        {toolbar}
        {cols.some((c) => c.hideable !== false) && cols.length > 3 ? (
          <Menu>
            <MenuTrigger asChild><Button variant="outline" size="sm"><Columns3 className="h-3.5 w-3.5" /><T>Columns</T></Button></MenuTrigger>
            <MenuContent>
              {cols.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={!hidden.has(c.key)}
                    onChange={() => setHidden((h) => { const n = new Set(h); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; })} />
                  {tx(c.label)}
                </label>
              ))}
            </MenuContent>
          </Menu>
        ) : null}
      </div>

      {/* desktop table */}
      <div className={cn("relative overflow-x-auto rounded-xl border bg-card shadow-xs", pending && "opacity-60")} aria-busy={pending}>
        <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b bg-muted/40">
              {visible.map((c) => (
                <th key={c.key} className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.sortable ? (
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {tx(c.label)}
                      {sort === c.key ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  ) : tx(c.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={rowKey ? rowKey(i) : i} className="transition-colors hover:bg-muted/40">
                {r.filter((_, j) => !hidden.has(cols[j].key)).map((c, j) => <td key={j} className="px-4 py-3 align-middle">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {/* mobile: stacked cards with column labels */}
        <ul className="divide-y sm:hidden">
          {rows.map((r, i) => (
            <li key={rowKey ? rowKey(i) : i} className="space-y-1.5 px-4 py-3">
              {r.map((c, j) => hidden.has(cols[j].key) ? null : (
                <div key={j} className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tx(cols[j].label)}</span>
                  <span className="text-end">{c}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
        {!rows.length ? <div className="p-4"><EmptyState title={empty} /></div> : null}
        {pending ? <div className="absolute inset-0 grid place-items-center"><Skeleton className="h-6 w-40" /></div> : null}
      </div>

      {/* pagination */}
      {total !== undefined ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="tnum text-xs">{total.toLocaleString()} <T>results</T> · <T>Page</T> {cur} / {pages}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={cur <= 1 || pending} onClick={() => go((p) => p.set("page", String(cur - 1)))}>
              <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" /><T>Previous</T>
            </Button>
            <Button variant="outline" size="sm" disabled={cur >= pages || pending} onClick={() => go((p) => p.set("page", String(cur + 1)))}>
              <T>Next</T><ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
