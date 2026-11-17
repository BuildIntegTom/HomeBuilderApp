import { wallExteriorNormal } from "./footprintLoops";
import type { Footprint, Wall } from "./types";

export type CompassDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

// Ordered by increasing angle (see angleDeg below): 0=E, 45=SE, 90=S,
// 135=SW, 180=W, 225=NW, 270=N, 315=NE.
const DIRECTIONS: CompassDirection[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];

/**
 * Which compass direction a wall's EXTERIOR face points — this app has no
 * real site-orientation/compass data yet, so screen-up is treated as
 * North (a common simplification), with the wall's outward normal snapped
 * to the nearest of 8 directions (N/NE/E/SE/S/SW/W/NW). A rectangle's 4
 * walls always land exactly on a cardinal (N/E/S/W); an octagon's 4
 * straight walls do too, while its 4 mitered corner walls land exactly on
 * the intercardinal between their 2 neighboring straight walls (e.g. the
 * corner between the N and E walls is NE) — going around clockwise from
 * the top face: N, NE, E, SE, S, SW, W, NW (Tommy).
 */
export function wallCompassDirection(wall: Wall, footprint: Footprint): CompassDirection {
  const corners = footprint.corners;
  const start = corners.find((c) => c.id === wall.startCorner)!.point;
  const end = corners.find((c) => c.id === wall.endCorner)!.point;
  /* ⚠ THE OUTWARD FACE COMES FROM THE LOOP'S WINDING, NOT FROM THE CENTROID,
     since 2026-10-22.

     The old rule asked whether the wall's perpendicular pointed AWAY FROM THE
     MIDDLE of all the corners. That is right for a single ring and wrong for a
     courtyard: an inner-ring wall's weather side faces INTO the courtyard,
     which is toward the middle, not away from it. Tommy, 2026-10-21: *"The
     interior side of the inner courtyard wall is the outside."*

     ⚠ Measured before switching, because a silent relabelling of every wall in
     the app would be the worst possible way to find out this was wrong:

       rectangle 40x20   4 walls, 0 differ
       octagon 40x24     8 walls, 0 differ
       bump-out          8 walls, 0 differ
       courtyard ring    8 walls, 4 differ — every INNER wall, each by 180°

     So nothing drawable before today changes, including the concave bump-out,
     and exactly the walls that were wrong are the ones that move. Without this
     the ring's drawings would have said S where they meant N, with nothing
     crashing and nothing to notice. */
  const exterior = wallExteriorNormal(footprint, wall.id);
  const outward =
    exterior ??
    (() => {
      /* A wall in no closed ring — a malformed footprint mid-edit. Falls back
         to the old centroid rule rather than picking a direction at random, so
         a half-built shape still labels itself the way it used to. */
      const dir = { x: end.x - start.x, y: end.y - start.y };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const perp = { x: -dir.y / len, y: dir.x / len };
      const centerX = corners.reduce((sum, c) => sum + c.point.x, 0) / corners.length;
      const centerY = corners.reduce((sum, c) => sum + c.point.y, 0) / corners.length;
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const away = perp.x * (midX - centerX) + perp.y * (midY - centerY) >= 0;
      return away ? perp : { x: -perp.x, y: -perp.y };
    })();

  // Screen space: +x = East, +y = South (down), -y = North (up) — atan2(y,x)
  // in degrees gives 0=E, 90=S, 180=W, 270(or -90)=N.
  const angleDeg = ((Math.atan2(outward.y, outward.x) * 180) / Math.PI + 360) % 360;
  const index = Math.round(angleDeg / 45) % 8;
  return DIRECTIONS[index]!;
}

const OPPOSITE_DIRECTION: Record<CompassDirection, CompassDirection> = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
  NE: "SW",
  SW: "NE",
  SE: "NW",
  NW: "SE",
};

/**
 * Whether two walls face exactly opposite compass directions (N/S, E/W,
 * NE/SW, or SE/NW) — Tommy: the two Gable End walls a roof-catcher beam
 * spans between must be "opposite" (parallel, facing away from each other),
 * not adjacent/perpendicular, or the beam's run has no straight line to
 * follow. Reuses wallCompassDirection's own 8-way snapped direction rather
 * than raw angle math, so it agrees with what the UI already shows.
 */
export function areWallsOppositePair(wallA: Wall, wallB: Wall, footprint: Footprint): boolean {
  if (wallA.id === wallB.id) return false;
  return wallCompassDirection(wallA, footprint) === OPPOSITE_DIRECTION[wallCompassDirection(wallB, footprint)];
}

/* ──────────────────────────────────────────────────────────────────────────
   B34 — WHAT A WALL THAT FACES NO COMPASS POINT IS CALLED

   > "Labeling walls Ab, BC etc. makes it difficult for me to conceptualize
   >  which elevation view I want to look at ... Can we change AB to just
   >  simply be N?"  — Tommy, 2026-10-18

   An INTERIOR wall has two interior faces and no outside, so it has no
   direction to be named after. Asked what should go on the shop sheets for
   one, he picked **C, for Centre** — over `INT` and over reusing a compass
   letter, which would have given a crew two different walls both answering
   to `N`.
   ────────────────────────────────────────────────────────────────────────── */

/** The letter an interior wall's panel series is named from: `C1`, `C2`, … */
export const INTERIOR_WALL_SERIES = "C";

/**
 * The second and later interior walls take a suffix, exactly as a second
 * north-facing wall does (`N`, `N2`) — one convention, so nobody has to learn
 * a second one. A building with one dividing wall reads plainly `C`.
 */
export type InteriorWallSeries = "C" | `C${number}`;

export function interiorWallSeries(indexInBuilding: number): InteriorWallSeries {
  return indexInBuilding === 0 ? INTERIOR_WALL_SERIES : (`${INTERIOR_WALL_SERIES}${indexInBuilding + 1}` as const);
}

/**
 * ⚠ **What a panel's name series is keyed on.** A compass direction for a wall
 * on the outline, an interior wall's own letter otherwise.
 *
 * Kept as one type rather than widening `CompassDirection` itself: everything
 * that genuinely means *"which way does this face"* — the roof planes, the
 * weather side, the sun — must keep refusing an interior wall, and it does
 * that by still taking a `CompassDirection`.
 */
export type WallSeriesLabel = CompassDirection | InteriorWallSeries;

/** Whether a series label is a real compass direction. ⚠ The B35 chip uses
 *  this to decide on a colour: an interior wall gets the plainly
 *  non-compass one rather than a borrowed direction's. */
export function isCompassDirection(label: WallSeriesLabel): label is CompassDirection {
  return label !== INTERIOR_WALL_SERIES && !/^C\d+$/.test(label);
}
