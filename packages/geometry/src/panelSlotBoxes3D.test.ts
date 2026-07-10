import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { insertBumpOut } from "./bumpOut";
import { panelSlotBoxes3D } from "./panelSlotBoxes3D";
import type { Footprint, PanelSlot } from "./types";

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

const THICKNESS_IN = 15.5;
const THICKNESS_FT = THICKNESS_IN / 12;

describe("panelSlotBoxes3D", () => {
  it("insets a wall's tiling by thicknessIn at each end it loses a plain convex corner to a shorter perpendicular wall (regression: 'long wall's panels spaced out' bug)", () => {
    // Rectangle 30x20: AB(30ft) is the LONGER wall at both its corners
    // (vs. BC=20ft and DA=20ft), so it loses both — tiled thicknessIn
    // shorter at each end, same as retile()'s own cornerOwnership() rule.
    const fp = buildRectangleFootprint(30, 20);
    const adjustedLengthIn = 30 * 12 - THICKNESS_IN * 2; // 329in
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: adjustedLengthIn / 2 },
      { type: "standard", widthIn: adjustedLengthIn / 2 },
    ];
    const boxes = panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const abBoxes = boxes.filter((b) => b.wallId === "AB");

    // Starts inset from A's true exterior corner (0,0) by thicknessFt, not
    // flush with it — the shorter perpendicular wall owns that corner.
    expect(abBoxes[0]!.anchorX).toBeCloseTo(THICKNESS_FT, 6);
    expect(abBoxes[0]!.anchorZ).toBeCloseTo(0, 6);

    // No rescale distortion: each slot's rendered width matches its
    // nominal widthIn/12 exactly, since they already sum to the adjusted
    // (inset) length rather than the raw 30ft.
    expect(abBoxes[0]!.widthFt).toBeCloseTo(adjustedLengthIn / 2 / 12, 6);
    expect(abBoxes[1]!.widthFt).toBeCloseTo(adjustedLengthIn / 2 / 12, 6);

    const totalWidthFt = abBoxes.reduce((sum, b) => sum + b.widthFt, 0);
    expect(totalWidthFt).toBeCloseTo(adjustedLengthIn / 12, 6);
    expect(totalWidthFt).toBeLessThan(30);
  });

  it("anchors a wall that OWNS both its corners (the shorter of each pair) flush with its true endpoints, no inset", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 120 }, // 10ft
      { type: "standard", widthIn: 120 }, // 10ft
    ];
    const boxes = panelSlotBoxes3D(fp, { BC: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const bcBoxes = boxes.filter((b) => b.wallId === "BC");
    // Wall BC runs from (30,0) to (30,20) along +Z; BC (20ft) is shorter
    // than both AB and CD (30ft each), so it owns both its corners.
    expect(bcBoxes[0]!.anchorX).toBeCloseTo(30, 6);
    expect(bcBoxes[0]!.anchorZ).toBeCloseTo(0, 6);
    expect(bcBoxes[1]!.anchorX).toBeCloseTo(30, 6);
    expect(bcBoxes[1]!.anchorZ).toBeCloseTo(10, 6);
    expect(bcBoxes[0]!.rotationRad).toBeCloseTo(Math.PI / 2, 6);
    for (const b of bcBoxes) {
      expect(b.depthFt).toBeCloseTo(THICKNESS_FT, 6);
      expect(b.heightFt).toBe(10);
    }
  });

  it("rescales slot widths to fit the wall's actual corner-adjusted length when they don't sum exactly (defensive, shouldn't normally happen)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 120 },
      { type: "standard", widthIn: 120 },
    ]; // sums to 240in; AB's real corner-adjusted length is 329in, not the raw 360in
    const boxes = panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const adjustedLengthIn = 30 * 12 - THICKNESS_IN * 2;
    const total = boxes.reduce((sum, b) => sum + b.widthFt, 0);
    expect(total).toBeCloseTo(adjustedLengthIn / 12, 6);
    expect(boxes[0]!.widthFt).toBeCloseTo((120 * (adjustedLengthIn / 240)) / 12, 6);
  });

  it("keeps a reflex-corner-extended wall's slots anchored at the true (unextended) start, extending past the far end", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped, primaryCornerIds } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // Wall "01" (A -> pa) wins the corner at "0" (shorter than "70"/DA, so
    // no inset there) and wins the reflex corner at "1" (extended by
    // THICKNESS_FT at its end — see wallBoxes3D.test.ts).
    const extendedLengthIn = (10 + THICKNESS_FT) * 12;
    const slots: PanelSlot[] = [{ type: "standard", widthIn: extendedLengthIn }];
    const boxes = panelSlotBoxes3D(bumped, { "01": slots }, THICKNESS_IN, 10, primaryCornerIds);
    const box01 = boxes.find((b) => b.wallId === "01")!;
    expect(box01.anchorX).toBeCloseTo(0, 6); // still starts at A's true corner
    expect(box01.anchorZ).toBeCloseTo(0, 6);
    expect(box01.widthFt).toBeCloseTo(10 + THICKNESS_FT, 6);
  });

  it("produces zero boxes for a wall with no slots recorded", () => {
    const fp = buildRectangleFootprint(30, 20);
    const boxes = panelSlotBoxes3D(fp, {}, THICKNESS_IN, 10, allPrimary(fp));
    expect(boxes).toHaveLength(0);
  });
});
