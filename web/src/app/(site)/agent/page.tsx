import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAgent } from "@/lib/data";
import { dateShort, money, num } from "@/lib/format";
import { agentLink } from "@/lib/site";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "./CopyButton";
import type { AdStatus } from "@shared/types";

export const metadata = { title: "Агент" };

type Report = {
  id: string;
  status: "pending" | "approved" | "rejected";
  sold_price: number;
  sold_at: string;
  agent_amount: number | null;
  agent_paid_at: string | null;
  ad: { brand: string; model: string; year_made: number } | null;
};
type AgentAd = {
  id: string;
  brand: string;
  model: string;
  year_made: number;
  price: number;
  status: AdStatus;
  created_at: string;
};

export default async function AgentPage() {
  const me = await requireAgent();
  const supabase = await createClient();
  const [{ data: adRows }, { data: repRows }] = await Promise.all([
    supabase
      .from("ads")
      .select("id,brand,model,year_made,price,status,created_at")
      .eq("agent_id", me.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("sale_reports")
      .select("id,status,sold_price,sold_at,agent_amount,agent_paid_at,ad:ads(brand,model,year_made)")
      .eq("agent_id", me.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const ads = (adRows ?? []) as AgentAd[];
  const reports = (repRows ?? []) as unknown as Report[];
  const approved = reports.filter((r) => r.status === "approved");
  const earned = approved.reduce((t, r) => t + (r.agent_amount ?? 0), 0);
  const paid = approved.filter((r) => r.agent_paid_at).reduce((t, r) => t + (r.agent_amount ?? 0), 0);
  const waiting = reports.filter((r) => r.status === "pending").reduce((t, r) => t + (r.agent_amount ?? 0), 0);
  const code = me.agent_code;
  const link = code ? agentLink(code) : null;

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Агентын самбар</h1>
        <span className="text-[14px] text-muted">
          Таны авчирсан зар зарагдахад шимтгэлийн тодорхой хувь танд ногдоно.
        </span>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl bg-ink p-5 text-paper">
        <span className="text-[13px] text-pale">Таны код</span>
        {code ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="mono text-[30px] font-bold tracking-[0.12em] text-yellow">{code}</span>
              <CopyButton text={code} label="Код хуулах" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="mono break-all text-[#c9cdd3]">{link}</span>
              <CopyButton text={link!} label="Холбоос хуулах" />
            </div>
            <p className="m-0 text-[13px] leading-relaxed text-pale">
              Машинаа зарах хүнд энэ холбоосыг илгээнэ үү — тэр зар оруулахад таны код автоматаар бөглөгдөнө. Эсвэл зар
              оруулахдаа «Агентын код» талбарт кодоо бичүүлнэ.
            </p>
          </>
        ) : (
          <span className="text-[14px]">Код үүсээгүй байна. Админд хандана уу.</span>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <Stat
          label="Авчирсан зар"
          value={String(ads.length)}
          sub={`${ads.filter((a) => a.status === "active").length} идэвхтэй`}
        />
        <Stat label="Нийт олсон" value={money(earned)} sub={`${approved.length} борлуулалт`} />
        <Stat label="Хүлээн авсан" value={money(paid)} />
        <Stat
          label="Төлөгдөх"
          value={money(earned - paid + waiting)}
          sub={waiting ? `${money(waiting)} батлагдахыг хүлээж буй` : undefined}
          dark
        />
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="m-0 text-[17px] font-bold">Борлуулалт</h2>
        {reports.length === 0 ? (
          <p className="card m-0 px-5 py-8 text-center text-[14px] text-muted">Одоогоор борлуулалт алга.</p>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Машин</th>
                  <th>Зарагдсан</th>
                  <th>Үнэ</th>
                  <th>Таны хувь</th>
                  <th>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">
                      {r.ad ? `${r.ad.brand} ${r.ad.model} · ${r.ad.year_made}` : "Устгагдсан зар"}
                    </td>
                    <td className="text-muted">{dateShort(r.sold_at)}</td>
                    <td className="mono">{num(r.sold_price)}₮</td>
                    <td className="mono font-bold">{num(r.agent_amount ?? 0)}₮</td>
                    <td>
                      {r.status === "pending" ? (
                        <span className="badge bg-pending-bg text-pending-fg">Админ шалгаж байна</span>
                      ) : r.status === "rejected" ? (
                        <span className="badge bg-danger-bg text-[#9b1c1c]">Буцаагдсан</span>
                      ) : r.agent_paid_at ? (
                        <span className="badge bg-active-bg text-active-fg">Төлсөн · {dateShort(r.agent_paid_at)}</span>
                      ) : (
                        <span className="badge bg-pending-bg text-pending-fg">Төлөгдөөгүй</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="m-0 text-[17px] font-bold">Таны кодоор орсон зарууд</h2>
        {ads.length === 0 ? (
          <p className="card m-0 px-5 py-8 text-center text-[14px] text-muted">
            Одоогоор зар алга. Холбоосоо хуваалцаж эхлээрэй.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2">
            {ads.map((a) => (
              <li key={a.id} className="card flex items-center justify-between gap-3 p-3.5">
                <Link href={`/ads/${a.id}`} className="flex min-w-0 flex-col gap-0.5 no-underline">
                  <span className="truncate font-semibold">
                    {a.brand} {a.model} · {a.year_made}
                  </span>
                  <span className="text-[13px] text-muted">
                    {money(a.price)} · {dateShort(a.created_at)}
                  </span>
                </Link>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, sub, dark }: { label: string; value: string; sub?: string; dark?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-2xl p-4 ${dark ? "bg-ink text-paper" : "card"}`}>
      <span className={`text-[13px] ${dark ? "text-[#c9cdd3]" : "text-muted"}`}>{label}</span>
      <span className={`h-display truncate text-[20px] sm:text-[24px] ${dark ? "text-yellow" : ""}`}>{value}</span>
      {sub && <span className={`text-[12px] ${dark ? "text-[#c9cdd3]" : "text-body"}`}>{sub}</span>}
    </div>
  );
}
