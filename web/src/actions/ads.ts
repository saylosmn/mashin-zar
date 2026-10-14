"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/data";
import { backUrl, run } from "./helpers";

export async function approveAd(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_ad", { p_ad: id });
  revalidatePath("/", "layout");
  redirect(
    backUrl(
      fd,
      "/admin/review",
      error ? { err: error.message } : { ok: "Зар батлагдаж, хэрэглэгчдэд мэдэгдэл илгээгдлээ" },
    ),
  );
}

export async function rejectAd(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const note = String(fd.get("note") || "") || null;
  const { error } = await supabase.rpc("reject_ad", { p_ad: id, p_note: note });
  revalidatePath("/", "layout");
  redirect(backUrl(fd, "/admin/review", error ? { err: error.message } : { ok: "Зар татгалзагдлаа" }));
}

export async function markContacted(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/review", "Холбогдсон гэж тэмдэглэлээ", () =>
    supabase.rpc("mark_contacted", { p_ad: String(fd.get("id")), p_note: String(fd.get("note") || "") || null }),
  );
}

export async function saveNote(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/review", "Тэмдэглэл хадгалагдлаа", () =>
    supabase.rpc("save_note", { p_ad: String(fd.get("id")), p_note: String(fd.get("note") || "") }),
  );
}

export async function sendOffer(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_offer", { p_ad: id });
  revalidatePath("/", "layout");
  redirect(backUrl(fd, "/admin/review", error ? { err: error.message } : { ok: "Санал хэрэглэгчид илгээгдлээ" }));
}

export async function markSold(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const price = Number(String(fd.get("price") || "").replace(/\D/g, "")) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_sold", { p_ad: id, p_price: price });
  revalidatePath("/", "layout");
  redirect(backUrl(fd, "/admin/ads", error ? { err: error.message } : { ok: "Зарагдсан гэж тэмдэглэлээ" }));
}

export async function adminDeleteAd(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data: ad } = await supabase.from("ads").select("photos").eq("id", id).maybeSingle();
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (!error && ad?.photos?.length) await supabase.storage.from("ad-photos").remove(ad.photos);
  revalidatePath("/", "layout");
  redirect(backUrl(fd, "/admin/ads", error ? { err: error.message } : { ok: "Зар устгагдлаа" }));
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

export async function setAdAgent(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/review", "Агент оноогдлоо", () =>
    supabase.rpc("set_ad_agent", { p_ad: String(fd.get("id")), p_agent: String(fd.get("agent_id") || "") || null }),
  );
}

export async function setFeatured(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const days = Number(fd.get("days")) || 0;
  await run(fd, "/admin/ads", days ? `Зар ${days} хоног онцлох боллоо` : "Онцлох байдал цуцлагдлаа", () =>
    supabase.rpc("set_featured", { p_ad: String(fd.get("id")), p_days: days }),
  );
}

/** Авто худалдаа: зараа нуух / дахин гаргах / зарагдсан болгох */
export async function dealerSetStatus(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  const status = String(fd.get("status"));
  const msg =
    status === "hidden" ? "Зар нуугдлаа" : status === "active" ? "Зар дахин нийтлэгдлээ" : "Зарагдсан гэж тэмдэглэлээ";
  const price = Number(String(fd.get("price") || "").replace(/\D/g, "")) || null;
  await run(fd, "/my", msg, () =>
    supabase.rpc("dealer_set_status", { p_ad: String(fd.get("id")), p_status: status, p_price: price }),
  );
}

export async function resolveFlag(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const action = String(fd.get("action"));
  const msg =
    action === "hide"
      ? "Зар нуугдаж, эзэнд мэдэгдэл очлоо"
      : action === "dismiss"
        ? "Гомдол хаагдлаа"
        : "Шийдвэрлэсэн гэж тэмдэглэлээ";
  await run(fd, "/admin/flags", msg, () =>
    supabase.rpc("resolve_flag", {
      p_id: String(fd.get("id")),
      p_action: action,
      p_note: String(fd.get("note") || "") || null,
    }),
  );
}
