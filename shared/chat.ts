/** Чатын огноо, цагийг Улаанбаатарын цагаар */
const TZ = "Asia/Ulaanbaatar";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export const timeHM = (iso: string) => hmFmt.format(new Date(iso));

/** "Өнөөдөр", "Өчигдөр" эсвэл "2026.10.09" */
export function dayLabel(iso: string, now: Date = new Date()) {
  const d = dayFmt.format(new Date(iso));
  if (d === dayFmt.format(now)) return "Өнөөдөр";
  if (d === dayFmt.format(new Date(now.getTime() - 864e5))) return "Өчигдөр";
  return d.replace(/-/g, ".");
}

/** Мессежийн урт, хоосон эсэхийг шалгана (сервер мөн шалгадаг) */
export function cleanMessage(s: string): string | null {
  const t = s.trim();
  return t && t.length <= 1000 ? t : null;
}
