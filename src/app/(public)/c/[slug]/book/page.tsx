import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { LocaleToggle, ThemeToggle } from "@/components/shell/toggles";
import { BookingWizard } from "./wizard";

export const dynamic = "force-dynamic";
export default async function Book({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ doctor?: string }> }) {
  const { slug } = await params; const { doctor } = await searchParams;
  const { l, t, dir } = await getT();
  const Arrow = dir === "rtl" ? ArrowRight : ArrowLeft;
  const c = await db.clinic.findFirst({ where: { slug, status: "ACTIVE" }, select: { name: true, nameAr: true, branches: { where: { active: true }, select: { id: true, name: true } }, specialties: { select: { id: true, name: true } },
    doctors: { where: { active: true }, select: { id: true, fullName: true, specialtyId: true, schedules: { select: { branchId: true } } } } } });
  if (!c) notFound();
  const name = l === "ar" && c.nameAr ? c.nameAr : c.name;
  return (
    <main>
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={`/c/${slug}`} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Arrow className="h-4 w-4" />{name}</Link>
          <nav className="flex items-center gap-1"><ThemeToggle /><LocaleToggle current={l} /></nav>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("bookAppointment")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{name}</p>
        <BookingWizard slug={slug} branches={c.branches} specialties={c.specialties} doctors={c.doctors.map((d) => ({ id: d.id, fullName: d.fullName, specialtyId: d.specialtyId, branchIds: [...new Set(d.schedules.map((s) => s.branchId))] }))} presetDoctor={doctor} />
      </div>
    </main>
  );
}
