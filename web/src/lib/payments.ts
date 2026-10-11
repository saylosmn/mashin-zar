import type { PayStatus, Plan } from "./types";

/** Төлбөрийн төлөвийн нэр, өнгө (вэб) */
export const PAY_STATUS: Record<PayStatus, { label: string; cls: string }> = {
  awaiting: { label: "Төлбөр хүлээгдэж байна", cls: "bg-pending-bg text-pending-fg" },
  submitted: { label: "Төлбөр шалгагдаж байна", cls: "bg-pending-bg text-pending-fg" },
  confirmed: { label: "Төлбөр баталгаажсан", cls: "bg-active-bg text-active-fg" },
  rejected: { label: "Төлбөр орж ирээгүй", cls: "bg-danger-bg text-[#9b1c1c]" },
  cancelled: { label: "Цуцлагдсан", cls: "bg-soft text-body" },
};

export const PLAN_LABEL: Record<Plan, string> = {
  commission: "Шимтгэлтэй",
  paid: "Онцлох · шимтгэлгүй",
};

/** Хэрэглэгч одоо төлөх/дахин илгээх шаардлагатай эсэх */
export const needsAction = (s: PayStatus) => s === "awaiting" || s === "rejected";
