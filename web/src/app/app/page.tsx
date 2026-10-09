import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Logo } from "@/components/Logo";
import { LiveSync } from "@/components/LiveSync";
import { apkInfo } from "@/lib/release";

export const metadata: Metadata = { title: "Апп татах", description: "Машин зар Android апп татах" };

export default async function AppDownload() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const ua = h.get("user-agent") ?? "";
  const isPhone = /Android|iPhone|iPad|Mobile/i.test(ua);
  const isIOS = /iPhone|iPad/i.test(ua);
  const apk = await apkInfo();
  const ready = Boolean(apk);
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
            <IosSteps />
          ) : ready ? (
            <>
              <a href="/app/download" className="btn btn-yellow w-full h-16 rounded-2xl text-[19px]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v12M6 10l6 6 6-6M5 20h14" /></svg>
                Апп татах
              </a>
              <p className="m-0 text-[14px] text-pale leading-relaxed">
                Android{apk?.version ? ` · v${apk.version}` : ""}{apk?.sizeMb ? ` · ${apk.sizeMb} MB` : ""}. Татсан файлаа нээгээд <strong className="text-paper">“Суулгах”</strong> дарна.
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

function IosSteps() {
  const steps: [string, React.ReactNode][] = [
    ["1", <>Энэ хуудсыг <strong className="text-paper">Safari</strong>-аар нээнэ</>],
    [
      "2",
      <>
        Доод талын{" "}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share" className="inline -mt-1 text-yellow"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>{" "}
        <strong className="text-paper">Share</strong> товч дарна
      </>,
    ],
    ["3", <><strong className="text-paper">“Add to Home Screen”</strong> (Нүүр дэлгэцэд нэмэх) → <strong className="text-paper">Add</strong></>],
    ["4", <>Нүүр дэлгэц дээрх <strong className="text-paper">Машин зар</strong>-аа нээж нэвтэрнэ → <strong className="text-paper">“Мэдэгдэл асаах”</strong></>],
  ];
  return (
    <div className="w-full flex flex-col gap-3">
      <p className="m-0 text-[16px] text-pale leading-relaxed">iPhone дээр апп шиг суулгах (үнэгүй, 30 секунд):</p>
      <ol className="list-none p-0 m-0 flex flex-col gap-2.5">
        {steps.map(([n, t]) => (
          <li key={n} className="flex items-start gap-3 bg-ink-2 border border-ink-line rounded-xl px-4 py-3">
            <span className="mono font-bold text-ink bg-yellow rounded-md w-7 h-7 flex items-center justify-center shrink-0">{n}</span>
            <span className="text-[15px] text-pale leading-snug pt-0.5">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

