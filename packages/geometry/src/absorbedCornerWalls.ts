import { toEighths } from "./eighths";
import type { PanelSlot } from "./types";

export interface AbsorbedCornerWall {
  wallId: string;
  /** The two corner panels as fabricated, widest first. */
  cornerWidthsIn: [number, number];
  /** How much the pair was widened past two nominal corners, in total. */
  absorbedIn: number;
  /** The nominal corner width these were measured against — carried on the
   * record rather than left to the reader to look up, because it is not
   * always `cornerPanelWidthIn`: Square Bale panelization tiles with its own
   * panel width. A reporting caller can then render the whole entry from the
   * record alone. */
  nominalCornerWidthIn: number;
}

/**
 * Every wall whose CORNER PAIR absorbed a middle too small to hold a legal
 * panel — the 51in-75in two-corner band (see `resolveCorners` in `tiling.ts`).
 *
 * **Why this is reported at all, when the wall it describes is now legal.**
 * Corner absorb fixes a wall that previously had no legal tiling, so the
 * Review Log's sub-minimum-panel entry no longer fires on it. But the panels
 * it produces are corner panels **off their nominal 25.5in width** — up to
 * 37.5in — and `cornerPanelWidthIn` is a confirmed catalog value describing a
 * specific piece of construction ("24in core + two 3/4in plywood side
 * faces"). Tommy confirmed the corner-geometry ROUTE for this band; he has
 * not signed off on the individual widths it produces, and the shop has to
 * build them. An engineer reading the Review Log is exactly the person who
 * must not learn that from the cut list.
 *
 * **Deliberately NOT reported here: the merged corner.** A wall too short for
 * both corners has produced a single full-wall corner panel since long before
 * this rule existed, on Tommy's own instruction, and it is silent today.
 * Widening this walk to cover it would be a behaviour change to a settled
 * rule that nobody asked for — it is called out in the spec's Open Items
 * instead, along with the pre-existing defect that such a panel is over the
 * 48in ceiling between 48in and 51in.
 *
 * Nothing here runs at load and nothing here rewrites anything: a stored
 * design keeps exactly the panels it was saved with.
 */
export function findAbsorbedCornerWalls(
  slotsByWallId: Record<string, PanelSlot[]>,
  nominalCornerWidthIn: number,
): AbsorbedCornerWall[] {
  const nominalEighths = toEighths(nominalCornerWidthIn);
  const found: AbsorbedCornerWall[] = [];
  for (const [wallId, slots] of Object.entries(slotsByWallId ?? {})) {
    const list = slots ?? [];
    const corners = list.filter((s) => s.type === "corner" || s.type === "safety-oct-corner");
    // The absorbed shape and only the absorbed shape: a corner at each end,
    // neither NARROWER than nominal, their total WIDER than two nominal
    // corners, and no fabricated panel between them. A wall that merely has
    // wide corners AND standard panels is not this (and cannot be produced by
    // the tiler), and a merged corner is a single slot.
    //
    // ⚠ The test is on the PAIR's total, not on each corner individually.
    // Just inside the band the odd eighth goes entirely to one end — a
    // 51.125in wall is 25.625in + 25.5in — so requiring both to exceed
    // nominal would silently miss the first eighth of the band.
    if (corners.length !== 2) continue;
    if (list.some((s) => s.type === "standard" || s.type === "braced" || s.type === "column")) continue;
    if (corners.some((s) => toEighths(s.widthIn) < nominalEighths)) continue;
    const totalEighths = corners.reduce((sum, s) => sum + toEighths(s.widthIn), 0);
    if (totalEighths <= 2 * nominalEighths) continue;
    const widths = corners.map((s) => s.widthIn).sort((a, b) => b - a) as [number, number];
    found.push({
      wallId,
      cornerWidthsIn: widths,
      absorbedIn: widths[0] + widths[1] - 2 * nominalCornerWidthIn,
      nominalCornerWidthIn,
    });
  }
  return found;
}
