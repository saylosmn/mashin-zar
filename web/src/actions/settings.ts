"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { run } from "./helpers";

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
  if (url && !/^https:\/\//.test(url))
    redirect("/admin/settings?err=" + encodeURIComponent("Холбоос https:// -ээр эхлэх ёстой"));
  await run(fd, "/admin/settings", "Апп татах холбоос хадгалагдлаа", () =>
    supabase.rpc("set_app_link", { p_url: url, p_version: String(fd.get("apk_version") || "") || null }),
  );
}

export async function saveContractSettings(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const n = (k: string) => Number(String(fd.get(k) || "").replace(",", "."));
  const tiers = [1, 2, 3]
    .map((i) => ({ days: n(`days${i}`), percent: n(`pct${i}`) }))
    .filter((t) => t.days > 0 && t.percent >= 0);
  await run(fd, "/admin/settings", "Гэрээний нөхцөл хадгалагдлаа", () =>
    supabase.rpc("update_contract_settings", {
      p_company: String(fd.get("company") || ""),
      p_tiers: tiers,
      p_after: n("after"),
    }),
  );
}

export async function saveGrowthSettings(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const n = (k: string) =>
    Number(
      String(fd.get(k) || "")
        .replace(/[^\d.,]/g, "")
        .replace(",", "."),
    );
  await run(fd, "/admin/settings", "Хадгалагдлаа", () =>
    supabase.rpc("update_growth_settings", {
      p_agent_share: n("agent_share"),
      p_featured_price: Math.round(n("featured_price")),
      p_featured_days: Math.round(n("featured_days")),
      p_site_url: String(fd.get("site_url") || ""),
    }),
  );
}

export async function savePaymentSettings(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/settings", "Хадгалагдлаа", () =>
    supabase.rpc("update_payment_settings", {
      p_bank: String(fd.get("pay_bank") || ""),
      p_account: String(fd.get("pay_account") || ""),
      p_holder: String(fd.get("pay_holder") || ""),
      p_commission_featured_days: Math.round(Number(fd.get("commission_featured_days") || 0)),
    }),
  );
}

/** SMS апп-ын түлхүүрийг солино - хуучин түлхүүртэй утас холбогдохоо болино */
export async function regenSmsKey(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/settings", "SMS апп-ын шинэ түлхүүр үүслээ — утсан дээрх апп-д шинээр оруулна уу", () =>
    supabase.rpc("regen_sms_key"),
  );
}

export async function clearErrors(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(fd.get("id") || "");
  await run(fd, "/admin/errors", id ? "Устгагдлаа" : "Бүх бүртгэл цэвэрлэгдлээ", () =>
    id ? supabase.from("error_logs").delete().eq("id", Number(id)) : supabase.from("error_logs").delete().gt("id", 0),
  );
}
