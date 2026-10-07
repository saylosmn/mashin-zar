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
          { key: "admin-settings", href: "/admin/settings", label: "Тохиргоо" },
        ]
      : [
          { key: "mgr", href: "/manager", label: "Самбар" },
          { key: "mgr-ads", href: "/manager/ads", label: "Шинэ зар ба санал", badge: pending },
          { key: "mgr-all", href: "/manager/all", label: "Бүх зар" },
          { key: "mgr-sold", href: "/manager/all?status=sold", label: "Зарагдсан машинууд" },
          { key: "mgr-users", href: "/manager/users", label: "Зар тавьсан хүмүүс" },
          ...(isAdmin ? [{ key: "admin", href: "/admin", label: "Админ панел" }] : []),
        ];
  return (
    <div className="min-h-dvh flex flex-wrap">
      <nav aria-label={area === "admin" ? "Админ цэс" : "Менежерийн цэс"} className="flex-[1_1_240px] max-w-full lg:max-w-[260px] bg-ink text-paper px-4 py-6 flex flex-col gap-1.5">
        <div className="px-2 pb-5">
          <Logo sub={area === "admin" ? "Админ · бүх эрх" : "Менежер"} href={area === "admin" ? "/admin" : "/manager"} />
        </div>
        {nav.map((n) => {
          const on = n.key === active;
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={`h-11 px-3 rounded-[10px] flex items-center justify-between text-[14px] no-underline ${on ? "bg-yellow text-ink font-semibold" : "text-[#e2e4df] hover:bg-ink-2"}`}
            >
              {n.label}
              {n.badge ? (
                <span className={`mono text-[11px] font-bold px-2 py-0.5 rounded-full ${on ? "bg-ink text-yellow" : "bg-[#ff7a1a] text-ink"}`}>{n.badge}</span>
              ) : null}
            </Link>
          );
        })}
        <div className="mt-auto pt-6 flex flex-col gap-2 px-2">
          <Link href="/" className="text-[13px] text-pale">← Сайт руу буцах</Link>
          <span className="text-[12px] text-[#8a9099] truncate">{profile.email}</span>
          <form action="/auth/signout" method="post">
            <button className="text-[13px] text-pale underline bg-transparent border-0 p-0 cursor-pointer">Гарах</button>
          </form>
        </div>
      </nav>
      <main className="flex-[999_1_560px] min-w-0 px-[clamp(16px,3vw,40px)] pt-7 pb-12 flex flex-col gap-5">
        <OfflineBanner />
        <LiveSync userId={profile.id} />
        {children}
      </main>
    </div>
  );
}

export function Kpi({ label, value, sub, dark = false, href }: { label: string; value: string | number; sub?: string; dark?: boolean; href?: string }) {
  const cls = `rounded-2xl p-4.5 flex flex-col gap-1.5 no-underline ${dark ? "bg-ink text-paper" : "card"}`;
  const inner = (
    <>
      <span className={`text-[13px] ${dark ? "text-[#c9cdd3]" : "text-muted"}`}>{label}</span>
      <span className={`h-display text-[28px] ${dark ? "text-yellow" : ""}`}>{value}</span>
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
