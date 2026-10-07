"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";

export async function saveFilterAlert(fd: FormData) {
  const me = await requireUser();
  const supabase = await createClient();
  const cat = String(fd.get("cat") || "");
  const brand = String(fd.get("brand") || "");
  const pmax = Number(fd.get("pmax")) || null;
  await supabase
    .from("profiles")
    .update({
      notify_new_ads: true,
      notify_category: cat === "new" || cat === "old" ? cat : null,
      notify_brand: brand || null,
      notify_max_price: pmax ? pmax * 1_000_000 : null,
    })
    .eq("id", me.id);
  redirect("/notifications?saved=1");
}

export async function toggleFavorite(adId: string, on: boolean) {
  const me = await requireUser();
  const supabase = await createClient();
  if (on) await supabase.from("favorites").upsert({ user_id: me.id, ad_id: adId });
  else await supabase.from("favorites").delete().eq("user_id", me.id).eq("ad_id", adId);
  revalidatePath("/my");
}

export async function deleteMyAd(fd: FormData) {
  const me = await requireUser();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data: ad } = await supabase.from("ads").select("photos,user_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("ads").delete().eq("id", id).eq("user_id", me.id);
  if (!error && ad?.photos?.length) await supabase.storage.from("ad-photos").remove(ad.photos);
  revalidatePath("/my");
  redirect(error ? "/my?error=delete" : "/my?deleted=1");
}

export async function markAllRead() {
  const me = await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  revalidatePath("/", "layout");
}

export async function saveNotifyPrefs(fd: FormData) {
  const me = await requireUser();
  const supabase = await createClient();
  const cat = String(fd.get("notify_category") || "");
  const pmax = Number(fd.get("notify_max_price")) || null;
  await supabase
    .from("profiles")
    .update({
      notify_new_ads: fd.get("notify_new_ads") === "on",
      notify_category: cat === "new" || cat === "old" ? cat : null,
      notify_brand: String(fd.get("notify_brand") || "") || null,
      notify_max_price: pmax ? pmax * 1_000_000 : null,
    })
    .eq("id", me.id);
  revalidatePath("/notifications");
  redirect("/notifications?saved=1");
}

export async function saveProfile(fd: FormData) {
  const me = await requireUser();
  const supabase = await createClient();
  const full_name = String(fd.get("full_name") || "").trim();
  const phone = String(fd.get("phone") || "").replace(/[^\d+]/g, "");
  const city = String(fd.get("city") || "");
  const next = String(fd.get("next") || "");
  if (!full_name || phone.length < 8 || fd.get("consent") !== "on") {
    redirect(`/profile?error=1${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone, city, profile_completed: true })
    .eq("id", me.id);
  if (error) redirect(`/profile?error=2${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  revalidatePath("/", "layout");
  redirect(next && next.startsWith("/") ? next : "/profile?saved=1");
}
