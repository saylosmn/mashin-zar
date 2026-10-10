import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { dateShort } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import type { Partner, LoanStatus } from "@/lib/loan";
import { Flash, PanelShell } from "@/components/PanelShell";
import { deleteInvite, inviteLeasingStaff, removeLeasingStaff, upsertPartner } from "../../panel-actions";

export const metadata = { title: "Админ · Лизинг" };

export default async function AdminLeasing({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const [pending, pRes, staffRes, invRes, reqRes] = await Promise.all([
    pendingCount(),
    supabase.from("leasing_partners").select("*").order("created_at"),
    supabase.from("profiles").select("id,full_name,email,partner_id,is_blocked").eq("role", "leasing"),
    supabase.from("staff_invites").select("email,partner_id,created_at").eq("role", "leasing"),
    supabase.from("loan_requests").select("partner_id,status"),
  ]);
  const partners = (pRes.data ?? []) as Partner[];
  const staff = (staffRes.data ?? []) as { id: string; full_name: string | null; email: string | null; partner_id: string | null; is_blocked: boolean }[];
  const staffEmails = new Set(staff.map((s) => s.email?.toLowerCase()));
  const invites = ((invRes.data ?? []) as { email: string; partner_id: string | null; created_at: string }[]).filter((i) => !staffEmails.has(i.email.toLowerCase()));
  const reqs = (reqRes.data ?? []) as { partner_id: string; status: LoanStatus }[];
  const back = "/admin/leasing";
  const in60 = daysFromNow(60);

  return (
    <PanelShell profile={me} area="admin" active="admin-leasing" pending={pending}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h-display m-0 text-[28px]">Лизинг</h1>
          <span className="text-[14px] text-muted">Түнш лизингийн компаниуд, тэдний ажилтнууд, хүсэлтийн тоо</span>
        </div>
        <Link href="/leasing" className="btn btn-ghost">Түншийн панелыг харах →</Link>
      </div>
      <Flash ok={sp.ok} err={sp.err ?? (pRes.error ? `Уншиж чадсангүй: ${pRes.error.message}` : undefined)} />

      <form action={upsertPartner} className="bg-ink text-paper rounded-2xl p-5 flex flex-wrap gap-3 items-end max-w-[1000px] [&_.label]:text-paper">
        <span className="basis-full h-display text-[16px]">Шинэ лизингийн компани</span>
        <span className="basis-full text-[13px] text-pale -mt-1">Нэмсний дараа зарын хуудсанд тооцоолуур гарч, худалдан авагчид хүсэлт илгээж эхэлнэ. Туршилтын хугацааг анхдагчаар 60 хоног болгосон.</span>
        <PartnerFields back={back} in60={in60} />
        <button className="btn btn-yellow h-11">Нэмэх</button>
      </form>

      <div className="flex flex-col gap-3 max-w-[1000px]">
        {partners.length === 0 && <p className="m-0 card p-5 text-[14px] text-muted">Лизингийн компани нэмэгдээгүй байна.</p>}
        {partners.map((p) => {
          const r = reqs.filter((x) => x.partner_id === p.id);
          const pStaff = staff.filter((s) => s.partner_id === p.id);
          const pInv = invites.filter((i) => i.partner_id === p.id);
          return (
            <section key={p.id} className="card p-5 flex flex-col gap-4">
              <div className="flex flex-wrap justify-between gap-2 items-start">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-[17px]">{p.name} {!p.active && <span className="badge bg-sold-bg text-sold-fg ml-1">Идэвхгүй</span>}</span>
                  <span className="text-[13px] text-muted">
                    {Number(p.rate_annual)}% · урьдчилгаа {Number(p.min_down_pct)}%+ · {p.max_term_months} сар хүртэл
                    {p.trial_until ? ` · туршилт ${dateShort(p.trial_until)} хүртэл` : ""}
                  </span>
                </div>
                <div className="flex gap-2 text-[13px]">
                  <span className="badge bg-pending-bg text-pending-fg">Нийт {r.length}</span>
                  <span className="badge bg-active-bg text-active-fg">Шинэ {r.filter((x) => x.status === "new").length}</span>
                  <span className="badge bg-[#DDF3E4] text-[#1D6B3A]">Зөвшөөрсөн {r.filter((x) => x.status === "approved").length}</span>
                </div>
              </div>
              <details>
                <summary className="cursor-pointer text-[14px] font-semibold">Нөхцөл засах</summary>
                <form action={upsertPartner} className="flex flex-wrap gap-3 items-end pt-3">
                  <PartnerFields p={p} back={back} in60={in60} />
                  <button className="btn btn-ink h-11">Хадгалах</button>
                </form>
              </details>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold">Панелд нэвтрэх ажилтнууд</span>
                {pStaff.length === 0 && pInv.length === 0 && <span className="text-[13px] text-muted">Ажилтан нэмээгүй байна.</span>}
                {pStaff.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 bg-paper rounded-lg px-3 py-2 text-[14px]">
                    <span><strong>{s.full_name ?? "—"}</strong> <span className="text-muted">{s.email}</span></span>
                    <form action={removeLeasingStaff}>
                      <input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value={back} />
                      <button className="btn btn-sm btn-ghost">Эрх хасах</button>
                    </form>
                  </div>
                ))}
                {pInv.map((i) => (
                  <div key={i.email} className="flex flex-wrap items-center justify-between gap-2 bg-paper rounded-lg px-3 py-2 text-[14px]">
                    <span>{i.email} <span className="badge bg-pending-bg text-pending-fg ml-1">Нэвтрэхийг хүлээж буй</span></span>
                    <form action={deleteInvite}>
                      <input type="hidden" name="email" value={i.email} /><input type="hidden" name="back" value={back} />
                      <button className="btn btn-sm btn-danger">Цуцлах</button>
                    </form>
                  </div>
                ))}
                <form action={inviteLeasingStaff} className="flex flex-wrap gap-2 items-center">
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="partner_id" value={p.id} />
                  <input name="email" type="email" required placeholder="ажилтны Google и-мэйл" className="input h-10 flex-[1_1_240px]" />
                  <button className="btn btn-ghost h-10">Ажилтан нэмэх</button>
                </form>
              </div>
            </section>
          );
        })}
      </div>
    </PanelShell>
  );
}

/** "YYYY-MM-DD", өнөөдрөөс N хоногийн дараа */
function daysFromNow(n: number) {
  return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
}

/** Лизингийн компанийн маягтын талбарууд (шинэ ба засах маягтад хоёуланд) */
function PartnerFields({ p, back, in60 }: { p?: Partner; back: string; in60: string }) {
  return (
    <>
      <input type="hidden" name="back" value={back} />
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="label text-[13px] flex-[2_1_220px]">Компанийн нэр<input name="name" required defaultValue={p?.name ?? ""} className="input h-11" placeholder="Жишээ лизинг ББСБ" /></label>
      <label className="label text-[13px] flex-[1_1_140px]">Утас<input name="phone" defaultValue={p?.phone ?? ""} className="input h-11 mono" placeholder="7700 1122" /></label>
      <label className="label text-[13px] flex-[1_1_110px]">Жилийн хүү %<input name="rate" type="number" step="0.1" min={0} max={100} defaultValue={p ? Number(p.rate_annual) : 24} className="input h-11 mono" /></label>
      <label className="label text-[13px] flex-[1_1_110px]">Мин урьдчилгаа %<input name="min_down" type="number" step="1" min={0} max={95} defaultValue={p ? Number(p.min_down_pct) : 30} className="input h-11 mono" /></label>
      <label className="label text-[13px] flex-[1_1_110px]">Макс хугацаа (сар)<input name="max_term" type="number" min={1} max={120} defaultValue={p?.max_term_months ?? 36} className="input h-11 mono" /></label>
      <label className="label text-[13px] flex-[1_1_150px]">Туршилт дуусах өдөр<input name="trial_until" type="date" defaultValue={p ? p.trial_until ?? "" : in60} className="input h-11 mono" /></label>
      <label className="flex items-center gap-2 text-[14px] h-11"><input type="checkbox" name="active" defaultChecked={p ? p.active : true} className="w-5 h-5 accent-[#111317]" /> Идэвхтэй</label>
    </>
  );
}
