"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPARE_KEY, COMPARE_MAX, compareHref, parseIds, toggleId } from "@shared/compare";

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
  return {
    ids,
    toggle: (id: string) => write(toggleId(read(), id)),
    clear: () => write([]),
    set: (v: string[]) => write(parseIds(v)),
  };
}

/** Зарын хуудсан дээрх "Харьцуулах" товч */
export function CompareToggle({ adId }: { adId: string }) {
  const { ids, toggle } = useCompare();
  const on = ids.includes(adId.toLowerCase());
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggle(adId)}
      className={`btn btn-lg ${on ? "btn-ink" : "btn-ghost"}`}
    >
      {on ? "✓ Харьцуулалтад нэмсэн" : "⇄ Харьцуулах"}
    </button>
  );
}

/** Доод талд хөвөх самбар: сонгосон машин байвал харьцуулах хуудас руу */
export function CompareBar() {
  const { ids, clear } = useCompare();
  const path = usePathname();
  if (!ids.length || path.startsWith("/compare") || path.startsWith("/messages")) return null;
  return (
    <div className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-paper shadow-lg sm:bottom-6">
      <span className="text-[13px] whitespace-nowrap">
        Харьцуулах:{" "}
        <strong className="mono text-yellow">
          {ids.length}/{COMPARE_MAX}
        </strong>
      </span>
      <button
        type="button"
        onClick={clear}
        className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-pale underline"
      >
        Цэвэрлэх
      </button>
      {ids.length < 2 ? (
        <span className="pr-2.5 text-[12px] whitespace-nowrap text-pale">Дахиад 1 машин сонгоно уу</span>
      ) : (
        <Link href={compareHref(ids)} className="btn btn-sm btn-yellow rounded-full">
          Харьцуулах →
        </Link>
      )}
    </div>
  );
}
