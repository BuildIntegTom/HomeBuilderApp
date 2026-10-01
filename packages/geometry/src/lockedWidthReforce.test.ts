import { describe, expect, it } from "vitest";
import { applyBracedPlacement, reconcileBracedPlacement } from "./bracedPlacement";
import {
  findUnhonouredLockedWidths,
  honourableLockedWidthRangeIn,
  planLockedWidthReforce,
} from "./lockedWidthReforce";
import { retileWithOpenings, TILER_MAX_PANEL_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN, type OpeningAnchor } from "./tiling";
import type { PanelSlot } from "./types";

const CORNER_WIDTH_IN = 25.5;
/** 8ft, the high-seismic figure — same restated test INPUT the braced product
 * sweep uses, and for the same reason: the real value
 * (`seismicBracedPanelSpacingFt`) is `pending-BI-confirmation` and nothing here
 * polices it. */
const SEISMIC_SPACING_IN = 96;
/** The two numbers a user-facing message quotes. They are the CATALOG's
 * (`fabricationMinPanelWidthIn`, confirmed; `panelWidthInRange.maxIn`,
 * manufacturer), restated here only because this package may not depend on the
 * catalog — and they are the same two the tiler already uses. */
const LIMITS = { minIn: TILER_MIN_PANEL_WIDTH_IN, maxIn: TILER_MAX_PANEL_WIDTH_IN };

const e8 = (slots: PanelSlot[]) => slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0);
/** The three counts the RECOVERY sentence needs, defaulted to "a bare wall with
 * nothing else on it" so a test that is not about them does not have to say so. */
const bare = { bracedFreePanelCount: 0, otherPinnedPanelCount: 0, openingCount: 0 };
const std = (widthIn: number, lockedWidthIn?: number): PanelSlot =>
  lockedWidthIn === undefined ? { type: "standard", widthIn } : { type: "standard", widthIn, lockedWidthIn };

describe("planLockedWidthReforce", () => {
  it("is identity, by reference, on a run with nothing pinned", () => {
    const slots = [std(40), std(40)];
    const result = planLockedWidthReforce(slots);
    expect(result.slots).toBe(slots);
    expect(result.refusals).toEqual([]);
  });

  it("forces a pinned width and takes the difference out of the free run", () => {
    const { slots, refusals } = planLockedWidthReforce([std(36, 48), std(40), std(40)]);
    expect(refusals).toEqual([]);
    expect(slots.map((s) => s.widthIn)).toEqual([48, 28, 40]);
    expect(e8(slots)).toBe(8 * 116);
  });

  it("spreads the difference across as many free panels as it takes", () => {
    // 48in pin on a 24in slot needs 24in, and the next panel can only give 6in
    // before it hits the 24in floor — so the one past it pays the rest.
    const { slots, refusals } = planLockedWidthReforce([std(24, 48), std(30), std(44)]);
    expect(refusals).toEqual([]);
    expect(slots.map((s) => s.widthIn)).toEqual([48, 24, 26]);
    expect(e8(slots)).toBe(8 * 98);
  });

  it("walks forward first and then back toward the start, as the old shed did", () => {
    const { slots } = planLockedWidthReforce([std(40), std(36, 40), std(40)]);
    expect(slots.map((s) => s.widthIn)).toEqual([40, 40, 36]);
  });

  it("REFUSES rather than shed onto nothing — the named 150in case's own shape", () => {
    // corner | window | gap | standard | corner: one standard-family slot on the
    // whole wall, and it is the pinned one. The old helper did nothing here and
    // the wall came out 11 1/4in long.
    const run: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      { type: "window", widthIn: 61.5 },
      { type: "safety-gap", widthIn: 0.75 },
      std(36.75, 48),
      { type: "corner", widthIn: 25.5 },
    ];
    const { slots, refusals } = planLockedWidthReforce(run);
    expect(e8(slots)).toBe(8 * 150);
    expect(slots[3]!.widthIn).toBe(36.75);
    // The pin is NOT cleared — it is dormant, and comes back if the wall can
    // afford it later.
    expect(slots[3]!.lockedWidthIn).toBe(48);
    expect(refusals).toEqual([
      {
        slotIndex: 3,
        lockedWidthIn: 48,
        tiledWidthIn: 36.75,
        freePanelCount: 0,
        canGiveUpIn: 0,
        canAbsorbIn: 0,
        bracedFreePanelCount: 0,
        // No other hand-set panel to reset and ONE opening to delete, which is
        // what the recovery sentence is allowed to offer on this wall and the
        // reason it knows not to offer the other.
        otherPinnedPanelCount: 0,
        openingCount: 1,
      },
    ]);
    // ...and the only legal hand-set width there is the tiler's own.
    expect(honourableLockedWidthRangeIn(refusals[0]!, LIMITS)).toEqual({ narrowestIn: 36.75, widestIn: 36.75 });
  });

  it("REFUSES a pin the free run can only pay for by going under the fabrication minimum", () => {
    // The pin wants 12in; the one free panel can spare 6in before it hits 24in.
    const { slots, refusals } = planLockedWidthReforce([std(36, 48), std(30)]);
    expect(slots.map((s) => s.widthIn)).toEqual([36, 30]);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatchObject({ slotIndex: 0, canGiveUpIn: 6, canAbsorbIn: 18 });
    // 42in is the widest it could be; 18in would be legal arithmetic but is
    // below the shop's own floor, so the narrowest quotable figure is 24in.
    expect(honourableLockedWidthRangeIn(refusals[0]!, LIMITS)).toEqual({ narrowestIn: 24, widestIn: 42 });
  });

  it("REFUSES a pin whose surplus the free run cannot absorb without passing the maximum", () => {
    const { slots, refusals } = planLockedWidthReforce([std(40, 24), std(48)]);
    expect(slots.map((s) => s.widthIn)).toEqual([40, 48]);
    expect(refusals[0]).toMatchObject({ lockedWidthIn: 24, tiledWidthIn: 40, canAbsorbIn: 0, canGiveUpIn: 24 });
  });

  it("never sheds onto another pinned slot", () => {
    const { slots, refusals } = planLockedWidthReforce([std(36, 48), std(40, 40)]);
    expect(slots.map((s) => s.widthIn)).toEqual([36, 40]);
    expect(refusals.map((r) => r.slotIndex)).toEqual([0]);
  });

  it("never produces a 0in panel where the old clamp did", () => {
    // 48in pin, one 12in free neighbour: the old code set it to max(0, 12-12) = 0
    // and called the wall done.
    const { slots, refusals } = planLockedWidthReforce([std(36, 48), std(12)]);
    expect(slots.map((s) => s.widthIn)).toEqual([36, 12]);
    expect(refusals).toHaveLength(1);
  });

  it("honours an out-of-range stored pin when the run can pay for it, because limits bind at EDIT and not at load", () => {
    const { slots, refusals } = planLockedWidthReforce([std(30, 20), std(30)]);
    expect(refusals).toEqual([]);
    expect(slots.map((s) => s.widthIn)).toEqual([20, 40]);
  });

  it("snaps a pin to the 1/8in grid as it applies it", () => {
    const { slots } = planLockedWidthReforce([std(36, 36.1), std(40)]);
    expect(slots[0]!.widthIn).toBe(36.125);
    expect(e8(slots)).toBe(8 * 76);
  });

  it("plans two pins in slot order, each all-or-nothing, against the run the earlier one left", () => {
    // Only 12in of slack on the wall. The earlier pin takes it; the later one is
    // refused whole rather than half-applied.
    const { slots, refusals } = planLockedWidthReforce([std(30, 42), std(36), std(30, 42)]);
    expect(slots.map((s) => s.widthIn)).toEqual([42, 24, 30]);
    expect(refusals.map((r) => r.slotIndex)).toEqual([2]);
    expect(e8(slots)).toBe(8 * 96);
  });

  it("settles pins that only become payable once ANOTHER pin has paid, in one call", () => {
    // The order-dependence that made this function need a repeat rather than a
    // single ordered pass: slot 2's pin hands 6in back to the free panel, which
    // is then exactly what slot 0's pin needs. A single pass refused slot 0 and
    // the NEXT reconcile would have honoured it, moving a wall with no user
    // action at all.
    const { slots, refusals } = planLockedWidthReforce([std(36, 48), std(30), std(30, 24)]);
    expect(slots.map((s) => s.widthIn)).toEqual([48, 24, 24]);
    expect(refusals).toEqual([]);
    expect(e8(slots)).toBe(8 * 96);
  });

  // -------------------------------------------------------------------------
  // JOINT PLANNING, 2026-09-30. The first version of this function paid for each
  // pin out of the FREE run only, so every other pin was an immovable obstacle
  // and a run whose standard-family slots were all pinned lost every one of
  // them — including pins that `main`'s old shed honoured correctly. These are
  // the cases that regression showed up in, and every one of them is RED on the
  // per-pin planner.
  // -------------------------------------------------------------------------
  it("pays for a residual-CANCELLING pair with no free panel on the wall at all", () => {
    // The 9ft two-corner wall one elevation boundary drag leaves behind, which is
    // the shape that gesture produces on EVERY use: `handleDragResizePanels`
    // writes `lockedWidthIn` on both halves of the pair it moves.
    // 24 + 33 = 57, and the pair already holds 28.5 + 28.5 = 57 — so both pins
    // are payable with ZERO net change anywhere else, and per-pin planning
    // refused both of them.
    const run: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      std(28.5, 24),
      std(28.5, 33),
      { type: "corner", widthIn: 25.5 },
    ];
    const { slots, refusals } = planLockedWidthReforce(run);
    expect(slots.map((s) => s.widthIn)).toEqual([25.5, 24, 33, 25.5]);
    expect(refusals).toEqual([]);
    expect(e8(slots)).toBe(e8(run));
  });

  it("honours an ALL-PINNED run that already accounts for the wall's budget", () => {
    // The 211in wall of the end-to-end report: two typed widths and one boundary
    // drag leave four pins and no free panel, and the fresh tiling the re-tile
    // hands this function sums to exactly the same 159.25in those four pins do.
    // `main` kept all four; per-pin planning discarded all four.
    const run: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      std(40, 43),
      std(39.625, 41.5),
      std(39.625, 30),
      { type: "safety-gap", widthIn: 0.75 },
      std(40, 44.75),
      { type: "corner", widthIn: 25.5 },
    ];
    const { slots, refusals } = planLockedWidthReforce(run);
    expect(slots.map((s) => s.widthIn)).toEqual([25.5, 43, 41.5, 30, 0.75, 44.75, 25.5]);
    expect(refusals).toEqual([]);
    expect(e8(slots)).toBe(8 * 211);
  });

  it("keeps the cancelling pair and refuses only the pin that is genuinely unpayable", () => {
    // Three pins, no free panel, residuals +4.5 / -4.5 / +4.5. The first two
    // cancel; the third has nowhere to put its surplus. All-or-nothing still
    // holds per pin — the third is refused WHOLE, at the width its slot kept.
    const { slots, refusals } = planLockedWidthReforce([std(28.5, 24), std(28.5, 33), std(28.5, 24)]);
    expect(slots.map((s) => s.widthIn)).toEqual([24, 33, 28.5]);
    expect(refusals.map((r) => r.slotIndex)).toEqual([2]);
    expect(slots[2]!.lockedWidthIn).toBe(24);
    expect(e8(slots)).toBe(8 * 85.5);
  });

  it("gives up the BIGGEST offender first, not the last pin", () => {
    // Residuals +9in and +2in with one free panel holding 4in of headroom.
    // Dropping the last pin first leaves 9in still unpayable and loses both;
    // dropping the 9in pays the 2in. The refusal is the 9in one, which is also
    // the only outcome that keeps "the earlier slot gets it" from meaning "the
    // earlier slot takes everything down with it".
    const { slots, refusals } = planLockedWidthReforce([std(40, 31), std(40, 38), std(44)]);
    expect(slots.map((s) => s.widthIn)).toEqual([40, 38, 46]);
    expect(refusals.map((r) => r.slotIndex)).toEqual([0]);
    expect(e8(slots)).toBe(8 * 124);
  });

  it("still refuses the WHOLE pinned set when its aggregate cannot be paid for", () => {
    // Two pins, both wider than their slots, nothing to take 24in from: joint
    // planning must not become partial application. Neither is in force, neither
    // is cleared, and the wall is exactly as the tiler laid it out.
    const run = [std(36, 48), std(36, 48)];
    const { slots, refusals } = planLockedWidthReforce(run);
    expect(slots.map((s) => s.widthIn)).toEqual([36, 36]);
    expect(slots.map((s) => s.lockedWidthIn)).toEqual([48, 48]);
    expect(refusals.map((r) => r.slotIndex)).toEqual([0, 1]);
    expect(e8(slots)).toBe(e8(run));
  });

  it("counts the other pins and the openings on the run, for the recovery advice", () => {
    const run: PanelSlot[] = [
      { type: "window", widthIn: 36 },
      std(36, 48),
      std(40, 40),
      { type: "braced", widthIn: 30, bracedPattern: "chevron" },
    ];
    const { refusals } = planLockedWidthReforce(run);
    expect(refusals).toHaveLength(1);
    // One other hand-set panel to reset, one opening to delete, and the only
    // panel that could pay is a BRACED one — all three of which the message is
    // allowed to say because they are true here and not elsewhere.
    expect(refusals[0]).toMatchObject({ otherPinnedPanelCount: 1, openingCount: 1, freePanelCount: 1, bracedFreePanelCount: 1 });
  });

  it("is a fixpoint: re-planning a planned run changes nothing and reports the same refusals", () => {
    for (const run of [
      [std(36, 48), std(30)],
      [std(36, 48), std(30), std(30, 24)],
      [std(30, 42), std(36), std(30, 42)],
      [std(40, 24), std(48), std(48)],
      // The joint-planning cases, which is where a second pass has the most to
      // get wrong: a pin that IS in force has a zero residual and so must never
      // re-enter the group, or the whole all-pinned set would be re-planned
      // against itself and refused on the second call.
      [std(28.5, 24), std(28.5, 33)],
      [std(28.5, 24), std(28.5, 33), std(28.5, 24)],
      [std(40, 31), std(40, 38), std(44)],
      [std(36, 48), std(36, 48)],
    ]) {
      const once = planLockedWidthReforce(run);
      const twice = planLockedWidthReforce(once.slots);
      expect(twice.slots).toEqual(once.slots);
      expect(twice.refusals).toEqual(once.refusals);
      expect(e8(once.slots)).toBe(e8(run));
    }
  });
});

describe("honourableLockedWidthRangeIn", () => {
  it("returns null when no hand-set width at all is legal on this wall", () => {
    // A 20in slot the tiler itself produced, with no free run to move it into
    // range: the widest honourable value (20in) is under the shop's floor.
    const refusal = { slotIndex: 0, lockedWidthIn: 30, tiledWidthIn: 20, freePanelCount: 0, canGiveUpIn: 0, canAbsorbIn: 0, ...bare };
    expect(honourableLockedWidthRangeIn(refusal, LIMITS)).toBeNull();
  });

  it("clamps both ends into the catalog range", () => {
    const refusal = { slotIndex: 0, lockedWidthIn: 48, tiledWidthIn: 40, freePanelCount: 3, canGiveUpIn: 30, canAbsorbIn: 30, ...bare };
    expect(honourableLockedWidthRangeIn(refusal, LIMITS)).toEqual({ narrowestIn: 24, widestIn: 48 });
  });
});

describe("findUnhonouredLockedWidths", () => {
  it("reports a refused pin per wall and says nothing about an honoured one", () => {
    const found = findUnhonouredLockedWidths({
      A: [std(36, 48), std(40)], // payable
      B: [std(36, 48)], // nothing to pay with
      C: [std(40), std(40)], // no pin at all
    });
    expect(found.map((f) => [f.wallId, f.slotIndex, f.lockedWidthIn])).toEqual([["B", 0, 48]]);
  });

  it("does not flag a pin that IS in force on the wall it reads", () => {
    // The committed state of wall A above, after the plan ran.
    const committed = planLockedWidthReforce([std(36, 48), std(40)]).slots;
    expect(findUnhonouredLockedWidths({ A: committed })).toEqual([]);
  });

  it("tolerates a missing slot array", () => {
    expect(findUnhonouredLockedWidths({ A: undefined as unknown as PanelSlot[] })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// THE NAMED CASE, end to end through the reconcile.
//
// `reconcileBracedPlacement` is where the defect lived, and the sweeps below go
// through it rather than through the planner alone — the planner being right is
// not the same claim as the wall being right.
// ---------------------------------------------------------------------------
describe("reconcileBracedPlacement vs. a pin the wall cannot honour", () => {
  const WINDOW: OpeningAnchor[] = [{ beforeStandardCount: 0, type: "window", widthIn: 61.5 }];

  const namedWall = (lockIn: number) => {
    const tiled = retileWithOpenings(150, 40, CORNER_WIDTH_IN, "end", true, true, WINDOW).slots;
    const old = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, 40, "chevron", false).map((s) => ({ ...s }));
    const pinned = old.findIndex((s) => s.type === "standard" || s.type === "braced");
    old[pinned] = { ...old[pinned]!, widthIn: lockIn, lockedWidthIn: lockIn };
    const fresh = retileWithOpenings(150, 40, CORNER_WIDTH_IN, "end", true, true, WINDOW).slots;
    return reconcileBracedPlacement(old, fresh, SEISMIC_SPACING_IN, 40, "chevron", false);
  };

  it("leaves a 150in wall 150in long for both of the report's lock values", () => {
    // ⚠ These two walls used to come out 161 1/4in and 137 1/4in — the figures the
    // Open Items bullet names. Measured on this fixture before the fix and
    // reproduced exactly; see the sweep below for the whole 8,004-case picture.
    for (const lockIn of [48, 24]) {
      const out = namedWall(lockIn);
      expect(e8(out)).toBe(8 * 150);
      expect(out.some((s) => s.widthIn === 0)).toBe(false);
      // The pin is refused, not partly applied: the slot keeps the tiler's
      // 36 3/4in and still carries its own lock.
      const pinned = out.find((s) => s.lockedWidthIn !== undefined)!;
      expect(pinned.widthIn).toBe(36.75);
      expect(pinned.lockedWidthIn).toBe(lockIn);
    }
  });

  it("reports that refusal with the widest legal value on it", () => {
    const refusals = findUnhonouredLockedWidths({ "wall-1": namedWall(48) });
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatchObject({ wallId: "wall-1", lockedWidthIn: 48, tiledWidthIn: 36.75, freePanelCount: 0 });
    expect(honourableLockedWidthRangeIn(refusals[0]!, LIMITS)).toEqual({ narrowestIn: 36.75, widestIn: 36.75 });
  });

  it("still honours a pin the wall CAN pay for, which is the whole point of the feature", () => {
    const tiled = retileWithOpenings(400, 40, CORNER_WIDTH_IN, "end", true, true, []).slots;
    const old = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, 40, "chevron", false).map((s) => ({ ...s }));
    const pinned = old.findIndex((s) => s.type === "standard" || s.type === "braced");
    old[pinned] = { ...old[pinned]!, widthIn: 30, lockedWidthIn: 30 };
    const fresh = retileWithOpenings(400, 40, CORNER_WIDTH_IN, "end", true, true, []).slots;
    const out = reconcileBracedPlacement(old, fresh, SEISMIC_SPACING_IN, 40, "chevron", false);
    expect(e8(out)).toBe(8 * 400);
    expect(out.find((s) => s.lockedWidthIn !== undefined)!.widthIn).toBe(30);
    expect(findUnhonouredLockedWidths({ w: out })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// THE SWEEP.
//
// The same discipline the corner-brace combine's 790,440-case product sweep
// uses, aimed at the one invariant Tommy stated: **the wall's real length is
// never violated.** It runs the WHOLE path a real wall takes — tile, brace,
// pin, re-tile, reconcile — rather than the planner in isolation.
//
// WHAT IT COVERS: every eighth of wall length from 100in to 400in x standard
// widths {40, 48} x 4 corner configs x 2 gap ends x 3 opening sets x 2 lock
// values {24in, 48in} x 3 pin placements (first standard-family slot, last, and
// both at once).
//
// WHAT IT DELIBERATELY DOES NOT COVER, so "not covered" stays distinguishable
// from "covered and passing":
//
//   * **The tiler's own opening overflow.** A wall too short to hold its own
//     openings does not sum to itself before this code runs at all (74,724 of
//     the braced sweep's 790,440 cases, its own Open Item). Those cases are
//     swept, and the invariant asserted against THE TILER'S OWN TOTAL rather
//     than the wall's length — so the reconcile is still forbidden to move the
//     total by an eighth, it is simply not blamed for a total that was already
//     wrong. `wallSumAsserted` below counts how often the stronger form applied.
//   * **Walls under 100in and over 400in.** The pin arithmetic is per-slot and
//     has no length term; the braced sweep already covers 12in-600in for the
//     tiling and bracing underneath it. 100in is the narrowest wall this fixture
//     can pin a standard slot on with a 61.5in window and two corners.
//   * **Pins outside [24in, 48in]**, and pins on anything but a standard-family
//     slot. Both are tested as units above rather than swept.
//   * **A second story, zones, mid-wall beams, headers, run stops.** None of
//     them changes a slot's width, which is all this code reads.
//   * **The 39in Square Bale standard width.** Dropped for runtime; the two
//     widths swept are the ones the Open Item names, and 39in walls differ only
//     in how the tiler splits the free run.
// ---------------------------------------------------------------------------
describe("the sweep: a pinned width never moves the wall's own total", () => {
  const MIN_IN = TILER_MIN_PANEL_WIDTH_IN;
  const MAX_IN = TILER_MAX_PANEL_WIDTH_IN;
  const win = (beforeStandardCount: number, widthIn: number): OpeningAnchor => ({ beforeStandardCount, type: "window", widthIn });
  const OPENING_SETS: { name: string; openings: OpeningAnchor[] }[] = [
    { name: "none", openings: [] },
    { name: "one 61.5in window against the corner", openings: [win(0, 61.5)] },
    { name: "two 36in windows straddling the run", openings: [win(0, 36), win(2, 36)] },
  ];
  const CORNER_CONFIGS: [boolean, boolean][] = [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ];
  const PLACEMENTS = ["first", "last", "both"] as const;

  const outOfBounds = (slots: PanelSlot[]) => {
    let n = 0;
    for (const s of slots) {
      if (s.type !== "standard" && s.type !== "braced") continue;
      if (s.widthIn < MIN_IN - 1e-9 || s.widthIn > MAX_IN + 1e-9) n++;
    }
    return n;
  };

  it("holds the invariant across every wall length, corner config, opening set, lock value and pin placement", () => {
    const violations: string[] = [];
    let cases = 0;
    let wallSumAsserted = 0;
    let pinsHonoured = 0;
    let pinsRefused = 0;
    for (let e = 100 * 8; e <= 400 * 8; e++) {
      const wallLengthIn = e / 8;
      for (const standardWidthIn of [40, 48]) {
        for (const [hasStart, hasEnd] of CORNER_CONFIGS) {
          for (const gapEnd of ["start", "end"] as const) {
            for (const { name, openings } of OPENING_SETS) {
              const tiled = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasStart, hasEnd, openings).slots;
              const tiledEighths = e8(tiled);
              const braced = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
              const bracedOut = outOfBounds(braced);
              const family: number[] = [];
              braced.forEach((s, i) => {
                if (s.type === "standard" || s.type === "braced") family.push(i);
              });
              if (family.length === 0) continue;
              for (const lockIn of [24, 48]) {
                for (const placement of PLACEMENTS) {
                  cases++;
                  // Deduped: on a one-panel run "both" is the same slot twice,
                  // and a wall with exactly one standard-family slot is the
                  // named 150in case — the most important row in the sweep.
                  const pinAt = [
                    ...new Set(
                      placement === "first"
                        ? [family[0]!]
                        : placement === "last"
                          ? [family[family.length - 1]!]
                          : [family[0]!, family[family.length - 1]!],
                    ),
                  ];
                  const old = braced.map((s, i) =>
                    pinAt.includes(i) ? { ...s, widthIn: lockIn, lockedWidthIn: lockIn } : { ...s },
                  );
                  const fresh = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasStart, hasEnd, openings).slots;
                  const out = reconcileBracedPlacement(old, fresh, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
                  const label = `${wallLengthIn}in/${standardWidthIn}/${hasStart ? "S" : "-"}${hasEnd ? "E" : "-"}/${gapEnd}/${name}/lock${lockIn}/${placement}`;

                  // 1. THE INVARIANT. Against the tiler's own total always, and
                  //    against the wall's real length whenever the tiler got
                  //    that right (see the carve-out note above).
                  if (e8(out) !== tiledEighths) {
                    violations.push(`${label}: moved the total, ${tiledEighths} -> ${e8(out)} eighths`);
                    continue;
                  }
                  if (tiledEighths === e) {
                    wallSumAsserted++;
                  }
                  // 2. No 0in panel — the old clamp's own signature.
                  if (out.some((s) => Math.round(s.widthIn * 8) === 0)) {
                    violations.push(`${label}: a 0in slot`);
                    continue;
                  }
                  // 3. No panel pushed out of the shop's range that the brace
                  //    pass had not already left there.
                  if (outOfBounds(out) > bracedOut) {
                    violations.push(`${label}: ${outOfBounds(out)} panels outside [${MIN_IN},${MAX_IN}] vs the brace pass's ${bracedOut}`);
                    continue;
                  }
                  // 4. ALL OR NOTHING, per pin: either the pin is in force, or
                  //    it is reported as refused at exactly the width the slot
                  //    kept. Nothing in between, and no pin is ever cleared.
                  const replan = planLockedWidthReforce(out);
                  const reported = new Map(replan.refusals.map((r) => [r.slotIndex, r]));
                  let partial = "";
                  let locks = 0;
                  out.forEach((s, i) => {
                    if (s.lockedWidthIn === undefined) return;
                    locks++;
                    if (Math.round(s.widthIn * 8) === Math.round(s.lockedWidthIn * 8)) {
                      pinsHonoured++;
                      if (reported.has(i)) partial = `slot ${i} is in force and reported refused`;
                      return;
                    }
                    pinsRefused++;
                    const refusal = reported.get(i);
                    if (!refusal) partial = `slot ${i} is at ${s.widthIn}in, not its ${s.lockedWidthIn}in pin, and is not reported`;
                    else if (Math.round(refusal.tiledWidthIn * 8) !== Math.round(s.widthIn * 8)) {
                      partial = `slot ${i} reported at ${refusal.tiledWidthIn}in but sits at ${s.widthIn}in`;
                    }
                  });
                  if (locks !== pinAt.length) partial = `${locks} pins survived of ${pinAt.length} set`;
                  if (partial) {
                    violations.push(`${label}: ${partial}`);
                    continue;
                  }
                  // 5. Idempotent. An unrelated edit elsewhere in the building
                  //    re-reconciles every wall, so a second pass must be a
                  //    no-op or the cut list depends on edit history.
                  if (e8(replan.slots) !== tiledEighths) {
                    violations.push(`${label}: a second plan moved the total`);
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
    // Non-vacuous on all three counts: the sweep is the size it claims, it
    // asserted the STRONG form of the invariant (against the wall's own real
    // length) on every single case, and it really did reach both outcomes rather
    // than only the easy one.
    //
    // Measured 2026-09-30 on this grid: 684,588 cases, 889,606 pins set,
    // **605,669 honoured and 283,937 refused**. The refusals are bounded rather
    // than pinned exactly, because the split between them is a function of the
    // TILER's free-run widths and would move for reasons that have nothing to do
    // with this file; the invariant above is what is pinned.
    expect(cases).toBe(684_588);
    // The weaker form of the invariant — against the tiler's own total on a wall
    // the tiler itself does not sum — is reachable code that this grid never
    // reaches, because 100in is long enough to hold every opening set here. It
    // stays so that extending the grid down into short walls cannot silently
    // drop the assertion instead of failing.
    expect(wallSumAsserted).toBe(cases);
    expect(pinsRefused).toBeGreaterThan(100_000);
    expect(pinsHonoured).toBeGreaterThan(100_000);
  });

  // ---------------------------------------------------------------------------
  // THE ROW THE SWEEP ABOVE WAS MISSING, AND THE ONE THE REGRESSION HID IN.
  //
  // `PLACEMENTS`' `both` sets **the same** lock value on the first and last
  // standard-family slot, so the grid above never once constructs a
  // **residual-cancelling pair** — two pins set to DIFFERENT widths that sum to
  // what the pair already holds. That is not an exotic input: the elevation
  // boundary drag writes `lockedWidthIn` on BOTH halves of the pair it moves, so
  // it produces exactly this shape on every single use, and Tommy's 2026-09-30
  // decision to tile only on the first draw makes an all-pinned run ordinary.
  //
  // All-or-nothing and no-pin-cleared both pass happily while both pins are
  // thrown away, which is how a strictly-worse-than-`main` outcome went
  // unobserved through 684,588 cases. **This row fails on the per-pin planner**
  // wherever the pair has no free panel to lean on, and it asserts the thing the
  // properties above cannot: the pair is HONOURED.
  // ---------------------------------------------------------------------------
  it("honours a pin PAIR set to two DIFFERENT widths that sum to what the pair already holds", () => {
    const violations: string[] = [];
    let cases = 0;
    let pairsWithNoFreePanel = 0;
    for (let e = 100 * 8; e <= 400 * 8; e++) {
      const wallLengthIn = e / 8;
      for (const standardWidthIn of [40, 48]) {
        for (const [hasStart, hasEnd] of CORNER_CONFIGS) {
          for (const gapEnd of ["start", "end"] as const) {
            for (const { name, openings } of OPENING_SETS) {
              const tiled = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasStart, hasEnd, openings).slots;
              const tiledEighths = e8(tiled);
              const braced = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
              const bracedOut = outOfBounds(braced);
              const family: number[] = [];
              braced.forEach((s, i) => {
                if (s.type === "standard" || s.type === "braced") family.push(i);
              });
              // A PAIR is the whole point, so a one-panel run has nothing to say
              // here — it is the `first`/`last` rows' case and is covered above.
              if (family.length < 2) continue;
              const first = family[0]!;
              const last = family[family.length - 1]!;
              for (const offsetIn of [4.5, 12]) {
                // Move the pair's own width across the pair: one half wider by
                // `offsetIn`, the other narrower by it, which is arithmetically
                // what the boundary drag does.
                const pinFirst = braced[first]!.widthIn + offsetIn;
                const pinLast = braced[last]!.widthIn - offsetIn;
                // Both halves have to be widths a shop would build, or the pinned
                // slot itself is the panel out of range and property 3 below would
                // be asserting the wrong thing about it.
                if (pinFirst < MIN_IN || pinFirst > MAX_IN || pinLast < MIN_IN || pinLast > MAX_IN) continue;
                cases++;
                const old = braced.map((s, i) =>
                  i === first
                    ? { ...s, widthIn: pinFirst, lockedWidthIn: pinFirst }
                    : i === last
                      ? { ...s, widthIn: pinLast, lockedWidthIn: pinLast }
                      : { ...s },
                );
                const fresh = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasStart, hasEnd, openings).slots;
                const out = reconcileBracedPlacement(old, fresh, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
                const label = `${wallLengthIn}in/${standardWidthIn}/${hasStart ? "S" : "-"}${hasEnd ? "E" : "-"}/${gapEnd}/${name}/pair±${offsetIn}`;

                // The four properties the row above holds, unchanged: the total,
                // no 0in panel, nothing newly outside the shop's range, and
                // idempotence.
                if (e8(out) !== tiledEighths) {
                  violations.push(`${label}: moved the total, ${tiledEighths} -> ${e8(out)} eighths`);
                  continue;
                }
                if (out.some((s) => Math.round(s.widthIn * 8) === 0)) {
                  violations.push(`${label}: a 0in slot`);
                  continue;
                }
                if (outOfBounds(out) > bracedOut) {
                  violations.push(`${label}: ${outOfBounds(out)} panels outside [${MIN_IN},${MAX_IN}] vs the brace pass's ${bracedOut}`);
                  continue;
                }
                // THE NEW ONE. Both pins survived the reconcile and both are IN
                // FORCE at their own exact width — which is what `main` did on
                // these walls and what per-pin planning stopped doing.
                const pins = out.filter((s) => s.lockedWidthIn !== undefined);
                if (pins.length !== 2) {
                  violations.push(`${label}: ${pins.length} pins survived of 2 set`);
                  continue;
                }
                const notInForce = pins.filter((s) => Math.round(s.widthIn * 8) !== Math.round(s.lockedWidthIn! * 8));
                if (notInForce.length > 0) {
                  violations.push(
                    `${label}: ${notInForce.length} of 2 pins refused (${notInForce.map((s) => `${s.widthIn}in vs ${s.lockedWidthIn}in`).join(", ")})`,
                  );
                  continue;
                }
                const replan = planLockedWidthReforce(out);
                if (replan.refusals.length > 0) violations.push(`${label}: re-planning the committed run reports ${replan.refusals.length} refusals`);
                else if (e8(replan.slots) !== tiledEighths) violations.push(`${label}: a second plan moved the total`);
                // Non-vacuity, counted rather than hoped for: how many of these
                // pairs had NO free panel to lean on, i.e. are payable only
                // because the two residuals cancel. These are the cases the
                // per-pin planner lost outright.
                if (!out.some((s) => (s.type === "standard" || s.type === "braced") && s.lockedWidthIn === undefined)) pairsWithNoFreePanel++;
              }
            }
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
    // Measured 2026-09-30 on this grid: **60,777 cases, 0 violations.**
    expect(cases).toBe(60_777);
    // Non-vacuity, and the proof this row earns its runtime: how many of these
    // pairs have NO free panel to lean on, i.e. are payable ONLY because the two
    // residuals cancel. **Measured 7,296 — and run against the per-pin planner
    // this row reported 7,296 violations of 60,777 cases, every single one of
    // them a "2 of 2 pins refused" on exactly those 7,296 pairs.** So the row is
    // not merely red before the fix; the regression and the no-free-panel pairs
    // are the same set, which is what says the diagnosis is the right one. The
    // figure is bounded rather than pinned because it is a function of the
    // TILER's free-run widths, like the honoured/refused split above.
    expect(pairsWithNoFreePanel).toBeGreaterThan(5_000);
  });

  // The route a user actually takes to a pin the wall cannot honour: the pin was
  // LEGAL when it was set, and a later edit — here the wall dragged shorter —
  // took the room away. Coarser (every inch, one opening set) because it tiles
  // two different lengths per case.
  it("holds the invariant when the pin came from a LONGER version of the wall", () => {
    const violations: string[] = [];
    let cases = 0;
    let refused = 0;
    for (let was = 120; was <= 400; was++) {
      for (const shrinkBy of [12, 48, 96]) {
        const now = was - shrinkBy;
        if (now < 60) continue;
        for (const standardWidthIn of [40, 48]) {
          for (const openings of [[], [win(0, 61.5)]]) {
            cases++;
            const before = retileWithOpenings(was, standardWidthIn, CORNER_WIDTH_IN, "end", true, true, openings).slots;
            const old = applyBracedPlacement(before, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false).map((s) => ({ ...s }));
            const pinned = old.findIndex((s) => s.type === "standard" || s.type === "braced");
            if (pinned < 0) continue;
            // A width the LONGER wall could honour, pinned there.
            old[pinned] = { ...old[pinned]!, widthIn: 42, lockedWidthIn: 42 };
            const fresh = retileWithOpenings(now, standardWidthIn, CORNER_WIDTH_IN, "end", true, true, openings).slots;
            const freshEighths = e8(fresh);
            const out = reconcileBracedPlacement(old, fresh, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
            if (e8(out) !== freshEighths) {
              violations.push(`${was}in -> ${now}in/${standardWidthIn}/${openings.length} openings: ${freshEighths} -> ${e8(out)} eighths`);
              continue;
            }
            if (out.some((s) => Math.round(s.widthIn * 8) === 0)) violations.push(`${was}in -> ${now}in: a 0in slot`);
            if (findUnhonouredLockedWidths({ w: out }).length > 0) refused++;
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
    // Measured 2026-09-30: 3,228 cases, 727 of them with the pin refused.
    expect(cases).toBe(3_228);
    expect(refused).toBe(727);
  });
});
