"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { backUrl, run } from "./helpers";

export async function sendBroadcast(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const title = String(fd.get("title") || "").trim();
  const body = String(fd.get("body") || "").trim() || null;
  const { data, error } = await supabase.rpc("broadcast", { p_title: title, p_body: body });
  revalidatePath("/", "layout");
  redirect(
    backUrl(
      fd,
      "/admin/notifications",
      error ? { err: error.message } : { ok: `${data ?? 0} хэрэглэгчид зарлал илгээгдлээ` },
    ),
  );
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
  redirect(
    backUrl(
      fd,
      "/admin/notifications",
      error ? { err: error.message } : { ok: `Дахин илгээгдлээ (${data ?? 0} хэрэглэгч)` },
    ),
  );
}
