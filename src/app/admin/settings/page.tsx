import { db } from "@/lib/db";
import { SettingsForm } from "@/components/shell/settings-form";
import { pageAccess } from "@/server/auth/page-guard";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const ctx = await pageAccess("clinic.settings");
  const c = await db.clinic.findUniqueOrThrow({ where: { id: ctx.clinicId } });
  return <div className="space-y-4"><h1 className="text-2xl font-semibold">Clinic settings</h1><SettingsForm c={c} /></div>;
}
