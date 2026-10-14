import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { STATUS, dateShort, money, timeAgo } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { CarPhoto } from "@/components/CarPhoto";
import { ConfirmButton } from "@/components/ConfirmButton";
import { resolveFlag } from "@/actions/ads";

export const metadata = { title: "Админ · Гомдол" };

const REASON: Record<string, string> = {
  fake: "Хуурамч зар",
  sold: "Аль хэдийн зарагдсан",
  wrong_price: "Үнэ буруу",
  wrong_info: "Мэдээлэл буруу",
  scam: "Залилан",
  other: "Бусад",
};

type Flag = {
  id: string;
  ad_id: string;
  reason: string;
  note: string | null;
  status: "open" | "resolved" | "dismissed";
  action: string | null;
  created_at: string;
  resolved_at: string | null;
  ad: {
    id: string;
    brand: string;
    model: string;
    year_made: number;
    price: number;
    photos: string[];
    status: string;
    phone: string;
  } | null;
  reporter: { full_name: string | null; phone: string | null } | null;
};

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const tab = sp.tab === "closed" ? "closed" : "open";
  let q = supabase
    .from("ad_flags")
    .select(
      "*, ad:ads(id,brand,model,year_made,price,photos,status,phone), reporter:profiles!ad_flags_user_id_fkey(full_name,phone)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  q = tab === "open" ? q.eq("status", "open") : q.neq("status", "open");
  const [pending, { data, error }] = await Promise.all([pendingCount(), q]);
  const flags = (data ?? []) as unknown as Flag[];
  // Нэг зарын олон гомдлыг бүлэглэнэ
  const groups = new Map<string, Flag[]>();
  for (const f of flags) groups.set(f.ad_id, [...(groups.get(f.ad_id) ?? []), f]);
  const back = `/admin/flags${tab === "closed" ? "?tab=closed" : ""}`;

  return (
    <PanelShell profile={me} area="admin" active="admin-flags" pending={pending}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h-display m-0 text-[28px]">Гомдол</h1>
          <span className="text-[14px] text-muted">
            Хэрэглэгчдийн мэдээлсэн зарууд. Шалгаад нууж, эсвэл гомдлыг хаана.
          </span>
        </div>
        <nav className="flex gap-1.5" aria-label="Шүүлтүүр">
          <Link
            href="/admin/flags"
            className={`flex h-9 items-center rounded-full px-3.5 text-[13px] no-underline ${tab === "open" ? "bg-ink font-semibold text-yellow" : "border border-line-2 bg-card"}`}
          >
            Шийдвэрлээгүй
          </Link>
          <Link
            href="/admin/flags?tab=closed"
            className={`flex h-9 items-center rounded-full px-3.5 text-[13px] no-underline ${tab === "closed" ? "bg-ink font-semibold text-yellow" : "border border-line-2 bg-card"}`}
          >
            Шийдвэрлэсэн
          </Link>
        </nav>
      </div>
      <Flash ok={sp.ok} err={sp.err ?? (error ? `Уншиж чадсангүй: ${error.message}` : undefined)} />
      {groups.size === 0 ? (
        <p className="card m-0 max-w-[900px] px-5 py-10 text-center text-[14px] text-muted">
          {tab === "open" ? "Шийдвэрлэх гомдол алга 👍" : "Одоогоор алга."}
        </p>
      ) : (
        <ul className="m-0 flex max-w-[900px] list-none flex-col gap-3 p-0">
          {[...groups.values()].map((list) => {
            const f = list[0];
            const a = f.ad;
            return (
              <li key={f.ad_id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <CarPhoto path={a?.photos[0]} alt="" className="h-[66px] w-[88px] shrink-0 rounded-lg" label="IMG" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {a ? (
                      <Link href={`/admin/review?id=${a.id}`} className="text-[15px] font-bold no-underline">
                        {a.brand} {a.model} · {a.year_made}
                      </Link>
                    ) : (
                      <span className="font-bold">Устгагдсан зар</span>
                    )}
                    {a && (
                      <span className="text-[13px] text-muted">
                        {money(a.price)} · утас <span className="mono">{a.phone}</span> ·{" "}
                        {STATUS[a.status as keyof typeof STATUS]?.label ?? a.status}
                      </span>
                    )}
                    <span className="text-[12px] font-semibold text-[#9b1c1c]">{list.length} гомдол</span>
                  </div>
                  {a && (
                    <Link href={`/ads/${a.id}`} target="_blank" className="btn btn-sm btn-ghost">
                      Зар ↗
                    </Link>
                  )}
                </div>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {list.map((x) => (
                    <li key={x.id} className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-paper px-3 py-2 text-[13px]">
                      <strong>{REASON[x.reason] ?? x.reason}</strong>
                      {x.note && <span className="text-body">“{x.note}”</span>}
                      <span className="ml-auto text-muted">
                        {x.reporter?.full_name ?? "Хэрэглэгч"}
                        {x.reporter?.phone ? ` · ${x.reporter.phone}` : ""} · {timeAgo(x.created_at)}
                      </span>
                      {x.status !== "open" && (
                        <span className="basis-full text-muted">
                          → {x.action ?? x.status} · {dateShort(x.resolved_at)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {f.status === "open" && (
                  <form action={resolveFlag} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="back" value={back} />
                    <input
                      name="note"
                      placeholder="Тэмдэглэл / эзэнд очих шалтгаан"
                      className="input h-9 flex-[1_1_220px] text-[13px]"
                    />
                    {a?.status === "active" && (
                      <ConfirmButton
                        name="action"
                        value="hide"
                        message="Зарыг нууж, эзэнд нь мэдэгдэл илгээх үү?"
                        className="btn btn-sm btn-danger"
                      >
                        Зарыг нуух
                      </ConfirmButton>
                    )}
                    <button name="action" value="resolve" className="btn btn-sm btn-ink">
                      Зассан
                    </button>
                    <button name="action" value="dismiss" className="btn btn-sm btn-ghost">
                      Үндэслэлгүй
                    </button>
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
