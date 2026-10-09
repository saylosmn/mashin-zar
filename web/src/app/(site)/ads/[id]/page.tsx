import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireUser } from "@/lib/data";
import { categoryLabel, categoryLong, initial, money, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Gallery } from "./Gallery";
import { ContactBox } from "./ContactBox";
import type { Ad, AdStatus, PublicAd } from "@/lib/types";

type View = PublicAd & { plate_full?: string; vin_full?: string };

async function load(id: string) {
  const supabase = await createClient();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
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
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ad = await load((await params).id);
  return { title: ad ? `${ad.brand} ${ad.model} ${ad.year_made}` : "Зар олдсонгүй" };
}

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser(`/ads/${id}`);
  const ad = await load(id);
  if (!ad) notFound();
  const settings = await getSettings();
  const supabase = await createClient();
  const mine = ad.user_id === me.id;
  if (!mine && ad.status === "active") await supabase.rpc("increment_view", { p_ad: id });
  const { data: fav } = await supabase.from("favorites").select("ad_id").eq("user_id", me.id).eq("ad_id", id).maybeSingle();
  const cy = settings.cutoff_year;

  return (
    <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-6 pb-16 flex flex-col gap-6">
      <nav aria-label="Зам" className="flex gap-2 text-[13px] text-muted flex-wrap">
        <Link href="/" className="text-muted">Зарууд</Link>
        <span>/</span>
        <Link href={`/?cat=${ad.category}`} className="text-muted">{categoryLong(ad.category, cy)}</Link>
        <span>/</span>
        <span className="text-ink">{ad.brand} {ad.model}</span>
      </nav>

      {ad.status !== "active" && (
        <div role="status" className="card px-5 py-4 flex items-center gap-3 flex-wrap">
          <StatusBadge status={ad.status as AdStatus} />
          <span className="text-[14px] text-body">
            {ad.status === "pending"
              ? "Энэ зар менежерийн шалгалтыг хүлээж байна. Батлагдсаны дараа бусдад харагдана."
              : ad.status === "rejected"
                ? "Энэ зар татгалзагдсан тул бусдад харагдахгүй."
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
          {!mine && ad.status === "active" && <ContactBox adId={ad.id} phone={ad.phone} favorite={Boolean(fav)} />}
          {mine && (
            <Link href="/my" className="btn btn-lg btn-ghost">Миний зарууд руу</Link>
          )}
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
