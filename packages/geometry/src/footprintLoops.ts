import { quantizeFootprint } from "./eighths";
import { isOffsetRefusal, offsetFootprintInward, type OffsetRefusal } from "./offsetFootprint";
import type { Corner, Footprint, Point, Wall } from "./types";

/**
 * A BUILDING WITH A HOLE IN IT — the courtyard ring, and the first time this
 * app's idea of a building changes shape.
 *
 * Tommy, 2026-10-20: *"The Octagon Ring is currently impossible to build."*
 * And on 2026-10-21, widening it: *"This should also be compatible with
 * concentric Square/ rectangle buildings."* So this is a SECOND LOOP, not an
 * octagon feature, and nothing here counts sides.
 *
 * ⚠ **It needs no schema change, which was not obvious until it was looked
 * for.** `Footprint` is `{ corners, walls }` with the ring implied by each
 * wall's start and end corner — so a second ring is simply more walls that
 * happen to form their own cycle. The loops are DERIVED by walking that
 * linkage rather than stored, which means no migration, no new field, and
 * every project file ever saved still means exactly what it meant. What
 * changes is that code which assumed one ring has to ask which loop it is
 * looking at.
 *
 * ⚠ **The inner loop winds the OTHER WAY, and that is load-bearing.** With the
 * hole reversed:
 *
 *  - area subtracts instead of adding, by the shoelace sum alone;
 *  - "interior is on the right of travel" keeps meaning the BUILDING MATERIAL
 *    for every wall in both loops;
 *  - and the exterior face of a wall is always to its left, which is how the
 *    compass direction stops needing a centroid.
 *
 * That last one is the fix for a hazard found on 2026-10-20:
 * `wallCompassDirection` decides "outward" as *away from the centroid*, which
 * is backwards for every inner-ring wall — Tommy, 2026-10-21: *"The interior
 * side of the inner courtyard wall is the outside."* Away from the centroid is
 * into the building; the courtyard is where the weather is. Nothing would have
 * crashed; the drawings would just have said S where they meant N.
 */

export interface FootprintLoop {
  /** Walls in ring order, starting wherever the walk began. */
  walls: Wall[];
  /** Corner points in the same order. */
  points: Point[];
  /** Twice the signed area. Its SIGN is the winding. */
  signedDoubleArea: number;
  /** True for the one loop that contains the others. */
  isOuter: boolean;
}

function signedDoubleAreaOf(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/**
 * Every closed ring in the footprint, derived from the wall linkage.
 *
 * A single-ring building returns one loop, which is why nothing that exists
 * today behaves differently. Walls that do not close a cycle — a malformed
 * footprint — are left out rather than throwing: the editor should draw what
 * it can rather than blank the screen.
 */
export function footprintLoops(footprint: Footprint): FootprintLoop[] {
  const byStart = new Map<string, Wall>();
  for (const wall of footprint.walls) byStart.set(wall.startCorner, wall);
  const pointById = new Map(footprint.corners.map((c) => [c.id, c.point]));

  const seen = new Set<string>();
  const loops: Omit<FootprintLoop, "isOuter">[] = [];

  for (const start of footprint.walls) {
    if (seen.has(start.id)) continue;
    const walls: Wall[] = [];
    const points: Point[] = [];
    let cursor: Wall | undefined = start;
    const guard = footprint.walls.length + 1;
    for (let i = 0; i < guard && cursor && !seen.has(cursor.id); i++) {
      seen.add(cursor.id);
      walls.push(cursor);
      const p = pointById.get(cursor.startCorner);
      if (p) points.push(p);
      cursor = byStart.get(cursor.endCorner);
    }
    // A cycle is one that came back to where it started.
    if (walls.length >= 3 && cursor?.id === start.id) {
      loops.push({ walls, points, signedDoubleArea: signedDoubleAreaOf(points) });
    }
  }

  if (loops.length === 0) return [];
  /* The outer loop is the one with the largest area. Comparing MAGNITUDES, not
     signed areas, so it does not matter which way either loop happens to be
     wound — a shape produced by a split or a bump-out need not wind the way
     the builders do. */
  let outerIndex = 0;
  for (let i = 1; i < loops.length; i++) {
    if (Math.abs(loops[i]!.signedDoubleArea) > Math.abs(loops[outerIndex]!.signedDoubleArea)) outerIndex = i;
  }
  return loops.map((loop, i) => ({ ...loop, isOuter: i === outerIndex }));
}

/** Does this building have a courtyard — more than one closed ring? */
export function isCourtyardFootprint(footprint: Footprint): boolean {
  return footprintLoops(footprint).length > 1;
}

/** The loop a wall belongs to, or null if it is not in any closed ring. */
export function loopContainingWall(footprint: Footprint, wallId: string): FootprintLoop | null {
  return footprintLoops(footprint).find((loop) => loop.walls.some((w) => w.id === wallId)) ?? null;
}

/**
 * The unit vector pointing out of the building at this wall — the weather
 * side, which on an inner courtyard wall faces the courtyard.
 *
 * ⚠ **Derived from the loop's WINDING, not from a centroid.** With the
 * interior of a loop on the right of travel, the exterior is on the left, and
 * that holds for a reversed inner loop too — which is exactly why the hole is
 * wound the other way. The centroid test it replaces is wrong for a courtyard
 * (the inner wall's exterior faces the middle) and unreliable on any concave
 * shape, where a wall can sit on the far side of the centroid from its own
 * outside.
 */
export function wallExteriorNormal(footprint: Footprint, wallId: string): Point | null {
  const loops = footprintLoops(footprint);
  const loop = loops.find((l) => l.walls.some((w) => w.id === wallId));
  if (!loop) return null;
  const wall = loop.walls.find((w) => w.id === wallId)!;
  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));
  const a = byId.get(wall.startCorner);
  const b = byId.get(wall.endCorner);
  if (!a || !b) return null;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) return null;
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };

  /* ⚠ THE OUTER LOOP'S WINDING, NOT THIS LOOP'S, AND THE FIRST VERSION USED
     THIS LOOP'S AND CAME OUT BACKWARDS ON EVERY COURTYARD WALL.

     The reason is worth keeping, because it is the same reason the hole is
     reversed in the first place: an inner loop's opposite winding IS the
     information that it is a hole. Travel round it and the building material
     is still on your right — that is what reversing achieves — so the exterior
     is still on your left, by the same rule, with no correction. Multiplying
     by the loop's own sign applies the correction twice and lands back where
     it started, pointing into the building instead of into the courtyard.

     The outer loop's sign is still needed, as a single global reference: a
     shape produced by a split or a bump-out need not wind the way the builders
     do, and if the OUTER ring is reversed then every normal in the building
     flips together. */
  const outer = loops.find((l) => l.isOuter) ?? loop;
  const sign = Math.sign(outer.signedDoubleArea) || 1;
  return { x: dir.y * sign, y: -dir.x * sign };
}

/**
 * Plan area with any courtyards taken out.
 *
 * ⚠ **Not the shoelace sum over `footprint.corners`**, which is what
 * `computeFootprintAreaSqFt` does and which gives nonsense the moment there is
 * a second loop: the corner array interleaves both rings, so the sum traces a
 * shape nobody drew. Walking the loops is the whole difference.
 *
 * ⚠ Holes are subtracted by MAGNITUDE rather than by letting the signs cancel.
 * Signs cancelling is elegant and depends on the inner loop being wound the
 * other way; subtracting magnitudes gives the same answer and still gives it
 * if someone builds a hole wound the same way as its outer.
 */
export function footprintAreaWithHolesSqFt(footprint: Footprint): number {
  const loops = footprintLoops(footprint);
  if (loops.length === 0) return 0;
  let area = 0;
  for (const loop of loops) {
    const half = Math.abs(loop.signedDoubleArea) / 2;
    area += loop.isOuter ? half : -half;
  }
  return Math.max(0, area);
}

/**
 * Add a courtyard: a second loop, inset from the outer one by `insetFt`, wound
 * the other way.
 *
 * `insetFt` is the WIDTH OF THE BUILDING between the two rings — the number a
 * courtyard building is specified with, and the reason `offsetFootprintInward`
 * exists.
 *
 * ⚠ Refuses for the same reasons an inset does, and for one more: a building
 * that already has a courtyard does not get a second one here. Nesting rings
 * is not refused because it is impossible — it is refused because nobody has
 * said what it should mean.
 */
export function addCourtyard(footprint: Footprint, insetFt: number): Footprint | OffsetRefusal {
  if (isCourtyardFootprint(footprint)) return { reason: "self-intersects" };
  const inner = offsetFootprintInward(footprint, insetFt);
  if (isOffsetRefusal(inner)) return inner;

  /* ⚠ Fresh ids with an `i` prefix: the inner ring's corners must not collide
     with the outer's, and a prefix keeps them readable in a drawing and in a
     saved file. Tommy settled the inner-ring NUMBERING separately ("inner ring
     numbers first"), which is about what the SHOP reads on a panel; this is
     only about keys staying unique. */
  const idMap = new Map<string, string>();
  for (const c of inner.corners) idMap.set(c.id, `i${c.id}`);

  /* REVERSED: walls run the other way round, so the loop winds opposite to the
     outer one. See this module's own note on why that is load-bearing. */
  const innerWalls: Wall[] = inner.walls
    .map((w) => ({
      id: `i${w.endCorner}i${w.startCorner}`,
      startCorner: idMap.get(w.endCorner)!,
      endCorner: idMap.get(w.startCorner)!,
      lengthFt: w.lengthFt,
    }))
    .reverse();

  const innerCorners: Corner[] = inner.corners.map((c) => ({ id: idMap.get(c.id)!, point: c.point }));

  return quantizeFootprint({
    corners: [...footprint.corners, ...innerCorners],
    walls: [...footprint.walls, ...innerWalls],
  });
}

/** Remove every courtyard, leaving the outer ring. */
export function removeCourtyards(footprint: Footprint): Footprint {
  const loops = footprintLoops(footprint);
  const outer = loops.find((l) => l.isOuter);
  if (!outer || loops.length <= 1) return footprint;
  const keep = new Set(outer.walls.map((w) => w.id));
  const cornerIds = new Set(outer.walls.map((w) => w.startCorner));
  return {
    corners: footprint.corners.filter((c) => cornerIds.has(c.id)),
    walls: footprint.walls.filter((w) => keep.has(w.id)),
  };
}
