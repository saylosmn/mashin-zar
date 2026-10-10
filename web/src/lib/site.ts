/**
 * Сайтын бүтэн хаяг (sitemap, OG зураг, агентын холбоос).
 * Домэйн авсны дараа Vercel-д NEXT_PUBLIC_SITE_URL=https://таны-домэйн тохируулна.
 */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return (env || "https://web-mu-fawn-45.vercel.app").replace(/\/+$/, "");
}

export const SITE_NAME = "Машин зар";

/** Агентын урилгын холбоос (нүүр хуудас ?ref=КОД → зар оруулахад код автоматаар бөглөгдөнө) */
export const agentLink = (code: string) => `${siteUrl()}/?ref=${encodeURIComponent(code)}`;

/** Агентын код: 4–12 латин үсэг/тоо. Бусад үед null. */
export function normAgentCode(v: string | null | undefined): string | null {
  const c = String(v ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : null;
}
