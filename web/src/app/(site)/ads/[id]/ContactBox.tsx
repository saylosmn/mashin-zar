"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { IconHeart, IconPhone } from "@/components/icons";
import { revealPhone, toggleFavorite } from "../../actions";

/**
 * Утас харах (зөвхөн нэвтэрсэн хүнд), чатлах, хадгалах.
 * loginHref өгөгдсөн бол нэвтрээгүй - товчнууд нэвтрэх хуудас руу үсэрнэ.
 */
export function ContactBox({
  adId,
  favorite,
  loginHref = null,
}: {
  adId: string;
  favorite: boolean;
  loginHref?: string | null;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fav, setFav] = useState(favorite);
  const [pending, start] = useTransition();
  const [loading, startPhone] = useTransition();
  const chatHref = `/messages/start/${adId}`;

  if (loginHref)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2.5">
          <Link href={loginHref} className="btn btn-lg btn-yellow flex-1">
            <IconPhone /> Нэвтэрч дугаар харах
          </Link>
          <Link
            href={loginHref}
            aria-label="Нэвтэрч хадгалах"
            title="Нэвтэрч хадгалах"
            className="btn btn-lg btn-ghost w-[52px] px-0"
          >
            <IconHeart size={22} />
          </Link>
        </div>
        <Link href={`/login?next=${encodeURIComponent(chatHref)}`} className="btn btn-lg btn-ink">
          💬 Худалдагчтай чатлах
        </Link>
        <span className="text-[12px] text-muted">Худалдагчийн утас, чат нэвтэрсэн хэрэглэгчид харагдана.</span>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2.5">
        {phone ? (
          <a href={`tel:${phone}`} className="btn btn-lg btn-yellow mono flex-1">
            <IconPhone /> {phone}
          </a>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              startPhone(async () => {
                setErr(null);
                const r = await revealPhone(adId);
                if (r.phone) setPhone(r.phone);
                else setErr(r.error ?? "Алдаа гарлаа");
              })
            }
            className="btn btn-lg btn-yellow flex-1"
          >
            <IconPhone /> {loading ? "Уншиж байна…" : "Дугаар харах"}
          </button>
        )}
        <button
          type="button"
          aria-label={fav ? "Хадгалснаас хасах" : "Хадгалах"}
          aria-pressed={fav}
          disabled={pending}
          onClick={() => {
            const next = !fav;
            setFav(next);
            start(() => toggleFavorite(adId, next));
          }}
          className={`btn btn-lg btn-ghost w-[52px] px-0 ${fav ? "text-[#c0262d]" : ""}`}
        >
          <IconHeart filled={fav} size={22} />
        </button>
      </div>
      <Link href={chatHref} className="btn btn-lg btn-ink">
        💬 Худалдагчтай чатлах
      </Link>
      {err && (
        <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-2.5 text-[13px] text-[#9b1c1c]">
          {err}
        </p>
      )}
    </div>
  );
}
