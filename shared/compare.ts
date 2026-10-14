// Харьцуулах жагсаалт: 3 хүртэл зар, URL нь /compare?ids=a,b,c
export const COMPARE_MAX = 3;
export const COMPARE_KEY = "mz-compare";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Дүүрсэн жагсаалтад нэмбэл хамгийн эхнийх нь гарна */
export function toggleId(list: string[], id: string): string[] {
  const key = id.toLowerCase();
  if (list.includes(key)) return list.filter((x) => x !== key);
  const next = [...list, key];
  return next.length > COMPARE_MAX ? next.slice(next.length - COMPARE_MAX) : next;
}

export const compareHref = (ids: string[]) => (ids.length ? `/compare?ids=${ids.join(",")}` : "/compare");

/** Мөр бүрийн шилдэг утгын индекс (үнэ: min, он: max). Бүгд тэнцүү бол хоосон. */
export function bestIndexes(values: (number | null | undefined)[], mode: "min" | "max"): number[] {
  const nums = values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  const valid = nums.filter((v): v is number => v != null);
  if (valid.length < 2) return [];
  const best = mode === "min" ? Math.min(...valid) : Math.max(...valid);
  if (valid.every((v) => v === best)) return [];
  return nums.flatMap((v, i) => (v === best ? [i] : []));
}
