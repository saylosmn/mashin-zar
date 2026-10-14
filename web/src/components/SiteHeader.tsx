import Link from "next/link";
import { Logo } from "./Logo";
import { IconBell, IconPlus, IconSearch } from "./icons";
import { initial } from "@/lib/format";
import { LoginLink } from "./LoginLink";
import type { Profile } from "@shared/types";

export function SiteHeader({
  profile,
  unread,
  q,
  chats = 0,
}: {
  profile: Profile | null;
  unread: number;
  q?: string;
  chats?: number;
}) {
  const staff = profile?.role === "admin";
  const leasing = profile?.role === "leasing";
  return (
    <header className="bg-ink text-paper">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:gap-x-6 sm:px-6 sm:py-3.5">
        <Logo />
        <form
          action="/"
          className="order-3 flex h-11 flex-[1_1_260px] items-center gap-2.5 rounded-[10px] border border-ink-line bg-ink-2 px-3.5 text-pale sm:order-none"
        >
          <IconSearch size={18} />
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Марк, загвар, сер хайх"
            aria-label="Хайх"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-paper outline-none placeholder:text-pale"
          />
        </form>
        <nav className="ml-auto flex items-center gap-2" aria-label="Хэрэглэгчийн цэс">
          {staff && (
            <Link href="/admin" className="btn btn-dark-ghost px-3 sm:px-4">
              Админ
            </Link>
          )}
          {leasing && (
            <Link href="/leasing" className="btn btn-dark-ghost px-3 sm:px-4">
              Лизинг
            </Link>
          )}
          {profile?.role === "agent" && (
            <Link href="/agent" className="btn btn-dark-ghost px-3 sm:px-4">
              Агент
            </Link>
          )}
          {profile && (
            <Link href="/messages" aria-label="Чат" className="btn btn-dark-ghost relative w-11 px-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
              {chats > 0 && (
                <span className="mono absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff7a1a] px-1 text-[11px] font-bold text-ink">
                  {chats > 99 ? "99+" : chats}
                </span>
              )}
            </Link>
          )}
          {profile && (
            <Link
              href="/notifications"
              aria-label="Мэдэгдэл"
              className="btn btn-dark-ghost relative hidden w-11 px-0 sm:inline-flex"
            >
              <IconBell />
              {unread > 0 && (
                <span className="mono absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff7a1a] px-1 text-[11px] font-bold text-ink">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )}
          <Link href="/app" prefetch={false} aria-label="Апп татах" className="btn btn-dark-ghost px-3">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 4v12M6 10l6 6 6-6M5 20h14" />
            </svg>
            <span className="hidden lg:inline">Апп татах</span>
          </Link>
          {profile ? (
            <>
              <Link href="/my" className="btn btn-dark-ghost hidden sm:inline-flex">
                Миний зар
              </Link>
              <Link href="/post" className="btn btn-yellow hidden sm:inline-flex">
                <IconPlus size={18} />
                <span className="hidden sm:inline">Зар нэмэх</span>
              </Link>
              <Link
                href="/profile"
                aria-label="Профайл"
                className="hidden h-10 w-10 items-center justify-center rounded-full bg-yellow font-bold text-ink no-underline sm:flex"
              >
                {initial(profile.full_name ?? profile.email)}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login?next=%2Fpost" className="btn btn-dark-ghost hidden sm:inline-flex">
                <IconPlus size={18} /> Зар нэмэх
              </Link>
              <LoginLink className="btn btn-yellow">Нэвтрэх</LoginLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
