import Link from "next/link";
import { ArrowLeft, ArrowRight, Award, CalendarCheck, Clock, Stethoscope } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { Card } from "@/components/ui/primitives";
import { LocaleToggle, ThemeToggle } from "@/components/shell/toggles";

export const dynamic = "force-dynamic";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default async function DoctorProfile({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { l, t, dir } = await getT();
  const Arrow = dir === "rtl" ? ArrowRight : ArrowLeft;
  const clinic = await db.clinic.findFirst({ where: { slug, status: "ACTIVE" } });
  if (!clinic) notFound();
  const d = await db.doctor.findFirst({ where: { id, clinicId: clinic.id, active: true }, include: { specialty: true, schedules: { include: { branch: { select: { name: true } } }, orderBy: { weekday: "asc" } } } });
  if (!d) notFound();
  const name = l === "ar" && clinic.nameAr ? clinic.nameAr : clinic.name;
  const initials = d.fullName.replace(/^Dr\.?\s*/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <main>
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={`/c/${slug}`} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Arrow className="h-4 w-4" />{name}</Link>
          <nav className="flex items-center gap-1"><ThemeToggle /><LocaleToggle current={l} /></nav>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start gap-5">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-primary-soft text-2xl font-bold text-primary">{initials}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{d.fullName}</h1>
            <p className="mt-1 flex items-center gap-1.5 font-medium text-primary"><Stethoscope className="h-4 w-4" />{d.specialty.name}</p>
            {d.bio ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{d.bio}</p> : null}
          </div>
          <Link href={`/c/${slug}/book?doctor=${d.id}`} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-strong"><CalendarCheck className="h-4 w-4" />{t("bookWith")} {d.fullName}</Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Award className="h-3.5 w-3.5" />{t("qualifications")}</p><p className="mt-1 text-sm font-semibold">{d.qualifications ?? "-"}</p></Card>
          <Card className="p-4"><p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock className="h-3.5 w-3.5" />{t("experienceYears")}</p><p className="tnum mt-1 text-sm font-semibold">{d.yearsExperience}</p></Card>
          <Card className="p-4"><p className="text-xs font-medium text-muted-foreground">{t("consultationFee")}</p><p className="tnum mt-1 text-sm font-semibold text-primary">{formatMoney(d.consultationFee.toString(), clinic.currency)}</p></Card>
        </div>

        <section>
          <h2 className="text-xl font-bold tracking-tight">{t("availability")}</h2>
          <Card className="mt-4">
            <ul className="divide-y text-sm">
              {d.schedules.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="font-medium">{DAYS[s.weekday]}</span>
                  <span className="tnum text-muted-foreground">{s.startTime} - {s.endTime} &middot; {s.branch.name}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </main>
  );
}
