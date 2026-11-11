import { describe, expect, it } from "vitest";
import { retileWithOpenings, type PanelSlot } from "@building-integrity/geometry";
import { COLUMN_TOTAL_WIDTH_IN } from "@building-integrity/panel-catalog";
import { placeColumnUnderPeak, type ColumnUnderPeakInputs } from "./gableColumnPlacement";

/* A 28ft-9in gable wall off a freshly drawn rectangle — the same wall the
   draw handler places a column into. */
const LENGTH_IN = 345;
const STANDARD_IN = 48;
const CORNER_IN = 15.5;

const bareSlots = (lengthIn = LENGTH_IN): PanelSlot[] =>
  retileWithOpenings(lengthIn, STANDARD_IN, CORNER_IN, "end", true, true, [], true, true).slots;

const inputs = (over: Partial<ColumnUnderPeakInputs> = {}): ColumnUnderPeakInputs => ({
  slots: bareSlots(),
  peakXIn: LENGTH_IN / 2,
  startOffsetIn: 0,
  lengthIn: LENGTH_IN,
  standardWidthIn: STANDARD_IN,
  cornerWidthIn: CORNER_IN,
  gapEnd: "end",
  hasCornerStart: true,
  hasCornerEnd: true,
  allowBorrow: true,
  cornerMayWiden: true,
  columnWidthIn: COLUMN_TOTAL_WIDTH_IN,
  ...over,
});

const columnCentresIn = (slots: PanelSlot[], startOffsetIn = 0): number[] => {
  const out: number[] = [];
  let cursorIn = startOffsetIn;
  for (const s of slots) {
    if (s.type === "column" && Math.abs(s.widthIn - COLUMN_TOTAL_WIDTH_IN) < 0.01) out.push(cursorIn + s.widthIn / 2);
    cursorIn += s.widthIn;
  }
  return out;
};

describe("⚠ the Column Panel under a gable column", () => {
  /* > "the ridge beam should land on top of a Gable column panel... there
     > must be a column panel directly below it in the main level wall and
     > all the way down" — Tommy, 2026-10-29 */

  it("puts exactly one column in the wall", () => {
    const placed = placeColumnUnderPeak(inputs())!;
    expect(placed).not.toBeNull();
    expect(columnCentresIn(placed)).toHaveLength(1);
  });

  it("⚠ lands it as near the peak as the tiling allows", () => {
    /* Not exact, and it cannot be: the column takes a whole slot out of a
       run whose other panels then re-divide what is left. Within half a
       standard panel of the peak is what "flush with the one above" means
       in practice. */
    const placed = placeColumnUnderPeak(inputs())!;
    expect(Math.abs(columnCentresIn(placed)[0]! - LENGTH_IN / 2)).toBeLessThan(STANDARD_IN / 2);
  });

  it("⚠ beats every other ordinal it could have chosen", () => {
    /* The reason this tiles for real rather than doing arithmetic: each
       ordinal's own retile moves every panel on the wall, so the winner is
       only knowable by trying them. */
    const placed = placeColumnUnderPeak(inputs())!;
    const best = Math.abs(columnCentresIn(placed)[0]! - LENGTH_IN / 2);
    const standardFamilyCount = bareSlots().filter((s) => s.type === "standard" || s.type === "braced").length;
    for (let ordinal = 1; ordinal < standardFamilyCount - 1; ordinal++) {
      const trial = retileWithOpenings(
        LENGTH_IN,
        STANDARD_IN,
        CORNER_IN,
        "end",
        true,
        true,
        [{ beforeStandardCount: ordinal, type: "column", widthIn: COLUMN_TOTAL_WIDTH_IN }],
        true,
        true,
      ).slots;
      const centre = columnCentresIn(trial)[0];
      if (centre !== undefined) expect(best).toBeLessThanOrEqual(Math.abs(centre - LENGTH_IN / 2) + 1e-9);
    }
  });

  it("⚠ the run's own start offset moves the target, not the peak", () => {
    /* A peak is measured from the wall's TRUE corner and the slots from the
       run's start. Ignoring the offset would aim the column a corner panel's
       width off, every time a neighbour owns the corner. */
    const withOffset = placeColumnUnderPeak(inputs({ startOffsetIn: CORNER_IN }))!;
    expect(Math.abs(columnCentresIn(withOffset, CORNER_IN)[0]! - LENGTH_IN / 2)).toBeLessThan(STANDARD_IN / 2);
  });

  it("⚠ refuses a wall with nowhere safe to put one", () => {
    /* Fewer than three standard-family slots means every position is
       corner-adjacent. Null, rather than forcing a column against a corner
       panel's framing. */
    expect(placeColumnUnderPeak(inputs({ slots: bareSlots(60), lengthIn: 60 }))).toBeNull();
  });

  it("⚠ lands DEAD on the peak, not merely near it", () => {
    /* ⚠ **B14.** It used to take the nearest ordinal, which on his 22ft 9in
       gable wall was 2.25in off — and the two roof slopes then met the column
       at 40.50 and 42.00 instead of one height, the step he reported. The two
       sides of the column are now tiled as separate runs, so it goes exactly
       under the ridge and the beam bears on the middle of the panel carrying
       it. */
    for (const lengthIn of [192, 240, 273, 303, 345, 432]) {
      const slots = placeColumnUnderPeak(inputs({ slots: bareSlots(lengthIn), lengthIn, peakXIn: lengthIn / 2 }));
      expect({ lengthIn, placed: slots !== null }).toEqual({ lengthIn, placed: true });
      expect({ lengthIn, centre: +columnCentresIn(slots!, 0)[0]!.toFixed(4) }).toEqual({
        lengthIn,
        centre: +(lengthIn / 2).toFixed(4),
      });
      /* And the wall still sums to itself — trimming the neighbours must not
         lose or invent an inch. */
      expect({ lengthIn, sum: +slots!.reduce((t, s) => t + s.widthIn, 0).toFixed(4) }).toEqual({
        lengthIn,
        sum: +lengthIn.toFixed(4),
      });
    }
  });

  it("⚠ a wall that already has openings KEEPS them", () => {
    /* Pinned because the obvious way to centre a column — retile the wall
       around it — silently deletes somebody's windows. */
    const bare = bareSlots(273);
    const windowIdx = bare.findIndex((slot) => slot.type === "standard");
    const withWindow = bare.map((slot, i) =>
      i === windowIdx ? { ...slot, type: "window" as const, widthIn: 36, heightIn: 48 } : slot,
    );
    const placed = placeColumnUnderPeak(inputs({ slots: withWindow, lengthIn: 273, peakXIn: 273 / 2 }))!;
    expect(placed.filter((slot) => slot.type === "window")).toHaveLength(1);
    expect(placed.filter((slot) => slot.type === "column")).toHaveLength(1);
    expect(+placed.reduce((t, slot) => t + slot.widthIn, 0).toFixed(4)).toBe(273);
  });

  it("⚠ AND it still lands dead on the peak — openings do not buy an off-ridge column", () => {
    /* ⚠ **THE 2026-11-10 FIX.** The exact-position tiler used to know about
       exactly one reservation, so `placeColumnUnderPeak` ran it only on a
       wall with no windows or doors and justified that as narrow: *"it is
       the freshly-drawn wall that spawns a ridge column, and it has no
       openings yet."*

       Auto-spawned windows and doors made that false and nothing caught it.
       Every freshly-drawn gable wall then had openings, so the exact path
       never ran and every ridge column fell through to the ordinal search.
       Measured in the browser on a 24 x 24 at 4:12, peak at 144in: one gable
       wall put its column at 159..184.5 and the other at 103.625..129.125 —
       **15in past the ridge on one and 27.6in short of it on the other**, so
       the ridge beam spanning between them was not parallel to the building.

       This is that bug, as a test: a wall carrying a door AND a window, and
       the column still dead on the peak. */
    for (const lengthIn of [273, 288, 345, 432]) {
      const bare = bareSlots(lengthIn);
      const standardIdxs = bare.flatMap((slot, i) => (slot.type === "standard" ? [i] : []));
      const withOpenings = bare.map((slot, i) => {
        if (i === standardIdxs[0]) return { ...slot, type: "door" as const, widthIn: 38 };
        if (i === standardIdxs[standardIdxs.length - 1]) return { ...slot, type: "window" as const, widthIn: 24, heightIn: 48 };
        return slot;
      });
      const placed = placeColumnUnderPeak(inputs({ slots: withOpenings, lengthIn, peakXIn: lengthIn / 2 }))!;
      expect({ lengthIn, placed: placed !== null }).toEqual({ lengthIn, placed: true });
      expect({ lengthIn, centre: +columnCentresIn(placed, 0)[0]!.toFixed(4) }).toEqual({
        lengthIn,
        centre: +(lengthIn / 2).toFixed(4),
      });
      /* Both openings survive the move, and the wall still sums to itself. */
      expect({ lengthIn, doors: placed.filter((s) => s.type === "door").length }).toEqual({ lengthIn, doors: 1 });
      expect({ lengthIn, windows: placed.filter((s) => s.type === "window").length }).toEqual({ lengthIn, windows: 1 });
      expect({ lengthIn, sum: +placed.reduce((t, s) => t + s.widthIn, 0).toFixed(4) }).toEqual({
        lengthIn,
        sum: +lengthIn.toFixed(4),
      });
    }
  });

  it("⚠ an opening sitting ON the peak is moved aside — the ridge column takes the ridge", () => {
    /* The auto-spawned window lands mid-wall often enough that this is the
       normal case, not an edge one. Something has to give: either the ridge
       beam bears on a window header or the window slides to one side. It
       slides, and it slides to the side its own centre is already on. */
    const lengthIn = 288;
    const bare = bareSlots(lengthIn);
    /* A window straddling the peak. */
    let atIn = 0;
    const spans = bare.map((slot) => {
      const span = { slot, startIn: atIn, endIn: atIn + slot.widthIn };
      atIn += slot.widthIn;
      return span;
    });
    const straddler = spans.find((sp) => sp.slot.type === "standard" && sp.startIn < lengthIn / 2 && sp.endIn > lengthIn / 2);
    expect(straddler).toBeDefined();
    const withWindow = bare.map((slot) => (slot === straddler!.slot ? { ...slot, type: "window" as const, widthIn: 24 } : slot));

    const placed = placeColumnUnderPeak(inputs({ slots: withWindow, lengthIn, peakXIn: lengthIn / 2 }))!;
    expect(columnCentresIn(placed, 0)).toEqual([lengthIn / 2]);
    expect(placed.filter((s) => s.type === "window")).toHaveLength(1);
    /* And the window is now clear of the column, not inside it. */
    let cursorIn = 0;
    const placedSpans = placed.map((slot) => {
      const span = { slot, startIn: cursorIn, endIn: cursorIn + slot.widthIn };
      cursorIn += slot.widthIn;
      return span;
    });
    const col = placedSpans.find((sp) => sp.slot.type === "column")!;
    const win = placedSpans.find((sp) => sp.slot.type === "window")!;
    expect(win.endIn <= col.startIn || win.startIn >= col.endIn).toBe(true);
  });

  it("⚠ a column already on the wall but OFF the peak is re-placed, not left alone", () => {
    /* ⚠ This is what made a misplaced ridge column permanent. The idempotence
       guard below used to read *"is there a column of this width anywhere on
       this wall?"* — so the first pass put one in the wrong bay and every
       pass after it saw a column, said "done", and refused to touch it. The
       question is where the column is, not whether one exists. */
    const lengthIn = 288;
    const bare = bareSlots(lengthIn);
    const standardIdxs = bare.flatMap((slot, i) => (slot.type === "standard" ? [i] : []));
    /* A column in the FIRST standard slot — nowhere near the peak. */
    const misplaced = bare.map((slot, i) =>
      i === standardIdxs[0] ? { ...slot, type: "column" as const, widthIn: COLUMN_TOTAL_WIDTH_IN } : slot,
    );
    const before = columnCentresIn(misplaced, 0)[0]!;
    expect(Math.abs(before - lengthIn / 2)).toBeGreaterThan(STANDARD_IN);

    const placed = placeColumnUnderPeak(inputs({ slots: misplaced, lengthIn, peakXIn: lengthIn / 2 }));
    expect(placed).not.toBeNull();
    expect(columnCentresIn(placed!, 0)).toEqual([lengthIn / 2]);
    /* Exactly one — the misplaced one is MOVED, never joined by a second. */
    expect(placed!.filter((s) => s.type === "column")).toHaveLength(1);
    expect(+placed!.reduce((t, s) => t + s.widthIn, 0).toFixed(4)).toBe(lengthIn);
  });

  it("⚠ is idempotent — a wall that already has one is left alone", () => {
    /* It is called on every draw and on every toggle. Re-tiling a wall that
       is already right would move every panel on it for nothing. */
    const once = placeColumnUnderPeak(inputs())!;
    expect(placeColumnUnderPeak(inputs({ slots: once }))).toBeNull();
  });
});
