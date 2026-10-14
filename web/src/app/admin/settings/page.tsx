import { getSettings, requireAdmin } from "@/lib/data";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import {
  regenSmsKey,
  saveContractSettings,
  saveGrowthSettings,
  savePaymentSettings,
  saveSettings,
} from "@/actions/settings";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "@/components/ConfirmButton";
import { siteUrl } from "@/lib/site";
import { termsFrom } from "@shared/contract";
import { CopyButton } from "../../(site)/agent/CopyButton";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Админ · Тохиргоо" };

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; apk?: string; v?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const [s, pending, sms] = await Promise.all([getSettings(), pendingCount(), smsStatus()]);
  const smsUrl = `${String(s.site_url ?? siteUrl()).replace(/\/+$/, "")}/api/sms`;
  const ct = termsFrom(s);
  const ex =
    s.offer_percent != null ? Math.round((50_000_000 * s.offer_percent) / 100).toLocaleString("en-US") + "₮" : "[ДҮН]";
  return (
    <PanelShell profile={me} area="admin" active="admin-settings" pending={pending}>
      <h1 className="h-display m-0 text-[28px]">Тохиргоо</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <a
        href="/admin/notifications"
        className="card flex max-w-[920px] items-center justify-between gap-3 p-5 no-underline"
      >
        <span className="flex flex-col gap-1">
          <span className="text-[17px] font-bold">Зарлал, мэдэгдэл</span>
          <span className="text-[14px] text-muted">Бүх хэрэглэгчид зарлал илгээх, өмнө илгээснээ устгах</span>
        </span>
        <span className="text-[14px] font-semibold whitespace-nowrap">Нээх →</span>
      </a>
      <form action={saveContractSettings} className="card flex max-w-[920px] flex-col gap-3.5 p-5.5">
        <input type="hidden" name="back" value="/admin/settings" />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-[17px] font-bold">Гэрээ ба шимтгэл</h2>
          <a href="/api/contracts/template" target="_blank" rel="noreferrer" className="text-[13px] font-semibold">
            Гэрээний загвар (PDF) ↗
          </a>
        </div>
        <span className="text-[14px] text-muted">
          Хэрэглэгч зар оруулахын өмнө энэ нөхцөлтэй гэрээнд гарын үсэг зурна. Хоног нь зар нийтлэгдсэнээс тоологдоно.
          Өөрчлөлт зөвхөн шинэ гэрээнд үйлчилнэ.
        </span>
        <label className="label text-[14px]">
          Үйлчилгээ үзүүлэгч (компанийн нэр)
          <input name="company" required defaultValue={ct.company} className="input" />
        </label>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[14px]">
              <input
                name={`days${i + 1}`}
                type="number"
                min={1}
                defaultValue={ct.terms.tiers[i]?.days ?? ""}
                className="input mono w-20"
                aria-label={`${i + 1}-р шатны хоног`}
              />
              <span>хоногийн дотор зарагдвал</span>
              <input
                name={`pct${i + 1}`}
                type="number"
                step="0.1"
                min={0}
                max={100}
                defaultValue={ct.terms.tiers[i]?.percent ?? ""}
                className="input mono w-20"
                aria-label={`${i + 1}-р шатны хувь`}
              />
              <span>%</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            <span>Түүнээс хойш зарагдвал</span>
            <input
              name="after"
              type="number"
              step="0.1"
              min={0}
              max={100}
              defaultValue={ct.terms.after}
              className="input mono w-20"
              aria-label="Сүүлийн шатнаас хойшхи хувь"
            />
            <span>%</span>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-ink h-12">Хадгалах</button>
        </div>
      </form>
      <form action={saveGrowthSettings} className="card flex max-w-[920px] flex-col gap-4 p-5.5">
        <input type="hidden" name="back" value="/admin/settings" />
        <h2 className="m-0 text-[17px] font-bold">Агент ба онцлох зар</h2>
        <div className="flex flex-wrap gap-4">
          <label className="label flex-[1_1_220px] text-[14px]">
            Агентад ногдох хувь (шимтгэлийн %)
            <input
              name="agent_share"
              inputMode="decimal"
              required
              defaultValue={s.agent_share ?? 50}
              className="input mono"
            />
            <span className="text-[12px] font-normal text-muted">
              Жишээ: шимтгэл 2%, энэ нь 50% бол агентад зарагдсан үнийн 1%.
            </span>
          </label>
          <label className="label flex-[1_1_180px] text-[14px]">
            Онцлох зарын үнэ (₮)
            <input
              name="featured_price"
              inputMode="numeric"
              required
              defaultValue={s.featured_price ?? 50000}
              className="input mono"
            />
          </label>
          <label className="label flex-[1_1_140px] text-[14px]">
            Онцлох хугацаа (хоног)
            <input
              name="featured_days"
              type="number"
              min={1}
              max={365}
              required
              defaultValue={s.featured_days ?? 7}
              className="input mono"
            />
          </label>
        </div>
        <label className="label text-[14px]">
          Сайтын хаяг
          <input
            name="site_url"
            required
            defaultValue={s.site_url ?? siteUrl()}
            className="input mono"
            placeholder="https://mashinzar.mn"
          />
          <span className="text-[12px] font-normal text-muted">
            Push мэдэгдлийн холбоос энд заасан хаягаар явна. Домэйн солиход энд болон Vercel-ийн NEXT_PUBLIC_SITE_URL-д
            шинэ хаягаа бичнэ.
          </span>
        </label>
        <div className="flex justify-end">
          <button className="btn btn-ink h-12">Хадгалах</button>
        </div>
      </form>
      <form action={savePaymentSettings} className="card flex max-w-[920px] flex-col gap-4 p-5.5">
        <input type="hidden" name="back" value="/admin/settings" />
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[17px] font-bold">Зар оруулах 2 сонголт · төлбөрийн данс</h2>
          <span className="text-[14px] text-muted">
            Хэрэглэгч зар оруулахдаа сонгоно: <strong>шимтгэлтэй</strong> (гэрээ, зарагдвал %, онцлох үнэгүй) эсвэл{" "}
            <strong>онцлох төлбөртэй</strong> (дээрх «Онцлох зарын үнэ», шимтгэлгүй). Төлбөртэй зар орлого баталгаажсаны
            дараа л батлагдана.
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="label flex-[1_1_200px] text-[14px]">
            Банк
            <input name="pay_bank" defaultValue={s.pay_bank ?? ""} className="input" placeholder="Хаан банк" />
          </label>
          <label className="label flex-[1_1_260px] text-[14px]">
            Дансны дугаар
            <input
              name="pay_account"
              defaultValue={s.pay_account ?? ""}
              className="input mono"
              placeholder="MN12 0005 00 5012345678"
            />
          </label>
          <label className="label flex-[1_1_260px] text-[14px]">
            Хүлээн авагчийн нэр
            <input name="pay_holder" defaultValue={s.pay_holder ?? ""} className="input" placeholder="Autoshop ХХК" />
          </label>
          <label className="label flex-[1_1_220px] text-[14px]">
            Шимтгэлтэй зарын үнэгүй онцлох (хоног)
            <input
              name="commission_featured_days"
              type="number"
              min={0}
              max={365}
              required
              defaultValue={s.commission_featured_days ?? 7}
              className="input mono"
            />
            <span className="text-[12px] font-normal text-muted">0 бол шимтгэлтэй зар онцлохгүй.</span>
          </label>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-ink h-12">Хадгалах</button>
        </div>
      </form>
      <section id="sms" className="card flex max-w-[920px] flex-col gap-4 p-5.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-[17px] font-bold">SMS апп · орлого автоматаар батлах</h2>
          {sms.lastSeen ? (
            <span className="badge bg-active-bg text-active-fg">Сүүлд холбогдсон: {timeAgo(sms.lastSeen)}</span>
          ) : (
            <span className="badge bg-soft text-body">Холбогдоогүй</span>
          )}
        </div>
        <ol className="m-0 flex flex-col gap-1 pl-5 text-[14px] leading-relaxed text-body">
          <li>
            Дансны орлогын SMS ирдэг Android утсан дээр <strong>«Орлого SMS»</strong> апп суулгаж, SMS зөвшөөрөл өгнө.
          </li>
          <li>
            Апп → ⋮ → Тохиргоо: доорх <strong>серверийн хаяг</strong>, <strong>түлхүүр</strong>, банкны SMS ирдэг
            дугаарыг оруулна.
          </li>
          <li>«Туршиж илгээх» → «✓ Сервер хүлээж авлаа» гарвал бэлэн.</li>
          <li>
            Орлого орж ирэхэд гүйлгээний утгаас <code>MZXXXXXX</code> кодыг олж, дүн хүрэлцвэл төлбөр{" "}
            <strong>автоматаар</strong> батлагдана. Код олдоогүй, дүн дутуу орлого танд мэдэгдлээр ирж, «Төлбөрүүд»-ийн
            доод хэсэгт харагдана.
          </li>
        </ol>
        <div className="flex flex-wrap items-end gap-3">
          <label className="label flex-[2_1_320px] text-[14px]">
            Серверийн хаяг
            <input readOnly value={smsUrl} className="input mono font-normal" />
          </label>
          <CopyButton text={smsUrl} label="Хуулах" />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="label flex-[2_1_320px] text-[14px]">
            Түлхүүр
            <input readOnly value={sms.key ?? ""} className="input mono font-normal" />
          </label>
          {sms.key && <CopyButton text={sms.key} label="Хуулах" />}
          <form action={regenSmsKey}>
            <input type="hidden" name="back" value="/admin/settings" />
            <ConfirmButton
              message="Шинэ түлхүүр үүсгэх үү? Хуучин түлхүүртэй утас холбогдохоо болино."
              className="btn btn-sm btn-ghost"
            >
              Солих
            </ConfirmButton>
          </form>
        </div>
        <span className="text-[12px] text-muted">
          Түлхүүрийг зөвхөн өөрийн утсанд оруулна — түүнийг мэдсэн хүн «орлого орлоо» гэж илгээж чадна. Алдагдсан гэж
          үзвэл «Солих».
        </span>
      </section>
      <form action={saveSettings} className="flex max-w-[920px] flex-col gap-4.5">
        <input type="hidden" name="back" value="/admin/settings" />
        <section className="card flex flex-col gap-3.5 p-5.5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[17px] font-bold">Санал тооцох хувь</h2>
            <span className="text-[14px] text-muted">Хэрэглэгчид тавих саналыг машины үнээс энэ хувиар тооцно.</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[14px] font-semibold">
              Хувь
              <input
                name="offer_percent"
                inputMode="decimal"
                defaultValue={s.offer_percent ?? ""}
                placeholder="жиш. 3"
                className="input mono w-[120px] border-2 border-ink text-center font-bold"
              />
              <span className="mono text-[18px] font-bold">%</span>
            </label>
            <span className="mono rounded-[10px] bg-paper px-3 py-2.5 text-[14px] text-body">
              Жишээ: 50,000,000₮ × {s.offer_percent ?? "[ХУВЬ]"}% = {ex}
            </span>
          </div>
        </section>
        <section className="card flex flex-col gap-3.5 p-5.5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[17px] font-bold">Зарын ангилал</h2>
            <span className="text-[14px] text-muted">
              Үйлдвэрлэсэн оноор автоматаар хоёр ангилалд хуваана. Өөрчлөхөд бүх зар шинээр ангилагдана.
            </span>
          </div>
          <label className="flex flex-wrap items-center gap-2.5 text-[14px] font-semibold">
            Зааг он
            <input
              name="cutoff_year"
              type="number"
              defaultValue={s.cutoff_year}
              className="input mono w-[120px] text-center"
            />
            <span className="font-normal text-body">
              → “{s.cutoff_year} ба хойш” / “{s.cutoff_year}-аас өмнө”
            </span>
          </label>
        </section>
        <section className="card flex flex-col p-5.5">
          <h2 className="m-0 mb-2.5 text-[17px] font-bold">Мэдэгдэл</h2>
          <label className="flex items-center justify-between gap-4 border-b border-[#ecede9] py-3 text-[14px]">
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">Шинэ зар батлагдахад бүх хэрэглэгчид мэдэгдэх</span>
              <span className="text-[13px] text-muted">Хэрэглэгч өөрийн шүүлтүүрээр хязгаарлаж болно</span>
            </span>
            <input
              type="checkbox"
              name="notify_all"
              defaultChecked={s.notify_all_on_approve}
              className="h-5 w-5 shrink-0 accent-ink"
            />
          </label>
          <label className="flex items-center justify-between gap-4 py-3 text-[14px]">
            <span className="font-semibold">Шинэ зар ирэхэд админуудад мэдэгдэх</span>
            <input
              type="checkbox"
              name="notify_staff"
              defaultChecked={s.notify_staff_on_new}
              className="h-5 w-5 shrink-0 accent-ink"
            />
          </label>
        </section>
        <section className="card flex flex-wrap gap-4 p-5.5">
          <h2 className="m-0 basis-full text-[17px] font-bold">Зарын дүрэм</h2>
          <label className="label flex-[1_1_200px] text-[14px]">
            Хамгийн их зураг
            <input
              name="max_photos"
              type="number"
              min={1}
              max={16}
              defaultValue={s.max_photos}
              className="input mono"
            />
          </label>
          <label className="label flex-[1_1_200px] text-[14px]">
            Хамгийн бага зураг
            <input
              name="min_photos"
              type="number"
              min={1}
              max={16}
              defaultValue={s.min_photos}
              className="input mono"
            />
          </label>
          <label className="label flex-[1_1_200px] text-[14px]">
            Зарын хугацаа (хоног)
            <input name="ad_days" type="number" min={1} defaultValue={s.ad_days} className="input mono" />
            <span className="text-[12px] font-normal text-muted">
              Дууссан зар нийтээс хасагдана, эзэн нь 3 хоногийн өмнө сануулга авч, нэг товшилтоор сунгана.
            </span>
          </label>
        </section>
        <div className="flex justify-end gap-2.5">
          <button className="btn btn-lg btn-yellow">Хадгалах</button>
        </div>
      </form>
    </PanelShell>
  );
}

/** SMS апп-ын түлхүүр, сүүлд холбогдсон цаг */
async function smsStatus() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sms_admin");
  const d = data as { api_key: string | null; last_seen_at: string | null } | null;
  return { key: d?.api_key ?? null, lastSeen: d?.last_seen_at ?? null };
}
