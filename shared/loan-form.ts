// Лизингийн анкетын state, шалгалт, ноорог. Вэб, апп хоёул ашиглана.
import { num } from "./format";
import { MAX_DOC_PAGES, docLabel, docPage, docPageKeys, rdBirthDate, type Applicant } from "./loan";

export const STEPS = ["Хувийн", "Ажил, орлого", "Холбоо барих", "Баримт", "Илгээх"];

export const digits = (v: string) => v.replace(/\D/g, "");
export const moneyInput = (v: string) => (digits(v) ? num(Number(digits(v))) : "");
export const toInt = (v: string) => Number(digits(v)) || 0;

export const LATIN_RD = "Регистрийн үсгийг кирилл үсгээр бичнэ үү (жишээ: УБ99112233)";
export const hasLatin = (v: string) => /[A-Za-z]/.test(v);

export type LoanForm = {
  fullName: string;
  phone: string;
  rd: string;
  city: string;
  district: string;
  address: string;
  marital: string;
  household: string;
  license: boolean | null;
  emp: string;
  employer: string;
  position: string;
  work: string;
  income: string;
  other: string;
  debt: string;
  overdue: boolean | null;
  refName: string;
  refPhone: string;
  refRel: string;
  hasCos: boolean;
  cosName: string;
  cosPhone: string;
  cosRel: string;
  cosRd: string;
  cosIncome: string;
  note: string;
};

export type SetField = <K extends keyof LoanForm>(key: K) => (value: LoanForm[K]) => void;

export function emptyForm(
  profile: { full_name?: string | null; phone?: string | null; city?: string | null } | null,
): LoanForm {
  return {
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    rd: "",
    city: profile?.city ?? "Улаанбаатар",
    district: "",
    address: "",
    marital: "",
    household: "",
    license: null,
    emp: "",
    employer: "",
    position: "",
    work: "",
    income: "",
    other: "",
    debt: "",
    overdue: null,
    refName: "",
    refPhone: "",
    refRel: "",
    hasCos: false,
    cosName: "",
    cosPhone: "",
    cosRel: "",
    cosRd: "",
    cosIncome: "",
    note: "",
  };
}

/** Өмнөх хүсэлтийн анкетаар урьдчилан бөглөнө (хугацаа хэтэрсэн зээлийг дахин асууна) */
export function fromApplicant(base: LoanForm, fullName: string, phone: string, d: Applicant): LoanForm {
  const c = d.cosigner;
  return {
    ...base,
    fullName,
    phone,
    rd: d.register_no ?? "",
    city: d.city || base.city,
    district: d.district ?? "",
    address: d.address ?? "",
    marital: d.marital_status ?? "",
    household: d.household_size ? String(d.household_size) : "",
    license: d.has_license ?? null,
    emp: d.employment_type ?? "",
    employer: d.employer ?? "",
    position: d.position ?? "",
    work: d.work_months != null ? String(d.work_months) : "",
    income: d.monthly_income ? num(d.monthly_income) : "",
    other: d.other_income ? num(d.other_income) : "",
    debt: d.existing_debt_payment ? num(d.existing_debt_payment) : "",
    refName: d.ref_name ?? "",
    refPhone: d.ref_phone ?? "",
    refRel: d.ref_relation ?? "",
    hasCos: !!c,
    cosName: c?.name ?? "",
    cosPhone: c?.phone ?? "",
    cosRel: c?.relation ?? "",
    cosRd: c?.register_no ?? "",
    cosIncome: c?.monthly_income ? num(c.monthly_income) : "",
  };
}

export function validateStep(step: number, f: LoanForm, required: string[], docs: Record<string, unknown>) {
  if (step === 0) {
    if (!f.fullName.trim()) return "Овог нэрээ оруулна уу";
    if (digits(f.phone).length < 8) return "Утасны дугаараа зөв оруулна уу";
    if (hasLatin(f.rd)) return LATIN_RD;
    if (!rdBirthDate(f.rd)) return "Регистрийн дугаараа зөв оруулна уу (жишээ: УБ99112233)";
    if (!f.city || !f.address.trim()) return "Оршин суугаа хаягаа бөглөнө үү";
    if (!f.marital) return "Гэрлэлтийн байдлаа сонгоно уу";
    const h = Number(f.household);
    if (!Number.isInteger(h) || h < 1 || h > 30) return "Ам бүлийн тоогоо оруулна уу";
  }
  if (step === 1) {
    if (!f.emp) return "Орлогын эх үүсвэрээ сонгоно уу";
    if ((f.emp === "salary" || f.emp === "both") && !f.employer.trim()) return "Ажлын газраа оруулна уу";
    if (!/^\d{1,3}$/.test(f.work)) return "Ажилласан / бизнес эрхэлсэн хугацаагаа сараар оруулна уу";
    if (toInt(f.income) <= 0) return "Сарын орлогоо оруулна уу";
    if (f.overdue === null) return "Хугацаа хэтэрсэн зээлтэй эсэхээ сонгоно уу";
  }
  if (step === 2) {
    if (!f.refName.trim() || digits(f.refPhone).length < 8)
      return "Яаралтай үед холбоо барих хүний нэр, утсыг оруулна уу";
    if (f.hasCos) {
      if (!f.cosName.trim() || digits(f.cosPhone).length < 8) return "Хамтран зээлдэгчийн нэр, утсыг оруулна уу";
      if (hasLatin(f.cosRd)) return LATIN_RD;
      if (f.cosRd.trim() && !rdBirthDate(f.cosRd)) return "Хамтран зээлдэгчийн регистр буруу байна";
    }
  }
  if (step === 3) {
    const missing = required.filter((k) => !docs[k]);
    if (missing.length) return `Заавал хавсаргах баримт: ${missing.map(docLabel).join(", ")}`;
  }
  return null;
}

/** submit_loan_request-ийн p_app */
export function applicantPayload(f: LoanForm) {
  return {
    full_name: f.fullName.trim(),
    phone: f.phone.trim(),
    register_no: f.rd,
    city: f.city,
    district: f.district,
    address: f.address,
    marital_status: f.marital,
    household_size: f.household,
    employment_type: f.emp,
    employer: f.employer,
    position: f.position,
    work_months: f.work,
    monthly_income: String(toInt(f.income)),
    other_income: String(toInt(f.other)),
    existing_debt_payment: String(toInt(f.debt)),
    has_overdue: f.overdue,
    has_license: f.license,
    ref_name: f.refName,
    ref_phone: f.refPhone,
    ref_relation: f.refRel,
    note: f.note,
    cosigner: f.hasCos
      ? {
          name: f.cosName,
          phone: f.cosPhone,
          relation: f.cosRel,
          register_no: f.cosRd,
          monthly_income: String(toInt(f.cosIncome)),
        }
      : null,
  };
}

/** Хуудсуудыг цоорхойгүй kind, kind_2 … дарааллаар дахин дугаарлана */
export function packDocs<T>(docs: Record<string, T | null | undefined>): Record<string, T> {
  const groups = new Map<string, { page: number; doc: T }[]>();
  for (const [k, doc] of Object.entries(docs)) {
    if (!doc) continue;
    const { base, page } = docPage(k);
    groups.set(base, [...(groups.get(base) ?? []), { page, doc }]);
  }
  const out: Record<string, T> = {};
  for (const [base, list] of groups) {
    const keys = docPageKeys(base);
    list
      .sort((a, b) => a.page - b.page)
      .slice(0, MAX_DOC_PAGES)
      .forEach((x, i) => (out[keys[i]] = x.doc));
  }
  return out;
}

// Хуудас/апп хаагдсан ч бөглөсөн анкет алга болохгүйн тулд localStorage-д ноорог хадгална
// (апп дээр expo-sqlite-ийн localStorage). 7 хоногоос хуучин ноорог устна.
export type Draft<D> = {
  v: 1;
  at: number;
  step: number;
  batch: string;
  reused: string[];
  docs: Record<string, D>;
  f: LoanForm;
};

const DRAFT_TTL = 7 * 864e5;

export const draftKey = (adId: string, partnerId: string) => `loan-draft:${adId}:${partnerId}`;

export function readDraft<D>(key: string): Draft<D> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft<D>;
    if (d?.v !== 1 || !d.f || Date.now() - (d.at ?? 0) > DRAFT_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function writeDraft<D>(key: string, d: Omit<Draft<D>, "v" | "at"> | null) {
  try {
    if (d) localStorage.setItem(key, JSON.stringify({ ...d, v: 1, at: Date.now() }));
    else localStorage.removeItem(key);
  } catch {
    // storage дүүрсэн эсвэл хаалттай (хувийн цонх): ноорог хадгалахгүй л болно
  }
}
