import Link from "next/link";
import { CalendarCheck, Clock, Mail, MapPin, Phone, Quote, Stethoscope } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { Card } from "@/components/ui/primitives";
import { LocaleToggle, ThemeToggle } from "@/components/shell/toggles";

export const dynamic = "force-dynamic";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ClinicHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const { l, t } = await getT();
  const c = await db.clinic.findFirst({ where: { slug, status: "ACTIVE" }, include: { branches: { where: { active: true } }, specialties: true, services: { where: { active: true }, take: 12 }, doctors: { where: { active: true }, include: { specialty: true } }, testimonials: true, faqs: { orderBy: { position: "asc" } } } });
  if (!c) notFound();
  const name = l === "ar" && c.nameAr ? c.nameAr : c.name;
  return (
    <main>
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-white">{name[0]}</span>{name}</Link>
          <nav className="flex items-center gap-1 text-sm">
            <a className="hidden rounded-md px-2.5 py-2 hover:bg-muted sm:block" href="#doctors">{t("doctors")}</a>
            <a className="hidden rounded-md px-2.5 py-2 hover:bg-muted sm:block" href="#branches">{t("branches")}</a>
            <a className="hidden rounded-md px-2.5 py-2 hover:bg-muted md:block" href="#faq">{t("faq")}</a>
            <ThemeToggle /><LocaleToggle current={l} />
            <Link href={`/c/${c.slug}/book`} className="ml-1 rounded-md bg-primary px-3.5 py-2 font-medium text-primary-foreground shadow-xs hover:bg-primary-strong">{t("bookAppointment")}</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden text-white" style={{ background: "hsl(218 56% 12%)" }}>
        <div className="absolute inset-0 opacity-30"><img src="/media/hero-clinic.jpg" alt="" className="h-full w-full object-cover" /></div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(115deg, hsl(218 56% 12%) 25%, hsl(218 56% 12% / 0.5))" }} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">{name}</h1>
          <p className="mt-4 max-w-xl text-sm text-white/80 sm:text-base">{c.description}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`/c/${c.slug}/book`} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90"><CalendarCheck className="h-4 w-4" />{t("bookAppointment")}</Link>
            <a href="#doctors" className="inline-flex items-center rounded-md border border-white/25 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10">{t("doctors")}</a>
          </div>
          <dl className="mt-10 flex flex-wrap gap-8 text-sm">
            <div><dt className="text-white/60">{t("branches")}</dt><dd className="tnum mt-0.5 text-2xl font-bold">{c.branches.length}</dd></div>
            <div><dt className="text-white/60">{t("doctors")}</dt><dd className="tnum mt-0.5 text-2xl font-bold">{c.doctors.length}</dd></div>
            <div><dt className="text-white/60">{t("specialties")}</dt><dd className="tnum mt-0.5 text-2xl font-bold">{c.specialties.length}</dd></div>
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6">
        <section>
          <h2 className="text-2xl font-bold tracking-tight">{t("specialties")}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {c.specialties.map((s) => (
              <Card key={s.id} className="p-5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><Stethoscope className="h-4 w-4" /></span>
                <p className="mt-3 font-semibold">{l === "ar" && s.nameAr ? s.nameAr : s.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-5"><h2 className="text-2xl font-bold tracking-tight">{t("services")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("servicesIntro")}</p></div>
          <Card>
            <ul className="divide-y">
              {c.services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="flex items-center gap-3 whitespace-nowrap text-muted-foreground"><span className="tnum">{s.durationMin} min</span><span className="tnum rounded-full bg-primary-soft px-3 py-1 font-semibold text-primary">{formatMoney(s.price.toString(), c.currency, l)}</span></span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section id="doctors">
          <h2 className="text-2xl font-bold tracking-tight">{t("doctors")}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.doctors.map((d) => {
              const initials = d.fullName.replace(/^Dr\.?\s*/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <Link key={d.id} href={`/c/${c.slug}/doctors/${d.id}`} className="group">
                  <Card className="flex h-full items-center gap-4 p-5 transition group-hover:border-primary group-hover:shadow-md">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary-soft text-lg font-bold text-primary">{initials}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{d.fullName}</span>
                      <span className="block text-sm text-primary">{d.specialty.name}</span>
                      <span className="tnum mt-0.5 block text-xs text-muted-foreground">{d.yearsExperience} {t("experienceYears")}</span>
                    </span>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <section id="branches">
          <h2 className="text-2xl font-bold tracking-tight">{t("branches")}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.branches.map((b) => {
              const wh = b.workingHours as Record<string, [string, string]>;
              return (
                <Card key={b.id} className="p-5">
                  <p className="font-semibold">{b.name}</p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{b.address}</p>
                  <p className="tnum mt-1 flex items-center gap-1.5 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{b.phone}</p>
                  <div className="mt-3 rounded-lg bg-muted/50 p-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock className="h-3.5 w-3.5" />{t("workingHours")}</p>
                    <ul className="space-y-0.5 text-xs">
                      {DAYS.map((d, i) => (
                        <li key={d} className="flex justify-between gap-2"><span className="text-muted-foreground">{d}</span>{wh[String(i)] ? <span className="tnum">{wh[String(i)]![0]} - {wh[String(i)]![1]}</span> : <span className="text-muted-foreground/70">{t("closed")}</span>}</li>
                      ))}
                    </ul>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {c.testimonials.length ? (
          <section>
            <h2 className="text-2xl font-bold tracking-tight">{t("testimonials")}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {c.testimonials.map((x) => (
                <Card key={x.id} className="p-5">
                  <Quote className="h-5 w-5 text-primary/50" />
                  <p className="mt-2 text-sm leading-relaxed">&ldquo;{x.quote}&rdquo;</p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">{x.author}{x.isDemo ? " (demonstration content)" : ""}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {c.faqs.length ? (
          <section id="faq">
            <h2 className="text-2xl font-bold tracking-tight">{t("faq")}</h2>
            <div className="mt-5 space-y-2.5">
              {c.faqs.map((f) => (
                <details key={f.id} className="group rounded-xl border bg-card p-4 shadow-xs">
                  <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden"><span className="me-2 inline-block text-primary transition group-open:rotate-90">&#9656;</span>{f.question}</summary>
                  <p className="mt-2.5 ps-6 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <section id="contact">
          <h2 className="text-2xl font-bold tracking-tight">{t("contact")}</h2>
          <Card className="mt-5 grid gap-4 p-6 sm:grid-cols-3">
            <p className="flex items-start gap-2.5 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{c.address}</p>
            <p className="tnum flex items-center gap-2.5 text-sm"><Phone className="h-4 w-4 shrink-0 text-primary" />{c.phone}</p>
            <p className="flex items-center gap-2.5 text-sm"><Mail className="h-4 w-4 shrink-0 text-primary" />{c.email}</p>
          </Card>
        </section>
      </div>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p><Link href="/privacy" className="hover:text-foreground">{t("privacy")}</Link> &middot; <Link href="/terms" className="hover:text-foreground">{t("terms")}</Link></p>
        <p className="mt-2 text-xs">{t("photoCredit")}</p>
      </footer>
    </main>
  );
}
