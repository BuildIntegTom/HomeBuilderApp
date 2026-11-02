import { describe, expect, it } from "vitest";
import { retileWithColumnAtIn, tileWall } from "./index";

/**
 * ⚠ **THE RIDGE COLUMN GOES UNDER THE RIDGE.**
 *
 * > *"some weird inclined changes in the slope to an off centered column
 * > panel that's not the right height. 25'3" x 22'9" building."* — Tommy,
 * > 2026-11-01
 *
 * `retileWithOpenings` places a reservation by ORDINAL and tiles the whole
 * middle as ONE run, so a column can only land where that run's panel
 * boundaries happen to fall. On his 22ft 9in gable wall the nearest left the
 * column **2.25in off the peak**, and the two roof slopes then met it at
 * 40.50 and 42.00 instead of the same height — the step he saw. Tiling the
 * two sides as separate runs puts it on the peak exactly.
 */

const STD = 48;
const CORNER = 25.5;
const COLUMN = 25.5;

/** Every wall length a gable end plausibly takes, plus both of his. */
const WALLS_FT = [13, 14, 16, 18, 20, 22.75, 24, 25.25, 28, 30, 36];

function tiled(wallLengthIn: number) {
  return retileWithColumnAtIn(wallLengthIn, STD, CORNER, "end", true, true, wallLengthIn / 2, COLUMN);
}

function columnCentreIn(slots: { type: string; widthIn: number }[]): number {
  let atIn = 0;
  for (const slot of slots) {
    if (slot.type === "column") return atIn + slot.widthIn / 2;
    atIn += slot.widthIn;
  }
  return Number.NaN;
}

describe("⚠ a column tiled to an exact position", () => {
  it("⚠ lands dead on the peak, on every wall length — including his 22ft 9in", () => {
    for (const wallFt of WALLS_FT) {
      const wallLengthIn = wallFt * 12;
      const result = tiled(wallLengthIn);
      expect({ wallFt, tiled: result !== null }).toEqual({ wallFt, tiled: true });
      expect({ wallFt, centre: +columnCentreIn(result!.slots).toFixed(4) }).toEqual({
        wallFt,
        centre: +(wallLengthIn / 2).toFixed(4),
      });
    }
  });

  it("⚠ his exact case: 2.25in off before, zero now", () => {
    /* 22ft 9in = 273in, peak at 136.50. The ordinal tiler could only reach
       134.25 — all three viable ordinals were measured at 86.25, 134.25 and
       160.13, so no ordinal reaches it. */
    const result = tiled(273)!;
    expect(columnCentreIn(result.slots)).toBeCloseTo(136.5, 9);

    /* The left run has to GROW a panel to get there: 98.25in of standards
       where two full-width ones cap out at 96in. That is the "trim the
       neighbours" answer, and it is why a width nudge could not do it. */
    const before = result.slots.slice(
      0,
      result.slots.findIndex((s) => s.type === "column"),
    );
    expect(before.reduce((sum, s) => sum + s.widthIn, 0)).toBeCloseTo(136.5 - COLUMN / 2, 9);
  });

  it("⚠ the wall still sums to itself exactly", () => {
    /* Dimensional tightness: the parts sum to the whole, or the wall is
       lying about its own length. */
    for (const wallFt of WALLS_FT) {
      const wallLengthIn = wallFt * 12;
      const sumIn = tiled(wallLengthIn)!.slots.reduce((sum, s) => sum + s.widthIn, 0);
      expect({ wallFt, sumIn: +sumIn.toFixed(4) }).toEqual({ wallFt, sumIn: +wallLengthIn.toFixed(4) });
    }
  });

  it("⚠ ONE safety gap, not one per run", () => {
    /* The obvious way to tile two runs gives each its own gap. The gap
       belongs to whichever side holds `gapEnd`; the other gets none. */
    for (const wallFt of WALLS_FT) {
      const slots = tiled(wallFt * 12)!.slots;
      const gaps = slots.filter((s) => s.type === "safety-gap").length;
      const plain = tileWall(wallFt * 12, STD, CORNER, "end").slots.filter((s) => s.type === "safety-gap").length;
      expect({ wallFt, gaps }).toEqual({ wallFt, gaps: plain });
    }
  });

  it("⚠ exactly one column, and the corners are still corners", () => {
    for (const wallFt of WALLS_FT) {
      const slots = tiled(wallFt * 12)!.slots;
      expect({ wallFt, columns: slots.filter((s) => s.type === "column").length }).toEqual({ wallFt, columns: 1 });
      expect({ wallFt, first: slots[0]!.type, last: slots[slots.length - 1]!.type }).toEqual({
        wallFt,
        first: "corner",
        last: "corner",
      });
    }
  });

  it("refuses rather than returning a wall that does not sum", () => {
    /* A wall too short for a corner pair plus a column has nowhere to put
       one. Returning null lets the caller keep what it had. */
    expect(retileWithColumnAtIn(40, STD, CORNER, "end", true, true, 20, COLUMN)).toBeNull();
    // A centre that would push the column through a corner.
    expect(retileWithColumnAtIn(240, STD, CORNER, "end", true, true, 6, COLUMN)).toBeNull();
    // And a column with no width at all.
    expect(retileWithColumnAtIn(240, STD, CORNER, "end", true, true, 120, 0)).toBeNull();
  });
});
