import { describe, expect, it } from "vitest";
import {
  applyAdditionalRowBracedPattern,
  applyBracedPlacement,
  reconcileBracedPlacement,
  setWindowWidth,
} from "./bracedPlacement";
import {
  getOpeningAnchors,
  retileWithOpenings,
  TILER_MAX_PANEL_WIDTH_IN,
  TILER_MIN_PANEL_WIDTH_IN,
  tileWall,
  type OpeningAnchor,
} from "./tiling";
import type { BracePattern, PanelSlot, PanelSlotType, PanelSlotZone } from "./types";

describe("applyBracedPlacement", () => {
  it("places exactly 1 braced panel touching each corner, then periodic braced panels every `spacing` along the plain run, stamped with the default pattern/mirror", () => {
    // 480 wall, 48in standard, 24in corners: middle=432, minus the fixed
    // 3/4in gap leaves 431.25 for standards -> 8 fit (384) with a 47.25
    // remainder, split into 2 panels of 47.625 each next to the gap
    // (capped-width tiling, see tiling.test.ts); gapEnd 'end' puts the gap
    // second-to-last, corner-touching standard last.
    //
    // ⚠ A SECOND safety gap appears from 2026-10-18: a 480in run is 40ft, and
    // the 24ft spacing rule puts a gap at the joint nearest 24ft from the
    // first one (Tommy: a 3/4in safety cap approximately every 24ft, plus or
    // minus 4ft, whichever is closer). This fixture is about the BRACE walk,
    // and what it shows is that the walk still brackets each corner and still
    // steps periodically — over one more slot than it used to.
    const { slots } = tileWall(480, 48, 24, "end");
    const result = applyBracedPlacement(slots, 96 /* 8ft high-seismic spacing */, 48, "chevron", false);
    expect(result.map((s) => s.type)).toEqual([
      "corner",
      "braced", // touches the start corner
      "standard",
      "safety-gap", // the 24ft spacing rule, 2026-10-18
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

  it("gracefully handles a wall too short for a corner brace on each side — the end corner finds the gap, steps over it, and settles for the brace the other walk placed", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 48 },
      { type: "safety-gap", widthIn: 47.25 },
      { type: "corner", widthIn: 24 },
    ];
    const result = applyBracedPlacement(slots, 96, 48, "chevron", false);
    // Start-corner walk claims the one standard slot. The end-corner walk
    // then reaches the safety-gap slot, steps straight over it, and finds the
    // brace the other walk just placed — which satisfies it. So the end corner
    // has no brace of its own, and the wall is untouched.
    //
    // ⚠ **This fixture has outlived two different behaviours, and the
    // assertions never changed.** It once asserted that the gap COMBINED with
    // the corner brace here, which it did — and which left the wall 1½in
    // LONGER than itself, silently, one of the cases Tommy's 2026-09-29
    // "perfectly tight with dimensions and wall lengths" instruction was
    // about. Then the combine learned to refuse what the run could not pay
    // for, and this wall was a refusal. On 2026-11-02 the combine was deleted
    // outright (Tommy: *"We don't need any of this safety Gap combining
    // stuff"*) and the gap is simply stepped over. A 47¼in gap panel is
    // legacy-file shape in the first place; today's tiler emits exactly 3/4in.
    expect(result.map((s) => s.type)).toEqual(["corner", "braced", "safety-gap", "corner"]);
    expect(result[2]!.secondaryType).toBeUndefined();
    expect(result.reduce((a, s) => a + s.widthIn, 0)).toBe(slots.reduce((a, s) => a + s.widthIn, 0));
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
      { type: "standard", widthIn: 36, lockedWidthIn: 36 },
      { type: "standard", widthIn: 36, lockedWidthIn: 36 },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: 24 },
    ];
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
    expect(standardFamily[1]!.widthIn).toBeCloseTo(36, 6);
    expect(standardFamily[2]!.widthIn).toBeCloseTo(36, 6);
    // Each pin's own 4in surplus went to the UNLOCKED panel past them, never to
    // the other pin: 40 + 4 + 4 = 48.
    expect(standardFamily[3]!.widthIn).toBeCloseTo(48, 6);
    const totalWidthIn = reconciled.reduce((sum, s) => sum + s.widthIn, 0);
    const newTotalWidthIn = newSlots.reduce((sum, s) => sum + s.widthIn, 0);
    expect(totalWidthIn).toBeCloseTo(newTotalWidthIn, 6);
  });

  // ⚠ **This test's fixture used to be the one above, and it asserted a panel
  // the shop cannot build.** Two 25in pins against four 46in panels need 42in of
  // surplus absorbed by panels already within 2in of the 48in catalog maximum;
  // the old shed put the whole lot on one neighbour and produced an **88in
  // panel**, which the assertions then waved through because they only checked
  // the two pins and the total. Since 2026-09-30 the re-force is refused
  // instead — Tommy's decision, see `planLockedWidthReforce` — so the fixture
  // is kept here, as a refusal, rather than deleted along with the behaviour it
  // documented.
  it("REFUSES two locked widths the run cannot absorb without passing the catalog maximum", () => {
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
    // Nothing changed: every panel is the width the tiler laid out...
    expect(standardFamily.map((s) => s.widthIn)).toEqual([46, 46, 46, 46]);
    // ...both pins are still ON their slots, dormant rather than destroyed...
    expect(standardFamily[1]!.lockedWidthIn).toBe(25);
    expect(standardFamily[2]!.lockedWidthIn).toBe(25);
    // ...no panel is over the catalog maximum (the old shed produced 88in)...
    expect(Math.max(...standardFamily.map((s) => s.widthIn))).toBeLessThanOrEqual(48);
    // ...and the wall is still exactly its own length.
    const totalWidthIn = reconciled.reduce((sum, s) => sum + s.widthIn, 0);
    expect(totalWidthIn).toBeCloseTo(newSlots.reduce((sum, s) => sum + s.widthIn, 0), 6);
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

// ---------------------------------------------------------------------------
// THE PRODUCT SWEEP — the test that should have caught the overflow.
//
// Tommy, 2026-09-29: "this app needs to be perfectly tight with dimensions and
// wall lengths". The defect this sweep exists to make un-reintroducible was
// not subtle — a 240in wall came out 247-3/8in — and it survived because every
// test that could have caught it either checked a hand-built slot array or
// carved out an explicit exception for this one rule. So this one checks the
// realistic product space exhaustively, and the properties it checks are the
// ones a cut list cannot survive being wrong about:
//
//   1. the slots sum to the wall's tiling length, EXACTLY, in whole eighths;
//   2. no slot is zero-width — a 0in panel is not a part;
//   3. the braced pass never widens or narrows the wall at all, whatever the
//      tiler handed it (this one holds even on degenerate walls, below);
//   4. it never puts a standard/braced panel outside the shop's
//      [24in, 48in] bounds that the tiler had inside them.
//
// **The one exception, named and bounded rather than waved at:** property 1 is
// asserted only where the TILER's own output sums to the wall. It does not on
// a wall too short to hold its own openings — a 12in wall carrying two 61.5in
// windows overflows by the 123in that do not fit, and that is the tiler's
// reserved-opening arithmetic, not braced placement. `fits()` below is the
// filter, property 3 covers those walls anyway, and the overflow is written up
// in the handoff as pre-existing tiler behaviour rather than fixed here.
//
// Locked (user-dragged) widths are deliberately NOT swept: they travel a
// different shed path (`shedWidthToNearestUnlocked`) which has a defect of its
// own — a wall with a single standard panel loses the whole locked delta — and
// pretending otherwise here would either fail or paper over it. Reported, not
// fixed, and not silently covered.
// ---------------------------------------------------------------------------
describe("the product sweep: every wall length, every corner, every opening", () => {
  const CORNER_WIDTH_IN = 25.5;
  // Imported, never restated — see the same note on the describe above.
  const MIN_IN = TILER_MIN_PANEL_WIDTH_IN;
  const MAX_IN = TILER_MAX_PANEL_WIDTH_IN;
  // 8ft, the high-seismic figure — exercises rule 2 too. ⚠ This one is a
  // restated value on purpose: the real figure lives in
  // `seismicBracedPanelSpacingFt` in the catalog and is
  // `pending-BI-confirmation`. It is test INPUT, not a limit anything here
  // polices, and every headline count below was re-measured at 300in and
  // 100000in as well, so nothing in this file depends on it.
  const SEISMIC_SPACING_IN = 96;

  const win = (beforeStandardCount: number, widthIn: number): OpeningAnchor => ({ beforeStandardCount, type: "window", widthIn });
  const OPENING_SETS: { name: string; openings: OpeningAnchor[] }[] = [
    { name: "none", openings: [] },
    // beforeStandardCount 0 puts the opening between the corner and the gap —
    // the shape that makes the corner walk reach the gap first, which is the
    // only way the combine fires on a long wall.
    { name: "one 61.5in window against the corner", openings: [win(0, 61.5)] },
    { name: "the two 61.5in windows from the report", openings: [win(0, 61.5), win(1, 61.5)] },
    { name: "one 36in window mid-run", openings: [win(1, 36)] },
    { name: "two 36in windows straddling the run", openings: [win(0, 36), win(2, 36)] },
    // 61.5in sits inside the 51in-75.5in two-corner absorb band, 30in under it
    // and 80in over it — all three corner routes get swept.
    { name: "a 30in window against the corner", openings: [win(0, 30)] },
    { name: "an 80in opening mid-run", openings: [win(1, 80)] },
  ];
  const CORNER_CONFIGS: [boolean, boolean][] = [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ];

  const eighths = (slots: PanelSlot[]) => slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0);
  const outOfBounds = (slots: PanelSlot[]) => {
    let n = 0;
    for (const s of slots) {
      if (s.type !== "standard" && s.type !== "braced") continue;
      if (s.widthIn < MIN_IN - 1e-9 || s.widthIn > MAX_IN + 1e-9) n++;
    }
    return n;
  };
  /** All four properties in one allocation-free pass — this runs 790,440
   * times, so it is written for the profiler rather than for elegance.
   * Returns "" when the wall is clean. */
  const check = (tiled: PanelSlot[], braced: PanelSlot[], wallEighths: number, assertWallSum: boolean) => {
    let tiledEighths = 0;
    let tiledOut = 0;
    for (const s of tiled) {
      tiledEighths += Math.round(s.widthIn * 8);
      if ((s.type === "standard" || s.type === "braced") && (s.widthIn < MIN_IN - 1e-9 || s.widthIn > MAX_IN + 1e-9)) tiledOut++;
    }
    let bracedEighths = 0;
    let bracedOut = 0;
    let zeroes = 0;
    for (const s of braced) {
      const e = Math.round(s.widthIn * 8);
      bracedEighths += e;
      if (e === 0) zeroes++;
      if ((s.type === "standard" || s.type === "braced") && (s.widthIn < MIN_IN - 1e-9 || s.widthIn > MAX_IN + 1e-9)) bracedOut++;
    }
    if (bracedEighths !== tiledEighths) return `braced pass moved the total, ${tiledEighths} -> ${bracedEighths} eighths`;
    if (assertWallSum && tiledEighths !== wallEighths) return `TILER sums to ${tiledEighths}, wall is ${wallEighths} eighths`;
    if (assertWallSum && bracedEighths !== wallEighths) return `sums to ${bracedEighths}, wall is ${wallEighths} eighths`;
    if (zeroes > 0) return `${zeroes} slot(s) at 0in`;
    if (bracedOut > tiledOut) return `${bracedOut} panels outside [24,48] vs the tiler's ${tiledOut}`;
    return "";
  };

  /** Whether this wall is long enough to hold its own openings at all — see
   * the named exception in the block comment above. */
  const fits = (wallLengthIn: number, openings: OpeningAnchor[], hasStart: boolean, hasEnd: boolean) => {
    const cornersIn = (hasStart ? CORNER_WIDTH_IN : 0) + (hasEnd ? CORNER_WIDTH_IN : 0);
    const openingsIn = openings.reduce((a, o) => a + o.widthIn, 0);
    return wallLengthIn - cornersIn - openingsIn >= MIN_IN;
  };

  it("holds all four properties at every eighth from 12in to 600in, across 3 standard widths x 4 corner configs x 2 gap ends x 7 opening sets", () => {
    const violations: string[] = [];
    let cases = 0;
    let wallSumAsserted = 0;
    for (let e = Math.round(12 * 8); e <= Math.round(600 * 8); e++) {
      const wallLengthIn = e / 8;
      for (const standardWidthIn of [39, 40, 48]) {
        for (const [hasStart, hasEnd] of CORNER_CONFIGS) {
          for (const gapEnd of ["start", "end"] as const) {
            for (const { name, openings } of OPENING_SETS) {
              cases++;
              const tiled = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasStart, hasEnd, openings).slots;
              const braced = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
              for (const s of braced) {
              }
              const walled = fits(wallLengthIn, openings, hasStart, hasEnd);
              if (walled) wallSumAsserted++;
              const failure = check(tiled, braced, e, walled);
              if (failure) {
                violations.push(`${wallLengthIn}in/${standardWidthIn}/${hasStart ? "S" : "-"}${hasEnd ? "E" : "-"}/${gapEnd}/${name}: ${failure}`);
              }
            }
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
    // Non-vacuous on both counts: the sweep really did reach the rule under
    // test, and it really did assert the wall sum over most of the space.
    expect(cases).toBe(790_440);
    // ⚠ **The third non-vacuity count is gone, not weakened: it asserted that
    // the corner-brace combine fired on over 5,000 of these walls, and the
    // combine was deleted on 2026-11-02 (Tommy: *"I don't want to see any of
    // the panels combined with safety gaps"*). The four properties still hold
    // over the same 790,440 walls — and property 3 (the braced pass moves no
    // width at all) is now true by construction rather than by arithmetic,
    // which is the whole point of having deleted it.
    expect(wallSumAsserted).toBeGreaterThan(cases * 0.8);
  });


  it("no wall in the product space moves under a no-op reconcile, or under a second one", () => {
    // Every inch rather than every eighth, which is what keeps this inside the
    // suite's time budget; the every-eighth run measures 0 as well.
    const violations: string[] = [];
    let cases = 0;
    const layout = (slots: PanelSlot[]) =>
      slots.map((sl) => [sl.type, sl.widthIn].join("/")).join(" | ");
    for (let e = Math.round(12 * 8); e <= Math.round(600 * 8); e += 8) {
      const wallLengthIn = e / 8;
      for (const standardWidthIn of [39, 40, 48]) {
        for (const [hasStart, hasEnd] of CORNER_CONFIGS) {
          for (const gapEnd of ["start", "end"] as const) {
            for (const { name, openings } of OPENING_SETS) {
              cases++;
              const tiled = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasStart, hasEnd, openings).slots;
              const first = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
              const second = reconcileBracedPlacement(first, tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
              const where = [wallLengthIn + "in", standardWidthIn, (hasStart ? "S" : "-") + (hasEnd ? "E" : "-"), gapEnd, name].join("/");
              if (layout(second) !== layout(first)) {
                violations.push(where + ": 1st reconcile moved it; was " + layout(first) + "; now " + layout(second));
                continue;
              }
              const third = reconcileBracedPlacement(second, tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
              if (layout(third) !== layout(second)) violations.push(where + ": 2nd reconcile moved it");
            }
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
    // This is also what pins `combineSwallowedOrdinals`' RECONSTRUCTION of the
    // swallowed ordinal against the real combine: a wrong hole misaligns the
    // markers, which shows up here as a wall that moves.
    expect(cases).toBeGreaterThan(90_000);
  });

  it("braced pattern and mirroring move no width anywhere", () => {
    // Cheap to state, and it is why the sweep above runs one pattern rather
    // than four: a pattern is stamped onto a slot, never measured.
    const violations: string[] = [];
    for (let e = Math.round(12 * 8); e <= Math.round(600 * 8); e += 8) {
      const wallLengthIn = e / 8;
      for (const [hasStart, hasEnd] of CORNER_CONFIGS) {
        for (const { openings } of OPENING_SETS) {
          const tiled = retileWithOpenings(wallLengthIn, 40, CORNER_WIDTH_IN, "end", hasStart, hasEnd, openings).slots;
          const a = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, 40, "chevron", false).map((s) => s.widthIn);
          for (const [pattern, mirrored] of [["hatch", false], ["chevron", true], ["hatch", true]] as [BracePattern, boolean][]) {
            const b = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, 40, pattern, mirrored).map((s) => s.widthIn);
            if (a.join() !== b.join()) violations.push(`${wallLengthIn}in ${pattern}/${mirrored}: ${a.join()} vs ${b.join()}`);
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it("holds the same four properties through a RETILE that carries prior braced decisions", () => {
    // The sweep above seeds every wall from scratch. This one goes through
    // `reconcileBracedPlacement` with real prior state, which is the path the
    // app takes on every wall-length edit: the combine runs against slots
    // whose types came from the wall's own history.
    const violations: string[] = [];
    let cases = 0;
    for (let e = Math.round(12 * 8); e <= Math.round(600 * 8); e += 4) {
      const wallLengthIn = e / 8;
      for (const standardWidthIn of [39, 40, 48]) {
        for (const { name, openings } of OPENING_SETS) {
          cases++;
          // The wall as it stood at a different length, seeded from scratch…
          const before = reconcileBracedPlacement(
            undefined,
            retileWithOpenings(wallLengthIn + 17.375, standardWidthIn, CORNER_WIDTH_IN, "end", true, true, openings).slots,
            SEISMIC_SPACING_IN,
            standardWidthIn,
            "chevron",
            false,
          );
          // …and the same wall re-tiled to this length, reconciled against it.
          const tiled = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, "end", true, true, openings).slots;
          const after = reconcileBracedPlacement(before, tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
          const failure = check(tiled, after, e, fits(wallLengthIn, openings, true, true));
          if (failure) violations.push(`${wallLengthIn}in/${standardWidthIn}/${name}: ${failure}`);
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
    expect(cases).toBeGreaterThan(20_000);
  });
});
