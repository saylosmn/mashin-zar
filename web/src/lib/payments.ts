import { PAY_STATUS_LABEL } from "@shared/payments";
import type { PayStatus } from "@shared/types";

export { PLAN_LABEL, needsAction } from "@shared/payments";

const CLS: Record<PayStatus, string> = {
  awaiting: "bg-pending-bg text-pending-fg",
  submitted: "bg-pending-bg text-pending-fg",
  confirmed: "bg-active-bg text-active-fg",
  rejected: "bg-danger-bg text-[#9b1c1c]",
  cancelled: "bg-soft text-body",
};

export const PAY_STATUS = Object.fromEntries(
  (Object.keys(CLS) as PayStatus[]).map((s) => [s, { label: PAY_STATUS_LABEL[s], cls: CLS[s] }]),
) as Record<PayStatus, { label: string; cls: string }>;
