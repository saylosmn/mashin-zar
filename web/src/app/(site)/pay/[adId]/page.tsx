import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings, requireUser } from "@/lib/data";
import { dateShort, money } from "@/lib/format";
import { expiryInfo, isFeatured } from "@shared/commission";
import { PAY_STATUS } from "@/lib/payments";
import { CarPhoto } from "@/components/CarPhoto";
import { IconCheck } from "@/components/icons";
import type { Ad, Payment } from "@shared/types";
import { CopyButton } from "../../agent/CopyButton";
import { startPayment, submitPayment } from "../../actions";

export const metadata = { title: "Онцлох зарын төлбөр" };

type Search = { created?: string; sent?: string; err?: string };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ adId: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ adId }, sp] = await Promise.all([params, searchParams]);
  const me = await requireUser(`/pay/${adId}`);
  if (!/^[0-9a-f-]{36}$/i.test(adId)) notFound();
  const supabase = await createClient();
  const [settings, { data: adRow }, { data: payRows }] = await Promise.all([
    getSettings(),
    supabase.from("ads").select("*").eq("id", adId).eq("user_id", me.id).maybeSingle(),
    supabase
      .from("payments")
      .select("*")
      .eq("ad_id", adId)
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const ad = adRow as Ad | null;
  if (!ad) notFound();
  const pays = (payRows ?? []) as Payment[];
  const open = pays.find((p) => p.status === "awaiting" || p.status === "submitted" || p.status === "rejected") ?? null;
  const confirmed = pays.find((p) => p.status === "confirmed") ?? null;
  const featured = isFeatured(ad.featured_until);
  const expired = expiryInfo(ad.expires_at).expired;
  const canStart = ad.status === "active" && !expired;
  const price = settings.featured_price ?? 50000;
  const days = settings.featured_days ?? 7;
  const bank = { name: settings.pay_bank, account: settings.pay_account, holder: settings.pay_holder };

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-col gap-1.5">
        <Link href="/my" className="text-[14px] font-semibold">
          ← Миний зарууд
        </Link>
        <h1 className="h-display m-0 text-[clamp(24px,3vw,32px)]">Онцлох зарын төлбөр</h1>
      </div>

      {sp.created && (
        <p role="status" className="m-0 rounded-2xl bg-ink px-5 py-4 text-[14px] leading-relaxed text-paper">
          <strong className="text-yellow">Зар хадгалагдлаа.</strong> Доорх данс руу шилжүүлээд «Төлбөр төлсөн» дарна уу.
          Орлого баталгаажмагц зар тань шууд нийтлэгдэж, онцлох болно.
        </p>
      )}
      {sp.err && (
        <p role="alert" className="m-0 rounded-xl bg-danger-bg px-4 py-3 text-[14px] text-[#9b1c1c]">
          {sp.err}
        </p>
      )}

      <div className="card flex items-center gap-3.5 p-4">
        <CarPhoto path={ad.photos[0]} alt="" className="h-[72px] w-[96px] shrink-0 rounded-lg" label="IMG" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[16px] font-semibold">
            {ad.brand} {ad.model} · {ad.year_made}
          </span>
          <span className="h-display text-[15px]">{money(ad.price)}</span>
          {featured && (
            <span className="text-[13px] font-semibold text-pending-fg">
              ⭐ Онцлох · {dateShort(ad.featured_until)} хүртэл
            </span>
          )}
        </div>
      </div>

      {open ? (
        <>
          <section className="flex flex-col gap-4 rounded-[18px] bg-ink p-5.5 text-paper">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="h-display text-[18px]">Шилжүүлэх</span>
              <span className={`badge ${PAY_STATUS[open.status].cls}`}>{PAY_STATUS[open.status].label}</span>
            </div>
            <Row label="Дүн" value={money(open.amount)} copy={String(open.amount)} big />
            <Row label="Гүйлгээний утга" value={open.ref} copy={open.ref} big accent />
            {bank.account ? (
              <>
                <Row label="Данс" value={bank.account} copy={bank.account.replace(/\s/g, "")} />
                {bank.name && <Row label="Банк" value={bank.name} />}
                {bank.holder && <Row label="Хүлээн авагч" value={bank.holder} />}
              </>
            ) : (
              <p className="m-0 text-[14px] text-pale">
                Дансны мэдээлэл удахгүй нэмэгдэнэ. Манай ажилтан тантай холбогдож төлбөрийг тохирно.
              </p>
            )}
            <p className="m-0 text-[13px] leading-relaxed text-pale">
              ⚠ Гүйлгээний утгад заавал <strong className="mono text-yellow">{open.ref}</strong> гэж бичнэ үү —
              ингэснээр таны төлбөрийг хурдан олно. ⭐ {open.days} хоног онцлох, шимтгэлгүй.
            </p>
          </section>

          {open.status === "submitted" ? (
            <div role="status" className="card flex flex-col gap-1.5 p-5">
              <span className="text-[16px] font-bold">⏳ Шалгаж байна</span>
              <span className="text-[14px] text-body">
                {open.submitted_at ? `${dateShort(open.submitted_at)}-нд илгээсэн. ` : ""}Орлого баталгаажмагц танд
                мэдэгдэл ирж,{" "}
                {ad.status === "active"
                  ? "зар тань шууд онцлох болно"
                  : ad.status === "pending"
                    ? "зар тань шууд нийтлэгдэнэ"
                    : "зарыг шалгаж нийтэлнэ"}
                .
              </span>
            </div>
          ) : (
            <form action={submitPayment} className="card flex flex-col gap-3.5 p-5">
              <input type="hidden" name="id" value={open.id} />
              <input type="hidden" name="ad" value={ad.id} />
              {open.status === "rejected" && (
                <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-3 text-[14px] text-[#9b1c1c]">
                  Таны төлбөр орж ирээгүй байна{open.admin_note ? `: ${open.admin_note}` : "."} Дүн, гүйлгээний утгаа
                  шалгаад дахин илгээнэ үү.
                </p>
              )}
              <label className="label text-[14px]">
                Шилжүүлсэн хүний нэр / данс <span className="font-normal text-muted">(заавал биш)</span>
                <input
                  name="note"
                  maxLength={300}
                  defaultValue={open.payer_note ?? ""}
                  className="input font-normal"
                  placeholder="Жишээ: Б.Болд, Хаан банк"
                />
              </label>
              <button className="btn btn-lg btn-yellow">Төлбөр төлсөн</button>
              <span className="text-[12px] text-muted">
                Шилжүүлсний дараа дарна уу. Бид орлогыг шалгаад баталгаажуулна.
              </span>
            </form>
          )}
        </>
      ) : confirmed && (ad.status === "pending" || ad.status === "rejected") ? (
        <Success text={`Зар шалгагдаж нийтлэгдмэгц ${confirmed.days} хоног онцлох болно.`} />
      ) : canStart ? (
        <form action={startPayment} className="card flex flex-col gap-3.5 p-5.5">
          <input type="hidden" name="id" value={ad.id} />
          {confirmed && featured && <Success text={`Таны зар ${dateShort(ad.featured_until)} хүртэл онцлох байна.`} />}
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-[17px] font-bold">{featured ? "Онцлох хугацааг сунгах" : "Зараа онцлох болгох"}</span>
            <span className="h-display text-[22px]">{money(price)}</span>
          </div>
          <ul className="m-0 flex flex-col gap-1 pl-5 text-[14px]">
            <li>⭐ {days} хоног жагсаалтын эхэнд, тэмдэгтэй харагдана</li>
            <li>Дансаар шилжүүлэхэд орлого автоматаар шалгагдана</li>
          </ul>
          <button className="btn btn-lg btn-yellow">Төлбөрийн мэдээлэл авах</button>
        </form>
      ) : (
        <p className="card m-0 px-5 py-6 text-center text-[14px] text-muted">
          {ad.status === "pending"
            ? "Зар шалгалтад байна. Нийтлэгдсэний дараа онцлох болгох боломжтой."
            : "Энэ зарыг одоогоор онцлох болгох боломжгүй."}
        </p>
      )}
    </main>
  );
}

function Row({
  label,
  value,
  copy,
  big = false,
  accent = false,
}: {
  label: string;
  value: string;
  copy?: string;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-line pt-3">
      <span className="text-[13px] text-pale">{label}</span>
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`${big ? "h-display text-[22px]" : "mono text-[16px] font-bold"} ${accent ? "text-yellow" : ""} break-all`}
        >
          {value}
        </span>
        {copy && <CopyButton text={copy} label="Хуулах" />}
      </span>
    </div>
  );
}

function Success({ text }: { text: string }) {
  return (
    <div role="status" className="card flex items-center gap-3.5 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow text-ink">
        <IconCheck size={22} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[16px] font-bold">Төлбөр баталгаажсан</span>
        <span className="text-[14px] text-body">{text}</span>
      </div>
    </div>
  );
}
