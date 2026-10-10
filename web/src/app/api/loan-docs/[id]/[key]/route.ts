import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Лизингийн хүсэлтийн баримтыг нээх: эрхийг өгөгдлийн сан шалгаж, хэн хэзээ нээснийг бүртгэнэ (loan_doc_open),
 * дараа нь 2 минутын түр холбоос руу шилжүүлнэ. Холбоосыг хуудсанд урьдчилан хадгалахгүй.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[a-z_]{2,30}(_[2-5])?$/.test(key)) return text("Буруу хүсэлт", 400);
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("loan_doc_open", { p_request: id, p_key: key });
  if (error || typeof path !== "string") return text(error?.message ?? "Баримт олдсонгүй", error?.message?.includes("Эрх") ? 403 : 404);
  const s = await supabase.storage.from("loan-docs").createSignedUrl(path, 120);
  if (s.error || !s.data?.signedUrl) return text(s.error?.message ?? "Холбоос үүсгэж чадсангүй", 500);
  const res = NextResponse.redirect(s.data.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

function text(msg: string, status: number) {
  return new NextResponse(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
