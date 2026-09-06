import { describe, expect, it } from "vitest";
import { applyUniformPanelization } from "./uniformPanelization";
import type { PanelSlot } from "./types";

describe("applyUniformPanelization", () => {
  it("leaves corner/column/window/door slots untouched, in their original position", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      { type: "standard", widthIn: 40 },
      { type: "window", widthIn: 36 },
      { type: "standard", widthIn: 40 },
      { type: "corner", widthIn: 25.5 },
    ];
    const result = applyUniformPanelization(slots, "standard", 36);
    expect(result[0]).toEqual({ type: "corner", widthIn: 25.5 });
    expect(result.find((s) => s.type === "window")).toEqual({ type: "window", widthIn: 36 });
    expect(result[result.length - 1]).toEqual({ type: "corner", widthIn: 25.5 });
  });

  it("re-tiles a contiguous infill run (standard/braced) at the uniform width, leaving a safety-gap slot untouched as a fixed anchor", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      { type: "standard", widthIn: 40 },
      { type: "braced", widthIn: 40 },
      { type: "safety-gap", widthIn: 30 },
      { type: "corner", widthIn: 25.5 },
    ];
    // the safety-gap slot breaks the run in two (Tommy: "safety gaps should
    // be a part of each wall panelizing style" — it must survive every
    // panelization type, not just get absorbed into the uniform infill) —
    // only the standard+braced run (80in) before it gets re-tiled: tiled at
    // 36in -> round(80/36)=2 panels of 40in.
    const result = applyUniformPanelization(slots, "braced", 36);
    const infill = result.filter((s) => s.type === "braced");
    expect(infill).toHaveLength(2);
    for (const s of infill) expect(s.widthIn).toBeCloseTo(40, 6);
    expect(result.find((s) => s.type === "safety-gap")).toEqual({ type: "safety-gap", widthIn: 30 });
  });

  it("re-tiles at a fixed width for a square-bale-style call (all standard, e.g. 39in)", () => {
    const slots: PanelSlot[] = [{ type: "standard", widthIn: 78 }];
    const result = applyUniformPanelization(slots, "standard", 39);
    expect(result).toHaveLength(2);
    for (const s of result) {
      expect(s.type).toBe("standard");
      expect(s.widthIn).toBeCloseTo(39, 6);
    }
  });

  it("handles multiple separate infill runs independently (split by an opening)", () => {
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 72 },
      { type: "door", widthIn: 36 },
      { type: "standard", widthIn: 36 },
    ];
    const result = applyUniformPanelization(slots, "standard", 36);
    expect(result.filter((s) => s.type === "standard")).toHaveLength(3); // 2 from the first run + 1 from the second
    expect(result.find((s) => s.type === "door")).toBeDefined();
  });

  it("returns an empty array unchanged", () => {
    expect(applyUniformPanelization([], "standard", 36)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The 1/8in grid invariant, for the alternate panelization types (Timber Frame
// Curtain / Square Bale Panels). Same contract as tiling.ts's own sweep, and
// the same warning: the sum assertion compares INTEGER counts of eighths.
// `toBeCloseTo` would pass on exactly the defect this exists to catch.
// ---------------------------------------------------------------------------
describe("applyUniformPanelization on the 1/8in grid", () => {
  it("keeps every re-tiled slot a whole eighth, summing exactly to the wall it replaced", () => {
    const violations: string[] = [];
    // Square Bale's own 39in, Timber Frame Curtain's 36in, and the two catalog
    // range ends, against every eighth of infill run from 12in to 400in.
    for (const uniformWidthIn of [15.75, 36, 39, 48]) {
      for (let eighths = 12 * 8; eighths <= 400 * 8; eighths++) {
        const runWidthIn = eighths / 8;
        const slots: PanelSlot[] = [
          { type: "corner", widthIn: 25.5 },
          { type: "standard", widthIn: runWidthIn },
          { type: "safety-gap", widthIn: 0.75 },
          { type: "corner", widthIn: 25.5 },
        ];
        const wallEighths = slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0);
        const result = applyUniformPanelization(slots, "standard", uniformWidthIn);
        let sumEighths = 0;
        for (const slot of result) {
          if (Math.abs(slot.widthIn * 8 - Math.round(slot.widthIn * 8)) >= 1e-9) {
            violations.push(`${uniformWidthIn}/${runWidthIn}: ${slot.widthIn} is not a whole eighth`);
          }
          if (slot.widthIn < 0) violations.push(`${uniformWidthIn}/${runWidthIn}: ${slot.widthIn} is negative`);
          sumEighths += Math.round(slot.widthIn * 8);
        }
        if (sumEighths !== wallEighths) {
          violations.push(`${uniformWidthIn}/${runWidthIn}: sums to ${sumEighths} eighths, wall is ${wallEighths}`);
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("splits an odd-eighth run unevenly rather than landing on sixteenths", () => {
    // 47.125in (377 eighths) into 2: the pre-fix even split gave 23.5625 twice.
    const result = applyUniformPanelization([{ type: "standard", widthIn: 47.125 }], "standard", 23.5);
    expect(result.map((s) => s.widthIn)).toEqual([23.625, 23.5]);
  });
});
