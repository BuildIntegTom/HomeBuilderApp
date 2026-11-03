import { computeGapEnd, type CornerId, type Footprint, type PanelSlot } from "@building-integrity/geometry";
import { DEFAULT_BRACE_PAIR_PATTERN, applyWallBracingPattern, type BraceablePanel } from "@building-integrity/panel-catalog";

/**
 * ⚠ **THE BRACE PATTERN IS LAID WHEN THE SHAPE IS DRAWN — B15.**
 *
 * > *"Applying this patterned bracing should be part of the original tiling
 * > when drawing a shape."* — Tommy, 2026-11-01
 *
 * `applyWallBracingPattern` has done the hard part since 2026-10-25 — pairing
 * from the least accessible end, breaking a run at anything ineligible,
 * giving an odd last panel half a pattern — and **nothing called it.** It was
 * built, exported and covered by ten tests, and no panel in the app had ever
 * carried a pair pattern. This is the call.
 *
 * ⚠ **Eligibility is decided HERE, deliberately.** `BraceablePanel.eligible`
 * carries its own note: *"The caller decides this; inventing an eligibility
 * rule here would bury a building decision in a geometry module."* Asked on
 * 2026-11-01, Tommy chose **standard panels only** — corners and columns are
 * already stiff plywood boxes, and a header, a window, a door or a safety
 * gap's plywood spacer has nothing to route a diagonal through. Pairing
 * restarts after each of those, so an X never reaches across one.
 *
 * ⚠ **`braced` slots are NOT eligible, and until B17 that meant a wall
 * carried BOTH systems at once.** He chose "the pattern replaces them", and on
 * 2026-11-02 the replacement happened: both automatic bracing rules were
 * retired, so **the pattern now runs continuously from corner to corner on
 * every ordinary wall** instead of restarting after each seeded chevron. See
 * the record at the top of `bracedPlacement.ts` (geometry) for what went and
 * why.
 *
 * A `braced` slot still breaks the pair run it sits in, because pairing
 * restarts after anything ineligible — but now it only sits there because
 * somebody put it there, which makes the discontinuity a choice rather than a
 * default. Whether a Braced Panel should instead take its own pattern half is
 * open and his to decide.
 *
 * ⚠ **His standing reservation, recorded because it is about the
 * BUILDING and not the code:** *"My general feeling with this is that we are
 * over bracing with these kind of patterns."* He said to proceed anyway. If
 * it proves too much, the lever is one constant — `DEFAULT_BRACE_PAIR_PATTERN`
 * from `superbrace` (two legs plus two returns per panel) to `braced` (one
 * leg plus a tie) or `nailer` (no diagonal at all).
 *
 * ⚠ **Ground floor only**, his scope answer. The second story and the gable
 * rows keep what they have until this is proven on the walls below them.
 */

/** Only a plain standard panel takes a leg of the pattern. See the note above. */
export function isBraceEligible(slot: PanelSlot): boolean {
  return slot.type === "standard";
}

/**
 * Which end of a wall the pairing walks FROM: the one nearest the least
 * accessible corner.
 *
 * ⚠ `computeGapEnd` answers the opposite question — it puts the safety gap at
 * the end FURTHEST from that corner — so this is its inverse rather than a
 * second distance calculation that could disagree with it.
 */
export function bracingStartFrom(
  footprint: Footprint,
  wallId: string,
  leastAccessibleCornerId: CornerId,
): "start" | "end" {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return "start";
  return computeGapEnd(wall, leastAccessibleCornerId, footprint.corners) === "end" ? "start" : "end";
}

/**
 * Every wall's slots with the pattern written onto the eligible ones.
 *
 * Pure, and returns a new map — nothing here reads state, which is the same
 * shape `applyRoofDefaultsForFootprint` settled on for the roof.
 *
 * ⚠ **Despite the name, this does NOT run only at draw time**, and the
 * name is kept because draw time is when it first fires and what he asked
 * for. It is called from `page.tsx`'s `overlayWallSlots` memo, which is the
 * one layer every re-tile path flows through — toggling an opening, dragging
 * a panel, repanelizing a run, loading a project. A pattern written once
 * inside `handleDraw` would silently vanish from the wall you just put a
 * window in, because that wall's slots are rebuilt from the tiler. See that
 * memo's own note.
 */
export function applyDrawTimeBracing(
  footprint: Footprint,
  slotsByWallId: Record<string, PanelSlot[]>,
  leastAccessibleCornerId: CornerId,
  pattern = DEFAULT_BRACE_PAIR_PATTERN,
  wallHeightIn?: number,
): Record<string, PanelSlot[]> {
  const out: Record<string, PanelSlot[]> = {};
  for (const [wallId, slots] of Object.entries(slotsByWallId)) {
    /* An id lets the overlay hand its answer back per panel without the
       caller having to re-walk the array in the same order. */
    const panels: BraceablePanel[] = slots.map((slot, index) => ({
      id: `${wallId}:${index}`,
      widthIn: slot.widthIn,
      /* The height only scales the legs; a wall's panels all share one. */
      heightIn: wallHeightIn ?? 0,
      eligible: isBraceEligible(slot),
    }));

    const result = applyWallBracingPattern({
      pattern,
      panels,
      startFrom: bracingStartFrom(footprint, wallId, leastAccessibleCornerId),
    });

    /* `half` is not returned per panel, so it is read back off the pairs:
       a pair's left panel is its left half, its right panel the right. An
       unpaired panel takes the LEFT half — *"Just do it till it ends"*, the
       same legs it would have taken with a partner. */
    const halfById = new Map<string, "left" | "right">();
    for (const pair of result.pairs) {
      halfById.set(pair.leftPanelId, "left");
      halfById.set(pair.rightPanelId, "right");
    }
    for (const id of result.unpairedPanelIds) halfById.set(id, "left");

    out[wallId] = slots.map((slot, index) => {
      const half = halfById.get(`${wallId}:${index}`);
      return half === undefined ? slot : { ...slot, bracePairPattern: pattern, bracePairHalf: half };
    });
  }
  return out;
}
