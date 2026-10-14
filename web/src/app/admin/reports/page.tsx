import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireAdmin } from "@/lib/data";
import { num } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { REPORT_SELECT, agentOptions, reportableAds, type ReportRow } from "@/lib/reports";
import { Flash, Kpi, PanelShell } from "@/components/PanelShell";
import { ReportList } from "@/components/ReportList";
import { SaleReportForm } from "@/components/SaleReportForm";
import { submitSaleReport } from "@/actions/reports";

export const metadata = { title: "Админ · Тайлангууд" };

const TABS = [
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "approved", label: "Батлагдсан" },
  { key: "rejected", label: "Буцаагдсан" },
  { key: "all", label: "Бүгд" },
] as const;

export default async function AdminReports({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ad?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "pending";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let q = supabase.from("sale_reports").select(REPORT_SELECT).order("created_at", { ascending: false }).limit(200);
  if (tab !== "all") q = q.eq("status", tab);
  const settings = await getSettings();
  const [pending, list, stats, ads, agents] = await Promise.all([
    pendingCount(),
    q,
    supabase.from("sale_reports").select("status,commission_amount,sold_price,reviewed_at,agent_amount,agent_paid_at"),
    reportableAds(settings),
    agentOptions(),
  ]);
  const rows = (list.data ?? []) as unknown as ReportRow[];
  const all = (stats.data ?? []) as {
    status: string;
    commission_amount: number;
    sold_price: number;
    reviewed_at: string | null;
    agent_amount?: number | null;
    agent_paid_at?: string | null;
  }[];
  const unpaid = all.filter((r) => r.status === "approved" && (r.agent_amount ?? 0) > 0 && !r.agent_paid_at);
  const approved = all.filter((r) => r.status === "approved");
  const month = approved.filter((r) => (r.reviewed_at ?? "") >= monthStart);
  const back = `/admin/reports?tab=${tab}`;

  return (
    <PanelShell profile={me} area="admin" active="admin-reports" pending={pending}>
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[28px]">Тайлангууд</h1>
        <span className="text-[14px] text-muted">
          Зарагдсан машиныг энд бүртгэнэ — шимтгэл, агентын хувь автоматаар бодогдож, зар зарагдсан болж, эзэнд нь
          мэдэгдэл очно.
        </span>
      </div>
      <Flash ok={sp.ok} err={sp.err ?? (list.error ? `Тайлан уншиж чадсангүй: ${list.error.message}` : undefined)} />
      <div className="grid max-w-[1100px] grid-cols-2 gap-3.5 md:grid-cols-5">
        <Kpi
          dark
          label="Хүлээгдэж буй"
          value={all.filter((r) => r.status === "pending").length}
          href="/admin/reports?tab=pending"
        />
        <Kpi
          label="Энэ сард зарагдсан"
          value={month.length}
          sub={`${num(month.reduce((t, r) => t + r.sold_price, 0))}₮`}
        />
        <Kpi label="Энэ сарын шимтгэл" value={`${num(month.reduce((t, r) => t + r.commission_amount, 0))}₮`} />
        <Kpi
          label="Нийт шимтгэл"
          value={`${num(approved.reduce((t, r) => t + r.commission_amount, 0))}₮`}
          sub={`${approved.length} борлуулалт`}
        />
        <Kpi
          label="Агентад төлөх"
          value={`${num(unpaid.reduce((t, r) => t + (r.agent_amount ?? 0), 0))}₮`}
          sub={`${unpaid.length} тайлан төлөгдөөгүй`}
        />
      </div>
      <div className="max-w-[860px]">
        <SaleReportForm
          ads={ads}
          defaultAd={sp.ad}
          action={submitSaleReport}
          back={back}
          agents={agents}
          agentShare={Number(settings.agent_share ?? 50)}
        />
      </div>
      <nav className="flex flex-wrap gap-1.5" aria-label="Шүүлтүүр">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reports?tab=${t.key}`}
            className={`flex h-9 items-center rounded-full px-3.5 text-[13px] no-underline ${t.key === tab ? "bg-ink font-semibold text-yellow" : "border border-line-2 bg-card text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="max-w-[1000px]">
        <ReportList rows={rows} admin back={back} />
      </div>
    </PanelShell>
  );
}
