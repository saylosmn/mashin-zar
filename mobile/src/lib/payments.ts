import { PAY_STATUS_LABEL } from "@shared/payments";
import type { PayStatus } from "@shared/types";
import { C } from "./theme";

export { PLAN_LABEL, needsAction } from "@shared/payments";

const COLORS: Record<PayStatus, { bg: string; fg: string }> = {
  awaiting: { bg: C.pendingBg, fg: C.pendingFg },
  submitted: { bg: C.pendingBg, fg: C.pendingFg },
  confirmed: { bg: C.activeBg, fg: C.activeFg },
  rejected: { bg: C.dangerBg, fg: C.danger },
  cancelled: { bg: C.soft, fg: C.body },
};

export const PAY_STATUS = Object.fromEntries(
  (Object.keys(COLORS) as PayStatus[]).map((s) => [s, { label: PAY_STATUS_LABEL[s], ...COLORS[s] }]),
) as Record<PayStatus, { label: string; bg: string; fg: string }>;
