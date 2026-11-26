import Link from "next/link";
import { Download, MoreHorizontal, UserRound } from "lucide-react";
import { PageTitle } from "@/components/shell/page-title";
import { Button, Badge, Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { PatientImport } from "@/components/shell/patient-ui";
import { pageAccess } from "@/server/auth/page-guard";
import { can } from "@/server/auth/permissions";
import { getLocale } from "@/lib/i18n/server";
import { searchPatients } from "@/server/patients/service";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";
const AVATAR_TONES = ["bg-primary-soft text-primary", "bg-info-soft text-info", "bg-warn-soft text-warn", "bg-success-soft text-success", "bg-danger-soft text-danger"];

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const tone = AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${tone}`}>{initials}</span>;
}

export default async function PatientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("patient.read"); const sp = await searchParams;
  const loc = await getLocale();
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = (["fullName", "createdAt", "mrn"].includes(sp.sort ?? "") ? sp.sort : "createdAt") as "fullName" | "createdAt" | "mrn";
  const dir = sp.dir === "asc" ? "asc" as const : "desc" as const;
  const gender = (["MALE", "FEMALE", "OTHER"].includes(sp.gender ?? "") ? sp.gender : undefined) as "MALE" | "FEMALE" | "OTHER" | undefined;
  const r = await searchPatients(ctx.clinicId, { q: sp.q, page, pageSize: 20, sort, dir, archived: "false", gender });
  const dateFmt = new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Patients</PageTitle>
        <div className="flex items-center gap-2">
          {can(ctx.role, "patient.import_export") && <PatientImport />}
          <Link href="/api/patients/export" prefetch={false} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-[13px] font-medium shadow-xs transition-colors hover:bg-muted">
            <Download className="h-3.5 w-3.5 text-muted-foreground" /><T>Export CSV</T>
          </Link>
        </div>
      </div>
      <DataTable
        head={[
          { key: "fullName", label: "Patient", sortable: true },
          { key: "mrn", label: "MRN", sortable: true },
          { key: "gender", label: "Gender" },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "createdAt", label: "Registered", sortable: true },
          { key: "actions", label: "", hideable: false },
        ]}
        toolbar={
          <form className="flex gap-1.5">
            {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
            <select name="gender" defaultValue={gender ?? ""} className="h-8 rounded-md border border-input bg-card px-2 text-[13px] shadow-xs">
              <option value="">{loc === "ar" ? "كل الأنواع" : "All genders"}</option>
              <option value="MALE">{loc === "ar" ? "ذكر" : "Male"}</option>
              <option value="FEMALE">{loc === "ar" ? "أنثى" : "Female"}</option>
              <option value="OTHER">{loc === "ar" ? "أخرى" : "Other"}</option>
            </select>
            <Button type="submit" size="sm" variant="soft"><T>Apply</T></Button>
          </form>
        }
        searchable
        page={page} total={r.total} pageSize={20}
        empty={loc === "ar" ? "لا يوجد مرضى مطابقون" : "No matching patients"}
        rows={r.rows.map((p) => [
          <Link key="n" href={`/admin/patients/${p.id}`} className="flex items-center gap-2.5 font-medium text-foreground transition-colors hover:text-primary">
            <Avatar name={p.fullName} /><span className="truncate">{p.fullName}</span>
          </Link>,
          <span key="m" className="tnum text-muted-foreground">{p.mrn}</span>,
          p.gender ? <Badge key="g" value={String(p.gender)} /> : <span key="g" className="text-muted-foreground">—</span>,
          <span key="p" dir="ltr" className="tnum">{p.phone}</span>,
          <span key="e" className="text-muted-foreground">{p.email ?? "—"}</span>,
          <span key="d" className="tnum text-muted-foreground">{dateFmt.format(p.createdAt)}</span>,
          <Menu key="a">
            <MenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions"><MoreHorizontal className="h-4 w-4" /></Button></MenuTrigger>
            <MenuContent>
              <MenuItem asChild><Link href={`/admin/patients/${p.id}`} className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" /><T>Open profile</T></Link></MenuItem>
            </MenuContent>
          </Menu>,
        ])}
      />
    </div>
  );
}
