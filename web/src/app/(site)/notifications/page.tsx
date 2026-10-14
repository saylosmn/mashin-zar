import { WebPushCard } from "@/components/WebPush";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireUser } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { notifyHref } from "@/lib/notify-href";
import { BRANDS } from "@shared/cars";
import { IconBell, IconCheck } from "@/components/icons";
import { markAllRead, saveNotifyPrefs } from "../actions";
import type { Notification } from "@shared/types";

export const metadata = { title: "Мэдэгдэл" };

const TYPE_LABEL: Record<string, string> = {
  new_ad: "Шинэ зар",
  ad_approved: "Таны зар",
  ad_rejected: "Таны зар",
  offer: "Санал",
  sold: "Таны зар",
  staff_new_ad: "Админд",
  broadcast: "Зарлал",
  sale_report: "Тайлан",
  report_reviewed: "Тайлан",
  loan_request: "Лизинг",
  loan_update: "Лизинг",
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const me = await requireUser("/notifications");
  const settings = await getSettings();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data ?? []) as Notification[];
  const cy = settings.cutoff_year;

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-wrap items-start gap-6 px-4 pt-8 pb-16 sm:px-6">
      <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="h-display m-0 text-[clamp(24px,3vw,30px)]">Мэдэгдэл</h1>
          {items.some((n) => !n.read) && (
            <form action={markAllRead}>
              <button className="btn btn-sm btn-ghost">Бүгдийг уншсан</button>
            </form>
          )}
        </div>
        <WebPushCard />
        {items.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <IconBell size={40} />
            <p className="m-0 text-body">Одоогоор мэдэгдэл алга.</p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {items.map((n) => {
              // Уншаагүй бол /open маршрутаар дамжиж уншсан болгоод шилжинэ; уншсан бол шууд очно.
              const cls = `flex gap-3 p-3.5 rounded-[14px] no-underline border ${n.read ? "border-transparent" : "bg-card border-line"}`;
              const Tag = n.read ? Link : "a";
              return (
                <li key={n.id}>
                  <Tag href={n.read ? notifyHref(n, me.role) : `/notifications/${n.id}/open`} className={cls}>
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] ${n.type === "ad_approved" ? "bg-active-bg text-active-fg" : n.type === "offer" ? "bg-pending-bg text-pending-fg" : "border border-line bg-paper text-ink"}`}
                    >
                      {n.type === "ad_approved" ? <IconCheck size={22} /> : <IconBell size={22} />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex justify-between gap-2">
                        <span className="text-[12px] font-bold text-pending-fg">
                          {TYPE_LABEL[n.type] ?? "Мэдэгдэл"}
                        </span>
                        <span className="shrink-0 text-[12px] text-muted">{timeAgo(n.created_at)}</span>
                      </div>
                      <span className="text-[14px] font-semibold">{n.title}</span>
                      {n.body && <span className="text-[13px] text-body">{n.body}</span>}
                    </div>
                    {!n.read && (
                      <span className="h-2 w-2 shrink-0 self-center rounded-full bg-[#e05a00]" aria-label="Уншаагүй" />
                    )}
                  </Tag>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="flex flex-[1_1_300px] flex-col gap-4 rounded-2xl bg-ink p-5 text-paper">
        <span className="h-display text-[16px]">Шинэ зарын мэдэгдэл</span>
        {saved && (
          <p role="status" className="m-0 flex items-center gap-1.5 text-[13px] text-yellow">
            <IconCheck size={16} /> Тохиргоо хадгалагдлаа
          </p>
        )}
        <form action={saveNotifyPrefs} className="flex flex-col gap-3.5">
          <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">
            Шинэ зар батлагдахад мэдэгдэх
            <input
              type="checkbox"
              name="notify_new_ads"
              defaultChecked={me.notify_new_ads}
              className="h-5 w-5 accent-yellow"
            />
          </label>
          <label className="label text-paper">
            Зөвхөн ангилал
            <select name="notify_category" defaultValue={me.notify_category ?? ""} className="input h-11">
              <option value="">Бүгд</option>
              <option value="new">{cy} ба хойш</option>
              <option value="old">{cy}-аас өмнө</option>
            </select>
          </label>
          <label className="label text-paper">
            Зөвхөн марк
            <select name="notify_brand" defaultValue={me.notify_brand ?? ""} className="input h-11">
              <option value="">Бүгд</option>
              {Object.keys(BRANDS).map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="label text-paper">
            Үнэ хүртэл (сая ₮)
            <input
              type="number"
              min="0"
              name="notify_max_price"
              defaultValue={me.notify_max_price ? me.notify_max_price / 1_000_000 : ""}
              className="input h-11"
              placeholder="Хязгааргүй"
            />
          </label>
          <button className="btn btn-yellow">Хадгалах</button>
        </form>
      </aside>
    </main>
  );
}
