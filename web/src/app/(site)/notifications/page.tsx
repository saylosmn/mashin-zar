import { WebPushCard } from "@/components/WebPush";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireUser } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { BRANDS } from "@/lib/cars";
import { IconBell, IconCheck } from "@/components/icons";
import { markAllRead, saveNotifyPrefs } from "../actions";
import type { Notification } from "@/lib/types";

export const metadata = { title: "Мэдэгдэл" };

const TYPE_LABEL: Record<string, string> = {
  new_ad: "Шинэ зар",
  ad_approved: "Таны зар",
  ad_rejected: "Таны зар",
  offer: "Санал",
  sold: "Таны зар",
  staff_new_ad: "Менежерт",
  broadcast: "Зарлал",
  sale_report: "Тайлан",
  report_reviewed: "Тайлан",
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
  const staff = me.role !== "user";
  const cy = settings.cutoff_year;

  return (
    <main className="max-w-[1100px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-wrap gap-6 items-start">
      <section className="flex-[999_1_480px] min-w-0 flex flex-col gap-3">
        <div className="flex justify-between items-center gap-3">
          <h1 className="h-display m-0 text-[clamp(24px,3vw,30px)]">Мэдэгдэл</h1>
          {items.some((n) => !n.read) && (
            <form action={markAllRead}><button className="btn btn-sm btn-ghost">Бүгдийг уншсан</button></form>
          )}
        </div>
        <WebPushCard />
        {items.length === 0 ? (
          <div className="card px-6 py-12 flex flex-col items-center gap-3 text-center">
            <IconBell size={40} />
            <p className="m-0 text-body">Одоогоор мэдэгдэл алга.</p>
          </div>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {items.map((n) => {
              const href = n.type === "sale_report" ? "/admin/reports" : n.type === "report_reviewed" ? "/manager/reports" : n.ad_id ? (n.type === "staff_new_ad" && staff ? `/manager/ads?id=${n.ad_id}` : `/ads/${n.ad_id}`) : "#";
              return (
                <li key={n.id}>
                  <Link href={href} className={`flex gap-3 p-3.5 rounded-[14px] no-underline border ${n.read ? "border-transparent" : "bg-card border-line"}`}>
                    <div className={`w-12 h-12 rounded-[10px] shrink-0 flex items-center justify-center ${n.type === "ad_approved" ? "bg-active-bg text-active-fg" : n.type === "offer" ? "bg-pending-bg text-pending-fg" : "bg-paper border border-line text-ink"}`}>
                      {n.type === "ad_approved" ? <IconCheck size={22} /> : <IconBell size={22} />}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <span className="text-[12px] font-bold text-pending-fg">{TYPE_LABEL[n.type] ?? "Мэдэгдэл"}</span>
                        <span className="text-[12px] text-muted shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <span className="text-[14px] font-semibold">{n.title}</span>
                      {n.body && <span className="text-[13px] text-body">{n.body}</span>}
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-[#e05a00] self-center shrink-0" aria-label="Уншаагүй" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="flex-[1_1_300px] bg-ink text-paper rounded-2xl p-5 flex flex-col gap-4">
        <span className="h-display text-[16px]">Шинэ зарын мэдэгдэл</span>
        {saved && <p role="status" className="m-0 text-[13px] text-yellow flex items-center gap-1.5"><IconCheck size={16} /> Тохиргоо хадгалагдлаа</p>}
        <form action={saveNotifyPrefs} className="flex flex-col gap-3.5">
          <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">
            Шинэ зар батлагдахад мэдэгдэх
            <input type="checkbox" name="notify_new_ads" defaultChecked={me.notify_new_ads} className="w-5 h-5 accent-yellow" />
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
              {Object.keys(BRANDS).map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="label text-paper">
            Үнэ хүртэл (сая ₮)
            <input type="number" min="0" name="notify_max_price" defaultValue={me.notify_max_price ? me.notify_max_price / 1_000_000 : ""} className="input h-11" placeholder="Хязгааргүй" />
          </label>
          <button className="btn btn-yellow">Хадгалах</button>
        </form>
      </aside>
    </main>
  );
}
