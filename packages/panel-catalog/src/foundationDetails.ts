import type { FoundationTypeDef } from "./data";
import type { FastenerSpacingRow } from "./types";

/** The fastener schedule for a foundation's load path, in load-path order
 * — looks up each step's connection in the full fastener table (so the
 * numbers stay single-sourced, not duplicated) and silently skips steps
 * with no modeled fastener (e.g. the pier itself, which isn't a
 * connection). Used to build a Detail Guide page's fastener schedule. */
export function foundationFastenerSchedule(
  foundationType: FoundationTypeDef,
  fastenerTable: FastenerSpacingRow[],
): FastenerSpacingRow[] {
  return foundationType.loadPath
    .filter((step) => step.fastenerConnection !== undefined)
    .map((step) => fastenerTable.find((row) => row.connection === step.fastenerConnection))
    .filter((row): row is FastenerSpacingRow => row !== undefined);
}
