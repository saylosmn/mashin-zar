"use client";

import { IconCheck } from "@/components/icons";

export function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 text-[17px] font-bold">{children}</h2>;
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-3 [&>*]:flex-[1_1_220px]">{children}</div>;
}

export function Field({
  label,
  hint,
  group,
  children,
}: {
  label: string;
  hint?: string;
  /** Товчнуудын бүлэг: <label> дотор байвал шошгон дээр дарахад эхний товч дарагддаг тул div болгоно */
  group?: boolean;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      {label}
      {children}
      {hint && <span className="text-[12px] font-normal text-muted">{hint}</span>}
    </>
  );
  return group ? (
    <div className="label text-[13px]" role="group" aria-label={label}>
      {inner}
    </div>
  ) : (
    <label className="label text-[13px]">{inner}</label>
  );
}

const chip = (on: boolean) =>
  `h-10 rounded-full px-4 text-[14px] ${on ? "bg-ink font-semibold text-yellow" : "border border-line-2 bg-card"}`;

export function Chips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {Object.entries(options).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={chip(value === key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`${chip(value === v)} px-5`}
        >
          {v ? "Тийм" : "Үгүй"}
        </button>
      ))}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "warn" | "error"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-active-bg text-active-fg"
      : tone === "warn"
        ? "bg-pending-bg text-pending-fg"
        : "bg-danger-bg text-[#9b1c1c]";
  return (
    <p role={tone === "error" ? "alert" : undefined} className={`m-0 rounded-xl px-4 py-3 text-[14px] ${cls}`}>
      {children}
    </p>
  );
}

export function Summary({ items }: { items: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl bg-ink p-4 text-[13px] text-paper sm:grid-cols-4">
      {items.map((x) => (
        <div key={x.label} className="flex min-w-0 flex-col gap-0.5">
          <span className="text-pale">{x.label}</span>
          <span className={`truncate font-bold ${x.strong ? "text-[16px] text-yellow" : ""}`}>{x.value}</span>
        </div>
      ))}
    </div>
  );
}

export function StepList({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="m-0 flex list-none gap-1.5 overflow-x-auto p-0" aria-label="Алхам">
      {steps.map((t, i) => (
        <li
          key={t}
          aria-current={i === current ? "step" : undefined}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] ${
            i === current
              ? "bg-ink font-semibold text-yellow"
              : i < current
                ? "bg-active-bg text-active-fg"
                : "border border-line-2 bg-card text-muted"
          }`}
        >
          {i < current ? <IconCheck size={14} /> : <span className="mono">{i + 1}</span>} {t}
        </li>
      ))}
    </ol>
  );
}
