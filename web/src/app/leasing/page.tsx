import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireLeasing } from "@/lib/data";
import { dateShort, num, timeAgo } from "@/lib/format";
import {
  DEFAULT_REQUIRED_DOCS,
  LOAN_DOCS,
  LOAN_STATUS,
  docLabel,
  sortDocKeys,
  type LoanRequest,
  type LoanStatus,
  type Partner,
} from "@/lib/loan";
import { Flash, Kpi, PanelShell } from "@/components/PanelShell";
import { savePartnerTerms, updateLoanRequest } from "@/actions/leasing";
import { Cell, ApplicantDetails, LoanEvent, History } from "@/features/leasing/RequestDetails";
import { NumField } from "@/features/leasing/NumField";

export const metadata = { title: "Лизингийн панел" };

const TABS: { key: LoanStatus | "all"; label: string }[] = [
  { key: "new", label: "Шинэ" },
  { key: "contacted", label: "Холбогдсон" },
  { key: "approved", label: "Зөвшөөрсөн" },
  { key: "rejected", label: "Татгалзсан" },
  { key: "all", label: "Бүгд" },
];

export default async function LeasingPanel({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; partner?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireLeasing();
  const supabase = await createClient();
  const isAdmin = me.role === "admin";

  const { data: partnerRows } = await supabase.from("leasing_partners").select("*").order("name");
  const partners = (partnerRows ?? []) as Partner[];
  // Админ: анхдагчаар бүх компанийн хүсэлт ("all"), эсвэл нэг компани
  const allMode = isAdmin && partners.length > 0 && (!sp.partner || sp.partner === "all") && sp.tab !== "terms";
  const partner = isAdmin
    ? (partners.find((p) => p.id === sp.partner) ?? partners[0])
    : partners.find((p) => p.id === me.partner_id);
  const partnerName = new Map(partners.map((p) => [p.id, p.name]));

  if (!partner)
    return (
      <PanelShell profile={me} area="leasing" active="leasing">
        <h1 className="h-display m-0 text-[28px]">Лизингийн панел</h1>
        <p className="card m-0 p-5 text-[14px] text-body">
          {isAdmin ? (
            <>
              Лизингийн компани бүртгэгдээгүй байна. <Link href="/admin/leasing">Админ → Лизинг</Link> хэсгээс нэмнэ үү.
            </>
          ) : (
            "Таны аккаунт лизингийн компанитай холбогдоогүй байна. Админтай холбогдоно уу."
          )}
        </p>
      </PanelShell>
    );

  const tab =
    sp.tab === "terms" ? "terms" : TABS.some((t) => t.key === sp.tab) ? (sp.tab as LoanStatus | "all") : "new";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let q = supabase.from("loan_requests").select("*").order("created_at", { ascending: false }).limit(200);
  let qs = supabase.from("loan_requests").select("status,price,down_payment,created_at").limit(5000);
  if (!allMode) {
    q = q.eq("partner_id", partner.id);
    qs = qs.eq("partner_id", partner.id);
  }
  if (tab !== "all" && tab !== "terms") q = q.eq("status", tab);
  const [list, all] = await Promise.all([tab === "terms" ? Promise.resolve({ data: [], error: null }) : q, qs]);
  const rows = (list.data ?? []) as LoanRequest[];
  // Үйл явдлын түүх (илгээсэн, төлөв, баримт хэн нээсэн) - RLS: админ бүгдийг, компани өөрийнхийг
  const events = new Map<string, LoanEvent[]>();
  if (rows.length) {
    const { data: ev } = await supabase
      .from("loan_events")
      .select("request_id,actor_name,kind,detail,created_at")
      .in(
        "request_id",
        rows.map((r) => r.id),
      )
      .order("created_at");
    for (const e of (ev ?? []) as (LoanEvent & { request_id: string })[])
      events.set(e.request_id, [...(events.get(e.request_id) ?? []), e]);
  }
  const stats = (all.data ?? []) as { status: LoanStatus; price: number; down_payment: number; created_at: string }[];
  const month = stats.filter((r) => r.created_at >= monthStart);
  const approved = stats.filter((r) => r.status === "approved");
  const decided = stats.filter((r) => r.status === "approved" || r.status === "rejected").length;
  const count = (k: LoanStatus) => stats.filter((r) => r.status === k).length;
  const trialDays = allMode
    ? null
    : partner.trial_until
      ? Math.ceil((new Date(partner.trial_until).getTime() - now.getTime()) / 864e5)
      : null;
  const q2 = isAdmin ? `&partner=${allMode ? "all" : partner.id}` : "";
  const back = `/leasing?tab=${tab}${q2}`;

  return (
    <PanelShell
      profile={me}
      area="leasing"
      active={tab === "terms" ? "leasing-terms" : "leasing"}
      partner={isAdmin ? (allMode ? "all" : partner.id) : undefined}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h-display m-0 text-[28px]">{allMode ? "Лизингийн бүх хүсэлт" : partner.name}</h1>
          <span className="text-[14px] text-muted">
            {allMode
              ? "Бүх лизингийн компанид очсон хүсэлт, тэдний шийдвэр, баримт хэн хэзээ нээсэн"
              : "Autoshop.mn-ийн худалдан авагчдын лизингийн хүсэлтүүд"}
          </span>
        </div>
        {isAdmin && (
          <form className="flex items-center gap-2">
            <input type="hidden" name="tab" value={tab === "terms" ? "terms" : tab} />
            <select name="partner" defaultValue={allMode ? "all" : partner.id} className="input h-10">
              {tab !== "terms" && <option value="all">Бүх компани</option>}
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost h-10">Харах</button>
          </form>
        )}
      </div>
      {trialDays !== null && (
        <p
          className={`m-0 rounded-xl px-4 py-3 text-[14px] ${trialDays > 0 ? "bg-ink text-paper" : "bg-danger-bg text-[#9b1c1c]"}`}
        >
          {trialDays > 0 ? (
            <>
              🎁 Туршилтын хугацаа: <strong className="text-yellow">{trialDays} хоног</strong> үлдсэн (
              {dateShort(partner.trial_until)} хүртэл) — үнэгүй.
            </>
          ) : (
            "Туршилтын хугацаа дууссан. Үргэлжлүүлэх нөхцөлийг админтай тохирно уу."
          )}
        </p>
      )}
      <Flash ok={sp.ok} err={sp.err ?? (list.error ? `Хүсэлт уншиж чадсангүй: ${list.error.message}` : undefined)} />

      <div className="grid max-w-[1000px] grid-cols-2 gap-3.5 md:grid-cols-4">
        <Kpi dark label="Шинэ хүсэлт" value={count("new")} href={`/leasing?tab=new${q2}`} />
        <Kpi
          label="Энэ сарын хүсэлт"
          value={month.length}
          sub={`${num(month.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮ зээл`}
        />
        <Kpi
          label="Зөвшөөрсөн"
          value={approved.length}
          sub={`${num(approved.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮`}
        />
        <Kpi
          label="Хөрвөлт"
          value={decided ? `${Math.round((approved.length / decided) * 100)}%` : "—"}
          sub="Шийдвэрлэснээс зөвшөөрсөн"
        />
      </div>

      {tab === "terms" ? (
        <section className="card flex max-w-[960px] flex-col gap-3.5 p-5">
          <h2 className="m-0 text-[17px] font-bold">Нөхцөл ба шаардлага</h2>
          <span className="text-[14px] text-muted">
            Зарын хуудсан дээрх тооцоолуур, хүсэлтийн анкет энэ тохиргоог ашиглана. Хүсэлт бүрийг систем эдгээр
            шаардлагатай тулгаж ✓/✗ гэж харуулна.
          </span>
          <form action={savePartnerTerms} className="flex flex-col gap-5">
            <input type="hidden" name="back" value={`/leasing?tab=terms${q2}`} />
            <input type="hidden" name="partner_id" value={partner.id} />
            <fieldset className="m-0 flex flex-wrap items-end gap-3 border-0 p-0">
              <legend className="mb-2 text-[14px] font-semibold">Зээлийн нөхцөл</legend>
              <NumField name="rate" label="Жилийн хүү (%)" value={Number(partner.rate_annual)} step="0.1" />
              <NumField name="min_down" label="Хамгийн бага урьдчилгаа (%)" value={Number(partner.min_down_pct)} />
              <NumField name="max_term" label="Хамгийн урт хугацаа (сар)" value={partner.max_term_months} />
            </fieldset>
            <fieldset className="m-0 flex flex-wrap items-end gap-3 border-0 p-0">
              <legend className="mb-2 text-[14px] font-semibold">Зээлдэгчид тавих шаардлага</legend>
              <NumField name="min_age" label="Доод нас" value={partner.min_age ?? 18} />
              <NumField name="max_age" label="Дээд нас" value={partner.max_age ?? 65} />
              <NumField name="min_work" label="Ажилласан (сар)" value={partner.min_work_months ?? 6} />
              <NumField name="min_business" label="Бизнес эрхэлсэн (сар)" value={partner.min_business_months ?? 12} />
              <NumField
                name="max_dti"
                label="Өр/орлогын харьцаа ≤ (%)"
                value={Number(partner.max_dti ?? 50)}
                step="0.1"
              />
              <NumField
                name="min_car_year"
                label="Машин хамгийн багадаа (он)"
                value={partner.min_car_year ?? ""}
                placeholder="Хязгааргүй"
              />
              <NumField
                name="cosigner_over"
                label="Хамтран зээлдэгч шаардах зээл (₮-өөс дээш)"
                value={partner.cosigner_over ?? ""}
                placeholder="Шаардахгүй"
                wide
              />
            </fieldset>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-[14px] font-semibold">Заавал хавсаргах баримт</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {LOAN_DOCS.map((d) => (
                  <label
                    key={d.kind}
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-paper px-3 py-2 text-[14px]"
                  >
                    <input
                      type="checkbox"
                      name="required_docs"
                      value={d.kind}
                      defaultChecked={(partner.required_docs ?? DEFAULT_REQUIRED_DOCS).includes(d.kind)}
                      className="h-4 w-4 accent-[#111317]"
                    />{" "}
                    {d.label}
                  </label>
                ))}
              </div>
              <span className="text-[12px] text-muted">Тэмдэглээгүй баримтыг худалдан авагч хүсвэл хавсаргана.</span>
            </fieldset>
            <label className="label text-[14px]">
              Нэмэлт шаардлага (худалдан авагчид харагдана)
              <textarea
                name="requirements_note"
                defaultValue={partner.requirements_note ?? ""}
                rows={3}
                className="textarea"
                placeholder="Жишээ: 100% даатгал заавал, барьцаанд зөвхөн тухайн машин"
              />
            </label>
            <button className="btn btn-ink h-12 self-start">Хадгалах</button>
          </form>
        </section>
      ) : (
        <>
          <nav className="flex flex-wrap gap-1.5" aria-label="Шүүлтүүр">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/leasing?tab=${t.key}${q2}`}
                className={`flex h-9 items-center rounded-full px-3.5 text-[13px] no-underline ${t.key === tab ? "bg-ink font-semibold text-yellow" : "border border-line-2 bg-card text-ink"}`}
              >
                {t.label}
                {t.key !== "all" ? ` · ${count(t.key)}` : ""}
              </Link>
            ))}
          </nav>
          {rows.length === 0 ? (
            <p className="card m-0 max-w-[1000px] px-5 py-8 text-center text-[14px] text-muted">
              Энд хүсэлт алга байна.
            </p>
          ) : (
            <ul className="m-0 flex max-w-[1000px] list-none flex-col gap-2.5 p-0">
              {rows.map((r) => (
                <li key={r.id} className="card flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[16px] font-bold">
                        {r.full_name}
                        {allMode && (
                          <span className="badge ml-2 bg-soft align-middle text-body">
                            {partnerName.get(r.partner_id) ?? "—"}
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] text-muted">
                        <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="mono font-semibold text-ink">
                          {r.phone}
                        </a>{" "}
                        · {timeAgo(r.created_at)}
                        {r.income ? ` · Орлого: ${r.income}` : ""}
                      </span>
                    </div>
                    <span
                      className={`self-start rounded-md px-2.5 py-1 text-[12px] font-semibold ${LOAN_STATUS[r.status].cls}`}
                    >
                      {LOAN_STATUS[r.status].label}
                    </span>
                  </div>
                  <div className="text-[14px]">
                    🚗{" "}
                    {r.ad_id ? (
                      <Link href={`/ads/${r.ad_id}`} target="_blank">
                        {r.car}
                      </Link>
                    ) : (
                      r.car
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-5">
                    <Cell k="Машины үнэ" v={`${num(r.price)}₮`} />
                    <Cell k="Урьдчилгаа" v={`${num(r.down_payment)}₮`} />
                    <Cell k="Зээлийн дүн" v={`${num(r.price - r.down_payment)}₮`} />
                    <Cell k="Хугацаа" v={`${r.term_months} сар · ${Number(r.rate_annual)}%`} />
                    <Cell k="Сарын төлбөр" v={`${num(r.monthly_payment)}₮`} strong />
                  </div>
                  {r.checks && r.checks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Шаардлагын шалгалт">
                      {r.checks.map((c) => (
                        <span
                          key={c.key}
                          title={c.label}
                          className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${c.ok === true ? "bg-[#DDF3E4] text-[#1D6B3A]" : c.ok === false ? "bg-danger-bg text-[#9b1c1c]" : "bg-soft text-body"}`}
                        >
                          {c.ok === true ? "✓" : c.ok === false ? "✗" : "–"} {c.label}: {c.value}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.applicant && Object.keys(r.applicant).length > 0 && <ApplicantDetails r={r} />}
                  {r.docs &&
                    Object.keys(r.docs).length > 0 &&
                    (r.status === "cancelled" && !isAdmin ? (
                      <span className="text-[12px] text-muted">Цуцлагдсан тул баримтууд хаагдсан.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {sortDocKeys(Object.keys(r.docs)).map((k) => (
                          <a
                            key={k}
                            href={`/api/loan-docs/${r.id}/${k}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-line-2 bg-card px-2.5 py-1.5 text-[12px] text-ink no-underline"
                          >
                            📎 {docLabel(k)}
                          </a>
                        ))}
                      </div>
                    ))}
                  {(events.get(r.id)?.length ?? 0) > 0 && <History events={events.get(r.id)!} />}
                  {r.note && <p className="m-0 text-[13px] text-body">Худалдан авагч: {r.note}</p>}
                  {r.partner_note && (
                    <p className="m-0 rounded-lg bg-paper px-3 py-2 text-[13px]">Тэмдэглэл: {r.partner_note}</p>
                  )}
                  {r.status !== "cancelled" ? (
                    <form action={updateLoanRequest} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="back" value={back} />
                      <input
                        name="note"
                        placeholder="Тэмдэглэл (худалдан авагчид харагдана)"
                        className="input h-9 flex-[1_1_220px] text-[13px]"
                      />
                      {r.status !== "contacted" && (
                        <button name="status" value="contacted" className="btn btn-sm btn-ghost">
                          Холбогдсон
                        </button>
                      )}
                      {r.status !== "approved" && (
                        <button name="status" value="approved" className="btn btn-sm btn-yellow">
                          Зөвшөөрсөн
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button name="status" value="rejected" className="btn btn-sm btn-danger">
                          Татгалзсан
                        </button>
                      )}
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
