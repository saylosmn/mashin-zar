"use client";

import { createClient } from "./supabase/client";

const sent = new Set<string>();
let budget = 5; // нэг хуудас ачаалалтад хамгийн ихдээ

/** Хөтөчид гарсан алдааг админы «Алдааны бүртгэл» рүү илгээнэ (чимээгүй, давтагдахгүй). */
export function logClientError(err: unknown, extra?: { digest?: string }) {
  try {
    if (typeof window === "undefined" || budget <= 0) return;
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
    const message = `${e.name && e.name !== "Error" ? `${e.name}: ` : ""}${e.message || "Тодорхойгүй алдаа"}${extra?.digest ? ` [${extra.digest}]` : ""}`;
    // Хөтчийн өргөтгөл, сүлжээ тасарсан үеийн чимээ
    if (/ResizeObserver loop|Failed to fetch|NetworkError|Load failed|chrome-extension:|moz-extension:/i.test(`${message} ${e.stack ?? ""}`)) return;
    if (sent.has(message)) return;
    sent.add(message);
    budget--;
    void createClient()
      .rpc("log_client_error", {
        p_source: "web",
        p_message: message.slice(0, 500),
        p_stack: e.stack?.slice(0, 4000) ?? null,
        p_url: location.pathname + location.search,
        p_ua: navigator.userAgent.slice(0, 200),
        p_version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      })
      .then(() => {}, () => {});
  } catch {
    /* бүртгэл өөрөө алдаа үүсгэх ёсгүй */
  }
}
