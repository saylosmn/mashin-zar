import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireUser } from "@/lib/data";
import { categoryLabel, dateShort, money, num } from "@/lib/format";
import { CarPhoto } from "@/components/CarPhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { AdCard } from "@/components/AdCard";
import { IconCheck, IconClose } from "@/components/icons";
import { deleteMyAd, renewAd, requestFeatured } from "../actions";
import { expiryInfo, isFeatured, recentlyRequested } from "@/lib/commission";
import { dealerSetStatus } from "@/app/panel-actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import type { Ad, AdStatus, PublicAd } from "@/lib/types";

export const metadata = { title: "Миний зарууд" };

const TABS: { key?: AdStatus | "saved"; label: string }[] = [
  { label: "Бүгд" },
  { key: "pending", label: "Хүлээгдэж" },
  { key: "active", label: "Идэвхтэй" },
  { key: "sold", label: "Зарагдсан" },
  { key: "saved", label: "Хадгалсан" },
];

export default async function MyAdsPage({ searchParams }: { searchParams: Promise<{ tab?: string; created?: string; deleted?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser("/my");
  const settings = await getSettings();
  const supabase = await createClient();
  const { data } = await supabase.from("ads").select("*").eq("user_id", me.id).order("created_at", { ascending: false });
  const ads = (data ?? []) as Ad[];
  const { data: favRows } = await supabase.from("favorites").select("ad_id").eq("user_id", me.id);
  const favIds = (favRows ?? []).map((f) => f.ad_id as string);
  const { data: favAds } = favIds.length
    ? await supabase.from("public_ads").select("*").in("id", favIds)
    : { data: [] as PublicAd[] };

  const dealer = me.role === "dealer";
  const tabs = dealer ? [...TABS.slice(0, 3), { key: "hidden" as const, label: "Нуусан" }, ...TABS.slice(3)] : TABS;
  const tab = sp.tab;
  const shown = tab && tab !== "saved" ? ads.filter((a) => a.status === tab) : ads;
  const countOf = (k?: string) => (k === "saved" ? (favAds ?? []).length : k ? ads.filter((a) => a.status === k).length : ads.length);

  return (
    <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-5">
      {sp.created && (
        <div role="status" className="flex items-center gap-3.5 bg-ink text-paper rounded-2xl px-5 py-4.5 flex-wrap">
          <span className="w-10 h-10 rounded-xl bg-yellow text-ink flex items-center justify-center shrink-0"><IconCheck size={22} /></span>
          <div className="flex flex-col gap-0.5 flex-[1_1_300px]">
            <span className="font-bold text-[16px]">{dealer ? "Зар нийтлэгдлээ" : "Зар амжилттай үүслээ"}</span>
            <span className="text-[14px] text-[#c9cdd3]">{dealer ? "Таны зар бүх хэрэглэгчид шууд харагдаж байна." : "Манай менежер удахгүй тантай холбогдоно."}</span>
          </div>
          <Link href="/my" aria-label="Хаах" className="w-11 h-11 flex items-center justify-center text-paper"><IconClose size={18} /></Link>
        </div>
      )}
      {sp.deleted && <p role="status" className="m-0 card px-4 py-3 text-[14px]">Зар устгагдлаа.</p>}
      {sp.ok && <p role="status" className="m-0 card px-4 py-3 text-[14px]">✓ {sp.ok}</p>}
      {sp.err && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-4 py-3 text-[14px]">{sp.err}</p>}
      {dealer && (
        <p className="m-0 text-[13px] text-muted">
          Та <strong className="text-ink">{me.shop_name ?? "Авто худалдаа"}</strong> эрхтэй: зар тань шууд нийтлэгдэх бөгөөд засах, түр нуух, зарагдсан болгох боломжтой.
        </p>
      )}

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Миний зарууд</h1>
          <Link href="/loans" className="text-[14px] font-semibold">Лизингийн хүсэлтүүд →</Link>
        </div>
        <nav aria-label="Төлөв" className="flex gap-1.5 flex-wrap">
          {tabs.map((t) => {
            const on = (t.key ?? "") === (tab ?? "");
            return (
              <Link
                key={t.label}
                href={t.key ? `/my?tab=${t.key}` : "/my"}
                aria-current={on ? "page" : undefined}
                className={`h-10 px-3.5 rounded-full flex items-center text-[14px] no-underline ${on ? "bg-ink text-yellow font-semibold" : "border border-line-2 bg-card"}`}
              >
                {t.label} {countOf(t.key)}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === "saved" ? (
        (favAds ?? []).length ? (
          <div className="grid gap-[18px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {(favAds as PublicAd[]).map((a) => <AdCard key={a.id} ad={a} cutoff={settings.cutoff_year} />)}
          </div>
        ) : (
          <p className="card m-0 px-6 py-10 text-center text-muted">Хадгалсан зар алга. Зарын ♡ товчийг дарж хадгална.</p>
        )
      ) : shown.length === 0 ? (
        <div className="card px-6 py-12 flex flex-col items-center gap-4 text-center">
          <p className="m-0 text-[15px] text-body">Энд зар алга байна.</p>
          <Link href="/post" className="btn btn-lg btn-ink">Зар нэмэх</Link>
        </div>
      ) : (
        <>
          {/* Утсан дээр: карт жагсаалт (хүснэгт хэт өргөн тул товчнууд дэлгэцээс гардаг) */}
          <ul className="sm:hidden list-none p-0 m-0 flex flex-col gap-3">
            {shown.map((a) => (
              <li key={a.id} className="card p-3.5 flex flex-col gap-3">
                <Link href={`/ads/${a.id}`} className="flex items-center gap-3 no-underline min-w-0">
                  <CarPhoto path={a.photos[0]} alt="" className="w-[88px] h-[66px] rounded-lg shrink-0" label="IMG" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-semibold text-[15px] truncate">{a.brand} {a.model} · {a.year_made}</span>
                    <span className="h-display text-[15px]">{money(a.price)}</span>
                    <span className="text-[12px] text-muted">
                      {categoryLabel(a.category, settings.cutoff_year)} · {dateShort(a.created_at)}
                      {a.status !== "pending" ? ` · ${num(a.views)} үзэлт` : ""}
                    </span>
                  </div>
                </Link>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <StatusBadge status={a.status} />
                  {a.status === "pending" && <span className="text-[12px] text-muted">Менежер удахгүй холбогдоно</span>}
                  {a.offer_amount && <span className="text-[12px] text-pending-fg font-semibold">Санал: {money(a.offer_amount)}</span>}
                  <AdLife a={a} />
                </div>
                <AdActions a={a} dealer={dealer} featuredPrice={settings.featured_price} featuredDays={settings.featured_days} className="flex flex-wrap gap-2 [&>*]:flex-[1_1_auto] [&_.btn]:w-full" />
              </li>
            ))}
          </ul>
          <div className="table-wrap hidden sm:block">
            <table className="table min-w-[820px]">
              <thead>
                <tr><th>Машин</th><th>Ангилал</th><th>Үнэ</th><th>Төлөв</th><th>Үзэлт</th><th>Огноо</th><th><span className="sr-only">Үйлдэл</span></th></tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/ads/${a.id}`} className="flex items-center gap-3 no-underline">
                        <CarPhoto path={a.photos[0]} alt="" className="w-16 h-12 rounded-lg" label="IMG" />
                        <span className="font-semibold">{a.brand} {a.model} · {a.year_made}</span>
                      </Link>
                    </td>
                    <td><span className="cat-chip">{categoryLabel(a.category, settings.cutoff_year)}</span></td>
                    <td className="h-display text-[14px]">{money(a.price)}</td>
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={a.status} />
                        {a.status === "pending" && <span className="text-[12px] text-muted">Менежер удахгүй холбогдоно</span>}
                        {a.offer_amount && <span className="text-[12px] text-pending-fg font-semibold">Санал: {money(a.offer_amount)}</span>}
                        <AdLife a={a} />
                      </div>
                    </td>
                    <td className="mono">{a.status === "pending" ? "—" : num(a.views)}</td>
                    <td className="text-muted">{dateShort(a.created_at)}</td>
                    <td className="text-right">
                      <AdActions a={a} dealer={dealer} featuredPrice={settings.featured_price} featuredDays={settings.featured_days} className="flex gap-2 justify-end items-center flex-wrap" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

/** Нийтлэгдсэн зарын хугацаа, онцлох төлөв */
function AdLife({ a }: { a: Ad }) {
  if (a.status !== "active" && a.status !== "hidden") return null;
  const e = expiryInfo(a.expires_at);
  return (
    <>
      {!e.none && (
        <span className={`text-[12px] font-semibold ${e.expired ? "text-[#9b1c1c]" : e.renewable ? "text-pending-fg" : "text-muted"}`}>
          {e.expired ? "Хугацаа дууссан — нийтэд харагдахгүй" : `${e.daysLeft} хоног үлдсэн`}
        </span>
      )}
      {isFeatured(a.featured_until) && <span className="text-[12px] font-semibold text-pending-fg">⭐ Онцлох · {dateShort(a.featured_until)} хүртэл</span>}
    </>
  );
}

/** Зарын үйлдлүүд (гэрээ, сунгах, онцлох, засах, нуух, зарагдсан, устгах) — хүснэгт ба утасны картад хоёуланд нь. */
function AdActions({ a, dealer, className, featuredPrice, featuredDays }: { a: Ad; dealer: boolean; className?: string; featuredPrice?: number; featuredDays?: number }) {
  const e = expiryInfo(a.expires_at);
  const featured = isFeatured(a.featured_until);
  const requested = recentlyRequested(a.featured_requested_at);
  return (
    <div className={className}>
      {(a.status === "active" || a.status === "hidden") && e.renewable && (
        <form action={renewAd}>
          <input type="hidden" name="id" value={a.id} />
          <button className="btn btn-sm btn-yellow">Сунгах</button>
        </form>
      )}
      {a.status === "active" && !e.expired && !featured && (
        requested ? (
          <span className="text-[12px] text-muted self-center">⭐ Хүсэлт илгээсэн</span>
        ) : (
          <form action={requestFeatured}>
            <input type="hidden" name="id" value={a.id} />
            <ConfirmButton
              message={`Зараа ${featuredDays ?? 7} хоног жагсаалтын эхэнд онцлох уу? Үнэ: ${money(featuredPrice ?? 50000)}. Менежер тантай холбогдож төлбөрийг тохирно.`}
              className="btn btn-sm btn-ghost"
            >
              ⭐ Онцлох
            </ConfirmButton>
          </form>
        )
      )}
      {a.contract_id && (
        <a href={`/api/contracts/${a.contract_id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">Гэрээ</a>
      )}
      {dealer && a.status !== "sold" && (
        <>
          <Link href={`/my/${a.id}/edit`} className="btn btn-sm btn-ghost">Засах</Link>
          {(a.status === "active" || a.status === "hidden") && (
            <form action={dealerSetStatus}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="back" value="/my" />
              <input type="hidden" name="status" value={a.status === "active" ? "hidden" : "active"} />
              <button className="btn btn-sm btn-ghost">{a.status === "active" ? "Нуух" : "Гаргах"}</button>
            </form>
          )}
          <form action={dealerSetStatus}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="back" value="/my" />
            <input type="hidden" name="status" value="sold" />
            <ConfirmButton message={`${a.brand} ${a.model}-ийг зарагдсан гэж тэмдэглэх үү? Зар нийтээс хасагдана.`} className="btn btn-sm btn-ink">Зарагдсан</ConfirmButton>
          </form>
        </>
      )}
      {a.status !== "sold" && (
        <form action={deleteMyAd}>
          <input type="hidden" name="id" value={a.id} />
          <ConfirmButton message="Зараа устгах уу? Буцаах боломжгүй." className="btn btn-sm btn-danger">Устгах</ConfirmButton>
        </form>
      )}
    </div>
  );
}
