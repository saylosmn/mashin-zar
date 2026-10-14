import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { num } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { AgentsTab } from "@/features/admin/accounts/AgentsTab";
import { DealersTab } from "@/features/admin/accounts/DealersTab";
import { StaffTab } from "@/features/admin/accounts/StaffTab";
import { UsersTab } from "@/features/admin/accounts/UsersTab";

export const metadata = { title: "Админ · Аккаунтууд" };

const TABS = [
  { key: "staff", label: "Админ", role: "admin" },
  { key: "users", label: "Хэрэглэгч", role: "user" },
  { key: "dealers", label: "Авто худалдаа", role: "dealer" },
  { key: "agents", label: "Агент", role: "agent" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; ok?: string; err?: string; page?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const tab: TabKey = TABS.find((t) => t.key === sp.tab)?.key ?? "staff";
  const back = `/admin/users?tab=${tab}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;
  const [pending, ...counts] = await Promise.all([
    pendingCount(),
    ...TABS.map((t) => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", t.role)),
  ]);

  return (
    <PanelShell profile={me} area="admin" active="admin-users" pending={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display m-0 text-[28px]">Аккаунтууд</h1>
        <nav aria-label="Төрөл" className="flex flex-wrap gap-1 rounded-xl bg-soft p-1">
          {TABS.map((t, i) => (
            <Link
              key={t.key}
              href={t.key === "staff" ? "/admin/users" : `/admin/users?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex h-10 items-center rounded-[9px] px-4 text-[14px] no-underline ${tab === t.key ? "bg-ink font-semibold text-yellow" : "text-body"}`}
            >
              {t.label} · {num(counts[i].count ?? 0)}
            </Link>
          ))}
        </nav>
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      {tab === "staff" && <StaffTab me={me} back={back} />}
      {tab === "agents" && <AgentsTab back={back} email={sp.email} />}
      {tab === "dealers" && <DealersTab back={back} email={sp.email} />}
      {tab === "users" && <UsersTab back={back} q={sp.q} page={Math.max(1, Number(sp.page) || 1)} />}
    </PanelShell>
  );
}
