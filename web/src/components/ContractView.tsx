import { CONTRACT_TITLE, contractDate, contractSections, type ContractData } from "@/lib/contract";

/** Гэрээний текстийг дэлгэц дээр харуулах (PDF-тэй ижил агуулга). */
export function ContractView({ data }: { data: ContractData }) {
  return (
    <article className="flex flex-col gap-3 text-[14px] leading-relaxed text-body">
      <div className="text-center flex flex-col gap-1">
        <h3 className="m-0 text-[16px] font-bold text-ink">{CONTRACT_TITLE}</h3>
        <span className="text-[12px] text-muted">Улаанбаатар хот · {contractDate(data.date ?? new Date().toISOString())}</span>
      </div>
      {contractSections(data).map((s, i) => (
        <section key={i} className="flex flex-col gap-1">
          {s.heading && <h4 className="m-0 text-[14px] font-bold text-ink">{s.heading}</h4>}
          {s.lines.map((l, j) => (
            <p key={j} className={`m-0 ${l.trim().startsWith("•") ? "pl-4 font-semibold text-ink" : ""}`}>{l.trim()}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
