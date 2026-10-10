"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Өгөгдлийн сангийн өөрчлөлтийг сонсож, хуудсыг refresh хийлгүйгээр шинэчилнэ.
 * - "mz-sync" нийтийн суваг: зөвхөн нийтэд харагдах зар, лизингийн нөхцөлийн өөрчлөлт
 * - хувийн сувгууд (RLS): "u:<id>" өөрийн мэдээлэл, "mz-staff" менежер/админ, "p:<id>" лизингийн компани
 * - notifications: зөвхөн өөрийн мэдэгдэл (RLS)
 * router.refresh() нь серверээс шинэ өгөгдөл авчирдаг ч бөглөж буй формын утгыг алдагдуулахгүй.
 */
export function LiveSync({ userId, role, partnerId }: { userId?: string | null; role?: string | null; partnerId?: string | null }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 350);
    };

    const sync = supabase.channel("mz-sync").on("broadcast", { event: "change" }, refresh).subscribe();

    const topics = userId
      ? [`u:${userId}`, ...(role === "manager" || role === "admin" ? ["mz-staff"] : []), ...(role === "leasing" && partnerId ? [`p:${partnerId}`] : [])]
      : [];
    let privateChannels: ReturnType<typeof supabase.channel>[] = [];
    let cancelled = false;
    if (topics.length) {
      supabase.realtime
        .setAuth()
        .catch(() => {})
        .then(() => {
          if (cancelled) return;
          privateChannels = topics.map((t) => supabase.channel(t, { config: { private: true } }).on("broadcast", { event: "change" }, refresh).subscribe());
        });
    }

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
      cancelled = true;
      supabase.removeChannel(sync);
      privateChannels.forEach((c) => supabase.removeChannel(c));
      if (mine) supabase.removeChannel(mine);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [router, userId, role, partnerId]);

  return null;
}
