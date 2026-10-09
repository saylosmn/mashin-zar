import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { dateShort, num, timeAgo } from "@/lib/format";
import { pendingCount } from "@/lib/panel";
import { Flash, PanelShell } from "@/components/PanelShell";
import { ConfirmButton } from "@/components/ConfirmButton";
import { IconBell } from "@/components/icons";
import { deleteBroadcast, resendBroadcast, sendBroadcast } from "../../panel-actions";

export const metadata = { title: "Админ · Мэдэгдэл" };

type Row = { id: string; title: string; body: string | null; created_at: string; recipients: number; read_count: number; author: string | null };

export default async function AdminNotifications({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const [pending, list] = await Promise.all([pendingCount(), supabase.rpc("broadcast_list")]);
  const rows = (list.data ?? []) as Row[];
  const back = "/admin/notifications";

  return (
    <PanelShell profile={me} area="admin" active="admin-notif" pending={pending}>
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[28px]">Мэдэгдэл</h1>
        <span className="text-[14px] text-muted">Бүх хэрэглэгчид зарлал илгээх, өмнө илгээснээ устгах, дахин илгээх</span>
      </div>
      <Flash ok={sp.ok} err={sp.err ?? (list.error ? `Зарлалын жагсаалт уншиж чадсангүй: ${list.error.message}` : undefined)} />

      <form action={sendBroadcast} className="card p-5 flex flex-col gap-3.5 max-w-[920px]">
        <input type="hidden" name="back" value={back} />
        <h2 className="m-0 text-[17px] font-bold">Шинэ зарлал</h2>
        <label className="label text-[14px]">Гарчиг
          <input name="title" required maxLength={80} placeholder="Апп шинэчлэгдлээ" className="input" />
        </label>
        <label className="label text-[14px]">Дэлгэрэнгүй (заавал биш)
          <textarea name="body" maxLength={300} rows={2} placeholder="Шинэ боломжууд..." className="textarea" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-muted">Хүн бүрийн мэдэгдэлд орж, утсанд нь push мэдэгдлээр очно.</span>
          <ConfirmButton message="Энэ зарлалыг бүх хэрэглэгчид илгээх үү?" className="btn btn-ink h-12">Илгээх</ConfirmButton>
        </div>
      </form>

      <section className="flex flex-col gap-3 max-w-[920px]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-[17px] font-bold">Илгээсэн зарлалууд</h2>
          <span className="text-[13px] text-muted">{rows.length} зарлал</span>
        </div>
        {rows.length === 0 ? (
          <div className="card px-6 py-10 flex flex-col items-center gap-3 text-center">
            <IconBell size={36} />
            <p className="m-0 text-body text-[14px]">Одоогоор зарлал илгээгээгүй байна.</p>
          </div>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
            {rows.map((b) => {
              const pct = b.recipients ? Math.round((b.read_count / b.recipients) * 100) : 0;
              return (
                <li key={b.id} className="card p-4 flex flex-col gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-bold text-[15px] break-words">{b.title}</span>
                    {b.body && <span className="text-[14px] text-body break-words">{b.body}</span>}
                    <span className="text-[12px] text-muted">
                      {dateShort(b.created_at)} · {timeAgo(b.created_at)}{b.author ? ` · ${b.author}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[12px] text-muted">
                      <span>{num(b.recipients)} хүнд очсон</span>
                      <span>{num(b.read_count)} уншсан · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-soft overflow-hidden" aria-hidden>
                      <div className="h-full bg-yellow" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={resendBroadcast}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="back" value={back} />
                      <ConfirmButton message={`"${b.title}" зарлалыг дахин бүх хэрэглэгчид илгээх үү?`} className="btn btn-ghost btn-sm">Дахин илгээх</ConfirmButton>
                    </form>
                    <form action={deleteBroadcast}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="back" value={back} />
                      <ConfirmButton message={`"${b.title}" зарлалыг бүх хэрэглэгчийн мэдэгдлээс устгах уу? Утсанд аль хэдийн ирсэн push мэдэгдлийг буцааж татах боломжгүй.`} className="btn btn-danger btn-sm">Устгах</ConfirmButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PanelShell>
  );
}
