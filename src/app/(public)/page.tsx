import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export default async function Landing() {
  const { t } = await getT();
  const clinics = await db.clinic.findMany({ where: { status: "ACTIVE" }, select: { slug: true, name: true, nameAr: true, description: true, _count: { select: { branches: true, doctors: true } } } });
  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between py-4"><b className="text-lg">Medora</b><nav className="flex gap-4 text-sm"><Link href="/login">{t("signIn")}</Link><Link href="/register">{t("register")}</Link></nav></header>
      <section className="py-12"><h1 className="max-w-2xl text-4xl font-semibold tracking-tight">Clinic management for branches, doctors and patients.</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">Pick a clinic to book an appointment. All clinics below are fictional demonstration tenants.</p></section>
      <div className="grid gap-4 sm:grid-cols-3">
        {clinics.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`}><Card className="h-full p-4 transition hover:border-primary"><h2 className="font-semibold">{c.name}</h2><p className="mt-1 text-sm text-muted-foreground line-clamp-3">{c.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">{c._count.branches} branches, {c._count.doctors} doctors</p></Card></Link>))}
      </div>
      <footer className="mt-16 flex gap-4 border-t py-6 text-sm text-muted-foreground"><Link href="/privacy">{t("privacy")}</Link><Link href="/terms">{t("terms")}</Link></footer>
    </main>
  );
}
