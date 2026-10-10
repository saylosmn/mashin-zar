import type { Instrumentation } from "next";

/**
 * Сервер дээр гарсан алдааг (хуудас, server action, API) админы «Алдааны бүртгэл» рүү илгээнэ.
 * Supabase-ийн нийтийн түлхүүрээр log_client_error RPC-г дуудна (хэмжээ, давтамжийг SQL хязгаарладаг).
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const e = err as Error & { digest?: string };
    // redirect()/notFound() нь алдаа биш
    if (e?.digest && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/.test(e.digest)) return;
    await fetch(`${url}/rest/v1/rpc/log_client_error`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_source: "server",
        p_message: `${e?.message ?? String(err)}${e?.digest ? ` [${e.digest}]` : ""}`.slice(0, 500),
        p_stack: e?.stack?.slice(0, 4000) ?? null,
        p_url: `${request.method} ${request.path}`.slice(0, 300),
        p_ua: `${context.routerKind} · ${context.routeType} · ${context.routePath}`.slice(0, 200),
        p_version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* бүртгэл өөрөө алдаа үүсгэх ёсгүй */
  }
};
