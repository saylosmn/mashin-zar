"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dayLabel, timeHM } from "@/lib/chat";
import type { Message } from "@/lib/types";

/**
 * Мессежийн жагсаалт + бичих талбар. Шинэ мессеж ирэхэд LiveSync (хувийн суваг u:<id>) хуудсыг
 * refresh хийж, энэ компонент шинэ messages-ийг авна.
 */
export function ChatThread({ convId, me, messages, canWrite, otherName }: { convId: string; me: string; messages: Message[]; canWrite: boolean; otherName: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id ?? 0;

  // Шинэ мессеж бүрт доош гүйлгэж, уншсан гэж тэмдэглэнэ
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    if (canWrite) void createClient().rpc("mark_chat_read", { p_conv: convId }).then(() => {}, () => {});
  }, [lastId, convId, canWrite]);

  // Realtime ажиллахгүй үед (сүлжээ) 20 секунд тутам шалгана
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 20000);
    return () => clearInterval(t);
  }, [router]);

  function send() {
    const body = text.trim();
    if (!body || sending) return;
    setErr(null);
    setPendingText(body);
    setText("");
    start(async () => {
      const { error } = await createClient().rpc("send_message", { p_conv: convId, p_body: body });
      if (error) {
        setErr(error.message);
        setText(body);
      }
      setPendingText(null);
      router.refresh();
    });
  }

  const days = messages.map((m) => dayLabel(m.created_at));
  return (
    <div className="flex flex-col flex-1 min-h-[60dvh]">
      <div className="flex-1 flex flex-col gap-1.5 px-4 sm:px-0 py-4 overflow-y-auto">
        {messages.length === 0 && <p className="m-auto text-[14px] text-muted">{otherName}-д анхны мессежээ бичээрэй.</p>}
        {messages.map((m, i) => {
          const mine = m.sender_id === me;
          const day = days[i];
          const showDay = i === 0 || day !== days[i - 1];
          return (
            <div key={m.id} className="flex flex-col">
              {showDay && <span className="self-center text-[11px] text-muted bg-soft rounded-full px-2.5 py-0.5 my-2">{day}</span>}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words ${mine ? "self-end bg-ink text-paper rounded-br-md" : "self-start bg-card border border-line rounded-bl-md"}`}>
                {m.body}
                <span className={`block text-right text-[10px] mt-0.5 ${mine ? "text-pale" : "text-muted"}`}>{timeHM(m.created_at)}</span>
              </div>
            </div>
          );
        })}
        {pendingText && (
          <div className="max-w-[80%] self-end rounded-2xl rounded-br-md px-3.5 py-2 text-[15px] bg-ink/70 text-paper whitespace-pre-wrap break-words">{pendingText}</div>
        )}
        <div ref={end} />
      </div>
      {canWrite ? (
        <form
          className="sticky bottom-0 bg-paper border-t border-line px-3 sm:px-0 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)] flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {err && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-3.5 py-2 text-[13px]">{err}</p>}
          <div className="flex gap-2 items-end">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Мессеж бичих…"
              aria-label="Мессеж"
              className="textarea flex-1 min-h-[46px] max-h-[140px] py-3"
            />
            <button className="btn btn-yellow h-[46px] px-4" disabled={!text.trim() || sending} aria-label="Илгээх">Илгээх</button>
          </div>
        </form>
      ) : (
        <p className="m-0 text-[13px] text-muted px-4 py-3 border-t border-line">Та энэ чатыг админы эрхээр харж байна (бичих боломжгүй).</p>
      )}
    </div>
  );
}
