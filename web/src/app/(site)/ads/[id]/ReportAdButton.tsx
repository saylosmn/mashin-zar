"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { reportAd } from "../../actions";

export const FLAG_REASONS: { key: string; label: string }[] = [
  { key: "fake", label: "Хуурамч зар" },
  { key: "sold", label: "Аль хэдийн зарагдсан" },
  { key: "wrong_price", label: "Үнэ буруу" },
  { key: "wrong_info", label: "Мэдээлэл, зураг буруу" },
  { key: "scam", label: "Залилан, сэжигтэй" },
  { key: "other", label: "Бусад" },
];

/** Зарыг мэдээлэх товч ба цонх. Нэвтрээгүй бол нэвтрэх хуудас руу. */
export function ReportAdButton({ adId, loginHref }: { adId: string; loginHref: string | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (loginHref)
    return (
      <Link href={loginHref} className="text-[13px] text-muted underline self-start">⚑ Зарыг мэдээлэх</Link>
    );

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="text-[13px] text-muted underline self-start bg-transparent border-0 p-0 cursor-pointer">
        ⚑ Зарыг мэдээлэх
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="flag-title" className="fixed inset-0 z-50 bg-ink/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !pending && setOpen(false)}>
          <div className="bg-card w-full sm:max-w-[440px] rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3.5 pb-[max(env(safe-area-inset-bottom),20px)]" onClick={(e) => e.stopPropagation()}>
            <h2 id="flag-title" className="m-0 text-[18px] font-bold">Зарыг мэдээлэх</h2>
            {msg?.ok ? (
              <>
                <p className="m-0 text-[14px] text-body">✓ Баярлалаа. Менежер шалгаж, шаардлагатай бол арга хэмжээ авна.</p>
                <button type="button" className="btn btn-lg btn-ink" onClick={() => setOpen(false)}>Хаах</button>
              </>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reason) return setMsg({ ok: false, text: "Шалтгаанаа сонгоно уу" });
                  start(async () => {
                    const r = await reportAd(adId, reason, note);
                    setMsg(r.ok ? { ok: true, text: "" } : { ok: false, text: r.error ?? "Алдаа гарлаа" });
                  });
                }}
              >
                <fieldset className="border-0 p-0 m-0 flex flex-col gap-1.5">
                  <legend className="text-[13px] text-muted pb-1">Шалтгаан</legend>
                  {FLAG_REASONS.map((r) => (
                    <label key={r.key} className={`flex items-center gap-2.5 px-3 h-11 rounded-[10px] border text-[14px] cursor-pointer ${reason === r.key ? "border-ink bg-paper font-semibold" : "border-line-2"}`}>
                      <input type="radio" name="reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} className="accent-ink" />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="textarea" placeholder={reason === "other" ? "Шалтгаанаа бичнэ үү" : "Нэмэлт тайлбар (заавал биш)"} />
                {msg && !msg.ok && <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-3.5 py-2.5 text-[13px]">{msg.text}</p>}
                <div className="flex gap-2">
                  <button type="button" className="btn btn-lg btn-ghost flex-1" onClick={() => setOpen(false)} disabled={pending}>Болих</button>
                  <button className="btn btn-lg btn-ink flex-1" disabled={pending}>{pending ? "Илгээж байна…" : "Илгээх"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
