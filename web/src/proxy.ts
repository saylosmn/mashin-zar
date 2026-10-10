import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login", "/auth", "/setup-error", "/app", "/api/app-version", "/api/push", "/api/contracts",
  "/terms", "/privacy", "/compare", "/sitemap.xml", "/robots.txt", "/opengraph-image",
];

export async function proxy(request: NextRequest) {
  // Supabase нь redirect URL-ийг зөвшөөрөөгүй үед Site URL руу ?code=... -тэй буцаадаг.
  // Тийм код ирвэл callback руу шилжүүлж нэвтрэлтийг дуусгана.
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.pathname.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = `?code=${encodeURIComponent(code)}&next=/`;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  // Агентын урилгын холбоос (?ref=КОД): 30 хоног санаж, зар оруулахад код бөглөгдөнө
  const ref = request.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  const setRef = (res: NextResponse) => {
    if (ref && /^[A-Z0-9]{4,12}$/.test(ref)) res.cookies.set("mz_ref", ref, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
    return res;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = setRef(NextResponse.next({ request }));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const path = request.nextUrl.pathname;

  // Нүүр хуудас болон зарын дэлгэрэнгүйг нэвтрээгүй хүн ч үзэж болно.
  const isPublic = path === "/" || path.startsWith("/ads/") || PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path !== "/" ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }

  return setRef(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk|json)$).*)"],
};
