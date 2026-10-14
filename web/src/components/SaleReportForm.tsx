"use client";

import { useMemo, useState } from "react";
import type { ContractTerms } from "@shared/contract";
import { agentAmount, commissionAmount, commissionFor } from "@shared/commission";

export type ReportAd = {
  id: string;
  label: string;
  price: number;
  approved_at: string | null;
  created_at: string;
  terms: ContractTerms;
  agent_id?: string | null;
};
export type AgentOption = { id: string; name: string };

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

/** "Зарагдсан" тайлангийн маягт (админ) - шимтгэлийг шууд тооцож харуулна. */
export function SaleReportForm({
  ads,
  defaultAd,
  action,
  back,
  agents = [],
  agentShare = 0,
}: {
  ads: ReportAd[];
  defaultAd?: string;
  action: (fd: FormData) => void;
  back: string;
  agents?: AgentOption[];
  agentShare?: number;
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());
  const [adId, setAdId] = useState(defaultAd && ads.some((a) => a.id === defaultAd) ? defaultAd : (ads[0]?.id ?? ""));
  const ad = ads.find((a) => a.id === adId);
  const [price, setPrice] = useState(ad ? fmt(ad.price) : "");
  const [date, setDate] = useState(today);
  const [agent, setAgent] = useState(ad?.agent_id ?? "");

  const calc = useMemo(() => {
    if (!ad) return null;
    const sold = date === today ? new Date() : new Date(`${date}T12:00:00+08:00`);
    const c = commissionFor(ad.terms, ad.approved_at ?? ad.created_at, sold);
    const amount = commissionAmount(Number(price.replace(/\D/g, "")) || 0, c.percent);
    return { days: c.days, pct: c.percent, amount, agent: agent ? agentAmount(amount, agentShare) : 0 };
  }, [ad, date, price, today, agent, agentShare]);

  if (!ads.length)
    return <p className="card m-0 p-5 text-[14px] text-muted">Тайлагнах идэвхтэй (нийтлэгдсэн) зар алга байна.</p>;

  return (
    <form action={action} className="card flex flex-col gap-4 p-5">
      <input type="hidden" name="back" value={back} />
      <h2 className="m-0 text-[17px] font-bold">Зарагдсан машин бүртгэх</h2>
      <label className="label text-[14px]">
        Аль зар зарагдсан бэ?
        <select
          name="ad_id"
          value={adId}
          onChange={(e) => {
            setAdId(e.target.value);
            const a = ads.find((x) => x.id === e.target.value);
            if (a) setPrice(fmt(a.price));
            setAgent(a?.agent_id ?? "");
          }}
          className="input"
        >
          {ads.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="label flex-[1_1_200px] text-[14px]">
          Зарагдсан үнэ (₮)
          <input
            name="price"
            required
            inputMode="numeric"
            value={price}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "");
              setPrice(d ? fmt(Number(d)) : "");
            }}
            className="input mono"
          />
        </label>
        <label className="label flex-[1_1_160px] text-[14px]">
          Зарагдсан өдөр
          <input
            name="sold_at"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input mono"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="label flex-[1_1_200px] text-[14px]">
          Худалдан авагч (заавал биш)
          <input name="buyer_name" className="input" placeholder="Нэр" />
        </label>
        <label className="label flex-[1_1_160px] text-[14px]">
          Утас (заавал биш)
          <input name="buyer_phone" inputMode="tel" className="input mono" placeholder="9911 2233" />
        </label>
      </div>
      {agents.length > 0 && (
        <label className="label text-[14px]">
          Агент (зарыг авчирсан / зарсан)
          <select name="agent_id" value={agent} onChange={(e) => setAgent(e.target.value)} className="input">
            <option value="">Агентгүй</option>
            {agents.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="label text-[14px]">
        Тэмдэглэл (заавал биш)
        <textarea name="note" rows={2} className="textarea" placeholder="Төлбөрийн хэлбэр, бусад мэдээлэл" />
      </label>
      {calc && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-ink p-4 text-paper">
          <span className="text-[13px] text-pale">
            Нийтлэгдсэнээс <strong className="text-paper">{calc.days}</strong> хоногт
          </span>
          <span className="text-[13px] text-pale">
            Шимтгэл <strong className="text-yellow">{calc.pct}%</strong>
          </span>
          {calc.agent > 0 && (
            <span className="text-[13px] text-pale">
              Агентад <strong className="text-paper">{fmt(calc.agent)}₮</strong> ({agentShare}%)
            </span>
          )}
          <span className="h-display ml-auto text-[20px] text-yellow">{fmt(calc.amount)}₮</span>
        </div>
      )}
      <button className="btn btn-lg btn-yellow">Бүртгэж батлах</button>
    </form>
  );
}
