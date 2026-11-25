import { db } from "@/lib/db";
import { utcToZonedParts } from "@/lib/tz";

export async function clinicTz(clinicId: string): Promise<string> {
  const c = await db.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { timezone: true } });
  return c.timezone;
}
/** "2026-11-29 09:00" in the clinic's own timezone (not UTC). */
export function fmtLocal(at: Date | string, tz: string): string {
  const p = utcToZonedParts(new Date(at), tz) as unknown as { date: string; time?: string; hour?: number; minute?: number };
  const time = p.time ?? `${String(p.hour ?? 0).padStart(2, "0")}:${String(p.minute ?? 0).padStart(2, "0")}`;
  return `${p.date} ${time}`;
}
