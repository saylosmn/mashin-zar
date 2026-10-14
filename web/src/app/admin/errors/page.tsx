import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { hoursAgo } from "@shared/commission";
import { pendingCount } from "@/lib/panel";
import { Flash, Kpi, PanelShell } from "@/components/PanelShell";
import { ConfirmButton } from "@/components/ConfirmButton";
import { clearErrors } from "@/actions/settings";

export const metadata = { title: "Админ · Алдааны бүртгэл" };

type Row = {
  id: number;
  source: "web" | "server" | "app";
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  app_version: string | null;
  hits: number;
  created_at: string;
  last_seen_at: string;
};
const SRC: Record<Row["source"], string> = { web: "Вэб (хөтөч)", server: "Сервер", app: "Апп" };

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; ok?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();
  const src = sp.src === "web" || sp.src === "server" || sp.src === "app" ? sp.src : undefined;
  let q = supabase.from("error_logs").select("*").order("last_seen_at", { ascending: false }).limit(200);
  if (src) q = q.eq("source", src);
  const since = hoursAgo(24);
  const [pending, { data, error }, day] = await Promise.all([
    pendingCount(),
    q,
    supabase.from("error_logs").select("source,hits").gte("last_seen_at", since),
  ]);
  const rows = (data ?? []) as Row[];
  const last = (day.data ?? []) as { source: string; hits: number }[];
  const sum = (s?: string) => last.filter((r) => !s || r.source === s).reduce((t, r) => t + r.hits, 0);
  const back = `/admin/errors${src ? `?src=${src}` : ""}`;

  return (
    <PanelShell profile={me} area="admin" active="admin-errors" pending={pending}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h-display m-0 text-[28px]">Алдааны бүртгэл</h1>
          <span className="text-[14px] text-muted">
            Хэрэглэгчдэд гарсан алдаа автоматаар энд бүртгэгдэнэ. Ижил алдааг нэгтгэж, давтамжийг тоолно. 30 хоногийн
            дараа устна.
          </span>
        </div>
        {rows.length > 0 && (
          <form action={clearErrors}>
            <input type="hidden" name="back" value={back} />
            <ConfirmButton message="Бүх алдааны бүртгэлийг устгах уу?" className="btn btn-ghost">
              Бүгдийг цэвэрлэх
            </ConfirmButton>
          </form>
        )}
      </div>
      <Flash ok={sp.ok} err={sp.err ?? (error ? `Уншиж чадсангүй: ${error.message}` : undefined)} />
      <div className="grid max-w-[1000px] grid-cols-2 gap-3.5 md:grid-cols-4">
        <Kpi dark label="Сүүлийн 24 цаг" value={sum()} sub="нийт тохиолдол" />
        <Kpi label="Вэб" value={sum("web")} href="/admin/errors?src=web" />
        <Kpi label="Сервер" value={sum("server")} href="/admin/errors?src=server" />
        <Kpi label="Апп" value={sum("app")} href="/admin/errors?src=app" />
      </div>
      {rows.length === 0 ? (
        <p className="card m-0 max-w-[1000px] px-5 py-10 text-center text-[14px] text-muted">
          Алдаа бүртгэгдээгүй байна 👍
        </p>
      ) : (
        <ul className="m-0 flex max-w-[1000px] list-none flex-col gap-2.5 p-0">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-start gap-2">
                <span className="badge bg-soft text-body">{SRC[r.source]}</span>
                {r.hits > 1 && <span className="badge bg-danger-bg text-[#9b1c1c]">×{r.hits}</span>}
                <span className="min-w-0 flex-1 text-[14px] font-semibold break-words">{r.message}</span>
                <span className="text-[12px] whitespace-nowrap text-muted">{timeAgo(r.last_seen_at)}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
                {r.url && <span className="mono break-all">{r.url}</span>}
                {r.app_version && <span>хувилбар {r.app_version}</span>}
                {r.user_agent && <span className="max-w-full truncate">{r.user_agent}</span>}
                <span>анх {timeAgo(r.created_at)}</span>
              </div>
              {r.stack && (
                <details>
                  <summary className="cursor-pointer text-[12px] text-muted">Дэлгэрэнгүй (stack)</summary>
                  <pre className="mono mt-2 max-h-[280px] overflow-auto rounded-lg bg-paper p-3 text-[11px] break-all whitespace-pre-wrap">
                    {r.stack}
                  </pre>
                </details>
              )}
              <form action={clearErrors} className="self-end">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value={back} />
                <button className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-muted underline">
                  Устгах
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
