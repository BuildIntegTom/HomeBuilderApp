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
    /* ⚠ The exact-position tiler knows about one reservation, so a wall
       carrying windows or doors stays on the ordinal search, which preserves
       every anchor. Pinned because the alternative is silently deleting
       somebody's windows to centre a column. */
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

  it("⚠ is idempotent — a wall that already has one is left alone", () => {
    /* It is called on every draw and on every toggle. Re-tiling a wall that
       is already right would move every panel on it for nothing. */
    const once = placeColumnUnderPeak(inputs())!;
    expect(placeColumnUnderPeak(inputs({ slots: once }))).toBeNull();
  });
});
