import Link from "next/link";
import { WebPushCard } from "@/components/WebPush";
import { requireUser } from "@/lib/data";
import { CITIES } from "@/lib/cars";
import { saveProfile } from "../actions";
import { IconCheck } from "@/components/icons";

export const metadata = { title: "Профайл" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; saved?: string }> }) {
  const { next, error, saved } = await searchParams;
  const me = await requireUser("/profile");
  const creating = !me.profile_completed;
  return (
    <main className="max-w-[560px] w-full mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {creating && next === "/post" && <span className="text-[13px] text-muted">Алхам 1 / 2 · Профайл</span>}
        <h1 className="h-display m-0 text-[clamp(24px,3vw,30px)] leading-tight">
          {creating ? "Зар тавихын өмнө профайлаа үүсгэнэ үү" : "Миний профайл"}
        </h1>
        <p className="m-0 text-[15px] text-muted leading-relaxed">
          Менежер тантай энэ мэдээллээр холбогдоно. Нэг удаа бөглөхөд хангалттай.
        </p>
      </div>

      {!creating && <WebPushCard />}

      {saved && (
        <p role="status" className="m-0 card px-4 py-3 text-[14px] flex items-center gap-2"><IconCheck size={18} /> Хадгалагдлаа</p>
      )}
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-danger-bg text-[#9b1c1c] px-4 py-3 text-[14px]">
          Нэр, утасны дугаараа (8+ орон) бөглөж, зөвшөөрлөө тэмдэглэнэ үү.
        </p>
      )}

      <div className="card px-4 py-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-ink text-yellow flex items-center justify-center font-bold text-[18px]">
          {(me.full_name ?? me.email ?? "?")[0]?.toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-[15px]">Google аккаунт</span>
          <span className="text-[13px] text-muted truncate">{me.email}</span>
        </div>
      </div>

      <form action={saveProfile} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="label">
          Овог нэр
          <input name="full_name" required defaultValue={me.full_name ?? ""} className="input" autoComplete="name" />
        </label>
        <label className="label">
          Утасны дугаар
          <div className="flex items-center h-12 border-2 border-ink rounded-[12px] bg-card overflow-hidden">
            <span className="mono px-3 text-muted border-r border-line h-full flex items-center">+976</span>
            <input name="phone" type="tel" required minLength={8} defaultValue={me.phone ?? ""} className="mono flex-1 h-full px-3 outline-none bg-transparent text-[15px]" autoComplete="tel" />
          </div>
        </label>
        <label className="label">
          Хот / аймаг
          <select name="city" defaultValue={me.city ?? "Улаанбаатар"} className="input">
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex items-start gap-2.5 text-[13px] leading-snug text-[#2b2f35]">
          <input type="checkbox" name="consent" defaultChecked={me.profile_completed} className="w-5 h-5 m-0 accent-ink shrink-0" />
          Менежер миний утсаар холбогдохыг зөвшөөрч байна
        </label>
        <button className="btn btn-lg btn-ink mt-2">
          {creating && next === "/post" ? "Профайл үүсгээд зар нэмэх" : "Хадгалах"}
        </button>
      </form>
      {!creating && (
        <Link href="/loans" className="card px-4 py-3.5 flex items-center justify-between gap-3 no-underline text-ink">
          <span className="flex flex-col"><span className="font-semibold text-[15px]">Миний лизингийн хүсэлтүүд</span><span className="text-[13px] text-muted">Илгээсэн хүсэлтийн явц, хариу</span></span>
          <span aria-hidden>→</span>
        </Link>
      )}
      <form action="/auth/signout" method="post">
        <button className="btn btn-ghost w-full">Гарах</button>
      </form>
    </main>
  );
}
