import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Машин зар", template: "%s — Машин зар" },
  description: "Менежерээр шалгагдсан автомашины зарууд. 2016 ба хойш, 2016-аас өмнө ангилалтай.",
};

export const viewport: Viewport = { themeColor: "#111317" };

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
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
