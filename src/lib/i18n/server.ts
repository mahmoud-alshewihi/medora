import { cookies } from "next/headers";
import { t, type Key, type Locale } from "./dict";

export async function getLocale(): Promise<Locale> {
  return (await cookies()).get("locale")?.value === "ar" ? "ar" : "en";
}
export async function getT() {
  const l = await getLocale();
  return { l, t: (k: Key) => t(l, k), dir: l === "ar" ? ("rtl" as const) : ("ltr" as const) };
}
