import { C } from "@/lib/theme";

/** Тайлангийн төлөвийн нэр, өнгө */
export const ST = {
  pending: { label: "Хүлээгдэж буй", bg: C.pendingBg, fg: C.pendingFg },
  approved: { label: "Батлагдсан", bg: C.activeBg, fg: C.activeFg },
  rejected: { label: "Буцаагдсан", bg: C.dangerBg, fg: "#9B1C1C" },
} as const;
