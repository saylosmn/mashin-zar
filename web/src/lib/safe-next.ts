/**
 * `next` параметрийг аюулгүй болгоно: зөвхөн өөрийн сайтын зам ("/..." ) зөвшөөрнө.
 * "//evil.com", "/\evil.com" зэрэг өөр домэйн руу үсрэх утгыг хаана (open redirect).
 */
export function safeNext(v: unknown, fallback = "/"): string {
  if (typeof v !== "string" || !v) return fallback;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}
