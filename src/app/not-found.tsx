import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Compass className="h-7 w-7" /></span>
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">The page you are looking for does not exist or you do not have access to it.</p>
        <Link href="/" className="mt-1 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary-strong">Back to home</Link>
      </div>
    </main>
  );
}
