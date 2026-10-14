// Зар оруулах урсгал: зураг байршуулах -> (шимтгэлтэй бол) гэрээ -> зар үүсгэх.
// Supabase-тэй харьцах хэсгийг платформ бүр AdBackend-ээр өгнө.
import type { ContractTerms } from "./contract";
import { money } from "./format";
import type { Plan } from "./types";

export type AdDraft = {
  brand: string;
  model: string;
  trim: string | null;
  plate_number: string;
  vin: string;
  phone: string;
  year_made: number;
  year_imported: number | null;
  options: string[];
  modifications: string | null;
  description: string | null;
  price: number;
};

export type AdFields = {
  brand: string;
  model: string;
  trim: string;
  plate: string;
  vin: string;
  phone: string;
  yearMade: string;
  yearImported: string;
  options: string[];
  modifications: string;
  description: string;
  price: string;
};

export const emptyAdFields = (phone = ""): AdFields => ({
  brand: "",
  model: "",
  trim: "",
  plate: "",
  vin: "",
  phone,
  yearMade: "",
  yearImported: "",
  options: [],
  modifications: "",
  description: "",
  price: "",
});

/** Улсын/арлын дугаар: илүү зайг хасаж том үсгээр */
export const normalizeCode = (v: string) => v.trim().replace(/\s+/g, " ").toUpperCase();
export const priceInput = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
};
export const agentCodeInput = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

export function toDraft(f: AdFields): AdDraft {
  return {
    brand: f.brand.trim(),
    model: f.model.trim(),
    trim: f.trim.trim() || null,
    plate_number: normalizeCode(f.plate),
    vin: normalizeCode(f.vin),
    phone: f.phone.replace(/[^\d+]/g, ""),
    year_made: Number(f.yearMade),
    year_imported: Number(f.yearImported) || null,
    options: f.options,
    modifications: f.modifications.trim() || null,
    description: f.description.trim() || null,
    price: Number(f.price.replace(/\D/g, "")),
  };
}

export function draftError(d: AdDraft, photos: number, minPhotos: number): string | null {
  if (photos < minPhotos) return `Хамгийн багадаа ${minPhotos} зураг оруулна уу.`;
  if (!d.brand || !d.model) return "Марк, загвараа оруулна уу.";
  if (!d.year_made || d.year_made < 1950 || d.year_made > new Date().getFullYear() + 1)
    return "Үйлдвэрлэсэн оноо зөв оруулна уу.";
  if (!d.plate_number || !d.vin) return "Улсын болон арлын дугаараа оруулна уу.";
  if (d.phone.replace(/\D/g, "").length < 8) return "Утасны дугаараа оруулна уу.";
  if (!d.price) return "Үнээ оруулна уу.";
  return null;
}

export const categoryOf = (year: number, cutoff: number) => (year ? (year >= cutoff ? "new" : "old") : null);

/** Гэрээнд бичигдэх утгууд. Аль нэг нь өөрчлөгдвөл шинэ гэрээ зурна. */
export const contractKey = (d: AdDraft, signer: string) =>
  JSON.stringify([d.plate_number, d.vin, d.brand, d.model, d.price, d.year_made, d.phone, signer]);

export type PlanSettings = { featuredPrice: number; featuredDays: number; commissionFeaturedDays: number };

/** Хоёр сонголтын карт (вэб, апп ижил текст) */
export function planCards(terms: ContractTerms, s: PlanSettings) {
  const maxPct = Math.max(terms.after, ...terms.tiers.map((t) => t.percent));
  return {
    commission: {
      title: "Шимтгэлтэй · агент зарна",
      price: `Одоо 0₮ · зарагдвал ${maxPct}% хүртэл`,
      points: [
        s.commissionFeaturedDays > 0
          ? `⭐ ${s.commissionFeaturedDays} хоног онцлох зар үнэгүй, жагсаалтын эхэнд`
          : "Зар нийтэд үнэгүй харагдана",
        "Манай агентууд худалдан авагч хайж, хурдан зарж өгнө",
        "Шимтгэлийг зөвхөн машин зарагдсаны дараа төлнө (гэрээтэй)",
      ],
      cta: "Сонгох · гэрээ",
    },
    paid: {
      title: "Онцлох зар · шимтгэлгүй",
      price: `${money(s.featuredPrice)} нэг удаа`,
      points: [
        `⭐ ${s.featuredDays} хоног онцлох, жагсаалтын эхэнд`,
        "Зарагдахад ямар ч шимтгэл төлөхгүй, өөрөө зарна",
        "Дансаар шилжүүлээд «Төлсөн» дарна. Баталгаажмагц нийтлэгдэнэ",
      ],
      cta: "Сонгох · төлбөр",
    },
  };
}

export const PAID_STEPS = [
  "«Зар илгээх» дарахад зар хадгалагдаж, дансны мэдээлэл гарна.",
  "Гүйлгээний утгад таны кодыг бичиж шилжүүлнэ.",
  "«Төлбөр төлсөн» дарна. Орлого баталгаажмагц зар шууд нийтлэгдэж, онцлох болно.",
];

export type PublishStep = 1 | 2 | 3;

export type AdBackend = {
  /** i-р зургийг байршуулж storage дахь замыг буцаана */
  uploadPhoto: (index: number) => Promise<string>;
  removePhotos: (paths: string[]) => Promise<void>;
  signContract: (d: AdDraft, signer: string, signature: string) => Promise<string>;
  insertAd: (row: Record<string, unknown>) => Promise<string>;
};

/** Зэрэг байршуулах зургийн тоо */
const PARALLEL = 3;

/** Бүх зургийг дарааллаар нь (paths[i] = i-р зураг) PARALLEL-аар зэрэг байршуулна */
async function uploadAll(count: number, upload: (i: number) => Promise<string>, onDone: (n: number) => void) {
  const paths: string[] = new Array(count);
  const uploaded: string[] = [];
  let cursor = 0;
  let done = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && cursor < count) {
      const i = cursor++;
      try {
        paths[i] = await upload(i);
        uploaded.push(paths[i]);
        onDone(++done);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  const results = await Promise.allSettled(Array.from({ length: Math.min(PARALLEL, count) }, worker));
  const error = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  return { paths, uploaded, error: error?.reason as unknown };
}

/**
 * Зар үүсгэнэ. signature=null бол гэрээгүй (авто худалдаа, онцлох төлбөртэй сонголт).
 * Алдаа гарвал байршуулсан зургуудыг устгаад алдааг дахин шиднэ.
 * contract: өмнө амжилттай зурсан гэрээ. Мэдээлэл өөрчлөгдөөгүй бол дахин оролдоход түүнийг ашиглана.
 */
export async function publishAd(
  api: AdBackend,
  opts: {
    userId: string;
    draft: AdDraft;
    photoCount: number;
    plan: Plan | null;
    agentId: string | null;
    signer: string;
    signature: string | null;
    contract: { current: { key: string; id: string } | null };
  },
  progress: (step: PublishStep, done: number) => void,
): Promise<{ id: string; cover: string; contractId: string | null }> {
  progress(1, 0);
  const { paths, uploaded, error } = await uploadAll(opts.photoCount, api.uploadPhoto, (n) => progress(1, n));
  try {
    if (error) throw error;

    let contractId: string | null = null;
    if (opts.signature) {
      progress(2, opts.photoCount);
      const key = contractKey(opts.draft, opts.signer);
      if (opts.contract.current?.key !== key) {
        opts.contract.current = { key, id: await api.signContract(opts.draft, opts.signer, opts.signature) };
      }
      contractId = opts.contract.current.id;
    }

    progress(3, opts.photoCount);
    const id = await api.insertAd({
      ...opts.draft,
      user_id: opts.userId,
      photos: paths,
      contract_id: contractId,
      agent_id: opts.agentId,
      ...(opts.plan ? { plan: opts.plan } : {}),
    });
    opts.contract.current = null;
    return { id, cover: paths[0], contractId };
  } catch (e) {
    if (uploaded.length) await api.removePhotos(uploaded).catch(() => {});
    throw e;
  }
}
