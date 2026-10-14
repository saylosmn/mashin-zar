"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { run } from "./helpers";

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
  await run(fd, "/admin/users", `${email} админ эрхтэй боллоо. Тэр Google-ээр нэвтэрмэгц панел нээгдэнэ.`, () =>
    supabase.rpc("invite_staff", {
      p_email: email,
      p_role: "admin",
      p_name: String(fd.get("name") || "") || null,
      p_phone: String(fd.get("phone") || "") || null,
    }),
  );
}

export async function removeStaff(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/users", "Админ эрх хасагдлаа", () =>
    supabase.rpc("remove_staff", { p_user: String(fd.get("id")) }),
  );
}

export async function deleteInvite(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/users", "Урилга устгагдлаа", () =>
    supabase
      .from("staff_invites")
      .delete()
      .eq("email", String(fd.get("email"))),
  );
}

export async function inviteDealer(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const email = String(fd.get("email") || "").trim();
  const shop = String(fd.get("shop") || "").trim();
  await run(fd, "/admin/users?tab=dealers", `${shop} авто худалдааны эрхтэй боллоо`, () =>
    supabase.rpc("invite_dealer", { p_email: email, p_shop: shop, p_phone: String(fd.get("phone") || "") || null }),
  );
}

export async function removeDealer(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/users?tab=dealers", "Авто худалдааны эрх хасагдлаа", () =>
    supabase.rpc("remove_dealer", { p_user: String(fd.get("id")) }),
  );
}

export async function inviteAgent(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const email = String(fd.get("email") || "").trim();
  await run(
    fd,
    "/admin/users?tab=agents",
    `${email} агентын эрхтэй боллоо. Нэвтэрмэгц өөрийн код, холбоосоо харна.`,
    () =>
      supabase.rpc("invite_agent", {
        p_email: email,
        p_name: String(fd.get("name") || "") || null,
        p_phone: String(fd.get("phone") || "") || null,
      }),
  );
}

export async function removeAgent(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await run(fd, "/admin/users?tab=agents", "Агентын эрх хасагдлаа", () =>
    supabase.rpc("remove_agent", { p_user: String(fd.get("id")) }),
  );
}
