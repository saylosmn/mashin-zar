import { useSyncExternalStore } from "react";
import { COMPARE_KEY, parseIds, toggleId } from "@shared/compare";

export { COMPARE_MAX, bestIndexes, parseIds, toggleId } from "@shared/compare";

// Жагсаалтыг expo-sqlite-ийн localStorage-д хадгална.
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
