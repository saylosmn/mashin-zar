import { C } from "./theme";
import type { PayStatus } from "./types";

/** Төлбөрийн төлөвийн нэр, өнгө (вэбийн web/src/lib/payments.ts-тэй ижил нэршил) */
export const PAY_STATUS: Record<PayStatus, { label: string; bg: string; fg: string }> = {
  awaiting: { label: "Төлбөр хүлээгдэж байна", bg: C.pendingBg, fg: C.pendingFg },
  submitted: { label: "Төлбөр шалгагдаж байна", bg: C.pendingBg, fg: C.pendingFg },
  confirmed: { label: "Төлбөр баталгаажсан", bg: C.activeBg, fg: C.activeFg },
  rejected: { label: "Төлбөр орж ирээгүй", bg: C.dangerBg, fg: C.danger },
  cancelled: { label: "Цуцлагдсан", bg: C.soft, fg: C.body },
};

/** Хэрэглэгч одоо төлөх/дахин илгээх шаардлагатай эсэх */
export const needsAction = (s: PayStatus) => s === "awaiting" || s === "rejected";
