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
 * ⚠ **`braced` slots are NOT eligible, and that is a half-finished story.**
 * He also chose "the pattern replaces them", meaning the dedicated
 * near-corner braced panels should stop being seeded at all. They are seeded
 * by `reconcileBracedPlacement` off `seismicBracedPanelSpacingFt[zone]` — a
 * SEISMIC spacing rule — and the seeding also drives the corner-brace combine,
 * which changes panel widths. Retiring it touches the seismic path, the
 * click-cycle, the Review Log's zero-bracing entry and that combine, so it is
 * its own stride. Until then a wall carries both: `braced` slots keep their
 * chevron/hatch, every `standard` panel gets a superbrace half. The seismic
 * spacing rule is satisfied by construction once every panel is braced, which
 * is what makes retiring the seeding safe when it happens.
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
 * Pure, and returns a new map — the draw handler has fresh slots in hand and
 * nothing here reads state, which is the same shape
 * `applyRoofDefaultsForFootprint` settled on for the roof.
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
