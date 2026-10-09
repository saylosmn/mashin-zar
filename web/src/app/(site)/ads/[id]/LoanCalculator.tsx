"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_REQUIRED_DOCS, docLabel, minDown, monthlyPayment, requirementLines, termOptions, type Partner } from "@/lib/loan";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

/** Зарын хуудсан дээрх лизингийн тооцоолуур + "Лизингээр авах" хүсэлт */
export function LoanCalculator({ adId, price, partners }: { adId: string; price: number; partners: Partner[] }) {
  const [pid, setPid] = useState(partners[0].id);
  const p = partners.find((x) => x.id === pid) ?? partners[0];
  const [down, setDown] = useState(fmt(minDown(price, p.min_down_pct)));
  const terms = termOptions(p.max_term_months);
  const [term, setTerm] = useState(terms.includes(24) ? 24 : terms[terms.length - 1]);

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

      <details className="rounded-xl border border-line px-4 py-3 text-[13px]">
        <summary className="cursor-pointer font-semibold">{p.name}-ийн шаардлага, бүрдүүлэх баримт</summary>
        <ul className="m-0 mt-2 pl-5 flex flex-col gap-1 text-body">
          {requirementLines(p).map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p className="m-0 mt-2 text-body"><strong>Баримт:</strong> {(p.required_docs ?? DEFAULT_REQUIRED_DOCS).map(docLabel).join(", ") || "заавал хавсаргах баримтгүй"}</p>
        {p.requirements_note && <p className="m-0 mt-2 text-body">{p.requirements_note}</p>}
      </details>
      {downErr ? (
        <span className="btn btn-lg btn-yellow opacity-50 pointer-events-none" aria-disabled>Лизингийн хүсэлт илгээх</span>
      ) : (
        <Link href={`/loan/${adId}?partner=${p.id}&down=${downNum}&term=${term}`} className="btn btn-lg btn-yellow no-underline">Лизингийн хүсэлт илгээх →</Link>
      )}
      <span className="text-[12px] text-muted -mt-2">Дараагийн алхамд анкет бөглөж, баримтаа хавсаргана (5–10 минут).</span>
    </section>
  );
}
