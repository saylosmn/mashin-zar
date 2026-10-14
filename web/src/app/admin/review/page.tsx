import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireAdmin } from "@/lib/data";
import { categoryLabel, initial, money, timeAgo } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { CarPhoto } from "@/components/CarPhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { IconPhone } from "@/components/icons";
import { PAY_STATUS, PLAN_LABEL } from "@/lib/payments";
import type { PayStatus } from "@shared/types";
import { approveAd, markContacted, rejectAd, saveNote, sendOffer, setAdAgent } from "../../panel-actions";
import { agentOptions } from "@/lib/reports";
import { RejectForm } from "./RejectForm";
import type { Ad, Profile } from "@shared/types";

export const metadata = { title: "Админ · Шинэ зар ба санал" };

type Row = Ad & { owner: Pick<Profile, "full_name" | "email" | "phone" | "city"> | null };

export default async function ManagerAds({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; id?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireAdmin();
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
    supabase
      .from("ads")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .not("contacted_at", "is", null),
  ]);
  const list = (data ?? []) as Row[];

  let ad: Row | null = list.find((a) => a.id === sp.id) ?? null;
  if (!ad && sp.id) {
    const { data: one } = await supabase.from("ads").select(sel).eq("id", sp.id).maybeSingle();
    ad = (one as Row) ?? null;
  }
  if (!ad && !sp.id) ad = list[0] ?? null;

  const agents = await agentOptions();
  // Сонирхсон хүмүүс: утас харсан, чат бичсэн (SQL шинэчлэгдээгүй үед хоосон)
  type Lead = {
    user_id: string;
    last_at: string;
    times: number;
    user: { full_name: string | null; phone: string | null } | null;
  };
  type Chat = {
    id: string;
    last_message_at: string;
    last_message: string | null;
    buyer: { full_name: string | null } | null;
  };
  const [leadRes, chatRes] = ad
    ? await Promise.all([
        supabase
          .from("ad_phone_views")
          .select("user_id,last_at,times, user:profiles!ad_phone_views_user_id_fkey(full_name,phone)")
          .eq("ad_id", ad.id)
          .order("last_at", { ascending: false })
          .limit(50),
        supabase
          .from("conversations")
          .select("id,last_message_at,last_message, buyer:profiles!conversations_buyer_id_fkey(full_name)")
          .eq("ad_id", ad.id)
          .order("last_message_at", { ascending: false })
          .limit(50),
      ])
    : [{ data: [] }, { data: [] }];
  const leads = (leadRes.data ?? []) as unknown as Lead[];
  const chats = (chatRes.data ?? []) as unknown as Chat[];
  let sellerStats = { total: 0, sold: 0 };
  type PayRow = { status: PayStatus; ref: string; amount: number };
  const pay: PayRow | null =
    ad?.plan === "paid"
      ? (((
          await supabase
            .from("payments")
            .select("status,ref,amount")
            .eq("ad_id", ad.id)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data as PayRow | null) ?? null)
      : null;
  const payBlocked =
    ad?.plan === "paid" && (ad.status === "pending" || ad.status === "rejected") && pay?.status !== "confirmed";
  if (ad) {
    const { data: s } = await supabase.from("ads").select("status").eq("user_id", ad.user_id);
    sellerStats = { total: s?.length ?? 0, sold: (s ?? []).filter((x) => x.status === "sold").length };
  }
  const pct = settings.offer_percent;
  const offer = ad && pct != null ? Math.round((ad.price * pct) / 100) : null;
  const cy = settings.cutoff_year;
  const backUrl = `/admin/review?tab=${tab}${ad ? `&id=${ad.id}` : ""}`;

  const tabs = [
    { key: "pending", label: "Хүлээгдэж буй", n: cPending.count ?? 0 },
    { key: "contacted", label: "Холбогдсон", n: cContacted.count ?? 0 },
    { key: "rejected", label: "Татгалзсан" },
  ];

  return (
    <PanelShell profile={me} area="admin" active="admin-review" pending={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display m-0 text-[28px]">Шинэ зар ба санал</h1>
        <nav aria-label="Төлөв" className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/review?tab=${t.key}`}
              aria-current={t.key === tab ? "page" : undefined}
              className={`flex h-10 items-center rounded-full px-3.5 text-[14px] no-underline ${t.key === tab ? "bg-ink font-semibold text-yellow" : "border border-line-2 bg-card"}`}
            >
              {t.label}
              {t.n !== undefined ? ` ${t.n}` : ""}
            </Link>
          ))}
        </nav>
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap items-start gap-4.5">
        <ul aria-label="Зарууд" className="m-0 flex flex-[1_1_300px] list-none flex-col gap-2 p-0">
          {list.length === 0 && <li className="card px-4 py-6 text-center text-[14px] text-muted">Энд зар алга.</li>}
          {list.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/review?tab=${tab}&id=${a.id}`}
                aria-current={ad?.id === a.id ? "true" : undefined}
                className={`flex gap-3 rounded-[14px] bg-card p-3 no-underline ${ad?.id === a.id ? "border-2 border-ink" : "border border-line"}`}
              >
                <CarPhoto path={a.photos[0]} alt="" className="h-[52px] w-16 shrink-0 rounded-lg" label="IMG" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold">
                      {a.brand} {a.model}
                    </span>
                    <span className="shrink-0 text-[12px] text-muted">{timeAgo(a.created_at)}</span>
                  </div>
                  <span className="text-[13px] text-body">
                    {a.year_made} · {categoryLabel(a.category, cy)} · {a.photos.length} зураг
                  </span>
                  <span className="h-display text-[13px]">{money(a.price)}</span>
                  {a.plan === "paid" && (
                    <span className="text-[12px] font-semibold text-pending-fg">💳 {PLAN_LABEL.paid}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {ad ? (
          <section aria-label="Сонгосон зар" className="card flex min-w-0 flex-[999_1_520px] flex-col gap-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="cat-chip">{categoryLabel(ad.category, cy)}</span>
                  <StatusBadge status={ad.status} />
                  {ad.plan && <span className="cat-chip">{PLAN_LABEL[ad.plan]}</span>}
                  <span className="text-[12px] text-muted">{timeAgo(ad.created_at)}</span>
                  {ad.contacted_at && <span className="badge bg-active-bg text-active-fg">Холбогдсон</span>}
                </div>
                <h2 className="m-0 text-[24px] font-bold">
                  {ad.brand} {ad.model}
                  {ad.trim ? ` · ${ad.trim}` : ""}
                </h2>
              </div>
              <span className="h-display text-[24px]">{money(ad.price)}</span>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
              {ad.photos.map((p, i) => (
                <a key={p} href={`/ads/${ad!.id}`} aria-label={`Зураг ${i + 1}`}>
                  <CarPhoto path={p} alt="" className="aspect-[4/3] w-full rounded-md" />
                </a>
              ))}
            </div>

            <div className="flex flex-wrap gap-3.5">
              <div className="flex flex-[1_1_240px] flex-col gap-2.5 rounded-[14px] bg-paper p-4">
                <span className="text-[12px] font-bold tracking-wide text-muted">ЗАР ТАВЬСАН ХҮН</span>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-bold text-yellow">
                    {initial(ad.owner?.full_name)}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">{ad.owner?.full_name ?? "—"}</span>
                    <span className="truncate text-[12px] text-muted">{ad.owner?.email}</span>
                  </div>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-muted">Утас (зар)</span>
                  <a href={`tel:${ad.phone}`} className="mono font-bold">
                    {ad.phone}
                  </a>
                </div>
                {ad.owner?.phone && ad.owner.phone !== ad.phone && (
                  <div className="flex justify-between text-[14px]">
                    <span className="text-muted">Утас (профайл)</span>
                    <span className="mono font-bold">{ad.owner.phone}</span>
                  </div>
                )}
                <div className="flex justify-between text-[14px]">
                  <span className="text-muted">Хот</span>
                  <span>{ad.owner?.city ?? "—"}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-muted">Нийт зар</span>
                  <span className="font-semibold">
                    {sellerStats.total} ({sellerStats.sold} зарагдсан)
                  </span>
                </div>
              </div>
              <div className="flex flex-[1_1_240px] flex-col gap-2.5 rounded-[14px] bg-paper p-4">
                <span className="text-[12px] font-bold tracking-wide text-muted">ДУГААР (ЗӨВХӨН МЕНЕЖЕР)</span>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-muted">Улсын</span>
                  <span className="plate text-[16px]">{ad.plate_number}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-muted">Арлын</span>
                  <span className="mono font-bold">{ad.vin}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-muted">Үйлд. / Орж ирсэн</span>
                  <span className="mono font-bold">
                    {ad.year_made} / {ad.year_imported ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-[14px]">
                  <span className="text-muted">Опшн</span>
                  <span className="text-right">{ad.options.join(", ") || "—"}</span>
                </div>
                <div className="flex justify-between gap-3 text-[14px]">
                  <span className="text-muted">{ad.plan === "paid" ? "Төлбөр" : "Гэрээ"}</span>
                  {ad.plan === "paid" ? (
                    pay ? (
                      <Link href="/admin/payments" className="text-right font-semibold">
                        {PAY_STATUS[pay.status].label} · <span className="mono">{pay.ref}</span> · {money(pay.amount)}
                      </Link>
                    ) : (
                      <span className="text-muted">Шимтгэлгүй · төлбөр алга</span>
                    )
                  ) : ad.contract_id ? (
                    <a
                      href={`/api/contracts/${ad.contract_id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold"
                    >
                      Гарын үсэгтэй PDF ↗
                    </a>
                  ) : (
                    <span className="text-muted">Гэрээгүй (өмнөх зар)</span>
                  )}
                </div>
              </div>
            </div>
            {(ad.modifications || ad.description) && (
              <div className="flex flex-col gap-1.5 text-[14px] leading-relaxed">
                {ad.modifications && (
                  <p className="m-0">
                    <strong>Нэмж хийсэн:</strong> {ad.modifications}
                  </p>
                )}
                {ad.description && (
                  <p className="m-0 whitespace-pre-line">
                    <strong>Тайлбар:</strong> {ad.description}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3.5 rounded-2xl bg-ink p-5 text-paper">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="h-display text-[16px]">Хэрэглэгчид тавих санал</span>
                <span className="text-[12px] text-pale">Хувийг админ тохируулна</span>
              </div>
              <div className="mono flex flex-wrap items-center gap-3 text-[15px]">
                <span>{money(ad.price)}</span>
                <span className="text-pale">×</span>
                <span className="rounded-md bg-yellow px-2.5 py-1 font-bold text-ink">
                  {pct != null ? `${pct}%` : "—%"}
                </span>
                <span className="text-pale">=</span>
                <span className="h-display text-[22px] text-yellow">
                  {offer != null ? money(offer) : "Тохируулаагүй"}
                </span>
              </div>
              {ad.offer_sent_at && (
                <span className="text-[13px] text-pale">
                  Илгээсэн: {money(ad.offer_amount)} · {timeAgo(ad.offer_sent_at)}
                </span>
              )}
              <form action={sendOffer}>
                <input type="hidden" name="id" value={ad.id} />
                <input type="hidden" name="back" value={backUrl} />
                <button disabled={pct == null} className="btn btn-yellow">
                  {ad.offer_sent_at ? "Саналыг дахин илгээх" : "Санал илгээх"}
                </button>
              </form>
              <form action={saveNote} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={ad.id} />
                <input type="hidden" name="back" value={backUrl} />
                <label className="label text-paper">
                  Тэмдэглэл
                  <textarea
                    name="note"
                    defaultValue={ad.manager_note ?? ""}
                    placeholder="Ярианы тэмдэглэл, хэрэглэгчийн хариу..."
                    className="textarea min-h-[70px] border-ink-line bg-ink-2 font-normal text-paper"
                  />
                </label>
                <button className="btn btn-sm btn-dark-ghost self-start">Тэмдэглэл хадгалах</button>
              </form>
              <details className="rounded-xl bg-ink-2 px-3.5 py-2.5">
                <summary className="cursor-pointer text-[14px] font-semibold">
                  Сонирхсон: {leads.length} хүн утас харсан · {chats.length} чат
                </summary>
                <div className="flex flex-col gap-1.5 pt-2.5 text-[13px]">
                  {leads.map((l) => (
                    <div key={l.user_id} className="flex justify-between gap-2">
                      <span>
                        {l.user?.full_name ?? "Хэрэглэгч"}{" "}
                        {l.user?.phone ? (
                          <a href={`tel:${l.user.phone}`} className="mono text-yellow">
                            {l.user.phone}
                          </a>
                        ) : null}
                      </span>
                      <span className="whitespace-nowrap text-pale">
                        {timeAgo(l.last_at)}
                        {l.times > 1 ? ` · ${l.times}×` : ""}
                      </span>
                    </div>
                  ))}
                  {chats.map((c) => (
                    <a key={c.id} href={`/messages/${c.id}`} className="flex justify-between gap-2 no-underline">
                      <span className="truncate">
                        💬 {c.buyer?.full_name ?? "Худалдан авагч"}: {c.last_message ?? ""}
                      </span>
                      <span className="whitespace-nowrap text-pale">{timeAgo(c.last_message_at)}</span>
                    </a>
                  ))}
                  {!leads.length && !chats.length && <span className="text-pale">Одоогоор алга.</span>}
                </div>
              </details>
              {agents.length > 0 && (
                <form action={setAdAgent} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={ad.id} />
                  <input type="hidden" name="back" value={backUrl} />
                  <label className="label flex-[1_1_200px] text-paper">
                    Агент
                    <select
                      name="agent_id"
                      defaultValue={ad.agent_id ?? ""}
                      className="input h-10 border-ink-line bg-ink-2 font-normal text-paper"
                    >
                      <option value="">Агентгүй</option>
                      {agents.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="btn btn-sm btn-dark-ghost">Хадгалах</button>
                </form>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              {ad.status === "pending" && !ad.contacted_at && (
                <form action={markContacted} className="flex flex-[1_1_160px]">
                  <input type="hidden" name="id" value={ad.id} />
                  <input type="hidden" name="back" value={`/admin/review?tab=contacted&id=${ad.id}`} />
                  <button className="btn btn-lg btn-ghost flex-1">
                    <IconPhone size={18} /> Холбогдсон
                  </button>
                </form>
              )}
              {ad.status !== "rejected" && ad.status !== "sold" && (
                <RejectForm key={ad.id} id={ad.id} back={`/admin/review?tab=${tab}`} action={rejectAd} />
              )}
              {(ad.status === "pending" || ad.status === "rejected") && (
                <form action={approveAd} className="flex flex-[2_1_220px]">
                  <input type="hidden" name="id" value={ad.id} />
                  <input type="hidden" name="back" value={`/admin/review?tab=${tab}`} />
                  <button disabled={payBlocked} className="btn btn-lg btn-yellow flex-1 disabled:opacity-50">
                    {payBlocked ? "Төлбөр баталгаажаагүй" : "Батлаж нийтлэх"}
                  </button>
                </form>
              )}
              {ad.status === "active" && (
                <Link href={`/admin/reports?ad=${ad.id}`} className="btn btn-lg btn-ink flex-[2_1_220px]">
                  Зарагдсан тайлан илгээх
                </Link>
              )}
            </div>
            <span className="text-[12px] text-muted">
              {payBlocked
                ? "Шимтгэлгүй (онцлох төлбөртэй) зар: админ «Төлбөрүүд»-ээс (эсвэл SMS апп автоматаар) орлогыг баталсны дараа нийтэлнэ."
                : "Батлагдмагц зар нийтлэгдэж, бүх хэрэглэгчид шинэ зарын мэдэгдэл очно."}
            </span>
          </section>
        ) : (
          <section className="card flex-[999_1_520px] p-10 text-center text-muted">Зар сонгоно уу.</section>
        )}
      </div>
    </PanelShell>
  );
}
