import { AD_STATUS_LABEL, timeAgo as relative } from "@shared/format";
import type { AdStatus } from "@shared/types";

export * from "@shared/format";

export function photoUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ad-photos/${path}`;
}

const STATUS_CLS: Record<AdStatus, string> = {
  pending: "bg-pending-bg text-pending-fg",
  active: "bg-active-bg text-active-fg",
  sold: "bg-sold-bg text-sold-fg",
  rejected: "bg-danger-bg text-[#9b1c1c]",
  hidden: "bg-soft text-body",
};

export const STATUS = Object.fromEntries(
  (Object.keys(AD_STATUS_LABEL) as AdStatus[]).map((s) => [s, { label: AD_STATUS_LABEL[s], cls: STATUS_CLS[s] }]),
) as Record<AdStatus, { label: string; cls: string }>;

export const monthLabel = (d: Date) => `${d.getMonth() + 1}-р сар`;

// Сервер UTC дээр ажилладаг тул огноог Улаанбаатарын цагаар хөрвүүлнэ.
const UB_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ulaanbaatar",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** "2026 оны 10-р сарын 09" */
export function dateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = Object.fromEntries(UB_DATE.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year} оны ${Number(p.month)}-р сарын ${String(p.day).padStart(2, "0")}`;
}

export const timeAgo = (iso: string) => relative(iso, dateShort);
