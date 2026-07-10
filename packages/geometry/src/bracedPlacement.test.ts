import { describe, expect, it } from "vitest";
import { SAFETY_PLYWOOD_BUFFER_IN, applyBracedPlacement, setWindowWidth } from "./bracedPlacement";
import { tileWall } from "./tiling";
import type { PanelSlot } from "./types";

describe("applyBracedPlacement", () => {
  it("places exactly 1 braced panel touching each corner, then periodic braced panels every `spacing` along the plain run", () => {
    // 480 wall, 48in standard, 24in corners: middle=432, divides evenly into
    // 9x48 with 0 remainder (<2ft) -> borrows+splits the corner-touching
    // standard with the gap panel (24/24); gapEnd 'end' puts gap
    // second-to-last, corner-touching standard last (before the corner).
    const { slots } = tileWall(480, 48, 24, "end");
    const result = applyBracedPlacement(slots, 96 /* 8ft high-seismic spacing */, 48);
    expect(result.map((s) => s.type)).toEqual([
      "corner",
      "braced", // touches the start corner
      "standard",
      "braced", // periodic
      "standard",
      "braced", // periodic
      "standard",
      "braced", // periodic
      "standard",
      "safety-gap", // second-to-last
      "braced", // touches the end corner (the resized corner-touching standard)
      "corner",
    ]);
  });

  it("no longer auto-flanks windows (Tommy: dropped that rule) — only corner-touching and periodic bracing apply", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "window", widthIn: 36 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: 24 },
    ];
    // huge spacing so periodic bracing never fires, isolating window behavior
    const result = applyBracedPlacement(slots, 100_000, 48);
    expect(result.map((s) => s.type)).toEqual([
      "corner",
      "braced", // touches start corner (rule 1)
      "standard",
      "standard",
      "window", // untouched — no more flanking
      "standard",
      "standard",
      "braced", // touches end corner (rule 1)
      "corner",
    ]);
  });

  it("doesn't flank doors either (never did, still doesn't)", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "door", widthIn: 36 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: 24 },
    ];
    const result = applyBracedPlacement(slots, 100_000, 48);
    // only 1 braced per corner now = 2 total, everything else including the
    // standards adjacent to the door stays untouched
    expect(result.map((s) => s.type)).toEqual([
      "corner",
      "braced",
      "standard",
      "door",
      "standard",
      "braced",
      "corner",
    ]);
  });

  it("shifts a periodic brace to the next standard panel when it would've landed on a window (Tommy: don't drop the shear count)", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "window", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: 24 },
    ];
    // spacing=96: rule 1 braces index1 (start) and index5 (end) first.
    // Periodic distance then accumulates 48 (index2) + 48 (the window,
    // which still occupies wall length) = 96 exactly AT the window — but a
    // window can't be braced, so the requirement carries forward instead of
    // resetting, and gets picked up by the very next standard (index4).
    const result = applyBracedPlacement(slots, 96, 48);
    expect(result.map((s) => s.type)).toEqual([
      "corner",
      "braced", // rule 1, start corner
      "standard",
      "window", // untouched — can't be braced
      "braced", // periodic brace shifted here instead of being dropped
      "braced", // rule 1, end corner
      "corner",
    ]);
  });

  it("gracefully handles a wall too short for a corner brace on each side (both ends combine/brace here, since the safety-gap slot is itself brace-eligible)", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 48 },
      { type: "safety-gap", widthIn: 47.25 },
      { type: "corner", widthIn: 24 },
    ];
    const result = applyBracedPlacement(slots, 96, 48);
    // Start-corner walk claims the one standard slot. End-corner walk then
    // finds the safety-gap slot itself eligible and combines it, rather
    // than finding nothing (the old behavior, back when only "standard"
    // slots counted).
    expect(result.map((s) => s.type)).toEqual(["corner", "braced", "safety-gap", "corner"]);
    expect(result[2]!.secondaryType).toBe("braced");
  });

  describe("combining a safety-gap slot with a corner brace", () => {
    it("fixed-widths the combined slot to standardWidthIn + the plywood buffer, shedding the difference to the nearest standard panel", () => {
      const slots: PanelSlot[] = [
        { type: "corner", widthIn: 24 },
        { type: "safety-gap", widthIn: 60 }, // sits right at the corner
        { type: "standard", widthIn: 40 },
        { type: "standard", widthIn: 40 },
        { type: "corner", widthIn: 24 },
      ];
      const result = applyBracedPlacement(slots, 100_000, 40);
      expect(result[1]).toEqual({ type: "safety-gap", secondaryType: "braced", widthIn: 40 + SAFETY_PLYWOOD_BUFFER_IN });
      // 60 - 40.75 = 19.25 shed onto the nearest standard panel (index 2,
      // continuing inward from the corner — the walk's own direction).
      expect(result[2]).toEqual({ type: "standard", widthIn: 40 + 19.25 });
      // The end-corner walk independently claims the last standard slot
      // (index 3) for its own rule-1 brace, same as always.
      expect(result[3]).toEqual({ type: "braced", widthIn: 40 });
    });

    it("combines independently at each end when both ends have a corner-touching safety-gap slot", () => {
      const slots: PanelSlot[] = [
        { type: "corner", widthIn: 24 },
        { type: "safety-gap", widthIn: 50 },
        { type: "standard", widthIn: 40 },
        { type: "safety-gap", widthIn: 50 },
        { type: "corner", widthIn: 24 },
      ];
      const result = applyBracedPlacement(slots, 100_000, 40);
      expect(result[1]!.type).toBe("safety-gap");
      expect(result[1]!.secondaryType).toBe("braced");
      expect(result[1]!.widthIn).toBeCloseTo(40.75, 6);
      expect(result[3]!.type).toBe("safety-gap");
      expect(result[3]!.secondaryType).toBe("braced");
      expect(result[3]!.widthIn).toBeCloseTo(40.75, 6);
      // Both combined slots shed onto the same lone standard panel between them.
      expect(result[2]!.widthIn).toBeCloseTo(40 + (50 - 40.75) * 2, 6);
    });

    it("still applies periodic (rule 2) bracing on top of an existing combined corner slot, treating it as a real brace reset point", () => {
      const slots: PanelSlot[] = [
        { type: "corner", widthIn: 24 },
        // Exactly standardWidthIn + buffer already, so it combines with
        // zero shed delta — keeps this test isolated to rule 2's behavior.
        { type: "safety-gap", widthIn: 40 + SAFETY_PLYWOOD_BUFFER_IN },
        { type: "standard", widthIn: 40 },
        { type: "standard", widthIn: 40 },
        { type: "standard", widthIn: 40 },
        { type: "corner", widthIn: 24 },
      ];
      // spacing=80: after rule 1 combines index1, cumulative distance
      // resets there (secondaryType braced) and accumulates again from
      // index2 onward: 40 (idx2) + 40 (idx3) = 80 -> idx3 becomes braced.
      const result = applyBracedPlacement(slots, 80, 40);
      expect(result[1]!.secondaryType).toBe("braced");
      expect(result[1]!.widthIn).toBeCloseTo(40 + SAFETY_PLYWOOD_BUFFER_IN, 6);
      expect(result[2]!.type).toBe("standard");
      expect(result[2]!.widthIn).toBeCloseTo(40, 6);
      expect(result[3]!.type).toBe("braced");
    });
  });
});

describe("setWindowWidth", () => {
  it("updates only the targeted window slot's width", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "window", widthIn: 36 },
      { type: "corner", widthIn: 24 },
    ];
    const result = setWindowWidth(slots, 1, 60);
    expect(result[1]).toEqual({ type: "window", widthIn: 60 });
    expect(result[0]).toEqual(slots[0]);
  });

  it("is a no-op on a non-window slot", () => {
    const slots: PanelSlot[] = [{ type: "standard", widthIn: 48 }];
    const result = setWindowWidth(slots, 0, 60);
    expect(result[0]!.widthIn).toBe(48);
  });
});
