"use client";

import { useState } from "react";
import { photoUrl } from "@/lib/format";

export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!photos.length)
    return <div className="ph-stripes aspect-[16/10] rounded-[18px] flex items-center justify-center mono text-muted">Зураггүй</div>;
  const go = (d: number) => setI((v) => (v + d + photos.length) % photos.length);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative aspect-[16/10] rounded-[18px] overflow-hidden bg-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(photos[i])!} alt={`${alt}, зураг ${i + 1}`} className="w-full h-full object-cover" />
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Өмнөх зураг" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-card/90 text-ink text-xl cursor-pointer border-0">‹</button>
            <button type="button" aria-label="Дараах зураг" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-card/90 text-ink text-xl cursor-pointer border-0">›</button>
          </>
        )}
        <span className="mono absolute right-3.5 bottom-3.5 bg-ink text-paper text-[12px] px-2.5 py-1 rounded-md">
          {i + 1} / {photos.length}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {photos.map((p, n) => (
          <button
            key={p}
            type="button"
            aria-label={`Зураг ${n + 1}`}
            aria-pressed={n === i}
            onClick={() => setI(n)}
            className={`aspect-square rounded-lg overflow-hidden p-0 cursor-pointer border-0 ${n === i ? "outline-2 outline-ink -outline-offset-2" : "opacity-80 hover:opacity-100"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(p)!} alt="" loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
