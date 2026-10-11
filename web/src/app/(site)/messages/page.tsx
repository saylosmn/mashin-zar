import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { money, timeAgo } from "@/lib/format";
import { CarPhoto } from "@/components/CarPhoto";
import type { ChatRow } from "@/lib/types";

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
    <main className="max-w-[860px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Чат</h1>
        <nav aria-label="Шүүлтүүр" className="flex gap-1.5">
          {tabs.map((t) => (
            <Link key={t.key} href={t.key === "all" ? "/messages" : `/messages?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
              className={`h-9 px-3.5 rounded-full flex items-center text-[13px] no-underline ${tab === t.key ? "bg-ink text-yellow font-semibold" : "bg-card border border-line-2"}`}>
              {t.label} {t.n}
            </Link>
          ))}
        </nav>
      </div>
      {error && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-4 py-3 text-[14px]">Уншиж чадсангүй: {error.message}</p>}
      {rows.length === 0 ? (
        <div className="card px-6 py-12 flex flex-col items-center gap-3 text-center">
          <span className="text-[40px]" aria-hidden>💬</span>
          <p className="m-0 text-[15px] text-body max-w-[380px]">Чат алга. Зарын хуудсан дээрх «Худалдагчтай чатлах» товчоор асуултаа илгээнэ үү.</p>
          <Link href="/" className="btn btn-lg btn-ink">Зарууд үзэх</Link>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className={`card p-3 flex items-center gap-3 no-underline hover:border-ink ${c.unread ? "border-ink" : ""}`}>
                <CarPhoto path={c.photo} alt="" className="w-[72px] h-[56px] rounded-lg shrink-0" label="IMG" />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-[15px] ${c.unread ? "font-bold" : "font-semibold"}`}>{c.other_name}</span>
                    <span className="text-[12px] text-muted shrink-0">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <span className="text-[12px] text-muted truncate">
                    {c.role === "buyer" ? "Авах" : "Зарах"} · {c.car}{c.price ? ` · ${money(c.price)}` : ""}{c.ad_status && c.ad_status !== "active" ? " · идэвхгүй" : ""}
                  </span>
                  <span className={`text-[13px] truncate ${c.unread ? "text-ink font-semibold" : "text-body"}`}>
                    {c.last_from_me ? "Та: " : ""}{c.last_message ?? ""}
                  </span>
                </div>
                {c.unread > 0 && (
                  <span className="mono min-w-6 h-6 px-1.5 rounded-full bg-[#ff7a1a] text-ink text-[12px] font-bold flex items-center justify-center shrink-0">{c.unread}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
