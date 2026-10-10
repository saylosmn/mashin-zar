import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type SyncEvent = { table: string; op: string; id?: string; status?: string };
type Listener = (e: SyncEvent) => void;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;

const emit = (payload: unknown) => {
  const e = (payload ?? {}) as SyncEvent;
  listeners.forEach((l) => l(e));
};

function ensureChannel() {
  if (channel) return;
  // Нийтийн суваг: зөвхөн нийтэд харагдах зарын өөрчлөлт, лизингийн нөхцөл
  channel = supabase
    .channel("mz-sync")
    .on("broadcast", { event: "change" }, (msg) => emit(msg.payload))
    .subscribe();
  // Апп дахин нээгдэхэд бүх дэлгэцийг шинэчилнэ
  AppState.addEventListener("change", (s) => {
    if (s === "active") listeners.forEach((l) => l({ table: "*", op: "RESUME" }));
  });
}

// Хувийн сувгууд (RLS-ээр хамгаалагдсан): өөрийн мэдээлэл, ажилтан, лизингийн компани
let privateChannels: RealtimeChannel[] = [];
let identityKey = "";

/** Нэвтэрсэн хэрэглэгчийн эрхэд тохирох хувийн сувгуудад холбогдоно (гарахад салгана). */
export async function setLiveIdentity(uid?: string | null, role?: string | null, partner?: string | null) {
  const topics = uid
    ? [`u:${uid}`, ...(role === "manager" || role === "admin" ? ["mz-staff"] : []), ...(role === "leasing" && partner ? [`p:${partner}`] : [])]
    : [];
  const key = topics.join(",");
  if (key === identityKey) return;
  identityKey = key;
  for (const c of privateChannels) supabase.removeChannel(c);
  privateChannels = [];
  if (!topics.length) return;
  ensureChannel();
  try {
    await supabase.realtime.setAuth();
  } catch {}
  if (identityKey !== key) return; // энэ хооронд хэрэглэгч солигдсон
  privateChannels = topics.map((t) =>
    supabase.channel(t, { config: { private: true } }).on("broadcast", { event: "change" }, (msg) => emit(msg.payload)).subscribe(),
  );
}

/**
 * Өгөгдлийн санд өөрчлөлт орох бүрт cb-г дуудна (refresh шаардлагагүй).
 * tables: зөвхөн эдгээр хүснэгтийн өөрчлөлтөд хариу үйлдэл үзүүлнэ.
 */
export function useLiveSync(cb: (e: SyncEvent) => void, tables: string[] = ["ads"]) {
  const ref = useRef(cb);
  ref.current = cb;
  const key = tables.join(",");
  useEffect(() => {
    ensureChannel();
    let t: ReturnType<typeof setTimeout> | null = null;
    const l: Listener = (e) => {
      if (e.table !== "*" && !key.split(",").includes(e.table)) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => ref.current(e), 300);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
      if (t) clearTimeout(t);
    };
  }, [key]);
}
