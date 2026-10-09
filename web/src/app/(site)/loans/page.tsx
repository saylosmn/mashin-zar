import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { dateShort, num } from "@/lib/format";
import { LOAN_STATUS, type LoanRequest } from "@/lib/loan";
import { ConfirmButton } from "@/components/ConfirmButton";
import { cancelLoanRequest } from "@/app/panel-actions";

export const metadata = { title: "Лизингийн хүсэлтүүд" };

export default async function MyLoans({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser("/loans");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loan_requests")
    .select("*, partner:leasing_partners(name,phone)")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as (LoanRequest & { partner: { name: string; phone: string | null } | null })[];
  return (
    <main className="max-w-[860px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Лизингийн хүсэлтүүд</h1>
        <span className="text-[14px] text-muted">Зарын хуудаснаас илгээсэн хүсэлтүүдийн явц</span>
      </div>
      {sp.ok && <p role="status" className="m-0 card px-4 py-3 text-[14px]">✓ {sp.ok}</p>}
      {(sp.err || error) && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-4 py-3 text-[14px]">{sp.err ?? error?.message}</p>}
      {rows.length === 0 ? (
        <div className="card px-6 py-12 flex flex-col items-center gap-3 text-center">
          <p className="m-0 text-body">Одоогоор лизингийн хүсэлт илгээгээгүй байна.</p>
          <Link href="/" className="btn btn-ink">Зар үзэх</Link>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.id} className="card p-4 flex flex-col gap-3">
              <div className="flex justify-between gap-2 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">{r.ad_id ? <Link href={`/ads/${r.ad_id}`} className="no-underline">{r.car}</Link> : r.car}</span>
                  <span className="text-[12px] text-muted">{r.partner?.name ?? "Лизинг"} · {dateShort(r.created_at)}</span>
                </div>
                <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-md self-start ${LOAN_STATUS[r.status].cls}`}>{LOAN_STATUS[r.status].label}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
                <Cell k="Үнэ" v={`${num(r.price)}₮`} />
                <Cell k="Урьдчилгаа" v={`${num(r.down_payment)}₮`} />
                <Cell k="Хугацаа" v={`${r.term_months} сар · ${Number(r.rate_annual)}%`} />
                <Cell k="Сарын төлбөр" v={`${num(r.monthly_payment)}₮`} strong />
              </div>
              {r.partner_note && <p className="m-0 text-[13px] rounded-lg bg-paper px-3 py-2">{r.partner?.name}: {r.partner_note}</p>}
              <div className="flex flex-wrap gap-2 items-center">
                {r.partner?.phone && <a href={`tel:${r.partner.phone.replace(/\s/g, "")}`} className="btn btn-sm btn-ghost">📞 {r.partner.phone}</a>}
                {(r.status === "new" || r.status === "contacted") && (
                  <form action={cancelLoanRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value="/loans" />
                    <ConfirmButton message="Хүсэлтээ цуцлах уу?" className="btn btn-sm btn-danger">Цуцлах</ConfirmButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Cell({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${strong ? "bg-ink text-paper" : "bg-paper"}`}>
      <div className={`text-[11px] ${strong ? "text-pale" : "text-muted"}`}>{k}</div>
      <div className={`font-bold ${strong ? "text-yellow" : ""}`}>{v}</div>
    </div>
  );
}
