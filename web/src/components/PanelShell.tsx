import Link from "next/link";
import { Logo } from "./Logo";
import { OfflineBanner } from "./OfflineBanner";
import { LiveSync } from "./LiveSync";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@shared/types";

/** Шийдвэрлээгүй гомдлын тоо (цэсний тэмдэг). Хүснэгт байхгүй үед 0. */
async function openFlags() {
  const supabase = await createClient();
  const { count } = await supabase.from("ad_flags").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}

/** Шалгах (хэрэглэгч «Төлсөн» дарсан) төлбөрийн тоо */
async function submittedPayments() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");
  return count ?? 0;
}

export type NavItem = { href: string; label: string; badge?: number; key: string };

export async function PanelShell({
  profile,
  area,
  active,
  pending,
  partner,
  children,
}: {
  profile: Profile;
  area: "admin" | "leasing";
  active: string;
  pending?: number;
  /** Админ лизингийн панелд аль компанийг харж байгаа (цэсний холбоосонд дамжуулна) */
  partner?: string;
  children: React.ReactNode;
}) {
  const isAdmin = profile.role === "admin";
  const [flags, payments] = await Promise.all([
    area === "leasing" ? 0 : openFlags(),
    area === "admin" ? submittedPayments() : 0,
  ]);
  const nav: NavItem[] =
    area === "leasing"
      ? [
          {
            key: "leasing",
            href: isAdmin && partner ? `/leasing?partner=${partner}` : "/leasing",
            label: isAdmin ? "Лизингийн хүсэлтүүд" : "Хүсэлтүүд",
          },
          ...(!isAdmin || (partner && partner !== "all")
            ? [
                {
                  key: "leasing-terms",
                  href: isAdmin ? `/leasing?tab=terms&partner=${partner}` : "/leasing?tab=terms",
                  label: "Нөхцөл, шаардлага",
                },
              ]
            : []),
          ...(isAdmin ? [{ key: "admin-leasing", href: "/admin/leasing", label: "← Админ: Лизинг" }] : []),
        ]
      : [
          { key: "admin", href: "/admin", label: "Самбар" },
          { key: "admin-users", href: "/admin/users", label: "Аккаунтууд" },
          { key: "admin-review", href: "/admin/review", label: "Шинэ зар ба санал", badge: pending },
          { key: "admin-ads", href: "/admin/ads", label: "Бүх зар" },
          { key: "admin-sellers", href: "/admin/sellers", label: "Зар тавьсан хүмүүс" },
          { key: "admin-flags", href: "/admin/flags", label: "Гомдол", badge: flags },
          { key: "admin-payments", href: "/admin/payments", label: "Төлбөрүүд", badge: payments },
          { key: "admin-reports", href: "/admin/reports", label: "Тайлангууд" },
          { key: "admin-leasing", href: "/admin/leasing", label: "Лизинг: компаниуд" },
          { key: "leasing", href: "/leasing?partner=all", label: "Лизинг: хүсэлтүүд" },
          { key: "admin-notif", href: "/admin/notifications", label: "Мэдэгдэл" },
          { key: "admin-errors", href: "/admin/errors", label: "Алдааны бүртгэл" },
          { key: "admin-settings", href: "/admin/settings", label: "Тохиргоо" },
        ];
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <nav
        aria-label={area === "admin" ? "Админ цэс" : "Лизингийн цэс"}
        className="sticky top-0 z-30 flex w-full flex-col gap-1.5 bg-ink text-paper lg:h-dvh lg:w-[260px] lg:flex-none lg:px-4 lg:py-6"
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1 lg:px-2 lg:pt-0 lg:pb-5">
          <Logo
            sub={area === "admin" ? "Админ · бүх эрх" : "Лизингийн түнш"}
            href={area === "admin" ? "/admin" : "/leasing"}
          />
          <Link href="/" className="text-[13px] whitespace-nowrap text-pale no-underline lg:hidden">
            ← Сайт
          </Link>
        </div>
        <div className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-3 pb-3 lg:flex-col lg:p-0 [&::-webkit-scrollbar]:hidden">
          {nav.map((n) => {
            const on = n.key === active;
            return (
              <Link
                key={n.key}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`flex h-9 shrink-0 items-center justify-between gap-2 rounded-full px-3 text-[13px] whitespace-nowrap no-underline lg:h-11 lg:rounded-[10px] lg:text-[14px] ${on ? "bg-yellow font-semibold text-ink" : "bg-ink-2 text-[#e2e4df] hover:bg-ink-2 lg:bg-transparent"}`}
              >
                {n.label}
                {n.badge ? (
                  <span
                    className={`mono rounded-full px-2 py-0.5 text-[11px] font-bold ${on ? "bg-ink text-yellow" : "bg-[#ff7a1a] text-ink"}`}
                  >
                    {n.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <div className="mt-auto hidden flex-col gap-2 px-2 pt-6 lg:flex">
          <Link href="/" className="text-[13px] text-pale">
            ← Сайт руу буцах
          </Link>
          <span className="truncate text-[12px] text-[#8a9099]">{profile.email}</span>
          <form action="/auth/signout" method="post">
            <button className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-pale underline">
              Гарах
            </button>
          </form>
        </div>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-5 pb-12 sm:px-[clamp(16px,3vw,40px)] lg:pt-7">
        <OfflineBanner />
        <LiveSync userId={profile.id} role={profile.role} partnerId={profile.partner_id} />
        {children}
      </main>
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  dark = false,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  dark?: boolean;
  href?: string;
}) {
  const cls = `rounded-2xl p-3.5 sm:p-4.5 flex flex-col gap-1 sm:gap-1.5 no-underline min-w-0 ${dark ? "bg-ink text-paper" : "card"}`;
  const inner = (
    <>
      <span className={`text-[13px] ${dark ? "text-[#c9cdd3]" : "text-muted"}`}>{label}</span>
      <span className={`h-display text-[24px] sm:text-[28px] ${dark ? "text-yellow" : ""}`}>{value}</span>
      {sub && <span className={`text-[12px] ${dark ? "text-[#c9cdd3]" : "text-body"}`}>{sub}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err)
    return (
      <p role="alert" className="m-0 rounded-xl bg-danger-bg px-4 py-3 text-[14px] text-[#9b1c1c]">
        {err}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="card m-0 px-4 py-3 text-[14px]">
        ✓ {ok}
      </p>
    );
  return null;
}
