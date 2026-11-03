import { describe, expect, it } from "vitest";
import { shiftSlotCoverage } from "./panelPlacement";
import { NARROW_SAFETY_GAP_WIDTH_IN, safetyGapWidthForRunIn } from "./tiling";
import type { PanelSlot } from "./types";
import { uncombineSafetyGapSlots } from "./uncombineSafetyGaps";

/**
 * ⚠ **These fixtures are hand-built on purpose, and it is the only way they
 * can be built.** A combined slot was produced by `planCornerBraceCombine`,
 * which was deleted in the same change this file arrives with — so there is no
 * longer any code in the app that can generate the input. What is written out
 * below is the SHAPE a project file saved before 2026-11-02 actually carries:
 * `type: "safety-gap"` with `secondaryType: "braced"` at a corner-adjacent
 * position, widened to `standardWidthIn + 3/4in`, with the panel it swallowed
 * absent from the run.
 */

const CORNER_IN = 15.5;

/** A 211-3/4in wall whose start-corner gap combined.
 *
 * ⚠ **The three standard panels are deliberately three DIFFERENT widths.**
 * An earlier version of this fixture made them all 48in, and the beam-shift
 * test below could then no longer tell a correctly-shifted range from an
 * unshifted one — both covered two panels that looked identical. Distinct
 * widths are what make that assertion mean anything. */
function combinedAtStart(): PanelSlot[] {
  return [
    { type: "corner", widthIn: CORNER_IN },
    { type: "safety-gap", secondaryType: "braced", widthIn: 48.75 },
    { type: "standard", widthIn: 48 },
    { type: "standard", widthIn: 44 },
    { type: "standard", widthIn: 40 },
    { type: "corner", widthIn: CORNER_IN },
  ];
}

const sumIn = (slots: readonly PanelSlot[]) => slots.reduce((a, s) => a + s.widthIn, 0);

describe("uncombineSafetyGapSlots", () => {
  it("is a true no-op on a run with no combined gap, down to the array reference", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_IN },
      { type: "standard", widthIn: 48 },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "corner", widthIn: CORNER_IN },
    ];
    const result = uncombineSafetyGapSlots(slots);
    // Reference equality, not deep equality: this runs over every wall of every
    // file on every load, and the overwhelming majority have nothing to do.
    expect(result.slots).toBe(slots);
    expect(result.insertedAt).toEqual([]);
    expect(result.unsplitGapCount).toBe(0);
  });

  it("splits a combined gap back into a gap and the panel it swallowed, without moving the wall", () => {
    const stored = combinedAtStart();
    const { slots, insertedAt, unsplitGapCount } = uncombineSafetyGapSlots(stored);

    // The property Tommy's standing rule is about: the parts still sum to the
    // whole. ("this app needs to be perfectly tight with dimensions and wall
    // lengths", 2026-09-29.)
    expect(sumIn(slots)).toBe(sumIn(stored));
    expect(slots.length).toBe(stored.length + 1);
    expect(unsplitGapCount).toBe(0);
    // Nothing is combined with anything any more — his actual request.
    expect(slots.some((s) => s.secondaryType !== undefined)).toBe(false);
    expect(slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", CORNER_IN],
      ["safety-gap", 0.75],
      ["standard", 48], // the panel that comes back
      ["standard", 48],
      ["standard", 44],
      ["standard", 40],
      ["corner", CORNER_IN],
    ]);
    expect(insertedAt).toEqual([2]);
  });

  it("restores the panel on the MIDDLE side of the gap, whichever end the gap sits at", () => {
    /* The reconstruction note on the source: the combine walked inward from a
       corner and ate the panel on the far side of the gap, so the restored
       panel belongs between the gap and the middle of the run. */
    const atEnd: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_IN },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "safety-gap", secondaryType: "braced", widthIn: 48.75 },
      { type: "corner", widthIn: CORNER_IN },
    ];
    const { slots, insertedAt } = uncombineSafetyGapSlots(atEnd);
    expect(slots.map((s) => s.type)).toEqual([
      "corner",
      "standard",
      "standard",
      "standard",
      "standard", // restored BEFORE the gap, i.e. toward the middle
      "safety-gap",
      "corner",
    ]);
    expect(insertedAt).toEqual([4]);
    expect(sumIn(slots)).toBe(sumIn(atEnd));
  });

  it("gives the gap the width its own RUN LENGTH earns, not a hardcoded 3/4in", () => {
    /* Tommy, 2026-09-30: *"once below the threshold (of 12'?) the safety gap is
       1/2\""*. He called the gaps "already measured out with our thresholds"
       when asking for this decoupling, so the split has to honour the tier
       rather than assume the wide sheet. */
    const shortRun: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_IN },
      { type: "safety-gap", secondaryType: "braced", widthIn: 48.5 },
      { type: "standard", widthIn: 30 },
      { type: "corner", widthIn: CORNER_IN },
    ];
    expect(sumIn(shortRun)).toBeLessThanOrEqual(144); // the thin-sheet side of the threshold
    expect(safetyGapWidthForRunIn(sumIn(shortRun))).toBe(NARROW_SAFETY_GAP_WIDTH_IN);

    const { slots } = uncombineSafetyGapSlots(shortRun);
    expect(slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", CORNER_IN],
      ["safety-gap", NARROW_SAFETY_GAP_WIDTH_IN],
      ["standard", 48], // 48.5 - 0.5, so the run still sums
      ["standard", 30],
      ["corner", CORNER_IN],
    ]);
    expect(sumIn(slots)).toBe(sumIn(shortRun));
  });

  it("hands back indices a stored beam range can be carried over, so a beam covers the same panels", () => {
    /* ⚠ The reason this function reports `insertedAt` at all. A Mid-Wall Bond
       Beam, the roofline Box Beam and a spanning header are each stored as
       `[startSlotIndex, endSlotIndex)` against the wall's run, and restoring a
       panel moves every index at or past it. `projectFile.ts` shifts them with
       `shiftSlotCoverage` on load; this proves the pair of numbers lines up. */
    const stored = combinedAtStart();
    const { slots, insertedAt } = uncombineSafetyGapSlots(stored);

    // A beam over the two panels that were slots 3 and 4 of the stored run.
    const beam = { startSlotIndex: 3, endSlotIndex: 5 };
    const covered = (range: { startSlotIndex: number; endSlotIndex: number }, run: PanelSlot[]) =>
      run.slice(range.startSlotIndex, range.endSlotIndex);
    const before = covered(beam, stored);

    const shifted = insertedAt.reduce<typeof beam | null>(
      (acc, at) => (acc === null ? null : shiftSlotCoverage(acc, at, 1)),
      beam,
    );
    expect(shifted).not.toBeNull();
    expect(shifted).toEqual({ startSlotIndex: 4, endSlotIndex: 6 });
    // Same panels, by type and width, which is what a shop drawing reads.
    expect(covered(shifted!, slots).map((s) => [s.type, s.widthIn])).toEqual(before.map((s) => [s.type, s.widthIn]));
    // Un-shifted, it would have covered a different pair — this is the slide
    // the shift exists to prevent, stated rather than implied.
    expect(covered(beam, slots).map((s) => [s.type, s.widthIn])).not.toEqual(before.map((s) => [s.type, s.widthIn]));
  });

  it("refuses to split when the restored panel would be unbuildable, and says it refused", () => {
    /* Not reachable from a file this app wrote — the combine's own plan refused
       anything leaving a panel outside the tiler's bounds — so this covers the
       hand-edited/synthetic case rather than asserting it away. The gap loses
       its `secondaryType` either way, because that is what he asked for; what
       it does not do is invent a 4in panel. */
    const degenerate: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_IN },
      { type: "safety-gap", secondaryType: "braced", widthIn: 5 },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: CORNER_IN },
    ];
    const { slots, insertedAt, unsplitGapCount } = uncombineSafetyGapSlots(degenerate);
    expect(unsplitGapCount).toBe(1);
    expect(insertedAt).toEqual([]);
    expect(slots.length).toBe(degenerate.length);
    expect(sumIn(slots)).toBe(sumIn(degenerate));
    expect(slots[1]).toEqual({ type: "safety-gap", widthIn: 5 });
  });

  it("handles both ends of a wall that combined twice, in one pass", () => {
    const both: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_IN },
      { type: "safety-gap", secondaryType: "braced", widthIn: 48.75 },
      { type: "standard", widthIn: 48 },
      { type: "standard", widthIn: 48 },
      { type: "safety-gap", secondaryType: "braced", widthIn: 48.75 },
      { type: "corner", widthIn: CORNER_IN },
    ];
    const { slots, insertedAt, unsplitGapCount } = uncombineSafetyGapSlots(both);
    expect(unsplitGapCount).toBe(0);
    expect(slots.length).toBe(both.length + 2);
    expect(sumIn(slots)).toBe(sumIn(both));
    expect(slots.map((s) => s.type)).toEqual([
      "corner",
      "safety-gap",
      "standard",
      "standard",
      "standard",
      "standard",
      "safety-gap",
      "corner",
    ]);
    // Ascending, and each one against the run AS IT STANDS at that point —
    // the second is 5, not 6, because the first restored panel has already
    // joined the run by then. That is exactly the convention
    // `shiftSlotCoverage` wants, which is what makes a left-to-right `reduce`
    // of it correct rather than coincidental.
    expect(insertedAt).toEqual([2, 5]);
  });
});
