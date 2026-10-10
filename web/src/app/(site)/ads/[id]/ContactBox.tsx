"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { IconHeart, IconPhone } from "@/components/icons";
import { toggleFavorite } from "../../actions";

/** loginHref өгөгдсөн бол (нэвтрээгүй) хадгалах товч нэвтрэх хуудас руу үсэрнэ. */
export function ContactBox({ adId, phone, favorite, loginHref = null }: { adId: string; phone: string; favorite: boolean; loginHref?: string | null }) {
  const [show, setShow] = useState(false);
  const [fav, setFav] = useState(favorite);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2.5">
      {show ? (
        <a href={`tel:${phone}`} className="btn btn-lg btn-yellow flex-1 mono">
          <IconPhone /> {phone}
        </a>
      ) : (
        <button type="button" onClick={() => setShow(true)} className="btn btn-lg btn-yellow flex-1">
          <IconPhone /> Дугаар харах
        </button>
      )}
      {loginHref ? (
        <Link href={loginHref} aria-label="Нэвтэрч хадгалах" title="Нэвтэрч хадгалах" className="btn btn-lg btn-ghost w-[52px] px-0">
          <IconHeart size={22} />
        </Link>
      ) : (
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
      )}
    </div>
  );
}
