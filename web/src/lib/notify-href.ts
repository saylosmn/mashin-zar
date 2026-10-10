import type { Notification, Role } from "./types";

/** Мэдэгдэл дээр дарахад очих хуудас (SQL-ийн notify_url-тэй ижил дүрэм). */
export function notifyHref(n: Pick<Notification, "type" | "ad_id">, role: Role | null | undefined): string {
  const staff = role === "manager" || role === "admin";
  switch (n.type) {
    case "sale_report": return "/admin/reports";
    case "report_reviewed": return "/manager/reports";
    case "loan_request": return "/leasing";
    case "loan_update": return "/loans";
    case "agent_commission": return "/agent";
    case "ad_expiring":
    case "ad_expired":
    case "featured_on": return "/my";
    case "ad_flag": return staff ? "/manager/flags" : "/notifications";
    case "featured_request": return role === "admin" ? "/admin/ads?featured=1" : "/notifications";
  }
  if (n.ad_id) return n.type === "staff_new_ad" && staff ? `/manager/ads?id=${n.ad_id}` : `/ads/${n.ad_id}`;
  return "/notifications";
}
