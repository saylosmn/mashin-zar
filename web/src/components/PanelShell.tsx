import Link from "next/link";
import { Logo } from "./Logo";
import { OfflineBanner } from "./OfflineBanner";
import { LiveSync } from "./LiveSync";
import type { Profile } from "@/lib/types";

export type NavItem = { href: string; label: string; badge?: number; key: string };

export function PanelShell({
  profile,
  area,
  active,
  pending,
  children,
}: {
  profile: Profile;
  area: "manager" | "admin";
  active: string;
  pending?: number;
  children: React.ReactNode;
}) {
  const isAdmin = profile.role === "admin";
  const nav: NavItem[] =
    area === "admin"
      ? [
          { key: "admin", href: "/admin", label: "Самбар" },
          { key: "admin-users", href: "/admin/users", label: "Аккаунтууд" },
          { key: "admin-ads", href: "/admin/ads", label: "Бүх зар" },
          { key: "mgr-ads", href: "/manager/ads", label: "Шинэ зар ба санал", badge: pending },
          { key: "mgr", href: "/manager", label: "Менежерийн самбар" },
          { key: "admin-reports", href: "/admin/reports", label: "Тайлангууд" },
          { key: "admin-notif", href: "/admin/notifications", label: "Мэдэгдэл" },
          { key: "admin-settings", href: "/admin/settings", label: "Тохиргоо" },
        ]
      : [
          { key: "mgr", href: "/manager", label: "Самбар" },
          { key: "mgr-ads", href: "/manager/ads", label: "Шинэ зар ба санал", badge: pending },
          { key: "mgr-all", href: "/manager/all", label: "Бүх зар" },
          { key: "mgr-sold", href: "/manager/all?status=sold", label: "Зарагдсан машинууд" },
          { key: "mgr-users", href: "/manager/users", label: "Зар тавьсан хүмүүс" },
          { key: "mgr-reports", href: "/manager/reports", label: "Тайлан илгээх" },
          ...(isAdmin ? [{ key: "admin", href: "/admin", label: "Админ панел" }] : []),
        ];
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      <nav
        aria-label={area === "admin" ? "Админ цэс" : "Менежерийн цэс"}
        className="sticky top-0 z-30 lg:h-dvh w-full lg:w-[260px] lg:flex-none bg-ink text-paper lg:px-4 lg:py-6 flex flex-col gap-1.5"
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1 lg:px-2 lg:pt-0 lg:pb-5">
          <Logo sub={area === "admin" ? "Админ · бүх эрх" : "Менежер"} href={area === "admin" ? "/admin" : "/manager"} />
          <Link href="/" className="lg:hidden text-[13px] text-pale no-underline whitespace-nowrap">← Сайт</Link>
        </div>
        <div className="flex lg:flex-col gap-1.5 overflow-x-auto px-3 pb-3 lg:p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav.map((n) => {
            const on = n.key === active;
            return (
              <Link
                key={n.key}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap h-9 lg:h-11 px-3 rounded-full lg:rounded-[10px] flex items-center justify-between gap-2 text-[13px] lg:text-[14px] no-underline ${on ? "bg-yellow text-ink font-semibold" : "text-[#e2e4df] bg-ink-2 lg:bg-transparent hover:bg-ink-2"}`}
              >
                {n.label}
                {n.badge ? (
                  <span className={`mono text-[11px] font-bold px-2 py-0.5 rounded-full ${on ? "bg-ink text-yellow" : "bg-[#ff7a1a] text-ink"}`}>{n.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <div className="hidden lg:flex mt-auto pt-6 flex-col gap-2 px-2">
          <Link href="/" className="text-[13px] text-pale">← Сайт руу буцах</Link>
          <span className="text-[12px] text-[#8a9099] truncate">{profile.email}</span>
          <form action="/auth/signout" method="post">
            <button className="text-[13px] text-pale underline bg-transparent border-0 p-0 cursor-pointer">Гарах</button>
          </form>
        </div>
      </nav>
      <main className="flex-1 min-w-0 px-4 sm:px-[clamp(16px,3vw,40px)] pt-5 lg:pt-7 pb-12 flex flex-col gap-5">
        <OfflineBanner />
        <LiveSync userId={profile.id} />
        {children}
      </main>
    </div>
  );
}

export function Kpi({ label, value, sub, dark = false, href }: { label: string; value: string | number; sub?: string; dark?: boolean; href?: string }) {
  const cls = `rounded-2xl p-3.5 sm:p-4.5 flex flex-col gap-1 sm:gap-1.5 no-underline min-w-0 ${dark ? "bg-ink text-paper" : "card"}`;
  const inner = (
    <>
      <span className={`text-[13px] ${dark ? "text-[#c9cdd3]" : "text-muted"}`}>{label}</span>
      <span className={`h-display text-[24px] sm:text-[28px] ${dark ? "text-yellow" : ""}`}>{value}</span>
      {sub && <span className={`text-[12px] ${dark ? "text-[#c9cdd3]" : "text-body"}`}>{sub}</span>}
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-4 py-3 text-[14px]">{err}</p>;
  if (ok) return <p role="status" className="m-0 card px-4 py-3 text-[14px]">✓ {ok}</p>;
  return null;
}
