import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyHref } from "@/lib/notify-href";
import type { Role } from "@/lib/types";

/** Мэдэгдэл дээр дарахад: уншсан болгоод холбогдох хуудас руу шилжүүлнэ. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = (path: string) => new URL(path, request.url);
  if (!/^\d+$/.test(id)) return NextResponse.redirect(url("/notifications"));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return NextResponse.redirect(url(`/login?next=${encodeURIComponent("/notifications")}`));

  const [{ data: n }, { data: me }] = await Promise.all([
    supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", uid).select("type,ad_id").maybeSingle(),
    supabase.from("profiles").select("role").eq("id", uid).maybeSingle(),
  ]);
  if (!n) return NextResponse.redirect(url("/notifications"));
  return NextResponse.redirect(url(notifyHref(n, (me?.role as Role | undefined) ?? null)), 303);
}
