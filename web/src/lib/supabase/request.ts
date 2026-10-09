import "server-only";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "./server";

/**
 * API route-д: апп "Authorization: Bearer <token>" илгээвэл тэр хэрэглэгчийн эрхээр,
 * үгүй бол вэбийн cookie-ээр нэвтэрсэн хэрэглэгчийн эрхээр Supabase-д хандана (RLS хэвээр).
 */
export async function supabaseForRequest(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return createCookieClient();
}
