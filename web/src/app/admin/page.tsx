import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireAdmin } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
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
  const [users, usersMonth, totalAds, active, activeNew, sold, soldMonth, staff, staffBlocked, weekly, log, pending] = await Promise.all([
    supabase.from("profiles").select("id", head),
    supabase.from("profiles").select("id", head).gte("created_at", monthStart),
    supabase.from("ads").select("id", head),
    supabase.from("ads").select("id", head).eq("status", "active"),
    supabase.from("ads").select("id", head).eq("status", "active").eq("category", "new"),
    supabase.from("ads").select("id", head).eq("status", "sold"),
    supabase.from("ads").select("id", head).eq("status", "sold").gte("sold_at", monthStart),
    supabase.from("profiles").select("id", head).in("role", ["manager", "admin"]),
    supabase.from("profiles").select("id", head).in("role", ["manager", "admin"]).eq("is_blocked", true),
    supabase.from("ads").select("created_at").gte("created_at", weeks[0].toISOString()),
    supabase.from("activity_log").select("id,action,created_at").order("id", { ascending: false }).limit(8),
    pendingCount(),
  ]);

  const created = (weekly.data ?? []).map((r) => new Date(r.created_at as string));
  const bars = weeks.map((w, i) => {
    const end = weeks[i + 1] ?? new Date(w.getTime() + 7 * 864e5);
    const v = created.filter((d) => d >= w && d < end).length;
    return { label: `Д${i + 1}`, values: [v], tip: `${w.getMonth() + 1}/${w.getDate()}-с эхэлсэн долоо хоног: ${v} зар` };
  });
  const cy = settings.cutoff_year;
  const st = staff.count ?? 0;
  const sb = staffBlocked.count ?? 0;

  return (
    <PanelShell profile={me} area="admin" active="admin" pending={pending}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="h-display m-0 text-[28px]">Самбар</h1>
        <div className="flex gap-2.5 flex-wrap">
          <Link href="/admin/users" className="btn btn-ghost">+ Менежер</Link>
          <Link href="/post" className="btn btn-ink">+ Зар нэмэх</Link>
        </div>
      </div>
      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        <Kpi label="Нийт хэрэглэгч" value={(users.count ?? 0).toLocaleString("en-US")} sub={`+${usersMonth.count ?? 0} энэ сард`} />
        <Kpi label="Нийт зар" value={(totalAds.count ?? 0).toLocaleString("en-US")} sub={`${pending} хүлээгдэж буй`} />
        <Kpi label="Идэвхтэй зар" value={active.count ?? 0} sub={`${cy}+: ${activeNew.count ?? 0} · өмнө: ${(active.count ?? 0) - (activeNew.count ?? 0)}`} />
        <Kpi label="Зарагдсан" value={sold.count ?? 0} sub={`${soldMonth.count ?? 0} энэ сард`} />
        <Kpi label="Менежер" value={st} sub={`${st - sb} идэвхтэй · ${sb} хаагдсан`} />
      </div>
      <div className="flex flex-wrap gap-4.5 items-start">
        <section className="card flex-[999_1_480px] min-w-0 p-5 flex flex-col gap-4">
          <div className="flex justify-between items-baseline gap-3 flex-wrap">
            <h2 className="m-0 text-[17px] font-bold">Шинэ зар, долоо хоногоор</h2>
            <span className="text-[13px] text-muted">Сүүлийн 8 долоо хоног</span>
          </div>
          <BarChart bars={bars} series={[{ name: "Шинэ зар", color: "#2F55D4" }]} />
        </section>
        <section className="card flex-[1_1_320px] p-5 flex flex-col gap-1">
          <h2 className="m-0 mb-2 text-[17px] font-bold">Сүүлийн үйлдлүүд</h2>
          {(log.data ?? []).length === 0 && <p className="m-0 text-muted text-[14px]">Одоогоор үйлдэл алга.</p>}
          {(log.data ?? []).map((l) => (
            <div key={l.id} className="flex gap-2.5 py-2.5 border-b border-[#ecede9]">
              <span className="w-2 h-2 rounded-full bg-ink mt-1.5 shrink-0" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[14px]">{l.action}</span>
                <span className="text-[12px] text-muted">{timeAgo(l.created_at as string)}</span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </PanelShell>
  );
}
