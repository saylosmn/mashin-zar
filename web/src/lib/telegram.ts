import "server-only";

export type TgReply = { ok: boolean; description?: string; result?: unknown };

/** Telegram Bot API (зөвхөн серверт; токен хөтөч рүү очихгүй) */
export async function tgApi(token: string, method: string, body: object = {}, timeoutMs = 10_000): Promise<TgReply> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return (await r.json()) as TgReply;
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : String(e) };
  }
}
