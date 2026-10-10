import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ads/", "/terms", "/privacy", "/app"],
        disallow: ["/admin", "/manager", "/leasing", "/agent", "/my", "/post", "/profile", "/notifications", "/loan", "/loans", "/compare", "/api/", "/auth/", "/login"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
