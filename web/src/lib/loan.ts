/** Лизингийн тооцоо — өгөгдлийн сангийн loan_monthly-тай ижил томьёо (аннуитет). */
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

export const LOAN_STATUS: Record<LoanStatus, { label: string; cls: string }> = {
  new: { label: "Шинэ", cls: "bg-pending-bg text-pending-fg" },
  contacted: { label: "Холбогдсон", cls: "bg-active-bg text-active-fg" },
  approved: { label: "Зөвшөөрсөн", cls: "bg-[#DDF3E4] text-[#1D6B3A]" },
  rejected: { label: "Татгалзсан", cls: "bg-danger-bg text-[#9b1c1c]" },
  cancelled: { label: "Цуцалсан", cls: "bg-soft text-body" },
};

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

export const minDown = (price: number, pct: number) => Math.ceil((price * pct) / 100);
