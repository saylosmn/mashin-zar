import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireStaff } from "@/lib/data";
import { categoryLong, dateShort, money, monthLabel } from "@/lib/format";
import { monthStarts, pendingCount } from "@/lib/panel";
import { Kpi, PanelShell } from "@/components/PanelShell";
import { BarChart } from "@/components/BarChart";
import type { Ad } from "@/lib/types";

export const metadata = { title: "Менежер · Самбар" };

export default async function ManagerDashboard() {
  const me = await requireStaff();
  const settings = await getSettings();
  const supabase = await createClient();
  const months = monthStarts(6);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [pending, active, activeNew, offers, soldRes, recentRes] = await Promise.all([
    pendingCount(),
    supabase.from("ads").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("ads").select("id", { count: "exact", head: true }).eq("status", "active").eq("category", "new"),
    supabase.from("ads").select("id", { count: "exact", head: true }).not("offer_sent_at", "is", null),
    supabase.from("ads").select("category,sold_at").eq("status", "sold").gte("sold_at", months[0].toISOString()),
    supabase.from("ads").select("*, owner:profiles!ads_user_id_fkey(full_name)").eq("status", "sold").order("sold_at", { ascending: false }).limit(8),
  ]);
  const sold = (soldRes.data ?? []) as { category: string; sold_at: string }[];
  const soldThisMonth = sold.filter((s) => s.sold_at >= monthStart);
  const cy = settings.cutoff_year;
  const bars = months.map((m, i) => {
    const end = months[i + 1] ?? new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const inM = sold.filter((s) => new Date(s.sold_at) >= m && new Date(s.sold_at) < end);
    const n = inM.filter((s) => s.category === "new").length;
    const o = inM.length - n;
    return { label: monthLabel(m), values: [n, o], tip: `${monthLabel(m)}: ${cy}+ ${n}, ${cy}-аас өмнө ${o}` };
  });
  const recent = (recentRes.data ?? []) as (Ad & { owner: { full_name: string | null } | null })[];

  return (
    <PanelShell profile={me} area="manager" active="mgr" pending={pending}>
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[28px]">Самбар</h1>
        <span className="text-[14px] text-muted">Сайн байна уу, {me.full_name?.split(" ")[0] ?? "менежер"}</span>
      </div>
      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <Kpi label="Зарагдсан (энэ сар)" value={soldThisMonth.length} sub={`${cy}+: ${soldThisMonth.filter((s) => s.category === "new").length} · ${cy}-аас өмнө: ${soldThisMonth.filter((s) => s.category === "old").length}`} />
        <Kpi dark label="Хүлээгдэж буй зар" value={pending} sub="Холбогдох шаардлагатай →" href="/manager/ads" />
        <Kpi label="Идэвхтэй зар" value={active.count ?? 0} sub={`${cy}+: ${activeNew.count ?? 0} · ${cy}-аас өмнө: ${(active.count ?? 0) - (activeNew.count ?? 0)}`} />
        <Kpi label="Илгээсэн санал" value={offers.count ?? 0} sub={settings.offer_percent != null ? `Хувь: ${settings.offer_percent}%` : "Хувь тохируулаагүй (админ)"} />
      </div>
      <section className="card p-5 flex flex-col gap-4">
        <h2 className="m-0 text-[17px] font-bold">Зарагдсан машин, сараар</h2>
        <BarChart
          bars={bars}
          series={[
            { name: categoryLong("new", cy), color: "#2F55D4" },
            { name: categoryLong("old", cy), color: "#C7700A" },
          ]}
        />
      </section>
      <section className="card flex flex-col">
        <div className="flex justify-between items-center px-5 pt-4.5 pb-1.5 gap-3 flex-wrap">
          <h2 className="m-0 text-[17px] font-bold">Сүүлд зарагдсан машинууд</h2>
          <Link href="/manager/all?status=sold" className="text-[14px] font-semibold">Бүгдийг харах</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead><tr><th>Машин</th><th>Ангилал</th><th>Үйлд. / Орж ирсэн</th><th>Зарагдсан үнэ</th><th>Огноо</th><th>Зар тавьсан</th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={6} className="text-muted">Одоогоор зарагдсан машин алга.</td></tr>}
              {recent.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">{a.brand} {a.model}</td>
                  <td>{categoryLong(a.category, cy)}</td>
                  <td className="mono">{a.year_made} / {a.year_imported ?? "—"}</td>
                  <td className="h-display text-[13px]">{money(a.sold_price ?? a.price)}</td>
                  <td className="text-muted">{dateShort(a.sold_at)}</td>
                  <td>{a.owner?.full_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PanelShell>
  );
}
