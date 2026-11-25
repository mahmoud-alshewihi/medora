import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { pageRole } from "@/server/auth/page-guard";
import { doctorFor } from "@/server/clinical/service";

export const dynamic = "force-dynamic";
export default async function DoctorHome() {
  const ctx = await pageRole("DOCTOR");
  const doctor = await doctorFor({ ...ctx, clinicId: ctx.clinicId! });
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const rows = await db.appointment.findMany({ where: { doctorId: doctor.id, startsAt: { gte: start, lt: new Date(start.getTime() + 864e5) } }, include: { patient: true }, orderBy: { startsAt: "asc" } });
  return (
    <div className="space-y-4"><AutoRefresh seconds={30} /><h1 className="text-2xl font-semibold">My day</h1>
      <DataTable empty="No appointments today" head={["Time (UTC)", "Patient", "Status", ""]} rows={rows.map((a) => [a.startsAt.toISOString().slice(11, 16), a.patient.fullName, <Badge key={a.id} value={a.status} />, <Link key={a.id + "c"} className="text-primary underline" href={`/doctor/consult/${a.id}`}>Open</Link>])} />
      <p className="text-sm text-muted-foreground">Open an appointment to run the consultation, prescribe and complete it.</p>
    </div>
  );
}
