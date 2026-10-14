import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Logo, LogoMark } from "@/components/Logo";
import { LiveSync } from "@/components/LiveSync";
import { apkInfo } from "@/lib/release";

export const metadata: Metadata = { title: "Апп татах", description: "Autoshop.mn Android апп татах" };

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
    <div className="flex min-h-dvh flex-col bg-ink text-paper">
      <LiveSync />
      <header className="mx-auto flex w-full max-w-[960px] items-center justify-between gap-4 px-6 py-5">
        <Logo />
        <Link href="/" className="text-[14px] text-pale">
          Вэбээр үзэх →
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-wrap items-center justify-center gap-x-16 gap-y-10 px-6 pb-16">
        <div className="flex max-w-[460px] flex-[1_1_360px] flex-col items-start gap-6">
          <LogoMark size={80} className="rounded-[22px] ring-1 ring-ink-line" />
          <h1 className="h-display m-0 text-[clamp(30px,5vw,48px)] leading-[1.1]">Autoshop.mn апп</h1>

          {isIOS ? (
            <IosSteps />
          ) : ready ? (
            <>
              <a href="/app/download" className="btn btn-yellow h-16 w-full rounded-2xl text-[19px]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 4v12M6 10l6 6 6-6M5 20h14" />
                </svg>
                Апп татах
              </a>
              <p className="m-0 text-[14px] leading-relaxed text-pale">
                Android{apk?.version ? ` · v${apk.version}` : ""}
                {apk?.sizeMb ? ` · ${apk.sizeMb} MB` : ""}. Татсан файлаа нээгээд{" "}
                <strong className="text-paper">“Суулгах”</strong> дарна. Зөвшөөрөл асуувал{" "}
                <strong className="text-paper">“Зөвшөөрөх”</strong> гэнэ.
              </p>
            </>
          ) : (
            <p className="m-0 text-[17px] leading-relaxed text-pale">
              Апп удахгүй гарна. Бэлэн болмогц энд татах товч гарч ирнэ.
            </p>
          )}
        </div>

        {!isPhone && ready && (
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-[220px] w-[220px] rounded-2xl bg-card p-5 [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label="Апп татах QR код"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <span className="text-center text-[14px] text-pale">Утасныхаа камераар уншуулаад татна</span>
          </div>
        )}
      </main>
    </div>
  );
}

function IosSteps() {
  const steps: [string, React.ReactNode][] = [
    [
      "1",
      <>
        Энэ хуудсыг <strong className="text-paper">Safari</strong>-аар нээнэ
      </>,
    ],
    [
      "2",
      <>
        Доод талын{" "}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="Share"
          className="-mt-1 inline text-yellow"
        >
          <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>{" "}
        <strong className="text-paper">Share</strong> товч дарна
      </>,
    ],
    [
      "3",
      <>
        <strong className="text-paper">“Add to Home Screen”</strong> (Нүүр дэлгэцэд нэмэх) →{" "}
        <strong className="text-paper">Add</strong>
      </>,
    ],
    [
      "4",
      <>
        Нүүр дэлгэц дээрх <strong className="text-paper">Autoshop.mn</strong>-ээ нээж нэвтэрнэ →{" "}
        <strong className="text-paper">“Мэдэгдэл асаах”</strong>
      </>,
    ],
  ];
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="m-0 text-[16px] leading-relaxed text-pale">iPhone дээр апп шиг суулгах (үнэгүй, 30 секунд):</p>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {steps.map(([n, t]) => (
          <li key={n} className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-2 px-4 py-3">
            <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-yellow font-bold text-ink">
              {n}
            </span>
            <span className="pt-0.5 text-[15px] leading-snug text-pale">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
