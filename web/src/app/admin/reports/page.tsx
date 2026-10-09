import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { num } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { REPORT_SELECT, type ReportRow } from "@/lib/reports";
import { Flash, Kpi, PanelShell } from "@/components/PanelShell";
import { ReportList } from "@/components/ReportList";

export const metadata = { title: "Админ · Тайлангууд" };

const TABS = [
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "approved", label: "Батлагдсан" },
  { key: "rejected", label: "Буцаагдсан" },
  { key: "all", label: "Бүгд" },
] as const;

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "pending";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let q = supabase.from("sale_reports").select(REPORT_SELECT).order("created_at", { ascending: false }).limit(200);
  if (tab !== "all") q = q.eq("status", tab);
  const [pending, list, stats] = await Promise.all([
    pendingCount(),
    q,
    supabase.from("sale_reports").select("status,commission_amount,sold_price,reviewed_at"),
  ]);
  const rows = (list.data ?? []) as unknown as ReportRow[];
  const all = (stats.data ?? []) as { status: string; commission_amount: number; sold_price: number; reviewed_at: string | null }[];
  const approved = all.filter((r) => r.status === "approved");
  const month = approved.filter((r) => (r.reviewed_at ?? "") >= monthStart);
  const back = `/admin/reports?tab=${tab}`;

  return (
    <PanelShell profile={me} area="admin" active="admin-reports" pending={pending}>
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[28px]">Тайлангууд</h1>
        <span className="text-[14px] text-muted">Менежерүүдийн “зарагдсан” тайлан. Батлахад зар зарагдсан болж, эзэнд нь мэдэгдэл очно.</span>
      </div>
      <Flash ok={sp.ok} err={sp.err ?? (list.error ? `Тайлан уншиж чадсангүй: ${list.error.message}` : undefined)} />
      <div className="grid gap-3.5 grid-cols-2 md:grid-cols-4 max-w-[1000px]">
        <Kpi dark label="Хүлээгдэж буй" value={all.filter((r) => r.status === "pending").length} href="/admin/reports?tab=pending" />
        <Kpi label="Энэ сард зарагдсан" value={month.length} sub={`${num(month.reduce((t, r) => t + r.sold_price, 0))}₮`} />
        <Kpi label="Энэ сарын шимтгэл" value={`${num(month.reduce((t, r) => t + r.commission_amount, 0))}₮`} />
        <Kpi label="Нийт шимтгэл" value={`${num(approved.reduce((t, r) => t + r.commission_amount, 0))}₮`} sub={`${approved.length} борлуулалт`} />
      </div>
      <nav className="flex flex-wrap gap-1.5" aria-label="Шүүлтүүр">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/reports?tab=${t.key}`} className={`h-9 px-3.5 rounded-full flex items-center text-[13px] no-underline ${t.key === tab ? "bg-ink text-yellow font-semibold" : "bg-card border border-line-2 text-ink"}`}>
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
