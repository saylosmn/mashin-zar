import Link from "next/link";
import { getSettings, requireAdmin } from "@/lib/data";
import { categoryLabel, money, timeAgo } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { PLAN_LABEL } from "@/lib/payments";
import { agentOptions } from "@/lib/reports";
import { Flash, PanelShell } from "@/components/PanelShell";
import { CarPhoto } from "@/components/CarPhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { adById, adDetails, reviewQueue, type ReviewTab } from "@/features/admin/review/data";
import { ReviewList } from "@/features/admin/review/ReviewList";
import { SellerCard, VehicleCard } from "@/features/admin/review/InfoCards";
import { OfferPanel } from "@/features/admin/review/OfferPanel";
import { ReviewActions } from "@/features/admin/review/ReviewActions";
import type { ReviewAd } from "@/features/admin/review/types";

export const metadata = { title: "Админ · Шинэ зар ба санал" };

export default async function AdminReview({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; id?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const tab: ReviewTab = sp.tab === "contacted" || sp.tab === "rejected" ? sp.tab : "pending";
  const [settings, pending, queue] = await Promise.all([getSettings(), pendingCount(), reviewQueue(tab)]);

  // ?id= заасан зар жагсаалтад байхгүй бол (өөр төлөвтэй) тусад нь ачаална
  const ad = sp.id ? (queue.ads.find((a) => a.id === sp.id) ?? (await adById(sp.id))) : (queue.ads[0] ?? null);

  const tabs = [
    { key: "pending", label: `Хүлээгдэж буй ${queue.counts.pending}` },
    { key: "contacted", label: `Холбогдсон ${queue.counts.contacted}` },
    { key: "rejected", label: "Татгалзсан" },
  ];

  return (
    <PanelShell profile={me} area="admin" active="admin-review" pending={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display m-0 text-[28px]">Шинэ зар ба санал</h1>
        <nav aria-label="Төлөв" className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/review?tab=${t.key}`}
              aria-current={t.key === tab ? "page" : undefined}
              className={`flex h-10 items-center rounded-full px-3.5 text-[14px] no-underline ${t.key === tab ? "bg-ink font-semibold text-yellow" : "border border-line-2 bg-card"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap items-start gap-4.5">
        <ReviewList ads={queue.ads} selected={ad?.id} tab={tab} cutoff={settings.cutoff_year} />
        {ad ? (
          <AdReview ad={ad} tab={tab} cutoff={settings.cutoff_year} percent={settings.offer_percent} />
        ) : (
          <section className="card flex-[999_1_520px] p-10 text-center text-muted">Зар сонгоно уу.</section>
        )}
      </div>
    </PanelShell>
  );
}

async function AdReview({
  ad,
  tab,
  cutoff,
  percent,
}: {
  ad: ReviewAd;
  tab: string;
  cutoff: number;
  percent: number | null;
}) {
  const [details, agents] = await Promise.all([adDetails(ad), agentOptions()]);
  // Онцлох (шимтгэлгүй) зарыг төлбөр баталгаажаагүй бол нийтлэхгүй
  const paymentMissing =
    ad.plan === "paid" &&
    (ad.status === "pending" || ad.status === "rejected") &&
    details.payment?.status !== "confirmed";

  return (
    <section aria-label="Сонгосон зар" className="card flex min-w-0 flex-[999_1_520px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="cat-chip">{categoryLabel(ad.category, cutoff)}</span>
            <StatusBadge status={ad.status} />
            {ad.plan && <span className="cat-chip">{PLAN_LABEL[ad.plan]}</span>}
            <span className="text-[12px] text-muted">{timeAgo(ad.created_at)}</span>
            {ad.contacted_at && <span className="badge bg-active-bg text-active-fg">Холбогдсон</span>}
          </div>
          <h2 className="m-0 text-[24px] font-bold">
            {ad.brand} {ad.model}
            {ad.trim ? ` · ${ad.trim}` : ""}
          </h2>
        </div>
        <span className="h-display text-[24px]">{money(ad.price)}</span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
        {ad.photos.map((p, i) => (
          <a key={p} href={`/ads/${ad.id}`} aria-label={`Зураг ${i + 1}`}>
            <CarPhoto path={p} alt="" className="aspect-[4/3] w-full rounded-md" />
          </a>
        ))}
      </div>

      <div className="flex flex-wrap gap-3.5">
        <SellerCard ad={ad} stats={details.sellerStats} />
        <VehicleCard ad={ad} payment={details.payment} />
      </div>

      {(ad.modifications || ad.description) && (
        <div className="flex flex-col gap-1.5 text-[14px] leading-relaxed">
          {ad.modifications && (
            <p className="m-0">
              <strong>Нэмж хийсэн:</strong> {ad.modifications}
            </p>
          )}
          {ad.description && (
            <p className="m-0 whitespace-pre-line">
              <strong>Тайлбар:</strong> {ad.description}
            </p>
          )}
        </div>
      )}

      <OfferPanel
        ad={ad}
        percent={percent}
        back={`/admin/review?tab=${tab}&id=${ad.id}`}
        leads={details.leads}
        chats={details.chats}
        agents={agents}
      />
      <ReviewActions ad={ad} tab={tab} paymentMissing={paymentMissing} />
    </section>
  );
}
