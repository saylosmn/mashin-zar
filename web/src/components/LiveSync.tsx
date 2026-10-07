"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Өгөгдлийн сангийн өөрчлөлтийг сонсож, хуудсыг refresh хийлгүйгээр шинэчилнэ.
 * - "mz-sync" нийтийн суваг: зар, профайл, тохиргоо өөрчлөгдөхөд DB trigger дохио илгээнэ
 * - notifications: зөвхөн өөрийн мэдэгдэл (RLS)
 * router.refresh() нь серверээс шинэ өгөгдөл авчирдаг ч бөглөж буй формын утгыг алдагдуулахгүй.
 */
export function LiveSync({ userId }: { userId?: string | null }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 350);
    };

    const sync = supabase.channel("mz-sync").on("broadcast", { event: "change" }, refresh).subscribe();

    const mine = userId
      ? supabase
          .channel(`notif-${userId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, refresh)
          .subscribe()
      : null;

    // Интернэт сэргэх эсвэл таб руу буцаж ирэхэд ч шинэчилнэ
    const onBack = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onBack);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(sync);
      if (mine) supabase.removeChannel(mine);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [router, userId]);

  return null;
}
