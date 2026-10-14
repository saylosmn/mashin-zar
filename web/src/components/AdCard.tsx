import Link from "next/link";
import { CarPhoto } from "./CarPhoto";
import { categoryLabel, money } from "@/lib/format";
import type { PublicAd } from "@shared/types";

export function AdCard({ ad, cutoff }: { ad: PublicAd; cutoff: number }) {
  return (
    <Link
      href={`/ads/${ad.id}`}
      className={`card flex flex-col overflow-hidden no-underline transition-colors hover:border-ink ${ad.featured ? "border-2 border-yellow" : ""}`}
    >
      <div className="relative">
        <CarPhoto path={ad.photos[0]} alt={`${ad.brand} ${ad.model}`} className="h-[190px] w-full" />
        <span className="cat-chip absolute top-3 left-3">{categoryLabel(ad.category, cutoff)}</span>
        {ad.featured && (
          <span className="absolute top-3 right-3 rounded bg-yellow px-2 py-0.5 text-[11px] font-bold text-ink shadow-sm">
            ⭐ Онцлох
          </span>
        )}
        {ad.seller_shop && (
          <span className="absolute bottom-3 left-3 max-w-[60%] truncate rounded bg-yellow px-2 py-0.5 text-[11px] font-bold text-ink">
            🏪 {ad.seller_shop}
          </span>
        )}
        {ad.photos.length > 0 && (
          <span className="mono absolute right-3 bottom-3 rounded bg-ink/85 px-2 py-0.5 text-[11px] text-paper">
            {ad.photos.length} зураг
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[16px] font-semibold">
            {ad.brand} {ad.model}
          </span>
          <span className="plate shrink-0">{ad.plate_masked}</span>
        </div>
        <span className="truncate text-[13px] text-muted">
          Үйлд. {ad.year_made}
          {ad.year_imported ? ` · Орж ирсэн ${ad.year_imported}` : ""}
          {ad.trim ? ` · ${ad.trim}` : ""}
        </span>
        <span className="h-display text-[18px]">{money(ad.price)}</span>
      </div>
    </Link>
  );
}
