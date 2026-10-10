"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell, IconHome, IconList, IconPlus, IconUser } from "./icons";

/**
 * Утсан дээр доод талд байрлах апп шиг цэс (sm-ээс том дэлгэц дээр нуугдана).
 * Менежер/админ/лизингийн панел руу орох товч толгой хэсэгт (SiteHeader) байнга харагддаг тул
 * энд Профайл таб бүх хэрэглэгчид үлдэнэ.
 */
export function MobileTabBar({ unread }: { unread: number }) {
  const path = usePathname();
  const is = (p: string) => (p === "/" ? path === "/" || path.startsWith("/ads") : path.startsWith(p));
  const items = [
    { href: "/", label: "Зарууд", icon: <IconHome size={22} />, on: is("/") },
    { href: "/notifications", label: "Мэдэгдэл", icon: <IconBell size={22} />, on: is("/notifications"), badge: unread },
    null,
    { href: "/my", label: "Миний зар", icon: <IconList size={22} />, on: is("/my") },
    { href: "/profile", label: "Профайл", icon: <IconUser size={22} />, on: is("/profile") },
  ];
  return (
    <nav
      aria-label="Үндсэн цэс"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-line flex items-end px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)]"
    >
      {items.map((it, i) =>
        it ? (
          <Link
            key={it.href}
            href={it.href}
            aria-current={it.on ? "page" : undefined}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1 no-underline text-[11px] relative ${it.on ? "text-ink font-semibold" : "text-muted"}`}
          >
            {it.icon}
            {it.label}
            {it.badge ? (
              <span className="mono absolute top-0 left-1/2 ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff7a1a] text-ink text-[10px] font-bold flex items-center justify-center">
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            ) : null}
          </Link>
        ) : (
          <div key={i} className="flex-1 flex justify-center">
            <Link
              href="/post"
              aria-label="Зар нэмэх"
              className="w-14 h-14 -mt-7 rounded-[18px] bg-yellow text-ink border-4 border-paper flex items-center justify-center no-underline"
            >
              <IconPlus size={26} />
            </Link>
          </div>
        ),
      )}
    </nav>
  );
}
