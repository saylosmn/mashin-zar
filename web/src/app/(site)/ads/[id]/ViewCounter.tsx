"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Зарын үзэлтийг нэг зочин нэг өдөрт нэг л удаа тоолно (хуудсыг хүлээлгэхгүй). */
export function ViewCounter({ adId }: { adId: string }) {
  useEffect(() => {
    const key = `viewed:${adId}`;
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ulaanbaatar" });
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      // localStorage хаалттай (private горим) бол ч тоолно
    }
    createClient()
      .rpc("increment_view", { p_ad: adId })
      .then(
        () => {},
        () => {},
      );
  }, [adId]);
  return null;
}
