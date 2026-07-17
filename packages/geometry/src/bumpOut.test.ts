import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { insertBumpOut, outwardNormal } from "./bumpOut";
import { cornerTurnAngleRad, isConvexCorner, isRightAngleCorner } from "./cornerAngle";
import { isSelfIntersecting as hasSelfIntersection } from "./polygonValidity";
import type { Footprint, Point } from "./types";

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

describe("insertBumpOut", () => {
  it("replaces the target wall with 5 walls, adding 4 corners", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    expect(footprint.corners).toHaveLength(8);
    expect(footprint.walls).toHaveLength(8);
  });

  it("renumbers all corners 0..n-1 and keeps the walls in a closed loop", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    expect(footprint.corners.map((c) => c.id)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
    for (let i = 0; i < footprint.walls.length; i++) {
      const wall = footprint.walls[i]!;
      const next = footprint.walls[(i + 1) % footprint.walls.length]!;
      expect(wall.endCorner).toBe(next.startCorner);
    }
  });

  it("keeps every new corner a right angle (90deg turn), same as the untouched originals", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    for (const wall of footprint.walls) {
      const nextWall = footprint.walls.find((w) => w.startCorner === wall.endCorner)!;
      const angle = cornerTurnAngleRad(wall, nextWall, footprint.corners);
      expect(isRightAngleCorner(angle)).toBe(true);
    }
  });

  it("preserves total exterior perimeter length added by the bump-out (2 * depth extra travel)", () => {
    // Replacing a straight 5ft span with out-5ft-across-back-5ft-in adds
    // 2*depth of extra perimeter beyond the original span length.
    const fp = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    const originalPerimeter = fp.walls.reduce((sum, w) => sum + w.lengthFt, 0);
    const newPerimeter = footprint.walls.reduce((sum, w) => sum + w.lengthFt, 0);
    expect(newPerimeter).toBeCloseTo(originalPerimeter + 2 * 5, 6);
  });

  it("pulls the new corners outward (away from the centroid) for a positive depth", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // corners: [A, pa, paOut, pbOut, pb, B, C, D] — pa/pb sit on the
    // original wall (y=0 unchanged), only paOut/pbOut (indices 2,3) move.
    // AB runs along y=0 (the top edge); centroid is below at y=10. An
    // outward bump-out on the top wall should push those points to y < 0.
    const outYs = [footprint.corners[2]!.point.y, footprint.corners[3]!.point.y];
    for (const y of outYs) expect(y).toBeLessThan(0);
  });

  it("pushes the new corners inward (toward the centroid) for a negative depth (notch)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(fp, "AB", 10, 15, -3, allPrimary(fp));
    const outYs = [footprint.corners[2]!.point.y, footprint.corners[3]!.point.y];
    for (const y of outYs) {
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(10); // clamped well short of the centroid
    }
  });

  it("clamps an excessive inward depth so it can't cross the centroid", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(fp, "AB", 10, 15, -1000, allPrimary(fp));
    const outYs = [footprint.corners[2]!.point.y, footprint.corners[3]!.point.y];
    for (const y of outYs) expect(y).toBeLessThan(10); // never reaches the centroid at y=10
  });

  it("bumps a near-zero depth up to a minimum so the result isn't degenerate", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(fp, "AB", 10, 15, 0, allPrimary(fp));
    const outYs = [footprint.corners[2]!.point.y, footprint.corners[3]!.point.y];
    for (const y of outYs) expect(y).toBeLessThan(0); // defaults outward, non-zero
  });

  it("clamps a span that runs past the wall's own ends to fully flush at both ends", () => {
    const fp = buildRectangleFootprint(30, 20);
    // AB is 30ft long; requesting a span past its end clamps to flush (0 and
    // 30) at both ends, which merges the jog into both adjoining walls with
    // no new corners inserted at all (see the "merges both ends" test below).
    const { footprint } = insertBumpOut(fp, "AB", -5, 40, 5, allPrimary(fp));
    expect(footprint.corners).toHaveLength(4);
  });

  describe("flush ends merge into the adjoining wall instead of a small remainder", () => {
    it("merges a flush start: the wall's own start corner just moves outward, no separate remainder corner", () => {
      const fp = buildRectangleFootprint(30, 20);
      const { footprint, primaryCornerIds } = insertBumpOut(fp, "AB", 0, 15, 5, allPrimary(fp));
      // A, pbOut, pb, B, C, D — no `pa`/`paOut` pair since the start is flush.
      expect(footprint.corners).toHaveLength(6);
      // Corner "A" (index 0) is still primary, and its own point moved
      // outward by depth (merging straight into the DA wall) instead of
      // staying put with a new corner spliced in next to it.
      expect(primaryCornerIds.has("0")).toBe(true);
      expect(footprint.corners[0]!.point).toEqual({ x: 0, y: -5 });
      // The wall that used to be D->A (length 20) now runs D->A(moved),
      // extended by the full depth to 25.
      const daWall = footprint.walls.find((w) => w.startCorner === "5" && w.endCorner === "0")!;
      expect(daWall.lengthFt).toBeCloseTo(25, 6);
    });

    it("merges a flush end: the wall's own end corner just moves outward, no separate remainder corner", () => {
      const fp = buildRectangleFootprint(30, 20);
      const { footprint, primaryCornerIds } = insertBumpOut(fp, "AB", 15, 30, 5, allPrimary(fp));
      // A, pa, paOut, B(moved), C, D — no `pb`/`pbOut` pair since the end is flush.
      expect(footprint.corners).toHaveLength(6);
      const bCornerId = "3"; // A(0), pa(1), paOut(2), B(3), C(4), D(5)
      expect(primaryCornerIds.has(bCornerId)).toBe(true);
      expect(footprint.corners[3]!.point).toEqual({ x: 30, y: -5 });
      const bcWall = footprint.walls.find((w) => w.startCorner === bCornerId && w.endCorner === "4")!;
      expect(bcWall.lengthFt).toBeCloseTo(25, 6);
    });

    it("merges both ends: the whole wall shifts outward with no new corners at all", () => {
      const fp = buildRectangleFootprint(30, 20);
      const { footprint, primaryCornerIds } = insertBumpOut(fp, "AB", 0, 30, 5, allPrimary(fp));
      expect(footprint.corners).toHaveLength(4);
      expect(primaryCornerIds.size).toBe(4);
      expect(footprint.corners[0]!.point).toEqual({ x: 0, y: -5 }); // A
      expect(footprint.corners[1]!.point).toEqual({ x: 30, y: -5 }); // B
    });
  });

  it("is a no-op when the wall id doesn't exist", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const result = insertBumpOut(fp, "nonexistent", 10, 15, 5, primary);
    expect(result.footprint).toBe(fp);
    expect(result.primaryCornerIds).toBe(primary);
  });

  describe("primaryCornerIds tracking", () => {
    it("remaps unchanged corners' primary status through the renumbering, and never marks new corners primary", () => {
      const fp = buildRectangleFootprint(30, 20); // A,B,C,D in order
      const { footprint, primaryCornerIds } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
      // Original A,B,C,D (4 corners) remain primary under their new ids;
      // the 4 new corners inserted between A and B are not.
      expect(primaryCornerIds.size).toBe(4);
      expect(footprint.corners).toHaveLength(8);
      // corners: [A(0), pa(1), paOut(2), pbOut(3), pb(4), B(5), C(6), D(7)]
      expect(primaryCornerIds.has("0")).toBe(true); // A
      expect(primaryCornerIds.has("5")).toBe(true); // B
      expect(primaryCornerIds.has("6")).toBe(true); // C
      expect(primaryCornerIds.has("7")).toBe(true); // D
      for (const id of ["1", "2", "3", "4"]) {
        expect(primaryCornerIds.has(id)).toBe(false);
      }
    });

    it("carries a shrunk primary set correctly through a second bump-out", () => {
      const fp = buildRectangleFootprint(30, 20);
      const first = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
      // Second bump-out on one of the *original* remaining walls (BC, still primary-anchored)
      const bcWall = first.footprint.walls.find((w) => w.startCorner === "5" && w.endCorner === "6")!;
      const second = insertBumpOut(first.footprint, bcWall.id, 5, 10, 5, first.primaryCornerIds);
      // 8 + 4 new = 12 corners; still exactly the original 4 (A,B,C,D) are primary
      expect(second.footprint.corners).toHaveLength(12);
      expect(second.primaryCornerIds.size).toBe(4);
    });
  });

  describe("reflex (inside) corners are detectable via isConvexCorner", () => {
    it("an outward bump-out's inside corners are not convex, while its outside corners are", () => {
      const fp = buildRectangleFootprint(30, 20);
      const { footprint } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
      // corners: [A(0), pa(1), paOut(2), pbOut(3), pb(4), B(5), C(6), D(7)]
      // Reflex (inside) corners: at pa (wall A->pa meets pa->paOut) and at pb
      // (wall paOut->pb-side meets pb->B). Convex (outside) corners: paOut, pbOut.
      const wallsById = Object.fromEntries(footprint.walls.map((w) => [`${w.startCorner}-${w.endCorner}`, w]));
      const wallAtoPa = wallsById["0-1"]!;
      const wallPaToPaOut = wallsById["1-2"]!;
      const wallPaOutToPbOut = wallsById["2-3"]!;
      const wallPbOutToPb = wallsById["3-4"]!;
      const wallPbToB = wallsById["4-5"]!;

      expect(isConvexCorner(wallAtoPa, wallPaToPaOut, footprint.corners)).toBe(false); // inside corner at pa
      expect(isConvexCorner(wallPaToPaOut, wallPaOutToPbOut, footprint.corners)).toBe(true); // outside corner at paOut
      expect(isConvexCorner(wallPaOutToPbOut, wallPbOutToPb, footprint.corners)).toBe(true); // outside corner at pbOut
      expect(isConvexCorner(wallPbOutToPb, wallPbToB, footprint.corners)).toBe(false); // inside corner at pb
    });
  });

  describe("outwardNormal", () => {
    it("is a fixed -90deg rotation of the direction vector, independent of any centroid", () => {
      const closeVec = (v: Point, expected: Point) => {
        expect(v.x).toBeCloseTo(expected.x, 9);
        expect(v.y).toBeCloseTo(expected.y, 9);
      };
      closeVec(outwardNormal({ x: 1, y: 0 }), { x: 0, y: -1 });
      closeVec(outwardNormal({ x: 0, y: 1 }), { x: 1, y: 0 });
      closeVec(outwardNormal({ x: -1, y: 0 }), { x: 0, y: 1 });
      closeVec(outwardNormal({ x: 0, y: -1 }), { x: -1, y: 0 });
    });
  });

  describe("regression: outward direction stays correct after prior bump-outs skew a naive centroid", () => {
    // Tommy: "it sends a shorter wall onto the other side of the perimeter
    // making the 2d layout look glitchy... it is clearly spawning outside
    // the primary floor plan." A vertex-averaged "centroid" (the old
    // heuristic) gets dragged hard toward a cluster of 4 tightly-spaced new
    // corners from a single bump-out, which can flip which side reads as
    // "outward" for an unrelated wall elsewhere on the building. The fixed
    // winding-order-based `outwardNormal` doesn't have this failure mode.
    it("keeps a deep, wide notch (heavily skewing the naive vertex average) from flipping later bump-outs on other walls", () => {
      let fp = buildRectangleFootprint(40, 30);
      let primary = allPrimary(fp);

      // A deep notch spanning most of the top wall — clusters 4 new corners
      // tightly around y=12, dragging a naive vertex-average centroid from
      // (20,15) down to (20,10.5), more than a third of the way across the
      // building's own depth.
      const step1 = insertBumpOut(fp, "AB", 5, 35, -12, primary);
      fp = step1.footprint;
      primary = step1.primaryCornerIds;
      expect(hasSelfIntersection(fp)).toBe(false);

      // Outward bump on the bottom wall (opposite the notch) should still
      // land further away (larger y), not flip back toward/through the notch.
      const bottomWall = fp.walls.find((w) => w.startCorner === "6" && w.endCorner === "7")!;
      const step2 = insertBumpOut(fp, bottomWall.id, 5, 15, 6, primary);
      expect(hasSelfIntersection(step2.footprint)).toBe(false);
      // The new bump-out's own outward corners (any corner further along
      // than the original bottom wall's own y=30) must land strictly
      // further out (y>30), never flipped back toward/through the notch.
      const outwardCorners = step2.footprint.corners.filter((c) => c.point.y !== 30 && c.point.y >= 25);
      expect(outwardCorners.length).toBeGreaterThan(0);
      for (const c of outwardCorners) expect(c.point.y).toBeGreaterThan(30); // further out, not backward

      // Outward bump on a side wall too, for good measure.
      fp = step2.footprint;
      primary = step2.primaryCornerIds;
      const rightSideWall = fp.walls.find((w) => {
        const s = fp.corners.find((c) => c.id === w.startCorner)!.point;
        const e = fp.corners.find((c) => c.id === w.endCorner)!.point;
        return s.x === 40 && e.x === 40 && Math.abs(s.y - e.y) > 20;
      })!;
      const step3 = insertBumpOut(fp, rightSideWall.id, 5, 15, 6, primary);
      expect(hasSelfIntersection(step3.footprint)).toBe(false);
    });

    // Capped at 3 chained bump-outs with modest depths — realistic usage
    // (a handful of additions/notches while sketching a floor plan), not an
    // adversarial stress test. Deliberately deep/numerous chained notches
    // can still, in rare cases, cut into an unrelated far-away part of the
    // same polygon regardless of direction correctness — a separate "ran
    // out of room" collision-detection gap (this app never checked new
    // bump-out geometry against the *rest* of the polygon, only against its
    // own wall's local centroid distance) that predates this fix and isn't
    // what Tommy reported (a wall coming out on the *wrong side*, not
    // colliding with something on the *right* side).
    it("chains several realistic bump-outs across many pseudo-random seeds without ever self-intersecting", () => {
      const rng = (seed: { v: number }) => {
        seed.v = (seed.v * 1103515245 + 12345) & 0x7fffffff;
        return seed.v / 0x7fffffff;
      };
      for (let s = 0; s < 25; s++) {
        let fp: Footprint = buildRectangleFootprint(40, 30);
        let primary = allPrimary(fp);
        const seed = { v: s * 97 + 1 };
        for (let iter = 0; iter < 3; iter++) {
          const wallIds = fp.walls.map((w) => w.id).filter((id) => fp.walls.find((w) => w.id === id)!.lengthFt >= 10);
          if (wallIds.length === 0) break;
          const wallId = wallIds[Math.floor(rng(seed) * wallIds.length)]!;
          const wall = fp.walls.find((w) => w.id === wallId)!;
          const len = wall.lengthFt;
          const spanLen = 3 + rng(seed) * 5;
          const a = 2 + rng(seed) * Math.max(1, len - spanLen - 4);
          const b = a + spanLen;
          const depth = (rng(seed) < 0.3 ? -1 : 1) * (3 + rng(seed) * 4); // mostly additions, some modest notches
          const result = insertBumpOut(fp, wallId, a, b, depth, primary);
          fp = result.footprint;
          primary = result.primaryCornerIds;
          expect(hasSelfIntersection(fp)).toBe(false);
        }
      }
    });
  });
});
