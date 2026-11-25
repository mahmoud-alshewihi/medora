import Link from "next/link";
export default function Page() {
  return (
    <main className="prose mx-auto max-w-2xl p-6"><Link href="/" className="text-sm text-primary">&larr; Home</Link>
      <h1 className="mt-4 text-3xl font-semibold">Terms and conditions</h1>
      <p className="mt-4 text-sm text-muted-foreground">Demonstration document. This text is a template placeholder for a demo build and has not been reviewed by a lawyer. Replace it before any real use. Medora makes no claim of HIPAA, GDPR or other regulatory compliance.</p>
      <ul className="mt-4 list-disc space-y-2 ps-5 text-sm"><li>Data in this demo is entirely fictional.</li><li>Medical records are visible only to authorised clinical staff of the owning clinic.</li><li>Appointment and contact details are used to run the clinic and are not sold.</li></ul>
    </main>
  );
}
