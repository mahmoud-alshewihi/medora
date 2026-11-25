import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default async function DoctorProfile({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const clinic = await db.clinic.findFirst({ where: { slug, status: "ACTIVE" } });
  if (!clinic) notFound();
  const d = await db.doctor.findFirst({ where: { id, clinicId: clinic.id, active: true }, include: { specialty: true, schedules: { include: { branch: { select: { name: true } } }, orderBy: { weekday: "asc" } } } });
  if (!d) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6"><Link href={`/c/${slug}`} className="text-sm text-primary">&larr; {clinic.name}</Link>
      <h1 className="mt-3 text-3xl font-semibold">{d.fullName}</h1><p className="text-primary">{d.specialty.name}</p>
      <p className="mt-3 text-sm">{d.bio}</p>
      <Card className="mt-6 p-4 text-sm"><p><b>Qualifications:</b> {d.qualifications ?? "-"}</p><p><b>Experience:</b> {d.yearsExperience} years</p><p><b>Consultation fee:</b> {formatMoney(d.consultationFee.toString(), clinic.currency)}</p></Card>
      <h2 className="mt-8 text-xl font-semibold">Availability</h2>
      <ul className="mt-2 space-y-1 text-sm">{d.schedules.map((s) => <li key={s.id}>{DAYS[s.weekday]}: {s.startTime} - {s.endTime} at {s.branch.name}</li>)}</ul>
      <Link href={`/c/${slug}/book?doctor=${d.id}`} className="mt-6 inline-block rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Book with {d.fullName}</Link>
    </main>
  );
}
