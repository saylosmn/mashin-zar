"use client";

import { useState, type ReactNode } from "react";

/** Утсан дээр товчоор нээгддэг, том дэлгэц дээр үргэлж харагдах хэсэг (жишээ нь шүүлтүүр). */
export function MobileCollapse({ label, count = 0, className = "", children }: { label: string; count?: number; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="lg:hidden w-full h-12 px-4 rounded-xl bg-card border border-line-2 flex items-center justify-between text-[15px] font-semibold cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 5h18M6 12h12M10 19h4" /></svg>
          {label}
          {count > 0 && <span className="mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-ink text-yellow">{count}</span>}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={open ? "rotate-180" : ""}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className={`${open ? "block mt-3" : "hidden"} lg:block lg:mt-0`}>{children}</div>
    </div>
  );
}
