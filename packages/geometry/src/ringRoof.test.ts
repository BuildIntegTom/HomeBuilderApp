import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { addCourtyard } from "./footprintLoops";
import { isOffsetRefusal } from "./offsetFootprint";
import { computeRoofBearingSegments } from "./roofBearingSegments";
import { retile } from "./retile";
import { ringRoofGableBlockReason, ringRoofPlanes, ringRoofUniformSpanFt } from "./ringRoof";
import type { Footprint } from "./types";

const allCorners = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
const ring = (fp: Footprint, widthFt: number) => {
  const out = addCourtyard(fp, widthFt);
  if (isOffsetRefusal(out)) throw new Error(`refused: ${out.reason}`);
  return out;
};
const EIGHTH_FT = 1 / 8 / 12;
const near = (a: number, b: number) => Math.abs(a - b) < EIGHTH_FT;

describe("⚠ the roof over a ring is an annulus, one plane per outer wall", () => {
  it("a rectangular ring has four planes, each pairing an outer wall with the inner wall facing it", () => {
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const planes = ringRoofPlanes(fp)!;
    expect(planes).toHaveLength(4);
    expect(new Set(planes.map((p) => p.outerWallId)).size).toBe(4);
    expect(new Set(planes.map((p) => p.innerWallId)).size).toBe(4);
  });

  it("an octagon ring has eight, which is the shape he asked about", () => {
    const fp = ring(buildOctagonFootprint(70, 70), 12);
    expect(ringRoofPlanes(fp)!).toHaveLength(8);
  });

  it("⚠ every span equals the BUILDING'S WIDTH — the number the ring was made with", () => {
    /* The rafter run. On a ring made by insetting it is the same all the way
       round by construction, which is what makes one number size the whole
       roof. */
    for (const [fp, widthFt] of [
      [buildRectangleFootprint(60, 40), 10],
      [buildRectangleFootprint(50, 50), 8],
      [buildOctagonFootprint(70, 70), 12],
    ] as [Footprint, number][]) {
      const ringed = ring(fp, widthFt);
      for (const plane of ringRoofPlanes(ringed)!) {
        expect({ width: widthFt, span: near(plane.spanFt, widthFt) }).toEqual({ width: widthFt, span: true });
      }
      expect(near(ringRoofUniformSpanFt(ringed)!, widthFt)).toBe(true);
    }
  });

  it("⚠ the four plan corners are a ring, not a bow tie", () => {
    /* The inner wall runs the other way round, so its END is the point nearest
       the outer wall's START. Carried in that order the quad is simple; carried
       naively it crosses itself and every area, every rafter length and every
       sheet of roofing computed from it would be wrong. */
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    for (const p of ringRoofPlanes(fp)!) {
      const d1 = Math.hypot(p.innerStart.x - p.outerStart.x, p.innerStart.y - p.outerStart.y);
      const d2 = Math.hypot(p.innerEnd.x - p.outerEnd.x, p.innerEnd.y - p.outerEnd.y);
      const crossed1 = Math.hypot(p.innerEnd.x - p.outerStart.x, p.innerEnd.y - p.outerStart.y);
      const crossed2 = Math.hypot(p.innerStart.x - p.outerEnd.x, p.innerStart.y - p.outerEnd.y);
      // The matched pairing is the shorter one; a bow tie would be longer.
      expect(d1 + d2).toBeLessThan(crossed1 + crossed2);
    }
  });

  it("is null for every shape that is not a ring", () => {
    expect(ringRoofPlanes(buildRectangleFootprint(40, 20))).toBeNull();
    expect(ringRoofPlanes(buildOctagonFootprint(40, 24))).toBeNull();
    expect(ringRoofUniformSpanFt(buildRectangleFootprint(40, 20))).toBeNull();
  });
});

describe("⚠ what the existing roof can and cannot do here", () => {
  it("a gable roof is blocked on a ring, with a reason that says why", () => {
    /* `gableEndToggleBlockReason` already refuses a third gable wall because
       "the roof-catcher beam spans between exactly 2". A ring has no pair of
       opposite walls at all — it has two closed rings and a hole. */
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const reason = ringRoofGableBlockReason(fp)!;
    expect(reason).toContain("courtyard");
    expect(reason).toContain("roof-catcher beam");
    expect(reason).toMatch(/[.!]$/);
  });

  it("and is NOT blocked on anything that is not a ring", () => {
    expect(ringRoofGableBlockReason(buildRectangleFootprint(40, 20))).toBeNull();
    expect(ringRoofGableBlockReason(buildOctagonFootprint(40, 24))).toBeNull();
  });

  it("⚠ the BEARING already works on both rings, with no changes at all", () => {
    /* `computeRoofBearingSegments` is per wall — Tommy: "options for being a
       ring all the way around or just one section of the wall" — so every wall
       on both loops gets its truss plate without this module touching it. What
       was missing was never the bearing; it was the surface between them. */
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const slots = retile(fp, fp.corners[0]!.id, allCorners(fp), 40, 24, 15.5, {
      spacingIn: 100_000,
      defaultPattern: "chevron",
      defaultMirrored: false,
    });
    for (const wall of fp.walls) {
      const segments = computeRoofBearingSegments(slots[wall.id] ?? [], undefined);
      expect(segments.length).toBeGreaterThan(0);
      const covered = segments.reduce((n, s) => n + s.lengthIn, 0);
      const panels = (slots[wall.id] ?? []).reduce((n, s) => n + s.widthIn, 0);
      expect(near(covered / 12, panels / 12)).toBe(true);
    }
  });
});

describe("a ring whose loops have been edited apart", () => {
  it("⚠ reports NO uniform span rather than inventing one", () => {
    /* Edit one ring and not the other and the rafter run differs around the
       building. There is no single number then, and returning one would size
       half the rafters wrong. */
    const fp = ring(buildRectangleFootprint(60, 40), 10);
    const moved: Footprint = {
      ...fp,
      corners: fp.corners.map((c) => (c.id.startsWith("i") ? { ...c, point: { x: c.point.x + 3, y: c.point.y } } : c)),
    };
    expect(ringRoofUniformSpanFt(moved)).toBeNull();
    // The planes are still there — only the single-number answer is gone.
    expect(ringRoofPlanes(moved)).not.toBeNull();
  });
});
