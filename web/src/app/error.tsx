"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageMessage } from "@/components/PageMessage";
import { IconRetry, WarnSign } from "@/components/icons";
import { logClientError } from "@/lib/log-error";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    logClientError(error, { digest: error.digest });
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <PageMessage
      icon={<WarnSign width={200} />}
      title={offline ? "Интернэт холболт алга" : "Алдаа гарлаа"}
      actions={
        <>
          <button type="button" onClick={() => retry()} className="btn btn-lg btn-ink">
            <IconRetry /> Дахин оролдох
          </button>
          <Link href="/" className="btn btn-lg btn-ghost">Нүүр хуудас</Link>
        </>
      }
    >
      <p className="m-0">
        {offline
          ? "Wi-Fi эсвэл мобайл датагаа шалгаад дахин оролдоно уу."
          : "Манай талд түр зуурын саатал гарсан байна. Хэдэн секундын дараа дахин оролдоно уу."}
      </p>
      {error.digest && (
        <p className="m-0 mt-3 text-[13px] text-muted">
          Лавлах код: <span className="mono text-ink">{error.digest}</span>
        </p>
      )}
    </PageMessage>
  );
}
