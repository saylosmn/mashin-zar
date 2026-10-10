"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPARE_KEY, COMPARE_MAX, compareHref, parseIds, toggleId } from "@/lib/compare";

/** Харьцуулах жагсаалт: localStorage + таб хооронд синк. Storage ажиллахгүй үед зөвхөн санах ойд. */
let memory: string[] = [];
const listeners = new Set<() => void>();
let cached: { raw: string | null; ids: string[] } = { raw: null, ids: [] };

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COMPARE_KEY);
  } catch {
    return memory;
  }
  if (raw === cached.raw) return cached.ids;
  let list: string[] = [];
  try {
    list = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    list = [];
  }
  cached = { raw, ids: parseIds(Array.isArray(list) ? list : []) };
  return cached.ids;
}
function write(ids: string[]) {
  memory = ids;
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
  } catch {
    /* хувийн цонх */
  }
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === COMPARE_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}
const EMPTY: string[] = [];
export function useCompare() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  return { ids, toggle: (id: string) => write(toggleId(read(), id)), clear: () => write([]), set: (v: string[]) => write(parseIds(v)) };
}

/** Зарын хуудсан дээрх "Харьцуулах" товч */
export function CompareToggle({ adId }: { adId: string }) {
  const { ids, toggle } = useCompare();
  const on = ids.includes(adId.toLowerCase());
  return (
    <button type="button" aria-pressed={on} onClick={() => toggle(adId)} className={`btn btn-lg ${on ? "btn-ink" : "btn-ghost"}`}>
      {on ? "✓ Харьцуулалтад нэмсэн" : "⇄ Харьцуулах"}
    </button>
  );
}

/** Доод талд хөвөх самбар: сонгосон машин байвал харьцуулах хуудас руу */
export function CompareBar() {
  const { ids, clear } = useCompare();
  const path = usePathname();
  if (!ids.length || path.startsWith("/compare")) return null;
  return (
    <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(84px+env(safe-area-inset-bottom))] sm:bottom-6 bg-ink text-paper rounded-full shadow-lg pl-4 pr-1.5 py-1.5 flex items-center gap-3 max-w-[calc(100vw-24px)]">
      <span className="text-[13px] whitespace-nowrap">Харьцуулах: <strong className="mono text-yellow">{ids.length}/{COMPARE_MAX}</strong></span>
      <button type="button" onClick={clear} className="text-[12px] text-pale underline bg-transparent border-0 p-0 cursor-pointer">Цэвэрлэх</button>
      {ids.length < 2 ? (
        <span className="text-[12px] text-pale pr-2.5 whitespace-nowrap">Дахиад 1 машин сонгоно уу</span>
      ) : (
        <Link href={compareHref(ids)} className="btn btn-sm btn-yellow rounded-full">Харьцуулах →</Link>
      )}
    </div>
  );
}
