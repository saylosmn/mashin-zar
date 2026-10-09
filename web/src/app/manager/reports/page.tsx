import { createClient } from "@/lib/supabase/server";
import { getSettings, requireStaff } from "@/lib/data";
import { pendingCount } from "@/lib/panel";
import { REPORT_SELECT, reportableAds, type ReportRow } from "@/lib/reports";
import { Flash, PanelShell } from "@/components/PanelShell";
import { SaleReportForm } from "@/components/SaleReportForm";
import { ReportList } from "@/components/ReportList";
import { submitSaleReport } from "../../panel-actions";

export const metadata = { title: "Менежер · Тайлан" };

export default async function ManagerReports({ searchParams }: { searchParams: Promise<{ ad?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireStaff();
  const supabase = await createClient();
  const settings = await getSettings();
  const [pending, ads, mine] = await Promise.all([
    pendingCount(),
    reportableAds(settings),
    supabase.from("sale_reports").select(REPORT_SELECT).eq("manager_id", me.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const rows = (mine.data ?? []) as unknown as ReportRow[];
  const back = "/manager/reports";
  return (
    <PanelShell profile={me} area="manager" active="mgr-reports" pending={pending}>
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[28px]">Тайлан</h1>
        <span className="text-[14px] text-muted">Зарсан машинаа админд тайлагнана. Шимтгэлийг гэрээний нөхцөлөөр автоматаар тооцно.</span>
      </div>
      <Flash ok={sp.ok} err={sp.err ?? (mine.error ? `Тайлан уншиж чадсангүй: ${mine.error.message}` : undefined)} />
      <div className="max-w-[860px] flex flex-col gap-5">
        <SaleReportForm ads={ads} defaultAd={sp.ad} action={submitSaleReport} back={back} />
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-[17px] font-bold">Миний илгээсэн тайлангууд</h2>
          <ReportList rows={rows} back={back} />
        </section>
      </div>
    </PanelShell>
  );
}
