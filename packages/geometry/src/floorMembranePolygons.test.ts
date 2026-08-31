import { describe, expect, it } from "vitest";
import { insertBumpOut } from "./bumpOut";
import { buildRectangleFootprint, MIN_DIMENSION_FT } from "./footprint";
import { computeFootprintAreaSqFt } from "./footprintArea";
import { computeFloorMembraneBandPolygons } from "./floorMembranePolygons";
import { buildOctagonFootprint } from "./octagon";
import { isPointInPolygon } from "./pointInPolygon";
import type { Footprint, Point } from "./types";

function areaSqFt(ring: Point[]): number {
  let twice = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

function totalAreaSqFt(footprint: Footprint, nearPoint: Point): number {
  return computeFloorMembraneBandPolygons(footprint, nearPoint).reduce((sum, piece) => sum + areaSqFt(piece.polygon), 0);
}

/** Every point of every piece must lie inside or on the footprint ring —
 * this is the whole point of the change (Tommy: "i see how it overlaps on
 * the current live version... lets make that the same size as the
 * footprint"), and it is what a bounding-box skin fails. */
function everyCornerInsideFootprint(footprint: Footprint, nearPoint: Point): boolean {
  const ring = footprint.corners.map((c) => c.point);
  const EPS = 1e-6;
  return computeFloorMembraneBandPolygons(footprint, nearPoint)
    .flatMap((piece) => piece.polygon)
    .every((p) => {
      if (isPointInPolygon(p, ring)) return true;
      // On the boundary counts: a clipped ring's corners sit exactly on the
      // footprint's own edges, where an inside/outside test is a coin flip.
      return ring.some((a, i) => {
        const b = ring[(i + 1) % ring.length]!;
        const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        if (Math.abs(cross) > EPS * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))) return false;
        const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
        const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        return dot >= -EPS && dot <= lenSq + EPS;
      });
    });
}

/** A U: a mid-wall notch with non-flush ends, deep enough to cut clean
 * through a band strip. 30ft wide x 40ft deep, so the split axis is DEPTH
 * and the bands are 13.33ft horizontal strips; the notch is cut into the
 * y=0 wall (`insertBumpOut` takes a negative depth for an inward notch)
 * spanning x 10..20 and running 14ft deep, i.e. PAST the first band
 * boundary — so band 0 comes apart into an x<10 piece and an x>20 piece.
 * A shallower notch would leave every strip connected around it. */
function buildUFootprint(): Footprint {
  const base = buildRectangleFootprint(30, 40);
  return insertBumpOut(base, "AB", 10, 20, -14, new Set(["A", "B", "C", "D"])).footprint;
}

describe("computeFloorMembraneBandPolygons", () => {
  it("still returns 3 plain rectangles on a rectangle, tiling the whole footprint", () => {
    const footprint = buildRectangleFootprint(48, 24);
    const pieces = computeFloorMembraneBandPolygons(footprint, { x: 0, y: 12 });
    expect(pieces).toHaveLength(3);
    expect(pieces.map((p) => p.bandIndex)).toEqual([0, 1, 2]);
    expect(pieces.map((p) => p.pieceIndex)).toEqual([0, 0, 0]);
    for (const piece of pieces) {
      expect(piece.polygon).toHaveLength(4);
      expect(areaSqFt(piece.polygon)).toBeCloseTo(16 * 24, 6);
    }
    // Width axis (48 > 24), marker at min X, so band 0 is the min-X strip.
    const bandXs = pieces.map((p) => Math.min(...p.polygon.map((q) => q.x)));
    expect(bandXs).toEqual([0, 16, 32]);
  });

  it("numbers band 0 from the marker's own end, whichever end that is", () => {
    const footprint = buildRectangleFootprint(48, 24);
    const nearMin = computeFloorMembraneBandPolygons(footprint, { x: 0, y: 12 });
    const nearMax = computeFloorMembraneBandPolygons(footprint, { x: 48, y: 12 });
    const band0MinX = (pieces: ReturnType<typeof computeFloorMembraneBandPolygons>) =>
      Math.min(...pieces.filter((p) => p.bandIndex === 0).flatMap((p) => p.polygon.map((q) => q.x)));
    expect(band0MinX(nearMin)).toBeCloseTo(0, 6);
    expect(band0MinX(nearMax)).toBeCloseTo(32, 6);
  });

  it("splits along the depth axis when the footprint is deeper than wide", () => {
    const footprint = buildRectangleFootprint(24, 48);
    const pieces = computeFloorMembraneBandPolygons(footprint, { x: 12, y: 0 });
    expect(pieces).toHaveLength(3);
    expect(pieces.map((p) => Math.min(...p.polygon.map((q) => q.y)))).toEqual([0, 16, 32]);
    // Every piece spans the full width — the split is across depth only.
    for (const piece of pieces) {
      expect(Math.min(...piece.polygon.map((q) => q.x))).toBeCloseTo(0, 6);
      expect(Math.max(...piece.polygon.map((q) => q.x))).toBeCloseTo(24, 6);
    }
  });

  it("follows an octagon's angled edges instead of its bounding box", () => {
    const footprint = buildOctagonFootprint(40, 30);
    const nearPoint = { x: 0, y: 15 };
    const pieces = computeFloorMembraneBandPolygons(footprint, nearPoint);
    expect(everyCornerInsideFootprint(footprint, nearPoint)).toBe(true);
    expect(totalAreaSqFt(footprint, nearPoint)).toBeCloseTo(computeFootprintAreaSqFt(footprint), 6);
    // The end bands are cut by the diagonals, so they are not rectangles.
    const endBand = pieces.find((p) => p.bandIndex === 0)!;
    expect(endBand.polygon.length).toBeGreaterThan(4);
    // ...and are strictly smaller than the bounding-box band would be.
    const bandWidth = 40 / 3;
    expect(areaSqFt(endBand.polygon)).toBeLessThan(bandWidth * 30);
  });

  it("cuts a real many-cornered ring on an L-shaped footprint, still summing to the footprint area", () => {
    const base = buildRectangleFootprint(40, 30);
    const { footprint } = insertBumpOut(base, "CD", 0, 20, -12, new Set(["A", "B", "C", "D"]));
    const nearPoint = { x: 0, y: 0 };
    const pieces = computeFloorMembraneBandPolygons(footprint, nearPoint);
    expect(everyCornerInsideFootprint(footprint, nearPoint)).toBe(true);
    expect(totalAreaSqFt(footprint, nearPoint)).toBeCloseTo(computeFootprintAreaSqFt(footprint), 6);
    // Whichever band straddles the notch's own back wall is L-shaped itself.
    expect(pieces.some((p) => p.polygon.length >= 6)).toBe(true);
  });

  it("splits one band into several pieces on a U-shaped footprint, rather than bridging the notch", () => {
    const footprint = buildUFootprint();
    const nearPoint = { x: 0, y: 0 };
    const pieces = computeFloorMembraneBandPolygons(footprint, nearPoint);
    expect(pieces.length).toBeGreaterThan(3);
    const bandCounts = new Map<number, number>();
    for (const p of pieces) bandCounts.set(p.bandIndex, (bandCounts.get(p.bandIndex) ?? 0) + 1);
    expect([...bandCounts.values()].some((count) => count >= 2)).toBe(true);
    // Pieces of one band are numbered from 0 and are distinct rings.
    for (const [band, count] of bandCounts) {
      const indices = pieces.filter((p) => p.bandIndex === band).map((p) => p.pieceIndex);
      expect([...indices].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i));
    }
    expect(everyCornerInsideFootprint(footprint, nearPoint)).toBe(true);
    expect(totalAreaSqFt(footprint, nearPoint)).toBeCloseTo(computeFootprintAreaSqFt(footprint), 6);
  });

  it("never bridges a U's notch with a zero-width corridor (the plain Sutherland-Hodgman failure)", () => {
    const footprint = buildUFootprint();
    // The notch is the void x in [10, 20], y in [0, 14]; a bridged ring
    // would contain points inside it.
    const insideNotch = { x: 15, y: 7 };
    for (const piece of computeFloorMembraneBandPolygons(footprint, { x: 0, y: 0 })) {
      expect(isPointInPolygon(insideNotch, piece.polygon)).toBe(false);
    }
  });

  it("works at the minimum footprint dimension, where each band is under 3ft", () => {
    const footprint = buildRectangleFootprint(MIN_DIMENSION_FT, MIN_DIMENSION_FT);
    const pieces = computeFloorMembraneBandPolygons(footprint, { x: 0, y: 0 });
    expect(pieces).toHaveLength(3);
    for (const piece of pieces) expect(areaSqFt(piece.polygon)).toBeCloseTo((MIN_DIMENSION_FT / 3) * MIN_DIMENSION_FT, 6);
  });

  it("drops the sliver when a band boundary lands exactly on a footprint vertex", () => {
    // A triangle-ish footprint whose apex sits on the first band boundary:
    // the clip there is a point, not an area.
    const footprint: Footprint = {
      corners: [
        { id: "0", point: { x: 0, y: 0 } },
        { id: "1", point: { x: 30, y: 0 } },
        { id: "2", point: { x: 10, y: 12 } },
      ],
      walls: [],
    };
    const pieces = computeFloorMembraneBandPolygons(footprint, { x: 0, y: 0 });
    for (const piece of pieces) {
      expect(piece.polygon.length).toBeGreaterThanOrEqual(3);
      expect(areaSqFt(piece.polygon)).toBeGreaterThan(0);
    }
    expect(totalAreaSqFt(footprint, { x: 0, y: 0 })).toBeCloseTo(computeFootprintAreaSqFt(footprint), 6);
  });

  it("handles a band boundary running collinear with a footprint edge", () => {
    // 30ft wide, so the boundaries land at x=10 and x=20 — and the notch's
    // own side walls are placed exactly there.
    const base = buildRectangleFootprint(30, 20);
    const { footprint } = insertBumpOut(base, "CD", 10, 20, -6, new Set(["A", "B", "C", "D"]));
    const nearPoint = { x: 0, y: 0 };
    expect(totalAreaSqFt(footprint, nearPoint)).toBeCloseTo(computeFootprintAreaSqFt(footprint), 6);
    expect(everyCornerInsideFootprint(footprint, nearPoint)).toBe(true);
  });

  it("returns nothing for a degenerate footprint of fewer than 3 corners", () => {
    expect(computeFloorMembraneBandPolygons({ corners: [], walls: [] }, { x: 0, y: 0 })).toEqual([]);
    expect(
      computeFloorMembraneBandPolygons(
        { corners: [{ id: "0", point: { x: 0, y: 0 } }, { id: "1", point: { x: 5, y: 5 } }], walls: [] },
        { x: 0, y: 0 },
      ),
    ).toEqual([]);
  });

  it("returns rings with no repeated closing point and consistent (CCW) winding", () => {
    const footprint = buildOctagonFootprint(40, 30);
    for (const piece of computeFloorMembraneBandPolygons(footprint, { x: 40, y: 15 })) {
      const first = piece.polygon[0]!;
      const last = piece.polygon[piece.polygon.length - 1]!;
      expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeGreaterThan(1e-6);
      let twice = 0;
      for (let i = 0; i < piece.polygon.length; i++) {
        const a = piece.polygon[i]!;
        const b = piece.polygon[(i + 1) % piece.polygon.length]!;
        twice += a.x * b.y - b.x * a.y;
      }
      expect(twice).toBeGreaterThan(0);
    }
  });
});
