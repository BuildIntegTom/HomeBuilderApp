/**
 * ⚠ **U6 stride 1 — the building's own W × D box, and the one way to change
 * it.** His ask, 2026-11-05:
 *
 * > *"Nothing crazy, but height (oh boy maybe we run into panel setting tiling
 * > ordering issues here), width, depth of building, as well as the roof
 * > slider (slides the peak position), and I guess roof height too."*
 *
 * ⚠ **His parenthesis is the whole of stride 1.** A drag handle is a cheap
 * control on top of an expensive question: a width or a depth change alters
 * wall length, which under the tile-once model must RESIZE each wall's
 * existing panel array rather than re-tile it, and must re-derive the roof the
 * new shape implies. Both of those already exist in `page.tsx`
 * (`applyShapeChange` → `resizeSlotsForShapeChange` → `refreshRoofForShapeChange`)
 * — what did not exist was **one entry point to them**. Width and depth were
 * reached through four different handlers, each rebuilding the footprint its
 * own way, so a fifth caller (the handle) would have been a fifth copy and the
 * first place a mistake could hide.
 *
 * This module holds the part of that seam that is arithmetic rather than
 * state: what a footprint's box IS, which axis a given wall drives, and
 * whether a shape has a box at all. `page.tsx` keeps the part that is state.
 *
 * ⚠ **Nothing here invents a building number.** There is no minimum size and
 * no clamp: a resize that a wall cannot absorb is REFUSED by
 * `resizeWallRun`'s own shortfall (see `resizeSlotsForShapeChange`) and the
 * refusal is reported, rather than a made-up floor being enforced here. That
 * is [[dimensional_tightness_principle]] — refuse, do not guess.
 */

import {
  buildOctagonFootprint,
  buildRectangleFootprint,
  quantizeFootprint,
  type InteriorWall,
  octagonBoxOf,
  type Footprint,
} from "@building-integrity/geometry";

/** The building's plan box, feet. For an octagon this is the `W × D`
 * rectangle the octagon is inscribed in, which is what `octagonBoxOf` and
 * `buildOctagonFootprint` already speak in. */
export interface BuildingBoxFt {
  widthFt: number;
  depthFt: number;
}

/**
 * ⚠ **Which shapes have a box, and which do not.**
 *
 * - `rectangle` — four corners, right angles, never bumped out. Two numbers
 *   describe it completely.
 * - `octagon` — eight corners. Still two numbers, because
 *   `buildOctagonFootprint` derives the clip from `min(W, D)`; see
 *   `OctagonSizePanel` for why that coupling is said out loud rather than
 *   hidden.
 * - `freeform` — a bump-out, a courtyard, a plan split by a drawn wall. ⚠ It
 *   has **more than two degrees of freedom**, so there is no box to drag and
 *   no way to regenerate it from two numbers. These shapes resize wall by
 *   wall through the general editor (`editWallLength` / `dragWallBounded`),
 *   which moves only the corners that wall owns. A size handle must refuse
 *   here rather than silently flattening the shape back to a rectangle.
 */
export type BuildingShapeKind = "rectangle" | "octagon" | "freeform";

export function buildingShapeKind(footprint: Footprint, isBumpedOut: boolean): BuildingShapeKind {
  if (isBumpedOut) return "freeform";
  if (footprint.corners.length === 4) return "rectangle";
  if (octagonBoxOf(footprint)) return "octagon";
  return "freeform";
}

/** The box, or `null` for a shape that does not have one. */
export function buildingBoxFt(footprint: Footprint, isBumpedOut: boolean): BuildingBoxFt | null {
  switch (buildingShapeKind(footprint, isBumpedOut)) {
    case "rectangle": {
      /* `buildRectangleFootprint` always emits these same four wall ids, so
         this reads the shape rather than assuming an order. */
      const width = footprint.walls.find((w) => w.id === "AB")?.lengthFt;
      const depth = footprint.walls.find((w) => w.id === "BC")?.lengthFt;
      return width === undefined || depth === undefined ? null : { widthFt: width, depthFt: depth };
    }
    case "octagon":
      return octagonBoxOf(footprint);
    case "freeform":
      return null;
  }
}

/** Why a shape has no box, in the words a notice should use. `null` when it
 * has one. */
export function boxRefusalReason(kind: BuildingShapeKind): string | null {
  return kind === "freeform"
    ? "This plan has been bumped out, split or given a courtyard, so it is no longer described by a width and a depth. Resize it one wall at a time instead."
    : null;
}

/**
 * ⚠ **Which axis of the box a given wall drives.**
 *
 * A width handle on the model is really "the length of the walls that run
 * across the width", and the two shapes name those walls differently:
 * a rectangle's `AB`/`CD` and an octagon's straight `01`/`45`. The four
 * mitered walls of an octagon drive neither axis on their own — they are the
 * clip, which falls out of `min(W, D)` — so they answer `null`.
 */
export function boxAxisForWall(kind: BuildingShapeKind, wallId: string): "width" | "depth" | null {
  if (kind === "rectangle") {
    if (wallId === "AB" || wallId === "CD") return "width";
    if (wallId === "BC" || wallId === "DA") return "depth";
    return null;
  }
  if (kind === "octagon") {
    if (wallId === "01" || wallId === "45") return "width";
    if (wallId === "23" || wallId === "67") return "depth";
    return null;
  }
  return null;
}

/**
 * Build the footprint a box implies, for a shape that has one.
 *
 * ⚠ **The same two builders the draw path uses**, so a resized building and a
 * freshly drawn one of the same size are the same footprint, wall ids
 * included. That identity is what lets `applyShapeChange` carry every wall's
 * panels across by key instead of re-tiling them.
 */
export function footprintForBox(
  kind: BuildingShapeKind,
  box: BuildingBoxFt,
  /**
   * ⚠ **THE BUILDING BEING RESIZED, so its INTERIOR WALLS come with it —
   * B34, found 2026-11-18.**
   *
   * Omitted, this builds a bare outline, which is what it always did and what
   * every shape without interior walls still gets.
   *
   * ⚠ **Leaving it out DELETED them, and that is how this was found.** Stride
   * 1 audited the eight places that rebuild a footprint from `{ corners,
   * walls }` and made them all spread their source. This is a NINTH place and
   * it is the one with a dial on it: it does not edit a footprint, it builds a
   * fresh one from two numbers, so there was nothing to spread. Measured on
   * the Multiplex: two clicks of **Decrease Width** took it from 63 wall
   * panels to 34, collapsed the roof from 72 panels back to 36, and removed
   * every interior-wall line from the Review Log. **Two apartments and the
   * roof's bearing, gone, with nothing saying so** — which is the exact
   * outcome stride 1 set out to make impossible.
   */
  source?: Footprint | null,
): Footprint | null {
  const outline =
    kind === "rectangle"
      ? buildRectangleFootprint(box.widthFt, box.depthFt)
      : kind === "octagon"
        ? buildOctagonFootprint(box.widthFt, box.depthFt)
        : null;
  if (!outline) return null;
  const carried = scaleInteriorWallsToBox(source, box);
  return carried.length === 0 ? outline : quantizeFootprint({ ...outline, interiorWalls: carried });
}

/**
 * ⚠ **An interior wall is carried PROPORTIONALLY, not copied.**
 *
 * Copying the points would leave a centre wall at x = 18 in a building that is
 * now 34 ft wide — off the midline, so `ridgeBearingWallFor` would stop
 * recognising it and the roof would quietly lose its bearing. Scaling each
 * endpoint with the box keeps a centred wall centred and a wall a quarter of
 * the way across a quarter of the way across, which is what "the same
 * building, resized" has to mean.
 *
 * The result is snapped by `quantizeFootprint` at the call above, so every
 * carried wall lands back on the eighth grid — his dimensional-tightness
 * rule, which a scale factor would otherwise walk straight off.
 */
function scaleInteriorWallsToBox(source: Footprint | null | undefined, box: BuildingBoxFt): InteriorWall[] {
  const interior = source?.interiorWalls ?? [];
  if (interior.length === 0) return [];
  const xs = source!.corners.map((c) => c.point.x);
  const ys = source!.corners.map((c) => c.point.y);
  const oldWidthFt = Math.max(...xs) - Math.min(...xs);
  const oldDepthFt = Math.max(...ys) - Math.min(...ys);
  /* A degenerate old box has no ratio to scale by. Carrying the walls
     unscaled is still better than dropping them, and the quantizer will
     place them somewhere legal. */
  const sx = oldWidthFt > 0 ? box.widthFt / oldWidthFt : 1;
  const sy = oldDepthFt > 0 ? box.depthFt / oldDepthFt : 1;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const at = (p: { x: number; y: number }) => ({ x: (p.x - minX) * sx, y: (p.y - minY) * sy });
  return interior.map((wall) => {
    const start = at(wall.start);
    const end = at(wall.end);
    return { ...wall, start, end, lengthFt: Math.hypot(end.x - start.x, end.y - start.y) };
  });
}

/** The box with one axis replaced — the shape of every edit a handle or a
 * typed field makes. */
export function boxWithAxis(box: BuildingBoxFt, axis: "width" | "depth", valueFt: number): BuildingBoxFt {
  return axis === "width" ? { widthFt: valueFt, depthFt: box.depthFt } : { widthFt: box.widthFt, depthFt: valueFt };
}

/**
 * ⚠ **A box edit is only real if it moves something.** A drag fires many times
 * a second and a typed field re-commits on every blur; a resize that changes
 * nothing still costs a full pass over every wall's panels and, worse, still
 * pushes a state update that re-renders the model. An eighth of an inch is the
 * grid every length in this app lives on, so anything under half of one is no
 * change at all.
 */
export const BOX_CHANGE_EPSILON_FT = 1 / 16 / 12;

export function boxChanged(a: BuildingBoxFt, b: BuildingBoxFt): boolean {
  return (
    Math.abs(a.widthFt - b.widthFt) >= BOX_CHANGE_EPSILON_FT ||
    Math.abs(a.depthFt - b.depthFt) >= BOX_CHANGE_EPSILON_FT
  );
}

/**
 * ⚠ **Snap to the eighth, because the typed value is the master.**
 *
 * B29/B30's rule for the panel editor's drag, applied to the building's own
 * size: *the gesture proposes, the arithmetic disposes.* A pointer gives a
 * continuous number; every length this app fabricates from lives on an eighth
 * of an inch. Snapping here means a dragged 24'-0⅛" is a real dimension a shop
 * can cut to, and means the handle and the typed field can never disagree
 * about what a position means.
 */
export function snapToEighthFt(valueFt: number): number {
  return Math.round(valueFt * 12 * 8) / 8 / 12;
}
