import type { CatalogStatus } from "@building-integrity/panel-catalog";

export interface ReviewLogEntry {
  label: string;
  status: CatalogStatus;
  note: string;
}

/** Collects only the pending entries — that's the list a Review Log actually needs to show. */
export function toReviewLog(
  entries: { label: string; status: CatalogStatus; note: string }[],
): ReviewLogEntry[] {
  return entries.filter((e) => e.status === "pending-BI-confirmation");
}
