import Link from "next/link";
import { CarPhoto } from "./CarPhoto";
import { categoryLabel, money } from "@/lib/format";
import type { PublicAd } from "@/lib/types";

export function AdCard({ ad, cutoff }: { ad: PublicAd; cutoff: number }) {
  return (
    <Link href={`/ads/${ad.id}`} className="card overflow-hidden flex flex-col no-underline hover:border-ink transition-colors">
      <div className="relative">
        <CarPhoto path={ad.photos[0]} alt={`${ad.brand} ${ad.model}`} className="w-full h-[190px]" />
        <span className="cat-chip absolute left-3 top-3">{categoryLabel(ad.category, cutoff)}</span>
        {ad.seller_shop && (
          <span className="absolute left-3 bottom-3 max-w-[60%] truncate bg-yellow text-ink text-[11px] font-bold px-2 py-0.5 rounded">
            🏪 {ad.seller_shop}
          </span>
        )}
        {ad.photos.length > 0 && (
          <span className="mono absolute right-3 bottom-3 bg-ink/85 text-paper text-[11px] px-2 py-0.5 rounded">
            {ad.photos.length} зураг
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-4">
        <div className="flex justify-between items-center gap-2">
          <span className="font-semibold text-[16px] truncate">
            {ad.brand} {ad.model}
          </span>
          <span className="plate shrink-0">{ad.plate_masked}</span>
        </div>
        <span className="text-[13px] text-muted truncate">
          Үйлд. {ad.year_made}
          {ad.year_imported ? ` · Орж ирсэн ${ad.year_imported}` : ""}
          {ad.trim ? ` · ${ad.trim}` : ""}
        </span>
        <span className="h-display text-[18px]">{money(ad.price)}</span>
      </div>
    </Link>
  );
}
