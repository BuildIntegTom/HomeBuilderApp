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

  it("re-tiles a contiguous infill run (standard/braced/safety-gap) at the uniform width", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      { type: "standard", widthIn: 40 },
      { type: "braced", widthIn: 40 },
      { type: "safety-gap", widthIn: 30 },
      { type: "corner", widthIn: 25.5 },
    ];
    // total infill run = 110in, tiled at 36in -> round(110/36)=3 panels of 36.667in
    const result = applyUniformPanelization(slots, "braced", 36);
    const infill = result.filter((s) => s.type === "braced");
    expect(infill).toHaveLength(3);
    for (const s of infill) expect(s.widthIn).toBeCloseTo(110 / 3, 6);
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
