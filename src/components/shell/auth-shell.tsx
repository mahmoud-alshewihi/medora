import Link from "next/link";
import { ShieldCheck, CalendarCheck, Languages } from "lucide-react";

/** Shared split-screen shell for auth pages. Server-safe (no hooks). */
export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden text-white lg:block" style={{ background: "hsl(218 56% 12%)" }}>
        <div className="absolute inset-0 opacity-25"><img src="/media/doctor-portrait.jpg" alt="" className="h-full w-full object-cover" /></div>
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, hsl(218 56% 12% / 0.85), hsl(178 60% 20% / 0.7))" }} />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-bold text-white">M</span>Medora</Link>
          <div className="space-y-5">
            <h2 className="max-w-sm text-3xl font-bold tracking-tight">Clinic management for branches, doctors and patients.</h2>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li className="flex items-center gap-2.5"><CalendarCheck className="h-4 w-4 text-primary" />Online booking and daily schedules</li>
              <li className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-primary" />Role-based access for every staff member</li>
              <li className="flex items-center gap-2.5"><Languages className="h-4 w-4 text-primary" />English and Arabic, light and dark</li>
            </ul>
          </div>
          <p className="text-xs text-white/50">Demonstration build with fictional data.</p>
        </div>
      </div>
      <div className="grid place-items-center bg-background p-4 sm:p-8">
        <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"} space-y-6`}>
          <div className="space-y-1.5">
            <Link href="/" className="mb-4 flex items-center gap-2 text-lg font-bold lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-white">M</span>Medora</Link>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
