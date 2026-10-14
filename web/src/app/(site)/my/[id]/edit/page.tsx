import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireUser } from "@/lib/data";
import { EditAdForm } from "./EditAdForm";
import type { Ad } from "@shared/types";

export const metadata = { title: "Зар засах" };

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser(`/my/${id}/edit`);
  if (me.role !== "dealer" && me.role !== "admin") redirect("/my");
  const supabase = await createClient();
  const { data } = await supabase.from("ads").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const ad = data as Ad;
  if (ad.user_id !== me.id && me.role !== "admin") redirect("/my");
  if (ad.status === "sold") redirect("/my?err=" + encodeURIComponent("Зарагдсан зарыг засах боломжгүй"));
  const settings = await getSettings();
  return (
    <main className="mx-auto flex w-full max-w-[900px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <Link href="/my" className="text-[14px] text-muted">
        ← Миний зарууд
      </Link>
      <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Зар засах</h1>
      <EditAdForm ad={ad} userId={me.id} maxPhotos={settings.max_photos} />
    </main>
  );
}
