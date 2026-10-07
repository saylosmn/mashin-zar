import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <>
      <header className="bg-ink">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <Logo />
          <Link href="/post" className="btn btn-yellow">+ Зар нэмэх</Link>
        </div>
      </header>
      <main className="flex-1 px-6 py-16 flex items-center justify-center">
        <div className="w-full max-w-[640px] flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center">
            <div className="border-[6px] border-ink rounded-[18px] bg-card px-[clamp(20px,5vw,44px)] py-3 flex items-center gap-[clamp(12px,3vw,28px)]">
              <span className="mono font-bold leading-none tracking-[4px] text-[clamp(64px,12vw,120px)]">404</span>
              <span className="w-1 self-stretch bg-ink" />
              <span className="mono font-bold leading-none text-[clamp(28px,5vw,48px)]">ЗАМ</span>
            </div>
            <div className="w-[70%] h-3.5 bg-yellow rounded-b-lg" />
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="h-display m-0 text-[clamp(26px,3.5vw,40px)] leading-tight">Буруу эргэлт хийчихлээ</h1>
            <p className="m-0 text-[17px] leading-relaxed text-body">
              Таны хайсан хуудас олдсонгүй. Зар устгагдсан, зарагдсан эсвэл холбоос буруу байж магадгүй.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link href="/" className="btn btn-lg btn-ink">Бүх зар руу</Link>
          </div>
        </div>
      </main>
    </>
  );
}
