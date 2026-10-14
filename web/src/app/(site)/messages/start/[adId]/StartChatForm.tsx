"use client";

import { useState, useTransition } from "react";
import { startChat } from "../../../actions";

const QUICK = [
  "Сайн байна уу, машин зарагдаагүй байна уу?",
  "Хэзээ, хаана үзэж болох вэ?",
  "Үнэ тохирох уу?",
  "Машин осолд орж байсан уу?",
];

export function StartChatForm({ adId }: { adId: string }) {
  const [text, setText] = useState(QUICK[0]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return setErr("Мессежээ бичнэ үү");
        start(async () => {
          setErr(null);
          const r = await startChat(adId, text.trim());
          if (r?.error) setErr(r.error);
        });
      }}
    >
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setText(q)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] ${text === q ? "border-ink bg-paper font-semibold" : "border-line-2 bg-card"}`}
          >
            {q}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={4}
        className="textarea"
        aria-label="Мессеж"
      />
      {err && (
        <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-2.5 text-[13px] text-[#9b1c1c]">
          {err}
        </p>
      )}
      <button className="btn btn-lg btn-yellow" disabled={pending}>
        {pending ? "Илгээж байна…" : "Илгээх"}
      </button>
    </form>
  );
}
