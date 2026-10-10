import type { AdStatus, Category } from "./types";

export const money = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(n)) + "₮";

export const num = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("en-US").format(n));

export function photoUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ad-photos/${path}`;
}

export function categoryLabel(c: Category, cutoff = 2016) {
  return c === "new" ? `${cutoff}+` : `${cutoff}-аас өмнө`;
}

export function categoryLong(c: Category, cutoff = 2016) {
  return c === "new" ? `${cutoff} ба хойш` : `${cutoff}-аас өмнө`;
}

export const STATUS: Record<AdStatus, { label: string; cls: string }> = {
  pending: { label: "Хүлээгдэж буй", cls: "bg-pending-bg text-pending-fg" },
  active: { label: "Идэвхтэй", cls: "bg-active-bg text-active-fg" },
  sold: { label: "Зарагдсан", cls: "bg-sold-bg text-sold-fg" },
  rejected: { label: "Татгалзсан", cls: "bg-danger-bg text-[#9b1c1c]" },
  hidden: { label: "Нуусан", cls: "bg-soft text-body" },
};

export const roleLabel = (r?: string | null) =>
  r === "admin" ? "Админ" : r === "manager" ? "Менежер" : r === "dealer" ? "Авто худалдаа" : r === "leasing" ? "Лизинг" : "Хэрэглэгч";

const MONTHS = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"];
export const monthLabel = (d: Date) => MONTHS[d.getMonth()];

const UB_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "numeric", day: "numeric" });

/** "2026 оны 10-р сарын 09" — Улаанбаатарын цагаар (сервер UTC дээр ажилладаг тул). */
export function dateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = Object.fromEntries(UB_DATE.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year} оны ${Number(p.month)}-р сарын ${String(p.day).padStart(2, "0")}`;
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "дөнгөж сая";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Өчигдөр";
  if (d < 30) return `${d} өдөр`;
  return dateShort(iso);
}

export const initial = (name: string | null | undefined) => (name?.trim()?.[0] ?? "?").toUpperCase();

export const errMsg = (e: unknown) =>
  e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Алдаа гарлаа";
