import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Telegram ботын webhook: «✅ Орлого орсон / ❌ Ороогүй» товч, /id, /list командууд.
 * Бүх шийдвэрийг өгөгдлийн сангийн tg_webhook() гаргана — нууц түлхүүрийг (secret_token) тэнд шалгана.
 * Бот токен энд хэрэггүй.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret) return new NextResponse(null, { status: 401 });
  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.rpc("tg_webhook", { p_secret: secret, p_update: update });
  if (error?.message.includes("forbidden")) return new NextResponse(null, { status: 401 });
  if (error) console.error("tg_webhook", error.message);
  // Telegram дахин дахин илгээхгүй байхын тулд бусад алдаанд ч 200
  return NextResponse.json({ ok: true });
}
