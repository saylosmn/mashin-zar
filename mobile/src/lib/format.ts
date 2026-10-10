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
  hidden: { label: "Нуусан", bg: C.soft, fg: C.body },
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

const ERR_MAP: [RegExp, string][] = [
  [/Network request failed|Failed to fetch|network/i, "Интернэт холболтоо шалгаад дахин оролдоно уу"],
  [/row-level security|permission denied/i, "Энэ үйлдлийг хийх эрх байхгүй байна"],
  [/JWT expired|invalid JWT|refresh token/i, "Нэвтрэлтийн хугацаа дууссан. Дахин нэвтэрнэ үү"],
  [/duplicate key/i, "Энэ мэдээлэл аль хэдийн бүртгэгдсэн байна"],
  [/Payload too large|exceeded the maximum allowed size/i, "Файл хэт том байна"],
];

/** Алдааны мессеж — техникийн англи алдааг монгол болгоно, бусдыг хэвээр нь үлдээнэ. */
export const errMsg = (e: unknown) => {
  const msg =
    e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message)
    : typeof e === "string" ? e
    : "";
  if (!msg) return "Алдаа гарлаа";
  for (const [re, text] of ERR_MAP) if (re.test(msg)) return text;
  return msg;
};

export const roleLabel = (r?: string | null) =>
  r === "admin" ? "Админ" : r === "manager" ? "Менежер" : r === "dealer" ? "Авто худалдаа" : r === "leasing" ? "Лизинг" : r === "agent" ? "Агент" : "Хэрэглэгч";
