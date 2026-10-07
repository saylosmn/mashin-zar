import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Settings } from "./types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  return (data as Profile) ?? null;
});

/** Нэвтэрсэн, хаагдаагүй хэрэглэгч шаардана. */
export async function requireUser(next?: string): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (p.is_blocked) redirect("/blocked");
  return p;
}

export async function requireStaff(): Promise<Profile> {
  const p = await requireUser();
  if (p.role !== "manager" && p.role !== "admin") redirect("/");
  return p;
}

export async function requireAdmin(): Promise<Profile> {
  const p = await requireUser();
  if (p.role !== "admin") redirect(p.role === "manager" ? "/manager" : "/");
  return p;
}

export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  return (
    (data as Settings) ?? {
      offer_percent: null,
      cutoff_year: 2016,
      max_photos: 16,
      min_photos: 3,
      ad_days: 60,
      notify_all_on_approve: true,
      notify_staff_on_new: true,
    }
  );
});

export async function unreadCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}
