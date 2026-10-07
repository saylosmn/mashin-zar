import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/data";
import { dateShort } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { PanelShell } from "@/components/PanelShell";

export const metadata = { title: "Менежер · Зар тавьсан хүмүүс" };

export default async function ManagerUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const me = await requireStaff();
  const supabase = await createClient();
  const pending = await pendingCount();
  const { data: ads } = await supabase.from("ads").select("user_id,status");
  const stats = new Map<string, { total: number; active: number; sold: number; pending: number }>();
  for (const a of ads ?? []) {
    const s = stats.get(a.user_id) ?? { total: 0, active: 0, sold: 0, pending: 0 };
    s.total++;
    if (a.status === "active") s.active++;
    if (a.status === "sold") s.sold++;
    if (a.status === "pending") s.pending++;
    stats.set(a.user_id, s);
  }
  const ids = [...stats.keys()];
  let pq = supabase.from("profiles").select("id,full_name,email,phone,city,created_at,is_blocked").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const term = (q ?? "").replace(/[,()%*]/g, " ").trim();
  if (term) pq = pq.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data: people } = await pq;
  const rows = (people ?? []).sort((a, b) => (stats.get(b.id)?.total ?? 0) - (stats.get(a.id)?.total ?? 0));

  return (
    <PanelShell profile={me} area="manager" active="mgr-users" pending={pending}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="h-display m-0 text-[28px]">Зар тавьсан хүмүүс</h1>
        <form className="flex gap-2"><input name="q" defaultValue={q} type="search" aria-label="Хайх" placeholder="Нэр, и-мэйл, утас" className="input h-11 w-64" /><button className="btn btn-ink">Хайх</button></form>
      </div>
      <div className="table-wrap">
        <table className="table min-w-[860px]">
          <thead><tr><th>Нэр</th><th>Утас</th><th>И-мэйл</th><th>Хот</th><th>Нийт</th><th>Идэвхтэй</th><th>Хүлээгдэж</th><th>Зарагдсан</th><th>Бүртгүүлсэн</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="text-muted">Одоогоор зар тавьсан хүн алга.</td></tr>}
            {rows.map((p) => {
              const s = stats.get(p.id)!;
              return (
                <tr key={p.id}>
                  <td className="font-semibold">{p.full_name ?? "—"} {p.is_blocked && <span className="badge bg-danger-bg text-[#9b1c1c] ml-1">Хаагдсан</span>}</td>
                  <td className="mono"><a href={`tel:${p.phone}`}>{p.phone ?? "—"}</a></td>
                  <td className="text-body">{p.email}</td>
                  <td>{p.city ?? "—"}</td>
                  <td className="mono">{s.total}</td>
                  <td className="mono">{s.active}</td>
                  <td className="mono">{s.pending}</td>
                  <td className="mono">{s.sold}</td>
                  <td className="text-muted">{dateShort(p.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}
