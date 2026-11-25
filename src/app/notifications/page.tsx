import Link from "next/link";
import { db } from "@/lib/db";
import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { Card, EmptyState } from "@/components/ui/primitives";
import { MarkAllRead } from "@/components/shell/mark-read";
import { getAccessContext } from "@/server/auth/access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function NotificationsPage() {
  const ctx = await getAccessContext();
  if (!ctx || !ctx.clinicId) redirect("/login");
  const [rows, tz] = await Promise.all([db.notification.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 100 }), clinicTz(ctx.clinicId)]);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">Notifications</h1><p className="text-sm text-muted-foreground">{unread} unread. Delivery is in-app only unless an email provider is configured.</p></div><MarkAllRead disabled={unread === 0} /></div>
      {rows.length === 0 ? <EmptyState title="No notifications yet" /> : (
        <ul className="space-y-2">{rows.map((n) => (
          <li key={n.id}><Card className={"p-3 " + (n.readAt ? "" : "border-primary/50")}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{!n.readAt && <span className="me-2 inline-block h-2 w-2 rounded-full bg-primary" aria-label="unread" />}{n.title}</p><p className="text-sm text-muted-foreground">{n.body}</p>{n.link && <Link className="text-xs text-primary underline" href={n.link}>Open</Link>}</div><span className="shrink-0 text-xs text-muted-foreground">{fmtLocal(n.createdAt, tz)}</span></div></Card></li>))}</ul>)}
    </div>
  );
}
