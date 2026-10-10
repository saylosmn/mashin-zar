import type { Role } from "./types";

/** Мэдэгдэл/push дээр дарахад апп-ын аль дэлгэц нээх (вэбийн notifyHref-тэй ижил дүрэм). */
export function notifyRoute(type: string | undefined, adId: string | null | undefined, role?: Role | null): string {
  const staff = role == null || role === "manager" || role === "admin"; // push-д эрх мэдэгдэхгүй тул ажилтны дэлгэц рүү
  switch (type) {
    case "sale_report":
    case "report_reviewed": return "/panel/reports";
    case "loan_request": return "/panel/leasing";
    case "loan_update": return "/loans";
    case "agent_commission": return "/agent";
    case "ad_expiring":
    case "ad_expired":
    case "featured_on": return "/my";
    case "ad_flag": return staff ? "/panel/flags" : "/notifications";
    case "featured_request": return adId ? `/panel/ad/${adId}` : "/notifications";
  }
  if (adId) return type === "staff_new_ad" && staff ? `/panel/ad/${adId}` : `/ads/${adId}`;
  return "/notifications";
}
