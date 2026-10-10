"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompare } from "@/components/Compare";
import { compareHref, toggleId } from "@/lib/compare";

/** Хуваалцсан холбоосоор орж ирвэл жагсаалтыг URL-тай тааруулна (хоосон бол хадгалсныг ачаална). */
export function CompareSync({ ids }: { ids: string[] }) {
  const { ids: saved, set } = useCompare();
  const router = useRouter();
  const key = ids.join(",");
  useEffect(() => {
    if (ids.length) set(ids);
    else if (saved.length) router.replace(compareHref(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export function RemoveFromCompare({ id }: { id: string }) {
  const { ids, set } = useCompare();
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-[12px] text-muted underline bg-transparent border-0 p-0 cursor-pointer self-start"
      onClick={() => {
        const next = toggleId(ids.includes(id) ? ids : [...ids, id], id);
        set(next);
        router.replace(compareHref(next));
      }}
    >
      Хасах
    </button>
  );
}
