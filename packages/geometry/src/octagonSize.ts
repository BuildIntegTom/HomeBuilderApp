import { CLIP_RATIO } from "./octagon";
import type { Footprint } from "./types";

/**
 * SIZING AN OCTAGON BY THE NUMBERS A BUILDER USES — Tommy, 2026-10-20:
 *
 * > *"Octagons are now very difficult to edit the size of and I think they
 * > start to get really weird numbers and splitting the difference between
 * > panels that shoundnt be changing values. Can we add a left sidebar button
 * > when an octagon is drawn to edit the diameter (point to point and flat to
 * > flat) and also size of each wall that shares the same size."*
 *
 * ⚠ **The "weird numbers" are a real defect, not a feel.** Measured before
 * anything was built, on the editor's own path:
 *
 * | box | typed into | got | untouched wall |
 * |-----|-----------|-----|----------------|
 * | 40 x 24 | 16 into `23` | **12.458** | `01` 25.938 -> 22.396 |
 * | 30 x 20 | 10 into `23` | **9.000** | `01` 18.292 -> 17.292 |
 * | 30 x 20 | 20 into `01` | 20.000 ✓ | unchanged ✓ |
 *
 * `handleEditWallLength` read `clipFt` off the OLD shape and added it to the
 * typed length, but `buildOctagonFootprint` recomputes `clip` from
 * `min(W, D)` of the NEW box. Editing the LONGER axis leaves `min` alone and
 * works; editing the SHORTER axis moves `clip` under the calculation, so the
 * number typed is not the number you get and the opposite wall quietly
 * resizes. That asymmetry is why it reads as erratic rather than as wrong.
 *
 * Everything here solves for the box exactly instead, so a typed number is
 * the number you get.
 *
 * ## ⚠ AN OCTAGON HAS EXACTLY TWO DEGREES OF FREEDOM, and no control can
 * pretend otherwise
 *
 * The shape is a `W x D` box with its four corners clipped at 45 degrees by
 * `clip = min(W, D) * CLIP_RATIO`. Every length anyone can name is a function
 * of those two numbers:
 *
 * - across the flats: `W` one way, `D` the other
 * - the straight walls: `W - 2*clip` (top and bottom), `D - 2*clip` (sides)
 * - the four mitered walls: `clip * sqrt(2)`
 * - across the corners: two diagonals, equal only when `W == D`
 *
 * So the three wall GROUPS cannot be set independently: fixing the mitered
 * walls fixes `clip`, which fixes `min(W, D)`, which moves whichever straight
 * group sits on that axis. The functions below each say what else moves, and
 * the UI is expected to say it out loud rather than surprise anyone. Hiding
 * the coupling is how you get back to "panels that shouldn't be changing
 * values".
 */

/** Across the corners / across the flats, for a REGULAR octagon: 1/cos(22.5°). */
const REGULAR_POINT_OVER_FLAT = 1 / Math.cos(Math.PI / 8);

/** Straight wall over its own axis when that axis is the SHORTER one, so
 * `clip` is derived from it: `W - 2*W*R = W * (1 - 2R)`. */
const STRAIGHT_OVER_MIN_AXIS = 1 - 2 * CLIP_RATIO;

/** Within an eighth of an inch, in feet — the grid everything else is on. */
const EIGHTH_FT = 1 / 8 / 12;

export interface OctagonBox {
  widthFt: number;
  depthFt: number;
}

/** The three groups of walls that share a length, by the ids
 * `buildOctagonFootprint` always uses. */
export const OCTAGON_WALL_GROUPS = {
  /** Top and bottom — the flats across the WIDTH. */
  straightWidth: ["01", "45"],
  /** Left and right — the flats across the DEPTH. */
  straightDepth: ["23", "67"],
  /** The four mitered corner walls. */
  mitered: ["12", "34", "56", "70"],
} as const;

export type OctagonWallGroup = keyof typeof OCTAGON_WALL_GROUPS;

/** Which group a wall belongs to, or null if this is not an octagon wall. */
export function octagonWallGroupOf(wallId: string): OctagonWallGroup | null {
  for (const [group, ids] of Object.entries(OCTAGON_WALL_GROUPS)) {
    if ((ids as readonly string[]).includes(wallId)) return group as OctagonWallGroup;
  }
  return null;
}

/**
 * Recover the `W x D` box from a drawn octagon.
 *
 * Read off the shape rather than stored, because the footprint is the only
 * record — the box was never persisted. Returns null for anything that is not
 * one of this app's octagons.
 */
export function octagonBoxOf(footprint: Footprint): OctagonBox | null {
  if (footprint.corners.length !== 8) return null;
  const mitered = footprint.walls.find((w) => w.id === "70");
  const top = footprint.walls.find((w) => w.id === "01");
  const side = footprint.walls.find((w) => w.id === "23");
  if (!mitered || !top || !side) return null;
  const clipFt = mitered.lengthFt / Math.SQRT2;
  return { widthFt: top.lengthFt + 2 * clipFt, depthFt: side.lengthFt + 2 * clipFt };
}

export interface OctagonMeasures extends OctagonBox {
  clipFt: number;
  /** Across the flats, which IS the box: the distance between the two
   * opposite straight walls on each axis. */
  flatToFlatWidthFt: number;
  flatToFlatDepthFt: number;
  /**
   * Across the corners. ⚠ TWO of them, equal only on a regular octagon —
   * `acrossWidth` joins the vertices either side of the top and bottom flats,
   * `acrossDepth` those either side of the left and right flats.
   */
  pointToPointAcrossWidthFt: number;
  pointToPointAcrossDepthFt: number;
  straightWidthWallFt: number;
  straightDepthWallFt: number;
  miteredWallFt: number;
  /** All eight walls the same length, within an eighth of an inch. */
  isRegular: boolean;
}

/** Every length a person might want to read or type, derived from the box. */
export function octagonMeasures(box: OctagonBox): OctagonMeasures {
  const { widthFt, depthFt } = box;
  const clipFt = Math.min(widthFt, depthFt) * CLIP_RATIO;
  const straightWidthWallFt = widthFt - 2 * clipFt;
  const straightDepthWallFt = depthFt - 2 * clipFt;
  const miteredWallFt = clipFt * Math.SQRT2;
  return {
    widthFt,
    depthFt,
    clipFt,
    flatToFlatWidthFt: widthFt,
    flatToFlatDepthFt: depthFt,
    pointToPointAcrossWidthFt: Math.hypot(straightWidthWallFt, depthFt),
    pointToPointAcrossDepthFt: Math.hypot(widthFt, straightDepthWallFt),
    straightWidthWallFt,
    straightDepthWallFt,
    miteredWallFt,
    isRegular: Math.abs(widthFt - depthFt) < EIGHTH_FT,
  };
}

/** What an edit does beyond the thing being edited, so the UI can say so. */
export interface OctagonResize {
  box: OctagonBox;
  /** Groups whose length changes as a CONSEQUENCE — never includes the group
   * being set. Empty when the edit is self-contained. */
  alsoMoves: OctagonWallGroup[];
  /** True when the request could not be met exactly and the box was widened
   * to the nearest shape that can hold it (see `setMiteredWall`). */
  clamped: boolean;
}

function consequences(before: OctagonBox, after: OctagonBox, setting: OctagonWallGroup | null): OctagonResize {
  const a = octagonMeasures(before);
  const b = octagonMeasures(after);
  const moved: OctagonWallGroup[] = [];
  const changed = (x: number, y: number) => Math.abs(x - y) >= EIGHTH_FT;
  if (setting !== "straightWidth" && changed(a.straightWidthWallFt, b.straightWidthWallFt)) moved.push("straightWidth");
  if (setting !== "straightDepth" && changed(a.straightDepthWallFt, b.straightDepthWallFt)) moved.push("straightDepth");
  if (setting !== "mitered" && changed(a.miteredWallFt, b.miteredWallFt)) moved.push("mitered");
  return { box: after, alsoMoves: moved, clamped: false };
}

/**
 * Set one axis across the flats. Always exact and always self-contained on
 * the LONGER axis; on the shorter one it moves `clip`, and the other straight
 * group with it.
 */
export function setFlatToFlat(box: OctagonBox, axis: "width" | "depth", valueFt: number): OctagonResize {
  const next = axis === "width" ? { ...box, widthFt: valueFt } : { ...box, depthFt: valueFt };
  /* ⚠ The straight group ON THIS AXIS is excluded from `alsoMoves`, because
     it is not a consequence — it is the thing being set, in different units.
     Changing the width across the flats OBVIOUSLY changes the top and bottom
     walls; saying so turns the warning into noise and buries the one that
     matters, which is that the SHORTER axis also drags the perpendicular
     walls and the corners with it. */
  return consequences(box, next, axis === "width" ? "straightWidth" : "straightDepth");
}

/**
 * Set a straight wall group's own length, solved rather than approximated.
 *
 * ⚠ Two branches, and exactly one of them is consistent for any given target —
 * they meet at `L = other * (1 - 2R)`, so there is no gap and no overlap:
 *
 *  - the OTHER axis is the shorter one, so `clip` is fixed by it and this axis
 *    is simply `L + 2*clip`;
 *  - THIS axis is the shorter one, so `clip` comes from it and
 *    `L = axis * (1 - 2R)`.
 *
 * The old code only ever did the first, which is why editing the shorter axis
 * came back wrong.
 */
export function setStraightWall(box: OctagonBox, group: "straightWidth" | "straightDepth", lengthFt: number): OctagonResize {
  const axisIsWidth = group === "straightWidth";
  const otherFt = axisIsWidth ? box.depthFt : box.widthFt;

  // Branch A: the other axis stays the minimum.
  const viaOther = lengthFt + 2 * otherFt * CLIP_RATIO;
  // Branch B: this axis becomes the minimum.
  const viaSelf = lengthFt / STRAIGHT_OVER_MIN_AXIS;

  const axisFt = otherFt <= viaOther ? viaOther : viaSelf;
  const next = axisIsWidth ? { ...box, widthFt: axisFt } : { ...box, depthFt: axisFt };
  return consequences(box, next, group);
}

/**
 * Set the four mitered walls, which is the same as setting `clip` — and
 * therefore the same as setting `min(W, D)`.
 *
 * ⚠ **This one cannot be self-contained**, because `clip` is defined off the
 * shorter axis: whichever axis that is moves, and its straight walls with it.
 * If the mitered length asked for implies a minimum LARGER than the current
 * other axis, the other axis is raised to match and the octagon comes back
 * regular — reported as `clamped` rather than done silently.
 */
export function setMiteredWall(box: OctagonBox, lengthFt: number): OctagonResize {
  const minAxisFt = lengthFt / Math.SQRT2 / CLIP_RATIO;
  const widthIsMin = box.widthFt <= box.depthFt;
  const otherFt = widthIsMin ? box.depthFt : box.widthFt;

  if (minAxisFt > otherFt) {
    const next = { widthFt: minAxisFt, depthFt: minAxisFt };
    return { ...consequences(box, next, "mitered"), clamped: true };
  }
  const next = widthIsMin ? { ...box, widthFt: minAxisFt } : { ...box, depthFt: minAxisFt };
  return consequences(box, next, "mitered");
}

/**
 * Set the across-the-corners diameter of a REGULAR octagon, keeping it
 * regular: `flats = points * cos(22.5°)`.
 *
 * ⚠ Regular only, deliberately. An elongated octagon has TWO different
 * across-the-corners diagonals and no single "diameter" to set; offering one
 * anyway would have to pick an axis silently. `octagonMeasures` reports both
 * for reading, and the UI offers this field only when `isRegular`.
 */
export function setRegularPointToPoint(pointToPointFt: number): OctagonResize {
  const flats = pointToPointFt / REGULAR_POINT_OVER_FLAT;
  const next = { widthFt: flats, depthFt: flats };
  return { box: next, alsoMoves: ["straightWidth", "straightDepth", "mitered"], clamped: false };
}

/** Make the octagon regular at a given across-the-flats diameter. */
export function setRegularFlatToFlat(flatToFlatFt: number): OctagonResize {
  return { box: { widthFt: flatToFlatFt, depthFt: flatToFlatFt }, alsoMoves: [], clamped: false };
}
