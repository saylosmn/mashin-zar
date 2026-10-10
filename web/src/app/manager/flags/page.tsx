import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/data";
import { STATUS, dateShort, money, timeAgo } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { CarPhoto } from "@/components/CarPhoto";
import { ConfirmButton } from "@/components/ConfirmButton";
import { resolveFlag } from "../../panel-actions";

export const metadata = { title: "Менежер · Гомдол" };

const REASON: Record<string, string> = {
  fake: "Хуурамч зар", sold: "Аль хэдийн зарагдсан", wrong_price: "Үнэ буруу",
  wrong_info: "Мэдээлэл буруу", scam: "Залилан", other: "Бусад",
};

type Flag = {
  id: string; ad_id: string; reason: string; note: string | null; status: "open" | "resolved" | "dismissed";
  action: string | null; created_at: string; resolved_at: string | null;
  ad: { id: string; brand: string; model: string; year_made: number; price: number; photos: string[]; status: string; phone: string } | null;
  reporter: { full_name: string | null; phone: string | null } | null;
};

export default async function FlagsPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireStaff();
  const supabase = await createClient();
  const tab = sp.tab === "closed" ? "closed" : "open";
  let q = supabase
    .from("ad_flags")
    .select("*, ad:ads(id,brand,model,year_made,price,photos,status,phone), reporter:profiles!ad_flags_user_id_fkey(full_name,phone)")
    .order("created_at", { ascending: false })
    .limit(200);
  q = tab === "open" ? q.eq("status", "open") : q.neq("status", "open");
  const [pending, { data, error }] = await Promise.all([pendingCount(), q]);
  const flags = (data ?? []) as unknown as Flag[];
  // Нэг зарын олон гомдлыг бүлэглэнэ
  const groups = new Map<string, Flag[]>();
  for (const f of flags) groups.set(f.ad_id, [...(groups.get(f.ad_id) ?? []), f]);
  const back = `/manager/flags${tab === "closed" ? "?tab=closed" : ""}`;

  return (
    <PanelShell profile={me} area={me.role === "admin" ? "admin" : "manager"} active="mgr-flags" pending={pending}>
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h-display m-0 text-[28px]">Гомдол</h1>
          <span className="text-[14px] text-muted">Хэрэглэгчдийн мэдээлсэн зарууд. Шалгаад нууж, эсвэл гомдлыг хаана.</span>
        </div>
        <nav className="flex gap-1.5" aria-label="Шүүлтүүр">
          <Link href="/manager/flags" className={`h-9 px-3.5 rounded-full flex items-center text-[13px] no-underline ${tab === "open" ? "bg-ink text-yellow font-semibold" : "bg-card border border-line-2"}`}>Шийдвэрлээгүй</Link>
          <Link href="/manager/flags?tab=closed" className={`h-9 px-3.5 rounded-full flex items-center text-[13px] no-underline ${tab === "closed" ? "bg-ink text-yellow font-semibold" : "bg-card border border-line-2"}`}>Шийдвэрлэсэн</Link>
        </nav>
      </div>
      <Flash ok={sp.ok} err={sp.err ?? (error ? `Уншиж чадсангүй: ${error.message}` : undefined)} />
      {groups.size === 0 ? (
        <p className="m-0 card px-5 py-10 text-center text-[14px] text-muted max-w-[900px]">{tab === "open" ? "Шийдвэрлэх гомдол алга 👍" : "Одоогоор алга."}</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-3 max-w-[900px]">
          {[...groups.values()].map((list) => {
            const f = list[0];
            const a = f.ad;
            return (
              <li key={f.ad_id} className="card p-4 flex flex-col gap-3">
                <div className="flex gap-3 items-start">
                  <CarPhoto path={a?.photos[0]} alt="" className="w-[88px] h-[66px] rounded-lg shrink-0" label="IMG" />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    {a ? (
                      <Link href={`/manager/ads?id=${a.id}`} className="font-bold text-[15px] no-underline">{a.brand} {a.model} · {a.year_made}</Link>
                    ) : <span className="font-bold">Устгагдсан зар</span>}
                    {a && <span className="text-[13px] text-muted">{money(a.price)} · утас <span className="mono">{a.phone}</span> · {STATUS[a.status as keyof typeof STATUS]?.label ?? a.status}</span>}
                    <span className="text-[12px] font-semibold text-[#9b1c1c]">{list.length} гомдол</span>
                  </div>
                  {a && <Link href={`/ads/${a.id}`} target="_blank" className="btn btn-sm btn-ghost">Зар ↗</Link>}
                </div>
                <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
                  {list.map((x) => (
                    <li key={x.id} className="rounded-lg bg-paper px-3 py-2 text-[13px] flex flex-wrap gap-x-3 gap-y-1">
                      <strong>{REASON[x.reason] ?? x.reason}</strong>
                      {x.note && <span className="text-body">“{x.note}”</span>}
                      <span className="text-muted ml-auto">{x.reporter?.full_name ?? "Хэрэглэгч"}{x.reporter?.phone ? ` · ${x.reporter.phone}` : ""} · {timeAgo(x.created_at)}</span>
                      {x.status !== "open" && <span className="basis-full text-muted">→ {x.action ?? x.status} · {dateShort(x.resolved_at)}</span>}
                    </li>
                  ))}
                </ul>
                {f.status === "open" && (
                  <form action={resolveFlag} className="flex flex-wrap gap-2 items-center">
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="back" value={back} />
                    <input name="note" placeholder="Тэмдэглэл / эзэнд очих шалтгаан" className="input h-9 text-[13px] flex-[1_1_220px]" />
                    {a?.status === "active" && (
                      <ConfirmButton name="action" value="hide" message="Зарыг нууж, эзэнд нь мэдэгдэл илгээх үү?" className="btn btn-sm btn-danger">Зарыг нуух</ConfirmButton>
                    )}
                    <button name="action" value="resolve" className="btn btn-sm btn-ink">Зассан</button>
                    <button name="action" value="dismiss" className="btn btn-sm btn-ghost">Үндэслэлгүй</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}
