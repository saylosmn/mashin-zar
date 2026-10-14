import type { AdStatus, Category, Role } from "./types";

export const num = (n: number | null | undefined) =>
  n == null ? "—" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const money = (n: number | null | undefined) => (n == null ? "—" : `${num(n)}₮`);

export const categoryLabel = (c: Category, cutoff = 2016) => (c === "new" ? `${cutoff}+` : `${cutoff}-аас өмнө`);
export const categoryLong = (c: Category, cutoff = 2016) => (c === "new" ? `${cutoff} ба хойш` : `${cutoff}-аас өмнө`);

export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  pending: "Хүлээгдэж буй",
  active: "Идэвхтэй",
  sold: "Зарагдсан",
  rejected: "Татгалзсан",
  hidden: "Нуусан",
};

const ROLE_LABEL: Record<Role, string> = {
  user: "Хэрэглэгч",
  admin: "Админ",
  dealer: "Авто худалдаа",
  leasing: "Лизинг",
  agent: "Агент",
};

export const roleLabel = (r?: string | null) => ROLE_LABEL[r as Role] ?? ROLE_LABEL.user;

export const initial = (name: string | null | undefined) => (name?.trim()?.[0] ?? "?").toUpperCase();

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}-р сарын ${d.getDate()}`;
};

export function timeAgo(iso: string, older: (iso: string) => string = shortDate) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "дөнгөж сая";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Өчигдөр";
  if (d < 30) return `${d} өдөр`;
  return older(iso);
}

const KNOWN_ERRORS: [RegExp, string][] = [
  [/Network request failed|Failed to fetch|network/i, "Интернэт холболтоо шалгаад дахин оролдоно уу"],
  [/row-level security|permission denied/i, "Энэ үйлдлийг хийх эрх байхгүй байна"],
  [/JWT expired|invalid JWT|refresh token/i, "Нэвтрэлтийн хугацаа дууссан. Дахин нэвтэрнэ үү"],
  [/duplicate key/i, "Энэ мэдээлэл аль хэдийн бүртгэгдсэн байна"],
  [/Payload too large|exceeded the maximum allowed size/i, "Файл хэт том байна"],
];

// Supabase/сүлжээний англи алдааг ойлгомжтой болгоно. DB-ээс ирсэн монгол мессежийг хэвээр нь.
export function errMsg(e: unknown) {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : typeof e === "string"
        ? e
        : "";
  if (!msg) return "Алдаа гарлаа";
  for (const [re, text] of KNOWN_ERRORS) if (re.test(msg)) return text;
  return msg;
}
