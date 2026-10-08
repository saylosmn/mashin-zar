import { NextResponse } from "next/server";
import { getSettings } from "@/lib/data";
import { apkDownloadUrl } from "@/lib/release";

export const dynamic = "force-dynamic";

/** Нэг товшилтоор APK татах: GitHub Release-ийн файл руу шууд, байхгүй бол /app хуудас руу. */
export async function GET(request: Request) {
  const s = await getSettings();
  const url = await apkDownloadUrl(s);
  const res = NextResponse.redirect(url ?? new URL("/app", request.url), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
