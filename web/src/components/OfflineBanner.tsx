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
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="alert" className="bg-pending-bg text-[#6b3000] border-b border-[#f5c9a0]">
      <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center gap-3 flex-wrap text-[14px]">
        <IconWifiOff />
        <span className="flex-1 min-w-[240px]">
          <strong>Интернэт холболт тасарлаа.</strong> Холболт сэргэмэгц хуудас автоматаар шинэчлэгдэнэ.
        </span>
        <button type="button" onClick={() => location.reload()} className="btn btn-sm btn-ghost">
          Дахин холбогдох
        </button>
      </div>
    </div>
  );
}
