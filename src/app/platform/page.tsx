import { PageTitle } from "@/components/shell/page-title";
import { db } from "@/lib/db";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { Building2, PauseCircle, PlayCircle } from "lucide-react";
import { pageRole } from "@/server/auth/page-guard";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
export default async function Platform() {
  await pageRole("SUPER_ADMIN");
  const clinics = await db.clinic.findMany({ orderBy: { name: "asc" } });
  const active = clinics.filter((c) => c.status === "ACTIVE").length;
  return (
    <div className="space-y-4">
      <PageTitle>Clinics</PageTitle>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Building2 className="h-3.5 w-3.5" /><T>Total clinics</T></p><p className="tnum mt-1 text-xl font-bold">{clinics.length}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><PlayCircle className="h-3.5 w-3.5" /><T>Active</T></p><p className="tnum mt-1 text-xl font-bold">{active}</p></div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-xs"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><PauseCircle className="h-3.5 w-3.5" /><T>Suspended</T></p><p className="tnum mt-1 text-xl font-bold">{clinics.length - active}</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle><T>All clinics</T></CardTitle></CardHeader>
        <CardContent>
          <DataTable
            head={["Clinic", "Slug", "Status"]}
            empty="No clinics"
            rows={clinics.map((c) => [
              <span key="n" className="font-medium">{c.name}</span>,
              <span key="s" className="tnum text-muted-foreground">{c.slug}</span>,
              <Badge key={c.id} value={c.status} />,
            ])}
          />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground"><T>Platform admins never see patient clinical data. Suspend/plan changes use /api/platform/clinics.</T></p>
    </div>
  );
}
