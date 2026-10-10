import Link from "next/link";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSettings } from "@/lib/data";
import { categoryLabel, categoryLong, initial, money, photoUrl, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Gallery } from "./Gallery";
import { ContactBox } from "./ContactBox";
import { LoanCalculator } from "./LoanCalculator";
import { ViewCounter } from "./ViewCounter";
import { ReportAdButton } from "./ReportAdButton";
import { CompareToggle } from "@/components/Compare";
import { expiryInfo } from "@/lib/commission";
import { SITE_NAME, siteUrl } from "@/lib/site";
import type { Partner } from "@/lib/loan";
import type { Ad, AdStatus, PublicAd } from "@/lib/types";

type View = PublicAd & { plate_full?: string; vin_full?: string };

/** generateMetadata болон хуудас хоёр нэг хүсэлтэд дахин ачаалахгүйн тулд cache() */
const load = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: pub } = await supabase.from("public_ads").select("*").eq("id", id).maybeSingle();
  if (pub) return pub as View;
  // Өөрийн эсвэл менежерийн харах хүлээгдэж буй зар
  const { data: own } = await supabase.from("ads").select("*").eq("id", id).maybeSingle();
  if (!own) return null;
  const a = own as Ad;
  return {
    ...a,
    plate_masked: a.plate_number,
    vin_masked: a.vin,
    seller_name: "",
    seller_city: null,
    seller_ad_count: 0,
  } as View;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ad = await load((await params).id);
  if (!ad) return { title: "Зар олдсонгүй", robots: { index: false } };
  const title = `${ad.brand} ${ad.model} ${ad.year_made}${ad.trim ? ` ${ad.trim}` : ""} — ${money(ad.price)}`;
  const description = [
    `${ad.year_made} онд үйлдвэрлэсэн`,
    ad.year_imported ? `${ad.year_imported} онд орж ирсэн` : null,
    ad.seller_city,
    ad.description?.replace(/\s+/g, " ").slice(0, 120),
  ].filter(Boolean).join(" · ");
  const img = photoUrl(ad.photos[0]);
  const url = `${siteUrl()}/ads/${ad.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: ad.status === "active" ? undefined : { index: false },
    openGraph: { type: "website", url, title, description, siteName: SITE_NAME, locale: "mn_MN", images: img ? [{ url: img, alt: `${ad.brand} ${ad.model}` }] : undefined },
    twitter: { card: img ? "summary_large_image" : "summary", title, description, images: img ? [img] : undefined },
  };
}

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, ad, settings] = await Promise.all([getProfile(), load(id), getSettings()]);
  if (me?.is_blocked) redirect("/blocked");
  if (!ad) notFound();
  const supabase = await createClient();
  const mine = Boolean(me && ad.user_id === me.id);
  const [{ data: fav }, { data: partnerRows }] = await Promise.all([
    me
      ? supabase.from("favorites").select("ad_id").eq("user_id", me.id).eq("ad_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("leasing_partners").select("*").eq("active", true).order("rate_annual"),
  ]);
  const partners = (partnerRows ?? []) as Partner[];
  const cy = settings.cutoff_year;
  const exp = expiryInfo(ad.expires_at);
  const loginHref = me ? null : `/login?next=${encodeURIComponent(`/ads/${ad.id}`)}`;
  // Хайлтын системд зориулсан бүтэцтэй өгөгдөл (schema.org/Car)
  const jsonLd = ad.status === "active" ? {
    "@context": "https://schema.org",
    "@type": "Car",
    name: `${ad.brand} ${ad.model}${ad.trim ? ` ${ad.trim}` : ""}`,
    brand: { "@type": "Brand", name: ad.brand },
    model: ad.model,
    vehicleModelDate: String(ad.year_made),
    productionDate: String(ad.year_made),
    image: ad.photos.slice(0, 5).map((p) => photoUrl(p)).filter(Boolean),
    description: ad.description ?? undefined,
    url: `${siteUrl()}/ads/${ad.id}`,
    offers: { "@type": "Offer", price: ad.price, priceCurrency: "MNT", availability: "https://schema.org/InStock", url: `${siteUrl()}/ads/${ad.id}` },
  } : null;

  return (
    <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-6 pb-16 flex flex-col gap-6">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
      <nav aria-label="Зам" className="flex gap-2 text-[13px] text-muted flex-wrap">
        <Link href="/" className="text-muted">Зарууд</Link>
        <span>/</span>
        <Link href={`/?cat=${ad.category}`} className="text-muted">{categoryLong(ad.category, cy)}</Link>
        <span>/</span>
        <span className="text-ink">{ad.brand} {ad.model}</span>
      </nav>

      {ad.status === "active" && mine && exp.expired && (
        <div role="status" className="card px-5 py-4 flex items-center gap-3 flex-wrap">
          <span className="badge bg-danger-bg text-[#9b1c1c]">Хугацаа дууссан</span>
          <span className="text-[14px] text-body">Энэ зар нийтэд харагдахаа больсон.</span>
          <Link href="/my" className="btn btn-sm btn-ink ml-auto">Сунгах</Link>
        </div>
      )}
      {ad.status !== "active" && (
        <div role="status" className="card px-5 py-4 flex items-center gap-3 flex-wrap">
          <StatusBadge status={ad.status as AdStatus} />
          <span className="text-[14px] text-body">
            {ad.status === "pending"
              ? "Энэ зар менежерийн шалгалтыг хүлээж байна. Батлагдсаны дараа бусдад харагдана."
              : ad.status === "rejected"
                ? "Энэ зар татгалзагдсан тул бусдад харагдахгүй."
                : ad.status === "hidden"
                  ? "Энэ зарыг түр нуусан тул бусдад харагдахгүй."
                  : "Энэ машин зарагдсан."}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-7 items-start">
        <div className="flex-[999_1_560px] min-w-0">
          <Gallery photos={ad.photos} alt={`${ad.brand} ${ad.model}`} />
        </div>

        <aside className="card flex-[1_1_360px] p-6 flex flex-col gap-4.5">
          <div className="flex gap-2 items-center">
            <span className="cat-chip">{categoryLabel(ad.category, cy)}</span>
            <span className="text-[12px] text-muted">{timeAgo(ad.approved_at ?? ad.created_at)} нийтлэгдсэн</span>
          </div>
          <h1 className="m-0 text-[28px] font-bold leading-tight">
            {ad.brand} {ad.model}
            {ad.trim ? ` · ${ad.trim}` : ""}
          </h1>
          <div className="h-display text-[32px]">{money(ad.price)}</div>
          <dl className="grid grid-cols-2 gap-2 m-0">
            {[
              ["Үйлдвэрлэсэн он", String(ad.year_made), false],
              ["Орж ирсэн он", ad.year_imported ? String(ad.year_imported) : "—", false],
              ["Улсын дугаар", ad.plate_masked, true],
              ["Арлын дугаар", ad.vin_masked, true],
            ].map(([k, v, mono]) => (
              <div key={String(k)} className="bg-paper rounded-xl p-3 flex flex-col gap-1">
                <dt className="text-[12px] text-muted">{k}</dt>
                <dd className={`m-0 font-semibold ${mono ? "mono text-[15px] font-bold" : ""}`}>{v}</dd>
              </div>
            ))}
          </dl>
          {!mine && ad.status === "active" && (
            <ContactBox adId={ad.id} phone={ad.phone} favorite={Boolean(fav)} loginHref={loginHref} />
          )}
          {ad.status === "active" && <CompareToggle adId={ad.id} />}
          {!mine && ad.status === "active" && <ViewCounter adId={ad.id} />}
          {!mine && ad.status === "active" && partners.length > 0 && (
            <LoanCalculator adId={ad.id} price={ad.price} partners={partners} />
          )}
          {mine && (
            <Link href="/my" className="btn btn-lg btn-ghost">Миний зарууд руу</Link>
          )}
          {!mine && ad.status === "active" && <ReportAdButton adId={ad.id} loginHref={loginHref} />}
          {ad.seller_name && (
            <div className="flex items-center gap-3 border-t border-[#ecede9] pt-4">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold ${ad.seller_shop ? "bg-yellow text-ink" : "bg-ink text-yellow"}`}>
                {ad.seller_shop ? "🏪" : initial(ad.seller_name)}
              </div>
              <div className="flex flex-col gap-0.5">
                {ad.seller_shop && <span className="text-[11px] font-bold uppercase tracking-wide text-pending-fg">Авто худалдаа</span>}
                <span className="font-semibold text-[14px]">{ad.seller_shop ?? ad.seller_name}</span>
                <span className="text-[12px] text-muted">
                  {ad.seller_city ?? "Монгол"} · {ad.seller_ad_count} зар
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <section className="card flex-[1_1_360px] p-6 flex flex-col gap-3">
          <h2 className="m-0 text-[18px] font-bold">Машин ба сер</h2>
          {[
            ["Марк", ad.brand],
            ["Загвар", ad.model],
            ["Сер", ad.trim || "—"],
            ["Үзэлт", String(ad.views)],
          ].map(([k, v], i, arr) => (
            <div key={k} className={`flex justify-between py-2.5 text-[14px] ${i < arr.length - 1 ? "border-b border-[#ecede9]" : ""}`}>
              <span className="text-muted">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </section>
        <section className="card flex-[1_1_360px] p-6 flex flex-col gap-3">
          <h2 className="m-0 text-[18px] font-bold">Нэмэлт опшн</h2>
          {ad.options.length ? (
            <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
              {ad.options.map((o) => (
                <li key={o} className="px-3 py-1.5 bg-paper rounded-2xl text-[13px]">{o}</li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[14px] text-muted">Оруулаагүй</p>
          )}
          <h2 className="mt-2 mb-0 text-[18px] font-bold">Нэмж хийсэн зүйлс</h2>
          <p className="m-0 text-[14px] leading-relaxed whitespace-pre-line">{ad.modifications || "—"}</p>
        </section>
        <section className="card flex-[1_1_360px] p-6 flex flex-col gap-3">
          <h2 className="m-0 text-[18px] font-bold">Тайлбар</h2>
          <p className="m-0 text-[15px] leading-relaxed text-[#2b2f35] whitespace-pre-line">{ad.description || "—"}</p>
        </section>
      </div>
    </main>
  );
}
