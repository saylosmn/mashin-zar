import path from "node:path";
import type { NextConfig } from "next";

// ../shared-ийг вэб, апп хоёул ашигладаг тул build-ийн root нь repo-гийн root.
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // Ямар фреймворк ашигласныг халдагчид бүү харуул
  poweredByHeader: false,
  // Гэрээний PDF-д кирилл фонт хэрэгтэй
  outputFileTracingIncludes: { "/api/contracts/**": ["./src/fonts/**"] },
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // Аюулгүй байдлын толгойнууд: clickjacking, sniffing, зөвшөөрөлгүй эх үүсвэрээс зүйл ачаалахаас сэргийлнэ.
    const security = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), serial=(), bluetooth=(), hid=()",
      },
      // Өөр сайт манай цонхыг удирдах (tabnabbing, Spectre) болон файлыг шууд татахаас сэргийлнэ
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-site" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      { key: "Origin-Agent-Cluster", value: "?1" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "frame-src 'none'",
          "img-src 'self' data: blob: https://*.supabase.co",
          "media-src 'self' blob: https://*.supabase.co",
          "font-src 'self' data: https://fonts.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "script-src 'self' 'unsafe-inline'",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "form-action 'self'",
          "upgrade-insecure-requests",
        ].join("; "),
      },
    ];
    return [
      { source: "/:path*", headers: security },
      {
        source: "/mashin-zar.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mashin-zar.apk"' },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
  // Менежерийн панел хасагдсан: хуучин холбоос, push мэдэгдлийг админ панел руу шилжүүлнэ
  async redirects() {
    return [
      { source: "/manager", destination: "/admin", permanent: true },
      { source: "/manager/ads", destination: "/admin/review", permanent: true },
      { source: "/manager/flags", destination: "/admin/flags", permanent: true },
      { source: "/manager/users", destination: "/admin/sellers", permanent: true },
      { source: "/manager/reports", destination: "/admin/reports", permanent: true },
      { source: "/manager/all", destination: "/admin/ads", permanent: true },
      { source: "/manager/:path*", destination: "/admin", permanent: true },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
