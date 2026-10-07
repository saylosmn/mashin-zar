import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type SyncEvent = { table: string; op: string; id?: string; status?: string };
type Listener = (e: SyncEvent) => void;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;

function ensureChannel() {
  if (channel) return;
  channel = supabase
    .channel("mz-sync")
    .on("broadcast", { event: "change" }, (msg) => {
      const e = (msg.payload ?? {}) as SyncEvent;
      listeners.forEach((l) => l(e));
    })
    .subscribe();
  // Апп дахин нээгдэхэд бүх дэлгэцийг шинэчилнэ
  AppState.addEventListener("change", (s) => {
    if (s === "active") listeners.forEach((l) => l({ table: "*", op: "RESUME" }));
  });
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
