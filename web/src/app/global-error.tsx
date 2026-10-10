"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/log-error";

/** Үндсэн layout өөрөө унасан үед (маш ховор) */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logClientError(error, { digest: error.digest });
  }, [error]);
  return (
    <html lang="mn">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f3f4f1", color: "#111317", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", margin: 0, padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Алдаа гарлаа</h1>
          <p style={{ margin: 0, lineHeight: 1.5 }}>Түр зуурын саатал гарсан байна. Хэдэн секундын дараа дахин оролдоно уу.</p>
          <button type="button" onClick={() => reset()} style={{ height: 48, borderRadius: 12, border: 0, background: "#111317", color: "#f5b800", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            Дахин оролдох
          </button>
        </div>
      </body>
    </html>
  );
}
