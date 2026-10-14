import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type Result = { error: { message: string } | null };

/** Маягтын "back" талбар (эсвэл fallback) руу ok/err query-тэй буцаах хаяг */
export function backUrl(fd: FormData, fallback: string, extra: Record<string, string>) {
  const url = new URL(String(fd.get("back") || fallback), "http://x");
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  url.searchParams.delete(extra.ok ? "err" : "ok");
  return url.pathname + url.search;
}

/** RPC/query ажиллуулж, кэшийг шинэчлээд үр дүнгийн мессежтэй буцна */
export async function run(fd: FormData, fallback: string, ok: string, fn: () => PromiseLike<Result>) {
  const { error } = await fn();
  revalidatePath("/", "layout");
  redirect(backUrl(fd, fallback, error ? { err: error.message } : { ok }));
}
