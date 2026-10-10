"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, isStandalone, pushState, registerSW, type PushState } from "@/lib/webpush";
import { IconBell } from "./icons";

/** Бүх хуудсанд: service worker бүртгэнэ (push хүлээн авахад хэрэгтэй). */
export function PwaSetup() {
  useEffect(() => {
    registerSW();
  }, []);
  return null;
}

function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    pushState().then(setState).catch(() => setState("unsupported"));
  }, []);
  return [state, setState] as const;
}

/** Мэдэгдлийн хуудас, профайл дээрх "Утсанд мэдэгдэл авах" хэсэг. */
export function WebPushCard() {
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!state || state === "unsupported") return null;

  async function toggle(on: boolean) {
    setBusy(true);
    setErr(null);
    try {
      setState(on ? await enablePush() : await disablePush());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4.5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-ink text-yellow flex items-center justify-center shrink-0"><IconBell size={20} /></span>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-bold text-[15px]">Утсанд мэдэгдэл авах</span>
          <span className="text-[13px] text-muted leading-snug">
            {state === "on" && "Асаалттай ✓ Шинэ зар, санал, зарын төлөв өөрчлөгдөхөд утсанд тань мэдэгдэл ирнэ."}
            {state === "off" && "Шинэ зар, санал ирэхэд апп хаалттай байсан ч утсанд мэдэгдэл ирнэ."}
            {state === "denied" && "Мэдэгдэл хаагдсан байна. Утасны Тохиргоо → Мэдэгдэл → Машин зар хэсгээс зөвшөөрнө үү."}
            {state === "ios-install" && "iPhone дээр эхлээд энэ сайтыг нүүр дэлгэцэндээ нэмнэ: Safari-ийн доод талын Share (⬆) → “Add to Home Screen”. Дараа нь нүүр дэлгэцээс нээгээд энд “Асаах” дарна."}
          </span>
        </div>
      </div>
      {state === "off" && (
        <button onClick={() => toggle(true)} disabled={busy} className="btn btn-yellow h-11">
          {busy ? "Түр хүлээнэ үү…" : "Мэдэгдэл асаах"}
        </button>
      )}
      {state === "on" && (
        <button onClick={() => toggle(false)} disabled={busy} className="btn btn-ghost h-10 text-[13px] self-start">
          Унтраах
        </button>
      )}
      {err && <p role="alert" className="m-0 text-[13px] text-danger">{err}</p>}
    </section>
  );
}

/** Нүүр дэлгэцэнд суулгасан (standalone) апп дээр мэдэгдэл асаагаагүй бол дээд талд санал болгоно. */
export function PushPrompt() {
  const [state, setState] = usePushState();
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  if (hide || state !== "off" || !isStandalone()) return null;
  return (
    <div className="bg-yellow text-ink">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <IconBell size={18} />
        <span className="flex-1 text-[13px] font-semibold">Шинэ зар, санал ирэхэд мэдэгдэл авах уу?</span>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setState(await enablePush());
            } catch {
              setHide(true);
            } finally {
              setBusy(false);
            }
          }}
          className="btn btn-ink h-9 px-3 text-[13px]"
        >
          Асаах
        </button>
        <button onClick={() => setHide(true)} aria-label="Хаах" className="bg-transparent border-0 p-1 cursor-pointer text-ink text-[18px] leading-none">×</button>
      </div>
    </div>
  );
}
