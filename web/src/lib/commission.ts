/**
 * Шимтгэл, агентын хувь, зарын хугацааны тооцоо.
 * Өгөгдлийн сангийн commission_for / submit_sale_report / expire_ads_job-той ижил дүрмээр
 * (маягт дээр урьдчилж харуулахад ашиглана; эцсийн дүнг сервер тооцно).
 */
import type { ContractTerms } from "./contract";

const HOUR = 36e5;
const DAY = 24 * HOUR;

/** Нийтлэгдсэнээс зарагдах хүртэлх хугацаагаар шимтгэлийн хувь, хоног. */
export function commissionFor(terms: ContractTerms, publishedAt: string | Date, soldAt: string | Date = new Date()) {
  const hrs = Math.max(0, (new Date(soldAt).getTime() - new Date(publishedAt).getTime()) / HOUR);
  const tier = [...terms.tiers].sort((a, b) => a.days - b.days).find((t) => hrs <= t.days * 24);
  return { days: Math.max(1, Math.ceil(hrs / 24)), percent: tier ? tier.percent : terms.after };
}

/** Шимтгэлийн дүн (₮), бүхэл тоогоор. */
export const commissionAmount = (price: number, percent: number) => Math.round((price * percent) / 100);

/** Агентад ногдох дүн: шимтгэлийн share%. */
export const agentAmount = (commission: number, sharePercent: number) =>
  Math.round((commission * Math.min(100, Math.max(0, sharePercent))) / 100);

export type Expiry = {
  /** Хугацаа тооцогдоогүй (хүлээгдэж буй, хуучин өгөгдөл) */
  none: boolean;
  expired: boolean;
  /** Үлдсэн бүтэн хоног (дээш тоймлосон). Дууссан бол 0. */
  daysLeft: number;
  /** Сунгах товч харуулах эсэх (7 хоног үлдсэн эсвэл дууссан) */
  renewable: boolean;
};

export function expiryInfo(expiresAt: string | null | undefined, now: Date = new Date()): Expiry {
  if (!expiresAt) return { none: true, expired: false, daysLeft: 0, renewable: false };
  const ms = new Date(expiresAt).getTime() - now.getTime();
  const expired = ms <= 0;
  const daysLeft = expired ? 0 : Math.ceil(ms / DAY);
  return { none: false, expired, daysLeft, renewable: expired || ms <= 7 * DAY };
}

/** Онцлох хугацаа идэвхтэй эсэх */
export const isFeatured = (until: string | null | undefined, now: Date = new Date()) =>
  Boolean(until && new Date(until).getTime() > now.getTime());

/** Онцлох хүсэлт сүүлийн 24 цагт илгээгдсэн эсэх */
export const recentlyRequested = (at: string | null | undefined, now: Date = new Date()) =>
  Boolean(at && now.getTime() - new Date(at).getTime() < 864e5);

/** Одоогоос N цагийн өмнөх ISO хугацаа */
export const hoursAgo = (h: number, now: Date = new Date()) => new Date(now.getTime() - h * 36e5).toISOString();
