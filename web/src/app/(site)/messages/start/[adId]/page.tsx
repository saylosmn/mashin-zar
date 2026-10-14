import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { money } from "@/lib/format";
import { CarPhoto } from "@/components/CarPhoto";
import { StartChatForm } from "./StartChatForm";

export const metadata = { title: "Чат эхлүүлэх" };

export default async function StartChatPage({ params }: { params: Promise<{ adId: string }> }) {
  const { adId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(adId)) notFound();
  const me = await requireUser(`/messages/start/${adId}`);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("conversations").select("id").eq("ad_id", adId).eq("buyer_id", me.id).maybeSingle();
  if (existing) redirect(`/messages/${existing.id}`);
  const { data: ad } = await supabase.from("public_ads").select("id,brand,model,year_made,price,photos,user_id,seller_name,seller_shop").eq("id", adId).maybeSingle();
  if (!ad) notFound();
  if (ad.user_id === me.id) redirect(`/ads/${adId}`);

  return (
    <main className="max-w-[640px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-5">
      <Link href={`/ads/${ad.id}`} className="card p-3 flex items-center gap-3 no-underline">
        <CarPhoto path={ad.photos?.[0]} alt="" className="w-[88px] h-[66px] rounded-lg shrink-0" label="IMG" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-semibold truncate">{ad.brand} {ad.model} · {ad.year_made}</span>
          <span className="h-display text-[15px]">{money(ad.price)}</span>
          <span className="text-[12px] text-muted">{ad.seller_shop ?? ad.seller_name}</span>
        </div>
      </Link>
      <h1 className="h-display m-0 text-[22px]">Худалдагчид бичих</h1>
      <StartChatForm adId={ad.id} />
      <p className="m-0 text-[12px] text-muted leading-relaxed">
        Урьдчилгаа мөнгө машинаа үзэхээс өмнө бүү шилжүүл. Чатыг аюулгүй байдлын үүднээс манай ажилтан харах боломжтой.
      </p>
    </main>
  );
}
