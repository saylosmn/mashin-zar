import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateShort } from "@/lib/format";
import type { Profile } from "@shared/types";
import { AccountStatus, BlockButton, EmptyRow, idsOrNone } from "./shared";

const PAGE_SIZE = 50;

export async function UsersTab({ back, q, page }: { back: string; q?: string; page: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("*")
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // PostgREST-ийн or() шүүлтүүрийг эвдэх тэмдэгтүүдийг хасна
  const term = (q ?? "").replace(/[,()%*]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data } = await query;
  const rows = (data ?? []) as Profile[];
  const { data: ads } = await supabase
    .from("ads")
    .select("user_id")
    .in("user_id", idsOrNone(rows.map((r) => r.id)));
  const adCount = new Map<string, number>();
  for (const a of ads ?? []) adCount.set(a.user_id, (adCount.get(a.user_id) ?? 0) + 1);

  const pageHref = (p: number) => `/admin/users?tab=users&page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const promote = (tab: string, email: string) => `/admin/users?tab=${tab}&email=${encodeURIComponent(email)}`;

  return (
    <>
      <form className="flex flex-wrap gap-2.5">
        <input type="hidden" name="tab" value="users" />
        <input
          name="q"
          defaultValue={q}
          type="search"
          aria-label="Хайх"
          placeholder="Нэр, и-мэйл, утас"
          className="input h-11 flex-[1_1_260px]"
        />
        <button className="btn btn-ink">Хайх</button>
      </form>
      <div className="table-wrap">
        <table className="table min-w-[820px]">
          <thead>
            <tr>
              <th>Хэрэглэгч</th>
              <th>И-мэйл</th>
              <th>Утас</th>
              <th>Зар</th>
              <th>Бүртгүүлсэн</th>
              <th>Төлөв</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow cols={7} text="Хэрэглэгч олдсонгүй." />}
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.full_name ?? "—"}</td>
                <td className="text-body">{u.email}</td>
                <td className="mono">{u.phone ?? "—"}</td>
                <td className="mono">{adCount.get(u.id) ?? 0}</td>
                <td className="text-muted">{dateShort(u.created_at)}</td>
                <td>
                  <AccountStatus blocked={u.is_blocked} />
                </td>
                <td>
                  <div className="flex gap-1.5">
                    <BlockButton id={u.id} blocked={u.is_blocked} back={back} />
                    {u.email && (
                      <>
                        <Link href={promote("dealers", u.email)} className="btn btn-sm btn-ghost">
                          Авто худалдаа болгох
                        </Link>
                        <Link href={promote("agents", u.email)} className="btn btn-sm btn-ghost">
                          Агент болгох
                        </Link>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-1.5">
        {page > 1 && (
          <Link className="btn btn-ghost" href={pageHref(page - 1)}>
            Өмнөх
          </Link>
        )}
        {rows.length === PAGE_SIZE && (
          <Link className="btn btn-ghost" href={pageHref(page + 1)}>
            Дараах
          </Link>
        )}
      </div>
    </>
  );
}
