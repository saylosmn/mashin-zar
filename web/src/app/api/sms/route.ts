import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Утсан дээрх «Орлого SMS» апп банкны орлогын SMS-ийг энд илгээнэ.
 * Header: X-Api-Key (Админ -> Тохиргоо -> SMS апп), JSON: { money, value, body, sender, date }.
 * Кодыг тааруулж батлах бүх шийдвэрийг өгөгдлийн сангийн sms_ingest() гаргана.
 * Хариу { code: 0 } бол апп «✓ Илгээсэн» гэж тэмдэглэнэ; бусад үед дараа дахин илгээнэ.
 */
export async function POST(request: NextRequest) {
  const key = request.headers.get("x-api-key");
  if (!key) return NextResponse.json({ code: 1, error: "no key" }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ code: 1, error: "bad json" }, { status: 400 });
  }
  const str = (v: unknown, max: number) =>
    typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await supabase.rpc("sms_ingest", {
    p_key: key,
    p_money: str(b.money, 40),
    p_value: str(b.value, 200),
    p_body: str(b.body, 1000),
    p_sender: str(b.sender, 40),
    p_date: str(b.date, 40),
  });
  if (error?.message.includes("forbidden")) return NextResponse.json({ code: 1, error: "bad key" }, { status: 401 });
  if (error) {
    console.error("sms_ingest", error.message);
    return NextResponse.json({ code: 1, error: "server" }, { status: 500 });
  }
  return NextResponse.json(data ?? { code: 0 });
}
