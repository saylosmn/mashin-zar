import { num, timeAgo } from "@/lib/format";
import { EMPLOYMENT, MARITAL, docLabel, type LoanRequest } from "@/lib/loan";

export function Cell({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${strong ? "bg-ink text-paper" : "bg-paper"}`}>
      <div className={`text-[11px] ${strong ? "text-pale" : "text-muted"}`}>{k}</div>
      <div className={`font-bold ${strong ? "text-yellow" : ""}`}>{v}</div>
    </div>
  );
}

export function ApplicantDetails({ r }: { r: LoanRequest }) {
  const a = r.applicant!;
  const m = (n?: number) => (n == null ? "—" : `${num(n)}₮`);
  const rows: [string, string][] = [
    ["Регистр", `${a.register_no ?? "—"}${a.age != null ? ` · ${a.age} нас` : ""}`],
    ["Хаяг", [a.city, a.district, a.address].filter(Boolean).join(", ") || "—"],
    [
      "Гэр бүл",
      `${a.marital_status ? (MARITAL[a.marital_status] ?? a.marital_status) : "—"} · ам бүл ${a.household_size ?? "—"}`,
    ],
    ["Орлогын эх үүсвэр", a.employment_type ? (EMPLOYMENT[a.employment_type] ?? a.employment_type) : "—"],
    ["Ажлын газар", [a.employer, a.position].filter(Boolean).join(" · ") || "—"],
    ["Ажилласан", a.work_months != null ? `${a.work_months} сар` : "—"],
    ["Сарын орлого", m(a.monthly_income)],
    ["Бусад орлого", m(a.other_income)],
    ["Бусад зээлийн төлбөр", m(a.existing_debt_payment)],
    ["Өр/орлогын харьцаа", r.dti != null ? `${Number(r.dti)}%` : "—"],
    ["Хугацаа хэтэрсэн зээл", a.has_overdue == null ? "—" : a.has_overdue ? "Байгаа" : "Байхгүй"],
    ["Жолооны үнэмлэх", a.has_license == null ? "—" : a.has_license ? "Байгаа" : "Байхгүй"],
    [
      "Холбоо барих хүн",
      a.ref_name ? `${a.ref_name}${a.ref_relation ? ` (${a.ref_relation})` : ""} · ${a.ref_phone ?? ""}` : "—",
    ],
  ];
  if (a.cosigner)
    rows.push([
      "Хамтран зээлдэгч",
      `${a.cosigner.name}${a.cosigner.relation ? ` (${a.cosigner.relation})` : ""} · ${a.cosigner.phone}${a.cosigner.register_no ? ` · ${a.cosigner.register_no}` : ""} · орлого ${m(a.cosigner.monthly_income)}`,
    ]);
  return (
    <details className="rounded-lg border border-line px-3 py-2">
      <summary className="cursor-pointer text-[13px] font-semibold">Анкет харах</summary>
      <dl className="m-0 mt-2 grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-[200px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="m-0 font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export type LoanEvent = {
  actor_name: string | null;
  kind: "submitted" | "status" | "doc_view" | "cancelled";
  detail: string | null;
  created_at: string;
};

const STATUS_WORD: Record<string, string> = {
  new: "Шинэ",
  contacted: "Холбогдсон",
  approved: "Зөвшөөрсөн",
  rejected: "Татгалзсан",
  cancelled: "Цуцалсан",
};

export function History({ events }: { events: LoanEvent[] }) {
  const views = events.filter((e) => e.kind === "doc_view").length;
  const text = (e: LoanEvent) => {
    if (e.kind === "submitted") return "Хүсэлт илгээсэн";
    if (e.kind === "cancelled") return "Худалдан авагч цуцалсан";
    if (e.kind === "doc_view") return `Баримт нээсэн: ${docLabel(e.detail ?? "")}`;
    const [st, ...note] = (e.detail ?? "").split(": ");
    const [from, to] = st.split(" → ");
    return `Төлөв: ${STATUS_WORD[from] ?? from} → ${STATUS_WORD[to] ?? to}${note.length ? ` · “${note.join(": ")}”` : ""}`;
  };
  return (
    <details className="rounded-lg border border-line px-3 py-2">
      <summary className="cursor-pointer text-[13px] font-semibold">
        Түүх · {events.length} үйлдэл{views ? ` · баримт ${views} удаа нээсэн` : ""}
      </summary>
      <ol className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[13px]">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-[92px] shrink-0 text-muted">{timeAgo(e.created_at)}</span>
            <span className="min-w-0">
              <strong>{e.actor_name ?? "—"}</strong> · {text(e)}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
