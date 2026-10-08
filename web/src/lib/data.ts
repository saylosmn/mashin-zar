import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Settings } from "./types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // getClaims нь JWT-г сервер дээр шалгадаг тул Supabase руу нэмэлт хүсэлт явуулахгүй (хурдан)
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  // Эрхийн алдааг нэвтрэх хуудас руу дахин буцаах биш, алдааны хуудсаар харуулна.
  if (error) redirect(`/setup-error?m=${encodeURIComponent(`Профайл уншиж чадсангүй: ${error.message}`)}`);
  if (data) return data as Profile;
  // Профайл байхгүй бол (trigger ажиллаагүй үед) өөрөө үүсгэнэ.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const meta = auth.user.user_metadata ?? {};
  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert({
      id: auth.user.id,
      email: auth.user.email,
      full_name: meta.full_name ?? meta.name ?? null,
      avatar_url: meta.avatar_url ?? null,
    })
    .select("*")
    .single();
  if (insErr) redirect(`/setup-error?m=${encodeURIComponent(`Профайл үүсгэж чадсангүй: ${insErr.message}`)}`);
  return created as Profile;
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
