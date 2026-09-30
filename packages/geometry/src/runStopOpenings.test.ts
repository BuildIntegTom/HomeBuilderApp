import { describe, expect, it } from "vitest";
import { toEighths } from "./eighths";
import { getOpeningAnchors, markSafetyCorner, retileWithOpenings, type OpeningAnchor } from "./tiling";
import {
  mergeRunStopOpenings,
  partitionOpeningsByRunStop,
  runStopOpeningFit,
  runStopRestoreFidelity,
  type RunStopOpeningMemory,
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

/**
 * The survivors as the APP sees them on the next re-tile: tiled onto the
 * shortened run and read back with `getOpeningAnchors`, exactly what
 * `tileOneWallPreservingOpenings` does.
 *
 * ⚠ **Restore tests must go through here and not feed `partition.kept` straight
 * back.** Feeding `kept` back preserves the pre-stop ordinals for free and so
 * cannot observe the defect this module's doc comment records: a survivor's
 * ordinal is RE-DERIVED against the shortened run, and before the memory
 * carried the pre-stop order, that could sort a survivor back past a remembered
 * opening and swap the two on the drawing.
 */
function survivorsAfterRetile(i: RunStopOpeningPartitionInput, kept: OpeningAnchor[]): OpeningAnchor[] {
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
  return getOpeningAnchors(slots);
}

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
    // stays on the record: 173.875in is the LAST run that breaks the sum
    // invariant, and nothing at or above 174in breaks it.
    const broken: number[] = [];
    for (let e = toEighths(51); e < toEighths(200); e++) {
      const lengthIn = e / 8;
      const { slots } = retileWithOpenings(lengthIn, STANDARD_IN, CORNER_IN, "end", true, true, twoWindows, true, true);
      if (toEighths(sumIn(slots)) !== e) broken.push(lengthIn);
    }
    expect(broken[broken.length - 1]).toBe(173.875);
    expect(broken.filter((b) => b >= 174)).toEqual([]);
    // ⚠ **NOT every eighth below the boundary breaks**, and the module doc
    // comment used to say it did. Counted here so the figure cannot drift: of
    // the 984 eighths from 51in to 173.875in, 793 break. The sharp thing is
    // the boundary, not the density below it.
    expect(broken.length).toBe(793);
    expect(toEighths(173.875) - toEighths(51) + 1).toBe(984);
  });

  it("a stop that leaves less than 174in now drops a window instead of breaking the sum", () => {
    // A 25ft wall: 300in. Stopping 174in off the far end leaves 126in built —
    // the exact shape of Tommy's complaint.
    const i = input({ basisLengthIn: 300, endStopIn: 174, openings: twoWindows });
    const { kept, memory } = partitionOpeningsByRunStop(i);
    expect(kept.length + memory.unbuilt.length).toBe(2);
    expect(memory.unbuilt.length).toBeGreaterThan(0);
    expect(builtSumErrorEighths(i, kept)).toBe(0);
  });

  it("holds at EVERY eighth of stop on that wall, from 0 to the whole length", () => {
    const failures: string[] = [];
    for (let e = 0; e <= toEighths(300); e++) {
      const endStopIn = e / 8;
      const i = input({ basisLengthIn: 300, endStopIn, openings: twoWindows });
      if (i.builtLengthIn <= 0) continue;
      const { kept, memory } = partitionOpeningsByRunStop(i);
      if (kept.length + memory.unbuilt.length !== 2) failures.push(`${endStopIn}: lost an opening`);
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
    const { kept, memory } = partitionOpeningsByRunStop(i);
    expect(kept).toBe(three);
    expect(memory.unbuilt).toEqual([]);
    expect(memory.preStop).toEqual([]);
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
    expect(fromEnd.memory.unbuilt).toEqual([three[2]]);
    expect(fromEnd.kept).toEqual([three[0], three[1]]);
    // The pre-stop order, recorded: two survivors then the withheld door, with
    // the ordinals they had BEFORE the stop — and what each one WAS, so a
    // survivor can be matched back to its own entry if the list changes while
    // the wall is stopped.
    expect(fromEnd.memory.preStop).toEqual([
      { beforeStandardCount: 1, withheld: false, payload: { type: "window", widthIn: 47.625 } },
      { beforeStandardCount: 3, withheld: false, payload: { type: "window", widthIn: 41.5 } },
      { beforeStandardCount: 5, withheld: true, payload: { type: "door", widthIn: 37.5 } },
    ]);

    // 120in off the start leaves [120, 300]: the first window (65.5-113.125)
    // is gone, the window and door past it are not.
    const fromStart = partitionOpeningsByRunStop(input({ basisLengthIn: 300, startStopIn: 120, openings: three }));
    expect(fromStart.memory.unbuilt).toEqual([three[0]]);
    expect(fromStart.kept).toEqual([three[1], three[2]]);
    expect(fromStart.memory.preStop).toEqual([
      { beforeStandardCount: 1, withheld: true, payload: { type: "window", widthIn: 47.625 } },
      { beforeStandardCount: 3, withheld: false, payload: { type: "window", widthIn: 41.5 } },
      { beforeStandardCount: 5, withheld: false, payload: { type: "door", widthIn: 37.5 } },
    ]);
  });

  it("handles BOTH ends stopped at once, and keeps only what is left in the middle", () => {
    // [120, 260]: the first window falls off the start, the door off the far
    // end, and only the middle window is built.
    const i = input({ basisLengthIn: 300, startStopIn: 120, endStopIn: 40, openings: three });
    const { kept, memory } = partitionOpeningsByRunStop(i);
    expect(kept).toEqual([three[1]]);
    expect(memory.unbuilt).toEqual([three[0], three[2]]);
    // No corner panel survives when both ends are stopped.
    expect(i.builtHasCornerStart).toBe(false);
    expect(i.builtHasCornerEnd).toBe(false);
    expect(builtSumErrorEighths(i, kept)).toBe(0);
  });

  it("withholds every opening on a fully-stopped wall, and builds nothing", () => {
    const i = input({ basisLengthIn: 300, startStopIn: 300, openings: three });
    const { kept, memory } = partitionOpeningsByRunStop(i);
    expect(kept).toEqual([]);
    expect(memory.unbuilt).toEqual(three);
    expect(memory.preStop.every((p) => p.withheld)).toBe(true);
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
    const { memory } = partitionOpeningsByRunStop(input({ basisLengthIn: 300, endStopIn: 60, openings }));
    expect(memory.unbuilt).toEqual([rich]);
    // Same object, not a rebuilt lookalike — nothing can be lost in a copy.
    expect(memory.unbuilt[0]).toBe(rich);
  });

  it("un-stopping restores the wall to exactly the slots it had before the stop", () => {
    const basisLengthIn = 300;
    const before = retileWithOpenings(basisLengthIn, STANDARD_IN, CORNER_IN, "end", true, true, three, true, true).slots;

    const stoppedInput = input({ basisLengthIn, endStopIn: 60, openings: three });
    const stopped = partitionOpeningsByRunStop(stoppedInput);
    expect(stopped.memory.unbuilt.length).toBe(1);

    // Un-stop: the survivors come back off the SHORTENED run's own slots (the
    // path the app takes), merge with the remembered ones, and the merged list
    // re-tiles to the original slots, field for field.
    const restoredOpenings = mergeRunStopOpenings(survivorsAfterRetile(stoppedInput, stopped.kept), stopped.memory);
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
    const deepInput = input({ basisLengthIn, endStopIn: 120, openings: three });
    const deep = partitionOpeningsByRunStop(deepInput);
    expect(deep.memory.unbuilt).toEqual([three[1], three[2]]);
    // Pull the stop back to 60in: one of the two withheld openings is built
    // again, the other stays remembered.
    const merged = mergeRunStopOpenings(survivorsAfterRetile(deepInput, deep.kept), deep.memory);
    const shallow = partitionOpeningsByRunStop(input({ basisLengthIn, endStopIn: 60, openings: merged }));
    expect(shallow.kept).toEqual([three[0], three[1]]);
    expect(shallow.memory.unbuilt).toEqual([three[2]]);
  });

  /**
   * The defect a review found in the first version of this change, at the unit
   * level; `retile.test.ts` drives the same shape end to end through
   * `retilePreservingOpeningsWithRunStopMemory`.
   *
   * A START stop is the failing direction: it drops the LOW-ordinal openings
   * and leaves the high-ordinal ones, and the survivors are then re-derived
   * against a shorter run, so their ordinals collapse BELOW the remembered
   * ones. A plain sort then restores them in the wrong order — a door where a
   * window was.
   */
  it("a start stop restores the wall in its ORIGINAL order, not the re-derived one", () => {
    const basisLengthIn = 300;
    const swapped: number[] = [];
    for (let startStopIn = 0; startStopIn <= 300; startStopIn += 0.125) {
      const i = input({ basisLengthIn, startStopIn, openings: three });
      if (i.builtLengthIn <= 0) continue;
      const stopped = partitionOpeningsByRunStop(i);
      if (stopped.memory.unbuilt.length === 0) continue;
      const restored = mergeRunStopOpenings(survivorsAfterRetile(i, stopped.kept), stopped.memory);
      // Same openings, same order, same widths — the drawing is the drawing.
      const got = restored.map((o) => `${o.type}:${o.widthIn}`).join("|");
      const want = three.map((o) => `${o!.type}:${o!.widthIn}`).join("|");
      if (got !== want) swapped.push(startStopIn);
    }
    expect(swapped.slice(0, 12)).toEqual([]);
  });
});

describe("mergeRunStopOpenings", () => {
  /** The memory a stop would have produced for `preStopAll`, withholding
   * exactly `withheld` — payloads included, exactly as
   * `partitionOpeningsByRunStop` records them. */
  const memoryFor = (preStopAll: OpeningAnchor[], withheld: OpeningAnchor[]): RunStopOpeningMemory => ({
    unbuilt: preStopAll.filter((o) => withheld.includes(o)),
    preStop: preStopAll.map((o) => ({
      beforeStandardCount: o.beforeStandardCount,
      withheld: withheld.includes(o),
      ...(o.heightIn === undefined
        ? { payload: { type: o.type, widthIn: o.widthIn } }
        : { payload: { type: o.type, widthIn: o.widthIn, heightIn: o.heightIn } }),
    })),
  });

  /** The same memory as it was written before `payload` existed — an in-flight
   * shape from this change's own earlier commits, or a hand-edited file. */
  const payloadlessMemoryFor = (preStopAll: OpeningAnchor[], withheld: OpeningAnchor[]): RunStopOpeningMemory => ({
    unbuilt: preStopAll.filter((o) => withheld.includes(o)),
    preStop: preStopAll.map((o) => ({ beforeStandardCount: o.beforeStandardCount, withheld: withheld.includes(o) })),
  });

  it("is the identity when nothing is remembered", () => {
    const current = [anchor(1, 36)];
    expect(mergeRunStopOpenings(current, undefined)).toBe(current);
    expect(mergeRunStopOpenings(current, { unbuilt: [], preStop: [] })).toBe(current);
  });

  it("puts a remembered opening back in its own original position", () => {
    const first = anchor(1, 36);
    const middle = anchor(3, 36);
    const last = anchor(5, 36);
    const all = [first, middle, last];
    expect(mergeRunStopOpenings([first, last], memoryFor(all, [middle]))).toEqual(all);
    expect(mergeRunStopOpenings([middle, last], memoryFor(all, [first]))).toEqual(all);
    expect(mergeRunStopOpenings([first, middle], memoryFor(all, [last]))).toEqual(all);
  });

  /**
   * **The must-fix, in one assertion.** The survivor's ordinal has been
   * re-derived against the shortened run and collapsed from 5 to 0, below the
   * remembered opening's 1. The old plain-sort merge put the survivor FIRST
   * here and swapped the two on the drawing; the recorded pre-stop order puts
   * them back the way the wall had them.
   */
  it("rebases a survivor whose ordinal was re-derived on the shortened run", () => {
    const withheldWindow = anchor(1, 61.5);
    const survivingDoor = anchor(5, 37.5, { type: "door" });
    const memory = memoryFor([withheldWindow, survivingDoor], [withheldWindow]);
    // What `getOpeningAnchors` reads back off the stopped wall: same door,
    // ordinal 0 instead of 5.
    const reDerived = anchor(0, 37.5, { type: "door" });
    expect(mergeRunStopOpenings([reDerived], memory)).toEqual([withheldWindow, survivingDoor]);
  });

  it("records which of two openings sharing an ordinal was on the left, rather than guessing", () => {
    const left = anchor(2, 30);
    const right = anchor(2, 48);
    // Withhold the left one: it comes back on the left.
    expect(mergeRunStopOpenings([right], memoryFor([left, right], [left]))).toEqual([left, right]);
    // Withhold the right one: it comes back on the right. The old merge listed
    // remembered entries first and could only ever produce the first answer.
    expect(mergeRunStopOpenings([left], memoryFor([left, right], [right]))).toEqual([left, right]);
  });

  it("keeps the ORDER even when an opening was added on the wall while it was stopped", () => {
    const withheld = anchor(1, 61.5);
    const survivor = anchor(5, 37.5, { type: "door" });
    const memory = memoryFor([withheld, survivor], [withheld]);
    // The user inserted a column while stopped, so there is no longer a
    // one-for-one correspondence to rebase through. The door still matches its
    // own recorded entry by payload, so it is rebased onto its pre-stop ordinal
    // 5; the inserted column has no entry to match and stays where it was
    // inserted relative to the door.
    const added = anchor(2, 21, { type: "column" });
    const merged = mergeRunStopOpenings([anchor(0, 37.5, { type: "door" }), added], memory);
    expect(merged.map((o) => o.type)).toEqual(["window", "door", "column"]);
    // Monotone ordinals, so `retileWithOpenings`' own sort cannot reorder them.
    expect(merged.map((o) => o.beforeStandardCount)).toEqual([1, 5, 5]);
  });

  /**
   * **Third-review must-fix, and the reason `payload` exists.** The promise
   * "order is still exact — no two openings can trade places" was FALSE here:
   * pre-stop `[door, WINDOW(withheld), column]`, the user deletes the door
   * while the wall is stopped, and the survivors read back as `[column]`. The
   * old fallback spliced the window in after 1 survivor and produced
   * `[column, window]` — the remembered window on the wrong side of a survivor.
   *
   * Matching the survivor to the entry it came from by payload puts it back
   * where it was, and the result is the pre-stop list minus the deleted door:
   * one deletion is no longer approximate at all.
   */
  it("restores on the correct side of a survivor after another opening was DELETED while stopped", () => {
    const door = anchor(1, 37.5, { type: "door" });
    const window = anchor(3, 61.5);
    const column = anchor(5, 21, { type: "column" });
    const memory = memoryFor([door, window, column], [window]);
    // The door is gone; the column is what `getOpeningAnchors` reads back off
    // the stopped run, with its ordinal re-derived down to 0.
    const merged = mergeRunStopOpenings([anchor(0, 21, { type: "column" })], memory);
    expect(merged.map((o) => o.type)).toEqual(["window", "column"]);
    expect(merged.map((o) => o.beforeStandardCount)).toEqual([3, 5]);
  });

  /** A memory written before `payload` existed cannot be matched that way, so
   * it degrades to the pre-payload answer — approximate, the window on the
   * wrong side here — rather than matching against nothing and scattering the
   * list. Nothing in the app writes this shape any more. */
  it("degrades to the recorded-position splice for a memory with no payloads", () => {
    const door = anchor(1, 37.5, { type: "door" });
    const window = anchor(3, 61.5);
    const column = anchor(5, 21, { type: "column" });
    const memory = payloadlessMemoryFor([door, window, column], [window]);
    const merged = mergeRunStopOpenings([anchor(0, 21, { type: "column" })], memory);
    expect(merged.map((o) => o.type)).toEqual(["column", "window"]);
  });

  /**
   * **The case that is still NOT exact, pinned so it cannot be claimed
   * otherwise.** One delete plus one insert leaves the count unchanged, so the
   * merge takes its exact path, which assumes survivor *i* is the *i*-th kept
   * entry — and here it is not. The window comes back between two openings it
   * was never between.
   *
   * Nothing is lost, and `runStopRestoreFidelity` reports `"approximate"`, which
   * is what stops the Review Log and the elevation notice promising "exactly as
   * drawn" for it. The real fix is stable opening ids, which is out of scope.
   */
  it("is NOT exact when one opening was deleted and another inserted, and says so", () => {
    const door = anchor(1, 37.5, { type: "door" });
    const window = anchor(3, 61.5);
    const column = anchor(5, 21, { type: "column" });
    const memory = memoryFor([door, window, column], [window]);
    const survivors = [anchor(0, 21, { type: "column" }), anchor(2, 96, { type: "big-header" })];
    expect(mergeRunStopOpenings(survivors, memory).map((o) => o.type)).toEqual(["column", "window", "big-header"]);
    expect(runStopRestoreFidelity(memory, survivors)).toBe("approximate");
  });
});

describe("runStopRestoreFidelity", () => {
  const memoryFor = (preStopAll: OpeningAnchor[], withheld: OpeningAnchor[]): RunStopOpeningMemory => ({
    unbuilt: preStopAll.filter((o) => withheld.includes(o)),
    preStop: preStopAll.map((o) => ({
      beforeStandardCount: o.beforeStandardCount,
      withheld: withheld.includes(o),
      payload: { type: o.type, widthIn: o.widthIn },
    })),
  });
  const withheldWindow = anchor(1, 61.5);
  const survivingDoor = anchor(5, 37.5, { type: "door" });
  const memory = memoryFor([withheldWindow, survivingDoor], [withheldWindow]);

  it("says there is nothing to restore when nothing was withheld", () => {
    expect(runStopRestoreFidelity(undefined, [])).toBe("nothing-withheld");
    expect(runStopRestoreFidelity({ unbuilt: [], preStop: [] }, [survivingDoor])).toBe("nothing-withheld");
  });

  /** The ordinary case, and the only one any user-facing text may promise
   * "exactly as drawn" for: the survivor is still the opening `preStop`
   * recorded, ordinal re-derived or not. */
  it("is exact while the wall's openings are still the ones the memory recorded", () => {
    expect(runStopRestoreFidelity(memory, [anchor(0, 37.5, { type: "door" })])).toBe("exact");
  });

  it("is approximate once an opening was deleted or inserted while stopped", () => {
    expect(runStopRestoreFidelity(memory, [])).toBe("approximate");
    expect(runStopRestoreFidelity(memory, [anchor(0, 37.5, { type: "door" }), anchor(2, 21, { type: "column" })])).toBe(
      "approximate",
    );
  });

  /** A width EDIT on a survivor restores exactly, and this still reports
   * `"approximate"` — deliberately conservative, because the alternative is a
   * promise of exactness that a delete-plus-insert of the same count would
   * break. The wording it gates says "may" for exactly this reason. */
  it("is approximate when a survivor's own width was edited while stopped", () => {
    expect(runStopRestoreFidelity(memory, [anchor(0, 41.5, { type: "door" })])).toBe("approximate");
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

  /**
   * **The octagon.** `retile` runs `markSafetyCorner` on every mitered
   * footprint, which rewrites ONE corner slot to "safety-oct-corner". Counting
   * only `type === "corner"` understated the run's fixed content by a whole
   * 25.5in panel, so the new refusal quoted numbers that were wrong — and
   * because the overstated budget could clear the shop minimum, there were
   * stops where `refuses` stayed false and the user fell through to the old
   * "does not add back up" sentence instead.
   *
   * The measurement, on the same 100in run as the case above: before the fix a
   * mitered run read `cornerCount 1, requiredIn 87, plainBudgetIn 13`; the
   * truth is `2, 112.5, -12.5`.
   */
  it("counts an octagon's safety-oct-corner as the corner panel it is", () => {
    const plain = retileWithOpenings(100, STANDARD_IN, CORNER_IN, "end", true, true, [anchor(1, 61.5)], false, true).slots;
    const mitered = markSafetyCorner(plain, "end");
    // The fixture is only interesting if the rewrite actually happened.
    expect(mitered.filter((s) => s.type === "safety-oct-corner").length).toBe(1);
    expect(mitered.filter((s) => s.type === "corner").length).toBe(1);

    const fit = runStopOpeningFit(mitered, 100, MIN_PANEL_IN);
    expect(fit.cornerCount).toBe(2);
    expect(fit.cornersTotalIn).toBe(51);
    expect(fit.requiredIn).toBe(112.5);
    expect(fit.plainBudgetIn).toBe(-12.5);
    expect(fit.refuses).toBe(true);
  });

  it("says nothing about a run with no openings at all — that is the other refusals' job", () => {
    const slots = retileWithOpenings(100, STANDARD_IN, CORNER_IN, "end", false, true, [], true, true).slots;
    expect(runStopOpeningFit(slots, 100, MIN_PANEL_IN).refuses).toBe(false);
  });
});
