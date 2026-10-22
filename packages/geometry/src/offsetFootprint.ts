import { quantizeFootprint } from "./eighths";
import { segmentsCross } from "./splitFootprint";
import type { Corner, Footprint, Point, Wall } from "./types";

/**
 * MOVING, MEASURING AND INSETTING A WHOLE SHAPE.
 *
 * Tommy, 2026-10-20, on what the ring will need:
 *
 * > *"We will need some total shape moving tools when that happens so it's
 * > easy for the user to center and align and drag certain selections of wall
 * > shapes around."*
 *
 * ⚠ **The most useful piece of that is the one that is not about dragging at
 * all.** A concentric ring is the outer loop inset by the courtyard's depth,
 * so `offsetFootprintInward` is how the inner loop gets MADE — not how it gets
 * nudged afterwards. Dragging and centring matter once there are two loops to
 * align; insetting is what produces the second one, and it is exact where a
 * drag is approximate: *"inner ring 12ft inside the outer"* is the number a
 * building is actually specified with.
 *
 * ⚠ **Nothing here assumes eight sides**, which is his own requirement from
 * 2026-10-21: *"This should also be compatible with concentric Square/
 * rectangle buildings."* Every function takes an arbitrary closed ring.
 */

/** Twice the signed area. Positive for the winding `buildRectangleFootprint`
 * and `buildOctagonFootprint` both produce. */
function signedDoubleArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** The axis-aligned box the shape sits in. */
export function footprintBoundingBox(footprint: Footprint): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = footprint.corners.map((c) => c.point.x);
  const ys = footprint.corners.map((c) => c.point.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * The centre of the bounding box.
 *
 * ⚠ **The box, not the centroid, and the difference is a decision.** They
 * agree on a rectangle and on a regular octagon, and differ on anything
 * irregular — a trapezoid's area-centroid sits toward its wide end, which is
 * not where anyone points when they say "the middle". The box matches what the
 * eye expects on screen, which is what a Centre button is for.
 */
export function footprintCentre(footprint: Footprint): Point {
  const b = footprintBoundingBox(footprint);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** Move the whole shape. Wall lengths are unchanged by construction, so they
 * are carried across rather than recomputed. */
export function translateFootprint(footprint: Footprint, dxFt: number, dyFt: number): Footprint {
  return quantizeFootprint({
    corners: footprint.corners.map((c) => ({ ...c, point: { x: c.point.x + dxFt, y: c.point.y + dyFt } })),
    walls: footprint.walls.map((w) => ({ ...w })),
  });
}

/** Put one shape's centre on another's — the Centre button, as a function. */
export function centreFootprintOn(footprint: Footprint, target: Point): Footprint {
  const c = footprintCentre(footprint);
  return translateFootprint(footprint, target.x - c.x, target.y - c.y);
}

export type OffsetRefusal =
  /** The inset is at least as big as the shape, so there is nothing left. */
  | { reason: "collapsed" }
  /** The offset boundary crosses itself — a notch or a sharp reflex corner
   * eating the shape from the inside before the whole of it collapses. */
  | { reason: "self-intersects" }
  /** Two consecutive walls are parallel, so their offset lines never meet. */
  | { reason: "parallel-walls"; wallId: string }
  | { reason: "not-a-closed-ring" };

export function isOffsetRefusal(x: Footprint | OffsetRefusal): x is OffsetRefusal {
  return "reason" in x;
}

/** The ring's points in wall order, or null if the walls are not a closed ring. */
function ringPoints(footprint: Footprint): Point[] | null {
  if (footprint.walls.length < 3) return null;
  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));
  const first = footprint.walls[0]!;
  const out: Point[] = [];
  let cursor: Wall | undefined = first;
  for (let i = 0; i < footprint.walls.length; i++) {
    if (!cursor) return null;
    const p = byId.get(cursor.startCorner);
    if (!p) return null;
    out.push(p);
    const next: Wall | undefined = footprint.walls.find((w) => w.startCorner === cursor!.endCorner);
    cursor = next;
    if (cursor && cursor.id === first.id) break;
  }
  return out.length === footprint.walls.length ? out : null;
}

/**
 * Inset a closed ring by a fixed distance — the inner loop of a courtyard
 * building, or any shape shrunk about its own edges rather than scaled.
 *
 * ⚠ **Each EDGE moves inward by exactly `insetFt`, which is not the same as
 * scaling the shape.** Scaling moves corners along rays from the centre and
 * changes every wall by a different amount; offsetting keeps the walls
 * parallel to the ones they came from and keeps the gap between inner and
 * outer constant all the way round. A courtyard is specified by that gap, so
 * offsetting is what the number means.
 *
 * ⚠ **Refusals are returned, not thrown, and none of them is an error.** An
 * inset bigger than the building, or one that eats a notch, is something a
 * person can type; the editor shows it as guidance.
 */
export function offsetFootprintInward(footprint: Footprint, insetFt: number): Footprint | OffsetRefusal {
  const points = ringPoints(footprint);
  if (!points) return { reason: "not-a-closed-ring" };
  if (insetFt <= 0) return { reason: "collapsed" };

  const area2 = signedDoubleArea(points);
  if (area2 === 0) return { reason: "collapsed" };
  /* The inward normal of an edge depends on which way the ring winds. Derived
     from the signed area rather than assumed, so a shape produced by a split
     or a bump-out — which need not wind the way the builders do — insets the
     right way instead of exploding outward. */
  const sign = Math.sign(area2);

  interface OffsetLine {
    point: Point;
    dir: Point;
    wallId: string;
  }
  const lines: OffsetLine[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) return { reason: "collapsed" };
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const normal = { x: -dir.y * sign, y: dir.x * sign };
    lines.push({
      point: { x: a.x + normal.x * insetFt, y: a.y + normal.y * insetFt },
      dir,
      wallId: footprint.walls[i]?.id ?? String(i),
    });
  }

  const insetPoints: Point[] = [];
  for (let i = 0; i < lines.length; i++) {
    const prev = lines[(i - 1 + lines.length) % lines.length]!;
    const here = lines[i]!;
    const cross = prev.dir.x * here.dir.y - prev.dir.y * here.dir.x;
    if (Math.abs(cross) < 1e-9) return { reason: "parallel-walls", wallId: here.wallId };
    const dx = here.point.x - prev.point.x;
    const dy = here.point.y - prev.point.y;
    const t = (dx * here.dir.y - dy * here.dir.x) / cross;
    insetPoints.push({ x: prev.point.x + prev.dir.x * t, y: prev.point.y + prev.dir.y * t });
  }

  /* ⚠ FOUR CHECKS, because each catches something the others do not — and the
     first one is here because the other three all MISSED a case.

     ⚠ **A double inversion keeps the winding.** Inset a 40ft x 20ft rectangle
     by 25ft and it turns inside out on BOTH axes: 40 becomes -10, 20 becomes
     -30, and a twice-flipped rectangle winds the same way as the original with
     a perfectly positive area of 300. The winding check sees nothing, the area
     check sees nothing, and the boundary does not cross itself. A test caught
     it; I had written only the other three.

     The reliable test is per EDGE: an edge that has flipped points the other
     way from the edge it came from. One inversion or two, every flipped edge
     reverses, so this catches what an area cannot. */
  for (let i = 0; i < insetPoints.length; i++) {
    const a = insetPoints[i]!;
    const b = insetPoints[(i + 1) % insetPoints.length]!;
    const original = lines[i]!.dir;
    if ((b.x - a.x) * original.x + (b.y - a.y) * original.y <= 0) return { reason: "collapsed" };
  }

  const insetArea2 = signedDoubleArea(insetPoints);
  if (Math.sign(insetArea2) !== sign || Math.abs(insetArea2) < 1e-9) return { reason: "collapsed" };
  for (let i = 0; i < insetPoints.length; i++) {
    const a = insetPoints[i]!;
    const b = insetPoints[(i + 1) % insetPoints.length]!;
    for (let j = i + 1; j < insetPoints.length; j++) {
      const c = insetPoints[j]!;
      const d = insetPoints[(j + 1) % insetPoints.length]!;
      if (segmentsCross(a, b, c, d)) return { reason: "self-intersects" };
    }
  }

  /* Ids are carried straight across: the inset ring has the same corners and
     walls in the same order, each parallel to the one it came from. A caller
     that needs fresh ids for a second loop renames them itself, and one that
     is simply shrinking a shape keeps its panels keyed as they were. */
  const corners: Corner[] = footprint.corners.map((c, i) => ({ ...c, point: insetPoints[i] ?? c.point }));
  const byId = new Map(corners.map((c) => [c.id, c.point]));
  const walls: Wall[] = footprint.walls.map((w) => {
    const a = byId.get(w.startCorner)!;
    const b = byId.get(w.endCorner)!;
    return { ...w, lengthFt: Math.hypot(b.x - a.x, b.y - a.y) };
  });
  return quantizeFootprint({ corners, walls });
}

/** What to tell someone whose inset was refused. */
export function offsetRefusalMessage(refusal: OffsetRefusal, insetFt: number): string {
  switch (refusal.reason) {
    case "collapsed":
      return `${insetFt}ft leaves nothing inside — try a smaller inset.`;
    case "self-intersects":
      return `${insetFt}ft is too deep for this shape — the inner outline would cross itself where the building narrows.`;
    case "parallel-walls":
      return `Wall ${refusal.wallId} runs parallel to the one before it, so there is no inside corner to put there.`;
    case "not-a-closed-ring":
      return "That shape is not a closed outline.";
  }
}
