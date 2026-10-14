"use client";

import { useSyncExternalStore } from "react";
import { IconWifiOff } from "./icons";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="alert" className="border-b border-[#f5c9a0] bg-pending-bg text-[#6b3000]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-6 py-3 text-[14px]">
        <IconWifiOff />
        <span className="min-w-[240px] flex-1">
          <strong>Интернэт холболт тасарлаа.</strong> Холболт сэргэмэгц хуудас автоматаар шинэчлэгдэнэ.
        </span>
        <button type="button" onClick={() => location.reload()} className="btn btn-sm btn-ghost">
          Дахин холбогдох
        </button>
      </div>
    </div>
  );
}
