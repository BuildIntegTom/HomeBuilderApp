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
      { slotIndex: 3, lockedWidthIn: 48, tiledWidthIn: 36.75, freePanelCount: 0, canGiveUpIn: 0, canAbsorbIn: 0 },
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

  it("is a fixpoint: re-planning a planned run changes nothing and reports the same refusals", () => {
    for (const run of [
      [std(36, 48), std(30)],
      [std(36, 48), std(30), std(30, 24)],
      [std(30, 42), std(36), std(30, 42)],
      [std(40, 24), std(48), std(48)],
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
    const refusal = { slotIndex: 0, lockedWidthIn: 30, tiledWidthIn: 20, freePanelCount: 0, canGiveUpIn: 0, canAbsorbIn: 0 };
    expect(honourableLockedWidthRangeIn(refusal, LIMITS)).toBeNull();
  });

  it("clamps both ends into the catalog range", () => {
    const refusal = { slotIndex: 0, lockedWidthIn: 48, tiledWidthIn: 40, freePanelCount: 3, canGiveUpIn: 30, canAbsorbIn: 30 };
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
