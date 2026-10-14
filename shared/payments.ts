import type { PayStatus, Plan } from "./types";

export const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  awaiting: "Төлбөр хүлээгдэж байна",
  submitted: "Төлбөр шалгагдаж байна",
  confirmed: "Төлбөр баталгаажсан",
  rejected: "Төлбөр орж ирээгүй",
  cancelled: "Цуцлагдсан",
};

export const PLAN_LABEL: Record<Plan, string> = {
  commission: "Шимтгэлтэй",
  paid: "Онцлох · шимтгэлгүй",
};

/** Хэрэглэгч төлөх (эсвэл дахин илгээх) ёстой юу */
export const needsAction = (s: PayStatus) => s === "awaiting" || s === "rejected";
