import { LOAN_STATUS_LABEL, type LoanStatus } from "@shared/loan";

export * from "@shared/loan";

const CLS: Record<LoanStatus, string> = {
  new: "bg-pending-bg text-pending-fg",
  contacted: "bg-active-bg text-active-fg",
  approved: "bg-[#DDF3E4] text-[#1D6B3A]",
  rejected: "bg-danger-bg text-[#9b1c1c]",
  cancelled: "bg-soft text-body",
};

export const LOAN_STATUS = Object.fromEntries(
  (Object.keys(CLS) as LoanStatus[]).map((s) => [s, { label: LOAN_STATUS_LABEL[s], cls: CLS[s] }]),
) as Record<LoanStatus, { label: string; cls: string }>;

/** Вэб дээр баримтыг PDF эсвэл зургаар оруулна */
export const docHint = (d: { source?: string }) => (d.source ? `${d.source} (PDF эсвэл зураг)` : null);
