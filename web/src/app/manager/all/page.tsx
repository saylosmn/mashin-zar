import { getSettings, requireStaff } from "@/lib/data";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { AdsTable } from "@/components/AdsTable";

export const metadata = { title: "Менежер · Бүх зар" };

export default async function ManagerAll({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await requireStaff();
  const [settings, pending] = await Promise.all([getSettings(), pendingCount()]);
  const sold = sp.status === "sold";
  return (
    <PanelShell profile={me} area="manager" active={sold ? "mgr-sold" : "mgr-all"} pending={pending}>
      <h1 className="h-display m-0 text-[28px]">{sold ? "Зарагдсан машинууд" : "Бүх зар"}</h1>
      <Flash ok={sp.ok} err={sp.err} />
      <AdsTable basePath="/manager/all" sp={sp} admin={me.role === "admin"} cutoff={settings.cutoff_year} />
    </PanelShell>
  );
}
