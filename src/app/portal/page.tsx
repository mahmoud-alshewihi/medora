import { clinicTz, fmtLocal } from "@/lib/clinic-time";
import { formatMoney } from "@/lib/money";
import { CalendarPlus, ClipboardList, Pill, Receipt } from "lucide-react";
import Link from "next/link";
import { RescheduleButton } from "@/components/shell/portal-reschedule";
import { db } from "@/lib/db";
import { CancelButton } from "@/components/shell/portal-cancel";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageRole } from "@/server/auth/page-guard";
import { portalOverview } from "@/server/portal/service";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
export default async function Portal() {
  const ctx = await pageRole("PATIENT");
  const o = await portalOverview({ ...ctx, clinicId: ctx.clinicId! });
  const tz = await clinicTz(ctx.clinicId!);
  const { slug } = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId! }, select: { slug: true } });
  const firstName = o.patient.fullName.split(/\s+/)[0];
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-l from-primary to-primary/70 p-6 text-white shadow-md sm:p-8">
        <div className="relative z-10 space-y-3">
          <h1 className="text-2xl font-bold sm:text-3xl"><T>Welcome</T>, {firstName}</h1>
          <p className="max-w-md text-sm text-white/80"><T>Your appointments, invoices and prescriptions in one place.</T></p>
          <Link href="/portal/book" className="inline-flex h-10 select-none items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-primary shadow-sm transition-all hover:bg-white/90 active:scale-[0.98]"><CalendarPlus className="h-4 w-4" /><T>Book an appointment</T></Link>
        </div>
        <CalendarPlus className="pointer-events-none absolute -bottom-8 -end-8 h-44 w-44 text-white/10" aria-hidden />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ClipboardList className="h-3.5 w-3.5" /><T>Appointments</T></p><p className="tnum mt-1 text-xl font-bold">{o.appointments.length}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Receipt className="h-3.5 w-3.5" /><T>Invoices</T></p><p className="tnum mt-1 text-xl font-bold">{o.invoices.length}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Pill className="h-3.5 w-3.5" /><T>Prescriptions</T></p><p className="tnum mt-1 text-xl font-bold">{o.prescriptions.length}</p></div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between"><CardTitle><T>My appointments</T></CardTitle><Link className="text-sm font-medium text-primary hover:underline" href="/portal/book"><T>Book new</T></Link></CardHeader>
        <CardContent>
          <DataTable head={["When", "Doctor", "Branch", "Status", ""]} empty="No appointments yet"
            rows={o.appointments.map((a) => [<span key="w" className="tnum">{fmtLocal(a.startsAt, tz)}</span>, a.doctor.fullName, a.branch.name, <Badge key={a.id} value={a.status} />, ["PENDING", "CONFIRMED"].includes(a.status) && a.startsAt > new Date() ? <span key={a.id + "c"} className="flex flex-wrap items-start gap-2"><RescheduleButton appointmentId={a.id} slug={slug} doctorId={a.doctorId} branchId={a.branchId} /><CancelButton appointmentId={a.id} /></span> : ""])} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><T>Invoices</T></CardTitle></CardHeader>
          <CardContent>
            <DataTable head={["Number", "Total", "Status"]} empty="No invoices"
              rows={o.invoices.map((i) => [<span key="n" className="tnum font-medium">{i.number}</span>, <span key="t" className="tnum">{formatMoney(i.total.toString(), i.currency)}</span>, <Badge key={i.id} value={i.status} />])} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><T>Prescriptions</T></CardTitle></CardHeader>
          <CardContent>
            {o.prescriptions.length ? (
              <ul className="divide-y">
                {o.prescriptions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 text-sm"><span className="tnum font-medium">{r.number}</span><span className="text-muted-foreground"> &middot; {r.doctor.fullName}</span><span className="block truncate text-muted-foreground">{r.items.map((i) => i.medication).join(", ")}</span></span>
                    <Link className="shrink-0 text-sm font-medium text-primary hover:underline" href={`/print/prescription/${r.id}`}><T>View / print</T></Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground"><T>No prescriptions yet</T></p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
