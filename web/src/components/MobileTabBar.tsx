"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell, IconHome, IconList, IconPlus, IconUser } from "./icons";

/**
 * Утсан дээр доод талд байрлах апп шиг цэс (sm-ээс том дэлгэц дээр нуугдана).
 * Админ/лизингийн панел руу орох товч толгой хэсэгт (SiteHeader) байнга харагддаг тул
 * энд Профайл таб бүх хэрэглэгчид үлдэнэ.
 */
export function MobileTabBar({ unread }: { unread: number }) {
  const path = usePathname();
  // Чатын цонхонд бичих талбарыг халхлахгүй
  if (/^\/messages\/[^/]+$/.test(path)) return null;
  const is = (p: string) => (p === "/" ? path === "/" || path.startsWith("/ads") : path.startsWith(p));
  const items = [
    { href: "/", label: "Зарууд", icon: <IconHome size={22} />, on: is("/") },
    {
      href: "/notifications",
      label: "Мэдэгдэл",
      icon: <IconBell size={22} />,
      on: is("/notifications"),
      badge: unread,
    },
    null,
    { href: "/my", label: "Миний зар", icon: <IconList size={22} />, on: is("/my") },
    { href: "/profile", label: "Профайл", icon: <IconUser size={22} />, on: is("/profile") },
  ];
  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-line bg-card px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] sm:hidden"
    >
      {items.map((it, i) =>
        it ? (
          <Link
            key={it.href}
            href={it.href}
            aria-current={it.on ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] no-underline ${it.on ? "font-semibold text-ink" : "text-muted"}`}
          >
            {it.icon}
            {it.label}
            {it.badge ? (
              <span className="mono absolute top-0 left-1/2 ml-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff7a1a] px-1 text-[10px] font-bold text-ink">
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            ) : null}
          </Link>
        ) : (
          <div key={i} className="flex flex-1 justify-center">
            <Link
              href="/post"
              aria-label="Зар нэмэх"
              className="-mt-7 flex h-14 w-14 items-center justify-center rounded-[18px] border-4 border-paper bg-yellow text-ink no-underline"
            >
              <IconPlus size={26} />
            </Link>
          </div>
        ),
      )}
    </nav>
  );
}
