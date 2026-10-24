import { describe, expect, it } from "vitest";
import { deckPanelPlacements } from "./deckPanelPlacement";
import { footprintSpanAndRun } from "./joistLayout";
import type { Footprint } from "./types";

/** A plain rectangle, widthFt along X and depthFt along Y. */
function rect(widthFt: number, depthFt: number): Footprint {
  const pts = [
    { x: 0, y: 0 },
    { x: widthFt, y: 0 },
    { x: widthFt, y: depthFt },
    { x: 0, y: depthFt },
  ];
  return {
    corners: pts.map((point, i) => ({ id: `c${i}`, point })),
    walls: pts.map((_, i) => ({
      id: `w${i}`,
      startCorner: `c${i}`,
      endCorner: `c${(i + 1) % pts.length}`,
    })),
  } as Footprint;
}

describe("placing a deck's panels on a building", () => {
  it("panels repeat along the LONGER side and span the shorter", () => {
    /* The same rule the joist layout uses. If these two ever disagree, a
       building's joists and its floor panels get drawn at right angles to
       each other. */
    const wide = rect(40, 25);
    expect(footprintSpanAndRun(wide).axis).toBe("y");
    const r = deckPanelPlacements(wide, [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24]);
    expect(r.refusal).toBeNull();
    expect(r.spanIn).toBe(300);
    expect(r.runIn).toBe(480);
    // Run along X, so each panel steps 2ft in X and shares one Z.
    expect(r.placements[0]!.anchorX).toBe(0);
    expect(r.placements[1]!.anchorX).toBe(2);
    expect(new Set(r.placements.map((p) => p.anchorZ))).toEqual(new Set([0]));
    expect(new Set(r.placements.map((p) => p.rotationRad))).toEqual(new Set([0]));
  });

  it("⚠ a tall building runs the other way, and yaws to suit", () => {
    const tall = rect(25, 40);
    expect(footprintSpanAndRun(tall).axis).toBe("x");
    const r = deckPanelPlacements(tall, Array.from({ length: 20 }, () => 24));
    expect(r.spanIn).toBe(300);
    expect(r.runIn).toBe(480);
    // Run along Y now, with the anchor on the far X edge because the yaw
    // puts the span on -X.
    expect(r.placements[0]!.anchorZ).toBe(0);
    expect(r.placements[1]!.anchorZ).toBe(2);
    expect(new Set(r.placements.map((p) => p.anchorX))).toEqual(new Set([25]));
    // The view applies this as -rotationRad, so +90 here yaws it -90 there.
    expect(r.placements[0]!.rotationRad).toBeCloseTo(Math.PI / 2, 12);
  });

  it("each panel's position is where the ones before it end", () => {
    const widths = [15.5, 24, 24, 24, 15.5];
    const r = deckPanelPlacements(rect(103 / 12, 6), widths);
    let at = 0;
    for (const p of r.placements) {
      expect({ i: p.index, atIn: p.atIn }).toEqual({ i: p.index, atIn: at });
      at += p.widthIn;
    }
  });

  it("⚠ refuses panels that do not add up to the run", () => {
    /* His dimensional-tightness rule, at the point where it would show as a
       deck visibly short of its own walls in the 3D view. */
    const r = deckPanelPlacements(rect(40, 25), [24, 24]);
    expect(r.placements).toEqual([]);
    expect(r.refusal).toContain("does not reach its own walls");
    expect(r.refusal).toContain("480");
  });

  it("refuses an empty deck rather than drawing nothing silently", () => {
    expect(deckPanelPlacements(rect(40, 25), []).refusal).toContain("No panels");
  });

  it("every panel carries the same span, because every one reaches both walls", () => {
    const r = deckPanelPlacements(rect(40, 25), Array.from({ length: 20 }, () => 24));
    for (const p of r.placements) expect(p.spanIn).toBe(r.spanIn);
  });
});
