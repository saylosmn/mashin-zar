import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Logo } from "@/components/Logo";
import { GoogleButton } from "./GoogleButton";
import { getProfile } from "@/lib/data";
import { safeNext } from "@/lib/safe-next";
import { InAppNotice } from "./InAppNotice";

/** Facebook, Messenger, Instagram, Line зэрэг апп доторх хөтөч (Google OAuth-ийг хаадаг). */
const IN_APP_UA = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|\bLine\/|; wv\)/i;

export const metadata: Metadata = { title: "Нэвтрэх" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  const [profile, h] = await Promise.all([getProfile(), headers()]);
  if (profile) redirect(next);
  const inApp = IN_APP_UA.test(h.get("user-agent") ?? "");

  return (
    <div className="flex min-h-dvh flex-wrap">
      <div className="flex min-h-[420px] flex-[1_1_520px] flex-col justify-between gap-12 bg-ink px-[clamp(24px,5vw,72px)] py-12 text-paper">
        <Logo />
        <div className="flex max-w-[560px] flex-col gap-5">
          <div className="flex gap-2">
            <span className="mono rounded-md bg-yellow px-3 py-1.5 text-[14px] font-bold text-ink">2016+</span>
            <span className="mono rounded-md border-[1.5px] border-ink-line px-3 py-1 text-[14px] text-[#c9cdd3]">
              2016-аас өмнө
            </span>
          </div>
          <h1 className="h-display m-0 text-[clamp(34px,4vw,56px)] leading-[1.08]">
            Машинаа зар. Дараагийнхаа машиныг ол.
          </h1>
          <p className="m-0 text-[18px] leading-relaxed text-pale">
            Шалгагдсан зарууд, 16 хүртэл зураг, шинэ зар орох бүрт мэдэгдэл.
          </p>
        </div>
        <ol className="m-0 flex list-none flex-wrap gap-8 p-0">
          {["Google-ээр нэвтэр", "Профайл үүсгэ", "Зараа тавь"].map((t, i) => (
            <li key={t} className="flex flex-col gap-1">
              <span className="mono text-[14px] font-bold text-yellow">0{i + 1}</span>
              <span className="text-[14px] text-[#c9cdd3]">{t}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-[1_1_420px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="h-display m-0 text-[28px]">Нэвтрэх</h2>
            <p className="m-0 text-[15px] text-muted">Нэг товшилтоор нэвтэрч бүх зарыг үзнэ үү.</p>
          </div>
          {inApp && <InAppNotice />}
          {error && (
            <p role="alert" className="m-0 rounded-xl bg-danger-bg px-4 py-3 text-[14px] text-[#9b1c1c]">
              Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.
            </p>
          )}
          <GoogleButton next={next} />
          <a href="/app" className="btn btn-lg btn-ghost w-full">
            Android апп татах
          </a>
          <p className="m-0 text-[13px] leading-relaxed text-muted">
            Нэвтэрснээр{" "}
            <a href="/terms" className="underline">
              үйлчилгээний нөхцөл
            </a>{" "}
            болон{" "}
            <a href="/privacy" className="underline">
              нууцлалын бодлогыг
            </a>{" "}
            зөвшөөрнө.
          </p>
        </div>
      </div>
    </div>
  );
}
