import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSettings } from "@/lib/data";
import { Logo } from "@/components/Logo";
import { LiveSync } from "@/components/LiveSync";

export const metadata: Metadata = { title: "Апп татах", description: "Машин зар Android апп татах" };

export default async function AppDownload() {
  const s = await getSettings();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const ua = h.get("user-agent") ?? "";
  const isPhone = /Android|iPhone|iPad|Mobile/i.test(ua);
  const isIOS = /iPhone|iPad/i.test(ua);
  const ready = Boolean(s.apk_url);
  const qr = await QRCode.toString(`${proto}://${host}/app/download`, {
    type: "svg",
    margin: 0,
    color: { dark: "#111317", light: "#FFFFFF" },
  });

  return (
    <div className="min-h-dvh flex flex-col bg-ink text-paper">
      <LiveSync />
      <header className="max-w-[960px] w-full mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <Logo />
        <Link href="/" className="text-[14px] text-pale">Вэбээр үзэх →</Link>
      </header>

      <main className="flex-1 max-w-[960px] w-full mx-auto px-6 pb-16 flex flex-wrap items-center justify-center gap-x-16 gap-y-10">
        <div className="flex-[1_1_360px] max-w-[460px] flex flex-col items-start gap-6">
          <div className="w-20 h-20 rounded-[22px] bg-ink-2 border border-ink-line flex items-center justify-center">
            <span className="mono text-yellow font-bold text-[22px] border-2 border-paper rounded-md px-2 py-1">МЗ</span>
          </div>
          <h1 className="h-display m-0 text-[clamp(30px,5vw,48px)] leading-[1.1]">Машин зар апп</h1>

          {isIOS ? (
            <p className="m-0 text-[17px] text-pale leading-relaxed">
              iPhone хувилбар удахгүй гарна. Одоогоор <Link href="/" className="text-yellow underline">вэб хувилбарыг</Link> ашиглана уу.
            </p>
          ) : ready ? (
            <>
              <a href="/app/download" className="btn btn-yellow w-full h-16 rounded-2xl text-[19px]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v12M6 10l6 6 6-6M5 20h14" /></svg>
                Апп татах
              </a>
              <p className="m-0 text-[14px] text-pale leading-relaxed">
                Android{s.apk_version ? ` · v${s.apk_version}` : ""}. Татсан файлаа нээгээд <strong className="text-paper">“Суулгах”</strong> дарна.
                Зөвшөөрөл асуувал <strong className="text-paper">“Зөвшөөрөх”</strong> гэнэ.
              </p>
            </>
          ) : (
            <p className="m-0 text-[17px] text-pale leading-relaxed">Апп удахгүй гарна. Бэлэн болмогц энд татах товч гарч ирнэ.</p>
          )}
        </div>

        {!isPhone && ready && (
          <div className="flex flex-col items-center gap-3">
            <div
              className="bg-card rounded-2xl p-5 w-[220px] h-[220px] [&>svg]:w-full [&>svg]:h-full"
              role="img"
              aria-label="Апп татах QR код"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <span className="text-[14px] text-pale text-center">Утасныхаа камераар уншуулаад татна</span>
          </div>
        )}
      </main>
    </div>
  );
}
