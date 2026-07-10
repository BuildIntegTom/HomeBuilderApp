import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { insertBumpOut } from "./bumpOut";
import { panelSlotBoxes3D } from "./panelSlotBoxes3D";
import type { Footprint, PanelSlot } from "./types";

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

const THICKNESS_IN = 15.5;
const THICKNESS_FT = THICKNESS_IN / 12;

describe("panelSlotBoxes3D", () => {
  it("subdivides a wall's slots edge-to-edge along its length, anchored at the exterior face min-corner", () => {
    const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20)
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 120 }, // 10ft
      { type: "standard", widthIn: 120 }, // 10ft
      { type: "corner", widthIn: 120 }, // 10ft
    ];
    const boxes = panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const abBoxes = boxes.filter((b) => b.wallId === "AB");
    expect(abBoxes).toHaveLength(3);

    // Wall AB runs from (0,0) to (30,0) along +X, exterior face at z=0.
    expect(abBoxes[0]!.anchorX).toBeCloseTo(0, 6);
    expect(abBoxes[0]!.anchorZ).toBeCloseTo(0, 6);
    expect(abBoxes[0]!.widthFt).toBeCloseTo(10, 6);
    expect(abBoxes[1]!.anchorX).toBeCloseTo(10, 6);
    expect(abBoxes[2]!.anchorX).toBeCloseTo(20, 6);
    for (const b of abBoxes) {
      expect(b.rotationRad).toBeCloseTo(0, 6);
      expect(b.depthFt).toBeCloseTo(THICKNESS_FT, 6);
      expect(b.heightFt).toBe(10);
    }
  });

  it("anchors a rotated wall's slots at its own start corner and direction", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 120 }, // 10ft
      { type: "standard", widthIn: 120 }, // 10ft
    ];
    const boxes = panelSlotBoxes3D(fp, { BC: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const bcBoxes = boxes.filter((b) => b.wallId === "BC");
    // Wall BC runs from (30,0) to (30,20) along +Z.
    expect(bcBoxes[0]!.anchorX).toBeCloseTo(30, 6);
    expect(bcBoxes[0]!.anchorZ).toBeCloseTo(0, 6);
    expect(bcBoxes[1]!.anchorX).toBeCloseTo(30, 6);
    expect(bcBoxes[1]!.anchorZ).toBeCloseTo(10, 6);
    expect(bcBoxes[0]!.rotationRad).toBeCloseTo(Math.PI / 2, 6);
  });

  it("rescales slot widths to fit the wall's actual length when they don't sum exactly (defensive, shouldn't normally happen)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 120 },
      { type: "standard", widthIn: 120 },
    ]; // sums to 20ft, wall AB is 30ft
    const boxes = panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const total = boxes.reduce((sum, b) => sum + b.widthFt, 0);
    expect(total).toBeCloseTo(30, 6);
    expect(boxes[0]!.widthFt).toBeCloseTo(15, 6); // scaled up from 10 to 15
  });

  it("keeps a reflex-corner-extended wall's slots anchored at the true (unextended) start, extending past the far end", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped, primaryCornerIds } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // Wall "01" (A -> pa) is the original wall winning the reflex corner —
    // extended by THICKNESS_FT at its END (see wallBoxes3D.test.ts).
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
