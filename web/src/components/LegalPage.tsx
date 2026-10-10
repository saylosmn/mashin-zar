import Link from "next/link";

export type LegalSection = { h: string; p: (string | string[])[] };

/** Үйлчилгээний нөхцөл, нууцлалын бодлогын нийтлэг загвар. Мөр нь массив бол жагсаалт. */
export function LegalPage({ title, updated, intro, sections, other }: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <main className="max-w-[780px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="h-display m-0 text-[clamp(24px,3vw,34px)]">{title}</h1>
        <span className="text-[13px] text-muted">Сүүлд шинэчилсэн: {updated}</span>
        <p className="m-0 text-[15px] leading-relaxed text-body">{intro}</p>
      </header>
      <nav aria-label="Агуулга" className="card p-4">
        <ol className="m-0 pl-5 grid gap-1 text-[14px] sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.h}><a href={`#s${i + 1}`} className="no-underline hover:underline">{s.h}</a></li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.h} id={`s${i + 1}`} className="flex flex-col gap-2.5 scroll-mt-6">
          <h2 className="m-0 text-[18px] font-bold">{i + 1}. {s.h}</h2>
          {s.p.map((x, j) =>
            Array.isArray(x) ? (
              <ul key={j} className="m-0 pl-5 flex flex-col gap-1.5 text-[15px] leading-relaxed text-[#2b2f35]">
                {x.map((li) => <li key={li}>{li}</li>)}
              </ul>
            ) : (
              <p key={j} className="m-0 text-[15px] leading-relaxed text-[#2b2f35]">{x}</p>
            ),
          )}
        </section>
      ))}
      <p className="m-0 text-[14px] text-muted border-t border-line pt-5">
        Мөн үзэх: <Link href={other.href}>{other.label}</Link>
      </p>
    </main>
  );
}

/** Холбоо барих мэдээлэл (Vercel орчны хувьсагчаас, байхгүй бол ерөнхий заавар) */
export function contactLine() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE;
  const parts = [email && `и-мэйл: ${email}`, phone && `утас: ${phone}`].filter(Boolean);
  return parts.length ? parts.join(", ") : "сайт болон апп-аар дамжуулан менежертэй холбогдоно уу";
}
