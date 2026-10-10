import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";

// Цаг тутам шинэчилнэ (зар бүрийг хайлтын системд танилцуулна)
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/?cat=new`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/?cat=old`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/app`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return pages;
  // Күүкигүй (нэвтрээгүй) клиент — зөвхөн нийтийн зарууд
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase.from("public_ads").select("id,approved_at,created_at,photos").order("approved_at", { ascending: false }).limit(5000);
  for (const a of data ?? []) {
    pages.push({
      url: `${base}/ads/${a.id}`,
      lastModified: a.approved_at ?? a.created_at,
      changeFrequency: "daily",
      priority: 0.7,
      images: a.photos?.[0] ? [`${url}/storage/v1/object/public/ad-photos/${a.photos[0]}`] : undefined,
    });
  }
  return pages;
}
