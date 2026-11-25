import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageRole } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";
export default async function Platform() {
  await pageRole("SUPER_ADMIN");
  const clinics = await db.clinic.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-4"><h1 className="text-2xl font-semibold">Clinics</h1>
      <DataTable head={["Clinic", "Slug", "Status"]} rows={clinics.map((c) => [c.name, c.slug, <Badge key={c.id} value={c.status} />])} />
      <p className="text-sm text-muted-foreground">Platform admins never see patient clinical data. Suspend/plan changes use /api/platform/clinics.</p>
    </div>
  );
}
