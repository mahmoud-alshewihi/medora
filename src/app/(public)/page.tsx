import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CalendarCheck, CreditCard, Stethoscope } from "lucide-react";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { Card } from "@/components/ui/primitives";
import { LocaleToggle, ThemeToggle } from "@/components/shell/toggles";

export const dynamic = "force-dynamic";
export default async function Landing() {
  const { l, t, dir } = await getT();
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const clinics = await db.clinic.findMany({ where: { status: "ACTIVE" }, select: { slug: true, name: true, nameAr: true, description: true, _count: { select: { branches: true, doctors: true } } } });
  const features = [
    { icon: CalendarCheck, title: t("landingFeatureBooking"), desc: t("landingFeatureBookingDesc") },
    { icon: Stethoscope, title: t("landingFeatureOps"), desc: t("landingFeatureOpsDesc") },
    { icon: CreditCard, title: t("landingFeatureMoney"), desc: t("landingFeatureMoneyDesc") },
  ];
  return (
    <main>
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-white">M</span>{t("appName")}</span>
          <nav className="flex items-center gap-1 text-sm">
            <ThemeToggle /><LocaleToggle current={l} />
            <Link className="rounded-md px-3 py-2 font-medium hover:bg-muted" href="/login">{t("signIn")}</Link>
            <Link className="hidden rounded-md bg-primary px-3.5 py-2 font-medium text-primary-foreground shadow-xs hover:bg-primary-strong sm:inline-block" href="/register">{t("register")}</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-navy text-white" style={{ background: "hsl(218 56% 12%)" }}>
        <div className="absolute inset-0 opacity-25"><img src="/media/hero-clinic.jpg" alt="" className="h-full w-full object-cover" /></div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(115deg, hsl(218 56% 12%) 30%, hsl(218 56% 12% / 0.55))" }} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">{t("landingHeroTitle")}</h1>
          <p className="mt-4 max-w-xl text-sm text-white/75 sm:text-base">{t("landingHeroSub")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#clinics" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90">{t("landingPickClinic")}<Arrow className="h-4 w-4" /></a>
            <Link href="/login" className="inline-flex items-center rounded-md border border-white/25 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10">{t("signIn")}</Link>
          </div>
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {features.map((f) => (
            <div key={f.title} className="flex gap-3.5 rounded-xl border bg-background p-5 shadow-xs">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><f.icon className="h-5 w-5" /></span>
              <div><p className="font-semibold">{f.title}</p><p className="mt-1 text-sm text-muted-foreground">{f.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="clinics" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-2xl font-bold tracking-tight">{t("landingPickClinic")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("landingDemoNote")}</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clinics.map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`} className="group">
              <Card className="h-full overflow-hidden transition group-hover:border-primary group-hover:shadow-md">
                <div className="relative h-32 overflow-hidden"><img src="/media/clinic-interior.jpg" alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /><span className="absolute inset-x-0 bottom-0 h-12" style={{ background: "linear-gradient(to top, hsl(218 56% 12% / 0.55), transparent)" }} /></div>
                <div className="p-4">
                  <h3 className="flex items-center justify-between font-semibold">{l === "ar" && c.nameAr ? c.nameAr : c.name}<Arrow className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" /></h3>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
                  <p className="mt-3 flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{c._count.branches} {t("branchCount")}</span><span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" />{c._count.doctors} {t("doctorCount")}</span></p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <Card className="grid gap-4 border-primary/20 bg-primary-soft/40 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white"><Stethoscope className="h-5 w-5" /></span>
          <div><h3 className="font-semibold">{t("landingDemo")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("landingDemoDesc")}</p></div>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">{t("photoCredit")}</p>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>{t("appName")}</span>
          <span className="flex gap-4"><Link href="/privacy" className="hover:text-foreground">{t("privacy")}</Link><Link href="/terms" className="hover:text-foreground">{t("terms")}</Link></span>
        </div>
      </footer>
    </main>
  );
}
