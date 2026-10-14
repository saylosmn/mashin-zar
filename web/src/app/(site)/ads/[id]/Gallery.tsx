"use client";

import { useState } from "react";
import { photoUrl } from "@/lib/format";

export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!photos.length)
    return (
      <div className="ph-stripes mono flex aspect-[16/10] items-center justify-center rounded-[18px] text-muted">
        Зураггүй
      </div>
    );
  const go = (d: number) => setI((v) => (v + d + photos.length) % photos.length);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[18px] bg-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(photos[i])!} alt={`${alt}, зураг ${i + 1}`} className="h-full w-full object-cover" />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Өмнөх зураг"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-3 h-11 w-11 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-card/90 text-xl text-ink"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Дараах зураг"
              onClick={() => go(1)}
              className="absolute top-1/2 right-3 h-11 w-11 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-card/90 text-xl text-ink"
            >
              ›
            </button>
          </>
        )}
        <span className="mono absolute right-3.5 bottom-3.5 rounded-md bg-ink px-2.5 py-1 text-[12px] text-paper">
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
            className={`aspect-square cursor-pointer overflow-hidden rounded-lg border-0 p-0 ${n === i ? "outline-2 -outline-offset-2 outline-ink" : "opacity-80 hover:opacity-100"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(p)!} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
