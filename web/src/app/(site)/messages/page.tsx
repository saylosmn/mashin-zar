import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { money, timeAgo } from "@/lib/format";
import { CarPhoto } from "@/components/CarPhoto";
import type { ChatRow } from "@shared/types";

export const metadata = { title: "Чат" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  await requireUser("/messages");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_chats");
  const all = (data ?? []) as ChatRow[];
  const tab = sp.tab === "buying" || sp.tab === "selling" ? sp.tab : "all";
  const rows = all.filter((c) => tab === "all" || (tab === "buying" ? c.role === "buyer" : c.role === "seller"));
  const tabs = [
    { key: "all", label: "Бүгд", n: all.length },
    { key: "buying", label: "Авах", n: all.filter((c) => c.role === "buyer").length },
    { key: "selling", label: "Зарах", n: all.filter((c) => c.role === "seller").length },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Чат</h1>
        <nav aria-label="Шүүлтүүр" className="flex gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "all" ? "/messages" : `/messages?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex h-9 items-center rounded-full px-3.5 text-[13px] no-underline ${tab === t.key ? "bg-ink font-semibold text-yellow" : "border border-line-2 bg-card"}`}
            >
              {t.label} {t.n}
            </Link>
          ))}
        </nav>
      </div>
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-danger-bg px-4 py-3 text-[14px] text-[#9b1c1c]">
          Уншиж чадсангүй: {error.message}
        </p>
      )}
      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="text-[40px]" aria-hidden>
            💬
          </span>
          <p className="m-0 max-w-[380px] text-[15px] text-body">
            Чат алга. Зарын хуудсан дээрх «Худалдагчтай чатлах» товчоор асуултаа илгээнэ үү.
          </p>
          <Link href="/" className="btn btn-lg btn-ink">
            Зарууд үзэх
          </Link>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className={`card flex items-center gap-3 p-3 no-underline hover:border-ink ${c.unread ? "border-ink" : ""}`}
              >
                <CarPhoto path={c.photo} alt="" className="h-[56px] w-[72px] shrink-0 rounded-lg" label="IMG" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-[15px] ${c.unread ? "font-bold" : "font-semibold"}`}>
                      {c.other_name}
                    </span>
                    <span className="shrink-0 text-[12px] text-muted">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <span className="truncate text-[12px] text-muted">
                    {c.role === "buyer" ? "Авах" : "Зарах"} · {c.car}
                    {c.price ? ` · ${money(c.price)}` : ""}
                    {c.ad_status && c.ad_status !== "active" ? " · идэвхгүй" : ""}
                  </span>
                  <span className={`truncate text-[13px] ${c.unread ? "font-semibold text-ink" : "text-body"}`}>
                    {c.last_from_me ? "Та: " : ""}
                    {c.last_message ?? ""}
                  </span>
                </div>
                {c.unread > 0 && (
                  <span className="mono flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[#ff7a1a] px-1.5 text-[12px] font-bold text-ink">
                    {c.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
