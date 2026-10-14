import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireAdmin } from "@/lib/data";
import { categoryLong, dateShort, money, monthLabel, timeAgo } from "@/lib/format";
import { monthStarts, pendingCount } from "@/lib/panel";
import type { Ad } from "@shared/types";
import { Kpi, PanelShell } from "@/components/PanelShell";
import { BarChart } from "@/components/BarChart";

export const metadata = { title: "Админ · Самбар" };

export default async function AdminDashboard() {
  const me = await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + 1 - (7 - i) * 7 + 7);
    return d;
  });

  const head = { count: "exact" as const, head: true };
  const months = monthStarts(6);
  const [
    users,
    usersMonth,
    totalAds,
    active,
    activeNew,
    sold,
    soldMonth,
    flagsOpen,
    offers,
    weekly,
    log,
    pending,
    soldRes,
    recentRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", head),
    supabase.from("profiles").select("id", head).gte("created_at", monthStart),
    supabase.from("ads").select("id", head),
    supabase.from("ads").select("id", head).eq("status", "active"),
    supabase.from("ads").select("id", head).eq("status", "active").eq("category", "new"),
    supabase.from("ads").select("id", head).eq("status", "sold"),
    supabase.from("ads").select("id", head).eq("status", "sold").gte("sold_at", monthStart),
    supabase.from("ad_flags").select("id", head).eq("status", "open"),
    supabase.from("ads").select("id", head).not("offer_sent_at", "is", null),
    supabase.from("ads").select("created_at").gte("created_at", weeks[0].toISOString()),
    supabase.from("activity_log").select("id,action,created_at").order("id", { ascending: false }).limit(8),
    pendingCount(),
    supabase.from("ads").select("category,sold_at").eq("status", "sold").gte("sold_at", months[0].toISOString()),
    supabase
      .from("ads")
      .select("*, owner:profiles!ads_user_id_fkey(full_name)")
      .eq("status", "sold")
      .order("sold_at", { ascending: false })
      .limit(8),
  ]);

  const created = (weekly.data ?? []).map((r) => new Date(r.created_at as string));
  const bars = weeks.map((w, i) => {
    const end = weeks[i + 1] ?? new Date(w.getTime() + 7 * 864e5);
    const v = created.filter((d) => d >= w && d < end).length;
    return {
      label: `Д${i + 1}`,
      values: [v],
      tip: `${w.getMonth() + 1}/${w.getDate()}-с эхэлсэн долоо хоног: ${v} зар`,
    };
  });
  const cy = settings.cutoff_year;
  const soldRows = (soldRes.data ?? []) as { category: string; sold_at: string }[];
  const soldBars = months.map((m, i) => {
    const end = months[i + 1] ?? new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const inM = soldRows.filter((s) => new Date(s.sold_at) >= m && new Date(s.sold_at) < end);
    const n = inM.filter((s) => s.category === "new").length;
    const o = inM.length - n;
    return { label: monthLabel(m), values: [n, o], tip: `${monthLabel(m)}: ${cy}+ ${n}, ${cy}-аас өмнө ${o}` };
  });
  const recent = (recentRes.data ?? []) as (Ad & { owner: { full_name: string | null } | null })[];

  return (
    <PanelShell profile={me} area="admin" active="admin" pending={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display m-0 text-[28px]">Самбар</h1>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/admin/review" className="btn btn-ghost">
            Шинэ зар шалгах{pending ? ` · ${pending}` : ""}
          </Link>
          <Link href="/post" className="btn btn-ink">
            + Зар нэмэх
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        <Kpi
          label="Нийт хэрэглэгч"
          value={(users.count ?? 0).toLocaleString("en-US")}
          sub={`+${usersMonth.count ?? 0} энэ сард`}
        />
        <Kpi dark label="Хүлээгдэж буй зар" value={pending} sub="Шалгах →" href="/admin/review" />
        <Kpi
          label="Нийт зар"
          value={(totalAds.count ?? 0).toLocaleString("en-US")}
          sub={`Илгээсэн санал: ${offers.count ?? 0}`}
        />
        <Kpi
          label="Идэвхтэй зар"
          value={active.count ?? 0}
          sub={`${cy}+: ${activeNew.count ?? 0} · өмнө: ${(active.count ?? 0) - (activeNew.count ?? 0)}`}
        />
        <Kpi label="Зарагдсан" value={sold.count ?? 0} sub={`${soldMonth.count ?? 0} энэ сард`} />
        <Kpi label="Нээлттэй гомдол" value={flagsOpen.count ?? 0} sub="Гомдол →" href="/admin/flags" />
      </div>
      <div className="flex flex-wrap items-start gap-4.5">
        <section className="card flex min-w-0 flex-[999_1_480px] flex-col gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="m-0 text-[17px] font-bold">Шинэ зар, долоо хоногоор</h2>
            <span className="text-[13px] text-muted">Сүүлийн 8 долоо хоног</span>
          </div>
          <BarChart bars={bars} series={[{ name: "Шинэ зар", color: "#2F55D4" }]} />
        </section>
        <section className="card flex flex-[1_1_320px] flex-col gap-1 p-5">
          <h2 className="m-0 mb-2 text-[17px] font-bold">Сүүлийн үйлдлүүд</h2>
          {(log.data ?? []).length === 0 && <p className="m-0 text-[14px] text-muted">Одоогоор үйлдэл алга.</p>}
          {(log.data ?? []).map((l) => (
            <div key={l.id} className="flex gap-2.5 border-b border-[#ecede9] py-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[14px]">{l.action}</span>
                <span className="text-[12px] text-muted">{timeAgo(l.created_at as string)}</span>
              </div>
            </div>
          ))}
        </section>
      </div>
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="m-0 text-[17px] font-bold">Зарагдсан машин, сараар</h2>
        <BarChart
          bars={soldBars}
          series={[
            { name: categoryLong("new", cy), color: "#2F55D4" },
            { name: categoryLong("old", cy), color: "#C7700A" },
          ]}
        />
      </section>
      <section className="card flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4.5 pb-1.5">
          <h2 className="m-0 text-[17px] font-bold">Сүүлд зарагдсан машинууд</h2>
          <Link href="/admin/ads?status=sold" className="text-[14px] font-semibold">
            Бүгдийг харах
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Машин</th>
                <th>Ангилал</th>
                <th>Үйлд. / Орж ирсэн</th>
                <th>Зарагдсан үнэ</th>
                <th>Огноо</th>
                <th>Зар тавьсан</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted">
                    Одоогоор зарагдсан машин алга.
                  </td>
                </tr>
              )}
              {recent.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">
                    {a.brand} {a.model}
                  </td>
                  <td>{categoryLong(a.category, cy)}</td>
                  <td className="mono">
                    {a.year_made} / {a.year_imported ?? "—"}
                  </td>
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
