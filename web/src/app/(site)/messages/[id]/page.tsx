import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { money } from "@/lib/format";
import { CarPhoto } from "@/components/CarPhoto";
import { ChatThread } from "./ChatThread";
import type { ChatInfo, Message } from "@/lib/types";

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
    <main className="max-w-[760px] w-full mx-auto px-0 sm:px-6 pt-0 sm:pt-6 pb-0 sm:pb-10 flex flex-col flex-1">
      <div className="flex items-center gap-3 px-4 sm:px-0 py-3 border-b border-line sm:border-0">
        <Link href="/messages" aria-label="Буцах" className="btn btn-ghost w-10 h-10 px-0 shrink-0">←</Link>
        {info.ad_id ? (
          <Link href={`/ads/${info.ad_id}`} className="flex items-center gap-3 no-underline min-w-0 flex-1">
            <CarPhoto path={info.photo} alt="" className="w-[52px] h-[40px] rounded-md shrink-0" label="IMG" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[15px] truncate">{info.other_name}</span>
              <span className="text-[12px] text-muted truncate">{info.car}{info.price ? ` · ${money(info.price)}` : ""}</span>
            </div>
          </Link>
        ) : (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-bold text-[15px] truncate">{info.other_name}</span>
            <span className="text-[12px] text-muted truncate">{info.car} · зар устгагдсан</span>
          </div>
        )}
      </div>
      <ChatThread convId={info.id} me={me.id} messages={messages} canWrite={info.role !== "staff"} otherName={info.other_name} />
    </main>
  );
}
