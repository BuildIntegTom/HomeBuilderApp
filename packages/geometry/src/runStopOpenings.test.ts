import { describe, expect, it } from "vitest";
import { toEighths } from "./eighths";
import { retileWithOpenings, type OpeningAnchor } from "./tiling";
import {
  mergeRunStopOpenings,
  partitionOpeningsByRunStop,
  runStopOpeningFit,
  type RunStopOpeningPartitionInput,
} from "./runStopOpenings";

// The catalog's real corner panel (25.5in, confirmed) and standard width —
// this defect is about a wall Tommy actually drew, so the fixture uses the
// numbers his walls actually carry rather than a round fixture value.
const CORNER_IN = 25.5;
const STANDARD_IN = 40;
const MIN_PANEL_IN = 24;

const anchor = (beforeStandardCount: number, widthIn: number, extra: Partial<OpeningAnchor> = {}): OpeningAnchor => ({
  beforeStandardCount,
  type: "window",
  widthIn,
  ...extra,
});

/** A basis run with both corners and no stop yet — the shape every case below
 * varies one thing from. */
function input(over: Partial<RunStopOpeningPartitionInput> & { basisLengthIn: number }): RunStopOpeningPartitionInput {
  const startStopIn = over.startStopIn ?? 0;
  const endStopIn = over.endStopIn ?? 0;
  return {
    basisHasCornerStart: true,
    basisHasCornerEnd: true,
    builtLengthIn: over.basisLengthIn - startStopIn - endStopIn,
    builtHasCornerStart: startStopIn === 0,
    builtHasCornerEnd: endStopIn === 0,
    startStopIn,
    endStopIn,
    standardWidthIn: STANDARD_IN,
    cornerWidthIn: CORNER_IN,
    gapEnd: "end",
    allowBorrow: true,
    cornerMayWiden: true,
    openings: [],
    ...over,
  };
}

const sumIn = (slots: { widthIn: number }[]) => slots.reduce((s, x) => s + x.widthIn, 0);

/** Tiles the BUILT run the way `retile` would, and returns the sum error in
 * eighths — 0 is the invariant Tommy's message was complaining about. */
function builtSumErrorEighths(i: RunStopOpeningPartitionInput, kept: OpeningAnchor[]): number {
  const { slots } = retileWithOpenings(
    i.builtLengthIn,
    i.standardWidthIn,
    i.cornerWidthIn,
    i.gapEnd,
    i.builtHasCornerStart,
    i.builtHasCornerEnd,
    kept,
    i.allowBorrow,
    i.cornerMayWiden,
  );
  return toEighths(sumIn(slots)) - toEighths(i.builtLengthIn);
}

// ---------------------------------------------------------------------------
// The defect itself — Tommy's 174in, reproduced and then fixed
// ---------------------------------------------------------------------------
describe("the 174in boundary Tommy hit", () => {
  // Two windows and two corner panels: 2 x 61.5 + 2 x 25.5 = 174in exactly.
  const twoWindows = [anchor(1, 61.5), anchor(3, 61.5)];

  it("is exactly this wall's own openings-plus-corners total, to the eighth", () => {
    const requiredIn = 2 * 61.5 + 2 * CORNER_IN;
    expect(requiredIn).toBe(174);

    // Unfixed behaviour, asserted directly against the tiler so the boundary
    // stays on the record: every run BELOW 174in breaks the sum invariant,
    // and 174in itself is the first run that does not.
    const broken: number[] = [];
    for (let e = toEighths(51); e < toEighths(200); e++) {
      const lengthIn = e / 8;
      const { slots } = retileWithOpenings(lengthIn, STANDARD_IN, CORNER_IN, "end", true, true, twoWindows, true, true);
      if (toEighths(sumIn(slots)) !== e) broken.push(lengthIn);
    }
    expect(broken[broken.length - 1]).toBe(173.875);
    expect(broken).not.toContain(174);
  });

  it("a stop that leaves less than 174in now drops a window instead of breaking the sum", () => {
    // A 25ft wall: 300in. Stopping 174in off the far end leaves 126in built —
    // the exact shape of Tommy's complaint.
    const i = input({ basisLengthIn: 300, endStopIn: 174, openings: twoWindows });
    const { kept, unbuilt } = partitionOpeningsByRunStop(i);
    expect(kept.length + unbuilt.length).toBe(2);
    expect(unbuilt.length).toBeGreaterThan(0);
    expect(builtSumErrorEighths(i, kept)).toBe(0);
  });

  it("holds at EVERY eighth of stop on that wall, from 0 to the whole length", () => {
    const failures: string[] = [];
    for (let e = 0; e <= toEighths(300); e++) {
      const endStopIn = e / 8;
      const i = input({ basisLengthIn: 300, endStopIn, openings: twoWindows });
      if (i.builtLengthIn <= 0) continue;
      const { kept, unbuilt } = partitionOpeningsByRunStop(i);
      if (kept.length + unbuilt.length !== 2) failures.push(`${endStopIn}: lost an opening`);
      const err = builtSumErrorEighths(i, kept);
      if (err !== 0) failures.push(`${endStopIn}: sum off by ${err} eighths`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Drop, and remember
// ---------------------------------------------------------------------------
describe("partitionOpeningsByRunStop", () => {
  const three = [anchor(1, 47.625), anchor(3, 41.5), anchor(5, 37.5, { type: "door" })];

  it("returns an unstopped wall's openings untouched, by reference", () => {
    const i = input({ basisLengthIn: 300, openings: three });
    const { kept, unbuilt } = partitionOpeningsByRunStop(i);
    expect(kept).toBe(three);
    expect(unbuilt).toEqual([]);
  });

  // The 300in basis run these cases are read off, measured rather than
  // assumed (`retileWithOpenings(300, 40, 25.5, "end", true, true, three)`):
  //
  //   corner   0      .. 25.5
  //   standard 25.5   .. 65.5
  //   window   65.5   .. 113.125   <- three[0]
  //   standard 113.125.. 154.75
  //   gap      154.75 .. 155.5
  //   standard 155.5  .. 195.5
  //   window   195.5  .. 237       <- three[1]
  //   door     237    .. 274.5     <- three[2]
  //   corner   274.5  .. 300
  it("withholds only the openings the stopped-off span actually covers", () => {
    // 60in off the far end leaves [0, 240]: the door at 237-274.5 is inside
    // the unbuilt span, the two windows are not.
    const fromEnd = partitionOpeningsByRunStop(input({ basisLengthIn: 300, endStopIn: 60, openings: three }));
    expect(fromEnd.unbuilt).toEqual([three[2]]);
    expect(fromEnd.kept).toEqual([three[0], three[1]]);

    // 120in off the start leaves [120, 300]: the first window (65.5-113.125)
    // is gone, the window and door past it are not.
    const fromStart = partitionOpeningsByRunStop(input({ basisLengthIn: 300, startStopIn: 120, openings: three }));
    expect(fromStart.unbuilt).toEqual([three[0]]);
    expect(fromStart.kept).toEqual([three[1], three[2]]);
  });

  it("handles BOTH ends stopped at once, and keeps only what is left in the middle", () => {
    // [120, 260]: the first window falls off the start, the door off the far
    // end, and only the middle window is built.
    const i = input({ basisLengthIn: 300, startStopIn: 120, endStopIn: 40, openings: three });
    const { kept, unbuilt } = partitionOpeningsByRunStop(i);
    expect(kept).toEqual([three[1]]);
    expect(unbuilt).toEqual([three[0], three[2]]);
    // No corner panel survives when both ends are stopped.
    expect(i.builtHasCornerStart).toBe(false);
    expect(i.builtHasCornerEnd).toBe(false);
    expect(builtSumErrorEighths(i, kept)).toBe(0);
  });

  it("withholds every opening on a fully-stopped wall, and builds nothing", () => {
    const i = input({ basisLengthIn: 300, startStopIn: 300, openings: three });
    const { kept, unbuilt } = partitionOpeningsByRunStop(i);
    expect(kept).toEqual([]);
    expect(unbuilt).toEqual(three);
  });

  it("carries every field of a withheld opening through untouched, so a restore is exact", () => {
    // Same width and ordinal as `three[2]`, so the layout above is unchanged
    // — this case is about the FIELDS surviving, not about the geometry.
    const rich = anchor(5, 37.5, {
      type: "big-header",
      heightIn: 42,
      sillHeightIn: 30,
      includeSillOnBigHeader: true,
      zones: [{ type: "standard", heightIn: 42, sillHeightIn: 30, bracedPattern: "chevron", bracedMirrored: true }],
    });
    const openings = [three[0]!, three[1]!, rich];
    const { unbuilt } = partitionOpeningsByRunStop(input({ basisLengthIn: 300, endStopIn: 60, openings }));
    expect(unbuilt).toEqual([rich]);
    // Same object, not a rebuilt lookalike — nothing can be lost in a copy.
    expect(unbuilt[0]).toBe(rich);
  });

  it("un-stopping restores the wall to exactly the slots it had before the stop", () => {
    const basisLengthIn = 300;
    const before = retileWithOpenings(basisLengthIn, STANDARD_IN, CORNER_IN, "end", true, true, three, true, true).slots;

    const stopped = partitionOpeningsByRunStop(input({ basisLengthIn, endStopIn: 60, openings: three }));
    expect(stopped.unbuilt.length).toBe(1);

    // Un-stop: the built openings and the remembered ones merge back, and the
    // merged list re-tiles to the original slots, field for field.
    const restoredOpenings = mergeRunStopOpenings(stopped.kept, stopped.unbuilt);
    const after = retileWithOpenings(
      basisLengthIn,
      STANDARD_IN,
      CORNER_IN,
      "end",
      true,
      true,
      partitionOpeningsByRunStop(input({ basisLengthIn, openings: restoredOpenings })).kept,
      true,
      true,
    ).slots;
    expect(after).toEqual(before);
  });

  it("restores exactly after a partial un-stop too (the stop reduced, not cleared)", () => {
    const basisLengthIn = 300;
    const deep = partitionOpeningsByRunStop(input({ basisLengthIn, endStopIn: 120, openings: three }));
    expect(deep.unbuilt).toEqual([three[1], three[2]]);
    // Pull the stop back to 60in: one of the two withheld openings is built
    // again, the other stays remembered.
    const shallow = partitionOpeningsByRunStop(
      input({ basisLengthIn, endStopIn: 60, openings: mergeRunStopOpenings(deep.kept, deep.unbuilt) }),
    );
    expect(shallow.kept).toEqual([three[0], three[1]]);
    expect(shallow.unbuilt).toEqual([three[2]]);
  });
});

describe("mergeRunStopOpenings", () => {
  it("is the identity when nothing is remembered", () => {
    const current = [anchor(1, 36)];
    expect(mergeRunStopOpenings(current, undefined)).toBe(current);
    expect(mergeRunStopOpenings(current, [])).toBe(current);
  });

  it("puts a remembered opening back in its own original position", () => {
    const first = anchor(1, 36);
    const middle = anchor(3, 36);
    const last = anchor(5, 36);
    expect(mergeRunStopOpenings([first, last], [middle])).toEqual([first, middle, last]);
    expect(mergeRunStopOpenings([middle, last], [first])).toEqual([first, middle, last]);
    expect(mergeRunStopOpenings([first, middle], [last])).toEqual([first, middle, last]);
  });

  it("puts a remembered opening on the LEFT of a built one sharing its ordinal — fixed, not plausible", () => {
    const remembered = anchor(2, 36, { widthIn: 30 });
    const built = anchor(2, 36, { widthIn: 48 });
    expect(mergeRunStopOpenings([built], [remembered])).toEqual([remembered, built]);
  });
});

// ---------------------------------------------------------------------------
// Naming the real constraint instead of the sum symptom
// ---------------------------------------------------------------------------
describe("runStopOpeningFit", () => {
  it("reads a legal run back as legal, with the real numbers on it", () => {
    const slots = retileWithOpenings(300, STANDARD_IN, CORNER_IN, "end", true, true, [anchor(1, 61.5), anchor(3, 61.5)], true, true)
      .slots;
    const fit = runStopOpeningFit(slots, 300, MIN_PANEL_IN);
    expect(fit.openingCount).toBe(2);
    expect(fit.openingsTotalIn).toBe(123);
    expect(fit.cornerCount).toBe(2);
    expect(fit.cornersTotalIn).toBe(51);
    expect(fit.requiredIn).toBe(174);
    expect(fit.plainBudgetIn).toBe(126);
    expect(fit.refuses).toBe(false);
  });

  it("refuses a run whose leftover is real but under the shop minimum", () => {
    // One 61.5in window + one 25.5in corner = 87in of fixed content on a
    // 100in run: 13in left, which is not a panel anyone can build.
    const slots = retileWithOpenings(100, STANDARD_IN, CORNER_IN, "end", false, true, [anchor(0, 61.5)], true, true).slots;
    const fit = runStopOpeningFit(slots, 100, MIN_PANEL_IN);
    expect(fit.requiredIn).toBe(87);
    expect(fit.plainBudgetIn).toBe(13);
    expect(fit.refuses).toBe(true);
  });

  it("accepts a run that is EXACTLY its openings plus its corners — a zero budget is legal", () => {
    const slots = retileWithOpenings(87, STANDARD_IN, CORNER_IN, "end", false, true, [anchor(0, 61.5)], true, true).slots;
    const fit = runStopOpeningFit(slots, 87, MIN_PANEL_IN);
    expect(fit.plainBudgetIn).toBe(0);
    expect(fit.refuses).toBe(false);
  });

  it("reports the overrun as a NEGATIVE budget rather than hiding it", () => {
    // The unfixed case: a 100in run still reserving 174in of openings and
    // corners. This is what the old sum-invariant message was reporting at
    // one remove.
    const slots = retileWithOpenings(100, STANDARD_IN, CORNER_IN, "end", true, true, [anchor(1, 61.5), anchor(3, 61.5)], true, true)
      .slots;
    const fit = runStopOpeningFit(slots, 100, MIN_PANEL_IN);
    expect(fit.requiredIn).toBe(174);
    expect(fit.plainBudgetIn).toBe(-74);
    expect(fit.refuses).toBe(true);
  });

  it("says nothing about a run with no openings at all — that is the other refusals' job", () => {
    const slots = retileWithOpenings(100, STANDARD_IN, CORNER_IN, "end", false, true, [], true, true).slots;
    expect(runStopOpeningFit(slots, 100, MIN_PANEL_IN).refuses).toBe(false);
  });
});
