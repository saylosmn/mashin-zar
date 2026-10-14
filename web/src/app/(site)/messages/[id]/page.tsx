import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { money } from "@/lib/format";
import { CarPhoto } from "@/components/CarPhoto";
import { ChatThread } from "./ChatThread";
import type { ChatInfo, Message } from "@shared/types";

export const metadata = { title: "Чат" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await requireUser(`/messages/${id}`);
  const supabase = await createClient();
  const [{ data: infoRows }, { data: msgRows }] = await Promise.all([
    supabase.rpc("chat_info", { p_conv: id }),
    supabase.from("messages").select("*").eq("conversation_id", id).order("id", { ascending: false }).limit(300),
  ]);
  const info = (Array.isArray(infoRows) ? infoRows[0] : null) as ChatInfo | null;
  if (!info) notFound();
  const messages = ((msgRows ?? []) as Message[]).reverse();

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-0 pt-0 pb-0 sm:px-6 sm:pt-6 sm:pb-10">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:border-0 sm:px-0">
        <Link href="/messages" aria-label="Буцах" className="btn btn-ghost h-10 w-10 shrink-0 px-0">
          ←
        </Link>
        {info.ad_id ? (
          <Link href={`/ads/${info.ad_id}`} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
            <CarPhoto path={info.photo} alt="" className="h-[40px] w-[52px] shrink-0 rounded-md" label="IMG" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-bold">{info.other_name}</span>
              <span className="truncate text-[12px] text-muted">
                {info.car}
                {info.price ? ` · ${money(info.price)}` : ""}
              </span>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-bold">{info.other_name}</span>
            <span className="truncate text-[12px] text-muted">{info.car} · зар устгагдсан</span>
          </div>
        )}
      </div>
      <ChatThread
        convId={info.id}
        me={me.id}
        messages={messages}
        canWrite={info.role !== "staff"}
        otherName={info.other_name}
      />
    </main>
  );
}
