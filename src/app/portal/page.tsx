import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { CancelButton } from "@/components/shell/portal-cancel";
import { Badge, Card } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageRole } from "@/server/auth/page-guard";
import { portalOverview } from "@/server/portal/service";

export const dynamic = "force-dynamic";
export default async function Portal() {
  const ctx = await pageRole("PATIENT");
  const o = await portalOverview({ ...ctx, clinicId: ctx.clinicId! });
  const tz = await clinicTz(ctx.clinicId!);
  return (
    <div className="space-y-5"><h1 className="text-2xl font-semibold">Welcome, {o.patient.fullName}</h1>
      <Card className="p-4"><div className="mb-2 flex items-center justify-between"><h2 className="font-medium">My appointments</h2><Link className="text-sm text-primary underline" href="/portal/book">Book new</Link></div><DataTable head={["When", "Doctor", "Branch", "Status", ""]} rows={o.appointments.map((a) => [fmtLocal(a.startsAt, tz), a.doctor.fullName, a.branch.name, <Badge key={a.id} value={a.status} />, ["PENDING", "CONFIRMED"].includes(a.status) && a.startsAt > new Date() ? <CancelButton key={a.id + "c"} appointmentId={a.id} /> : ""])} /></Card>
      <Card className="p-4"><h2 className="mb-2 font-medium">Invoices</h2><DataTable head={["Number", "Total", "Status"]} rows={o.invoices.map((i) => [i.number, formatMoney(i.total.toString(), i.currency), <Badge key={i.id} value={i.status} />])} /></Card>
      <Card className="p-4"><h2 className="mb-2 font-medium">Prescriptions</h2>{o.prescriptions.length ? <ul className="divide-y text-sm">{o.prescriptions.map((r) => <li key={r.id} className="flex items-center justify-between py-2"><span>{r.number} &middot; {r.doctor.fullName} &middot; {r.items.map((i) => i.medication).join(", ")}</span><Link className="text-primary underline" href={`/print/prescription/${r.id}`}>View / print</Link></li>)}</ul> : <p className="text-sm text-muted-foreground">No prescriptions yet</p>}</Card>
    </div>
  );
}
