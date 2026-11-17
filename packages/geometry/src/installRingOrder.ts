import { footprintLoops } from "./footprintLoops";
import type { CornerId, Footprint } from "./types";

/**
 * ⚠ **WHICH RING A WALL IS IN, AND WHERE IT FALLS IN THE WALK — B35,
 * 2026-11-16.**
 *
 * > *"From point of least accessability, clockwise, from out to in."*
 * > — Tommy, 2026-11-16
 *
 * The two outer clauses of his panel-numbering order, as indices. The install
 * sequence sorts on them; this is the only place that works them out.
 *
 * ## ⚠ "Clockwise" needs nothing done to it
 *
 * The footprint's wall ring is already a consistent perimeter traversal — each
 * wall's `endCorner` is the next wall's `startCorner` — and
 * `wallCompassDirection` treats **screen-up as North**, while a rectangle is
 * built `A(0,0) → B(w,0) → C(w,d) → D(0,d)`. On a y-down plan that is
 * top-left → top-right → bottom-right → bottom-left: **clockwise as drawn**.
 * So the walk direction is his direction already, and nothing here reverses or
 * re-derives it.
 *
 * ## ⚠ "From point of least accessibility" is a ROTATION, not a sort
 *
 * The same rotation `computePanelLoadOrder` already applies for the truck,
 * from his own earlier words: *"the stack order must correlate to the point of
 * least accessability. If the PLA is on the top left (NW) then that panel on
 * the corner is the top of the first stack."* The ring is rotated so the wall
 * that STARTS at that corner is index 0.
 *
 * ## ⚠ "Out to in" is ring-major, and the winding is deliberately not read
 *
 * The outer ring finishes before an inner one starts — you cannot reach a
 * courtyard wall through the building's own outer wall. The outer ring is
 * found by `isOuter` (largest area) rather than by its winding, because **an
 * inner ring winds the other way**: that is the trap that made compass
 * directions come out backwards on an inner ring in October, when "outward"
 * was taken as *away from the centroid*.
 *
 * ⚠ **An inner ring is NOT rotated**, because the least-accessible corner is a
 * corner of the building, which an inner ring does not touch. It keeps its own
 * order, which is still one consistent walk — there is no second PLA to
 * rotate it to, and inventing one would be inventing a fact about the site.
 *
 * ## ⚠ An INTERIOR wall is the innermost thing there is — B34, 2026-11-17
 *
 * *"Out to in"* answers it exactly: a dividing wall is inside every ring, so
 * it takes a `ringIndex` past the last of them and its panels number after
 * every outline panel on the building.
 *
 * **Measured before this existed**: the Multiplex's `C1`-`C11` came out
 * interleaved with the north wall's — 0022, 0035, 0037, 0040 — because a wall
 * with no ring scored 0 on every positional field and sorted as though it were
 * the first wall of the outer ring. A crew would have been sent back and forth
 * across the building between panels. It is the right install order on its own
 * terms too: you cannot stand a dividing wall up through a finished roof, but
 * its own run has to wait for the walls it butts.
 */
export interface RingWallPosition {
  /** 0 = the outer ring. */
  ringIndex: number;
  /** Position in that ring after the rotation. 0 = the least-accessible
   *  corner's own wall, for the outer ring. */
  wallIndex: number;
}

export function installRingWallOrder(
  footprint: Footprint,
  leastAccessibleCorner: CornerId,
): Map<string, RingWallPosition> {
  const byWallId = new Map<string, RingWallPosition>();
  /* Magnitude, via `isOuter`, not the signed area — see the note above. */
  const rings = [...footprintLoops(footprint)].sort((a, b) => Number(b.isOuter) - Number(a.isOuter));

  rings.forEach((ring, ringIndex) => {
    const startIdx = ring.walls.findIndex((w) => w.startCorner === leastAccessibleCorner);
    /* `<= 0` covers both "already first" and "not in this ring at all", and
       in both cases the ring keeps its own order. */
    const rotated =
      startIdx <= 0 ? ring.walls : [...ring.walls.slice(startIdx), ...ring.walls.slice(0, startIdx)];
    rotated.forEach((wall, wallIndex) => byWallId.set(wall.id, { ringIndex, wallIndex }));
  });

  /* ⚠ Past the last ring — see this function's own note on "out to in". Their
     order among themselves is the order they are stored in, which is the order
     they were drawn; nothing better exists until a building has two. */
  (footprint.interiorWalls ?? []).forEach((wall, wallIndex) =>
    byWallId.set(wall.id, { ringIndex: rings.length, wallIndex }),
  );

  return byWallId;
}
