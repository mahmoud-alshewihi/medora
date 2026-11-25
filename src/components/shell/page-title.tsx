import { getLocale } from "@/lib/i18n/server";
import { tx } from "@/lib/i18n/phrases";
export async function PageTitle({ children }: { children: string }) {
  const l = await getLocale();
  return <h1 className="text-2xl font-semibold">{tx(l, children)}</h1>;
}
