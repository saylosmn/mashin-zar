/**
 * Автомашин зуучлан борлуулах гэрээний текст.
 * Вэбийн гэрээ зурах алхам, PDF, апп гурвуулаа энэ бүтцийг ашиглана
 * (апп-д mobile/src/lib/contract.ts-д ижил хуулбар бий — өөрчилбөл хоёуланг нь).
 */
export type Tier = { days: number; percent: number };
export type ContractTerms = { tiers: Tier[]; after: number };

export type ContractData = {
  number?: string | null;
  date?: string | null; // ISO
  company: string;
  terms: ContractTerms;
  fullName?: string | null;
  phone?: string | null;
  brand?: string | null;
  model?: string | null;
  yearMade?: number | null;
  plate?: string | null;
  vin?: string | null;
  price?: number | null;
};

export type Section = { heading?: string; lines: string[] };

const BLANK = "______________________";
const pct = (n: number) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
export const amount = (n?: number | null) => (n ? `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} төгрөг` : BLANK);

/** Улаанбаатарын цагаар огноо, цагийн хэсгүүд */
export function ubParts(iso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { y: p.year, m: Number(p.month), d: Number(p.day), time: `${p.hour}:${p.minute}` };
}

export function contractDate(iso?: string | null) {
  if (!iso) return "20___ оны ___ сарын ___";
  const p = ubParts(iso);
  return `${p.y} оны ${p.m}-р сарын ${p.d}`;
}

export function tierLines(t: ContractTerms) {
  const tiers = [...t.tiers].sort((a, b) => a.days - b.days);
  const lines = tiers.map((x) => `${x.days} хоногийн дотор зарагдвал — зарагдсан үнийн ${pct(x.percent)}`);
  const last = tiers[tiers.length - 1];
  if (last) lines.push(`${last.days} хоногоос хойш зарагдвал — зарагдсан үнийн ${pct(t.after)}`);
  return lines;
}

export function contractSections(c: ContractData): Section[] {
  const v = (s?: string | number | null) => (s == null || s === "" ? BLANK : String(s));
  return [
    {
      lines: [
        `Нэг талаас «${c.company}» (цаашид «Зуучлагч» гэх), нөгөө талаас ${v(c.fullName)} (утас: ${v(c.phone)}) (цаашид «Эзэмшигч» гэх) нар дараах нөхцөлөөр харилцан тохиролцож энэхүү гэрээг байгуулав.`,
      ],
    },
    {
      heading: "1. Гэрээний зүйл",
      lines: [
        "1.1. Эзэмшигч өөрийн өмчлөлийн доор дурдсан автомашиныг Зуучлагчаар дамжуулан борлуулах, Зуучлагч уг машины зарыг «Машин зар» платформд (вэб сайт, гар утасны апп) байршуулж, худалдан авагч хайх, холбох үйлчилгээ үзүүлнэ.",
      ],
    },
    {
      heading: "2. Автомашины мэдээлэл",
      lines: [
        `Марк, загвар: ${c.brand || c.model ? `${c.brand ?? ""} ${c.model ?? ""}`.trim() : BLANK}`,
        `Үйлдвэрлэсэн он: ${v(c.yearMade)}`,
        `Улсын дугаар: ${v(c.plate)}`,
        `Арлын дугаар (VIN): ${v(c.vin)}`,
        `Зарах үнэ: ${amount(c.price)}`,
      ],
    },
    {
      heading: "3. Үйлчилгээний шимтгэл",
      lines: [
        "3.1. Шимтгэлийг зар платформд нийтлэгдсэн (менежер баталсан) өдрөөс эхлэн машин зарагдах хүртэлх хугацаагаар тооцно:",
        ...tierLines(c.terms).map((l) => `      • ${l}`),
        "3.2. Шимтгэлийг машин зарагдсан үнээс тооцож, борлуулалт хийгдсэний дараа Эзэмшигч Зуучлагчид төлнө.",
        "3.3. Машин Зуучлагчаар дамжуулан зарагдаагүй тохиолдолд шимтгэл төлөхгүй.",
      ],
    },
    {
      heading: "4. Талуудын үүрэг",
      lines: [
        "4.1. Эзэмшигч машины талаарх мэдээлэл, зураг үнэн зөв байх, машин барьцаа, маргаан, хязгаарлалтгүй байхыг хариуцна.",
        "4.2. Эзэмшигч зар нийтлэгдсэн хугацаанд Зуучлагчаар дамжуулан машин зарагдсан бол энэхүү гэрээний 3-р зүйлд заасан шимтгэлийг төлнө.",
        "4.3. Зуучлагч зарыг шалгаж нийтлэх, худалдан авагчтай холбох, Эзэмшигчийн улсын дугаар, арлын дугаарыг нийтэд бүрэн ил гаргахгүй байх үүрэгтэй.",
      ],
    },
    {
      heading: "5. Бусад",
      lines: [
        "5.1. Эзэмшигч машин зарагдахаас өмнө зараа устгаснаар энэхүү гэрээг цуцлах эрхтэй.",
        "5.2. Эзэмшигч гэрээг цахимаар уншиж, гарын үсэг зурж «Зөвшөөрөх» товч дарснаар гэрээ хүчин төгөлдөр болно.",
        "5.3. Гэрээтэй холбоотой маргааныг талууд харилцан тохиролцож шийдвэрлэх ба тохиролцоонд хүрээгүй бол Монгол Улсын хууль тогтоомжийн дагуу шийдвэрлэнэ.",
      ],
    },
  ];
}

export const CONTRACT_TITLE = "АВТОМАШИН ЗУУЧЛАН БОРЛУУЛАХ ГЭРЭЭ";
export const shortNo = (id?: string | null) => (id ? id.replace(/-/g, "").slice(0, 8).toUpperCase() : null);

export const DEFAULT_TERMS: ContractTerms = { tiers: [{ days: 2, percent: 3 }, { days: 7, percent: 2 }, { days: 10, percent: 1.5 }], after: 1.5 };

/** Тохиргооноос гэрээний нөхцөл (SQL ажиллаагүй үед анхны утга) */
export function termsFrom(s: { company_name?: string | null; commission_tiers?: Tier[] | null; commission_after?: number | string | null }) {
  return {
    company: s.company_name || "Autoshop ХХК",
    terms: {
      tiers: s.commission_tiers?.length ? s.commission_tiers.map((t) => ({ days: Number(t.days), percent: Number(t.percent) })) : DEFAULT_TERMS.tiers,
      after: s.commission_after != null ? Number(s.commission_after) : DEFAULT_TERMS.after,
    } as ContractTerms,
  };
}
