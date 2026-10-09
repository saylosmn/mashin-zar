"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/data";

function back(fd: FormData, fallback: string, extra: Record<string, string>) {
  const to = String(fd.get("back") || fallback);
  const url = new URL(to, "http://x");
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  url.searchParams.delete(extra.ok ? "err" : "ok");
  return url.pathname + url.search;
}

async function run(fd: FormData, fallback: string, ok: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await fn();
  revalidatePath("/", "layout");
  redirect(back(fd, fallback, error ? { err: error.message } : { ok }));
}

// ---------- Менежер ----------
export async function approveAd(fd: FormData) {
  await requireStaff();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_ad", { p_ad: id });
  revalidatePath("/", "layout");
  redirect(back(fd, "/manager/ads", error ? { err: error.message } : { ok: "Зар батлагдаж, хэрэглэгчдэд мэдэгдэл илгээгдлээ" }));
}

export async function rejectAd(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const note = String(fd.get("note") || "") || null;
  const { error } = await supabase.rpc("reject_ad", { p_ad: id, p_note: note });
  revalidatePath("/", "layout");
  redirect(back(fd, "/manager/ads", error ? { err: error.message } : { ok: "Зар татгалзагдлаа" }));
}

export async function markContacted(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  await run(fd, "/manager/ads", "Холбогдсон гэж тэмдэглэлээ", () =>
    supabase.rpc("mark_contacted", { p_ad: String(fd.get("id")), p_note: String(fd.get("note") || "") || null }),
  );
}

export async function saveNote(fd: FormData) {
  await requireStaff();
  const supabase = await createClient();
  await run(fd, "/manager/ads", "Тэмдэглэл хадгалагдлаа", () =>
    supabase.rpc("save_note", { p_ad: String(fd.get("id")), p_note: String(fd.get("note") || "") }),
  );
}

export async function sendOffer(fd: FormData) {
  await requireStaff();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_offer", { p_ad: id });
  revalidatePath("/", "layout");
  redirect(back(fd, "/manager/ads", error ? { err: error.message } : { ok: "Санал хэрэглэгчид илгээгдлээ" }));
}

export async function markSold(fd: FormData) {
  await requireStaff();
  const id = String(fd.get("id"));
  const price = Number(String(fd.get("price") || "").replace(/\D/g, "")) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_sold", { p_ad: id, p_price: price });
  revalidatePath("/", "layout");
  redirect(back(fd, "/manager/all", error ? { err: error.message } : { ok: "Зарагдсан гэж тэмдэглэлээ" }));
}

// ---------- Админ ----------
export async function setBlocked(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const blocked = fd.get("blocked") === "1";
  await run(fd, "/admin/users", blocked ? "Аккаунт хаагдлаа" : "Аккаунт нээгдлээ", () =>
    supabase.rpc("set_blocked", { p_user: String(fd.get("id")), p_blocked: blocked }),
  );
}

export async function inviteStaff(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const email = String(fd.get("email") || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/admin/users?err=" + encodeURIComponent("И-мэйл буруу байна"));
  await run(fd, "/admin/users", `${email} менежерийн эрхтэй боллоо. Тэр Google-ээр нэвтэрмэгц панел нээгдэнэ.`, () =>
    supabase.rpc("invite_staff", {
      p_email: email,
      p_role: String(fd.get("role") || "manager"),
      p_name: String(fd.get("name") || "") || null,
      p_phone: String(fd.get("phone") || "") || null,
    }),
  );
}

export async function removeStaff(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/users", "Менежерийн эрх хасагдлаа", () => supabase.rpc("remove_staff", { p_user: String(fd.get("id")) }));
}

export async function deleteInvite(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/users", "Урилга устгагдлаа", () => supabase.from("staff_invites").delete().eq("email", String(fd.get("email"))));
}

export async function adminDeleteAd(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data: ad } = await supabase.from("ads").select("photos").eq("id", id).maybeSingle();
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (!error && ad?.photos?.length) await supabase.storage.from("ad-photos").remove(ad.photos);
  revalidatePath("/", "layout");
  redirect(back(fd, "/admin/ads", error ? { err: error.message } : { ok: "Зар устгагдлаа" }));
}

export async function adminUpdateAd(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const price = Number(String(fd.get("price") || "").replace(/\D/g, ""));
  await run(fd, "/admin/ads", "Зар шинэчлэгдлээ", () =>
    supabase
      .from("ads")
      .update({
        brand: String(fd.get("brand")),
        model: String(fd.get("model")),
        trim: String(fd.get("trim") || "") || null,
        year_made: Number(fd.get("year_made")),
        year_imported: Number(fd.get("year_imported")) || null,
        price,
        description: String(fd.get("description") || "") || null,
      })
      .eq("id", id),
  );
}

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const pct = String(fd.get("offer_percent") || "").replace(",", ".");
  await run(fd, "/admin/settings", "Тохиргоо хадгалагдлаа", () =>
    supabase.rpc("update_settings", {
      p_offer_percent: pct ? Number(pct) : null,
      p_cutoff_year: Number(fd.get("cutoff_year")) || 2016,
      p_max_photos: Number(fd.get("max_photos")) || 16,
      p_min_photos: Number(fd.get("min_photos")) || 3,
      p_ad_days: Number(fd.get("ad_days")) || 60,
      p_notify_all: fd.get("notify_all") === "on",
      p_notify_staff: fd.get("notify_staff") === "on",
    }),
  );
}

export async function saveAppLink(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const url = String(fd.get("apk_url") || "").trim();
  if (url && !/^https:\/\//.test(url)) redirect("/admin/settings?err=" + encodeURIComponent("Холбоос https:// -ээр эхлэх ёстой"));
  await run(fd, "/admin/settings", "Апп татах холбоос хадгалагдлаа", () =>
    supabase.rpc("set_app_link", { p_url: url, p_version: String(fd.get("apk_version") || "") || null }),
  );
}

export async function sendBroadcast(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const title = String(fd.get("title") || "").trim();
  const body = String(fd.get("body") || "").trim() || null;
  const { data, error } = await supabase.rpc("broadcast", { p_title: title, p_body: body });
  revalidatePath("/", "layout");
  redirect(back(fd, "/admin/notifications", error ? { err: error.message } : { ok: `${data ?? 0} хэрэглэгчид зарлал илгээгдлээ` }));
}

export async function deleteBroadcast(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/notifications", "Зарлал бүх хэрэглэгчээс устгагдлаа", () =>
    supabase.rpc("delete_broadcast", { p_id: String(fd.get("id")) }),
  );
}

export async function resendBroadcast(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resend_broadcast", { p_id: String(fd.get("id")) });
  revalidatePath("/", "layout");
  redirect(back(fd, "/admin/notifications", error ? { err: error.message } : { ok: `Дахин илгээгдлээ (${data ?? 0} хэрэглэгч)` }));
}
