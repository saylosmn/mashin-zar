import { STATUS } from "@/lib/format";
import type { AdStatus } from "@shared/types";

export function StatusBadge({ status }: { status: AdStatus }) {
  const s = STATUS[status];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
