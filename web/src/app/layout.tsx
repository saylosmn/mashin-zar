import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaSetup } from "@/components/WebPush";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ErrorReporter } from "@/components/ErrorReporter";
import { SITE_NAME, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Машин зар — автомашины зар", template: "%s — Машин зар" },
  description: "Менежерээр шалгагдсан автомашины зарууд Монголд. Toyota Prius, Land Cruiser зэрэг машин зарах, худалдан авах, лизингийн тооцоолуур, шинэ зарын мэдэгдэл.",
  keywords: ["машин зар", "автомашин худалдаа", "машин зарна", "машин авна", "Prius зар", "лизинг", "Улаанбаатар"],
  openGraph: { type: "website", siteName: SITE_NAME, locale: "mn_MN", url: "/" },
  twitter: { card: "summary_large_image" },
  applicationName: "Машин зар",
  appleWebApp: { capable: true, title: "Машин зар", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#111317", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;700&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="min-h-dvh flex flex-col">
        <PwaSetup />
        <ErrorReporter />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
