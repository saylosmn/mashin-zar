"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { backUrl, run } from "./helpers";

/** "YYYY-MM-DD" -> тухайн өдрийн Улаанбаатарын 12:00 (өнөөдөр бол одоо) */
function soldAtFrom(d: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());
  if (!d || d === today) return new Date().toISOString();
  return new Date(`${d}T12:00:00+08:00`).toISOString();
}

export async function submitSaleReport(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const price = Number(String(fd.get("price") || "").replace(/\D/g, ""));
  const { data: rid, error } = await supabase.rpc("submit_sale_report", {
    p_ad: String(fd.get("ad_id") || ""),
    p_price: price || null,
    p_sold_at: soldAtFrom(String(fd.get("sold_at") || "")),
    p_buyer_name: String(fd.get("buyer_name") || "") || null,
    p_buyer_phone: String(fd.get("buyer_phone") || "") || null,
    p_note: String(fd.get("note") || "") || null,
    p_agent: String(fd.get("agent_id") || "") || null,
  });
  // Админ өөрөө бүртгэж буй тул шууд батална: зар зарагдсан болж, агентын хувь бодогдоно
  if (!error && rid) {
    const { error: revErr } = await supabase.rpc("review_sale_report", { p_id: rid, p_approve: true, p_note: null });
    revalidatePath("/", "layout");
    redirect(
      backUrl(
        fd,
        "/admin/reports",
        revErr
          ? { err: `Тайлан хадгалагдсан ч батлагдсангүй: ${revErr.message}` }
          : { ok: "Тайлан батлагдаж, зар зарагдсан боллоо" },
      ),
    );
  }
  revalidatePath("/", "layout");
  redirect(backUrl(fd, "/admin/reports", { err: error?.message ?? "Тайлан хадгалагдсангүй" }));
}

export async function reviewSaleReport(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const approve = fd.get("approve") === "1";
  await run(fd, "/admin/reports", approve ? "Тайлан батлагдаж, зар зарагдсан боллоо" : "Тайлан буцаагдлаа", () =>
    supabase.rpc("review_sale_report", {
      p_id: String(fd.get("id")),
      p_approve: approve,
      p_note: String(fd.get("note") || "") || null,
    }),
  );
}

export async function setAgentPaid(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const paid = fd.get("paid") === "1";
  await run(
    fd,
    "/admin/reports?tab=approved",
    paid ? "Агентын шимтгэл төлсөн гэж тэмдэглэлээ" : "Төлөөгүй болголоо",
    () => supabase.rpc("set_agent_paid", { p_id: String(fd.get("id")), p_paid: paid }),
  );
}
