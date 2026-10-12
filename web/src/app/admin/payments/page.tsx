import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { ConfirmButton } from "@/components/ConfirmButton";
import { money, timeAgo } from "@/lib/format";
import { PAY_STATUS, PLAN_LABEL } from "@/lib/payments";
import type { Payment, PayStatus, Plan } from "@/lib/types";
import { decidePayment } from "../../panel-actions";

export const metadata = { title: "Админ · Төлбөрүүд" };

type Row = Payment & {
  ad: { id: string; brand: string; model: string; year_made: number; status: string; plan: Plan | null } | null;
  owner: { full_name: string | null; phone: string | null; email: string | null } | null;
};

type SmsRow = {
  id: string;
  amount: number;
  value: string | null;
  body: string | null;
  result: "confirmed" | "already" | "short" | "unmatched";
  created_at: string;
  payment: { ref: string; amount: number } | null;
};

const SMS_RESULT: Record<SmsRow["result"], { label: string; cls: string }> = {
  confirmed: { label: "✅ Автоматаар баталсан", cls: "bg-active-bg text-active-fg" },
  already: { label: "Өмнө батлагдсан", cls: "bg-soft text-body" },
  short: { label: "⚠️ Дүн дутуу", cls: "bg-pending-bg text-pending-fg" },
  unmatched: { label: "❓ Код олдоогүй", cls: "bg-danger-bg text-[#9b1c1c]" },
};

const TABS: { key: PayStatus | "all"; label: string }[] = [
  { key: "submitted", label: "Шалгах" },
  { key: "awaiting", label: "Төлөөгүй" },
  { key: "confirmed", label: "Батлагдсан" },
  { key: "rejected", label: "Ороогүй" },
  { key: "all", label: "Бүгд" },
];

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "submitted";
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select("*, ad:ads(id,brand,model,year_made,status,plan), owner:profiles!payments_user_id_fkey(full_name,phone,email)")
    .order(tab === "submitted" ? "submitted_at" : "created_at", { ascending: tab === "submitted" })
    .limit(200);
  if (tab !== "all") q = q.eq("status", tab);
  const [{ data, error }, pending, { count: nSubmitted }, { data: smsData }] = await Promise.all([
    q,
    pendingCount(),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("sms_income").select("id,amount,value,body,result,created_at, payment:payments(ref,amount)").order("created_at", { ascending: false }).limit(30),
  ]);
  const sms = (smsData ?? []) as unknown as SmsRow[];
  const rows = (data ?? []) as Row[];
  const back = `/admin/payments?tab=${tab}`;

  return (
    <PanelShell profile={me} area="admin" active="admin-payments" pending={pending}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="h-display m-0 text-[28px]">Төлбөрүүд</h1>
        <nav aria-label="Төлөв" className="flex gap-1.5 flex-wrap">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/payments?tab=${t.key}`}
              aria-current={t.key === tab ? "page" : undefined}
              className={`h-10 px-3.5 rounded-full flex items-center text-[14px] no-underline ${t.key === tab ? "bg-ink text-yellow font-semibold" : "border border-line-2 bg-card"}`}
            >
              {t.label}{t.key === "submitted" ? ` ${nSubmitted ?? 0}` : ""}
            </Link>
          ))}
        </nav>
      </div>
      <Flash ok={sp.ok} err={sp.err ?? error?.message} />
      <p className="m-0 text-[14px] text-muted max-w-[920px]">
        Хэрэглэгч «Төлбөр төлсөн» дармагц энд болон Telegram ботод «✅ Орлого орсон / ❌ Ороогүй» товчтой ирнэ. Дансны хуулгаас <strong>гүйлгээний утга</strong>, дүнгээр нь тулгана.
        Аль нэгээс нь батлахад нөгөө нь автоматаар шинэчлэгдэнэ. <Link href="/admin/settings#sms">SMS апп</Link> холбосон бол код, дүн таарсан орлого автоматаар батлагдана.
      </p>

      {rows.length === 0 ? (
        <p className="card m-0 px-6 py-10 text-center text-muted">Энд төлбөр алга.</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-3 max-w-[980px]">
          {rows.map((p) => {
            const canDecide = p.status === "submitted" || p.status === "awaiting" || p.status === "rejected";
            return (
              <li key={p.id} className="card p-4.5 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className={`badge ${PAY_STATUS[p.status].cls}`}>{PAY_STATUS[p.status].label}</span>
                      {p.ad?.plan && <span className="cat-chip">{PLAN_LABEL[p.ad.plan]}</span>}
                      <span className="text-[12px] text-muted">{timeAgo(p.submitted_at ?? p.created_at)}</span>
                    </div>
                    {p.ad ? (
                      <Link href={p.ad.status === "pending" ? `/manager/ads?id=${p.ad.id}` : `/admin/ads/${p.ad.id}`} className="font-semibold text-[16px]">
                        {p.ad.brand} {p.ad.model} · {p.ad.year_made}
                      </Link>
                    ) : (
                      <span className="font-semibold text-[16px] text-muted">{p.ad_title ?? "Зар устгагдсан"}</span>
                    )}
                    <span className="text-[13px] text-body">
                      {p.owner?.full_name ?? p.owner?.email ?? "—"}
                      {p.owner?.phone && <> · <a href={`tel:${p.owner.phone}`} className="mono">{p.owner.phone}</a></>}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="h-display text-[20px]">{money(p.amount)}</span>
                    <span className="mono font-bold text-[15px] bg-yellow text-ink px-2 py-0.5 rounded">{p.ref}</span>
                    <span className="text-[12px] text-muted">⭐ {p.days} хоног</span>
                  </div>
                </div>
                {p.payer_note && <p className="m-0 text-[14px]"><span className="text-muted">Тэмдэглэл:</span> {p.payer_note}</p>}
                {p.decided_at && (
                  <p className="m-0 text-[13px] text-muted">
                    {p.status === "confirmed" ? "Баталсан" : "Шийдсэн"}: {p.decided_name ?? "—"} · {timeAgo(p.decided_at)}
                    {p.admin_note ? ` · ${p.admin_note}` : ""}
                  </p>
                )}
                {canDecide && (
                  <div className="flex gap-2 flex-wrap items-end">
                    {p.status !== "rejected" && (
                      <form action={decidePayment} className="flex gap-2 flex-wrap items-end flex-[1_1_320px]">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="approve" value="0" />
                        <input name="note" maxLength={300} placeholder="Шалтгаан (заавал биш)" className="input h-10 flex-[1_1_180px]" aria-label="Шалтгаан" />
                        <button className="btn btn-sm btn-danger h-10">❌ Ороогүй</button>
                      </form>
                    )}
                    <form action={decidePayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="approve" value="1" />
                      <ConfirmButton message={`${p.ref} · ${money(p.amount)} орлого орсныг баталгаажуулах уу?`} className="btn btn-sm btn-yellow h-10">
                        ✅ Орлого орсон
                      </ConfirmButton>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="flex flex-col gap-2.5 max-w-[980px]">
        <h2 className="m-0 text-[18px] font-bold">Ирсэн орлого (SMS апп)</h2>
        {sms.length === 0 ? (
          <p className="card m-0 px-6 py-6 text-center text-muted text-[14px]">
            SMS апп-аас орлого ирээгүй байна. <Link href="/admin/settings#sms">Холбох заавар →</Link>
          </p>
        ) : (
          <ul className="list-none p-0 m-0 card divide-y divide-[#ecede9]">
            {sms.map((r) => (
              <li key={r.id} className="px-4.5 py-3 flex flex-col gap-1">
                <div className="flex justify-between items-center gap-3 flex-wrap">
                  <span className="flex gap-2 items-center flex-wrap">
                    <span className={`badge ${SMS_RESULT[r.result].cls}`}>{SMS_RESULT[r.result].label}</span>
                    {r.payment && <span className="mono font-bold text-[13px] bg-yellow text-ink px-1.5 py-0.5 rounded">{r.payment.ref}</span>}
                    {r.result === "short" && r.payment && <span className="text-[12px] text-muted">байх ёстой {money(r.payment.amount)}</span>}
                    <span className="text-[12px] text-muted">{timeAgo(r.created_at)}</span>
                  </span>
                  <span className="h-display text-[17px]">{money(r.amount)}</span>
                </div>
                {r.body && <p className="m-0 text-[13px] text-body break-words">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PanelShell>
  );
}
