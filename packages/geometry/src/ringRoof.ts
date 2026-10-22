import { footprintLoops } from "./footprintLoops";
import type { Footprint, Point } from "./types";

/**
 * THE ROOF OVER A COURTYARD RING.
 *
 * Tommy, 2026-10-20: *"Octagon ring roof certainly will be somewhat
 * complicated, but that's the point of this app to be able to make all this
 * math easy."* And the constraint that shapes all of it, 2026-10-21: *"The
 * courtyard is open to the sky."*
 *
 * So the roof is an ANNULUS — a band of roof following the building between
 * the outer ring and the inner one, with a hole in the middle. Not a shape the
 * app's existing roof can make.
 *
 * ⚠ **What the existing roof is, and why it does not stretch to cover this.**
 * A gable roof here is two OPPOSITE walls carrying Gable End panels with a
 * roof-catcher beam spanning between them — `gableEndToggleBlockReason` says
 * so outright: *"the roof-catcher beam spans between exactly 2"*. A ring has
 * no pair of walls to span between; it has two closed rings and a hole. The
 * octagon's roof-catcher RING is closer in spirit, being a closed ring at
 * height, and is the thing this most resembles.
 *
 * ⚠ **What DOES already work, unchanged: the bearing.**
 * `computeRoofBearingSegments` is per wall — *"options for being a ring all
 * the way around or just one section of the wall"* — so every wall on both
 * loops already gets its truss plate or box beam with no changes at all. What
 * was missing is the surface between them, which is what this module names.
 *
 * ⚠ **This module is deliberately SLOPE-AGNOSTIC.** Which way a ring roof
 * falls — outward away from the courtyard, inward into it, or to a ridge
 * between the two — is a building decision with real water consequences, and
 * it is Tommy's. Everything here is true whichever he picks: the planes, their
 * spans, and which pairs of walls face each other across the building.
 */

export interface RingRoofPlane {
  outerWallId: string;
  innerWallId: string;
  /** The plane's four plan corners, outer edge first, in ring order. */
  outerStart: Point;
  outerEnd: Point;
  innerStart: Point;
  innerEnd: Point;
  /** Horizontal distance across the building at this plane, in feet — the
   * run a rafter has to cover. */
  spanFt: number;
}

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Perpendicular distance from a point to the infinite line through a->b. */
function distanceToLine(p: Point, a: Point, b: Point): number {
  const d = sub(b, a);
  const len = Math.hypot(d.x, d.y);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * d.y - (p.y - a.y) * d.x) / len;
}

/**
 * The roof planes of a courtyard building: one per outer wall, each spanning
 * across the building to the inner wall facing it.
 *
 * Returns null when the footprint is not a ring, which is every shape the app
 * could draw before 2026-10-22.
 *
 * ⚠ **Walls are paired by GEOMETRY, not by the order they were built in.**
 * `addCourtyard` happens to emit the inner ring in a known order, and relying
 * on that would break the moment a ring is edited, split or loaded from a file
 * written by a different version. An inner wall faces an outer one when it
 * runs ANTI-PARALLEL to it — the inner loop is wound the other way, so a wall
 * across the building from another points back along it — and among those, the
 * nearest one is the one it faces.
 */
export function ringRoofPlanes(footprint: Footprint): RingRoofPlane[] | null {
  const loops = footprintLoops(footprint);
  if (loops.length !== 2) return null;
  const outer = loops.find((l) => l.isOuter);
  const inner = loops.find((l) => !l.isOuter);
  if (!outer || !inner) return null;

  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));
  const ends = (wallId: string): [Point, Point] | null => {
    const wall = footprint.walls.find((w) => w.id === wallId);
    if (!wall) return null;
    const a = byId.get(wall.startCorner);
    const b = byId.get(wall.endCorner);
    return a && b ? [a, b] : null;
  };
  const unit = (a: Point, b: Point): Point => {
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y) || 1;
    return { x: d.x / len, y: d.y / len };
  };

  const planes: RingRoofPlane[] = [];
  for (const outerWall of outer.walls) {
    const o = ends(outerWall.id);
    if (!o) continue;
    const oDir = unit(o[0], o[1]);
    const oMid = mid(o[0], o[1]);

    let best: { id: string; pts: [Point, Point]; distance: number } | null = null;
    for (const innerWall of inner.walls) {
      const i = ends(innerWall.id);
      if (!i) continue;
      const iDir = unit(i[0], i[1]);
      // Anti-parallel: the inner loop is wound the other way, so a wall facing
      // this one across the building runs back along it.
      const alignment = oDir.x * iDir.x + oDir.y * iDir.y;
      if (alignment > -0.99) continue;
      const distance = Math.hypot(mid(i[0], i[1]).x - oMid.x, mid(i[0], i[1]).y - oMid.y);
      if (!best || distance < best.distance) best = { id: innerWall.id, pts: i, distance };
    }
    if (!best) continue;

    planes.push({
      outerWallId: outerWall.id,
      innerWallId: best.id,
      outerStart: o[0],
      outerEnd: o[1],
      // The inner wall runs the other way, so its END is nearest the outer
      // wall's START. Carried in that order, which makes the four points a
      // simple ring rather than a bow tie.
      innerStart: best.pts[1],
      innerEnd: best.pts[0],
      spanFt: distanceToLine(mid(best.pts[0], best.pts[1]), o[0], o[1]),
    });
  }
  return planes.length > 0 ? planes : null;
}

/**
 * The span every rafter has to cover, when it is the same all the way round.
 *
 * A ring made by insetting has one span — the building's width — which is the
 * number the roof is sized by. Returns null when the spans differ, which
 * happens as soon as someone edits one ring and not the other: there is no
 * single answer then, and inventing one would size half the rafters wrong.
 */
export function ringRoofUniformSpanFt(footprint: Footprint): number | null {
  const planes = ringRoofPlanes(footprint);
  if (!planes) return null;
  const first = planes[0]!.spanFt;
  const EIGHTH_FT = 1 / 8 / 12;
  return planes.every((p) => Math.abs(p.spanFt - first) < EIGHTH_FT) ? first : null;
}

/**
 * Why a gable roof cannot be put on a ring — the sentence the editor shows.
 *
 * Returned rather than thrown, and returned from here rather than written in
 * the app, so the reason sits beside the geometry that makes it true.
 */
export function ringRoofGableBlockReason(footprint: Footprint): string | null {
  if (footprintLoops(footprint).length < 2) return null;
  return (
    "This building is a ring around a courtyard, so there is no pair of opposite walls for a roof-catcher beam to " +
    "span between. Its roof follows the building all the way round instead."
  );
}
