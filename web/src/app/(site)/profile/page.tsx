import Link from "next/link";
import { WebPushCard } from "@/components/WebPush";
import { requireUser } from "@/lib/data";
import { CITIES } from "@shared/cars";
import { saveProfile } from "../actions";
import { safeNext } from "@/lib/safe-next";
import { IconCheck } from "@/components/icons";

export const metadata = { title: "Профайл" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; saved?: string }>;
}) {
  const { next: rawNext, error, saved } = await searchParams;
  const next = safeNext(rawNext, "") || undefined;
  const me = await requireUser("/profile");
  const creating = !me.profile_completed;
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        {creating && next === "/post" && <span className="text-[13px] text-muted">Алхам 1 / 2 · Профайл</span>}
        <h1 className="h-display m-0 text-[clamp(24px,3vw,30px)] leading-tight">
          {creating ? "Зар тавихын өмнө профайлаа үүсгэнэ үү" : "Миний профайл"}
        </h1>
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          Манай ажилтан тантай энэ мэдээллээр холбогдоно. Нэг удаа бөглөхөд хангалттай.
        </p>
      </div>

      {!creating && <WebPushCard />}

      {saved && (
        <p role="status" className="card m-0 flex items-center gap-2 px-4 py-3 text-[14px]">
          <IconCheck size={18} /> Хадгалагдлаа
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-danger-bg px-4 py-3 text-[14px] text-[#9b1c1c]">
          Нэр, утасны дугаараа (8+ орон) бөглөж, зөвшөөрлөө тэмдэглэнэ үү.
        </p>
      )}

      <div className="card flex items-center gap-3 px-4 py-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-[18px] font-bold text-yellow">
          {(me.full_name ?? me.email ?? "?")[0]?.toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold">Google аккаунт</span>
          <span className="truncate text-[13px] text-muted">{me.email}</span>
        </div>
      </div>

      <form action={saveProfile} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="label">
          Овог нэр
          <input
            name="full_name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={me.full_name ?? ""}
            className="input"
            autoComplete="name"
          />
        </label>
        <label className="label">
          Утасны дугаар
          <div className="flex h-12 items-center overflow-hidden rounded-[12px] border-2 border-ink bg-card">
            <span className="mono flex h-full items-center border-r border-line px-3 text-muted">+976</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              required
              minLength={8}
              maxLength={16}
              title="Утасны дугаар 8+ оронтой байна"
              defaultValue={me.phone ?? ""}
              className="mono h-full flex-1 bg-transparent px-3 text-[15px] outline-none"
              autoComplete="tel"
            />
          </div>
        </label>
        <label className="label">
          Хот / аймаг
          <select name="city" defaultValue={me.city ?? "Улаанбаатар"} className="input">
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2.5 text-[13px] leading-snug text-[#2b2f35]">
          <input
            type="checkbox"
            name="consent"
            required
            defaultChecked={me.profile_completed}
            className="m-0 h-5 w-5 shrink-0 accent-ink"
          />
          <span>
            Манай ажилтан миний утсаар холбогдохыг зөвшөөрч,{" "}
            <a href="/terms" target="_blank" className="underline">
              үйлчилгээний нөхцөл
            </a>
            ,{" "}
            <a href="/privacy" target="_blank" className="underline">
              нууцлалын бодлогыг
            </a>{" "}
            хүлээн зөвшөөрч байна
          </span>
        </label>
        <button className="btn btn-lg btn-ink mt-2">
          {creating && next === "/post" ? "Профайл үүсгээд зар нэмэх" : "Хадгалах"}
        </button>
      </form>
      {!creating && (
        <Link href="/loans" className="card flex items-center justify-between gap-3 px-4 py-3.5 text-ink no-underline">
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">Миний лизингийн хүсэлтүүд</span>
            <span className="text-[13px] text-muted">Илгээсэн хүсэлтийн явц, хариу</span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}
      <form action="/auth/signout" method="post">
        <button className="btn btn-ghost w-full">Гарах</button>
      </form>
    </main>
  );
}
