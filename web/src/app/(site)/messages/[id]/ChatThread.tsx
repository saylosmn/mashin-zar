"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dayLabel, timeHM } from "@shared/chat";
import type { Message } from "@shared/types";

/**
 * Мессежийн жагсаалт + бичих талбар. Шинэ мессеж ирэхэд LiveSync (хувийн суваг u:<id>) хуудсыг
 * refresh хийж, энэ компонент шинэ messages-ийг авна.
 */
export function ChatThread({
  convId,
  me,
  messages,
  canWrite,
  otherName,
}: {
  convId: string;
  me: string;
  messages: Message[];
  canWrite: boolean;
  otherName: string;
}) {
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
    if (canWrite)
      void createClient()
        .rpc("mark_chat_read", { p_conv: convId })
        .then(
          () => {},
          () => {},
        );
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
    <div className="flex min-h-[60dvh] flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-4 sm:px-0">
        {messages.length === 0 && (
          <p className="m-auto text-[14px] text-muted">{otherName}-д анхны мессежээ бичээрэй.</p>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === me;
          const day = days[i];
          const showDay = i === 0 || day !== days[i - 1];
          return (
            <div key={m.id} className="flex flex-col">
              {showDay && (
                <span className="my-2 self-center rounded-full bg-soft px-2.5 py-0.5 text-[11px] text-muted">
                  {day}
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap ${mine ? "self-end rounded-br-md bg-ink text-paper" : "self-start rounded-bl-md border border-line bg-card"}`}
              >
                {m.body}
                <span className={`mt-0.5 block text-right text-[10px] ${mine ? "text-pale" : "text-muted"}`}>
                  {timeHM(m.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        {pendingText && (
          <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-ink/70 px-3.5 py-2 text-[15px] break-words whitespace-pre-wrap text-paper">
            {pendingText}
          </div>
        )}
        <div ref={end} />
      </div>
      {canWrite ? (
        <form
          className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-paper px-3 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)] sm:px-0"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {err && (
            <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-2 text-[13px] text-[#9b1c1c]">
              {err}
            </p>
          )}
          <div className="flex items-end gap-2">
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
              className="textarea max-h-[140px] min-h-[46px] flex-1 py-3"
            />
            <button className="btn btn-yellow h-[46px] px-4" disabled={!text.trim() || sending} aria-label="Илгээх">
              Илгээх
            </button>
          </div>
        </form>
      ) : (
        <p className="m-0 border-t border-line px-4 py-3 text-[13px] text-muted">
          Та энэ чатыг админы эрхээр харж байна (бичих боломжгүй).
        </p>
      )}
    </div>
  );
}
