import type { AdStatus, Category } from "./types";
import { C } from "./theme";

export const money = (n: number | null | undefined) =>
  n == null ? "—" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "₮";

export const categoryLabel = (c: Category, cy = 2016) => (c === "new" ? `${cy}+` : `${cy}-аас өмнө`);
export const categoryLong = (c: Category, cy = 2016) => (c === "new" ? `${cy} ба хойш` : `${cy}-аас өмнө`);

export const STATUS: Record<AdStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Хүлээгдэж буй", bg: C.pendingBg, fg: C.pendingFg },
  active: { label: "Идэвхтэй", bg: C.activeBg, fg: C.activeFg },
  sold: { label: "Зарагдсан", bg: C.soldBg, fg: C.soldFg },
  rejected: { label: "Татгалзсан", bg: C.dangerBg, fg: "#9B1C1C" },
};

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
  const dt = new Date(iso);
  return `${dt.getMonth() + 1}-р сарын ${dt.getDate()}`;
}

export const initial = (s?: string | null) => (s?.trim()?.[0] ?? "?").toUpperCase();

export const errMsg = (e: unknown) =>
  e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Алдаа гарлаа";
