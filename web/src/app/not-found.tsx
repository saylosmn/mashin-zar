import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <>
      <header className="bg-ink">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-3.5">
          <Logo />
          <Link href="/post" className="btn btn-yellow">
            + Зар нэмэх
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-[640px] flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-[clamp(12px,3vw,28px)] rounded-[18px] border-[6px] border-ink bg-card px-[clamp(20px,5vw,44px)] py-3">
              <span className="mono text-[clamp(64px,12vw,120px)] leading-none font-bold tracking-[4px]">404</span>
              <span className="w-1 self-stretch bg-ink" />
              <span className="mono text-[clamp(28px,5vw,48px)] leading-none font-bold">ЗАМ</span>
            </div>
            <div className="h-3.5 w-[70%] rounded-b-lg bg-yellow" />
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="h-display m-0 text-[clamp(26px,3.5vw,40px)] leading-tight">Буруу эргэлт хийчихлээ</h1>
            <p className="m-0 text-[17px] leading-relaxed text-body">
              Таны хайсан хуудас олдсонгүй. Зар устгагдсан, зарагдсан эсвэл холбоос буруу байж магадгүй.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-lg btn-ink">
              Бүх зар руу
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
