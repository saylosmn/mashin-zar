import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { categoryLong, dateShort, money } from "@/lib/format";
import { CarPhoto } from "./CarPhoto";
import { StatusBadge } from "./StatusBadge";
import { adminDeleteAd, approveAd, markSold, setFeatured } from "@/app/panel-actions";
import { expiryInfo, isFeatured } from "@/lib/commission";
import type { Ad, AdStatus } from "@/lib/types";

const PAGE = 30;
type Row = Ad & { owner: { full_name: string | null } | null };

export async function AdsTable({
  basePath,
  sp,
  admin,
  cutoff,
  featuredDays = 7,
}: {
  basePath: string;
  sp: Record<string, string | undefined>;
  admin: boolean;
  cutoff: number;
  featuredDays?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page) || 1);
  const status = ["pending", "active", "sold", "rejected"].includes(sp.status ?? "") ? (sp.status as AdStatus) : undefined;
  const cat = sp.cat === "new" || sp.cat === "old" ? sp.cat : undefined;
  const q = (sp.q ?? "").replace(/[,()%*]/g, " ").trim();

  let query = supabase
    .from("ads")
    .select("*, owner:profiles!ads_user_id_fkey(full_name)", { count: "exact" })
    .order(status === "sold" ? "sold_at" : "created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) query = query.eq("status", status);
  // Онцлох зар: хүсэлт ирсэн эсвэл одоо онцлох
  if (sp.featured === "1") query = query.or(`featured_requested_at.not.is.null,featured_until.gt."${new Date().toISOString()}"`);
  if (cat) query = query.eq("category", cat);
  if (q) query = query.or(`brand.ilike.%${q}%,model.ilike.%${q}%,plate_number.ilike.%${q}%,vin.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data, count } = await query;
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const self = `${basePath}?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "ok" && k !== "err") as [string, string][]).toString()}`;
  const pageHref = (n: number) => {
    const p = new URLSearchParams(Object.entries({ ...sp, page: String(n) }).filter(([k, v]) => v && k !== "ok" && k !== "err") as [string, string][]);
    return `${basePath}?${p}`;
  };

  return (
    <>
      <form action={basePath} className="flex gap-2.5 flex-wrap items-center">
        <input name="q" defaultValue={q} type="search" placeholder="Машин, дугаар, утас хайх" aria-label="Хайх" className="input h-11 flex-[1_1_260px]" />
        <select name="status" defaultValue={status ?? ""} aria-label="Төлөв" className="input h-11 w-auto">
          <option value="">Бүх төлөв</option>
          <option value="pending">Хүлээгдэж буй</option>
          <option value="active">Идэвхтэй</option>
          <option value="sold">Зарагдсан</option>
          <option value="rejected">Татгалзсан</option>
        </select>
        <select name="cat" defaultValue={cat ?? ""} aria-label="Ангилал" className="input h-11 w-auto">
          <option value="">Бүх ангилал</option>
          <option value="new">{categoryLong("new", cutoff)}</option>
          <option value="old">{categoryLong("old", cutoff)}</option>
        </select>
        {admin && (
          <label className="flex items-center gap-2 text-[14px] h-11 px-3 rounded-[10px] border border-line-2 bg-card">
            <input type="checkbox" name="featured" value="1" defaultChecked={sp.featured === "1"} className="w-4 h-4 accent-ink" /> ⭐ Онцлох
          </label>
        )}
        <button className="btn btn-ink">Шүүх</button>
      </form>

      <div className="table-wrap">
        <table className="table min-w-[1000px]">
          <thead>
            <tr><th>Машин</th><th>Улсын дугаар</th><th>Ангилал</th><th>Үнэ</th><th>Хэрэглэгч</th><th>Төлөв</th><th>Огноо</th><th>Үйлдэл</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-muted">Зар олдсонгүй.</td></tr>}
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/manager/ads?id=${a.id}`} className="flex items-center gap-2.5 no-underline">
                    <CarPhoto path={a.photos[0]} alt="" className="w-[52px] h-10 rounded-md" label="IMG" />
                    <span className="font-semibold">{a.brand} {a.model} · {a.year_made}</span>
                  </Link>
                </td>
                <td><span className="plate text-[13px]">{a.plate_number}</span></td>
                <td className="text-body">{categoryLong(a.category, cutoff)}</td>
                <td className="h-display text-[13px]">{money(a.status === "sold" ? a.sold_price ?? a.price : a.price)}</td>
                <td>{a.owner?.full_name ?? "—"}</td>
                <td>
                  <div className="flex flex-col gap-1 items-start">
                    <StatusBadge status={a.status} />
                    {a.status === "active" && expiryInfo(a.expires_at).expired && <span className="text-[11px] font-semibold text-[#9b1c1c]">Хугацаа дууссан</span>}
                    {isFeatured(a.featured_until) && <span className="text-[11px] font-semibold text-pending-fg">⭐ {dateShort(a.featured_until)} хүртэл</span>}
                    {a.featured_requested_at && <span className="text-[11px] font-semibold text-[#c2410c]">⭐ хүсэлт ирсэн</span>}
                  </div>
                </td>
                <td className="text-muted">{dateShort(a.status === "sold" ? a.sold_at : a.created_at)}</td>
                <td>
                  <div className="flex gap-1.5">
                    {a.status === "pending" && (
                      <form action={approveAd}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={self} />
                        <button className="btn btn-sm btn-yellow">Батлах</button>
                      </form>
                    )}
                    {a.status === "active" && (
                      <form action={markSold}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={self} />
                        <button className="btn btn-sm btn-ghost">Зарагдсан</button>
                      </form>
                    )}
                    {admin && a.status === "active" && (
                      <form action={setFeatured}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value={self} />
                        <input type="hidden" name="days" value={isFeatured(a.featured_until) ? 0 : featuredDays} />
                        <button className="btn btn-sm btn-ghost whitespace-nowrap" title={isFeatured(a.featured_until) ? "Онцлохыг болиулах" : `${featuredDays} хоног онцлох`}>
                          {isFeatured(a.featured_until) ? "⭐ Болиулах" : `⭐ ${featuredDays} хоног`}
                        </button>
                      </form>
                    )}
                    {admin && (
                      <>
                        <Link href={`/admin/ads/${a.id}`} className="btn btn-sm btn-ghost">Засах</Link>
                        <form action={adminDeleteAd}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="back" value={self} />
                          <button className="btn btn-sm btn-danger">Устгах</button>
                        </form>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center gap-3 flex-wrap text-[13px] text-muted">
        <span>{total ? `${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, total)} / ${total}` : "0"}</span>
        <div className="flex gap-1.5">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn btn-ghost">Өмнөх</Link>}
          {page < pages && <Link href={pageHref(page + 1)} className="btn btn-ghost">Дараах</Link>}
        </div>
      </div>
    </>
  );
}
