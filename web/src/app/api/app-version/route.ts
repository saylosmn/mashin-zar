import { NextResponse } from "next/server";
import { apkInfo } from "@/lib/release";

/** Апп өөрийн хувилбарыг харьцуулж, шинэ APK гарсан бол хэрэглэгчид мэдэгдэнэ. */
export async function GET(request: Request) {
  const info = await apkInfo();
  return NextResponse.json(
    { version: info?.version ?? null, sizeMb: info?.sizeMb ?? null, url: new URL("/app/download", request.url).toString() },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
