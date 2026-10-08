import Link from "next/link";
import { MobileCollapse } from "@/components/MobileCollapse";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireUser } from "@/lib/data";
import { AdCard } from "@/components/AdCard";
import { IconBell, IconSearch } from "@/components/icons";
import { BRANDS } from "@/lib/cars";
import { saveFilterAlert } from "./actions";
import type { PublicAd } from "@/lib/types";

const PAGE = 24;
type SP = Record<string, string | undefined>;

function href(sp: SP, patch: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  await requireUser();
  const settings = await getSettings();
  const supabase = await createClient();
  const cat = sp.cat === "new" || sp.cat === "old" ? sp.cat : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").replace(/[,()%*]/g, " ").trim();

  let query = supabase.from("public_ads").select("*", { count: "exact" });
  if (cat) query = query.eq("category", cat);
  if (q) query = query.or(`brand.ilike.%${q}%,model.ilike.%${q}%,trim.ilike.%${q}%`);
  if (sp.brand) query = query.eq("brand", sp.brand);
  if (sp.model) query = query.ilike("model", `%${sp.model.replace(/[,()%*]/g, "")}%`);
  if (Number(sp.pmin)) query = query.gte("price", Number(sp.pmin) * 1_000_000);
  if (Number(sp.pmax)) query = query.lte("price", Number(sp.pmax) * 1_000_000);
  if (Number(sp.ymin)) query = query.gte("year_made", Number(sp.ymin));
  if (Number(sp.ymax)) query = query.lte("year_made", Number(sp.ymax));
  if (Number(sp.imin)) query = query.gte("year_imported", Number(sp.imin));
  if (Number(sp.imax)) query = query.lte("year_imported", Number(sp.imax));
  if (sp.sort === "price_asc") query = query.order("price", { ascending: true });
  else if (sp.sort === "price_desc") query = query.order("price", { ascending: false });
  else query = query.order("approved_at", { ascending: false, nullsFirst: false });
  query = query.range((page - 1) * PAGE, page * PAGE - 1);

  const [{ data, count, error }, all, nw, old] = await Promise.all([
    query,
    supabase.from("public_ads").select("id", { count: "exact", head: true }),
    supabase.from("public_ads").select("id", { count: "exact", head: true }).eq("category", "new"),
    supabase.from("public_ads").select("id", { count: "exact", head: true }).eq("category", "old"),
  ]);
  if (error) throw new Error(error.message);
  const ads = (data ?? []) as PublicAd[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const cy = settings.cutoff_year;
  const hasFilters = Boolean(q || sp.brand || sp.model || sp.pmin || sp.pmax || sp.ymin || sp.ymax || sp.imin || sp.imax);

  const tabs = [
    { key: undefined, label: "Бүгд", n: all.count ?? 0 },
    { key: "new", label: `${cy} ба хойш`, n: nw.count ?? 0 },
    { key: "old", label: `${cy}-аас өмнө`, n: old.count ?? 0 },
  ];

  return (
    <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="h-display m-0 text-[clamp(26px,3vw,38px)]">Худалдаалагдаж буй машинууд</h1>
          <span className="text-[14px] text-muted">Менежерээр шалгагдсан зарууд</span>
        </div>
        <nav aria-label="Ангилал" className="flex flex-wrap gap-1 p-1 bg-soft rounded-xl">
          {tabs.map((t) => {
            const on = (t.key ?? "") === (cat ?? "");
            return (
              <Link
                key={t.label}
                href={href(sp, { cat: t.key, page: undefined })}
                aria-current={on ? "page" : undefined}
                className={`h-10 px-4 rounded-[9px] flex items-center text-[14px] no-underline ${
                  on ? "bg-ink text-yellow font-semibold" : "text-body"
                }`}
              >
                {t.label} · {t.n}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-wrap gap-6 items-start">
        <MobileCollapse label="Шүүлтүүр" count={[sp.brand, sp.model, sp.pmin || sp.pmax, sp.ymin || sp.ymax, sp.imin || sp.imax].filter(Boolean).length} className="flex-[1_1_240px] max-w-full">
        <aside aria-label="Шүүлтүүр" className="card p-5 flex flex-col gap-4">
          <form action="/" className="flex flex-col gap-4">
            {cat && <input type="hidden" name="cat" value={cat} />}
            {q && <input type="hidden" name="q" value={q} />}
            <div className="flex justify-between items-center">
              <span className="font-bold text-[15px]">Шүүлтүүр</span>
              {hasFilters && (
                <Link href={cat ? `/?cat=${cat}` : "/"} className="text-[13px] text-muted">
                  Цэвэрлэх
                </Link>
              )}
            </div>
            <label className="label">
              Марк
              <select name="brand" defaultValue={sp.brand ?? ""} className="input h-11">
                <option value="">Бүгд</option>
                {Object.keys(BRANDS).map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="label">
              Загвар
              <input name="model" defaultValue={sp.model ?? ""} placeholder="Жишээ: Prius" className="input h-11" />
            </label>
            <fieldset className="border-0 p-0 m-0 flex flex-col gap-1.5">
              <legend className="text-[13px] font-semibold pb-1.5">Үнэ (сая ₮)</legend>
              <div className="flex gap-2">
                <input name="pmin" type="number" min="0" defaultValue={sp.pmin} placeholder="Доод" aria-label="Доод үнэ" className="input h-11" />
                <input name="pmax" type="number" min="0" defaultValue={sp.pmax} placeholder="Дээд" aria-label="Дээд үнэ" className="input h-11" />
              </div>
            </fieldset>
            <fieldset className="border-0 p-0 m-0 flex flex-col gap-1.5">
              <legend className="text-[13px] font-semibold pb-1.5">Үйлдвэрлэсэн он</legend>
              <div className="flex gap-2">
                <input name="ymin" type="number" defaultValue={sp.ymin} placeholder="Эхлэх" aria-label="Эхлэх он" className="input h-11" />
                <input name="ymax" type="number" defaultValue={sp.ymax} placeholder="Дуусах" aria-label="Дуусах он" className="input h-11" />
              </div>
            </fieldset>
            <fieldset className="border-0 p-0 m-0 flex flex-col gap-1.5">
              <legend className="text-[13px] font-semibold pb-1.5">Орж ирсэн он</legend>
              <div className="flex gap-2">
                <input name="imin" type="number" defaultValue={sp.imin} placeholder="Эхлэх" aria-label="Орж ирсэн, эхлэх" className="input h-11" />
                <input name="imax" type="number" defaultValue={sp.imax} placeholder="Дуусах" aria-label="Орж ирсэн, дуусах" className="input h-11" />
              </div>
            </fieldset>
            <label className="label">
              Эрэмбэ
              <select name="sort" defaultValue={sp.sort ?? ""} className="input h-11">
                <option value="">Шинэ нь эхэндээ</option>
                <option value="price_asc">Үнэ өсөхөөр</option>
                <option value="price_desc">Үнэ буурахаар</option>
              </select>
            </label>
            <button className="btn btn-ink h-[46px]">
              <IconSearch size={18} /> Хайх
            </button>
          </form>
          <form action={saveFilterAlert} className="border-t border-[#ecede9] pt-4">
            <input type="hidden" name="cat" value={cat ?? ""} />
            <input type="hidden" name="brand" value={sp.brand ?? ""} />
            <input type="hidden" name="pmax" value={sp.pmax ?? ""} />
            <button className="btn btn-ghost w-full text-[13px] h-auto py-2.5 whitespace-normal text-left">
              <IconBell size={18} /> Энэ шүүлтүүрт тохирох шинэ зар орвол мэдэгдэх
            </button>
          </form>
        </aside>
        </MobileCollapse>

        <section className="flex-[999_1_560px] min-w-0 flex flex-col gap-3.5">
          <span className="text-[14px] text-muted">{total} зар олдлоо</span>
          {ads.length === 0 ? (
            <div className="card px-6 py-14 flex flex-col items-center gap-5 text-center">
              <div className="w-[104px] h-[104px] rounded-[28px] bg-paper border border-line flex items-center justify-center">
                <IconSearch size={48} />
              </div>
              <div className="flex flex-col gap-2 max-w-[420px]">
                <h2 className="h-display m-0 text-[22px]">Илэрц олдсонгүй</h2>
                <p className="m-0 text-[15px] leading-relaxed text-body">
                  {hasFilters
                    ? "Шүүлтүүрээ сулруулах эсвэл ийм зар орохоор мэдэгдэл авах боломжтой."
                    : "Одоогоор идэвхтэй зар алга. Анхны зараа тавиарай!"}
                </p>
              </div>
              <div className="flex gap-2.5 flex-wrap justify-center">
                {hasFilters && <Link href="/" className="btn btn-lg btn-ghost">Шүүлтүүр цэвэрлэх</Link>}
                <Link href="/post" className="btn btn-lg btn-ink">Зар нэмэх</Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-[18px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {ads.map((a) => (
                <AdCard key={a.id} ad={a} cutoff={cy} />
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav aria-label="Хуудаслалт" className="flex justify-center gap-1.5 pt-3 flex-wrap">
              {page > 1 && <Link href={href(sp, { page: String(page - 1) })} className="btn btn-ghost">Өмнөх</Link>}
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((n) => Math.abs(n - page) <= 2 || n === 1 || n === pages)
                .map((n) => (
                  <Link
                    key={n}
                    href={href(sp, { page: String(n) })}
                    aria-current={n === page ? "page" : undefined}
                    className={`btn mono w-11 px-0 ${n === page ? "btn-ink" : "btn-ghost"}`}
                  >
                    {n}
                  </Link>
                ))}
              {page < pages && <Link href={href(sp, { page: String(page + 1) })} className="btn btn-ghost">Дараах</Link>}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
