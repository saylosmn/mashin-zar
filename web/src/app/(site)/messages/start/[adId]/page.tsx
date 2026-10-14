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
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("ad_id", adId)
    .eq("buyer_id", me.id)
    .maybeSingle();
  if (existing) redirect(`/messages/${existing.id}`);
  const { data: ad } = await supabase
    .from("public_ads")
    .select("id,brand,model,year_made,price,photos,user_id,seller_name,seller_shop")
    .eq("id", adId)
    .maybeSingle();
  if (!ad) notFound();
  if (ad.user_id === me.id) redirect(`/ads/${adId}`);

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <Link href={`/ads/${ad.id}`} className="card flex items-center gap-3 p-3 no-underline">
        <CarPhoto path={ad.photos?.[0]} alt="" className="h-[66px] w-[88px] shrink-0 rounded-lg" label="IMG" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-semibold">
            {ad.brand} {ad.model} · {ad.year_made}
          </span>
          <span className="h-display text-[15px]">{money(ad.price)}</span>
          <span className="text-[12px] text-muted">{ad.seller_shop ?? ad.seller_name}</span>
        </div>
      </Link>
      <h1 className="h-display m-0 text-[22px]">Худалдагчид бичих</h1>
      <StartChatForm adId={ad.id} />
      <p className="m-0 text-[12px] leading-relaxed text-muted">
        Урьдчилгаа мөнгө машинаа үзэхээс өмнө бүү шилжүүл. Чатыг аюулгүй байдлын үүднээс манай ажилтан харах боломжтой.
      </p>
    </main>
  );
}
