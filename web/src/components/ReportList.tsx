import Link from "next/link";
import { dateShort, num } from "@/lib/format";
import type { ReportRow } from "@/lib/reports";
import { ConfirmButton } from "./ConfirmButton";
import { reviewSaleReport, setAgentPaid } from "@/app/panel-actions";

const ST: Record<ReportRow["status"], { label: string; cls: string }> = {
  pending: { label: "Хүлээгдэж буй", cls: "bg-pending-bg text-pending-fg" },
  approved: { label: "Батлагдсан", cls: "bg-active-bg text-active-fg" },
  rejected: { label: "Буцаагдсан", cls: "bg-danger-bg text-[#9b1c1c]" },
};

export function ReportList({ rows, admin, back }: { rows: ReportRow[]; admin?: boolean; back: string }) {
  if (!rows.length) return <p className="m-0 card px-5 py-8 text-center text-[14px] text-muted">Тайлан алга байна.</p>;
  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.id} className="card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-bold text-[15px]">
                {r.ad ? (
                  <Link href={admin ? `/admin/ads/${r.ad.id}` : `/manager/ads?id=${r.ad.id}`} className="no-underline">{r.ad.brand} {r.ad.model} · {r.ad.year_made}</Link>
                ) : "Устгагдсан зар"}
              </span>
              <span className="text-[12px] text-muted">
                {r.ad?.plate_number ?? ""} · {r.manager?.full_name ?? r.manager?.email ?? "Менежер"} · илгээсэн {dateShort(r.created_at)}
              </span>
            </div>
            <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-md ${ST[r.status].cls}`}>{ST[r.status].label}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
            <Cell k="Зарагдсан үнэ" v={`${num(r.sold_price)}₮`} />
            <Cell k="Зарагдсан өдөр" v={dateShort(r.sold_at)} />
            <Cell k="Хугацаа" v={`${r.days_on_market} хоног`} />
            <Cell k={`Шимтгэл ${Number(r.commission_percent)}%`} v={`${num(r.commission_amount)}₮`} strong />
          </div>
          {(r.buyer_name || r.buyer_phone || r.note) && (
            <p className="m-0 text-[13px] text-body">
              {r.buyer_name || r.buyer_phone ? <>Худалдан авагч: {[r.buyer_name, r.buyer_phone].filter(Boolean).join(", ")}. </> : null}
              {r.note}
            </p>
          )}
          {r.agent_id && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-paper px-3 py-2 text-[13px]">
              <span>Агент: <strong>{r.agent?.full_name ?? r.agent?.email ?? "—"}</strong>{r.agent?.agent_code ? <span className="mono text-muted"> · {r.agent.agent_code}</span> : null}</span>
              <span>Хувь: <strong className="mono">{num(r.agent_amount ?? 0)}₮</strong>{r.agent_share != null ? <span className="text-muted"> ({Number(r.agent_share)}%)</span> : null}</span>
              {r.status === "approved" && (r.agent_paid_at
                ? <span className="badge bg-active-bg text-active-fg">Төлсөн · {dateShort(r.agent_paid_at)}</span>
                : <span className="badge bg-pending-bg text-pending-fg">Төлөөгүй</span>)}
              {admin && r.status === "approved" && (
                <form action={setAgentPaid} className="ml-auto">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="paid" value={r.agent_paid_at ? "0" : "1"} />
                  <ConfirmButton message={r.agent_paid_at ? "Төлөөгүй болгох уу?" : `Агентад ${num(r.agent_amount ?? 0)}₮ шилжүүлсэн гэж тэмдэглэх үү?`} className={`btn btn-sm ${r.agent_paid_at ? "btn-ghost" : "btn-ink"}`}>
                    {r.agent_paid_at ? "Буцаах" : "Төлсөн гэж тэмдэглэх"}
                  </ConfirmButton>
                </form>
              )}
            </div>
          )}
          {r.admin_note && <p className="m-0 text-[13px] rounded-lg bg-paper px-3 py-2">Админ: {r.admin_note}</p>}
          <div className="flex flex-wrap gap-2 items-center">
            {r.ad?.contract_id && (
              <a href={`/api/contracts/${r.ad.contract_id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">Гэрээ (PDF)</a>
            )}
            {admin && r.status === "pending" && (
              <form action={reviewSaleReport} className="flex flex-wrap gap-2 items-center flex-1 min-w-[260px]">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value={back} />
                <input name="note" placeholder="Тэмдэглэл (заавал биш)" className="input h-9 text-[13px] flex-[1_1_160px]" />
                <ConfirmButton name="approve" value="1" message="Тайланг батлах уу? Зар “зарагдсан” болж, эзэнд нь мэдэгдэл очно." className="btn btn-sm btn-yellow">Батлах</ConfirmButton>
                <ConfirmButton name="approve" value="0" message="Тайланг буцаах уу?" className="btn btn-sm btn-danger">Буцаах</ConfirmButton>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
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
