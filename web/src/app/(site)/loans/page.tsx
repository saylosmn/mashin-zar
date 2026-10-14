import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { dateShort, num } from "@/lib/format";
import { LOAN_STATUS, type LoanRequest } from "@/lib/loan";
import { ConfirmButton } from "@/components/ConfirmButton";
import { cancelLoanRequest } from "@/actions/leasing";

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
    <main className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Лизингийн хүсэлтүүд</h1>
        <span className="text-[14px] text-muted">Зарын хуудаснаас илгээсэн хүсэлтүүдийн явц</span>
      </div>
      {sp.ok && (
        <p role="status" className="card m-0 px-4 py-3 text-[14px]">
          ✓ {sp.ok}
        </p>
      )}
      {(sp.err || error) && (
        <p role="alert" className="m-0 rounded-xl bg-danger-bg px-4 py-3 text-[14px] text-[#9b1c1c]">
          {sp.err ?? error?.message}
        </p>
      )}
      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="m-0 text-body">Одоогоор лизингийн хүсэлт илгээгээгүй байна.</p>
          <Link href="/" className="btn btn-ink">
            Зар үзэх
          </Link>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-col gap-3 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">
                    {r.ad_id ? (
                      <Link href={`/ads/${r.ad_id}`} className="no-underline">
                        {r.car}
                      </Link>
                    ) : (
                      r.car
                    )}
                  </span>
                  <span className="text-[12px] text-muted">
                    {r.partner?.name ?? "Лизинг"} · {dateShort(r.created_at)}
                  </span>
                </div>
                <span
                  className={`self-start rounded-md px-2.5 py-1 text-[12px] font-semibold ${LOAN_STATUS[r.status].cls}`}
                >
                  {LOAN_STATUS[r.status].label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
                <Cell k="Үнэ" v={`${num(r.price)}₮`} />
                <Cell k="Урьдчилгаа" v={`${num(r.down_payment)}₮`} />
                <Cell k="Хугацаа" v={`${r.term_months} сар · ${Number(r.rate_annual)}%`} />
                <Cell k="Сарын төлбөр" v={`${num(r.monthly_payment)}₮`} strong />
              </div>
              {r.partner_note && (
                <p className="m-0 rounded-lg bg-paper px-3 py-2 text-[13px]">
                  {r.partner?.name}: {r.partner_note}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {r.partner?.phone && (
                  <a href={`tel:${r.partner.phone.replace(/\s/g, "")}`} className="btn btn-sm btn-ghost">
                    📞 {r.partner.phone}
                  </a>
                )}
                {(r.status === "new" || r.status === "contacted") && (
                  <form action={cancelLoanRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value="/loans" />
                    <ConfirmButton message="Хүсэлтээ цуцлах уу?" className="btn btn-sm btn-danger">
                      Цуцлах
                    </ConfirmButton>
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
