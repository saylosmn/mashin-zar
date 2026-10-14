import Link from "next/link";
import { categoryLabel, money, timeAgo } from "@/lib/format";
import { PLAN_LABEL } from "@/lib/payments";
import { CarPhoto } from "@/components/CarPhoto";
import type { ReviewAd } from "./types";

export function ReviewList({
  ads,
  selected,
  tab,
  cutoff,
}: {
  ads: ReviewAd[];
  selected?: string;
  tab: string;
  cutoff: number;
}) {
  return (
    <ul aria-label="Зарууд" className="m-0 flex flex-[1_1_300px] list-none flex-col gap-2 p-0">
      {ads.length === 0 && <li className="card px-4 py-6 text-center text-[14px] text-muted">Энд зар алга.</li>}
      {ads.map((a) => (
        <li key={a.id}>
          <Link
            href={`/admin/review?tab=${tab}&id=${a.id}`}
            aria-current={selected === a.id ? "true" : undefined}
            className={`flex gap-3 rounded-[14px] bg-card p-3 no-underline ${selected === a.id ? "border-2 border-ink" : "border border-line"}`}
          >
            <CarPhoto path={a.photos[0]} alt="" className="h-[52px] w-16 shrink-0 rounded-lg" label="IMG" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex justify-between gap-2">
                <span className="truncate text-[14px] font-semibold">
                  {a.brand} {a.model}
                </span>
                <span className="shrink-0 text-[12px] text-muted">{timeAgo(a.created_at)}</span>
              </div>
              <span className="text-[13px] text-body">
                {a.year_made} · {categoryLabel(a.category, cutoff)} · {a.photos.length} зураг
              </span>
              <span className="h-display text-[13px]">{money(a.price)}</span>
              {a.plan === "paid" && (
                <span className="text-[12px] font-semibold text-pending-fg">💳 {PLAN_LABEL.paid}</span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
