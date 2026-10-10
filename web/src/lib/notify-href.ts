import type { Notification, Role } from "./types";

/** Мэдэгдэл дээр дарахад очих хуудас. */
export function notifyHref(n: Pick<Notification, "type" | "ad_id">, role: Role | null | undefined): string {
  const staff = Boolean(role && role !== "user");
  if (n.type === "sale_report") return "/admin/reports";
  if (n.type === "report_reviewed") return "/manager/reports";
  if (n.type === "loan_request") return "/leasing";
  if (n.type === "loan_update") return "/loans";
  if (n.ad_id) return n.type === "staff_new_ad" && staff ? `/manager/ads?id=${n.ad_id}` : `/ads/${n.ad_id}`;
  return "/notifications";
}
