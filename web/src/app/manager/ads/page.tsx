import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireStaff } from "@/lib/data";
import { categoryLabel, initial, money, timeAgo } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { CarPhoto } from "@/components/CarPhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { IconPhone } from "@/components/icons";
import { approveAd, markContacted, rejectAd, saveNote, sendOffer, setAdAgent } from "../../panel-actions";
import { agentOptions } from "@/lib/reports";
import { RejectForm } from "./RejectForm";
import type { Ad, Profile } from "@/lib/types";

export const metadata = { title: "Менежер · Шинэ зар ба санал" };

type Row = Ad & { owner: Pick<Profile, "full_name" | "email" | "phone" | "city"> | null };

export default async function ManagerAds({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireStaff();
  const settings = await getSettings();
  const supabase = await createClient();
  const tab = sp.tab === "contacted" || sp.tab === "rejected" ? sp.tab : "pending";
  const sel = "*, owner:profiles!ads_user_id_fkey(full_name,email,phone,city)";

  let q = supabase.from("ads").select(sel).order("created_at", { ascending: false }).limit(100);
  if (tab === "pending") q = q.eq("status", "pending").is("contacted_at", null);
  if (tab === "contacted") q = q.eq("status", "pending").not("contacted_at", "is", null);
  if (tab === "rejected") q = q.eq("status", "rejected");

  const [{ data }, pending, cPending, cContacted] = await Promise.all([
    q,
    pendingCount(),
    supabase.from("ads").select("id", { count: "exact", head: true }).eq("status", "pending").is("contacted_at", null),
    supabase.from("ads").select("id", { count: "exact", head: true }).eq("status", "pending").not("contacted_at", "is", null),
  ]);
  const list = (data ?? []) as Row[];

  let ad: Row | null = list.find((a) => a.id === sp.id) ?? null;
  if (!ad && sp.id) {
    const { data: one } = await supabase.from("ads").select(sel).eq("id", sp.id).maybeSingle();
    ad = (one as Row) ?? null;
  }
  if (!ad && !sp.id) ad = list[0] ?? null;

  const agents = await agentOptions();
  let sellerStats = { total: 0, sold: 0 };
  if (ad) {
    const { data: s } = await supabase.from("ads").select("status").eq("user_id", ad.user_id);
    sellerStats = { total: s?.length ?? 0, sold: (s ?? []).filter((x) => x.status === "sold").length };
  }
  const pct = settings.offer_percent;
  const offer = ad && pct != null ? Math.round((ad.price * pct) / 100) : null;
  const cy = settings.cutoff_year;
  const backUrl = `/manager/ads?tab=${tab}${ad ? `&id=${ad.id}` : ""}`;

  const tabs = [
    { key: "pending", label: "Хүлээгдэж буй", n: cPending.count ?? 0 },
    { key: "contacted", label: "Холбогдсон", n: cContacted.count ?? 0 },
    { key: "rejected", label: "Татгалзсан" },
  ];

  return (
    <PanelShell profile={me} area={me.role === "admin" ? "admin" : "manager"} active="mgr-ads" pending={pending}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="h-display m-0 text-[28px]">Шинэ зар ба санал</h1>
        <nav aria-label="Төлөв" className="flex gap-1.5 flex-wrap">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/manager/ads?tab=${t.key}`}
              aria-current={t.key === tab ? "page" : undefined}
              className={`h-10 px-3.5 rounded-full flex items-center text-[14px] no-underline ${t.key === tab ? "bg-ink text-yellow font-semibold" : "border border-line-2 bg-card"}`}
            >
              {t.label}{t.n !== undefined ? ` ${t.n}` : ""}
            </Link>
          ))}
        </nav>
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap gap-4.5 items-start">
        <ul aria-label="Зарууд" className="flex-[1_1_300px] list-none p-0 m-0 flex flex-col gap-2">
          {list.length === 0 && <li className="card px-4 py-6 text-center text-muted text-[14px]">Энд зар алга.</li>}
          {list.map((a) => (
            <li key={a.id}>
              <Link
                href={`/manager/ads?tab=${tab}&id=${a.id}`}
                aria-current={ad?.id === a.id ? "true" : undefined}
                className={`flex gap-3 p-3 rounded-[14px] bg-card no-underline ${ad?.id === a.id ? "border-2 border-ink" : "border border-line"}`}
              >
                <CarPhoto path={a.photos[0]} alt="" className="w-16 h-[52px] rounded-lg shrink-0" label="IMG" />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-[14px] truncate">{a.brand} {a.model}</span>
                    <span className="text-[12px] text-muted shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                  <span className="text-[13px] text-body">{a.year_made} · {categoryLabel(a.category, cy)} · {a.photos.length} зураг</span>
                  <span className="h-display text-[13px]">{money(a.price)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {ad ? (
          <section aria-label="Сонгосон зар" className="card flex-[999_1_520px] min-w-0 p-6 flex flex-col gap-5">
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="cat-chip">{categoryLabel(ad.category, cy)}</span>
                  <StatusBadge status={ad.status} />
                  <span className="text-[12px] text-muted">{timeAgo(ad.created_at)}</span>
                  {ad.contacted_at && <span className="badge bg-active-bg text-active-fg">Холбогдсон</span>}
                </div>
                <h2 className="m-0 text-[24px] font-bold">{ad.brand} {ad.model}{ad.trim ? ` · ${ad.trim}` : ""}</h2>
              </div>
              <span className="h-display text-[24px]">{money(ad.price)}</span>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
              {ad.photos.map((p, i) => (
                <a key={p} href={`/ads/${ad!.id}`} aria-label={`Зураг ${i + 1}`}>
                  <CarPhoto path={p} alt="" className="w-full aspect-[4/3] rounded-md" />
                </a>
              ))}
            </div>

            <div className="flex flex-wrap gap-3.5">
              <div className="flex-[1_1_240px] bg-paper rounded-[14px] p-4 flex flex-col gap-2.5">
                <span className="text-[12px] font-bold text-muted tracking-wide">ЗАР ТАВЬСАН ХҮН</span>
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-full bg-ink text-yellow flex items-center justify-center font-bold">{initial(ad.owner?.full_name)}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold">{ad.owner?.full_name ?? "—"}</span>
                    <span className="text-[12px] text-muted truncate">{ad.owner?.email}</span>
                  </div>
                </div>
                <div className="flex justify-between text-[14px]"><span className="text-muted">Утас (зар)</span><a href={`tel:${ad.phone}`} className="mono font-bold">{ad.phone}</a></div>
                {ad.owner?.phone && ad.owner.phone !== ad.phone && (
                  <div className="flex justify-between text-[14px]"><span className="text-muted">Утас (профайл)</span><span className="mono font-bold">{ad.owner.phone}</span></div>
                )}
                <div className="flex justify-between text-[14px]"><span className="text-muted">Хот</span><span>{ad.owner?.city ?? "—"}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-muted">Нийт зар</span><span className="font-semibold">{sellerStats.total} ({sellerStats.sold} зарагдсан)</span></div>
              </div>
              <div className="flex-[1_1_240px] bg-paper rounded-[14px] p-4 flex flex-col gap-2.5">
                <span className="text-[12px] font-bold text-muted tracking-wide">ДУГААР (ЗӨВХӨН МЕНЕЖЕР)</span>
                <div className="flex justify-between items-center text-[14px]"><span className="text-muted">Улсын</span><span className="plate text-[16px]">{ad.plate_number}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-muted">Арлын</span><span className="mono font-bold">{ad.vin}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-muted">Үйлд. / Орж ирсэн</span><span className="mono font-bold">{ad.year_made} / {ad.year_imported ?? "—"}</span></div>
                <div className="flex justify-between text-[14px] gap-3"><span className="text-muted">Опшн</span><span className="text-right">{ad.options.join(", ") || "—"}</span></div>
                <div className="flex justify-between text-[14px] gap-3">
                  <span className="text-muted">Гэрээ</span>
                  {ad.contract_id ? (
                    <a href={`/api/contracts/${ad.contract_id}/pdf`} target="_blank" rel="noreferrer" className="font-semibold">Гарын үсэгтэй PDF ↗</a>
                  ) : (
                    <span className="text-muted">Гэрээгүй (өмнөх зар)</span>
                  )}
                </div>
              </div>
            </div>
            {(ad.modifications || ad.description) && (
              <div className="text-[14px] leading-relaxed flex flex-col gap-1.5">
                {ad.modifications && <p className="m-0"><strong>Нэмж хийсэн:</strong> {ad.modifications}</p>}
                {ad.description && <p className="m-0 whitespace-pre-line"><strong>Тайлбар:</strong> {ad.description}</p>}
              </div>
            )}

            <div className="bg-ink text-paper rounded-2xl p-5 flex flex-col gap-3.5">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <span className="h-display text-[16px]">Хэрэглэгчид тавих санал</span>
                <span className="text-[12px] text-pale">Хувийг админ тохируулна</span>
              </div>
              <div className="mono flex items-center gap-3 flex-wrap text-[15px]">
                <span>{money(ad.price)}</span>
                <span className="text-pale">×</span>
                <span className="bg-yellow text-ink font-bold px-2.5 py-1 rounded-md">{pct != null ? `${pct}%` : "—%"}</span>
                <span className="text-pale">=</span>
                <span className="h-display text-[22px] text-yellow">{offer != null ? money(offer) : "Тохируулаагүй"}</span>
              </div>
              {ad.offer_sent_at && <span className="text-[13px] text-pale">Илгээсэн: {money(ad.offer_amount)} · {timeAgo(ad.offer_sent_at)}</span>}
              <form action={sendOffer}>
                <input type="hidden" name="id" value={ad.id} />
                <input type="hidden" name="back" value={backUrl} />
                <button disabled={pct == null} className="btn btn-yellow">{ad.offer_sent_at ? "Саналыг дахин илгээх" : "Санал илгээх"}</button>
              </form>
              <form action={saveNote} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={ad.id} />
                <input type="hidden" name="back" value={backUrl} />
                <label className="label text-paper">
                  Тэмдэглэл
                  <textarea name="note" defaultValue={ad.manager_note ?? ""} placeholder="Ярианы тэмдэглэл, хэрэглэгчийн хариу..." className="textarea min-h-[70px] bg-ink-2 border-ink-line text-paper font-normal" />
                </label>
                <button className="btn btn-sm btn-dark-ghost self-start">Тэмдэглэл хадгалах</button>
              </form>
              {agents.length > 0 && (
                <form action={setAdAgent} className="flex flex-wrap gap-2 items-end">
                  <input type="hidden" name="id" value={ad.id} />
                  <input type="hidden" name="back" value={backUrl} />
                  <label className="label text-paper flex-[1_1_200px]">
                    Агент
                    <select name="agent_id" defaultValue={ad.agent_id ?? ""} className="input h-10 bg-ink-2 border-ink-line text-paper font-normal">
                      <option value="">Агентгүй</option>
                      {agents.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </label>
                  <button className="btn btn-sm btn-dark-ghost">Хадгалах</button>
                </form>
              )}
            </div>

            <div className="flex gap-2.5 flex-wrap">
              {ad.status === "pending" && !ad.contacted_at && (
                <form action={markContacted} className="flex-[1_1_160px] flex">
                  <input type="hidden" name="id" value={ad.id} />
                  <input type="hidden" name="back" value={`/manager/ads?tab=contacted&id=${ad.id}`} />
                  <button className="btn btn-lg btn-ghost flex-1"><IconPhone size={18} /> Холбогдсон</button>
                </form>
              )}
              {ad.status !== "rejected" && ad.status !== "sold" && (
                <RejectForm key={ad.id} id={ad.id} back={`/manager/ads?tab=${tab}`} action={rejectAd} />
              )}
              {(ad.status === "pending" || ad.status === "rejected") && (
                <form action={approveAd} className="flex-[2_1_220px] flex">
                  <input type="hidden" name="id" value={ad.id} />
                  <input type="hidden" name="back" value={`/manager/ads?tab=${tab}`} />
                  <button className="btn btn-lg btn-yellow flex-1">Батлаж нийтлэх</button>
                </form>
              )}
              {ad.status === "active" && (
                <Link href={`/manager/reports?ad=${ad.id}`} className="btn btn-lg btn-ink flex-[2_1_220px]">Зарагдсан тайлан илгээх</Link>
              )}
            </div>
            <span className="text-[12px] text-muted">Батлагдмагц зар нийтлэгдэж, бүх хэрэглэгчид шинэ зарын мэдэгдэл очно.</span>
          </section>
        ) : (
          <section className="card flex-[999_1_520px] p-10 text-center text-muted">Зар сонгоно уу.</section>
        )}
      </div>
    </PanelShell>
  );
}
