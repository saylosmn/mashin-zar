"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRANDS } from "@shared/cars";
import { OptionPicker } from "@/components/OptionPicker";
import { errMsg } from "@/lib/format";
import { IconCamera, IconCheck, IconClose, IconSpinner } from "@/components/icons";
import { SignaturePad } from "@/components/SignaturePad";
import { ContractView } from "@/components/ContractView";
import { tierLines, type ContractTerms } from "@shared/contract";
import { money } from "@/lib/format";
import type { Plan } from "@shared/types";
import { checkAgentCode } from "../actions";

type Photo = { id: string; file: File; url: string };
type Draft = {
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

async function compress(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
}

/** Гэрээнд бичигдэх утгууд — эдгээрийн аль нэг өөрчлөгдвөл шинэ гэрээ зурна. */
function contractKey(d: Draft, name: string) {
  return JSON.stringify([d.plate_number, d.vin, d.brand, d.model, d.price, d.year_made, d.phone, name]);
}

const normCode = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

/** Зар оруулах 2 сонголтын үнэ, хоног (тохиргооноос) */
export type PlanInfo = { featuredPrice: number; featuredDays: number; commissionFeaturedDays: number };

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
  plans: PlanInfo;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [brand, setBrand] = useState("");
  const [yearMade, setYearMade] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState<null | { step: number; done: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** Цонхны алхам: сонголт → (шимтгэлтэй бол) гэрээ / (төлбөртэй бол) баталгаажуулах */
  const [plan, setPlan] = useState<Plan | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [signName, setSignName] = useState(fullName);
  const [agentCode, setAgentCode] = useState(defaultAgentCode);
  /** Шалгагдсан агент (кодоор) — зарт agent_id болж орно */
  const agentRef = useRef<{ code: string; id: string; name: string } | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  /** Амжилттай гарын үсэг зурсан гэрээ (дахин оролдоход ашиглана). key нь гэрээнд орсон утгууд. */
  const contractRef = useRef<{ key: string; id: string } | null>(null);

  const models = BRANDS[brand] ?? [];
  const maxPct = Math.max(contract.terms.after, ...contract.terms.tiers.map((t) => t.percent));
  const y = Number(yearMade);
  const category = y ? (y >= cutoff ? "new" : "old") : null;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = maxPhotos - photos.length;
    const add = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room)
      .map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...add]);
  }

  function move(from: number, to: number) {
    setPhotos((p) => {
      const c = [...p];
      const [x] = c.splice(from, 1);
      c.splice(to, 0, x);
      return c;
    });
  }

  /** 1-р алхам: маягтыг шалгаад гэрээний цонх нээнэ */
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (photos.length < minPhotos) return setError(`Хамгийн багадаа ${minPhotos} зураг оруулна уу.`);
    const priceNum = Number(price.replace(/\D/g, ""));
    if (!priceNum) return setError("Үнээ оруулна уу.");
    const d: Draft = {
      brand: String(fd.get("brand")).trim(),
      model: String(fd.get("model")).trim(),
      trim: String(fd.get("trim") || "").trim() || null,
      plate_number: normCode(fd.get("plate_number")),
      vin: normCode(fd.get("vin")),
      phone: String(fd.get("phone")).replace(/[^\d+]/g, ""),
      year_made: Number(fd.get("year_made")),
      year_imported: Number(fd.get("year_imported")) || null,
      options,
      modifications: String(fd.get("modifications") || "").trim() || null,
      description: String(fd.get("description") || "").trim() || null,
      price: priceNum,
    };
    // Агентын код (заавал биш)
    const code = agentCode.trim().toUpperCase();
    if (code && agentRef.current?.code !== code) {
      const found = await checkAgentCode(code).catch(() => null);
      if (!found) return setError("Агентын код олдсонгүй. Кодоо шалгах эсвэл хоосон орхино уу.");
      agentRef.current = { code, ...found };
      setAgentName(found.name);
    }
    if (!code) agentRef.current = null;
    // Авто худалдаа: гэрээгүй, шууд нийтлэнэ
    if (dealer) return void send(d, null, "commission");
    setDraft(d);
    setPlan(null);
    setAgree(false);
    setSignature(null);
  }

  /** 2-р алхам: гэрээнд гарын үсэг зурж зөвшөөрөөд зар илгээнэ */
  async function confirmAndSend() {
    if (!draft) return;
    if (!signName.trim()) return setError("Овог нэрээ бичнэ үү.");
    if (!signature) return setError("Гарын үсгээ зурна уу.");
    if (!agree) return setError("Гэрээг уншиж зөвшөөрснөө тэмдэглэнэ үү.");
    await send(draft, signature, "commission");
  }

  /**
   * Зар үүсгэнэ: 1) зургуудыг байршуулна (3-аар зэрэг, дараалал хадгална) → 2) гэрээнд гарын үсэг (RPC)
   * → 3) зар оруулна. signature=null бол гэрээгүй (авто худалдаа, эсвэл онцлох төлбөртэй сонголт).
   * Гэрээ амжилттай үүсээд дараагийн алхам унавал, мэдээлэл өөрчлөгдөөгүй бол дахин оролдоход тэр гэрээг ашиглана.
   */
  async function send(draft: Draft, signature: string | null, plan: Plan) {
    if (!navigator.onLine) return setError("Интернэт холболт алга. Холболтоо шалгаад дахин илгээнэ үү.");
    setError(null);
    const supabase = createClient();
    const total = photos.length;
    setBusy({ step: 1, done: 0 });
    const uploaded: string[] = [];
    try {
      // 1) Зураг: 3-аар зэрэг байршуулна, paths[i] нь i-р зурагтай таарна
      const paths: string[] = new Array(total);
      let cursor = 0;
      let done = 0;
      let stop = false;
      const worker = async () => {
        while (!stop && cursor < total) {
          const i = cursor++;
          try {
            const blob = await compress(photos[i].file);
            const path = `${userId}/${crypto.randomUUID()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("ad-photos")
              .upload(path, blob, { contentType: "image/jpeg" });
            if (upErr) throw upErr;
            uploaded.push(path);
            paths[i] = path;
            setBusy({ step: 1, done: ++done });
          } catch (e) {
            stop = true;
            throw e;
          }
        }
      };
      const results = await Promise.allSettled([worker(), worker(), worker()]);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed) throw failed.reason;

      // 2) Гэрээ (улсын/арлын дугаар нь зарынхтай яг ижил утгаар)
      let contractId: string | null = null;
      if (signature) {
        setBusy({ step: 2, done: total });
        const key = contractKey(draft, signName.trim());
        if (contractRef.current?.key === key) {
          contractId = contractRef.current.id;
        } else {
          contractRef.current = null;
          const { data: cid, error: cErr } = await supabase.rpc("sign_contract", {
            p_full_name: signName.trim(),
            p_phone: draft.phone,
            p_brand: draft.brand,
            p_model: draft.model,
            p_year: draft.year_made,
            p_plate: draft.plate_number,
            p_vin: draft.vin,
            p_price: draft.price,
            p_signature: signature,
            p_ua: navigator.userAgent,
          });
          if (cErr) throw cErr;
          contractId = cid as string;
          contractRef.current = { key, id: contractId };
        }
      }

      // 3) Зар
      setBusy({ step: 3, done: total });
      const { data: row, error: insErr } = await supabase
        .from("ads")
        .insert({
          ...draft,
          user_id: userId,
          photos: paths,
          contract_id: contractId,
          agent_id: agentRef.current?.id ?? null,
          ...(dealer ? {} : { plan }),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      contractRef.current = null;
      // Гарын үсэгтэй гэрээний PDF-ийг ард нь бэлдэнэ
      if (contractId) fetch(`/api/contracts/${contractId}/pdf`, { method: "POST", keepalive: true }).catch(() => {});
      // Төлбөртэй сонголт: шууд дансны мэдээлэл, «Төлсөн» товчтой хуудас руу
      router.push(plan === "paid" && row?.id ? `/pay/${row.id}?created=1` : "/my?created=1");
      router.refresh();
    } catch (err) {
      if (uploaded.length)
        await supabase.storage
          .from("ad-photos")
          .remove(uploaded)
          .catch(() => {});
      setBusy(null);
      setError(navigator.onLine ? `Илгээж чадсангүй: ${errMsg(err)}` : "Интернэт холболт тасарлаа. Дахин оролдоно уу.");
    }
  }

  const thisYear = new Date().getFullYear();
  const checks = [
    { ok: photos.length >= minPhotos, label: `Зураг (${photos.length} / ${maxPhotos})` },
    { ok: Boolean(brand && yearMade), label: "Машин, сер, он" },
    { ok: true, label: "Дугаар, утас" },
    { ok: Boolean(Number(price.replace(/\D/g, ""))), label: "Үнэ" },
  ];

  return (
    <div className="flex flex-wrap items-start gap-6">
      <form id="post-form" onSubmit={submit} className="flex min-w-0 flex-[999_1_560px] flex-col gap-4.5">
        <section className="card flex flex-col gap-3.5 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-[18px] font-bold">1 · Зураг</h2>
            <span className="mono text-[13px] text-muted">
              {photos.length} / {maxPhotos}
            </span>
          </div>
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (e.dataTransfer.files.length) {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }
            }}
          >
            {photos.map((p, i) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  if (dragIdx !== null && !e.dataTransfer.files.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    move(dragIdx, i);
                    setDragIdx(null);
                  }
                }}
                className={`relative aspect-square cursor-grab overflow-hidden rounded-[10px] bg-soft ${i === 0 ? "outline-2 -outline-offset-2 outline-ink" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Зураг ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 ? (
                  <span className="mono absolute bottom-1.5 left-1.5 rounded bg-ink px-1.5 py-0.5 text-[9px] font-bold text-yellow">
                    НҮҮР
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => move(i, 0)}
                    className="absolute bottom-1 left-1 cursor-pointer rounded border-0 bg-ink/80 px-1.5 py-1 text-[10px] font-semibold text-paper"
                  >
                    Нүүр болгох
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Зураг ${i + 1} хасах`}
                  disabled={!!busy}
                  onClick={() => setPhotos((ph) => ph.filter((x) => x.id !== p.id))}
                  className="absolute top-1 right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-ink/80 text-paper"
                >
                  <IconClose size={14} />
                </button>
              </div>
            ))}
            {photos.length < maxPhotos && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-[#9aa0a9] bg-card text-[12px] text-ink"
              >
                <IconCamera size={22} /> Зураг нэмэх
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="text-[13px] text-muted">
            Чирж оруулах эсвэл сонгох. Эхний зураг нүүр зураг болно — «Нүүр болгох» товчоор эсвэл чирж солино.{" "}
            {minPhotos}–{maxPhotos} зураг.
          </span>
        </section>

        <section className="card flex flex-col gap-3.5 p-6">
          <h2 className="m-0 text-[18px] font-bold">2 · Машин, сер ба он</h2>
          <div className="flex flex-wrap gap-3">
            <label className="label flex-[1_1_200px]">
              Марк
              <input
                name="brand"
                required
                list="brands"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
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
              <input name="model" required list="models" className="input" placeholder="Prius" />
              <datalist id="models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <label className="label flex-[1_1_200px]">
              Аль сер
              <input name="trim" className="input" placeholder="ZVW55 · S Touring" />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="label flex-[1_1_200px]">
              Үйлдвэрлэсэн он
              <input
                name="year_made"
                required
                type="number"
                min={1950}
                max={thisYear + 1}
                value={yearMade}
                onChange={(e) => setYearMade(e.target.value)}
                className="input mono"
                placeholder="2017"
              />
            </label>
            <label className="label flex-[1_1_200px]">
              Орж ирсэн он
              <input
                name="year_imported"
                type="number"
                min={1950}
                max={thisYear + 1}
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
                name="plate_number"
                required
                className="input mono border-2 border-ink text-center text-[18px] font-bold tracking-[2px] uppercase"
                placeholder="1234 УБА"
              />
            </label>
            <label className="label flex-[1_1_200px]">
              Арлын дугаар
              <input name="vin" required className="input mono uppercase" placeholder="ZVW55-8012345" />
            </label>
            <label className="label flex-[1_1_200px]">
              Утасны дугаар
              <input
                name="phone"
                required
                type="tel"
                minLength={8}
                defaultValue={defaultPhone}
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
          <OptionPicker value={options} onChange={setOptions} />
        </section>

        <section className="card flex flex-wrap gap-3.5 p-6">
          <label className="label flex-[1_1_300px]">
            5 · Нэмж хийсэн зүйлс
            <textarea
              name="modifications"
              className="textarea font-normal"
              placeholder="Өвлийн шинэ дугуй, автозапуск, салоны бүрээс..."
            />
          </label>
          <label className="label flex-[1_1_300px]">
            6 · Нэмэлт тайлбар
            <textarea
              name="description"
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
              value={price}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "");
                setPrice(d ? new Intl.NumberFormat("en-US").format(Number(d)) : "");
              }}
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
              onChange={(e) => {
                setAgentCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 12),
                );
                setAgentName(null);
              }}
              autoComplete="off"
              placeholder="Жишээ: K7M2QX"
              className="input mono font-normal"
            />
            {agentName && <span className="text-[13px] font-normal text-active-fg">✓ Агент: {agentName}</span>}
            <span className="text-[12px] font-normal text-muted">
              Танд манай агент туслалцаа үзүүлсэн бол түүний кодыг оруулна уу.
            </span>
          </label>
        </section>
      </form>

      <aside className="flex flex-[1_1_320px] flex-col gap-4.5 rounded-[18px] bg-ink p-6 text-paper lg:sticky lg:top-6">
        {busy ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <IconSpinner size={28} className="text-yellow" />
              <span className="h-display text-[18px]">Зар илгээж байна</span>
            </div>
            <p className="m-0 text-[14px] text-pale">Уншиж байна, түр хүлээнэ үү. Хуудсаа битгий хаагаарай.</p>
            <div className="flex justify-between text-[14px]">
              <span>Зураг байршуулж байна</span>
              <span className="mono font-bold">
                {busy.done} / {photos.length}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={photos.length}
              aria-valuenow={busy.done}
              className="h-3 overflow-hidden rounded-md bg-ink-line"
            >
              <div
                className="h-full rounded-md bg-yellow transition-all"
                style={{ width: `${(busy.done / Math.max(photos.length, 1)) * 100}%` }}
              />
            </div>
            <span className="text-[14px] text-pale">
              {busy.step === 2
                ? "Гэрээ баталгаажуулж байна…"
                : busy.step === 3
                  ? dealer
                    ? "Нийтэлж байна…"
                    : plan === "paid"
                      ? "Илгээж байна…"
                      : "Шалгалтад илгээж байна…"
                  : ""}
            </span>
          </div>
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
            {error && (
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contract-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-4"
        >
          <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-card sm:max-w-[760px] sm:rounded-[22px]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex flex-col">
                <span className="text-[12px] text-muted">{plan ? "Алхам 3 / 3" : "Алхам 2 / 3 · Сонголт"}</span>
                <h2 id="contract-title" className="m-0 text-[18px] font-bold">
                  {plan === "commission"
                    ? "Зуучлалын гэрээ"
                    : plan === "paid"
                      ? "Онцлох зар · шимтгэлгүй"
                      : "Зараа хэрхэн байршуулах вэ?"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Хаах"
                disabled={!!busy}
                onClick={() => setDraft(null)}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-0 bg-paper disabled:opacity-40"
              >
                <IconClose size={20} />
              </button>
            </div>

            {!plan && (
              <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
                <PlanCard
                  title="Шимтгэлтэй · агент зарна"
                  price={`Одоо 0₮ · зарагдвал ${maxPct}% хүртэл`}
                  points={[
                    plans.commissionFeaturedDays > 0
                      ? `⭐ ${plans.commissionFeaturedDays} хоног онцлох зар — үнэгүй, жагсаалтын эхэнд`
                      : "Зар нийтэд үнэгүй харагдана",
                    "Манай агентууд худалдан авагч хайж, хурдан зарж өгнө",
                    "Шимтгэлийг зөвхөн машин зарагдсаны дараа төлнө (гэрээтэй)",
                  ]}
                  onPick={() => {
                    setError(null);
                    setAgree(false);
                    setSignature(null);
                    setPlan("commission");
                  }}
                  cta="Сонгох · гэрээ"
                  highlight
                />
                <PlanCard
                  title="Онцлох зар · шимтгэлгүй"
                  price={`${money(plans.featuredPrice)} нэг удаа`}
                  points={[
                    `⭐ ${plans.featuredDays} хоног онцлох — жагсаалтын эхэнд, тэмдэгтэй`,
                    "Зарагдахад ямар ч шимтгэл төлөхгүй, өөрөө зарна",
                    "Дансаар шилжүүлээд «Төлсөн» дарна — баталгаажмагц нийтлэгдэнэ",
                  ]}
                  onPick={() => {
                    setError(null);
                    setPlan("paid");
                  }}
                  cta="Сонгох · төлбөр"
                />
                <span className="text-[12px] text-muted">
                  Дэлгэрэнгүй: шимтгэлийн шат — {tierLines(contract.terms).join("; ")}.
                </span>
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
                    <li>«Зар илгээх» дарахад зар хадгалагдаж, дансны мэдээлэл гарна.</li>
                    <li>Гүйлгээний утгад таны кодыг бичиж шилжүүлнэ.</li>
                    <li>«Төлбөр төлсөн» дарна — орлого баталгаажмагц зар шууд нийтлэгдэж, онцлох болно.</li>
                  </ol>
                  {error && (
                    <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-3 text-[14px] text-[#9b1c1c]">
                      {error}
                    </p>
                  )}
                </div>
                <div className="flex flex-col-reverse gap-2.5 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setPlan(null)}
                    className="btn btn-lg btn-ghost"
                  >
                    Буцах
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => send(draft, null, "paid")}
                    className="btn btn-lg btn-yellow disabled:opacity-50"
                  >
                    {busy ? (
                      <>
                        <IconSpinner size={20} />
                        {busy.step === 1 ? `Зураг ${busy.done} / ${photos.length}` : "Илгээж байна…"}
                      </>
                    ) : (
                      "Зар илгээх · төлбөр рүү"
                    )}
                  </button>
                </div>
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
                      onChange={(e) => setSignName(e.target.value)}
                      className="input"
                      placeholder="Овог нэр"
                    />
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold">Гарын үсэг</span>
                    <SignaturePad onChange={setSignature} />
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug">
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      className="mt-0.5 h-5 w-5 accent-[#111317]"
                    />
                    <span>Би гэрээг бүрэн уншиж танилцсан бөгөөд шимтгэлийн нөхцөлийг зөвшөөрч байна.</span>
                  </label>
                  {error && (
                    <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-3 text-[14px] text-[#9b1c1c]">
                      {error}
                    </p>
                  )}
                </div>
                <div className="flex flex-col-reverse gap-2.5 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setPlan(null)}
                    className="btn btn-lg btn-ghost"
                  >
                    Буцах
                  </button>
                  <button
                    type="button"
                    disabled={!!busy || !signature || !agree}
                    onClick={confirmAndSend}
                    className="btn btn-lg btn-yellow disabled:opacity-50"
                  >
                    {busy ? (
                      <>
                        <IconSpinner size={20} />
                        {busy.step === 1
                          ? `Зураг ${busy.done} / ${photos.length}`
                          : busy.step === 2
                            ? "Гэрээ хадгалж байна…"
                            : "Илгээж байна…"}
                      </>
                    ) : (
                      "Зөвшөөрч, зар илгээх"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  title,
  price,
  points,
  onPick,
  cta,
  highlight = false,
}: {
  title: string;
  price: string;
  points: string[];
  onPick: () => void;
  cta: string;
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
