import { NextResponse } from "next/server";
import { getSettings } from "@/lib/data";
import { apkInfo } from "@/lib/release";

/** Нэг товшилтоор APK татах: холбоос байвал шууд тийшээ, байхгүй бол /app хуудас руу. */
export async function GET(request: Request) {
  const s = await getSettings();
  const apk = apkInfo(s);
  return NextResponse.redirect(new URL(apk?.url ?? "/app", request.url), 302);
}
