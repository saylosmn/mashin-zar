"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm btn-yellow"
      onClick={async () => {
        try {
          if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent) && text.startsWith("http")) {
            await navigator.share({ url: text, title: "Машин зар" });
            return;
          }
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* хэрэглэгч цуцалсан */
        }
      }}
    >
      {done ? "✓ Хуулагдлаа" : label}
    </button>
  );
}
