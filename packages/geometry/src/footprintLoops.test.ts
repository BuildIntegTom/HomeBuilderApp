import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import { computeFootprintAreaSqFt } from "./footprintArea";
import { isOffsetRefusal } from "./offsetFootprint";
import {
  addCourtyard,
  footprintAreaWithHolesSqFt,
  footprintLoops,
  isCourtyardFootprint,
  loopContainingWall,
  removeCourtyards,
  wallExteriorNormal,
} from "./footprintLoops";
import type { Footprint, Point } from "./types";

const allCorners = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
const ring = (fp: Footprint, insetFt: number) => {
  const out = addCourtyard(fp, insetFt);
  if (isOffsetRefusal(out)) throw new Error(`refused: ${out.reason}`);
  return out;
};
const midOf = (fp: Footprint, wallId: string): Point => {
  const w = fp.walls.find((x) => x.id === wallId)!;
  const a = fp.corners.find((c) => c.id === w.startCorner)!.point;
  const b = fp.corners.find((c) => c.id === w.endCorner)!.point;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};

describe("⚠ nothing that exists today behaves differently", () => {
  it("every drawable shape is exactly ONE loop, and it is the outer one", () => {
    /* The reason this lands without a migration: a second ring is just more
       walls that form their own cycle, derived from the linkage that was
       already there. One ring in, one loop out. */
    const base = buildRectangleFootprint(40, 24);
    for (const fp of [
      buildRectangleFootprint(40, 20),
      buildRectangleFootprint(30, 30),
      buildOctagonFootprint(40, 24),
      buildOctagonFootprint(30, 30),
      insertBumpOut(base, "AB", 10, 20, 8, allCorners(base)).footprint,
    ]) {
      const loops = footprintLoops(fp);
      expect(loops).toHaveLength(1);
      expect(loops[0]!.isOuter).toBe(true);
      expect(loops[0]!.walls).toHaveLength(fp.walls.length);
      expect(isCourtyardFootprint(fp)).toBe(false);
    }
  });

  it("area is unchanged on a single-loop building", () => {
    for (const fp of [buildRectangleFootprint(40, 20), buildOctagonFootprint(30, 30)]) {
      expect(footprintAreaWithHolesSqFt(fp)).toBeCloseTo(computeFootprintAreaSqFt(fp), 6);
    }
  });

  it("a malformed footprint returns no loops rather than throwing", () => {
    const fp = buildRectangleFootprint(40, 20);
    const broken: Footprint = { corners: fp.corners, walls: fp.walls.slice(0, 2) };
    expect(footprintLoops(broken)).toEqual([]);
    expect(footprintAreaWithHolesSqFt(broken)).toBe(0);
  });
});

describe("⚠ the courtyard: two loops, and the hole comes OFF the area", () => {
  it("a rectangle with a courtyard has two loops, one outer and one not", () => {
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const loops = footprintLoops(fp);
    expect(loops).toHaveLength(2);
    expect(loops.filter((l) => l.isOuter)).toHaveLength(1);
    expect(isCourtyardFootprint(fp)).toBe(true);
  });

  it("the area is the building, not the whole site", () => {
    /* 60x40 with a 10ft-wide building all round leaves a 40x20 courtyard.
       2400 - 800 = 1600 sq ft of building. */
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    expect(footprintAreaWithHolesSqFt(fp)).toBeCloseTo(1600, 0);
  });

  it("⚠ and the OLD area function gets it wrong, which is why this one exists", () => {
    /* `computeFootprintAreaSqFt` walks `footprint.corners` in array order. With
       two rings that array interleaves them, so the sum traces a shape nobody
       drew. Stated as a test so nobody "simplifies" one into the other. */
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    expect(Math.abs(computeFootprintAreaSqFt(fp) - 1600)).toBeGreaterThan(1);
  });

  it("⚠ the inner loop winds the OTHER WAY", () => {
    // Load-bearing: it is what makes area subtract and the exterior face come
    // out on the courtyard side without a centroid.
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const [a, b] = footprintLoops(fp);
    expect(Math.sign(a!.signedDoubleArea)).not.toBe(Math.sign(b!.signedDoubleArea));
  });

  it("an octagon ring works the same way, and so does a square", () => {
    // Tommy, 2026-10-21: "compatible with concentric Square/ rectangle
    // buildings". Nothing in here counts sides.
    for (const [fp, insetFt] of [
      [buildOctagonFootprint(60, 60), 10],
      [buildRectangleFootprint(50, 50), 8],
    ] as [Footprint, number][]) {
      const out = ring(fp, insetFt);
      expect(footprintLoops(out)).toHaveLength(2);
      expect(footprintAreaWithHolesSqFt(out)).toBeLessThan(computeFootprintAreaSqFt(fp));
      expect(footprintAreaWithHolesSqFt(out)).toBeGreaterThan(0);
    }
  });

  it("every wall belongs to exactly one loop, and the ids stay unique", () => {
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    expect(new Set(fp.walls.map((w) => w.id)).size).toBe(fp.walls.length);
    expect(new Set(fp.corners.map((c) => c.id)).size).toBe(fp.corners.length);
    for (const wall of fp.walls) expect(loopContainingWall(fp, wall.id)).not.toBeNull();
  });

  it("removing the courtyard gives the building back", () => {
    const outer = buildRectangleFootprint(60, 40);
    const back = removeCourtyards(ring(outer, 10));
    expect(back.walls.map((w) => w.id).sort()).toEqual(outer.walls.map((w) => w.id).sort());
    expect(footprintAreaWithHolesSqFt(back)).toBeCloseTo(2400, 0);
  });

  it("refuses an inset that leaves no courtyard, and a second courtyard", () => {
    const fp = buildRectangleFootprint(60, 40);
    const tooDeep = addCourtyard(fp, 25);
    expect(isOffsetRefusal(tooDeep)).toBe(true);
    const already = addCourtyard(ring(fp, 10), 5);
    expect(isOffsetRefusal(already)).toBe(true);
  });
});

describe("⚠ which side of a wall is the weather side", () => {
  it("on the OUTER ring it points away from the building", () => {
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const loops = footprintLoops(fp);
    const outer = loops.find((l) => l.isOuter)!;
    const centre = { x: 30, y: 20 };
    for (const wall of outer.walls) {
      const n = wallExteriorNormal(fp, wall.id)!;
      const mid = midOf(fp, wall.id);
      // Pointing away from the middle of the building.
      expect(n.x * (centre.x - mid.x) + n.y * (centre.y - mid.y)).toBeLessThan(0);
    }
  });

  it("⚠ on the INNER ring it points INTO the courtyard — his answer, as a test", () => {
    /* Tommy, 2026-10-21: "The interior side of the inner courtyard wall is the
       outside." The centroid rule `wallCompassDirection` uses would have given
       the opposite for every one of these walls, silently, and every drawing
       would have carried it. */
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const inner = footprintLoops(fp).find((l) => !l.isOuter)!;
    const centre = { x: 30, y: 20 };
    for (const wall of inner.walls) {
      const n = wallExteriorNormal(fp, wall.id)!;
      const mid = midOf(fp, wall.id);
      // Pointing TOWARD the middle, which is where the courtyard is.
      expect(n.x * (centre.x - mid.x) + n.y * (centre.y - mid.y)).toBeGreaterThan(0);
    }
  });

  it("⚠ the two rings' facing walls point in OPPOSITE directions", () => {
    /* The north wall of the outer ring faces north; the north wall of the
       courtyard faces south, because its weather side looks across the
       courtyard. If these ever agree, the compass labels are wrong again. */
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const loops = footprintLoops(fp);
    const outerTop = loops
      .find((l) => l.isOuter)!
      .walls.reduce((best, w) => (midOf(fp, w.id).y < midOf(fp, best.id).y ? w : best));
    const innerTop = loops
      .find((l) => !l.isOuter)!
      .walls.reduce((best, w) => (midOf(fp, w.id).y < midOf(fp, best.id).y ? w : best));
    const a = wallExteriorNormal(fp, outerTop.id)!;
    const b = wallExteriorNormal(fp, innerTop.id)!;
    expect(a.x * b.x + a.y * b.y).toBeLessThan(0);
  });

  it("is a unit vector, and null for a wall in no loop", () => {
    const fp = buildRectangleFootprint(40, 20);
    for (const wall of fp.walls) {
      const n = wallExteriorNormal(fp, wall.id)!;
      expect(Math.hypot(n.x, n.y)).toBeCloseTo(1, 9);
    }
    expect(wallExteriorNormal(fp, "ZZ")).toBeNull();
  });

  it("⚠ agrees with today's behaviour on every single-loop shape", () => {
    /* The old rule is "away from the centroid". On a convex single-ring
       building the two agree everywhere, which is why this change is safe for
       everything that already exists. Where they differ is a concave shape and
       a courtyard, and both of those are the point. */
    for (const fp of [buildRectangleFootprint(40, 20), buildOctagonFootprint(30, 30)]) {
      const cx = fp.corners.reduce((s, c) => s + c.point.x, 0) / fp.corners.length;
      const cy = fp.corners.reduce((s, c) => s + c.point.y, 0) / fp.corners.length;
      for (const wall of fp.walls) {
        const n = wallExteriorNormal(fp, wall.id)!;
        const mid = midOf(fp, wall.id);
        expect(n.x * (mid.x - cx) + n.y * (mid.y - cy)).toBeGreaterThan(0);
      }
    }
  });
});
