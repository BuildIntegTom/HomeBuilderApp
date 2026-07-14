import type { CornerId, Footprint, PanelSlot } from "./types";

/** One wall slot's identity within the load-order sequence. */
export interface PanelLoadOrderEntry {
  wallId: string;
  slotIndex: number;
  slot: PanelSlot;
}

/**
 * The order panels should be loaded onto a truck (Tommy: "the stack order
 * must correlate to the point of least accessability. If the PLA is on the
 * top left (NW) then that panel on the corner is the top of the first
 * stack, and it's row stacked under it") — walks the footprint's own wall
 * ring (already a consistent perimeter traversal — each wall's `endCorner`
 * is the next wall's `startCorner`) starting from whichever wall begins at
 * the least-accessible corner, all the way around. That corner's own panel
 * ends up first in the sequence (the top of the first stack); everything
 * else follows in installation/perimeter order.
 *
 * Falls back to the footprint's own wall order (unrotated) if no wall
 * starts exactly at `leastAccessibleCorner` — shouldn't happen for a
 * well-formed closed footprint (every corner is some wall's start), but
 * keeps this from throwing on a malformed one.
 */
export function computePanelLoadOrder(
  footprint: Footprint,
  wallSlots: Record<string, PanelSlot[]>,
  leastAccessibleCorner: CornerId,
): PanelLoadOrderEntry[] {
  const startIdx = footprint.walls.findIndex((w) => w.startCorner === leastAccessibleCorner);
  const rotatedWalls =
    startIdx <= 0 ? footprint.walls : [...footprint.walls.slice(startIdx), ...footprint.walls.slice(0, startIdx)];

  const entries: PanelLoadOrderEntry[] = [];
  for (const wall of rotatedWalls) {
    const slots = wallSlots[wall.id] ?? [];
    slots.forEach((slot, slotIndex) => entries.push({ wallId: wall.id, slotIndex, slot }));
  }
  return entries;
}
