"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg, photoUrl } from "@/lib/format";
import { IconCamera, IconClose, IconSpinner } from "@/components/icons";
import { OptionPicker } from "@/components/OptionPicker";
import type { Ad } from "@/lib/types";

type Pic = { key: string; path?: string; file?: File; url: string };

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

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

/** Авто худалдааны зар засах: мэдээлэл, үнэ, зураг */
export function EditAdForm({ ad, userId, maxPhotos }: { ad: Ad; userId: string; maxPhotos: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pics, setPics] = useState<Pic[]>(ad.photos.map((p) => ({ key: p, path: p, url: photoUrl(p) ?? "" })));
  const [price, setPrice] = useState(fmt(ad.price));
  const [options, setOptions] = useState<string[]>(ad.options);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const room = maxPhotos - pics.length;
    const more = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, room)
      .map((file) => ({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setPics((p) => [...p, ...more]);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!pics.length) return setError("Дор хаяж нэг зураг байх ёстой.");
    const p = Number(price.replace(/\D/g, ""));
    if (!p) return setError("Үнээ оруулна уу.");
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    setBusy(true);
    const uploaded: string[] = [];
    try {
      const paths: string[] = [];
      for (const pic of pics) {
        if (pic.path) paths.push(pic.path);
        else if (pic.file) {
          const path = `${userId}/${crypto.randomUUID()}.jpg`;
          const { error: upErr } = await supabase.storage.from("ad-photos").upload(path, await compress(pic.file), { contentType: "image/jpeg" });
          if (upErr) throw upErr;
          uploaded.push(path);
          paths.push(path);
        }
      }
      const str = (k: string) => String(fd.get(k) ?? "").trim();
      const { error: rpcErr } = await supabase.rpc("dealer_update_ad", {
        p_ad: ad.id,
        p: {
          brand: str("brand"),
          model: str("model"),
          trim: str("trim"),
          year_made: Number(str("year_made")) || ad.year_made,
          year_imported: str("year_imported"),
          plate_number: str("plate_number"),
          vin: str("vin"),
          phone: str("phone").replace(/[^\d+]/g, ""),
          options,
          modifications: str("modifications"),
          description: str("description"),
          price: p,
          photos: paths,
        },
      });
      if (rpcErr) throw rpcErr;
      const removed = ad.photos.filter((x) => !paths.includes(x));
      if (removed.length) await supabase.storage.from("ad-photos").remove(removed);
      router.push("/my?ok=" + encodeURIComponent("Зар шинэчлэгдлээ"));
      router.refresh();
    } catch (err) {
      if (uploaded.length) await supabase.storage.from("ad-photos").remove(uploaded);
      setBusy(false);
      setError(`Хадгалж чадсангүй: ${errMsg(err)}`);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <section className="card p-5 flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <h2 className="m-0 text-[17px] font-bold">Зураг</h2>
          <span className="mono text-[13px] text-muted">{pics.length} / {maxPhotos}</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
          {pics.map((p, i) => (
            <div key={p.key} className="relative aspect-square rounded-xl overflow-hidden bg-paper border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              {i === 0 ? (
                <span className="absolute left-1.5 bottom-1.5 text-[10px] font-bold bg-yellow text-ink rounded px-1.5 py-0.5">НҮҮР</span>
              ) : (
                <button type="button" onClick={() => setPics((x) => [x[i], ...x.filter((_, j) => j !== i)])} className="absolute left-1.5 bottom-1.5 text-[10px] font-semibold bg-ink/80 text-paper rounded px-1.5 py-0.5 border-0 cursor-pointer">Нүүр болгох</button>
              )}
              <button type="button" aria-label="Зураг хасах" onClick={() => setPics((x) => x.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 w-7 h-7 rounded-full bg-ink/80 text-paper flex items-center justify-center border-0 cursor-pointer">
                <IconClose size={14} />
              </button>
            </div>
          ))}
          {pics.length < maxPhotos && (
            <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-line-2 bg-card flex flex-col items-center justify-center gap-1 text-[12px] text-muted cursor-pointer">
              <IconCamera size={22} /> Нэмэх
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </section>

      <section className="card p-5 flex flex-wrap gap-3.5">
        <label className="label flex-[1_1_200px]">Марк<input name="brand" required defaultValue={ad.brand} className="input" /></label>
        <label className="label flex-[1_1_200px]">Загвар<input name="model" required defaultValue={ad.model} className="input" /></label>
        <label className="label flex-[1_1_200px]">Сер<input name="trim" defaultValue={ad.trim ?? ""} className="input" /></label>
        <label className="label flex-[1_1_140px]">Үйлдвэрлэсэн он<input name="year_made" type="number" required defaultValue={ad.year_made} className="input mono" /></label>
        <label className="label flex-[1_1_140px]">Орж ирсэн он<input name="year_imported" type="number" defaultValue={ad.year_imported ?? ""} className="input mono" /></label>
        <label className="label flex-[1_1_160px]">Улсын дугаар<input name="plate_number" required defaultValue={ad.plate_number} className="input mono" /></label>
        <label className="label flex-[1_1_220px]">Арлын дугаар<input name="vin" required defaultValue={ad.vin} className="input mono" /></label>
        <label className="label flex-[1_1_160px]">Утас<input name="phone" required defaultValue={ad.phone} className="input mono" /></label>
        <div className="basis-full flex flex-col gap-2"><span className="text-[13px] font-semibold">Опшн</span><OptionPicker value={options} onChange={setOptions} /></div>
        <label className="label flex-[1_1_300px]">Нэмж хийсэн зүйлс<textarea name="modifications" defaultValue={ad.modifications ?? ""} className="textarea font-normal" /></label>
        <label className="label flex-[1_1_300px]">Тайлбар<textarea name="description" defaultValue={ad.description ?? ""} className="textarea font-normal" /></label>
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="m-0 text-[17px] font-bold">Үнэ</h2>
        <div className="flex items-center h-16 max-w-[420px] border-2 border-ink rounded-[14px] px-4 gap-2 bg-card">
          <input inputMode="numeric" required value={price} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setPrice(d ? fmt(Number(d)) : ""); }} aria-label="Үнэ" className="h-display flex-1 min-w-0 bg-transparent outline-none text-[24px]" />
          <span className="h-display text-[22px]">₮</span>
        </div>
      </section>

      {error && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-4 py-3 text-[14px]">{error}</p>}
      <div className="flex gap-2.5 justify-end">
        <button type="button" onClick={() => router.push("/my")} className="btn btn-lg btn-ghost" disabled={busy}>Болих</button>
        <button className="btn btn-lg btn-yellow" disabled={busy}>{busy ? <><IconSpinner size={20} /> Хадгалж байна…</> : "Хадгалах"}</button>
      </div>
    </form>
  );
}
