"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/format";
import { minDown, monthlyPayment, termOptions, type Partner } from "@/lib/loan";
import { IconCheck, IconSpinner } from "@/components/icons";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

/** Зарын хуудсан дээрх лизингийн тооцоолуур + "Лизингээр авах" хүсэлт */
export function LoanCalculator({ adId, price, partners, defaultName, defaultPhone }: { adId: string; price: number; partners: Partner[]; defaultName: string; defaultPhone: string }) {
  const [pid, setPid] = useState(partners[0].id);
  const p = partners.find((x) => x.id === pid) ?? partners[0];
  const [down, setDown] = useState(fmt(minDown(price, p.min_down_pct)));
  const terms = termOptions(p.max_term_months);
  const [term, setTerm] = useState(terms.includes(24) ? 24 : terms[terms.length - 1]);
  const [form, setForm] = useState(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [income, setIncome] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const downNum = Number(down.replace(/\D/g, "")) || 0;
  const min = minDown(price, p.min_down_pct);
  const principal = Math.max(0, price - downNum);
  const monthly = useMemo(() => monthlyPayment(principal, Number(p.rate_annual), term), [principal, p.rate_annual, term]);
  const downErr = downNum < min ? `Урьдчилгаа хамгийн багадаа ${fmt(min)}₮ (${Number(p.min_down_pct)}%)` : downNum >= price ? "Урьдчилгаа үнээс бага байх ёстой" : null;

  function pickPartner(id: string) {
    const np = partners.find((x) => x.id === id)!;
    setPid(id);
    const nm = minDown(price, np.min_down_pct);
    if (downNum < nm) setDown(fmt(nm));
    const t = termOptions(np.max_term_months);
    if (!t.includes(term)) setTerm(t[t.length - 1]);
  }

  async function send() {
    setError(null);
    if (downErr) return setError(downErr);
    if (!name.trim()) return setError("Нэрээ оруулна уу");
    if (phone.replace(/\D/g, "").length < 8) return setError("Утасны дугаараа зөв оруулна уу");
    if (!consent) return setError("Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү");
    setBusy(true);
    const { error: e } = await createClient().rpc("submit_loan_request", {
      p_ad: adId, p_partner: p.id, p_full_name: name.trim(), p_phone: phone.trim(), p_down: downNum, p_term: term,
      p_income: income || null, p_note: note.trim() || null, p_consent: consent,
    });
    setBusy(false);
    if (e) return setError(errMsg(e));
    setDone(true);
  }

  if (done)
    return (
      <section className="rounded-2xl bg-ink text-paper p-5 flex flex-col gap-2">
        <span className="flex items-center gap-2 font-bold text-[16px]"><span className="w-7 h-7 rounded-lg bg-yellow text-ink flex items-center justify-center"><IconCheck size={16} /></span>Хүсэлт илгээгдлээ</span>
        <span className="text-[14px] text-pale">{p.name} тантай удахгүй холбогдоно. Явцыг <Link href="/loans" className="text-yellow underline">Лизингийн хүсэлтүүд</Link> хэсгээс харна.</span>
      </section>
    );

  return (
    <section className="rounded-2xl border-2 border-ink p-5 flex flex-col gap-4" aria-labelledby="loan-title">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 id="loan-title" className="m-0 text-[17px] font-bold">Лизингээр авах</h2>
        <span className="text-[12px] text-muted">Жилийн {Number(p.rate_annual)}% · {p.max_term_months} сар хүртэл</span>
      </div>
      {partners.length > 1 && (
        <label className="label text-[13px]">Лизингийн компани
          <select value={pid} onChange={(e) => pickPartner(e.target.value)} className="input h-11">
            {partners.map((x) => <option key={x.id} value={x.id}>{x.name} — {Number(x.rate_annual)}%</option>)}
          </select>
        </label>
      )}
      {partners.length === 1 && <span className="text-[13px] text-body -mt-2">{p.name}</span>}
      <div className="flex flex-wrap gap-3">
        <label className="label text-[13px] flex-[1_1_160px]">Урьдчилгаа (₮)
          <input inputMode="numeric" value={down} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setDown(d ? fmt(Number(d)) : ""); }} className="input h-11 mono" aria-invalid={!!downErr} />
        </label>
        <label className="label text-[13px] flex-[1_1_120px]">Хугацаа
          <select value={term} onChange={(e) => setTerm(Number(e.target.value))} className="input h-11">
            {terms.map((t) => <option key={t} value={t}>{t} сар</option>)}
          </select>
        </label>
      </div>
      <input type="range" min={min} max={Math.max(min, Math.round(price * 0.9))} step={100000} value={Math.min(Math.max(downNum, min), Math.round(price * 0.9))} onChange={(e) => setDown(fmt(Number(e.target.value)))} aria-label="Урьдчилгаа" className="w-full accent-[#111317]" />
      {downErr && <span className="text-[12px] text-danger -mt-2">{downErr}</span>}
      <div className="rounded-xl bg-paper p-4 grid grid-cols-2 gap-3">
        <div className="flex flex-col"><span className="text-[12px] text-muted">Зээлийн дүн</span><span className="font-bold">{fmt(principal)}₮</span></div>
        <div className="flex flex-col"><span className="text-[12px] text-muted">Нийт төлөх</span><span className="font-bold">{fmt(monthly * term + downNum)}₮</span></div>
        <div className="col-span-2 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[13px] text-muted">Сарын төлбөр</span>
          <span className="h-display text-[24px]">{fmt(monthly)}₮</span>
        </div>
      </div>
      <span className="text-[11px] text-muted -mt-2">Урьдчилсан тооцоо. Эцсийн нөхцөлийг лизингийн компани тогтооно.</span>

      {!form ? (
        <button type="button" onClick={() => setForm(true)} disabled={!!downErr} className="btn btn-lg btn-yellow disabled:opacity-50">Лизингийн хүсэлт илгээх</button>
      ) : (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap gap-3">
            <label className="label text-[13px] flex-[1_1_180px]">Овог нэр<input value={name} onChange={(e) => setName(e.target.value)} className="input h-11" /></label>
            <label className="label text-[13px] flex-[1_1_140px]">Утас<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="input h-11 mono" /></label>
          </div>
          <label className="label text-[13px]">Сарын орлого (заавал биш)
            <select value={income} onChange={(e) => setIncome(e.target.value)} className="input h-11">
              <option value="">Сонгоогүй</option>
              <option>1.5 саяас доош</option><option>1.5–3 сая</option><option>3–5 сая</option><option>5 саяас дээш</option>
            </select>
          </label>
          <label className="label text-[13px]">Тэмдэглэл (заавал биш)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="textarea" placeholder="Залгах цаг гэх мэт" /></label>
          <label className="flex items-start gap-2.5 text-[13px] leading-snug cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#111317]" />
            <span>Миний нэр, утас болон энэ хүсэлтийн мэдээллийг <strong>{p.name}</strong>-д дамжуулж, надтай холбогдохыг зөвшөөрч байна.</span>
          </label>
          {error && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-3.5 py-2.5 text-[13px]">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(false)} disabled={busy} className="btn btn-ghost flex-1">Болих</button>
            <button type="button" onClick={send} disabled={busy || !consent} className="btn btn-yellow flex-[2] disabled:opacity-50">{busy ? <><IconSpinner size={18} /> Илгээж байна</> : "Хүсэлт илгээх"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
