import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ClinicHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const { l, t } = await getT();
  const c = await db.clinic.findFirst({ where: { slug, status: "ACTIVE" }, include: { branches: { where: { active: true } }, specialties: true, services: { where: { active: true }, take: 12 }, doctors: { where: { active: true }, include: { specialty: true } }, testimonials: true, faqs: { orderBy: { position: "asc" } } } });
  if (!c) notFound();
  const name = l === "ar" && c.nameAr ? c.nameAr : c.name;
  return (
    <main>
      <header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between p-4"><Link href="/" className="font-semibold">{name}</Link>
        <nav className="flex gap-4 text-sm"><a href="#doctors">{t("doctors")}</a><a href="#branches">{t("branches")}</a><a href="#faq">{t("faq")}</a><a href="#contact">{t("contact")}</a><Link href="/login">{t("signIn")}</Link></nav></div></header>
      <section className="bg-navy/95 text-white" style={{ background: "hsl(218 56% 14%)" }}>
        <div className="mx-auto grid max-w-6xl gap-8 p-8 md:grid-cols-2 md:p-14">
          <div><h1 className="text-4xl font-semibold tracking-tight">{name}</h1><p className="mt-4 max-w-md text-white/80">{c.description}</p>
            <Link href={`/c/${c.slug}/book`} className="mt-6 inline-block rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">{t("bookAppointment")}</Link></div>
          <div className="rounded-lg bg-white/10 p-6 text-sm" aria-label="Photography placeholder"><p className="font-medium">Photography</p><p className="mt-1 text-white/70">Demonstration build: no stock healthcare photography is bundled. Upload clinic photos via branding settings in a real deployment.</p></div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-14 p-6 py-12">
        <section><h2 className="text-2xl font-semibold">{t("specialties")}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{c.specialties.map((s) => <Card key={s.id} className="p-4"><p className="font-medium">{l === "ar" && s.nameAr ? s.nameAr : s.name}</p><p className="mt-1 text-xs text-muted-foreground">{s.description}</p></Card>)}</div></section>
        <section><h2 className="text-2xl font-semibold">{t("services")}</h2><ul className="mt-4 grid gap-2 sm:grid-cols-2">{c.services.map((s) => <li key={s.id} className="flex justify-between rounded-md border bg-card px-4 py-2 text-sm"><span>{s.name}</span><span className="text-muted-foreground">{formatMoney(s.price.toString(), c.currency, l)} / {s.durationMin} min</span></li>)}</ul></section>
        <section id="doctors"><h2 className="text-2xl font-semibold">{t("doctors")}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{c.doctors.map((d) => <Link key={d.id} href={`/c/${c.slug}/doctors/${d.id}`}><Card className="p-4 hover:border-primary"><p className="font-medium">{d.fullName}</p><p className="text-sm text-primary">{d.specialty.name}</p><p className="mt-1 text-xs text-muted-foreground">{d.yearsExperience} years experience</p></Card></Link>)}</div></section>
        <section id="branches"><h2 className="text-2xl font-semibold">{t("branches")}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{c.branches.map((b) => {
          const wh = b.workingHours as Record<string, [string, string]>;
          return <Card key={b.id} className="p-4"><p className="font-medium">{b.name}</p><p className="text-sm text-muted-foreground">{b.address}</p><p className="text-sm">{b.phone}</p>
            <ul className="mt-2 text-xs text-muted-foreground">{DAYS.map((d, i) => <li key={d}>{d}: {wh[String(i)] ? `${wh[String(i)]![0]} - ${wh[String(i)]![1]}` : "Closed"}</li>)}</ul></Card>; })}</div></section>
        <section><h2 className="text-2xl font-semibold">{t("testimonials")}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{c.testimonials.map((x) => <Card key={x.id} className="p-4 text-sm"><p>&ldquo;{x.quote}&rdquo;</p><p className="mt-2 text-xs text-muted-foreground">{x.author}{x.isDemo ? " (demonstration content)" : ""}</p></Card>)}</div></section>
        <section id="faq"><h2 className="text-2xl font-semibold">{t("faq")}</h2><div className="mt-4 space-y-2">{c.faqs.map((f) => <details key={f.id} className="rounded-md border bg-card p-3"><summary className="cursor-pointer font-medium">{f.question}</summary><p className="mt-2 text-sm text-muted-foreground">{f.answer}</p></details>)}</div></section>
        <section id="contact"><h2 className="text-2xl font-semibold">{t("contact")}</h2><p className="mt-2 text-sm">{c.address}<br />{c.phone}<br />{c.email}</p></section>
      </div>
      <footer className="border-t p-6 text-center text-sm text-muted-foreground"><Link href="/privacy">{t("privacy")}</Link> &middot; <Link href="/terms">{t("terms")}</Link></footer>
    </main>
  );
}
