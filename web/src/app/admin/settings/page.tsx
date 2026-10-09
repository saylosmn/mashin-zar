import { getSettings, requireAdmin } from "@/lib/data";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { saveContractSettings, saveSettings } from "../../panel-actions";
import { termsFrom } from "@/lib/contract";

export const metadata = { title: "Админ · Тохиргоо" };

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; apk?: string; v?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const [s, pending] = await Promise.all([getSettings(), pendingCount()]);
  const ct = termsFrom(s);
  const ex = s.offer_percent != null ? Math.round((50_000_000 * s.offer_percent) / 100).toLocaleString("en-US") + "₮" : "[ДҮН]";
  return (
    <PanelShell profile={me} area="admin" active="admin-settings" pending={pending}>
      <h1 className="h-display m-0 text-[28px]">Тохиргоо</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <a href="/admin/notifications" className="card p-5 flex items-center justify-between gap-3 max-w-[920px] no-underline">
        <span className="flex flex-col gap-1">
          <span className="font-bold text-[17px]">Зарлал, мэдэгдэл</span>
          <span className="text-[14px] text-muted">Бүх хэрэглэгчид зарлал илгээх, өмнө илгээснээ устгах</span>
        </span>
        <span className="text-[14px] font-semibold whitespace-nowrap">Нээх →</span>
      </a>
      <form action={saveContractSettings} className="card p-5.5 flex flex-col gap-3.5 max-w-[920px]">
        <input type="hidden" name="back" value="/admin/settings" />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-[17px] font-bold">Гэрээ ба шимтгэл</h2>
          <a href="/api/contracts/template" target="_blank" rel="noreferrer" className="text-[13px] font-semibold">Гэрээний загвар (PDF) ↗</a>
        </div>
        <span className="text-[14px] text-muted">Хэрэглэгч зар оруулахын өмнө энэ нөхцөлтэй гэрээнд гарын үсэг зурна. Хоног нь зар нийтлэгдсэнээс тоологдоно. Өөрчлөлт зөвхөн шинэ гэрээнд үйлчилнэ.</span>
        <label className="label text-[14px]">Үйлчилгээ үзүүлэгч (компанийн нэр)
          <input name="company" required defaultValue={ct.company} className="input" />
        </label>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap text-[14px]">
              <input name={`days${i + 1}`} type="number" min={1} defaultValue={ct.terms.tiers[i]?.days ?? ""} className="input mono w-20" aria-label={`${i + 1}-р шатны хоног`} />
              <span>хоногийн дотор зарагдвал</span>
              <input name={`pct${i + 1}`} type="number" step="0.1" min={0} max={100} defaultValue={ct.terms.tiers[i]?.percent ?? ""} className="input mono w-20" aria-label={`${i + 1}-р шатны хувь`} />
              <span>%</span>
            </div>
          ))}
          <div className="flex items-center gap-2 flex-wrap text-[14px]">
            <span>Түүнээс хойш зарагдвал</span>
            <input name="after" type="number" step="0.1" min={0} max={100} defaultValue={ct.terms.after} className="input mono w-20" aria-label="Сүүлийн шатнаас хойшхи хувь" />
            <span>%</span>
          </div>
        </div>
        <div className="flex justify-end"><button className="btn btn-ink h-12">Хадгалах</button></div>
      </form>
      <form action={saveSettings} className="flex flex-col gap-4.5 max-w-[920px]">
        <input type="hidden" name="back" value="/admin/settings" />
        <section className="card p-5.5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[17px] font-bold">Санал тооцох хувь</h2>
            <span className="text-[14px] text-muted">Менежер хэрэглэгчид тавих саналыг машины үнээс энэ хувиар тооцно.</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-[14px] font-semibold">
              Хувь
              <input name="offer_percent" inputMode="decimal" defaultValue={s.offer_percent ?? ""} placeholder="жиш. 3" className="input mono w-[120px] text-center border-2 border-ink font-bold" />
              <span className="mono font-bold text-[18px]">%</span>
            </label>
            <span className="mono text-[14px] text-body bg-paper px-3 py-2.5 rounded-[10px]">Жишээ: 50,000,000₮ × {s.offer_percent ?? "[ХУВЬ]"}% = {ex}</span>
          </div>
        </section>
        <section className="card p-5.5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[17px] font-bold">Зарын ангилал</h2>
            <span className="text-[14px] text-muted">Үйлдвэрлэсэн оноор автоматаар хоёр ангилалд хуваана. Өөрчлөхөд бүх зар шинээр ангилагдана.</span>
          </div>
          <label className="flex items-center gap-2.5 text-[14px] font-semibold flex-wrap">
            Зааг он
            <input name="cutoff_year" type="number" defaultValue={s.cutoff_year} className="input mono w-[120px] text-center" />
            <span className="font-normal text-body">→ “{s.cutoff_year} ба хойш” / “{s.cutoff_year}-аас өмнө”</span>
          </label>
        </section>
        <section className="card p-5.5 flex flex-col">
          <h2 className="m-0 mb-2.5 text-[17px] font-bold">Мэдэгдэл</h2>
          <label className="flex justify-between items-center gap-4 py-3 border-b border-[#ecede9] text-[14px]">
            <span className="flex flex-col gap-0.5"><span className="font-semibold">Шинэ зар батлагдахад бүх хэрэглэгчид мэдэгдэх</span><span className="text-muted text-[13px]">Хэрэглэгч өөрийн шүүлтүүрээр хязгаарлаж болно</span></span>
            <input type="checkbox" name="notify_all" defaultChecked={s.notify_all_on_approve} className="w-5 h-5 accent-ink shrink-0" />
          </label>
          <label className="flex justify-between items-center gap-4 py-3 text-[14px]">
            <span className="font-semibold">Шинэ зар ирэхэд менежерүүдэд мэдэгдэх</span>
            <input type="checkbox" name="notify_staff" defaultChecked={s.notify_staff_on_new} className="w-5 h-5 accent-ink shrink-0" />
          </label>
        </section>
        <section className="card p-5.5 flex flex-wrap gap-4">
          <h2 className="m-0 text-[17px] font-bold basis-full">Зарын дүрэм</h2>
          <label className="label flex-[1_1_200px] text-[14px]">Хамгийн их зураг<input name="max_photos" type="number" min={1} max={16} defaultValue={s.max_photos} className="input mono" /></label>
          <label className="label flex-[1_1_200px] text-[14px]">Хамгийн бага зураг<input name="min_photos" type="number" min={1} max={16} defaultValue={s.min_photos} className="input mono" /></label>
          <label className="label flex-[1_1_200px] text-[14px]">Зарын хугацаа (хоног)<input name="ad_days" type="number" min={1} defaultValue={s.ad_days} className="input mono" /></label>
        </section>
        <div className="flex justify-end gap-2.5">
          <button className="btn btn-lg btn-yellow">Хадгалах</button>
        </div>
      </form>
    </PanelShell>
  );
}
