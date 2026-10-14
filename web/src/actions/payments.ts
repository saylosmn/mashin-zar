"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { backUrl } from "./helpers";

/** Админ: төлбөр батлах / ороогүй */
export async function decidePayment(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const approve = fd.get("approve") === "1";
  const { data, error } = await supabase.rpc("decide_payment", {
    p_id: String(fd.get("id")),
    p_approve: approve,
    p_note: String(fd.get("note") || "").trim() || null,
  });
  revalidatePath("/", "layout");
  redirect(backUrl(fd, "/admin/payments", error ? { err: error.message } : { ok: String(data ?? "Хадгалагдлаа") }));
}
