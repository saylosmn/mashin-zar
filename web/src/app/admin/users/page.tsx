import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { dateShort, initial } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { deleteInvite, inviteStaff, removeStaff, setBlocked } from "../../panel-actions";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Админ · Аккаунтууд" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; ok?: string; err?: string; page?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const tab = sp.tab === "users" ? "users" : "staff";
  const pending = await pendingCount();
  const head = { count: "exact" as const, head: true };
  const [staffCount, userCount] = await Promise.all([
    supabase.from("profiles").select("id", head).in("role", ["manager", "admin"]),
    supabase.from("profiles").select("id", head).eq("role", "user"),
  ]);
  const back = `/admin/users?tab=${tab}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;

  let rows: Profile[] = [];
  let invites: { email: string; role: string; full_name: string | null; created_at: string }[] = [];
  const counts = new Map<string, { approved: number; sold: number; ads: number }>();
  const page = Math.max(1, Number(sp.page) || 1);
  if (tab === "staff") {
    const { data } = await supabase.from("profiles").select("*").in("role", ["manager", "admin"]).order("created_at");
    rows = (data ?? []) as Profile[];
    const { data: inv } = await supabase.from("staff_invites").select("*").order("created_at", { ascending: false });
    const emails = new Set(rows.map((r) => r.email?.toLowerCase()));
    invites = (inv ?? []).filter((i) => !emails.has(i.email.toLowerCase()));
    const { data: managed } = await supabase.from("ads").select("manager_id,status").not("manager_id", "is", null);
    for (const a of managed ?? []) {
      const c = counts.get(a.manager_id!) ?? { approved: 0, sold: 0, ads: 0 };
      if (a.status === "active" || a.status === "sold") c.approved++;
      if (a.status === "sold") c.sold++;
      counts.set(a.manager_id!, c);
    }
  } else {
    let q = supabase.from("profiles").select("*").eq("role", "user").order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
    const term = (sp.q ?? "").replace(/[,()%*]/g, " ").trim();
    if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
    const { data } = await q;
    rows = (data ?? []) as Profile[];
    const { data: ads } = await supabase.from("ads").select("user_id").in("user_id", rows.map((r) => r.id).concat("00000000-0000-0000-0000-000000000000"));
    for (const a of ads ?? []) {
      const c = counts.get(a.user_id) ?? { approved: 0, sold: 0, ads: 0 };
      c.ads++;
      counts.set(a.user_id, c);
    }
  }

  return (
    <PanelShell profile={me} area="admin" active="admin-users" pending={pending}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="h-display m-0 text-[28px]">Аккаунтууд</h1>
        <nav aria-label="Төрөл" className="flex gap-1 p-1 bg-soft rounded-xl">
          <Link href="/admin/users" aria-current={tab === "staff" ? "page" : undefined} className={`h-10 px-4 rounded-[9px] flex items-center text-[14px] no-underline ${tab === "staff" ? "bg-ink text-yellow font-semibold" : "text-body"}`}>Менежер · {staffCount.count ?? 0}</Link>
          <Link href="/admin/users?tab=users" aria-current={tab === "users" ? "page" : undefined} className={`h-10 px-4 rounded-[9px] flex items-center text-[14px] no-underline ${tab === "users" ? "bg-ink text-yellow font-semibold" : "text-body"}`}>Хэрэглэгч · {(userCount.count ?? 0).toLocaleString("en-US")}</Link>
        </nav>
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      {tab === "staff" ? (
        <>
          <form action={inviteStaff} className="bg-ink text-paper rounded-2xl p-5 flex flex-wrap gap-3 items-end">
            <input type="hidden" name="back" value={back} />
            <span className="basis-full h-display text-[16px]">Шинэ менежерийн аккаунт нээх</span>
            <label className="label text-paper flex-[1_1_200px]">Нэр<input name="name" className="input h-11" placeholder="Овог нэр" /></label>
            <label className="label text-paper flex-[1_1_220px]">Google и-мэйл<input name="email" type="email" required className="input h-11" placeholder="name@gmail.com" /></label>
            <label className="label text-paper flex-[1_1_150px]">Утас<input name="phone" type="tel" className="input h-11" placeholder="9911 2233" /></label>
            <label className="label text-paper flex-[0_1_140px]">Эрх
              <select name="role" className="input h-11"><option value="manager">Менежер</option><option value="admin">Админ</option></select>
            </label>
            <button className="btn btn-yellow h-11">Аккаунт нээх</button>
          </form>
          <div className="table-wrap">
            <table className="table min-w-[820px]">
              <thead><tr><th>Менежер</th><th>И-мэйл</th><th>Эрх</th><th>Баталсан зар</th><th>Зарагдсан</th><th>Төлөв</th><th>Үйлдэл</th></tr></thead>
              <tbody>
                {rows.map((m) => {
                  const c = counts.get(m.id) ?? { approved: 0, sold: 0, ads: 0 };
                  const self = m.id === me.id;
                  return (
                    <tr key={m.id}>
                      <td><div className="flex items-center gap-2.5"><span className="w-[34px] h-[34px] rounded-full bg-ink text-yellow flex items-center justify-center font-bold text-[13px]">{initial(m.full_name ?? m.email)}</span><span className="font-semibold">{m.full_name ?? "—"}{self ? " (та)" : ""}</span></div></td>
                      <td className="text-body">{m.email}</td>
                      <td>{m.role === "admin" ? "Админ" : "Менежер"}</td>
                      <td className="mono">{c.approved}</td>
                      <td className="mono">{c.sold}</td>
                      <td>{m.is_blocked ? <span className="badge bg-sold-bg text-sold-fg">Хаагдсан</span> : <span className="badge bg-active-bg text-active-fg">Идэвхтэй</span>}</td>
                      <td>
                        {!self && (
                          <div className="flex gap-1.5">
                            <form action={setBlocked}>
                              <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
                              <input type="hidden" name="blocked" value={m.is_blocked ? "0" : "1"} />
                              <button className={`btn btn-sm ${m.is_blocked ? "btn-ghost" : "btn-danger"}`}>{m.is_blocked ? "Нээх" : "Хаах"}</button>
                            </form>
                            <form action={removeStaff}>
                              <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
                              <button className="btn btn-sm btn-ghost">Эрх хасах</button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {invites.map((i) => (
                  <tr key={i.email}>
                    <td className="font-semibold">{i.full_name ?? "—"}</td>
                    <td className="text-body">{i.email}</td>
                    <td>{i.role === "admin" ? "Админ" : "Менежер"}</td>
                    <td className="mono">—</td><td className="mono">—</td>
                    <td><span className="badge bg-pending-bg text-pending-fg">Нэвтрэхийг хүлээж буй</span></td>
                    <td>
                      <form action={deleteInvite}>
                        <input type="hidden" name="email" value={i.email} /><input type="hidden" name="back" value={back} />
                        <button className="btn btn-sm btn-danger">Цуцлах</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="text-[13px] text-muted">Хаагдсан аккаунт панел руу нэвтэрч чадахгүй. Шинэ менежер өөрийн Google и-мэйлээр нэвтэрмэгц эрх нь автоматаар идэвхжинэ.</span>
        </>
      ) : (
        <>
          <form className="flex gap-2.5 flex-wrap">
            <input type="hidden" name="tab" value="users" />
            <input name="q" defaultValue={sp.q} type="search" aria-label="Хайх" placeholder="Нэр, и-мэйл, утас" className="input h-11 flex-[1_1_260px]" />
            <button className="btn btn-ink">Хайх</button>
          </form>
          <div className="table-wrap">
            <table className="table min-w-[820px]">
              <thead><tr><th>Хэрэглэгч</th><th>И-мэйл</th><th>Утас</th><th>Зар</th><th>Бүртгүүлсэн</th><th>Төлөв</th><th>Үйлдэл</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} className="text-muted">Хэрэглэгч олдсонгүй.</td></tr>}
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.full_name ?? "—"}</td>
                    <td className="text-body">{u.email}</td>
                    <td className="mono">{u.phone ?? "—"}</td>
                    <td className="mono">{counts.get(u.id)?.ads ?? 0}</td>
                    <td className="text-muted">{dateShort(u.created_at)}</td>
                    <td>{u.is_blocked ? <span className="badge bg-sold-bg text-sold-fg">Хаагдсан</span> : <span className="badge bg-active-bg text-active-fg">Идэвхтэй</span>}</td>
                    <td>
                      <form action={setBlocked}>
                        <input type="hidden" name="id" value={u.id} /><input type="hidden" name="back" value={back} />
                        <input type="hidden" name="blocked" value={u.is_blocked ? "0" : "1"} />
                        <button className={`btn btn-sm ${u.is_blocked ? "btn-ghost" : "btn-danger"}`}>{u.is_blocked ? "Нээх" : "Хаах"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-1.5 justify-end">
            {page > 1 && <Link className="btn btn-ghost" href={`/admin/users?tab=users&page=${page - 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>Өмнөх</Link>}
            {rows.length === 50 && <Link className="btn btn-ghost" href={`/admin/users?tab=users&page=${page + 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>Дараах</Link>}
          </div>
        </>
      )}
    </PanelShell>
  );
}
