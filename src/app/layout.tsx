import type { Metadata, Viewport } from "next";
import { locale, t } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tesla Stats",
  description: t.appDescription,
  appleWebApp: { capable: true, title: "Tesla Stats", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
