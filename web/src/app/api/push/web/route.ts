import { NextResponse } from "next/server";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "@/lib/webpush-key";

/**
 * Өгөгдлийн сангийн trigger (pg_net) мэдэгдэл бүрийг энд илгээнэ → вэб push (iPhone, Android Chrome, компьютер).
 * Хүсэлт өөрөө хүлээн авагчийн захиалгыг (subscription) агуулдаг тул зөвхөн тэр хүмүүст л очно.
 */
type Msg = {
  sub: { endpoint: string; keys: { p256dh: string; auth: string } };
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

export const maxDuration = 30;

export async function POST(request: Request) {
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) return NextResponse.json({ error: "VAPID_PRIVATE_KEY тохируулаагүй" }, { status: 503 });
  webpush.setVapidDetails("https://web-mu-fawn-45.vercel.app", VAPID_PUBLIC_KEY, priv);

  let messages: Msg[] = [];
  try {
    const j = await request.json();
    messages = Array.isArray(j?.messages) ? j.messages.slice(0, 500) : [];
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    messages
      .filter((m) => typeof m?.sub?.endpoint === "string" && m.sub.endpoint.startsWith("https://") && m.sub.keys?.p256dh && m.sub.keys?.auth)
      .map(async (m) => {
        try {
          await webpush.sendNotification(
            m.sub,
            JSON.stringify({ title: String(m.title ?? "Машин зар").slice(0, 120), body: String(m.body ?? "").slice(0, 300), url: m.url ?? "/notifications", tag: m.tag }),
            { TTL: 60 * 60 * 24, urgency: "high" },
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(m.sub.endpoint);
        }
      }),
  );

  // Хүчингүй болсон захиалгуудыг цэвэрлэнэ
  if (gone.length) {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/prune_web_push`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_endpoints: gone }),
    }).catch(() => {});
  }
  return NextResponse.json({ sent, gone: gone.length });
}
