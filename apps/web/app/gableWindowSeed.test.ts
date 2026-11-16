import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, type PanelSlot } from "@building-integrity/geometry";
import { COLUMN_TOTAL_WIDTH_IN, GABLE_PANEL_MIN_HEIGHT_IN, standardWindowHeightDefaultIn } from "@building-integrity/panel-catalog";
import { seedGableWindowsForFootprint } from "./gableWindowSeed";

/**
 * ⚠ **A GABLE WINDOW IS NEVER SEEDED INTO A TILE THAT CANNOT HOLD IT — pinned
 * on the building it was actually wrong on.**
 *
 * The Tank (48 x 24, 10ft walls, 4:12) has 24ft gable ends. Its tallest tile
 * short of the ridge column rises about 44in above the eave, against the
 * 49 1/2in a 48in window plus its own cap needs. So the honest answer for this
 * building is NO gable windows at all, and `seedGableWindows`' own height
 * guard already gives it.
 *
 * ⚠ **This test exists because the guard was not what failed.** On 2026-11-15
 * The Tank drew a window standing through its own roof plane anyway — the
 * seeder had refused, and `applyRoofDefaultsForFootprint` then merged the
 * refusal with the PREVIOUS building's reservations, `prev` winning, and put a
 * Tiny House window back at the same tile ordinal on a tile 35in tall. The
 * caller now uses this function's answer verbatim, so the two halves have to
 * be pinned separately: that the seeder refuses (here), and that nothing
 * survives it (the single call site, which replaces rather than merges).
 */
describe("⚠ seedGableWindowsForFootprint refuses a gable too short for a window", () => {
  const minTileRiseForWindowIn = standardWindowHeightDefaultIn.value + GABLE_PANEL_MIN_HEIGHT_IN;
  const THICKNESS_IN = 15.5;
  const EAVE_IN = 120;

  const slotsFor = (widths: readonly number[]): PanelSlot[] =>
    widths.map((widthIn, i) => ({ id: `s${i}`, widthIn, type: "standard" }) as PanelSlot);

  it("seeds nothing on The Tank's 24ft gable ends at 4:12 over 10ft walls", () => {
    const fp = buildRectangleFootprint(48, 24);
    /* The 24ft walls are the gable ends — the short pair. */
    const gableWalls = fp.walls.filter((w) => w.lengthFt === 24).map((w) => w.id);
    expect(gableWalls).toHaveLength(2);
    const slotsByWallId = Object.fromEntries(
      gableWalls.map((id) => [id, slotsFor([45.875, 45.875, 24, 25.5, 0.75, 41.5, 32.125, 41.375])]),
    );
    const seeded = seedGableWindowsForFootprint(
      fp,
      gableWalls,
      slotsByWallId,
      {},
      THICKNESS_IN,
      EAVE_IN,
      /* 4:12 over a 12ft half-span. */
      4,
      {},
      48,
      0,
      0,
      "truss-heel",
      COLUMN_TOTAL_WIDTH_IN,
      minTileRiseForWindowIn,
      /* The app's own `columnTopDropIn` — 0, the column runs to the peak. */
      0,
      /* A rectangle, so no wall needs a roofline of its own. */
      {},
    );
    expect(seeded).toEqual({});
  });

  it("⚠ seeds on the SAME wall once the roof is steep enough to hold one", () => {
    /* The refusal has to be about the HEIGHT and nothing else, or the test
       above would pass just as happily on a function that never seeds. Same
       wall, same slots, a roof twice as steep. */
    const fp = buildRectangleFootprint(48, 24);
    const gableWalls = fp.walls.filter((w) => w.lengthFt === 24).map((w) => w.id);
    const slotsByWallId = Object.fromEntries(
      gableWalls.map((id) => [id, slotsFor([45.875, 45.875, 24, 25.5, 0.75, 41.5, 32.125, 41.375])]),
    );
    const seeded = seedGableWindowsForFootprint(
      fp,
      gableWalls,
      slotsByWallId,
      {},
      THICKNESS_IN,
      EAVE_IN,
      /* 8:12 — a 12ft half-span now rises 8ft, so the inner tiles clear 49.5in. */
      8,
      {},
      48,
      0,
      0,
      "truss-heel",
      COLUMN_TOTAL_WIDTH_IN,
      minTileRiseForWindowIn,
      0,
      {},
      () => 0,
    );
    expect(Object.keys(seeded).sort()).toEqual([...gableWalls].sort());
  });
});
