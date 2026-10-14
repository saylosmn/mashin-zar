"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/data";
import { run } from "./helpers";

export async function cancelLoanRequest(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  await run(fd, "/loans", "Хүсэлт цуцлагдлаа", () =>
    supabase.rpc("cancel_loan_request", { p_id: String(fd.get("id")) }),
  );
}

export async function updateLoanRequest(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  const status = String(fd.get("status"));
  const label: Record<string, string> = {
    contacted: "Холбогдсон",
    approved: "Зөвшөөрсөн",
    rejected: "Татгалзсан",
    new: "Шинэ",
  };
  await run(fd, "/leasing", `Төлөв: ${label[status] ?? status}`, () =>
    supabase.rpc("update_loan_request", {
      p_id: String(fd.get("id")),
      p_status: status,
      p_note: String(fd.get("note") || "") || null,
    }),
  );
}

export async function savePartnerTerms(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  const v = (k: string) =>
    String(fd.get(k) ?? "")
      .replace(/\s/g, "")
      .replace(",", ".");
  await run(fd, "/leasing?tab=terms", "Нөхцөл, шаардлага хадгалагдлаа", () =>
    supabase.rpc("set_partner_terms", {
      p_partner: String(fd.get("partner_id") || ""),
      p: {
        rate_annual: v("rate"),
        min_down_pct: v("min_down"),
        max_term_months: v("max_term"),
        min_age: v("min_age"),
        max_age: v("max_age"),
        min_work_months: v("min_work"),
        min_business_months: v("min_business"),
        max_dti: v("max_dti"),
        min_car_year: v("min_car_year"),
        cosigner_over: v("cosigner_over").replace(/\D/g, ""),
        required_docs: fd.getAll("required_docs").map(String),
        requirements_note: String(fd.get("requirements_note") ?? ""),
      },
    }),
  );
}

export async function upsertPartner(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const n = (k: string) => {
    const v = String(fd.get(k) || "").replace(",", ".");
    return v ? Number(v) : null;
  };
  await run(fd, "/admin/leasing", "Лизингийн компани хадгалагдлаа", () =>
    supabase.rpc("upsert_partner", {
      p_id: String(fd.get("id") || "") || null,
      p_name: String(fd.get("name") || ""),
      p_phone: String(fd.get("phone") || ""),
      p_rate: n("rate"),
      p_min_down: n("min_down"),
      p_max_term: n("max_term"),
      p_trial_until: String(fd.get("trial_until") || "") || null,
      p_active: fd.get("active") === "on",
    }),
  );
}

export async function inviteLeasingStaff(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const email = String(fd.get("email") || "").trim();
  await run(fd, "/admin/leasing", `${email} лизингийн панелд нэвтрэх эрхтэй боллоо`, () =>
    supabase.rpc("invite_leasing_staff", { p_email: email, p_partner: String(fd.get("partner_id") || "") }),
  );
}

export async function removeLeasingStaff(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/leasing", "Лизингийн ажилтны эрх хасагдлаа", () =>
    supabase.rpc("remove_leasing_staff", { p_user: String(fd.get("id")) }),
  );
}
