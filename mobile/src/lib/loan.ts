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
  min_age?: number;
  max_age?: number;
  min_work_months?: number;
  min_business_months?: number;
  max_dti?: number;
  min_car_year?: number | null;
  cosigner_over?: number | null;
  required_docs?: string[];
  requirements_note?: string | null;
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
  applicant?: Applicant;
  docs?: Record<string, string>;
  checks?: Check[];
  checks_ok?: boolean | null;
  dti?: number | null;
};

export type Check = { key: string; label: string; value: string; ok: boolean | null };

export type Applicant = {
  register_no?: string;
  birth_date?: string;
  age?: number;
  city?: string;
  district?: string;
  address?: string;
  marital_status?: string;
  household_size?: number;
  employment_type?: string;
  employer?: string;
  position?: string;
  work_months?: number;
  monthly_income?: number;
  other_income?: number;
  existing_debt_payment?: number;
  has_overdue?: boolean;
  has_license?: boolean;
  ref_name?: string;
  ref_phone?: string;
  ref_relation?: string;
  cosigner?: { name: string; phone: string; relation?: string; register_no?: string; monthly_income?: number };
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

/** Баримт бичгийн төрөл — өгөгдлийн сангийн loan_doc_kinds()-тэй ижил дараалал */
export const LOAN_DOCS: { kind: string; label: string; hint?: string }[] = [
  { kind: "id_front", label: "Иргэний үнэмлэх (нүүр тал)" },
  { kind: "id_back", label: "Иргэний үнэмлэх (ар тал)" },
  { kind: "ndsh", label: "НДШ төлөлтийн лавлагаа", hint: "e-mongolia.mn → Нийгмийн даатгал → Шимтгэл төлөлтийн лавлагаа (PDF)" },
  { kind: "bank_statement", label: "Цалингийн дансны хуулга (сүүлийн 6 сар)", hint: "Банкны апп-аас PDF-ээр татна" },
  { kind: "address", label: "Оршин суугаа хаягийн тодорхойлолт", hint: "e-mongolia.mn → Иргэний бүртгэл → Оршин суугаа хаягийн лавлагаа" },
  { kind: "employment", label: "Ажлын газрын тодорхойлолт" },
  { kind: "business", label: "Бизнесийн орлогын баримт (гэрчилгээ, хуулга)" },
  { kind: "credit", label: "Зээлийн мэдээллийн лавлагаа", hint: "e-mongolia.mn → Зээлийн мэдээллийн сангийн лавлагаа" },
  { kind: "license", label: "Жолооны үнэмлэх" },
  { kind: "photo", label: "Цээж зураг (сүүлийн 6 сар)" },
  { kind: "cosigner_id", label: "Хамтран зээлдэгчийн иргэний үнэмлэх" },
];
export const docLabel = (k: string) => LOAN_DOCS.find((d) => d.kind === k)?.label ?? k;
export const DEFAULT_REQUIRED_DOCS = ["id_front", "id_back", "ndsh", "bank_statement"];

export const MARITAL: Record<string, string> = { single: "Ганц бие", married: "Гэрлэсэн", divorced: "Салсан", widowed: "Бэлэвсэн" };
export const EMPLOYMENT: Record<string, string> = { salary: "Цалин", business: "Бизнес", both: "Цалин + бизнес", pension: "Тэтгэвэр", other: "Бусад" };

/** Регистрийн дугаараас төрсөн огноо (2000 оноос хойш төрсөн бол сар +20). Буруу бол null. */
export function rdBirthDate(rd: string): Date | null {
  const r = rd.replace(/\s/g, "").toUpperCase();
  if (!/^[А-ЯЁӨҮ]{2}[0-9]{8}$/.test(r)) return null;
  let y = Number(r.slice(2, 4)), m = Number(r.slice(4, 6));
  const d = Number(r.slice(6, 8));
  if (m > 20) { y += 2000; m -= 20; } else y += 1900;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || dt > new Date()) return null;
  return dt;
}

export function ageFrom(birth: Date, now = new Date()) {
  let a = now.getFullYear() - birth.getUTCFullYear();
  if (now.getMonth() < birth.getUTCMonth() || (now.getMonth() === birth.getUTCMonth() && now.getDate() < birth.getUTCDate())) a--;
  return a;
}

/** Хүсэлт илгээхээс өмнөх урьдчилсан шалгалт — submit_loan_request-ийн checks-тэй ижил дүрэм */
export function previewChecks(o: {
  partner: Partner; age: number | null; employment: string; workMonths: number; income: number; otherIncome: number;
  cosignerIncome: number; debt: number; monthly: number; hasOverdue: boolean | null; carYear: number; loan: number; hasCosigner: boolean;
}): { checks: Check[]; dti: number | null } {
  const p = o.partner;
  const minAge = p.min_age ?? 18, maxAge = p.max_age ?? 65, maxDti = Number(p.max_dti ?? 50);
  const total = o.income + o.otherIncome + o.cosignerIncome;
  const dti = total > 0 ? Math.round(((o.debt + o.monthly) * 10000) / total) / 100 : null;
  const business = o.employment === "business";
  const needWork = business ? p.min_business_months ?? 12 : p.min_work_months ?? 6;
  const checks: Check[] = [
    { key: "age", label: `Нас ${minAge}–${maxAge}`, value: o.age == null ? "—" : `${o.age} нас`, ok: o.age == null ? null : o.age >= minAge && o.age <= maxAge },
    { key: "work", label: business ? `Бизнес эрхэлсэн ${needWork}+ сар` : `Ажилласан ${needWork}+ сар`, value: `${o.workMonths} сар`, ok: o.employment === "pension" || o.employment === "other" || !o.employment ? null : o.workMonths >= needWork },
    { key: "dti", label: `Өр/орлогын харьцаа ≤ ${maxDti}%`, value: dti == null ? "—" : `${dti}%`, ok: dti == null ? null : dti <= maxDti },
    { key: "overdue", label: "Хугацаа хэтэрсэн зээлгүй", value: o.hasOverdue == null ? "—" : o.hasOverdue ? "Байгаа" : "Байхгүй", ok: o.hasOverdue == null ? null : !o.hasOverdue },
  ];
  if (p.min_car_year) checks.push({ key: "car", label: `Машин ${p.min_car_year} оноос хойш`, value: `${o.carYear} он`, ok: o.carYear >= p.min_car_year });
  if (p.cosigner_over != null && o.loan > Number(p.cosigner_over))
    checks.push({ key: "cosigner", label: `Хамтран зээлдэгчтэй (${fmtNum(Number(p.cosigner_over))}₮-өөс дээш зээлд)`, value: o.hasCosigner ? "Байгаа" : "Байхгүй", ok: o.hasCosigner });
  return { checks, dti };
}

/** Түншийн шаардлагын товч жагсаалт (хэрэглэгчид харуулах) */
export function requirementLines(p: Partner): string[] {
  const out = [
    `Нас ${p.min_age ?? 18}–${p.max_age ?? 65}`,
    `Одоогийн ажилдаа ${p.min_work_months ?? 6}+ сар (бизнес бол ${p.min_business_months ?? 12}+ сар)`,
    `Өр/орлогын харьцаа ${Number(p.max_dti ?? 50)}%-иас ихгүй`,
    `Урьдчилгаа ${Number(p.min_down_pct)}%-иас дээш`,
    "Хугацаа хэтэрсэн зээлгүй",
  ];
  if (p.min_car_year) out.push(`Машин ${p.min_car_year} оноос хойш үйлдвэрлэгдсэн`);
  if (p.cosigner_over != null) out.push(`${fmtNum(Number(p.cosigner_over))}₮-өөс дээш зээлд хамтран зээлдэгч`);
  return out;
}
