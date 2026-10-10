"use client";

import { useState } from "react";

/** Апп доторх хөтөчөөс (Facebook, Messenger г.м.) орсон үед гарах анхааруулга + холбоос хуулах товч. */
export function InAppNotice() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Хуучин WebView-д clipboard API байхгүй байж болно
      const t = document.createElement("textarea");
      t.value = url;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand("copy");
      } catch {}
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div role="alert" className="rounded-xl bg-pending-bg text-pending-fg px-4 py-3.5 flex flex-col gap-3">
      <p className="m-0 text-[14px] leading-relaxed font-semibold">
        Facebook/Messenger доторх хөтөч Google нэвтрэлтийг хаадаг. Баруун дээд буланд байгаа ⋯ товчийг дараад «Chrome/Safari-д нээх»-ийг сонгоно уу.
      </p>
      <button type="button" onClick={copy} className="btn btn-ghost bg-card self-start">
        {copied ? "✓ Холбоос хуулагдлаа" : "Холбоосыг хуулах"}
      </button>
      <span className="text-[12px] leading-snug">Эсвэл холбоосыг хуулж Chrome/Safari хөтөчид буулгаж нээнэ үү.</span>
    </div>
  );
}
