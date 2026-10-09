/** Лизингийн тооцоо — өгөгдлийн сангийн loan_monthly-тай ижил томьёо (аннуитет). Вэбийн web/src/lib/loan.ts-тай ижил. */
import { C } from "./theme";

export type Partner = {
  id: string;
  name: string;
  phone: string | null;
  rate_annual: number;
  min_down_pct: number;
  max_term_months: number;
  trial_until: string | null;
  active: boolean;
};

export type LoanStatus = "new" | "contacted" | "approved" | "rejected" | "cancelled";

export type LoanRequest = {
  id: string;
  ad_id: string | null;
  user_id: string;
  partner_id: string;
  full_name: string;
  phone: string;
  car: string;
  price: number;
  down_payment: number;
  term_months: number;
  rate_annual: number;
  monthly_payment: number;
  income: string | null;
  note: string | null;
  status: LoanStatus;
  partner_note: string | null;
  created_at: string;
  updated_at: string;
};

export const LOAN_STATUS: Record<LoanStatus, { label: string; bg: string; fg: string }> = {
  new: { label: "Шинэ", bg: C.pendingBg, fg: C.pendingFg },
  contacted: { label: "Холбогдсон", bg: C.activeBg, fg: C.activeFg },
  approved: { label: "Зөвшөөрсөн", bg: "#DDF3E4", fg: "#1D6B3A" },
  rejected: { label: "Татгалзсан", bg: C.dangerBg, fg: "#9B1C1C" },
  cancelled: { label: "Цуцалсан", bg: C.soft, fg: C.body },
};

export const INCOME_OPTIONS = ["1.5 саяас доош", "1.5–3 сая", "3–5 сая", "5 саяас дээш"];

export function monthlyPayment(principal: number, rateAnnual: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  if (!rateAnnual) return Math.round(principal / months);
  const r = rateAnnual / 1200;
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
}

export function termOptions(max: number) {
  const base = [6, 12, 18, 24, 30, 36, 48, 60, 72, 84, 96, 120];
  const list = base.filter((m) => m <= max);
  if (!list.includes(max)) list.push(max);
  return list;
}

export const minDown = (price: number, pct: number) => Math.ceil((price * Number(pct)) / 100);

export const fmtNum = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
