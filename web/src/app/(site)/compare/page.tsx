import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { categoryLong, money, num } from "@/lib/format";
import { bestIndexes, parseIds } from "@/lib/compare";
import { CarPhoto } from "@/components/CarPhoto";
import { CompareSync, RemoveFromCompare } from "./CompareClient";
import type { PublicAd } from "@/lib/types";

export const metadata: Metadata = { title: "Машин харьцуулах", robots: { index: false } };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids: raw } = await searchParams;
  const ids = parseIds(raw);
  const supabase = await createClient();
  const [settings, { data }] = await Promise.all([
    getSettings(),
    ids.length ? supabase.from("public_ads").select("*").in("id", ids) : Promise.resolve({ data: [] as PublicAd[] }),
  ]);
  // URL-д байгаа дарааллаар; нийтээс хасагдсан (зарагдсан, хугацаа дууссан) зар орохгүй
  const ads = ids.map((id) => (data as PublicAd[] | null)?.find((a) => a.id === id)).filter((a): a is PublicAd => Boolean(a));
  const cy = settings.cutoff_year;

  if (ads.length === 0)
    return (
      <main className="max-w-[900px] w-full mx-auto px-4 sm:px-6 pt-10 pb-16 flex flex-col gap-4 items-center text-center">
        <CompareSync ids={[]} />
        <h1 className="h-display m-0 text-[26px]">Машин харьцуулах</h1>
        <p className="m-0 text-[15px] text-body max-w-[460px]">
          Зарын хуудсан дээрх «⇄ Харьцуулах» товчоор 2–3 машин сонгоод энд зэрэгцүүлж харна.
        </p>
        <Link href="/" className="btn btn-lg btn-ink">Зарууд үзэх</Link>
      </main>
    );

  const bestPrice = bestIndexes(ads.map((a) => a.price), "min");
  const bestYear = bestIndexes(ads.map((a) => a.year_made), "max");
  const bestImport = bestIndexes(ads.map((a) => a.year_imported), "max");
  const bestOptions = bestIndexes(ads.map((a) => a.options.length), "max");
  const allOptions = Array.from(new Set(ads.flatMap((a) => a.options))).sort((a, b) => a.localeCompare(b, "mn"));

  type Row = { label: string; cells: React.ReactNode[]; best?: number[] };
  const rows: Row[] = [
    { label: "Үнэ", cells: ads.map((a) => <span key={a.id} className="h-display text-[17px]">{money(a.price)}</span>), best: bestPrice },
    { label: "Үйлдвэрлэсэн он", cells: ads.map((a) => a.year_made), best: bestYear },
    { label: "Орж ирсэн он", cells: ads.map((a) => a.year_imported ?? "—"), best: bestImport },
    { label: "Ангилал", cells: ads.map((a) => categoryLong(a.category, cy)) },
    { label: "Сер", cells: ads.map((a) => a.trim || "—") },
    { label: "Улсын дугаар", cells: ads.map((a) => <span key={a.id} className="plate">{a.plate_masked}</span>) },
    { label: "Опшны тоо", cells: ads.map((a) => a.options.length), best: bestOptions },
    { label: "Нэмж хийсэн", cells: ads.map((a) => <span key={a.id} className="whitespace-pre-line text-[13px]">{a.modifications || "—"}</span>) },
    { label: "Худалдагч", cells: ads.map((a) => `${a.seller_shop ?? a.seller_name}${a.seller_city ? ` · ${a.seller_city}` : ""}`) },
    { label: "Үзэлт", cells: ads.map((a) => num(a.views)) },
  ];

  return (
    <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-5">
      <CompareSync ids={ads.map((a) => a.id)} />
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Машин харьцуулах</h1>
          <span className="text-[14px] text-muted">Шар өнгөөр тодорсон нь тухайн үзүүлэлтээр хамгийн давуу.</span>
        </div>
        {ads.length < ids.length && <span className="text-[13px] text-muted">{ids.length - ads.length} зар нийтээс хасагдсан тул харагдахгүй.</span>}
      </div>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 200 + ads.length * 220 }}>
          <thead>
            <tr>
              <th className="w-[180px]"><span className="sr-only">Үзүүлэлт</span></th>
              {ads.map((a) => (
                <th key={a.id} className="align-top normal-case">
                  <div className="flex flex-col gap-2 py-1">
                    <Link href={`/ads/${a.id}`} className="no-underline flex flex-col gap-2">
                      <CarPhoto path={a.photos[0]} alt={`${a.brand} ${a.model}`} className="w-full h-[130px] rounded-lg" />
                      <span className="font-bold text-[15px] text-ink">{a.brand} {a.model}{a.featured ? " ⭐" : ""}</span>
                    </Link>
                    <RemoveFromCompare id={a.id} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="text-muted text-[13px]">{r.label}</td>
                {r.cells.map((c, i) => (
                  <td key={ads[i].id} className={r.best?.includes(i) ? "bg-yellow/40 font-semibold" : ""}>{c}</td>
                ))}
              </tr>
            ))}
            {allOptions.length > 0 && (
              <tr>
                <td className="text-muted text-[13px] align-top">Опшн</td>
                {ads.map((a) => (
                  <td key={a.id} className="align-top">
                    <ul className="list-none p-0 m-0 flex flex-col gap-1 text-[13px]">
                      {allOptions.map((o) => (
                        <li key={o} className={a.options.includes(o) ? "" : "text-muted line-through opacity-60"}>
                          {a.options.includes(o) ? "✓" : "✕"} {o}
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
