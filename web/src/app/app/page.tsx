import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/data";
import { Logo } from "@/components/Logo";
import { LiveSync } from "@/components/LiveSync";
import { dateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Апп татах", description: "Машин зар Android апп татах" };

export default async function AppDownload() {
  const s = await getSettings();
  const url = s.apk_url;
  return (
    <div className="min-h-dvh flex flex-col bg-ink text-paper">
      <LiveSync />
      <header className="max-w-[1100px] w-full mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <Logo />
        <Link href="/" className="btn btn-dark-ghost">Вэбээр үзэх</Link>
      </header>
      <main className="flex-1 max-w-[1100px] w-full mx-auto px-6 py-10 flex flex-wrap items-center gap-12">
        <div className="flex-[1_1_420px] flex flex-col gap-6">
          <span className="mono self-start bg-yellow text-ink text-[13px] font-bold px-3 py-1.5 rounded-md">ANDROID</span>
          <h1 className="h-display m-0 text-[clamp(32px,5vw,56px)] leading-[1.08]">Машин зар апп-ыг утсандаа суулга</h1>
          <p className="m-0 text-[18px] leading-relaxed text-pale">
            Шинэ зар батлагдмагц утсанд чинь шууд мэдэгдэл ирнэ. Зураг авч, зараа хэдхэн минутад тавина.
          </p>
          {url ? (
            <div className="flex flex-col gap-3">
              <a href={url} download className="btn btn-lg btn-yellow self-start h-[60px] px-8 text-[18px]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v12M6 10l6 6 6-6M5 20h14" /></svg>
                APK татах{ s.apk_version ? ` · v${s.apk_version}` : ""}
              </a>
              {s.apk_updated_at && <span className="text-[13px] text-pale">Шинэчилсэн: {dateShort(s.apk_updated_at)}</span>}
            </div>
          ) : (
            <div className="card bg-ink-2 border-ink-line px-5 py-4 text-[15px] text-pale">
              Апп удахгүй гарна. Админ татах холбоосыг оруулмагц энд товч гарч ирнэ.
            </div>
          )}
        </div>
        <ol className="flex-[1_1_320px] list-none p-0 m-0 flex flex-col gap-4">
          {[
            ["APK татах", "Дээрх шар товчийг утсаныхаа браузераас дарна."],
            ["Суулгахыг зөвшөөрөх", "“Тодорхойгүй эх сурвалжаас суулгах” гэсэн асуулт гарвал зөвшөөрнө."],
            ["Нээгээд нэвтрэх", "Google аккаунтаараа нэвтэрч, мэдэгдэл хүлээн авахыг зөвшөөрнө."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4 bg-ink-2 border border-ink-line rounded-2xl p-5">
              <span className="mono text-yellow font-bold text-[15px]">0{i + 1}</span>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[16px]">{t}</span>
                <span className="text-[14px] text-pale leading-relaxed">{d}</span>
              </div>
            </li>
          ))}
          <li className="text-[13px] text-pale px-1">iPhone хувилбар удахгүй. Одоогоор вэб хувилбарыг ашиглана уу.</li>
        </ol>
      </main>
    </div>
  );
}
