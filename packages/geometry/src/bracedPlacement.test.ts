import { describe, expect, it } from "vitest";
import {
  SAFETY_PLYWOOD_BUFFER_IN,
  applyAdditionalRowBracedPattern,
  applyBracedPlacement,
  reconcileBracedPlacement,
  setWindowWidth,
} from "./bracedPlacement";
import { getOpeningAnchors, retileWithOpenings, tileWall } from "./tiling";
import type { PanelSlot, PanelSlotType, PanelSlotZone } from "./types";

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

describe("applyAdditionalRowBracedPattern", () => {
  const standardZones = (count: number): PanelSlotZone[] => Array.from({ length: count }, () => ({ type: "standard" as const }));
  const standardParentTypes = (count: number): PanelSlotType[] => Array.from({ length: count }, () => "standard" as const);

  it("braces the first 2 and last 2 eligible slots (doubled corner count) with huge spacing so rule 2 never fires", () => {
    const result = applyAdditionalRowBracedPattern(standardZones(8), standardParentTypes(8), Array(8).fill(40), 100_000, "chevron", false);
    expect(result.map((z) => z.type)).toEqual(["braced", "braced", "standard", "standard", "standard", "standard", "braced", "braced"]);
    for (const z of result) {
      if (z.type !== "braced") continue;
      expect(z.bracedPattern).toBe("chevron");
      expect(z.bracedMirrored).toBe(false);
    }
  });

  it("walks straight past a corner/safety-oct-corner PARENT column without ever bracing it, finding the first 2 real standard-parent zones inward instead", () => {
    const parentTypes: PanelSlotType[] = ["corner", "standard", "standard", "standard", "standard", "standard", "standard", "safety-oct-corner"];
    // Zone content at the corner-parent positions is deliberately "standard"
    // here too, to prove the skip is driven by `parentSlotTypes`, not by
    // this zone's own (possibly stale/padded) type.
    const zoneSlots = standardZones(8);
    const result = applyAdditionalRowBracedPattern(zoneSlots, parentTypes, Array(8).fill(40), 100_000, "chevron", false);
    expect(result.map((z) => z.type)).toEqual(["standard", "braced", "braced", "standard", "standard", "braced", "braced", "standard"]);
  });

  it("claims 2 consecutive eligible slots per periodic hit (\"every other pair\"), recurring along the plain run", () => {
    // 20 slots, 20in each (400in total run), spacing 90: rule 1 claims
    // indices 0-1 and 18-19; the periodic rule then fires every 90in of
    // accumulated width across the remaining plain run, claiming a pair
    // each time (traced by hand against the function's own carry/reset
    // behavior — a pair's 2nd slot resets the cumulative distance same as
    // rule 1's own braces do, so the leftover after a hit isn't carried
    // past the pair's own 2nd slot).
    const result = applyAdditionalRowBracedPattern(standardZones(20), standardParentTypes(20), Array(20).fill(20), 90, "chevron", false);
    expect(result.map((z) => z.type)).toEqual([
      "braced",
      "braced",
      "standard",
      "standard",
      "standard",
      "standard",
      "braced",
      "braced",
      "standard",
      "standard",
      "standard",
      "standard",
      "braced",
      "braced",
      "standard",
      "standard",
      "standard",
      "standard",
      "braced",
      "braced",
    ]);
  });

  it("never promotes a position outside eligibleIndices, and the walk stops entirely at the first ineligible slot it reaches", () => {
    const eligible = new Set([2, 3]); // excludes both ends
    const result = applyAdditionalRowBracedPattern(standardZones(6), standardParentTypes(6), Array(6).fill(40), 100_000, "chevron", false, eligible);
    expect(result.map((z) => z.type)).toEqual(["standard", "standard", "standard", "standard", "standard", "standard"]);
  });

  it("recognizes an already-braced slot as satisfying the near-corner requirement without re-marking it", () => {
    const zoneSlots: PanelSlotZone[] = [
      { type: "braced", bracedPattern: "hatch", bracedMirrored: true },
      { type: "standard" },
      { type: "standard" },
      { type: "standard" },
    ];
    const result = applyAdditionalRowBracedPattern(zoneSlots, standardParentTypes(4), Array(4).fill(40), 100_000, "chevron", false);
    expect(result[0]).toEqual({ type: "braced", bracedPattern: "hatch", bracedMirrored: true });
    expect(result[1]!.type).toBe("braced");
    expect(result[1]!.bracedPattern).toBe("chevron");
  });

  it("treats an undefined zone entry as an implicit standard placeholder", () => {
    const zoneSlots: (PanelSlotZone | undefined)[] = [undefined, undefined, undefined, undefined];
    const result = applyAdditionalRowBracedPattern(zoneSlots, standardParentTypes(4), Array(4).fill(40), 100_000, "chevron", false);
    expect(result.map((z) => z.type)).toEqual(["braced", "braced", "braced", "braced"]);
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

  it("carries a locked width through an unrelated retile, shedding the delta to the nearest unlocked neighbor", () => {
    // Simulates: the user dragged the boundary between the 2nd and 3rd
    // standard panels, shrinking one to 30in and growing its neighbor to
    // 50in (combined span unchanged) — both committed with lockedWidthIn.
    const oldSlots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 40 },
      { type: "standard", widthIn: 30, lockedWidthIn: 30 },
      { type: "standard", widthIn: 50 },
      { type: "standard", widthIn: 40 },
      { type: "corner", widthIn: 24 },
    ];
    // An unrelated retile of the same wall geometry regenerates uniform
    // 40in standards, as if nothing had ever been dragged.
    const newSlots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 40 },
      { type: "standard", widthIn: 40 },
      { type: "standard", widthIn: 40 },
      { type: "standard", widthIn: 40 },
      { type: "corner", widthIn: 24 },
    ];
    const reconciled = reconcileBracedPlacement(oldSlots, newSlots, 100_000, 40, "chevron", false);
    const standardFamily = reconciled.filter((s) => s.type === "standard" || s.type === "braced");
    expect(standardFamily[1]!.widthIn).toBeCloseTo(30, 6);
    expect(standardFamily[1]!.lockedWidthIn).toBe(30);
    // Total width across the whole row is unchanged from the locked state
    // — the +10in delta went to a neighbor, not lost.
    const totalWidthIn = reconciled.reduce((sum, s) => sum + s.widthIn, 0);
    const oldTotalWidthIn = oldSlots.reduce((sum, s) => sum + s.widthIn, 0);
    expect(totalWidthIn).toBeCloseTo(oldTotalWidthIn, 6);
  });

  it("preserves 2 adjacent locked widths independently, without either shedding onto the other", () => {
    const oldSlots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 40 },
      { type: "standard", widthIn: 25, lockedWidthIn: 25 },
      { type: "standard", widthIn: 25, lockedWidthIn: 25 },
      { type: "standard", widthIn: 70 },
      { type: "corner", widthIn: 24 },
    ];
    const newSlots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 46 },
      { type: "standard", widthIn: 46 },
      { type: "standard", widthIn: 46 },
      { type: "standard", widthIn: 46 },
      { type: "corner", widthIn: 24 },
    ];
    const reconciled = reconcileBracedPlacement(oldSlots, newSlots, 100_000, 40, "chevron", false);
    const standardFamily = reconciled.filter((s) => s.type === "standard" || s.type === "braced");
    expect(standardFamily[1]!.widthIn).toBeCloseTo(25, 6);
    expect(standardFamily[2]!.widthIn).toBeCloseTo(25, 6);
    const totalWidthIn = reconciled.reduce((sum, s) => sum + s.widthIn, 0);
    const newTotalWidthIn = newSlots.reduce((sum, s) => sum + s.widthIn, 0);
    expect(totalWidthIn).toBeCloseTo(newTotalWidthIn, 6);
  });

  // Regression coverage for 2 related retile/reconciliation bugs found while
  // testing an unrelated beam/zone feature — both are pre-existing bugs in
  // this older tiling/reconciliation code, not in the new feature itself.

  it("BUG 1 regression: converting one standard slot into a window (mid-wall) must not silently drop a DIFFERENT, untouched braced panel elsewhere on the wall", () => {
    // corner-braced-standard-standard-gap-braced-corner: 2 braced panels,
    // one touching each corner, with 2 plain standards between the first
    // brace and the gap.
    const oldSlots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "braced", widthIn: 48, bracedPattern: "chevron", bracedMirrored: false }, // touches start corner
      { type: "standard", widthIn: 48 }, // this is the one about to be clicked into a window
      { type: "standard", widthIn: 48 },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "braced", widthIn: 48, bracedPattern: "hatch", bracedMirrored: true }, // touches end corner — never touched by the click
      { type: "corner", widthIn: 24 },
    ];
    const wallLengthIn = oldSlots.reduce((sum, s) => sum + s.widthIn, 0); // 240.75

    // Mirrors handleToggleOpening's own inline anchor-building convention
    // (already correct per page.tsx: counts "standard" and "braced"
    // together) — index 2 (family-ordinal 1, 1 braced precedes it) is
    // becoming a window, so it's excluded from the anchors/family entirely.
    const anchors = [{ beforeStandardCount: 1, type: "window" as const, widthIn: 48 }];

    const retiled = retileWithOpenings(wallLengthIn, 48, 24, "end", true, true, anchors).slots;
    const reconciled = reconcileBracedPlacement(oldSlots, retiled, 100_000, 48, "chevron", false);

    // The untouched far-end brace must still be "braced" with its ORIGINAL
    // pattern/mirror — not silently reverted to "standard" (the bug) nor
    // re-seeded with the default pattern.
    const braced = reconciled.filter((s) => s.type === "braced");
    expect(braced.length).toBe(2);
    expect(reconciled[reconciled.length - 2]).toEqual({
      type: "braced",
      widthIn: 48,
      bracedPattern: "hatch",
      bracedMirrored: true,
    });
    // The start-corner brace is untouched too.
    expect(reconciled[1]).toEqual({
      type: "braced",
      widthIn: 48,
      bracedPattern: "chevron",
      bracedMirrored: false,
    });
    // And the window landed where anchored, between the 2 braced panels.
    expect(reconciled.map((s) => s.type)).toEqual(["corner", "braced", "window", "standard", "safety-gap", "braced", "corner"]);
  });

  it("BUG 2 regression: resizing an existing window must not swap its visual order with a braced panel that precedes it", () => {
    // Same wall shape as the BUG 1 test, but now already past that retile —
    // the window already exists, with a braced panel BEFORE it in wall
    // order (the corner-touching one) and a plain standard after.
    const oldSlots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "braced", widthIn: 48, bracedPattern: "chevron", bracedMirrored: false },
      { type: "window", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: 24 },
    ];
    const wallLengthIn = oldSlots.reduce((sum, s) => sum + s.widthIn, 0); // 240.75

    // Mirrors handleSetWindowWidth exactly: read anchors off the CURRENT
    // slots, patch the window's own width, retile, then reconcile.
    const anchors = getOpeningAnchors(oldSlots);
    const windowAnchorIdx = anchors.findIndex((a) => a.type === "window");
    anchors[windowAnchorIdx] = { ...anchors[windowAnchorIdx]!, widthIn: 60 };

    const retiled = retileWithOpenings(wallLengthIn, 48, 24, "end", true, true, anchors).slots;
    const reconciled = reconcileBracedPlacement(oldSlots, retiled, 100_000, 48, "chevron", false);

    // The braced panel must still be BEFORE the window (its original wall
    // order), not swapped to after it.
    const bracedIdx = reconciled.findIndex((s) => s.type === "braced");
    const windowIdx = reconciled.findIndex((s) => s.type === "window");
    expect(bracedIdx).toBeGreaterThanOrEqual(0);
    expect(windowIdx).toBeGreaterThan(bracedIdx);
    expect(reconciled[bracedIdx]).toMatchObject({ bracedPattern: "chevron", bracedMirrored: false });
    // The window's width was actually applied.
    expect(reconciled[windowIdx]!.widthIn).toBe(60);
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
