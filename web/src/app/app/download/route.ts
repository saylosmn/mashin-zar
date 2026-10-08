import { NextResponse } from "next/server";
import { getSettings } from "@/lib/data";

/** Нэг товшилтоор APK татах: холбоос байвал шууд тийшээ, байхгүй бол /app хуудас руу. */
export async function GET(request: Request) {
  const s = await getSettings();
  return NextResponse.redirect(s.apk_url || new URL("/app", request.url), 302);
}
