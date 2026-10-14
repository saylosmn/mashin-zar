"use client";

import { useMemo, useState } from "react";
import { OPTION_GROUPS } from "@shared/cars";

/** Машины опшн сонгох: хайлт + бүлгүүд + өөрийн опшн нэмэх */
export function OptionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(OPTION_GROUPS[0].title);
  const [custom, setCustom] = useState("");
  const known = useMemo(() => new Set(OPTION_GROUPS.flatMap((g) => g.items)), []);
  const extra = value.filter((v) => !known.has(v));
  const term = q.trim().toLowerCase();
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const addCustom = () => {
    const c = custom.trim();
    if (c && !value.includes(c)) onChange([...value, c]);
    setCustom("");
  };

  const Chip = ({ o }: { o: string }) => {
    const on = value.includes(o);
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => toggle(o)}
        className={`h-9 cursor-pointer rounded-full border px-3 text-[13px] ${on ? "border-ink bg-ink text-paper" : "border-line-2 bg-card text-ink hover:border-ink"}`}
      >
        {on ? "✓ " : ""}
        {o}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Опшн хайх (жишээ: камер, люк)"
          className="input h-10 flex-[1_1_220px]"
          aria-label="Опшн хайх"
        />
        <span className="text-[13px] text-muted">{value.length} сонгосон</span>
      </div>

      {term ? (
        <div className="flex flex-wrap gap-2">
          {OPTION_GROUPS.flatMap((g) => g.items)
            .filter((o) => o.toLowerCase().includes(term))
            .map((o) => (
              <Chip key={o} o={o} />
            ))}
          {!OPTION_GROUPS.some((g) => g.items.some((o) => o.toLowerCase().includes(term))) && (
            <span className="text-[13px] text-muted">Олдсонгүй — доороос өөрөө нэмж болно.</span>
          )}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line">
          {OPTION_GROUPS.map((g) => {
            const n = g.items.filter((o) => value.includes(o)).length;
            const isOpen = open === g.title;
            return (
              <div key={g.title}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : g.title)}
                  className="flex h-11 w-full cursor-pointer items-center justify-between border-0 bg-card px-4 text-[14px] font-semibold"
                >
                  <span>
                    {g.title} <span className="font-normal text-muted">· {g.items.length}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {n > 0 && (
                      <span className="mono rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-yellow">
                        {n}
                      </span>
                    )}
                    <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-wrap gap-2 bg-card px-4 pt-1 pb-4">
                    {g.items.map((o) => (
                      <Chip key={o} o={o} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {extra.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {extra.map((o) => (
            <Chip key={o} o={o} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="+ Жагсаалтад байхгүй опшн"
          className="input h-10 flex-[1_1_220px]"
        />
        <button type="button" onClick={addCustom} className="btn btn-ghost h-10">
          Нэмэх
        </button>
      </div>
    </div>
  );
}
