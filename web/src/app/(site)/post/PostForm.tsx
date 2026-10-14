"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  agentCodeInput,
  categoryOf,
  draftError,
  emptyAdFields,
  priceInput,
  publishAd,
  toDraft,
  type AdDraft,
  type AdFields,
  type PlanSettings,
  type PublishStep,
} from "@shared/ad-post";
import { BRANDS } from "@shared/cars";
import type { ContractTerms } from "@shared/contract";
import type { Plan } from "@shared/types";
import { errMsg, money } from "@/lib/format";
import { OptionPicker } from "@/components/OptionPicker";
import { IconCheck, IconSpinner } from "@/components/icons";
import { adBackend } from "@/features/post/backend";
import { PhotoPicker, type Photo } from "@/features/post/PhotoPicker";
import { PlanDialog } from "@/features/post/PlanDialog";
import { checkAgentCode } from "../actions";

type Busy = { step: PublishStep; done: number } | null;

export function PostForm({
  userId,
  defaultPhone,
  maxPhotos,
  minPhotos,
  cutoff,
  fullName,
  contract,
  dealer = false,
  defaultAgentCode = "",
  plans,
}: {
  userId: string;
  defaultPhone: string;
  maxPhotos: number;
  minPhotos: number;
  cutoff: number;
  fullName: string;
  contract: { company: string; terms: ContractTerms };
  dealer?: boolean;
  /** Агентын холбоосоор (?ref=КОД) орж ирсэн бол */
  defaultAgentCode?: string;
  plans: PlanSettings;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [fields, setFields] = useState<AdFields>(() => emptyAdFields(defaultPhone));
  const [agentCode, setAgentCode] = useState(defaultAgentCode);
  const [agent, setAgent] = useState<{ code: string; id: string; name: string } | null>(null);
  /** Маягт шалгагдсаны дараах цонх (сонголт -> гэрээ/төлбөр) */
  const [draft, setDraft] = useState<AdDraft | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [signName, setSignName] = useState(fullName);
  const [signature, setSignature] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const contractRef = useRef<{ key: string; id: string } | null>(null);

  const set =
    <K extends keyof AdFields>(k: K) =>
    (v: AdFields[K]) =>
      setFields((f) => ({ ...f, [k]: v }));
  const current = toDraft(fields);
  const category = categoryOf(current.year_made, cutoff);
  const thisYear = new Date().getFullYear();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const err = draftError(current, photos.length, minPhotos);
    if (err) return setError(err);
    let found = agent;
    if (!agentCode) found = null;
    else if (agent?.code !== agentCode) {
      const row = await checkAgentCode(agentCode).catch(() => null);
      if (!row) return setError("Агентын код олдсонгүй. Кодоо шалгах эсвэл хоосон орхино уу.");
      found = { code: agentCode, ...row };
    }
    setAgent(found);
    if (dealer) return void send(current, null, found);
    setDraft(current);
    setPlan(null);
    setAgree(false);
    setSignature(null);
  }

  function sendWithPlan(chosen: Plan) {
    if (!draft) return;
    if (chosen === "commission") {
      if (!signName.trim()) return setError("Овог нэрээ бичнэ үү.");
      if (!signature) return setError("Гарын үсгээ зурна уу.");
      if (!agree) return setError("Гэрээг уншиж зөвшөөрснөө тэмдэглэнэ үү.");
    }
    void send(draft, chosen, agent);
  }

  async function send(d: AdDraft, chosen: Plan | null, withAgent: typeof agent) {
    if (!navigator.onLine) return setError("Интернэт холболт алга. Холболтоо шалгаад дахин илгээнэ үү.");
    setError(null);
    try {
      const res = await publishAd(
        adBackend(
          userId,
          photos.map((p) => p.file),
        ),
        {
          userId,
          draft: d,
          photoCount: photos.length,
          plan: chosen,
          agentId: withAgent?.id ?? null,
          signer: signName.trim(),
          signature: chosen === "commission" ? signature : null,
          contract: contractRef,
        },
        (step, done) => setBusy({ step, done }),
      );
      // Гарын үсэгтэй гэрээний PDF-ийг ард нь бэлдэнэ
      if (res.contractId)
        fetch(`/api/contracts/${res.contractId}/pdf`, { method: "POST", keepalive: true }).catch(() => {});
      router.push(chosen === "paid" ? `/pay/${res.id}?created=1` : "/my?created=1");
      router.refresh();
    } catch (e) {
      setBusy(null);
      setError(navigator.onLine ? `Илгээж чадсангүй: ${errMsg(e)}` : "Интернэт холболт тасарлаа. Дахин оролдоно уу.");
    }
  }

  const checks = [
    { ok: photos.length >= minPhotos, label: `Зураг (${photos.length} / ${maxPhotos})` },
    { ok: Boolean(fields.brand && fields.yearMade), label: "Машин, сер, он" },
    { ok: Boolean(fields.plate && fields.vin), label: "Дугаар, утас" },
    { ok: current.price > 0, label: "Үнэ" },
  ];

  return (
    <div className="flex flex-wrap items-start gap-6">
      <form id="post-form" onSubmit={submit} className="flex min-w-0 flex-[999_1_560px] flex-col gap-4.5">
        <PhotoPicker photos={photos} onChange={setPhotos} max={maxPhotos} min={minPhotos} disabled={!!busy} />

        <section className="card flex flex-col gap-3.5 p-6">
          <h2 className="m-0 text-[18px] font-bold">2 · Машин, сер ба он</h2>
          <div className="flex flex-wrap gap-3">
            <label className="label flex-[1_1_200px]">
              Марк
              <input
                required
                list="brands"
                value={fields.brand}
                onChange={(e) => set("brand")(e.target.value)}
                className="input"
                placeholder="Toyota"
              />
              <datalist id="brands">
                {Object.keys(BRANDS).map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
            <label className="label flex-[1_1_200px]">
              Загвар
              <input
                required
                list="models"
                value={fields.model}
                onChange={(e) => set("model")(e.target.value)}
                className="input"
                placeholder="Prius"
              />
              <datalist id="models">
                {(BRANDS[fields.brand] ?? []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <label className="label flex-[1_1_200px]">
              Аль сер
              <input
                value={fields.trim}
                onChange={(e) => set("trim")(e.target.value)}
                className="input"
                placeholder="ZVW55 · S Touring"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="label flex-[1_1_200px]">
              Үйлдвэрлэсэн он
              <input
                required
                type="number"
                min={1950}
                max={thisYear + 1}
                value={fields.yearMade}
                onChange={(e) => set("yearMade")(e.target.value)}
                className="input mono"
                placeholder="2017"
              />
            </label>
            <label className="label flex-[1_1_200px]">
              Орж ирсэн он
              <input
                type="number"
                min={1950}
                max={thisYear + 1}
                value={fields.yearImported}
                onChange={(e) => set("yearImported")(e.target.value)}
                className="input mono"
                placeholder="2023"
              />
            </label>
            <div className="flex h-12 flex-[1_1_200px] items-center gap-2 rounded-[12px] bg-ink px-3 text-[13px] text-paper">
              {category ? (
                <>
                  <span className="mono rounded bg-yellow px-2 py-0.5 text-[11px] font-bold text-ink">
                    {category === "new" ? `${cutoff}+` : `${cutoff}-аас өмнө`}
                  </span>
                  автомат ангилал
                </>
              ) : (
                <span className="text-pale">Ангилал оноор тогтоно</span>
              )}
            </div>
          </div>
        </section>

        <section className="card flex flex-col gap-3.5 p-6">
          <h2 className="m-0 text-[18px] font-bold">3 · Дугаар ба холбоо барих</h2>
          <div className="flex flex-wrap gap-3">
            <label className="label flex-[1_1_200px]">
              Улсын дугаар
              <input
                required
                value={fields.plate}
                onChange={(e) => set("plate")(e.target.value)}
                className="input mono border-2 border-ink text-center text-[18px] font-bold tracking-[2px] uppercase"
                placeholder="1234 УБА"
              />
            </label>
            <label className="label flex-[1_1_200px]">
              Арлын дугаар
              <input
                required
                value={fields.vin}
                onChange={(e) => set("vin")(e.target.value)}
                className="input mono uppercase"
                placeholder="ZVW55-8012345"
              />
            </label>
            <label className="label flex-[1_1_200px]">
              Утасны дугаар
              <input
                required
                type="tel"
                minLength={8}
                value={fields.phone}
                onChange={(e) => set("phone")(e.target.value)}
                className="input mono"
              />
            </label>
          </div>
          <span className="text-[13px] text-muted">
            Улсын болон арлын дугаар бусдад нуугдмал харагдана. Зөвхөн манай ажилтан бүтнээр нь харна.
          </span>
        </section>

        <section className="card flex flex-col gap-3.5 p-6">
          <h2 className="m-0 text-[18px] font-bold">4 · Нэмэлт опшн</h2>
          <OptionPicker value={fields.options} onChange={set("options")} />
        </section>

        <section className="card flex flex-wrap gap-3.5 p-6">
          <label className="label flex-[1_1_300px]">
            5 · Нэмж хийсэн зүйлс
            <textarea
              value={fields.modifications}
              onChange={(e) => set("modifications")(e.target.value)}
              className="textarea font-normal"
              placeholder="Өвлийн шинэ дугуй, автозапуск, салоны бүрээс..."
            />
          </label>
          <label className="label flex-[1_1_300px]">
            6 · Нэмэлт тайлбар
            <textarea
              value={fields.description}
              onChange={(e) => set("description")(e.target.value)}
              className="textarea font-normal"
              placeholder="Машины байдал, эзэмшлийн түүх, үзүүлэх цаг..."
            />
          </label>
        </section>

        <section className="card flex flex-col gap-3.5 p-6">
          <h2 className="m-0 text-[18px] font-bold">7 · Үнэ</h2>
          <div className="flex h-16 max-w-[420px] items-center gap-2 rounded-[14px] border-2 border-ink bg-card px-4">
            <input
              inputMode="numeric"
              required
              value={fields.price}
              onChange={(e) => set("price")(priceInput(e.target.value))}
              aria-label="Үнэ"
              placeholder="48,500,000"
              className="h-display min-w-0 flex-1 bg-transparent text-[24px] outline-none"
            />
            <span className="h-display text-[22px]">₮</span>
          </div>
          <label className="label mt-1 max-w-[420px]">
            Агентын код <span className="font-normal text-muted">(заавал биш)</span>
            <input
              value={agentCode}
              onChange={(e) => setAgentCode(agentCodeInput(e.target.value))}
              autoComplete="off"
              placeholder="Жишээ: K7M2QX"
              className="input mono font-normal"
            />
            {agent && agent.code === agentCode && (
              <span className="text-[13px] font-normal text-active-fg">✓ Агент: {agent.name}</span>
            )}
            <span className="text-[12px] font-normal text-muted">
              Танд манай агент туслалцаа үзүүлсэн бол түүний кодыг оруулна уу.
            </span>
          </label>
        </section>
      </form>

      <aside className="flex flex-[1_1_320px] flex-col gap-4.5 rounded-[18px] bg-ink p-6 text-paper lg:sticky lg:top-6">
        {busy ? (
          <UploadProgress busy={busy} total={photos.length} dealer={dealer} plan={plan} />
        ) : (
          <>
            <span className="h-display text-[18px]">Шалгах жагсаалт</span>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[14px]">
              {checks.map((c) => (
                <li key={c.label} className={`flex items-center gap-2.5 ${c.ok ? "" : "text-pale"}`}>
                  {c.ok ? (
                    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-yellow text-ink">
                      <IconCheck size={14} />
                    </span>
                  ) : (
                    <span className="h-[22px] w-[22px] rounded-full border-2 border-muted" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>
            {error && !draft && (
              <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-3 text-[14px] text-[#9b1c1c]">
                {error}
              </p>
            )}
            <button form="post-form" className="btn btn-lg btn-yellow">
              {dealer ? "Зар нийтлэх" : "Үргэлжлүүлэх · Сонголт"}
            </button>
            <p className="m-0 text-[13px] leading-relaxed text-pale">
              {dealer
                ? "Авто худалдааны зар шалгалтгүйгээр шууд нийтлэгдэнэ."
                : `Дараагийн алхамд 2 сонголтоос нэгийг сонгоно: зарагдвал шимтгэл төлөх (онцлох зар үнэгүй, агент зарна), эсвэл ${money(plans.featuredPrice)} төлж шимтгэлгүй онцлох зар байршуулах.`}
            </p>
          </>
        )}
      </aside>

      {draft && (
        <PlanDialog
          draft={draft}
          plan={plan}
          onPlan={(p) => {
            setError(null);
            setPlan(p);
          }}
          onClose={() => setDraft(null)}
          contract={contract}
          plans={plans}
          signName={signName}
          onSignName={setSignName}
          signature={signature}
          onSignature={setSignature}
          agree={agree}
          onAgree={setAgree}
          error={error}
          busy={busy}
          photoCount={photos.length}
          onSend={sendWithPlan}
        />
      )}
    </div>
  );
}

function UploadProgress({
  busy,
  total,
  dealer,
  plan,
}: {
  busy: NonNullable<Busy>;
  total: number;
  dealer: boolean;
  plan: Plan | null;
}) {
  const stepText =
    busy.step === 2
      ? "Гэрээ баталгаажуулж байна…"
      : busy.step === 3
        ? dealer
          ? "Нийтэлж байна…"
          : plan === "paid"
            ? "Илгээж байна…"
            : "Шалгалтад илгээж байна…"
        : "";
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconSpinner size={28} className="text-yellow" />
        <span className="h-display text-[18px]">Зар илгээж байна</span>
      </div>
      <p className="m-0 text-[14px] text-pale">Уншиж байна, түр хүлээнэ үү. Хуудсаа битгий хаагаарай.</p>
      <div className="flex justify-between text-[14px]">
        <span>Зураг байршуулж байна</span>
        <span className="mono font-bold">
          {busy.done} / {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={busy.done}
        className="h-3 overflow-hidden rounded-md bg-ink-line"
      >
        <div
          className="h-full rounded-md bg-yellow transition-all"
          style={{ width: `${(busy.done / Math.max(total, 1)) * 100}%` }}
        />
      </div>
      <span className="text-[14px] text-pale">{stepText}</span>
    </div>
  );
}
