"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/format";
import { CITIES } from "@/lib/cars";
import {
  DEFAULT_REQUIRED_DOCS, EMPLOYMENT, LOAN_DOCS, MARITAL, ageFrom, docLabel, monthlyPayment, previewChecks, rdBirthDate,
  type Applicant, type Partner,
} from "@/lib/loan";
import { IconCheck, IconSpinner } from "@/components/icons";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const digits = (s: string) => s.replace(/\D/g, "");
const money = (s: string) => (digits(s) ? fmt(Number(digits(s))) : "");
const num = (s: string) => Number(digits(s)) || 0;

const STEPS = ["Хувийн мэдээлэл", "Ажил, орлого", "Холбоо барих", "Баримт бичиг", "Илгээх"];

async function compress(file: File, max = 2000): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

type Doc = { path: string; name: string };

export function LoanApplication({
  userId, ad, partner, down, term, defaults,
}: {
  userId: string;
  ad: { id: string; price: number; year: number; title: string };
  partner: Partner;
  down: number;
  term: number;
  defaults: { full_name: string; phone: string; city: string; applicant: Applicant | null };
}) {
  const router = useRouter();
  const d = defaults.applicant ?? {};
  const batch = useRef(crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 1. Хувийн
  const [fullName, setFullName] = useState(defaults.full_name);
  const [phone, setPhone] = useState(defaults.phone);
  const [rd, setRd] = useState(d.register_no ?? "");
  const [city, setCity] = useState(d.city ?? defaults.city);
  const [district, setDistrict] = useState(d.district ?? "");
  const [address, setAddress] = useState(d.address ?? "");
  const [marital, setMarital] = useState(d.marital_status ?? "");
  const [household, setHousehold] = useState(d.household_size ? String(d.household_size) : "");
  const [license, setLicense] = useState<boolean | null>(d.has_license ?? null);
  // 2. Ажил, орлого
  const [emp, setEmp] = useState(d.employment_type ?? "");
  const [employer, setEmployer] = useState(d.employer ?? "");
  const [position, setPosition] = useState(d.position ?? "");
  const [work, setWork] = useState(d.work_months != null ? String(d.work_months) : "");
  const [income, setIncome] = useState(d.monthly_income ? fmt(d.monthly_income) : "");
  const [other, setOther] = useState(d.other_income ? fmt(d.other_income) : "");
  const [debt, setDebt] = useState(d.existing_debt_payment ? fmt(d.existing_debt_payment) : "");
  const [overdue, setOverdue] = useState<boolean | null>(null);
  // 3. Холбоо барих, хамтран зээлдэгч
  const [refName, setRefName] = useState(d.ref_name ?? "");
  const [refPhone, setRefPhone] = useState(d.ref_phone ?? "");
  const [refRel, setRefRel] = useState(d.ref_relation ?? "");
  const [hasCos, setHasCos] = useState(!!d.cosigner);
  const [cosName, setCosName] = useState(d.cosigner?.name ?? "");
  const [cosPhone, setCosPhone] = useState(d.cosigner?.phone ?? "");
  const [cosRel, setCosRel] = useState(d.cosigner?.relation ?? "");
  const [cosRd, setCosRd] = useState(d.cosigner?.register_no ?? "");
  const [cosIncome, setCosIncome] = useState(d.cosigner?.monthly_income ? fmt(d.cosigner.monthly_income) : "");
  // 4. Баримт
  const [docs, setDocs] = useState<Record<string, Doc>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  // 5.
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const required = useMemo(() => (partner.required_docs ?? DEFAULT_REQUIRED_DOCS).filter((k) => k !== "cosigner_id" || hasCos), [partner.required_docs, hasCos]);
  const loan = ad.price - down;
  const monthly = monthlyPayment(loan, Number(partner.rate_annual), term);
  const birth = rdBirthDate(rd);
  const age = birth ? ageFrom(birth) : null;
  const needCos = partner.cosigner_over != null && loan > Number(partner.cosigner_over);
  const { checks, dti } = previewChecks({
    partner, age, employment: emp, workMonths: Number(work) || 0, income: num(income), otherIncome: num(other),
    cosignerIncome: hasCos ? num(cosIncome) : 0, debt: num(debt), monthly, hasOverdue: overdue, carYear: ad.year, loan, hasCosigner: hasCos,
  });
  const failed = checks.filter((c) => c.ok === false);

  function validate(s: number): string | null {
    if (s === 0) {
      if (!fullName.trim()) return "Овог нэрээ оруулна уу";
      if (digits(phone).length < 8) return "Утасны дугаараа зөв оруулна уу";
      if (!birth) return "Регистрийн дугаараа зөв оруулна уу (жишээ: УБ99112233)";
      if (!city || !address.trim()) return "Оршин суугаа хаягаа бөглөнө үү";
      if (!marital) return "Гэрлэлтийн байдлаа сонгоно уу";
      const h = Number(household);
      if (!Number.isInteger(h) || h < 1 || h > 30) return "Ам бүлийн тоогоо оруулна уу";
    }
    if (s === 1) {
      if (!emp) return "Орлогын эх үүсвэрээ сонгоно уу";
      if ((emp === "salary" || emp === "both") && !employer.trim()) return "Ажлын газраа оруулна уу";
      if (!/^\d{1,3}$/.test(work)) return "Ажилласан / бизнес эрхэлсэн хугацаагаа сараар оруулна уу";
      if (num(income) <= 0) return "Сарын орлогоо оруулна уу";
      if (overdue === null) return "Хугацаа хэтэрсэн зээлтэй эсэхээ сонгоно уу";
    }
    if (s === 2) {
      if (!refName.trim() || digits(refPhone).length < 8) return "Яаралтай үед холбоо барих хүний нэр, утсыг оруулна уу";
      if (hasCos && (!cosName.trim() || digits(cosPhone).length < 8)) return "Хамтран зээлдэгчийн нэр, утсыг оруулна уу";
      if (hasCos && cosRd.trim() && !rdBirthDate(cosRd)) return "Хамтран зээлдэгчийн регистр буруу байна";
    }
    if (s === 3) {
      const miss = required.filter((k) => !docs[k]);
      if (miss.length) return `Заавал хавсаргах баримт: ${miss.map(docLabel).join(", ")}`;
    }
    return null;
  }

  function next() {
    const e = validate(step);
    setError(e);
    if (!e) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  async function upload(kind: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImg = file.type.startsWith("image/");
    if (!isPdf && !isImg) return setError("Зөвхөн зураг эсвэл PDF файл хавсаргана");
    if (isPdf && file.size > 10 * 1024 * 1024) return setError("PDF файл 10MB-аас ихгүй байна");
    setUploading(kind);
    try {
      const body = isPdf ? file : await compress(file);
      const ext = isPdf ? "pdf" : "jpg";
      const path = `${userId}/${batch.current}/${kind}-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error: e } = await supabase.storage.from("loan-docs").upload(path, body, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
      if (e) throw e;
      const old = docs[kind]?.path;
      setDocs((x) => ({ ...x, [kind]: { path, name: file.name } }));
      if (old) supabase.storage.from("loan-docs").remove([old]).then(() => {});
    } catch (e) {
      setError(`Хавсаргаж чадсангүй: ${errMsg(e)}`);
    } finally {
      setUploading(null);
    }
  }

  function removeDoc(kind: string) {
    const old = docs[kind]?.path;
    setDocs((x) => { const y = { ...x }; delete y[kind]; return y; });
    if (old) createClient().storage.from("loan-docs").remove([old]).then(() => {});
  }

  async function submit() {
    for (let s = 0; s < 4; s++) {
      const e = validate(s);
      if (e) { setStep(s); setError(e); return; }
    }
    if (!consent) return setError("Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү");
    setBusy(true);
    setError(null);
    const p_app = {
      full_name: fullName.trim(), phone: phone.trim(), register_no: rd, city, district, address, marital_status: marital,
      household_size: household, employment_type: emp, employer, position, work_months: work,
      monthly_income: String(num(income)), other_income: String(num(other)), existing_debt_payment: String(num(debt)),
      has_overdue: overdue, has_license: license, ref_name: refName, ref_phone: refPhone, ref_relation: refRel, note,
      cosigner: hasCos ? { name: cosName, phone: cosPhone, relation: cosRel, register_no: cosRd, monthly_income: String(num(cosIncome)) } : null,
    };
    const p_docs = Object.fromEntries(Object.entries(docs).filter(([k]) => k !== "cosigner_id" || hasCos).map(([k, v]) => [k, v.path]));
    const { error: e } = await createClient().rpc("submit_loan_request", {
      p_ad: ad.id, p_partner: partner.id, p_down: down, p_term: term, p_app, p_docs, p_consent: true,
    });
    setBusy(false);
    if (e) return setError(errMsg(e));
    router.push(`/loans?ok=${encodeURIComponent(`${partner.name}-д хүсэлт илгээгдлээ`)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-ink text-paper p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
        <Sum k="Машин" v={ad.title} />
        <Sum k="Урьдчилгаа" v={`${fmt(down)}₮`} />
        <Sum k="Хугацаа" v={`${term} сар · ${Number(partner.rate_annual)}%`} />
        <Sum k="Сарын төлбөр" v={`${fmt(monthly)}₮`} strong />
      </div>

      <ol className="list-none p-0 m-0 flex gap-1.5 overflow-x-auto" aria-label="Алхам">
        {STEPS.map((t, i) => (
          <li key={t} className={`shrink-0 h-9 px-3 rounded-full flex items-center gap-1.5 text-[13px] ${i === step ? "bg-ink text-yellow font-semibold" : i < step ? "bg-active-bg text-active-fg" : "bg-card border border-line-2 text-muted"}`} aria-current={i === step ? "step" : undefined}>
            {i < step ? <IconCheck size={14} /> : <span className="mono">{i + 1}</span>} {t}
          </li>
        ))}
      </ol>

      <section className="card p-5 flex flex-col gap-4">
        {step === 0 && (
          <>
            <H>Хувийн мэдээлэл</H>
            <Row>
              <F label="Овог нэр"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input h-11" autoComplete="name" /></F>
              <F label="Утас"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input h-11 mono" inputMode="tel" autoComplete="tel" /></F>
            </Row>
            <F label="Регистрийн дугаар" hint={birth ? `Төрсөн: ${birth.toISOString().slice(0, 10)} · ${age} нас` : "Жишээ: УБ99112233"}>
              <input value={rd} onChange={(e) => setRd(e.target.value.toUpperCase())} className="input h-11 mono" maxLength={12} aria-invalid={!!rd && !birth} />
            </F>
            <Row>
              <F label="Хот / аймаг">
                <select value={city} onChange={(e) => setCity(e.target.value)} className="input h-11">{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
              </F>
              <F label="Дүүрэг / сум"><input value={district} onChange={(e) => setDistrict(e.target.value)} className="input h-11" placeholder="Сүхбаатар" /></F>
            </Row>
            <F label="Дэлгэрэнгүй хаяг"><input value={address} onChange={(e) => setAddress(e.target.value)} className="input h-11" placeholder="Хороо, байр, тоот" /></F>
            <F label="Гэрлэлтийн байдал" group><Chips value={marital} onChange={setMarital} options={MARITAL} /></F>
            <Row>
              <F label="Ам бүлийн тоо"><input value={household} onChange={(e) => setHousehold(digits(e.target.value).slice(0, 2))} className="input h-11 mono" inputMode="numeric" /></F>
              <F label="Жолооны үнэмлэхтэй юу?" group><YesNo value={license} onChange={setLicense} /></F>
            </Row>
          </>
        )}

        {step === 1 && (
          <>
            <H>Ажил, орлого</H>
            <F label="Орлогын үндсэн эх үүсвэр" group><Chips value={emp} onChange={setEmp} options={EMPLOYMENT} /></F>
            {emp !== "pension" && emp !== "other" && (
              <Row>
                <F label={emp === "business" ? "Бизнесийн нэр / төрөл" : "Ажлын газар"}><input value={employer} onChange={(e) => setEmployer(e.target.value)} className="input h-11" /></F>
                <F label="Албан тушаал"><input value={position} onChange={(e) => setPosition(e.target.value)} className="input h-11" /></F>
              </Row>
            )}
            <F label={emp === "business" ? "Бизнес эрхэлсэн хугацаа (сар)" : "Одоогийн ажилдаа ажилласан хугацаа (сар)"} hint={`Шаардлага: ${emp === "business" ? partner.min_business_months ?? 12 : partner.min_work_months ?? 6}+ сар`}>
              <input value={work} onChange={(e) => setWork(digits(e.target.value).slice(0, 3))} className="input h-11 mono" inputMode="numeric" />
            </F>
            <Row>
              <F label="Сарын цэвэр орлого (₮)"><input value={income} onChange={(e) => setIncome(money(e.target.value))} className="input h-11 mono" inputMode="numeric" /></F>
              <F label="Бусад орлого (₮, сараар)"><input value={other} onChange={(e) => setOther(money(e.target.value))} className="input h-11 mono" inputMode="numeric" placeholder="0" /></F>
            </Row>
            <F label="Одоо төлж буй бусад зээлийн сарын төлбөр (₮)" hint="Банк, ББСБ, утасны зээл гэх мэт бүгдийг нийлүүлнэ"><input value={debt} onChange={(e) => setDebt(money(e.target.value))} className="input h-11 mono" inputMode="numeric" placeholder="0" /></F>
            <F label="Хугацаа хэтэрсэн зээл байгаа юу?" group><YesNo value={overdue} onChange={setOverdue} /></F>
            {dti != null && (
              <p className={`m-0 rounded-xl px-4 py-3 text-[14px] ${dti <= Number(partner.max_dti ?? 50) ? "bg-active-bg text-active-fg" : "bg-pending-bg text-pending-fg"}`}>
                Өр/орлогын харьцаа: <strong>{dti}%</strong> (шаардлага ≤ {Number(partner.max_dti ?? 50)}%){dti > Number(partner.max_dti ?? 50) ? " — хамтран зээлдэгч нэмэх эсвэл урьдчилгаагаа нэмэгдүүлбэл харьцаа буурна." : ""}
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <H>Яаралтай үед холбоо барих хүн</H>
            <Row>
              <F label="Нэр"><input value={refName} onChange={(e) => setRefName(e.target.value)} className="input h-11" /></F>
              <F label="Утас"><input value={refPhone} onChange={(e) => setRefPhone(e.target.value)} className="input h-11 mono" inputMode="tel" /></F>
            </Row>
            <F label="Таны хэн болох"><input value={refRel} onChange={(e) => setRefRel(e.target.value)} className="input h-11" placeholder="Ах, найз, хамт ажилладаг…" /></F>
            <hr className="border-line w-full" />
            <H>Хамтран зээлдэгч</H>
            {needCos && <p className="m-0 rounded-xl bg-pending-bg text-pending-fg px-4 py-3 text-[14px]">{partner.name} {fmt(Number(partner.cosigner_over))}₮-өөс дээш зээлд хамтран зээлдэгч шаарддаг.</p>}
            <label className="flex items-center gap-2.5 text-[14px] cursor-pointer">
              <input type="checkbox" checked={hasCos} onChange={(e) => setHasCos(e.target.checked)} className="w-5 h-5 accent-[#111317]" /> Хамтран зээлдэгчтэй (ихэвчлэн гэр бүлийн хүн)
            </label>
            {hasCos && (
              <>
                <Row>
                  <F label="Нэр"><input value={cosName} onChange={(e) => setCosName(e.target.value)} className="input h-11" /></F>
                  <F label="Утас"><input value={cosPhone} onChange={(e) => setCosPhone(e.target.value)} className="input h-11 mono" inputMode="tel" /></F>
                </Row>
                <Row>
                  <F label="Таны хэн болох"><input value={cosRel} onChange={(e) => setCosRel(e.target.value)} className="input h-11" placeholder="Эхнэр, нөхөр…" /></F>
                  <F label="Регистр (заавал биш)"><input value={cosRd} onChange={(e) => setCosRd(e.target.value.toUpperCase())} className="input h-11 mono" maxLength={12} /></F>
                </Row>
                <F label="Хамтран зээлдэгчийн сарын орлого (₮)"><input value={cosIncome} onChange={(e) => setCosIncome(money(e.target.value))} className="input h-11 mono" inputMode="numeric" /></F>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <H>Баримт бичиг</H>
            <p className="m-0 text-[13px] text-muted">Зураг эсвэл PDF. Лавлагаануудыг <a href="https://e-mongolia.mn" target="_blank" rel="noreferrer">e-mongolia.mn</a>-ээс үнэгүй татна. Файлууд зөвхөн {partner.name}-д харагдана.</p>
            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {LOAN_DOCS.filter((x) => x.kind !== "cosigner_id" || hasCos).map((x) => {
                const req = required.includes(x.kind);
                const have = docs[x.kind];
                return (
                  <li key={x.kind} className={`rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 ${have ? "border-[#9BD3AE] bg-[#F1FAF4]" : "border-line"}`}>
                    <div className="flex-[1_1_220px] flex flex-col gap-0.5 min-w-0">
                      <span className="text-[14px] font-semibold">{x.label} {req ? <span className="badge bg-pending-bg text-pending-fg ml-1">заавал</span> : <span className="text-[12px] text-muted font-normal">· заавал биш</span>}</span>
                      {have ? <span className="text-[12px] text-[#1D6B3A] truncate">✓ {have.name}</span> : x.hint ? <span className="text-[12px] text-muted">{x.hint}</span> : null}
                    </div>
                    {uploading === x.kind ? (
                      <span className="btn btn-sm btn-ghost"><IconSpinner size={16} /> Хуулж байна</span>
                    ) : (
                      <div className="flex gap-2">
                        <label className={`btn btn-sm ${have ? "btn-ghost" : "btn-ink"} cursor-pointer`}>
                          {have ? "Солих" : "Хавсаргах"}
                          <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={!!uploading} onChange={(e) => { upload(x.kind, e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                        {have && <button type="button" onClick={() => removeDoc(x.kind)} className="btn btn-sm btn-danger">Хасах</button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {step === 4 && (
          <>
            <H>Шалгаад илгээх</H>
            <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
              {checks.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2 text-[14px]">
                  <span className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold ${c.ok === true ? "bg-[#DDF3E4] text-[#1D6B3A]" : c.ok === false ? "bg-danger-bg text-[#9b1c1c]" : "bg-soft text-body"}`} aria-hidden>{c.ok === true ? "✓" : c.ok === false ? "✗" : "–"}</span>
                    {c.label}
                  </span>
                  <span className="font-semibold">{c.value} <span className="sr-only">{c.ok === true ? "хангаж байна" : c.ok === false ? "хангахгүй" : "хамаарахгүй"}</span></span>
                </li>
              ))}
            </ul>
            {failed.length > 0 && (
              <p className="m-0 rounded-xl bg-pending-bg text-pending-fg px-4 py-3 text-[13px]">
                {failed.length} шаардлагыг хангахгүй байна. Хүсэлтээ илгээж болно — эцсийн шийдвэрийг {partner.name} гаргана.
              </p>
            )}
            {partner.requirements_note && <p className="m-0 text-[13px] text-body rounded-xl border border-line px-4 py-3">{partner.name}: {partner.requirements_note}</p>}
            <F label="Нэмэлт тэмдэглэл (заавал биш)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="textarea" placeholder="Залгах тохиромжтой цаг гэх мэт" /></F>
            <label className="flex items-start gap-2.5 text-[13px] leading-snug cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#111317] shrink-0" />
              <span>Энэ анкетын мэдээлэл болон хавсаргасан баримтуудыг <strong>{partner.name}</strong>-д дамжуулж, зээлийн шийдвэр гаргах зорилгоор ашиглах, надтай холбогдохыг зөвшөөрч байна. Мэдээлэл үнэн зөв гэдгийг баталж байна.</span>
            </label>
          </>
        )}

        {error && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-4 py-3 text-[14px]">{error}</p>}

        <div className="flex gap-2 pt-1">
          {step > 0 && <button type="button" onClick={() => { setError(null); setStep(step - 1); }} disabled={busy} className="btn btn-ghost flex-1">← Буцах</button>}
          {step < 4 ? (
            <button type="button" onClick={next} disabled={!!uploading} className="btn btn-ink flex-[2]">Үргэлжлүүлэх →</button>
          ) : (
            <button type="button" onClick={submit} disabled={busy || !consent} className="btn btn-yellow flex-[2] disabled:opacity-50">{busy ? <><IconSpinner size={18} /> Илгээж байна</> : "Хүсэлт илгээх"}</button>
          )}
        </div>
      </section>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 text-[17px] font-bold">{children}</h2>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-3 [&>*]:flex-[1_1_220px]">{children}</div>;
}
function F({ label, hint, group, children }: { label: string; hint?: string; group?: boolean; children: React.ReactNode }) {
  const inner = (
    <>
      {label}
      {children}
      {hint && <span className="text-[12px] text-muted font-normal">{hint}</span>}
    </>
  );
  // Товчтой бүлгийг <label> дотор хийвэл шошгон дээр дарахад эхний товч дарагдана — div ашиглана
  return group ? <div className="label text-[13px]" role="group" aria-label={label}>{inner}</div> : <label className="label text-[13px]">{inner}</label>;
}
function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {Object.entries(options).map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} className={`h-10 px-4 rounded-full text-[14px] ${value === k ? "bg-ink text-yellow font-semibold" : "bg-card border border-line-2"}`}>{l}</button>
      ))}
    </div>
  );
}
function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup">
      {[true, false].map((v) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`h-10 px-5 rounded-full text-[14px] ${value === v ? "bg-ink text-yellow font-semibold" : "bg-card border border-line-2"}`}>{v ? "Тийм" : "Үгүй"}</button>
      ))}
    </div>
  );
}
function Sum({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-pale">{k}</span>
      <span className={`font-bold truncate ${strong ? "text-yellow text-[16px]" : ""}`}>{v}</span>
    </div>
  );
}
