import { describe, expect, it } from "vitest";
import { SAFETY_PLYWOOD_BUFFER_IN, applyBracedPlacement, reconcileBracedPlacement, setWindowWidth } from "./bracedPlacement";
import { tileWall } from "./tiling";
import type { PanelSlot } from "./types";

describe("applyBracedPlacement", () => {
  it("places exactly 1 braced panel touching each corner, then periodic braced panels every `spacing` along the plain run, stamped with the default pattern/mirror", () => {
    // 480 wall, 48in standard, 24in corners: middle=432, minus the fixed
    // 3/4in gap leaves 431.25 for standards -> 8 fit (384) with a 47.25
    // remainder, split into 2 panels of 47.625 each next to the gap
    // (capped-width tiling, see tiling.test.ts); gapEnd 'end' puts the gap
    // second-to-last, corner-touching standard last.
    const { slots } = tileWall(480, 48, 24, "end");
    const result = applyBracedPlacement(slots, 96 /* 8ft high-seismic spacing */, 48, "chevron", false);
    expect(result.map((s) => s.type)).toEqual([
      "corner",
      "braced", // touches the start corner
      "standard",
      "braced", // periodic
      "standard",
      "braced", // periodic
      "standard",
      "standard", // 1st of the 2 split panels — cumulative lands at 95.625, just under 96
      "braced", // 2nd of the 2 split panels — periodic (cumulative crosses 96 here)
      "safety-gap", // second-to-last, fixed 3/4in
      "braced", // touches the end corner (the corner-touching standard)
      "corner",
    ]);
    for (const s of result) {
      if (s.type !== "braced") continue;
      expect(s.bracedPattern).toBe("chevron");
      expect(s.bracedMirrored).toBe(false);
    }
  });

  it("stamps every newly-promoted slot with whatever default pattern/mirror is passed in", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: 24 },
    ];
    const result = applyBracedPlacement(slots, 100_000, 48, "hatch", true);
    expect(result[1]!.type).toBe("braced");
    expect(result[1]!.bracedPattern).toBe("hatch");
    expect(result[1]!.bracedMirrored).toBe(true);
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
    const result = applyBracedPlacement(slots, 100_000, 48, "chevron", false);
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
    const result = applyBracedPlacement(slots, 100_000, 48, "chevron", false);
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
    const result = applyBracedPlacement(slots, 96, 48, "chevron", false);
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
    const result = applyBracedPlacement(slots, 96, 48, "chevron", false);
    // Start-corner walk claims the one standard slot. End-corner walk then
    // finds the safety-gap slot itself eligible and combines it, rather
    // than finding nothing (the old behavior, back when only "standard"
    // slots counted).
    expect(result.map((s) => s.type)).toEqual(["corner", "braced", "safety-gap", "corner"]);
    expect(result[2]!.secondaryType).toBe("braced");
  });

  it("a slot that's already braced satisfies the corner requirement without the walk searching further inward for a second one", () => {
    // eligibleIndices is an empty set (nothing is eligible for promotion),
    // isolating this to: does an already-braced slot register as
    // "satisfied" via its own type, independent of eligibility at all?
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "braced", widthIn: 48, bracedPattern: "hatch", bracedMirrored: true },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: 24 },
    ];
    const result = applyBracedPlacement(slots, 100_000, 48, "chevron", false, new Set());
    // The already-braced slot is left completely untouched (own pattern
    // preserved) — satisfies the start corner without needing eligibility.
    expect(result[1]).toEqual({ type: "braced", widthIn: 48, bracedPattern: "hatch", bracedMirrored: true });
    // The end corner's own independent walk finds the plain standard slot
    // but can't promote it (not eligible) — stays untouched.
    expect(result[2]!.type).toBe("standard");
  });

  it("a LOCKED standard slot (excluded from eligibleIndices) stops the corner walk instead of reaching past it for an eligible one further in", () => {
    // Only 1 corner is actually being tested here (the start) — the far
    // end is pre-satisfied with an already-braced slot so its own
    // independent walk can't confound the result by reaching index1 from
    // the other direction.
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 48 }, // locked — user explicitly reverted this one
      { type: "standard", widthIn: 48 }, // otherwise eligible, but never reached
      { type: "braced", widthIn: 48, bracedPattern: "chevron", bracedMirrored: false }, // pre-satisfies the end
    ];
    const eligibleIndices = new Set([1]); // only index 1 is eligible
    const result = applyBracedPlacement(slots, 100_000, 48, "chevron", false, eligibleIndices);
    expect(result.map((s) => s.type)).toEqual(["standard", "standard", "braced"]);
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
      const result = applyBracedPlacement(slots, 100_000, 40, "chevron", false);
      expect(result[1]).toEqual({ type: "safety-gap", secondaryType: "braced", widthIn: 40 + SAFETY_PLYWOOD_BUFFER_IN });
      // 60 - 40.75 = 19.25 shed onto the nearest standard panel (index 2,
      // continuing inward from the corner — the walk's own direction).
      expect(result[2]).toEqual({ type: "standard", widthIn: 40 + 19.25 });
      // The end-corner walk independently claims the last standard slot
      // (index 3) for its own rule-1 brace, same as always.
      expect(result[3]).toEqual({ type: "braced", widthIn: 40, bracedPattern: "chevron", bracedMirrored: false });
    });

    it("combines independently at each end when both ends have a corner-touching safety-gap slot", () => {
      const slots: PanelSlot[] = [
        { type: "corner", widthIn: 24 },
        { type: "safety-gap", widthIn: 50 },
        { type: "standard", widthIn: 40 },
        { type: "safety-gap", widthIn: 50 },
        { type: "corner", widthIn: 24 },
      ];
      const result = applyBracedPlacement(slots, 100_000, 40, "chevron", false);
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
      const result = applyBracedPlacement(slots, 80, 40, "chevron", false);
      expect(result[1]!.secondaryType).toBe("braced");
      expect(result[1]!.widthIn).toBeCloseTo(40 + SAFETY_PLYWOOD_BUFFER_IN, 6);
      expect(result[2]!.type).toBe("standard");
      expect(result[2]!.widthIn).toBeCloseTo(40, 6);
      expect(result[3]!.type).toBe("braced");
    });
  });
});

describe("reconcileBracedPlacement", () => {
  it("with no prior state (undefined oldSlots), behaves exactly like a fresh applyBracedPlacement call", () => {
    const { slots } = tileWall(480, 48, 24, "end");
    const viaReconcile = reconcileBracedPlacement(undefined, slots, 96, 48, "chevron", false);
    const viaDirect = applyBracedPlacement(slots, 96, 48, "chevron", false);
    expect(viaReconcile).toEqual(viaDirect);
  });

  it("preserves an explicit 'standard' choice through a later retile, instead of the seismic rule re-bracing it", () => {
    // First pass: corner-touching slot gets auto-seeded braced.
    const { slots: fresh } = tileWall(200, 48, 24, "end");
    const seeded = reconcileBracedPlacement(undefined, fresh, 100_000, 48, "chevron", false);
    expect(seeded[1]!.type).toBe("braced");
    // User reverts it back to plain standard (simulating the click-cycle's
    // last stop) — same slots array, that one position's type flipped back.
    const userReverted = seeded.map((s, i) => (i === 1 ? { ...s, type: "standard" as const, bracedPattern: undefined, bracedMirrored: undefined } : s));
    // A later, unrelated retile of the SAME wall (identical geometry here,
    // standing in for e.g. an opening elsewhere on the wall changing) —
    // reconciling against the user's reverted state must NOT re-brace it.
    const { slots: retiled } = tileWall(200, 48, 24, "end");
    const reconciled = reconcileBracedPlacement(userReverted, retiled, 100_000, 48, "chevron", false);
    expect(reconciled[1]!.type).toBe("standard");
  });

  it("preserves a user's specific braced pattern/mirror choice through a later retile", () => {
    const { slots: fresh } = tileWall(200, 48, 24, "end");
    const seeded = reconcileBracedPlacement(undefined, fresh, 100_000, 48, "chevron", false);
    const userChose = seeded.map((s, i) => (i === 1 ? { ...s, bracedPattern: "hatch" as const, bracedMirrored: true } : s));
    const { slots: retiled } = tileWall(200, 48, 24, "end");
    const reconciled = reconcileBracedPlacement(userChose, retiled, 100_000, 48, "chevron", false);
    expect(reconciled[1]!.type).toBe("braced");
    expect(reconciled[1]!.bracedPattern).toBe("hatch");
    expect(reconciled[1]!.bracedMirrored).toBe(true);
  });

  it("seeds only genuinely new standard-slot positions, leaving every previously-decided position (braced or explicit standard) untouched", () => {
    // A wall fully decided by rule 1 alone (huge spacing so rule 2 never
    // fires) — some standard-family slots become braced (the 2
    // corner-touching ones), the rest stay plain standard.
    const { slots: shortWall } = tileWall(200, 48, 24, "end");
    const decided = reconcileBracedPlacement(undefined, shortWall, 100_000, 48, "chevron", false);
    // The wall grows (e.g. a drag-wall edit), producing 1 extra standard
    // slot beyond what existed before — reconciling should seed ONLY that
    // new position (with the NEW default, "hatch"/true), leaving the 2
    // already-decided ones exactly as they were (still "chevron"/false).
    const { slots: grownWall } = tileWall(260, 48, 24, "end");
    const reconciled = reconcileBracedPlacement(decided, grownWall, 100_000, 48, "hatch", true);

    const decidedStandardFamily = decided.filter((s) => s.type === "standard" || s.type === "braced");
    const reconciledStandardFamily = reconciled.filter((s) => s.type === "standard" || s.type === "braced");
    expect(reconciledStandardFamily.length).toBe(decidedStandardFamily.length + 1);
    // Only type/pattern/mirror carry forward — widthIn is always freshly
    // computed by the new tiling pass (the 260in wall's own panel widths
    // legitimately differ from the 200in wall's), so compare those 3
    // fields only, not full object equality.
    for (let i = 0; i < decidedStandardFamily.length; i++) {
      expect(reconciledStandardFamily[i]!.type).toBe(decidedStandardFamily[i]!.type);
      expect(reconciledStandardFamily[i]!.bracedPattern).toBe(decidedStandardFamily[i]!.bracedPattern);
      expect(reconciledStandardFamily[i]!.bracedMirrored).toBe(decidedStandardFamily[i]!.bracedMirrored);
    }
    // The 1 genuinely new slot got seeded with the NEW default pattern —
    // proving it really was freshly decided, not just copied forward.
    const newSlot = reconciledStandardFamily[reconciledStandardFamily.length - 1]!;
    if (newSlot.type === "braced") {
      expect(newSlot.bracedPattern).toBe("hatch");
      expect(newSlot.bracedMirrored).toBe(true);
    }
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
