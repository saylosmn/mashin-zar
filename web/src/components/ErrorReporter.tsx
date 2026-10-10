"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/log-error";

/** Барьж аваагүй алдаа, Promise-ийн алдааг бүртгэнэ. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => logClientError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => logClientError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
