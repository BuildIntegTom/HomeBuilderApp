import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { insertBumpOut } from "./bumpOut";
import { wallBoxes3D } from "./wallBoxes3D";
import type { Footprint } from "./types";

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

const THICKNESS_IN = 15.5;
const THICKNESS_FT = THICKNESS_IN / 12;

describe("wallBoxes3D", () => {
  it("produces one box per wall, with centers/lengths/rotations matching a plain rectangle by hand", () => {
    const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20), centroid (15,10)
    const boxes = wallBoxes3D(fp, THICKNESS_IN, 10, allPrimary(fp));
    expect(boxes).toHaveLength(4);

    // The footprint's corner points are the walls' EXTERIOR edge — each
    // box's thickness must extend inward (toward the centroid) from that
    // line, not straddle it (see the doc comment on wallBoxes3D for why
    // centering on the line instead is the wrong, corner-misaligning fix).
    const ab = boxes.find((b) => b.wallId === "AB")!; // exterior line at z=0, centroid is at z=10 (inward = +z)
    expect(ab.centerX).toBeCloseTo(15, 6);
    expect(ab.centerZ).toBeCloseTo(THICKNESS_FT / 2, 6);
    expect(ab.lengthFt).toBeCloseTo(30, 6);
    expect(ab.rotationRad).toBeCloseTo(0, 6); // runs along +X

    const bc = boxes.find((b) => b.wallId === "BC")!; // exterior line at x=30, centroid is at x=15 (inward = -x)
    expect(bc.centerX).toBeCloseTo(30 - THICKNESS_FT / 2, 6);
    expect(bc.centerZ).toBeCloseTo(10, 6);
    expect(bc.lengthFt).toBeCloseTo(20, 6);
    expect(bc.rotationRad).toBeCloseTo(Math.PI / 2, 6); // runs along +Z

    // Opposite walls (CD, DA) must shift inward toward each other too —
    // confirms "inward" resolves independently and correctly per wall,
    // all the way around the shape, not just for the first 2 walls checked.
    const cd = boxes.find((b) => b.wallId === "CD")!; // exterior line at z=20, inward = -z
    expect(cd.centerZ).toBeCloseTo(20 - THICKNESS_FT / 2, 6);
    const da = boxes.find((b) => b.wallId === "DA")!; // exterior line at x=0, inward = +x
    expect(da.centerX).toBeCloseTo(THICKNESS_FT / 2, 6);
  });

  it("converts thicknessIn to thicknessFt and applies the given height uniformly", () => {
    const fp = buildRectangleFootprint(30, 20);
    const boxes = wallBoxes3D(fp, 15.5, 9, allPrimary(fp));
    for (const box of boxes) {
      expect(box.thicknessFt).toBeCloseTo(15.5 / 12, 6);
      expect(box.heightFt).toBe(9);
    }
  });

  it("produces exactly one box per wall on a bump-out'd shape (no wall dropped or duplicated)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped, primaryCornerIds } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    const boxes = wallBoxes3D(bumped, 15.5, 10, primaryCornerIds);
    expect(boxes).toHaveLength(bumped.walls.length);
    expect(new Set(boxes.map((b) => b.wallId)).size).toBe(bumped.walls.length);
  });

  it("extends the ORIGINAL wall's length by thicknessFt at a bump-out's reflex (inside) corners, leaving the new jog wall's own length untouched — closes the gap the 2D corner-ownership rule already exists to fix", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped, primaryCornerIds } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // corners: A(0) pa(1) paOut(2) pbOut(3) pb(4) B(5) C(6) D(7)
    // walls: 01 (A-pa, original, 10ft) 12 (pa-paOut, jog, 5ft) ...
    //        34 (pbOut-pb, jog, 5ft) 45 (pb-B, original, 15ft)
    const boxes = wallBoxes3D(bumped, THICKNESS_IN, 10, primaryCornerIds);
    const byId = Object.fromEntries(boxes.map((b) => [b.wallId, b]));

    // Reflex corner at "1": wall "01" has a primary endpoint (A), wall
    // "12" doesn't (neither pa nor paOut is primary) — "01" wins.
    expect(byId["01"]!.lengthFt).toBeCloseTo(10 + THICKNESS_FT, 6);
    expect(byId["12"]!.lengthFt).toBeCloseTo(5, 6);

    // Reflex corner at "4": wall "45" has a primary endpoint (B), wall
    // "34" doesn't — "45" wins instead, symmetrically.
    expect(byId["45"]!.lengthFt).toBeCloseTo(15 + THICKNESS_FT, 6);
    expect(byId["34"]!.lengthFt).toBeCloseTo(5, 6);

    // Every convex (outside) corner's walls keep their own original length
    // — only the 2 reflex corners get an extension.
    expect(byId["23"]!.lengthFt).toBeCloseTo(5, 6);
    expect(byId["56"]!.lengthFt).toBeCloseTo(20, 6);
    expect(byId["67"]!.lengthFt).toBeCloseTo(30, 6);
    expect(byId["70"]!.lengthFt).toBeCloseTo(20, 6);
  });
});
