import Link from "next/link";
import { Logo } from "./Logo";
import { IconBell, IconPlus, IconSearch } from "./icons";
import { initial } from "@/lib/format";
import type { Profile } from "@/lib/types";

export function SiteHeader({ profile, unread, q }: { profile: Profile | null; unread: number; q?: string }) {
  const staff = profile && (profile.role === "manager" || profile.role === "admin");
  return (
    <header className="bg-ink text-paper">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-x-6 gap-y-3 flex-wrap">
        <Logo />
        <form action="/" className="flex-[1_1_260px] order-3 sm:order-none flex items-center gap-2.5 h-11 px-3.5 bg-ink-2 border border-ink-line rounded-[10px] text-pale">
          <IconSearch size={18} />
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Марк, загвар, сер хайх"
            aria-label="Хайх"
            className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-paper placeholder:text-pale"
          />
        </form>
        <nav className="flex items-center gap-2 ml-auto" aria-label="Хэрэглэгчийн цэс">
          {staff && (
            <Link href={profile!.role === "admin" ? "/admin" : "/manager"} className="btn btn-dark-ghost hidden md:inline-flex">
              {profile!.role === "admin" ? "Админ" : "Менежер"}
            </Link>
          )}
          <Link href="/notifications" aria-label="Мэдэгдэл" className="btn btn-dark-ghost w-11 px-0 relative">
            <IconBell />
            {unread > 0 && (
              <span className="mono absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#ff7a1a] text-ink text-[11px] font-bold flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <Link href="/my" className="btn btn-dark-ghost hidden sm:inline-flex">
            Миний зар
          </Link>
          <Link href="/post" className="btn btn-yellow">
            <IconPlus size={18} />
            <span className="hidden sm:inline">Зар нэмэх</span>
          </Link>
          {profile && (
            <Link
              href="/profile"
              aria-label="Профайл"
              className="w-10 h-10 rounded-full bg-yellow text-ink flex items-center justify-center font-bold no-underline"
            >
              {initial(profile.full_name ?? profile.email)}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
