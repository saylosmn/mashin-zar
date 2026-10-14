import type { Notification, Role } from "@shared/types";

/** Мэдэгдэл дээр дарахад очих хуудас (SQL-ийн notify_url-тэй ижил дүрэм). */
export function notifyHref(n: Pick<Notification, "type" | "ad_id">, role: Role | null | undefined): string {
  const staff = role === "admin";
  switch (n.type) {
    case "sale_report":
      return "/admin/reports";
    case "report_reviewed":
      return "/admin/reports";
    case "loan_request":
      return "/leasing";
    case "loan_update":
      return "/loans";
    case "agent_commission":
      return "/agent";
    case "message":
      return "/messages";
    case "ad_expiring":
    case "ad_expired":
    case "featured_on":
      return "/my";
    case "ad_flag":
      return staff ? "/admin/flags" : "/notifications";
    case "featured_request":
      return role === "admin" ? "/admin/ads?featured=1" : "/notifications";
    case "payment_submitted":
      return role === "admin" ? "/admin/payments" : "/notifications";
    case "payment_ok":
    case "payment_rejected":
      return n.ad_id ? `/pay/${n.ad_id}` : "/my";
  }
  if (n.ad_id) return n.type === "staff_new_ad" && staff ? `/admin/review?id=${n.ad_id}` : `/ads/${n.ad_id}`;
  return "/notifications";
}
