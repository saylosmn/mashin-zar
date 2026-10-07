import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { StatusBadge } from "@/components/StatusBadge";
import { adminUpdateAd } from "../../../panel-actions";
import type { Ad } from "@/lib/types";

export const metadata = { title: "Админ · Зар засах" };

export default async function EditAd({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("ads").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const ad = data as Ad;
  const pending = await pendingCount();
  return (
    <PanelShell profile={me} area="admin" active="admin-ads" pending={pending}>
      <Link href="/admin/ads" className="text-[14px] text-muted">← Бүх зар</Link>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="h-display m-0 text-[26px]">Зар засах</h1>
        <StatusBadge status={ad.status} />
      </div>
      <Flash ok={sp.ok} err={sp.err} />
      <form action={adminUpdateAd} className="card p-6 flex flex-wrap gap-4 max-w-[860px]">
        <input type="hidden" name="id" value={ad.id} />
        <input type="hidden" name="back" value={`/admin/ads/${ad.id}`} />
        <label className="label flex-[1_1_220px]">Марк<input name="brand" required defaultValue={ad.brand} className="input" /></label>
        <label className="label flex-[1_1_220px]">Загвар<input name="model" required defaultValue={ad.model} className="input" /></label>
        <label className="label flex-[1_1_220px]">Сер<input name="trim" defaultValue={ad.trim ?? ""} className="input" /></label>
        <label className="label flex-[1_1_160px]">Үйлдвэрлэсэн он<input name="year_made" type="number" required defaultValue={ad.year_made} className="input mono" /></label>
        <label className="label flex-[1_1_160px]">Орж ирсэн он<input name="year_imported" type="number" defaultValue={ad.year_imported ?? ""} className="input mono" /></label>
        <label className="label flex-[1_1_220px]">Үнэ (₮)<input name="price" required defaultValue={ad.price} className="input mono" /></label>
        <label className="label basis-full">Тайлбар<textarea name="description" defaultValue={ad.description ?? ""} className="textarea font-normal" /></label>
        <div className="basis-full flex gap-2.5 justify-end">
          <Link href={`/ads/${ad.id}`} className="btn btn-lg btn-ghost">Зар үзэх</Link>
          <button className="btn btn-lg btn-yellow">Хадгалах</button>
        </div>
      </form>
    </PanelShell>
  );
}
