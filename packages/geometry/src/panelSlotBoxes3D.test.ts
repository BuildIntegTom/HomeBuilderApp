import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { insertBumpOut } from "./bumpOut";
import { panelSlotBoxes3D } from "./panelSlotBoxes3D";
import type { Footprint, PanelSlot } from "./types";

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

const THICKNESS_IN = 15.5;
const THICKNESS_FT = THICKNESS_IN / 12;

describe("panelSlotBoxes3D", () => {
  it("insets a wall's tiling by thicknessIn at each end it loses a plain convex corner to a LONGER perpendicular wall (regression: 'long wall's panels spaced out' bug)", () => {
    // Rectangle 30x20: BC(20ft) is the SHORTER wall at both its corners
    // (vs. AB=30ft and CD=30ft), so it loses both — tiled thicknessIn
    // shorter at each end, same as retile()'s own cornerOwnership() rule.
    //
    // ⚠ **The wall under test moved from AB to BC on 2026-10-01**, when Tommy
    // inverted the rule: the LONGER wall now runs through and owns the corner.
    // The 3D behaviour under test — a wall that loses a corner is inset, and its
    // panels are not stretched back out to the raw wall length — is unchanged.
    const fp = buildRectangleFootprint(30, 20);
    const adjustedLengthIn = 20 * 12 - THICKNESS_IN * 2; // 209in
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: adjustedLengthIn / 2 },
      { type: "standard", widthIn: adjustedLengthIn / 2 },
    ];
    const boxes = panelSlotBoxes3D(fp, { BC: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const bcBoxes = boxes.filter((b) => b.wallId === "BC");

    // BC runs B(30,0) -> C(30,20) along +Z. Starts inset from B's true exterior
    // corner by thicknessFt, not flush with it — the LONGER perpendicular wall
    // owns that corner.
    expect(bcBoxes[0]!.anchorX).toBeCloseTo(30, 6);
    expect(bcBoxes[0]!.anchorZ).toBeCloseTo(THICKNESS_FT, 6);

    // No rescale distortion: each slot's rendered width matches its
    // nominal widthIn/12 exactly, since they already sum to the adjusted
    // (inset) length rather than the raw 20ft.
    expect(bcBoxes[0]!.widthFt).toBeCloseTo(adjustedLengthIn / 2 / 12, 6);
    expect(bcBoxes[1]!.widthFt).toBeCloseTo(adjustedLengthIn / 2 / 12, 6);

    const totalWidthFt = bcBoxes.reduce((sum, b) => sum + b.widthFt, 0);
    expect(totalWidthFt).toBeCloseTo(adjustedLengthIn / 12, 6);
    expect(totalWidthFt).toBeLessThan(20);
  });

  it("anchors a wall that OWNS both its corners (the LONGER of each pair) flush with its true endpoints, no inset", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 180 }, // 15ft
      { type: "standard", widthIn: 180 }, // 15ft
    ];
    const boxes = panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const abBoxes = boxes.filter((b) => b.wallId === "AB");
    // Wall AB runs from (0,0) to (30,0) along +X; AB (30ft) is LONGER than both
    // BC and DA (20ft each), so it runs through and owns both its corners.
    // (This was BC's test until 2026-10-01 inverted the rule.)
    expect(abBoxes[0]!.anchorX).toBeCloseTo(0, 6);
    expect(abBoxes[0]!.anchorZ).toBeCloseTo(0, 6);
    expect(abBoxes[1]!.anchorX).toBeCloseTo(15, 6);
    expect(abBoxes[1]!.anchorZ).toBeCloseTo(0, 6);
    expect(abBoxes[0]!.rotationRad).toBeCloseTo(0, 6);
    for (const b of abBoxes) {
      expect(b.depthFt).toBeCloseTo(THICKNESS_FT, 6);
      expect(b.heightFt).toBe(10);
    }
  });

  it("rescales slot widths to fit the wall's actual corner-adjusted length when they don't sum exactly (defensive, shouldn't normally happen)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 100 },
      { type: "standard", widthIn: 100 },
    ]; // sums to 200in; BC's real corner-adjusted length is 209in, not the raw 240in
    const boxes = panelSlotBoxes3D(fp, { BC: slots }, THICKNESS_IN, 10, allPrimary(fp));
    const adjustedLengthIn = 20 * 12 - THICKNESS_IN * 2;
    const total = boxes.reduce((sum, b) => sum + b.widthFt, 0);
    expect(total).toBeCloseTo(adjustedLengthIn / 12, 6);
    expect(boxes[0]!.widthFt).toBeCloseTo((100 * (adjustedLengthIn / 200)) / 12, 6);
  });

  it("keeps a reflex-corner-extended wall's slots anchored at the true (unextended) start, extending past the far end", () => {
    // 30x10 with the bump-out span at 15..20ft, so wall "01" (A -> pa) is 15ft
    // and therefore LONGER than "70"/DA (10ft): it wins the convex corner at "0"
    // and is not inset there. ⚠ Was 30x20 with the span at 10..15ft, which held
    // under the old shorter-wall rule and does not under the new one. The reflex
    // behaviour under test is unchanged either way.
    const fp = buildRectangleFootprint(30, 10);
    const { footprint: bumped, primaryCornerIds } = insertBumpOut(fp, "AB", 15, 20, 5, allPrimary(fp));
    // Wall "01" also wins the reflex corner at "1" (extended by
    // THICKNESS_FT at its end — see wallBoxes3D.test.ts).
    const extendedLengthIn = (15 + THICKNESS_FT) * 12;
    const slots: PanelSlot[] = [{ type: "standard", widthIn: extendedLengthIn }];
    const boxes = panelSlotBoxes3D(bumped, { "01": slots }, THICKNESS_IN, 10, primaryCornerIds);
    const box01 = boxes.find((b) => b.wallId === "01")!;
    expect(box01.anchorX).toBeCloseTo(0, 6); // still starts at A's true corner
    expect(box01.anchorZ).toBeCloseTo(0, 6);
    expect(box01.widthFt).toBeCloseTo(15 + THICKNESS_FT, 6);
  });

  it("produces zero boxes for a wall with no slots recorded", () => {
    const fp = buildRectangleFootprint(30, 20);
    const boxes = panelSlotBoxes3D(fp, {}, THICKNESS_IN, 10, allPrimary(fp));
    expect(boxes).toHaveLength(0);
  });

  /**
   * Stage 3's 3D trap, tested directly. The defensive rescale in this
   * function exists to absorb float slop; a stopped wall's slots
   * deliberately sum to LESS than its full tiled length, and without the
   * stops passed in that shortfall is read as slop and every panel on the
   * wall is stretched to fill it — drawing a solid wall exactly where the
   * plan says to draw nothing.
   */
  describe("run stops — draw nothing on the unbuilt span", () => {
    // AB is the 30ft wall of a 30x20 rectangle: it WINS both its corners (the
    // longer wall runs through, 2026-10-01), so its tiling length is its raw
    // length and the arithmetic below is clean. ⚠ This was BC under the old
    // shorter-wall rule; the stop behaviour under test is unchanged.
    const fp = buildRectangleFootprint(30, 20);
    const fullLengthIn = 30 * 12;

    it("shifts the run's start and keeps every panel at its own width", () => {
      const stopIn = 60;
      const slots: PanelSlot[] = [
        { type: "standard", widthIn: 150 },
        { type: "standard", widthIn: 150 },
      ];
      expect(slots.reduce((s, x) => s + x.widthIn, 0)).toBe(fullLengthIn - stopIn);
      const boxes = panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp), {
        AB: { startStopIn: stopIn, endStopIn: 0 },
      }).filter((b) => b.wallId === "AB");
      // NOT stretched: 150in stays 12.5ft. Without the stops these would each
      // come back 180in wide.
      expect(boxes.map((b) => b.widthFt)).toEqual([12.5, 12.5]);
      // AB runs A(0,0) -> B(30,0), i.e. along +X, so the stop moves the
      // first box 5ft down the wall.
      expect(boxes[0]!.anchorX).toBeCloseTo(stopIn / 12, 6);
    });

    it("draws nothing at all for a fully stopped wall", () => {
      const boxes = panelSlotBoxes3D(fp, { AB: [] }, THICKNESS_IN, 10, allPrimary(fp), {
        AB: { startStopIn: fullLengthIn, endStopIn: 0 },
      });
      expect(boxes.filter((b) => b.wallId === "AB")).toHaveLength(0);
      // ...and every other wall is untouched.
      expect(boxes.filter((b) => b.wallId !== "AB")).toHaveLength(0); // no slots supplied for them either
    });

    it("an absent or empty stop map is byte-identical to today", () => {
      const slots: PanelSlot[] = [
        { type: "standard", widthIn: 120 },
        { type: "standard", widthIn: 120 },
      ];
      const withNothing = panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp));
      expect(JSON.stringify(panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp), {}))).toBe(
        JSON.stringify(withNothing),
      );
      expect(
        JSON.stringify(
          panelSlotBoxes3D(fp, { AB: slots }, THICKNESS_IN, 10, allPrimary(fp), {
            AB: { startStopIn: 0, endStopIn: 0 },
          }),
        ),
      ).toBe(JSON.stringify(withNothing));
    });
  });
});
