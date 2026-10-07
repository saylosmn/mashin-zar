"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRANDS, OPTIONS } from "@/lib/cars";
import { errMsg } from "@/lib/format";
import { IconCamera, IconCheck, IconClose, IconSpinner } from "@/components/icons";

type Photo = { id: string; file: File; url: string };

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

export function PostForm({
  userId,
  defaultPhone,
  maxPhotos,
  minPhotos,
  cutoff,
}: {
  userId: string;
  defaultPhone: string;
  maxPhotos: number;
  minPhotos: number;
  cutoff: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [brand, setBrand] = useState("");
  const [yearMade, setYearMade] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [customOpt, setCustomOpt] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState<null | { step: number; done: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const allOptions = useMemo(() => Array.from(new Set([...OPTIONS, ...options])), [options]);
  const models = BRANDS[brand] ?? [];
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

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (photos.length < minPhotos) return setError(`Хамгийн багадаа ${minPhotos} зураг оруулна уу.`);
    const priceNum = Number(price.replace(/\D/g, ""));
    if (!priceNum) return setError("Үнээ оруулна уу.");
    if (!navigator.onLine) return setError("Интернэт холболт алга. Холболтоо шалгаад дахин илгээнэ үү.");

    const supabase = createClient();
    setBusy({ step: 2, done: 0 });
    const paths: string[] = [];
    try {
      for (const [i, p] of photos.entries()) {
        const blob = await compress(p.file);
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("ad-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        paths.push(path);
        setBusy({ step: 2, done: i + 1 });
      }
      setBusy({ step: 3, done: photos.length });
      const ym = Number(fd.get("year_imported")) || null;
      const { error: insErr } = await supabase.from("ads").insert({
        user_id: userId,
        brand: String(fd.get("brand")).trim(),
        model: String(fd.get("model")).trim(),
        trim: String(fd.get("trim") || "").trim() || null,
        plate_number: String(fd.get("plate_number")).trim().toUpperCase(),
        vin: String(fd.get("vin")).trim().toUpperCase(),
        phone: String(fd.get("phone")).replace(/[^\d+]/g, ""),
        year_made: Number(fd.get("year_made")),
        year_imported: ym,
        options,
        modifications: String(fd.get("modifications") || "").trim() || null,
        description: String(fd.get("description") || "").trim() || null,
        price: priceNum,
        photos: paths,
      });
      if (insErr) throw insErr;
      router.push("/my?created=1");
      router.refresh();
    } catch (err) {
      if (paths.length) await supabase.storage.from("ad-photos").remove(paths);
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
    <div className="flex flex-wrap gap-6 items-start">
      <form id="post-form" onSubmit={submit} className="flex-[999_1_560px] min-w-0 flex flex-col gap-4.5">
        <section className="card p-6 flex flex-col gap-3.5">
          <div className="flex justify-between items-baseline">
            <h2 className="m-0 text-[18px] font-bold">1 · Зураг</h2>
            <span className="mono text-[13px] text-muted">{photos.length} / {maxPhotos}</span>
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
                className={`relative aspect-square rounded-[10px] overflow-hidden bg-soft cursor-grab ${i === 0 ? "outline-2 outline-ink -outline-offset-2" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Зураг ${i + 1}`} className="w-full h-full object-cover" />
                {i === 0 && <span className="mono absolute left-1.5 bottom-1.5 bg-ink text-yellow text-[9px] font-bold px-1.5 py-0.5 rounded">НҮҮР</span>}
                <button
                  type="button"
                  aria-label={`Зураг ${i + 1} хасах`}
                  onClick={() => setPhotos((ph) => ph.filter((x) => x.id !== p.id))}
                  className="absolute right-1 top-1 w-7 h-7 rounded-full bg-ink/80 text-paper flex items-center justify-center border-0 cursor-pointer"
                >
                  <IconClose size={14} />
                </button>
              </div>
            ))}
            {photos.length < maxPhotos && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-[10px] border-[1.5px] border-dashed border-[#9aa0a9] bg-card text-ink flex flex-col items-center justify-center gap-1 text-[12px] cursor-pointer"
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
            Чирж оруулах эсвэл сонгох. Эхний зураг нүүр зураг болно, чирж дарааллыг өөрчилнө. {minPhotos}–{maxPhotos} зураг.
          </span>
        </section>

        <section className="card p-6 flex flex-col gap-3.5">
          <h2 className="m-0 text-[18px] font-bold">2 · Машин, сер ба он</h2>
          <div className="flex flex-wrap gap-3">
            <label className="label flex-[1_1_200px]">
              Марк
              <input name="brand" required list="brands" value={brand} onChange={(e) => setBrand(e.target.value)} className="input" placeholder="Toyota" />
              <datalist id="brands">{Object.keys(BRANDS).map((b) => <option key={b} value={b} />)}</datalist>
            </label>
            <label className="label flex-[1_1_200px]">
              Загвар
              <input name="model" required list="models" className="input" placeholder="Prius" />
              <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label className="label flex-[1_1_200px]">
              Аль сер
              <input name="trim" className="input" placeholder="ZVW55 · S Touring" />
            </label>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="label flex-[1_1_200px]">
              Үйлдвэрлэсэн он
              <input name="year_made" required type="number" min={1950} max={thisYear + 1} value={yearMade} onChange={(e) => setYearMade(e.target.value)} className="input mono" placeholder="2017" />
            </label>
            <label className="label flex-[1_1_200px]">
              Орж ирсэн он
              <input name="year_imported" type="number" min={1950} max={thisYear + 1} className="input mono" placeholder="2023" />
            </label>
            <div className="flex-[1_1_200px] h-12 flex items-center gap-2 px-3 bg-ink text-paper rounded-[12px] text-[13px]">
              {category ? (
                <>
                  <span className="mono bg-yellow text-ink text-[11px] font-bold px-2 py-0.5 rounded">
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

        <section className="card p-6 flex flex-col gap-3.5">
          <h2 className="m-0 text-[18px] font-bold">3 · Дугаар ба холбоо барих</h2>
          <div className="flex flex-wrap gap-3">
            <label className="label flex-[1_1_200px]">
              Улсын дугаар
              <input name="plate_number" required className="input mono text-[18px] font-bold tracking-[2px] border-2 border-ink text-center uppercase" placeholder="1234 УБА" />
            </label>
            <label className="label flex-[1_1_200px]">
              Арлын дугаар
              <input name="vin" required className="input mono uppercase" placeholder="ZVW55-8012345" />
            </label>
            <label className="label flex-[1_1_200px]">
              Утасны дугаар
              <input name="phone" required type="tel" minLength={8} defaultValue={defaultPhone} className="input mono" />
            </label>
          </div>
          <span className="text-[13px] text-muted">Улсын болон арлын дугаар бусдад нуугдмал харагдана. Зөвхөн менежер бүтнээр нь харна.</span>
        </section>

        <section className="card p-6 flex flex-col gap-3.5">
          <h2 className="m-0 text-[18px] font-bold">4 · Нэмэлт опшн</h2>
          <div className="flex flex-wrap gap-2">
            {allOptions.map((o) => {
              const on = options.includes(o);
              return (
                <label key={o} className={`flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[14px] cursor-pointer ${on ? "bg-ink text-paper" : "border border-line-2 bg-card"}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setOptions((s) => (on ? s.filter((x) => x !== o) : [...s, o]))}
                    className="m-0 accent-yellow"
                  />
                  {o}
                </label>
              );
            })}
            <div className="flex items-center gap-1.5">
              <input
                value={customOpt}
                onChange={(e) => setCustomOpt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (customOpt.trim()) setOptions((s) => [...s, customOpt.trim()]);
                    setCustomOpt("");
                  }
                }}
                placeholder="+ Өөр опшн"
                aria-label="Өөр опшн нэмэх"
                className="h-10 px-3.5 rounded-full border-[1.5px] border-dashed border-[#9aa0a9] bg-transparent text-[14px] outline-none w-40"
              />
            </div>
          </div>
        </section>

        <section className="card p-6 flex flex-wrap gap-3.5">
          <label className="label flex-[1_1_300px]">
            5 · Нэмж хийсэн зүйлс
            <textarea name="modifications" className="textarea font-normal" placeholder="Өвлийн шинэ дугуй, автозапуск, салоны бүрээс..." />
          </label>
          <label className="label flex-[1_1_300px]">
            6 · Нэмэлт тайлбар
            <textarea name="description" className="textarea font-normal" placeholder="Машины байдал, эзэмшлийн түүх, үзүүлэх цаг..." />
          </label>
        </section>

        <section className="card p-6 flex flex-col gap-3.5">
          <h2 className="m-0 text-[18px] font-bold">7 · Үнэ</h2>
          <div className="flex items-center h-16 max-w-[420px] border-2 border-ink rounded-[14px] px-4 gap-2 bg-card">
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
              className="h-display flex-1 min-w-0 bg-transparent outline-none text-[24px]"
            />
            <span className="h-display text-[22px]">₮</span>
          </div>
        </section>
      </form>

      <aside className="flex-[1_1_320px] bg-ink text-paper rounded-[18px] p-6 flex flex-col gap-4.5 lg:sticky lg:top-6">
        {busy ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <IconSpinner size={28} className="text-yellow" />
              <span className="h-display text-[18px]">Зар илгээж байна</span>
            </div>
            <p className="m-0 text-[14px] text-pale">Уншиж байна, түр хүлээнэ үү. Хуудсаа битгий хаагаарай.</p>
            <div className="flex justify-between text-[14px]">
              <span>Зураг байршуулж байна</span>
              <span className="mono font-bold">{busy.done} / {photos.length}</span>
            </div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={photos.length} aria-valuenow={busy.done} className="h-3 rounded-md bg-ink-line overflow-hidden">
              <div className="h-full bg-yellow rounded-md transition-all" style={{ width: `${(busy.done / Math.max(photos.length, 1)) * 100}%` }} />
            </div>
            <span className="text-[14px] text-pale">{busy.step === 3 ? "Менежерт илгээж байна…" : ""}</span>
          </div>
        ) : (
          <>
            <span className="h-display text-[18px]">Шалгах жагсаалт</span>
            <ul className="list-none p-0 m-0 flex flex-col gap-3 text-[14px]">
              {checks.map((c) => (
                <li key={c.label} className={`flex gap-2.5 items-center ${c.ok ? "" : "text-pale"}`}>
                  {c.ok ? (
                    <span className="w-[22px] h-[22px] rounded-full bg-yellow text-ink flex items-center justify-center"><IconCheck size={14} /></span>
                  ) : (
                    <span className="w-[22px] h-[22px] rounded-full border-2 border-muted" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>
            {error && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-3.5 py-3 text-[14px]">{error}</p>}
            <button form="post-form" className="btn btn-lg btn-yellow">Зар илгээх</button>
            <p className="m-0 text-[13px] leading-relaxed text-pale">
              Илгээсний дараа “Зар амжилттай үүслээ, манай менежер удахгүй холбогдоно” гэсэн мэдэгдэл гарна.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
