import { cornerTurnAngleRad, isRightAngleCorner } from "./cornerAngle";
import type { Footprint, Wall, WallEnd } from "./types";

/**
 * WHICH CORNERS ARE MITERED — per corner, not per building.
 *
 * Tommy, 2026-10-20, describing the draw-wall tool:
 *
 * > *"it retiles the corner panel (not the wall, just the corner panel - it
 * > stays the same dimension except one side gets a tilted side) with a
 * > slanted surface that meets the new wall edge... Each side of every wall
 * > touching an inclined panel gets this tilted surface just like we see in
 * > the octagon panels."*
 *
 * **Touching.** That word is the whole of this module.
 *
 * ⚠ **Today the app decides mitering for the WHOLE BUILDING at once**, and
 * that is the main obstacle to drawing a wall at an angle:
 *
 * ```ts
 * export function isMiteredShape(fp: Footprint): boolean {
 *   return !footprintIsAllRightAngles(fp);
 * }
 * ```
 *
 * One non-right-angle corner anywhere flips the convention at EVERY corner —
 * gap placement, corner ownership, the safety-corner slot. So drawing a single
 * diagonal across a rectangle would silently re-convention the three corners
 * nobody touched. That is the same shape of bug as the octagon sizing one
 * fixed the day before: a local edit with a global consequence nobody asked
 * for.
 *
 * ⚠ **This module changes no behaviour yet, deliberately.** Every shape the
 * app can currently draw is uniform — a rectangle and a bump-out are all right
 * angles, an octagon is all mitered — so per-corner and per-building give the
 * SAME ANSWER for all of them, and a test sweeps that rather than asserting
 * it. The difference only appears for shapes the draw-wall tool will make
 * possible, which is exactly why this lands first and on its own.
 */

/** The wall that continues the ring from the end of `wall`. */
function nextWallAfter(footprint: Footprint, wall: Wall): Wall | undefined {
  return footprint.walls.find((w) => w.startCorner === wall.endCorner);
}

/** The wall that arrives at the start of `wall`. */
function prevWallBefore(footprint: Footprint, wall: Wall): Wall | undefined {
  return footprint.walls.find((w) => w.endCorner === wall.startCorner);
}

/**
 * Is the corner at this END of this wall a mitered one — anything other than a
 * plain 90-degree turn?
 *
 * An open end (no neighbouring wall, which only happens on a malformed
 * footprint) answers false: nothing is mitered against nothing.
 */
export function wallEndIsMitered(footprint: Footprint, wall: Wall, end: WallEnd): boolean {
  const [incoming, outgoing] =
    end === "end" ? [wall, nextWallAfter(footprint, wall)] : [prevWallBefore(footprint, wall), wall];
  if (!incoming || !outgoing) return false;
  return !isRightAngleCorner(cornerTurnAngleRad(incoming, outgoing, footprint.corners));
}

/**
 * His "every wall TOUCHING an inclined panel" — true when either end of this
 * wall meets a mitered corner.
 *
 * ⚠ A wall can touch one and not the other, and that is the case the whole
 * change exists for: a rectangle with one diagonal across it has walls with a
 * mitered end and a square end. No shape the app can draw today does that,
 * which is why nothing downstream has ever had to ask.
 */
export function wallTouchesMiteredCorner(footprint: Footprint, wall: Wall): boolean {
  return wallEndIsMitered(footprint, wall, "start") || wallEndIsMitered(footprint, wall, "end");
}

/** The ids of every mitered corner in the footprint. */
export function miteredCornerIds(footprint: Footprint): Set<string> {
  const out = new Set<string>();
  for (const wall of footprint.walls) {
    if (wallEndIsMitered(footprint, wall, "end")) out.add(wall.endCorner);
  }
  return out;
}

/**
 * How far off square each wall's end face is cut at a mitered corner — HALF
 * the turn, because the two walls split the angle between them.
 *
 * ⚠ **This is the general form of a number Tommy already settled.** On
 * 2026-10-13 he approved the cut note reading *"22 1/2 degrees off square"*
 * for the octagon's mitered panels. An octagon turns 45 degrees at each
 * clipped corner, and half of 45 is 22.5 — so that note was never an octagon
 * constant, it was this formula evaluated at the only angle the app could
 * draw. A wall drawn at any other angle gets its own number from the same
 * rule, and the shop reads it the same way.
 *
 * Returns 0 at a square corner, where one wall runs through and neither end
 * face is raked at all.
 */
export function cornerRakeRad(footprint: Footprint, wall: Wall, end: WallEnd): number {
  if (!wallEndIsMitered(footprint, wall, end)) return 0;
  const [incoming, outgoing] =
    end === "end" ? [wall, nextWallAfter(footprint, wall)] : [prevWallBefore(footprint, wall), wall];
  if (!incoming || !outgoing) return 0;
  return cornerTurnAngleRad(incoming, outgoing, footprint.corners) / 2;
}

/** The same angle in degrees, which is the unit every cut note is written in. */
export function cornerRakeDeg(footprint: Footprint, wall: Wall, end: WallEnd): number {
  return (cornerRakeRad(footprint, wall, end) * 180) / Math.PI;
}
