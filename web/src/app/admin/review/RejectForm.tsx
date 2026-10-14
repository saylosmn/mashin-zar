"use client";

import { useState } from "react";

const REASONS = ["Зураг тодорхойгүй", "Мэдээлэл дутуу", "Үнэ бодит бус", "Давхардсан зар", "Дугаар таарахгүй"];

/** Татгалзах шалтгаантай форм: эхлээд товч, дарахад шалтгаан сонгох хэсэг нээгдэнэ. */
export function RejectForm({ id, back, action }: { id: string; back: string; action: (fd: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <div className="flex-[1_1_160px] flex">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-lg btn-danger flex-1">Татгалзах</button>
      </div>
    );
  }

  function pick(r: string) {
    setNote((n) => {
      const parts = n.split(/\n|;\s*/).map((x) => x.trim()).filter(Boolean);
      return parts.includes(r) ? parts.filter((x) => x !== r).join("; ") : [...parts, r].join("; ");
    });
  }

  return (
    <form action={action} className="basis-full order-first rounded-2xl border-2 border-danger-line bg-danger-bg/40 p-4 flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <span className="font-bold text-[15px]">Татгалзах шалтгаан</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Түгээмэл шалтгаан">
        {REASONS.map((r) => {
          const on = note.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => pick(r)}
              className={`h-9 px-3 rounded-full text-[13px] cursor-pointer border ${on ? "bg-ink text-yellow border-ink font-semibold" : "bg-card border-line-2 text-ink"}`}
            >
              {r}
            </button>
          );
        })}
      </div>
      <label className="label">
        Хэрэглэгчид очих тайлбар
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Жишээ: Зураг бүдэг байна, өдрийн гэрэлд дахин авна уу."
          className="textarea min-h-[80px] font-normal"
        />
      </label>
      <div className="flex gap-2 flex-wrap justify-end">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Болих</button>
        <button className="btn btn-danger">Татгалзах</button>
      </div>
    </form>
  );
}
