"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";

interface N { id: string; title: string; body: string; readAt: string | null; createdAt: string; link: string | null }
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ unread: number; rows: N[] }>("/api/notifications?limit=8"), refetchInterval: 20_000 });
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" aria-label="Notifications" onClick={() => setOpen((o) => !o)}><Bell className="h-4 w-4" />{data?.unread ? <span className="rounded-full bg-danger px-1.5 text-xs text-white">{data.unread}</span> : null}</Button>
      {open ? (
        <div className="absolute end-0 z-30 mt-2 w-80 rounded-lg border bg-card p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1"><b className="text-sm">Notifications</b>
            <button className="text-xs text-primary" onClick={async () => { await api("/api/notifications", { method: "POST" }); await qc.invalidateQueries({ queryKey: ["notifications"] }); }}>Mark all as read</button></div>
          <ul className="max-h-72 overflow-auto">
            {data?.rows.length ? data.rows.map((n) => (
              <li key={n.id} className={"rounded px-2 py-2 text-sm " + (n.readAt ? "opacity-60" : "bg-muted/60")}>
                <p className="font-medium">{n.title}</p><p className="text-xs text-muted-foreground">{n.body}</p>
              </li>)) : <li className="p-3 text-sm text-muted-foreground">No notifications</li>}
          </ul>
          <a className="block px-2 py-1 text-xs text-primary" href="/notifications">View history and preferences</a>
        </div>) : null}
    </div>
  );
}
