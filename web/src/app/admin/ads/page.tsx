import Link from "next/link";
import { getSettings, requireAdmin } from "@/lib/data";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { AdsTable } from "@/components/AdsTable";

export const metadata = { title: "Админ · Бүх зар" };

export default async function AdminAds({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const [settings, pending] = await Promise.all([getSettings(), pendingCount()]);
  return (
    <PanelShell profile={me} area="admin" active="admin-ads" pending={pending}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="h-display m-0 text-[28px]">Бүх зар</h1>
        <Link href="/post" className="btn btn-ink">+ Зар нэмэх</Link>
      </div>
      <Flash ok={sp.ok} err={sp.err} />
      <AdsTable basePath="/admin/ads" sp={sp} admin cutoff={settings.cutoff_year} featuredDays={settings.featured_days ?? 7} />
    </PanelShell>
  );
}
