import { db } from "@/lib/db";
import { Badge, Input, Button } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageAccess } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";
export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("appointment.read"); const sp = await searchParams;
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : new Date().toISOString().slice(0, 10);
  const start = new Date(day + "T00:00:00Z"); const end = new Date(start.getTime() + 7 * 864e5);
  const rows = await db.appointment.findMany({ where: { clinicId: ctx.clinicId, startsAt: { gte: start, lt: end }, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) }, include: { patient: true, doctor: true, branch: true }, orderBy: { startsAt: "asc" }, take: 300 });
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Appointments (7 days from {day})</h1>
      <form className="flex gap-2"><Input type="date" name="date" defaultValue={day} className="w-44" /><Button type="submit">Go</Button></form>
      <DataTable head={["Time (UTC)", "Patient", "Doctor", "Branch", "Status"]} rows={rows.map((a) => [a.startsAt.toISOString().slice(0, 16).replace("T", " "), a.patient.fullName, a.doctor.fullName, a.branch.name, <Badge key={a.id} value={a.status} />])} />
    </div>
  );
}
