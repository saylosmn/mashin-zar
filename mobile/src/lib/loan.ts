import { LOAN_STATUS_LABEL, type LoanStatus } from "@shared/loan";
import { C } from "./theme";

export * from "@shared/loan";

const COLORS: Record<LoanStatus, { bg: string; fg: string }> = {
  new: { bg: C.pendingBg, fg: C.pendingFg },
  contacted: { bg: C.activeBg, fg: C.activeFg },
  approved: { bg: "#DDF3E4", fg: "#1D6B3A" },
  rejected: { bg: C.dangerBg, fg: "#9B1C1C" },
  cancelled: { bg: C.soft, fg: C.body },
};

export const LOAN_STATUS = Object.fromEntries(
  (Object.keys(COLORS) as LoanStatus[]).map((s) => [s, { label: LOAN_STATUS_LABEL[s], ...COLORS[s] }]),
) as Record<LoanStatus, { label: string; bg: string; fg: string }>;

/** Апп дээр баримтыг дэлгэцийн зургаар (screenshot) оруулна */
export const docHint = (d: { source?: string }) => (d.source ? `${d.source}. Дэлгэцийн зургийг оруулна` : null);
