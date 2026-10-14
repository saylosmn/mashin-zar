"use client";

import { PAID_STEPS, planCards, type AdDraft, type PlanSettings, type PublishStep } from "@shared/ad-post";
import { tierLines, type ContractTerms } from "@shared/contract";
import type { Plan } from "@shared/types";
import { money } from "@/lib/format";
import { ContractView } from "@/components/ContractView";
import { SignaturePad } from "@/components/SignaturePad";
import { IconCheck, IconClose, IconSpinner } from "@/components/icons";

type Busy = { step: PublishStep; done: number } | null;

const TITLE: Record<"choose" | Plan, string> = {
  choose: "Зараа хэрхэн байршуулах вэ?",
  commission: "Зуучлалын гэрээ",
  paid: "Онцлох зар · шимтгэлгүй",
};

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-3 text-[14px] text-[#9b1c1c]">
      {error}
    </p>
  );
}

function SendButton({
  busy,
  total,
  disabled,
  onClick,
  children,
}: {
  busy: Busy;
  total: number;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const label = !busy
    ? children
    : busy.step === 1
      ? `Зураг ${busy.done} / ${total}`
      : busy.step === 2
        ? "Гэрээ хадгалж байна…"
        : "Илгээж байна…";
  return (
    <button
      type="button"
      disabled={!!busy || disabled}
      onClick={onClick}
      className="btn btn-lg btn-yellow disabled:opacity-50"
    >
      {busy && <IconSpinner size={20} />}
      {label}
    </button>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2.5 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

/** Маягт бөглөсний дараах цонх: сонголт -> гэрээ эсвэл төлбөр */
export function PlanDialog({
  draft,
  plan,
  onPlan,
  onClose,
  contract,
  plans,
  signName,
  onSignName,
  signature,
  onSignature,
  agree,
  onAgree,
  error,
  busy,
  photoCount,
  onSend,
}: {
  draft: AdDraft;
  plan: Plan | null;
  onPlan: (p: Plan | null) => void;
  onClose: () => void;
  contract: { company: string; terms: ContractTerms };
  plans: PlanSettings;
  signName: string;
  onSignName: (v: string) => void;
  signature: string | null;
  onSignature: (v: string | null) => void;
  agree: boolean;
  onAgree: (v: boolean) => void;
  error: string | null;
  busy: Busy;
  photoCount: number;
  onSend: (plan: Plan) => void;
}) {
  const cards = planCards(contract.terms, plans);
  const back = (
    <button type="button" disabled={!!busy} onClick={() => onPlan(null)} className="btn btn-lg btn-ghost">
      Буцах
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-card sm:max-w-[760px] sm:rounded-[22px]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex flex-col">
            <span className="text-[12px] text-muted">{plan ? "Алхам 3 / 3" : "Алхам 2 / 3 · Сонголт"}</span>
            <h2 id="plan-title" className="m-0 text-[18px] font-bold">
              {TITLE[plan ?? "choose"]}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Хаах"
            disabled={!!busy}
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-0 bg-paper disabled:opacity-40"
          >
            <IconClose size={20} />
          </button>
        </div>

        {!plan && (
          <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
            <PlanCard
              {...cards.commission}
              highlight
              onPick={() => {
                onAgree(false);
                onSignature(null);
                onPlan("commission");
              }}
            />
            <PlanCard {...cards.paid} onPick={() => onPlan("paid")} />
            <span className="text-[12px] text-muted">Шимтгэлийн шат: {tierLines(contract.terms).join("; ")}.</span>
          </div>
        )}

        {plan === "paid" && (
          <>
            <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-2 rounded-2xl bg-ink p-5 text-paper">
                <span className="text-[13px] text-pale">
                  {draft.brand} {draft.model} · {draft.year_made} · {money(draft.price)}
                </span>
                <span className="h-display text-[28px] text-yellow">{money(plans.featuredPrice)}</span>
                <span className="text-[14px]">⭐ {plans.featuredDays} хоног онцлох · шимтгэлгүй</span>
              </div>
              <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[14px] leading-snug">
                {PAID_STEPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
              <ErrorBox error={error} />
            </div>
            <Footer>
              {back}
              <SendButton busy={busy} total={photoCount} onClick={() => onSend("paid")}>
                Зар илгээх · төлбөр рүү
              </SendButton>
            </Footer>
          </>
        )}

        {plan === "commission" && (
          <>
            <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
              <div className="max-h-[42dvh] overflow-y-auto rounded-xl border border-line bg-paper p-4">
                <ContractView
                  data={{
                    company: contract.company,
                    terms: contract.terms,
                    fullName: signName || null,
                    phone: draft.phone,
                    brand: draft.brand,
                    model: draft.model,
                    yearMade: draft.year_made,
                    plate: draft.plate_number,
                    vin: draft.vin,
                    price: draft.price,
                  }}
                />
              </div>
              <a
                href="/api/contracts/template"
                target="_blank"
                rel="noreferrer"
                className="self-start text-[13px] font-semibold"
              >
                Гэрээний загварыг PDF-ээр үзэх ↗
              </a>
              <label className="label">
                Овог нэр (гэрээнд бичигдэнэ)
                <input
                  value={signName}
                  onChange={(e) => onSignName(e.target.value)}
                  className="input"
                  placeholder="Овог нэр"
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Гарын үсэг</span>
                <SignaturePad onChange={onSignature} />
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => onAgree(e.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-[#111317]"
                />
                <span>Би гэрээг бүрэн уншиж танилцсан бөгөөд шимтгэлийн нөхцөлийг зөвшөөрч байна.</span>
              </label>
              <ErrorBox error={error} />
            </div>
            <Footer>
              {back}
              <SendButton
                busy={busy}
                total={photoCount}
                disabled={!signature || !agree}
                onClick={() => onSend("commission")}
              >
                Зөвшөөрч, зар илгээх
              </SendButton>
            </Footer>
          </>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  points,
  cta,
  onPick,
  highlight = false,
}: {
  title: string;
  price: string;
  points: string[];
  cta: string;
  onPick: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl p-4.5 ${highlight ? "border-2 border-ink" : "border border-line-2"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-[17px] font-bold">{title}</span>
        <span className="h-display text-[15px]">{price}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[14px]">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow text-ink">
              <IconCheck size={12} />
            </span>
            {p}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onPick}
        className={`btn ${highlight ? "btn-ink" : "btn-yellow"} self-stretch sm:self-end`}
      >
        {cta}
      </button>
    </div>
  );
}
