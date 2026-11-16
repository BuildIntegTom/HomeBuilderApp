import { cornerRakeRad, wallEndIsMitered } from "./miteredCorners";
import { isConvexCorner } from "./cornerAngle";
import { outwardNormal } from "./bumpOut";
import { roofHeightFtAt, type SimpleRoofResult } from "./simpleRoofPlanes";
import type { Footprint, Point, Wall, WallEnd } from "./types";

/* ──────────────────────────────────────────────────────────────────────────
   THE ROOFLINE OVER A WALL IS A PLANE, NOT A LINE

   > *"The octagon Gable pieces need to be cut like octagon corners. You're
   > right, it is not flush for the roof at the top, can we make the top of
   > Gable and dual beveled So that the roof can meet it?"* — Tommy,
   > 2026-11-16

   Every gable row this app has ever built takes TWO heights — one at each of
   its wall's corners — and runs a straight top between them. That is a LINE,
   and a line is enough only when the roof plane happens to be level in the
   other direction: across the wall's own 15 1/2in depth.

   ⚠ **Which is true for every wall of a box and false for most walls of an
   octagon.** A roof falls along one axis. A wall that runs straight down that
   fall (a box's gable end) has a level roof across its depth. A wall at any
   other angle has the roof falling THROUGH it, so its top has to tilt across
   its depth as well as along its length — a compound, "dual" bevel.

   Measured on the 16ft Octagon shed at 4:12 through a 15 1/2in wall:

   | facet  | rake along the wall  | rise across the depth      |
   |--------|----------------------|----------------------------|
   | E, W   | 4:12, the full pitch | **0** — already right      |
   | NE, NW | 2.83:12              | -3.653in (interior LOWER)  |
   | SE, SW | 2.83:12              | +3.653in (interior HIGHER) |
   | N, S   | 0, level             | the full pitch, 5.167in    |

   So four of the six facets that carry a gable row were flat across a wall
   the roof was falling through, and the two that were right (E/W) are the
   only two a box building ever exercises. That is why nothing caught it.
   ────────────────────────────────────────────────────────────────────────── */

/** A wall's own unit direction and the INWARD normal that goes with it.
 *
 * ⚠ Inward is the negated `outwardNormal`, taken from the footprint's global
 * winding rather than from a centroid — see that function's own comment for
 * why a centroid heuristic breaks on a bumped-out shape. */
function wallFrame(
  footprint: Footprint,
  wall: Wall,
): { a: Point; b: Point; dir: Point; inward: Point; lengthFt: number } | null {
  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));
  const a = byId.get(wall.startCorner);
  const b = byId.get(wall.endCorner);
  if (!a || !b) return null;
  const lengthFt = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(lengthFt > 0)) return null;
  const dir = { x: (b.x - a.x) / lengthFt, y: (b.y - a.y) / lengthFt };
  const out = outwardNormal(dir);
  return { a, b, dir, inward: { x: -out.x, y: -out.y }, lengthFt };
}

/**
 * How much HIGHER the roof stands at a wall's INTERIOR face than at its
 * exterior one, at each of the wall's two corners — inches, signed.
 *
 * ⚠ **Signed, and both signs really happen on one building.** On the 16ft
 * Octagon shed the NE facet's interior face is 3.653in LOWER than its
 * exterior (the roof falls inward there) while the SE facet's is 3.653in
 * HIGHER. A magnitude alone would bevel two of the four diagonal facets the
 * wrong way, and the result would look plausible from any single viewpoint.
 *
 * ⚠ **`planar` is not decoration.** The two corner values describe a plane
 * only while the roof really is one plane across the whole depth of this
 * wall. Where a peak's RIDGE runs between a wall's exterior and interior
 * faces, the top of that wall is a shallow hip rather than a bevel, and a
 * dual bevel cut from these numbers would bridge straight over the ridge. It
 * is detected by sampling the MIDDLE of the depth and asking whether it is
 * the average of the two faces — mechanism-free, so it cannot disagree with
 * `roofHeightFtAt` about where the planes are.
 */
export interface WallRoofCrossRise {
  wallId: string;
  startIn: number;
  endIn: number;
  /** False when the roof is not a single plane across this wall's depth. */
  planar: boolean;
}

/** Tolerance for the planarity check, in inches. Floating-point slop in
 * `roofHeightFtAt` is many orders below this; a real ridge crossing a 15 1/2in
 * wall shows up as inches. Purely numerical — not a shop tolerance. */
const PLANAR_TOLERANCE_IN = 1e-6;

export function wallRoofCrossRiseIn(
  footprint: Footprint,
  wall: Wall,
  roof: SimpleRoofResult,
  wallThicknessIn: number,
): WallRoofCrossRise | null {
  const frame = wallFrame(footprint, wall);
  if (!frame) return null;
  const depthFt = wallThicknessIn / 12;
  const atDepth = (p: Point, fraction: number): Point => ({
    x: p.x + frame.inward.x * depthFt * fraction,
    y: p.y + frame.inward.y * depthFt * fraction,
  });
  const heightIn = (p: Point) => {
    const ft = roofHeightFtAt(p, roof);
    return ft === null ? null : ft * 12;
  };
  const riseAt = (corner: Point): { riseIn: number; planar: boolean } | null => {
    const outer = heightIn(corner);
    const inner = heightIn(atDepth(corner, 1));
    const middle = heightIn(atDepth(corner, 0.5));
    if (outer === null || inner === null || middle === null) return null;
    return { riseIn: inner - outer, planar: Math.abs(middle - (outer + inner) / 2) <= PLANAR_TOLERANCE_IN };
  };
  const start = riseAt(frame.a);
  const end = riseAt(frame.b);
  if (!start || !end) return null;
  return { wallId: wall.id, startIn: start.riseIn, endIn: end.riseIn, planar: start.planar && end.planar };
}

/**
 * How far one END of a wall's panel run is MITRED back in plan at its short
 * face — inches, never negative, and 0 at a square corner or an open end.
 *
 * > *"The octagon Gable pieces need to be cut like octagon corners."*
 *
 * Asked which way to close the 135deg joint where two octagon facets' gable
 * rows meet, Tommy chose a true mitre over a dedicated gable corner panel:
 * **both end panels cut 22 1/2deg off square**, meeting on the corner's own
 * bisector. The exterior face still reaches the corner point; the face that
 * moves is the one behind it.
 *
 * ⚠ **The pull-back is thickness x tan(rake), and the rake is HALF the
 * turn** — `cornerRakeRad`, which is the general form of the 22 1/2deg he
 * approved for the octagon's corner panels on 2026-10-13. On a 15 1/2in wall
 * at an octagon corner that is 15.5 x tan(22.5deg) = **6.420in**.
 *
 * ⚠ **At a CONVEX corner the exterior is the long face and the interior pulls
 * back; at a REFLEX one it is the other way round**, which is why
 * `interiorIsShort` is reported rather than assumed. Every octagon corner is
 * convex; a notch's inside corners are not, and a notched shape under a roof
 * is reachable from the draw-wall tool.
 */
export interface WallEndMitre {
  /** Along the wall, at whichever face is the SHORT one. Never negative. */
  pullBackIn: number;
  /** True when the pull-back is at the interior face (a convex corner). */
  interiorIsShort: boolean;
  /** Degrees off square — what the shop sets the saw to. 0 when not mitred. */
  rakeDeg: number;
}

export const NO_WALL_END_MITRE: WallEndMitre = { pullBackIn: 0, interiorIsShort: true, rakeDeg: 0 };

function nextWallAfter(footprint: Footprint, wall: Wall): Wall | undefined {
  return footprint.walls.find((w) => w.startCorner === wall.endCorner);
}

function prevWallBefore(footprint: Footprint, wall: Wall): Wall | undefined {
  return footprint.walls.find((w) => w.endCorner === wall.startCorner);
}

export function wallEndMitreFor(footprint: Footprint, wall: Wall, end: WallEnd, wallThicknessIn: number): WallEndMitre {
  if (!wallEndIsMitered(footprint, wall, end)) return NO_WALL_END_MITRE;
  const [incoming, outgoing] =
    end === "end" ? [wall, nextWallAfter(footprint, wall)] : [prevWallBefore(footprint, wall), wall];
  if (!incoming || !outgoing) return NO_WALL_END_MITRE;
  const rakeRad = cornerRakeRad(footprint, wall, end);
  return {
    pullBackIn: Math.abs(wallThicknessIn * Math.tan(rakeRad)),
    interiorIsShort: isConvexCorner(incoming, outgoing, footprint.corners),
    rakeDeg: (rakeRad * 180) / Math.PI,
  };
}

/** Both ends at once, which is what a panel run wants. */
export function wallMitredEndsFor(
  footprint: Footprint,
  wall: Wall,
  wallThicknessIn: number,
): { start: WallEndMitre; end: WallEndMitre } {
  return {
    start: wallEndMitreFor(footprint, wall, "start", wallThicknessIn),
    end: wallEndMitreFor(footprint, wall, "end", wallThicknessIn),
  };
}

/**
 * The same two mitres in the form a PANEL takes them: a pull-back at each of
 * the four plan corners, in inches along the wall.
 *
 * `Ext` is the wall's exterior face and `Int` its interior one, and exactly
 * one of each pair is non-zero — whichever face is the SHORT one at that
 * corner. All four zero at a square corner, which is every corner of a box
 * and is the identity the panel builders treat as "not mitred".
 *
 * ⚠ **The field names, not a boolean, are what carry `interiorIsShort`.** A
 * convex corner pulls the interior back; the inside of a notch pulls the
 * exterior back. Writing the number into the face it belongs to means nothing
 * downstream has to remember which way round a flag went, and a shape with
 * both kinds of corner needs no special case.
 */
export interface WallPlanMitreIn {
  startExtIn: number;
  startIntIn: number;
  endExtIn: number;
  endIntIn: number;
}

export function wallPlanMitreForPanelsIn(
  footprint: Footprint,
  wall: Wall,
  wallThicknessIn: number,
): WallPlanMitreIn {
  const ends = wallMitredEndsFor(footprint, wall, wallThicknessIn);
  return {
    startExtIn: ends.start.interiorIsShort ? 0 : ends.start.pullBackIn,
    startIntIn: ends.start.interiorIsShort ? ends.start.pullBackIn : 0,
    endExtIn: ends.end.interiorIsShort ? 0 : ends.end.pullBackIn,
    endIntIn: ends.end.interiorIsShort ? ends.end.pullBackIn : 0,
  };
}
