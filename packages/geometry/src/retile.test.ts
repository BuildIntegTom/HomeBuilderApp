import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import { cornerOwnership, gapEndFor, isMiteredShape, retile, wallGeometryFor } from "./retile";
import type { Footprint } from "./types";

const THICKNESS_IN = 15.5;
const STANDARD_WIDTH_IN = 40;
const CORNER_PANEL_WIDTH_IN = 24;
const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

describe("isMiteredShape", () => {
  it("is false for a rectangle and true for an octagon", () => {
    expect(isMiteredShape(buildRectangleFootprint(30, 20))).toBe(false);
    expect(isMiteredShape(buildOctagonFootprint(30, 20))).toBe(true);
  });
});

describe("gapEndFor", () => {
  it("uses the least-accessible-corner rule on a rectangle", () => {
    const fp = buildRectangleFootprint(30, 20);
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    // A=(0,0), B=(30,0); least-accessible "A" is closer to start, so the
    // gap goes at the far ("end") side.
    expect(gapEndFor(fp, wallAB, "A")).toBe("end");
  });

  it("uses the per-wall safety-corner rule on an octagon (ignores the passed corner id)", () => {
    const fp = buildOctagonFootprint(30, 20);
    const wall = fp.walls.find((w) => w.id === "01")!;
    // Same result regardless of the (irrelevant, for a mitered shape) 2nd arg.
    expect(gapEndFor(fp, wall, "0")).toBe(gapEndFor(fp, wall, "4"));
  });
});

describe("cornerOwnership", () => {
  it("gives every corner of a plain rectangle to the (tied) shorter-or-lower-id wall", () => {
    const fp = buildRectangleFootprint(30, 20);
    const ownership = cornerOwnership(fp, allPrimary(fp), THICKNESS_IN);
    // AB (30ft) meets BC (20ft) at B: BC is shorter, so BC wins (owns its
    // own start corner), AB insets by thicknessIn at its end.
    expect(ownership["AB"]!.end).toEqual({ hasCorner: false, insetAmount: THICKNESS_IN, extraLengthIn: 0 });
    expect(ownership["BC"]!.start).toEqual({ hasCorner: true, insetAmount: 0, extraLengthIn: 0 });
  });

  it("matches the pixel-verified reflex-corner rule on a bump-out'd shape", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped, primaryCornerIds } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // corners: A(0), pa(1), paOut(2), pbOut(3), pb(4), B(5), C(6), D(7).
    // Reflex corner at "1" (pa): wall "0-1" (original, has a primary
    // endpoint) must win and extend by thicknessIn; wall "1-2" (new jog)
    // must NOT inset at all (see retile.ts's doc comment for why a flat
    // inset leaves a real gap here — this was originally caught by direct
    // pixel measurement in the browser).
    const ownership = cornerOwnership(bumped, primaryCornerIds, THICKNESS_IN);
    expect(ownership["01"]!.end).toEqual({ hasCorner: true, insetAmount: 0, extraLengthIn: THICKNESS_IN });
    expect(ownership["12"]!.start).toEqual({ hasCorner: false, insetAmount: 0, extraLengthIn: 0 });
  });
});

describe("retile", () => {
  it("produces corner-owning slots at both ends of every wall on a plain rectangle", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots = retile(fp, "A", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN);
    for (const wall of fp.walls) {
      expect(slots[wall.id]).toBeDefined();
      expect(slots[wall.id]!.length).toBeGreaterThan(0);
    }
  });

  it("marks a safety-oct-corner slot on every wall of an octagon", () => {
    const fp = buildOctagonFootprint(30, 20);
    const slots = retile(fp, "0", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN);
    for (const wall of fp.walls) {
      expect(slots[wall.id]!.some((s) => s.type === "safety-oct-corner")).toBe(true);
    }
  });
});

describe("wallGeometryFor", () => {
  it("returns geometry for an existing wall and null for a nonexistent one", () => {
    const fp = buildRectangleFootprint(30, 20);
    const geometry = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN);
    expect(geometry).not.toBeNull();
    // AB is the longer wall at both corners (DA=20ft wins at A, BC=20ft
    // wins at B), so it insets by thicknessIn at both ends.
    expect(geometry!.lengthIn).toBeCloseTo(30 * 12 - 2 * THICKNESS_IN, 6);
    expect(geometry!.allowBorrow).toBe(true);

    expect(wallGeometryFor(fp, "nonexistent", allPrimary(fp), "A", THICKNESS_IN)).toBeNull();
  });

  it("disallows borrowing on a mitered (octagon) shape", () => {
    const fp = buildOctagonFootprint(30, 20);
    const geometry = wallGeometryFor(fp, "01", allPrimary(fp), "0", THICKNESS_IN);
    expect(geometry!.allowBorrow).toBe(false);
  });
});
