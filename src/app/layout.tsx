import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: { default: "Medora", template: "%s | Medora" }, description: "Clinic management platform (demonstration build)" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { l, dir } = await getT();
  return (
    <html lang={l} dir={dir} suppressHydrationWarning>
      <body className="min-h-screen antialiased"><Providers locale={l}>{children}</Providers></body>
    </html>
  );
}
