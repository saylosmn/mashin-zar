import { useSyncExternalStore } from "react";

/** Машин харьцуулах жагсаалт (хамгийн ихдээ 3 зар) — вэбийн web/src/lib/compare.ts-тэй ижил дүрэм. */
export const COMPARE_MAX = 3;
export const COMPARE_KEY = "mz-compare";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "a,b,c" эсвэл массиваас давхардалгүй, зөв UUID-уудыг (дараалал хадгалж) авна. */
export function parseIds(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input) ? input : String(input ?? "").split(",");
  const out: string[] = [];
  for (const r of raw) {
    const id = r.trim().toLowerCase();
    if (UUID.test(id) && !out.includes(id)) out.push(id);
    if (out.length === COMPARE_MAX) break;
  }
  return out;
}

/** Нэмэх/хасах. Дүүрсэн үед нэмбэл хамгийн эхнийхийг гаргана. */
export function toggleId(list: string[], id: string): string[] {
  const key = id.toLowerCase();
  if (list.includes(key)) return list.filter((x) => x !== key);
  const next = [...list, key];
  return next.length > COMPARE_MAX ? next.slice(next.length - COMPARE_MAX) : next;
}


/** Хүснэгтийн мөрөнд хамгийн сайн утгыг тодруулах: min (үнэ) эсвэл max (он). Тэнцүү бол бүгд. */
export function bestIndexes(values: (number | null | undefined)[], mode: "min" | "max"): number[] {
  const nums = values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  const valid = nums.filter((v): v is number => v != null);
  if (valid.length < 2) return [];
  const best = mode === "min" ? Math.min(...valid) : Math.max(...valid);
  if (valid.every((v) => v === best)) return [];
  return nums.flatMap((v, i) => (v === best ? [i] : []));
}

// ---------- Апп: төхөөрөмжид хадгалах (expo-sqlite localStorage) ----------

const listeners = new Set<() => void>();
let cached: { raw: string | null; ids: string[] } = { raw: null, ids: [] };

function readIds(): string[] {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(COMPARE_KEY) ?? null;
  } catch {
    return cached.ids;
  }
  if (raw === cached.raw) return cached.ids;
  let list: unknown = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  cached = { raw, ids: parseIds(Array.isArray(list) ? (list as string[]) : []) };
  return cached.ids;
}

function writeIds(ids: string[]) {
  const raw = JSON.stringify(ids);
  try {
    globalThis.localStorage?.setItem(COMPARE_KEY, raw);
  } catch {
    // хадгалж чадаагүй ч санах ойд үлдэнэ
  }
  cached = { raw, ids };
  listeners.forEach((l) => l());
}

export function useCompare() {
  const ids = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readIds,
    readIds,
  );
  return {
    ids,
    toggle: (id: string) => writeIds(toggleId(readIds(), id)),
    remove: (id: string) => writeIds(readIds().filter((x) => x !== id.toLowerCase())),
    clear: () => writeIds([]),
  };
}
