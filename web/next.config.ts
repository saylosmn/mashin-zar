import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Гэрээний PDF-д кирилл фонт хэрэгтэй
  outputFileTracingIncludes: { "/api/contracts/**": ["./src/fonts/**"] },
  turbopack: {
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
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
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
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
