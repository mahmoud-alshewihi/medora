import { T } from "@/components/t";
import { PageTitle } from "@/components/shell/page-title";
import Link from "next/link";
import { Button, Input } from "@/components/ui/primitives";
import { DataTable } from "@/components/shell/data-table";
import { pageAccess } from "@/server/auth/page-guard";
import { PatientImport } from "@/components/shell/patient-ui";
import { can } from "@/server/auth/permissions";
import { getLocale } from "@/lib/i18n/server";
import { searchPatients } from "@/server/patients/service";

export const dynamic = "force-dynamic";
export default async function PatientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await pageAccess("patient.read"); const sp = await searchParams;
  const loc = await getLocale();
  const page = Math.max(1, Number(sp.page) || 1);
  const r = await searchPatients(ctx.clinicId, { q: sp.q, page, pageSize: 20, sort: "createdAt", dir: "desc", archived: "false" });
  return (
    <div className="space-y-4"><PageTitle>Patients</PageTitle>
      {can(ctx.role, "patient.import_export") && <PatientImport />}
      <form className="flex gap-2"><Input name="q" defaultValue={sp.q} placeholder={loc === "ar" ? "ابحث بالاسم أو الهاتف أو رقم الملف" : "Search name, phone, MRN"} className="max-w-xs" /><Button type="submit"><T>Search</T></Button><Link className="text-sm underline self-center" href="/api/patients/export" prefetch={false}><T>Export CSV</T></Link></form>
      <DataTable head={["MRN", "Name", "Gender", "Phone", "Email"]} rows={r.rows.map((p) => [p.mrn, <Link key={p.id} className="text-primary underline" href={`/admin/patients/${p.id}`}>{p.fullName}</Link>, <T key={p.id + "g"}>{String(p.gender)}</T>, p.phone, p.email ?? "-"])} />
      <div className="flex items-center gap-3 text-sm"><span>{r.total} patients</span>{page > 1 && <Link href={`?q=${sp.q ?? ""}&page=${page - 1}`}>Previous</Link>}{page * 20 < r.total && <Link href={`?q=${sp.q ?? ""}&page=${page + 1}`}>Next</Link>}</div>
    </div>
  );
}
