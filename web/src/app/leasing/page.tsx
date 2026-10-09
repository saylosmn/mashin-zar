import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireLeasing } from "@/lib/data";
import { dateShort, num, timeAgo } from "@/lib/format";
import { DEFAULT_REQUIRED_DOCS, EMPLOYMENT, LOAN_DOCS, LOAN_STATUS, MARITAL, docLabel, type LoanRequest, type LoanStatus, type Partner } from "@/lib/loan";
import { Flash, Kpi, PanelShell } from "@/components/PanelShell";
import { savePartnerTerms, updateLoanRequest } from "../panel-actions";

export const metadata = { title: "Лизингийн панел" };

const TABS: { key: LoanStatus | "all"; label: string }[] = [
  { key: "new", label: "Шинэ" },
  { key: "contacted", label: "Холбогдсон" },
  { key: "approved", label: "Зөвшөөрсөн" },
  { key: "rejected", label: "Татгалзсан" },
  { key: "all", label: "Бүгд" },
];

export default async function LeasingPanel({ searchParams }: { searchParams: Promise<{ tab?: string; partner?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireLeasing();
  const supabase = await createClient();
  const isAdmin = me.role === "admin";

  const { data: partnerRows } = await supabase.from("leasing_partners").select("*").order("name");
  const partners = (partnerRows ?? []) as Partner[];
  const partner = isAdmin ? partners.find((p) => p.id === sp.partner) ?? partners[0] : partners.find((p) => p.id === me.partner_id);

  if (!partner)
    return (
      <PanelShell profile={me} area="leasing" active="leasing">
        <h1 className="h-display m-0 text-[28px]">Лизингийн панел</h1>
        <p className="m-0 card p-5 text-[14px] text-body">
          {isAdmin ? <>Лизингийн компани бүртгэгдээгүй байна. <Link href="/admin/leasing">Админ → Лизинг</Link> хэсгээс нэмнэ үү.</> : "Таны аккаунт лизингийн компанитай холбогдоогүй байна. Админтай холбогдоно уу."}
        </p>
      </PanelShell>
    );

  const tab = sp.tab === "terms" ? "terms" : TABS.some((t) => t.key === sp.tab) ? (sp.tab as LoanStatus | "all") : "new";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let q = supabase.from("loan_requests").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(200);
  if (tab !== "all" && tab !== "terms") q = q.eq("status", tab);
  const [list, all] = await Promise.all([
    q,
    supabase.from("loan_requests").select("status,price,down_payment,created_at").eq("partner_id", partner.id),
  ]);
  const rows = (list.data ?? []) as LoanRequest[];
  // Баримтын түр холбоос (1 цаг) — RLS: зөвхөн энэ компанид ирсэн хүсэлтийн файл
  const paths = tab === "terms" ? [] : rows.flatMap((r) => Object.values(r.docs ?? {}));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("loan-docs").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const stats = (all.data ?? []) as { status: LoanStatus; price: number; down_payment: number; created_at: string }[];
  const month = stats.filter((r) => r.created_at >= monthStart);
  const approved = stats.filter((r) => r.status === "approved");
  const decided = stats.filter((r) => r.status === "approved" || r.status === "rejected").length;
  const count = (k: LoanStatus) => stats.filter((r) => r.status === k).length;
  const trialDays = partner.trial_until ? Math.ceil((new Date(partner.trial_until).getTime() - now.getTime()) / 864e5) : null;
  const q2 = isAdmin ? `&partner=${partner.id}` : "";
  const back = `/leasing?tab=${tab}${q2}`;

  return (
    <PanelShell profile={me} area="leasing" active={tab === "terms" ? "leasing-terms" : "leasing"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h-display m-0 text-[28px]">{partner.name}</h1>
          <span className="text-[14px] text-muted">Машин зарын худалдан авагчдын лизингийн хүсэлтүүд</span>
        </div>
        {isAdmin && partners.length > 1 && (
          <form className="flex gap-2 items-center">
            <input type="hidden" name="tab" value={tab} />
            <select name="partner" defaultValue={partner.id} className="input h-10">
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn btn-ghost h-10">Харах</button>
          </form>
        )}
      </div>
      {trialDays !== null && (
        <p className={`m-0 rounded-xl px-4 py-3 text-[14px] ${trialDays > 0 ? "bg-ink text-paper" : "bg-danger-bg text-[#9b1c1c]"}`}>
          {trialDays > 0 ? <>🎁 Туршилтын хугацаа: <strong className="text-yellow">{trialDays} хоног</strong> үлдсэн ({dateShort(partner.trial_until)} хүртэл) — үнэгүй.</> : "Туршилтын хугацаа дууссан. Үргэлжлүүлэх нөхцөлийг админтай тохирно уу."}
        </p>
      )}
      <Flash ok={sp.ok} err={sp.err ?? (list.error ? `Хүсэлт уншиж чадсангүй: ${list.error.message}` : undefined)} />

      <div className="grid gap-3.5 grid-cols-2 md:grid-cols-4 max-w-[1000px]">
        <Kpi dark label="Шинэ хүсэлт" value={count("new")} href={`/leasing?tab=new${q2}`} />
        <Kpi label="Энэ сарын хүсэлт" value={month.length} sub={`${num(month.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮ зээл`} />
        <Kpi label="Зөвшөөрсөн" value={approved.length} sub={`${num(approved.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮`} />
        <Kpi label="Хөрвөлт" value={decided ? `${Math.round((approved.length / decided) * 100)}%` : "—"} sub="Шийдвэрлэснээс зөвшөөрсөн" />
      </div>

      {tab === "terms" ? (
        <section className="card p-5 flex flex-col gap-3.5 max-w-[960px]">
          <h2 className="m-0 text-[17px] font-bold">Нөхцөл ба шаардлага</h2>
          <span className="text-[14px] text-muted">Зарын хуудсан дээрх тооцоолуур, хүсэлтийн анкет энэ тохиргоог ашиглана. Хүсэлт бүрийг систем эдгээр шаардлагатай тулгаж ✓/✗ гэж харуулна.</span>
          <form action={savePartnerTerms} className="flex flex-col gap-5">
            <input type="hidden" name="back" value={`/leasing?tab=terms${q2}`} />
            <input type="hidden" name="partner_id" value={partner.id} />
            <fieldset className="flex flex-wrap gap-3 items-end border-0 p-0 m-0">
              <legend className="text-[14px] font-semibold mb-2">Зээлийн нөхцөл</legend>
              <NumField name="rate" label="Жилийн хүү (%)" value={Number(partner.rate_annual)} step="0.1" />
              <NumField name="min_down" label="Хамгийн бага урьдчилгаа (%)" value={Number(partner.min_down_pct)} />
              <NumField name="max_term" label="Хамгийн урт хугацаа (сар)" value={partner.max_term_months} />
            </fieldset>
            <fieldset className="flex flex-wrap gap-3 items-end border-0 p-0 m-0">
              <legend className="text-[14px] font-semibold mb-2">Зээлдэгчид тавих шаардлага</legend>
              <NumField name="min_age" label="Доод нас" value={partner.min_age ?? 18} />
              <NumField name="max_age" label="Дээд нас" value={partner.max_age ?? 65} />
              <NumField name="min_work" label="Ажилласан (сар)" value={partner.min_work_months ?? 6} />
              <NumField name="min_business" label="Бизнес эрхэлсэн (сар)" value={partner.min_business_months ?? 12} />
              <NumField name="max_dti" label="Өр/орлогын харьцаа ≤ (%)" value={Number(partner.max_dti ?? 50)} step="0.1" />
              <NumField name="min_car_year" label="Машин хамгийн багадаа (он)" value={partner.min_car_year ?? ""} placeholder="Хязгааргүй" />
              <NumField name="cosigner_over" label="Хамтран зээлдэгч шаардах зээл (₮-өөс дээш)" value={partner.cosigner_over ?? ""} placeholder="Шаардахгүй" wide />
            </fieldset>
            <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
              <legend className="text-[14px] font-semibold mb-2">Заавал хавсаргах баримт</legend>
              <div className="grid sm:grid-cols-2 gap-2">
                {LOAN_DOCS.map((d) => (
                  <label key={d.kind} className="flex items-center gap-2 text-[14px] rounded-lg bg-paper px-3 py-2 cursor-pointer">
                    <input type="checkbox" name="required_docs" value={d.kind} defaultChecked={(partner.required_docs ?? DEFAULT_REQUIRED_DOCS).includes(d.kind)} className="w-4 h-4 accent-[#111317]" /> {d.label}
                  </label>
                ))}
              </div>
              <span className="text-[12px] text-muted">Тэмдэглээгүй баримтыг худалдан авагч хүсвэл хавсаргана.</span>
            </fieldset>
            <label className="label text-[14px]">Нэмэлт шаардлага (худалдан авагчид харагдана)
              <textarea name="requirements_note" defaultValue={partner.requirements_note ?? ""} rows={3} className="textarea" placeholder="Жишээ: 100% даатгал заавал, барьцаанд зөвхөн тухайн машин" />
            </label>
            <button className="btn btn-ink h-12 self-start">Хадгалах</button>
          </form>
        </section>
      ) : (
        <>
          <nav className="flex flex-wrap gap-1.5" aria-label="Шүүлтүүр">
            {TABS.map((t) => (
              <Link key={t.key} href={`/leasing?tab=${t.key}${q2}`} className={`h-9 px-3.5 rounded-full flex items-center text-[13px] no-underline ${t.key === tab ? "bg-ink text-yellow font-semibold" : "bg-card border border-line-2 text-ink"}`}>
                {t.label}{t.key !== "all" ? ` · ${count(t.key)}` : ""}
              </Link>
            ))}
          </nav>
          {rows.length === 0 ? (
            <p className="m-0 card px-5 py-8 text-center text-[14px] text-muted max-w-[1000px]">Энд хүсэлт алга байна.</p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-2.5 max-w-[1000px]">
              {rows.map((r) => (
                <li key={r.id} className="card p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-[16px]">{r.full_name}</span>
                      <span className="text-[13px] text-muted">
                        <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="mono font-semibold text-ink">{r.phone}</a> · {timeAgo(r.created_at)}
                        {r.income ? ` · Орлого: ${r.income}` : ""}
                      </span>
                    </div>
                    <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-md self-start ${LOAN_STATUS[r.status].cls}`}>{LOAN_STATUS[r.status].label}</span>
                  </div>
                  <div className="text-[14px]">
                    🚗 {r.ad_id ? <Link href={`/ads/${r.ad_id}`} target="_blank">{r.car}</Link> : r.car}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[13px]">
                    <Cell k="Машины үнэ" v={`${num(r.price)}₮`} />
                    <Cell k="Урьдчилгаа" v={`${num(r.down_payment)}₮`} />
                    <Cell k="Зээлийн дүн" v={`${num(r.price - r.down_payment)}₮`} />
                    <Cell k="Хугацаа" v={`${r.term_months} сар · ${Number(r.rate_annual)}%`} />
                    <Cell k="Сарын төлбөр" v={`${num(r.monthly_payment)}₮`} strong />
                  </div>
                  {r.checks && r.checks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Шаардлагын шалгалт">
                      {r.checks.map((c) => (
                        <span key={c.key} title={c.label} className={`text-[12px] font-semibold px-2.5 py-1 rounded-md ${c.ok === true ? "bg-[#DDF3E4] text-[#1D6B3A]" : c.ok === false ? "bg-danger-bg text-[#9b1c1c]" : "bg-soft text-body"}`}>
                          {c.ok === true ? "✓" : c.ok === false ? "✗" : "–"} {c.label}: {c.value}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.applicant && Object.keys(r.applicant).length > 0 && <ApplicantDetails r={r} />}
                  {r.docs && Object.keys(r.docs).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(r.docs).map(([k, path]) => signed.get(path) ? (
                        <a key={k} href={signed.get(path)} target="_blank" rel="noreferrer" className="text-[12px] px-2.5 py-1.5 rounded-md border border-line-2 bg-card no-underline text-ink">📎 {docLabel(k)}</a>
                      ) : (
                        <span key={k} className="text-[12px] px-2.5 py-1.5 rounded-md bg-soft text-muted">📎 {docLabel(k)} (нээгдсэнгүй)</span>
                      ))}
                    </div>
                  )}
                  {r.note && <p className="m-0 text-[13px] text-body">Худалдан авагч: {r.note}</p>}
                  {r.partner_note && <p className="m-0 text-[13px] rounded-lg bg-paper px-3 py-2">Тэмдэглэл: {r.partner_note}</p>}
                  {r.status !== "cancelled" ? (
                    <form action={updateLoanRequest} className="flex flex-wrap gap-2 items-center">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="back" value={back} />
                      <input name="note" placeholder="Тэмдэглэл (худалдан авагчид харагдана)" className="input h-9 text-[13px] flex-[1_1_220px]" />
                      {r.status !== "contacted" && <button name="status" value="contacted" className="btn btn-sm btn-ghost">Холбогдсон</button>}
                      {r.status !== "approved" && <button name="status" value="approved" className="btn btn-sm btn-yellow">Зөвшөөрсөн</button>}
                      {r.status !== "rejected" && <button name="status" value="rejected" className="btn btn-sm btn-danger">Татгалзсан</button>}
                    </form>
                  ) : (
                    <span className="text-[13px] text-muted">Худалдан авагч хүсэлтээ цуцалсан.</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PanelShell>
  );
}

function Cell({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${strong ? "bg-ink text-paper" : "bg-paper"}`}>
      <div className={`text-[11px] ${strong ? "text-pale" : "text-muted"}`}>{k}</div>
      <div className={`font-bold ${strong ? "text-yellow" : ""}`}>{v}</div>
    </div>
  );
}

function NumField({ name, label, value, step, placeholder, wide }: { name: string; label: string; value: number | string; step?: string; placeholder?: string; wide?: boolean }) {
  return (
    <label className={`label text-[13px] ${wide ? "flex-[2_1_300px]" : "flex-[1_1_150px]"}`}>
      {label}
      <input name={name} type="number" step={step ?? "1"} min={0} defaultValue={value} placeholder={placeholder} className="input h-11 mono" />
    </label>
  );
}

function ApplicantDetails({ r }: { r: LoanRequest }) {
  const a = r.applicant!;
  const m = (n?: number) => (n == null ? "—" : `${num(n)}₮`);
  const rows: [string, string][] = [
    ["Регистр", `${a.register_no ?? "—"}${a.age != null ? ` · ${a.age} нас` : ""}`],
    ["Хаяг", [a.city, a.district, a.address].filter(Boolean).join(", ") || "—"],
    ["Гэр бүл", `${a.marital_status ? MARITAL[a.marital_status] ?? a.marital_status : "—"} · ам бүл ${a.household_size ?? "—"}`],
    ["Орлогын эх үүсвэр", a.employment_type ? EMPLOYMENT[a.employment_type] ?? a.employment_type : "—"],
    ["Ажлын газар", [a.employer, a.position].filter(Boolean).join(" · ") || "—"],
    ["Ажилласан", a.work_months != null ? `${a.work_months} сар` : "—"],
    ["Сарын орлого", m(a.monthly_income)],
    ["Бусад орлого", m(a.other_income)],
    ["Бусад зээлийн төлбөр", m(a.existing_debt_payment)],
    ["Өр/орлогын харьцаа", r.dti != null ? `${Number(r.dti)}%` : "—"],
    ["Хугацаа хэтэрсэн зээл", a.has_overdue == null ? "—" : a.has_overdue ? "Байгаа" : "Байхгүй"],
    ["Жолооны үнэмлэх", a.has_license == null ? "—" : a.has_license ? "Байгаа" : "Байхгүй"],
    ["Холбоо барих хүн", a.ref_name ? `${a.ref_name}${a.ref_relation ? ` (${a.ref_relation})` : ""} · ${a.ref_phone ?? ""}` : "—"],
  ];
  if (a.cosigner) rows.push(["Хамтран зээлдэгч", `${a.cosigner.name}${a.cosigner.relation ? ` (${a.cosigner.relation})` : ""} · ${a.cosigner.phone}${a.cosigner.register_no ? ` · ${a.cosigner.register_no}` : ""} · орлого ${m(a.cosigner.monthly_income)}`]);
  return (
    <details className="rounded-lg border border-line px-3 py-2">
      <summary className="cursor-pointer text-[13px] font-semibold">Анкет харах</summary>
      <dl className="m-0 mt-2 grid sm:grid-cols-[200px_1fr] gap-x-4 gap-y-1.5 text-[13px]">
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
