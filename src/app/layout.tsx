import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: { default: "Lumen PMO", template: "%s · Lumen PMO" }, description: "Enterprise project, portfolio and agile delivery platform" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = (await cookies()).get("epm_lang")?.value === "ar" ? "ar" : "en";
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
