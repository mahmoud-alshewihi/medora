import { EmptyState } from "@/components/ui/primitives";
export function DataTable({ head, rows, empty = "Nothing here yet" }: { head: string[]; rows: React.ReactNode[][]; empty?: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-start text-xs uppercase text-muted-foreground"><tr>{head.map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
      <tbody className="divide-y">{rows.map((r, i) => <tr key={i} className="hover:bg-muted/30">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}</tbody></table></div>
  );
}
