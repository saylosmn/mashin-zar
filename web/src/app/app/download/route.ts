import { NextResponse } from "next/server";
import { apkDownloadUrl } from "@/lib/release";

export const dynamic = "force-dynamic";

/** Нэг товшилтоор APK татах: GitHub Release-ийн mashin-zar.apk файл руу шууд. */
export async function GET() {
  const res = NextResponse.redirect(await apkDownloadUrl(), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
