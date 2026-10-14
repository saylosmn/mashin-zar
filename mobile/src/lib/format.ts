import { AD_STATUS_LABEL } from "@shared/format";
import type { AdStatus } from "@shared/types";
import { C } from "./theme";

export * from "@shared/format";

const COLORS: Record<AdStatus, { bg: string; fg: string }> = {
  pending: { bg: C.pendingBg, fg: C.pendingFg },
  active: { bg: C.activeBg, fg: C.activeFg },
  sold: { bg: C.soldBg, fg: C.soldFg },
  rejected: { bg: C.dangerBg, fg: "#9B1C1C" },
  hidden: { bg: C.soft, fg: C.body },
};

export const STATUS = Object.fromEntries(
  (Object.keys(COLORS) as AdStatus[]).map((s) => [s, { label: AD_STATUS_LABEL[s], ...COLORS[s] }]),
) as Record<AdStatus, { label: string; bg: string; fg: string }>;
