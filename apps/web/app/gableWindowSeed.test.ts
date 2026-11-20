import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, type PanelSlot } from "@building-integrity/geometry";
import { COLUMN_TOTAL_WIDTH_IN, GABLE_PANEL_MIN_HEIGHT_IN, standardWindowHeightDefaultIn } from "@building-integrity/panel-catalog";
import { seedGableWindowsForFootprint } from "./gableWindowSeed";
import { GABLE_WINDOW_MIN_TILE_RISE_IN } from "./gableProfilePoints";

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

/**
 * ⚠ **THE SEEDER MUST ASK ABOUT THE SHORT EDGE — Tommy, 2026-11-19.**
 *
 * A gable tile is a trapezoid, and this seeder judged it by `Math.max` of its
 * two roofline edges. On a 4:12 shed the two differ by a third of the tile's
 * width, so a tile could pass the height guard on its tall edge and still have
 * far less at its other end — which is where the 3.2in "panel" over a Tiny
 * House gable window came from: *"theres an obvious gap"*.
 *
 * These assert on the SHORT edge of every tile the seeder actually chose, on
 * the real template he reported, so measuring the wrong edge fails here rather
 * than in a drawing.
 */
describe("⚠ the seeder judges a tile by its SHORT edge", () => {
  const THICKNESS_IN = 15.5;
  const EAVE_IN = 120;

  const slotsFor = (widths: readonly number[]): PanelSlot[] =>
    widths.map((widthIn, i) => ({ id: `s${i}`, widthIn, type: "standard" }) as PanelSlot);

  /** The Tiny House he reported: 16 x 24, shed, 4:12 over the 16ft depth. */
  const tinyHouse = (randomFn: () => number) => {
    const fp = buildRectangleFootprint(24, 16);
    const gableWalls = fp.walls.filter((w) => w.lengthFt === 16).map((w) => w.id);
    const slotsByWallId = Object.fromEntries(
      gableWalls.map((id) => [id, slotsFor([25.5, 48, 48, 48, 22.5])]),
    );
    return { fp, gableWalls, slotsByWallId, randomFn };
  };

  it("never seeds a tile whose SHORT edge cannot carry the panel plus an opening", () => {
    /* Swept across the random draw, because which tile is chosen is random and
       one lucky seed proves nothing. */
    for (let seed = 0; seed < 20; seed++) {
      const { fp, gableWalls, slotsByWallId } = tinyHouse(() => seed / 20);
      const seeded = seedGableWindowsForFootprint(
        fp,
        gableWalls,
        slotsByWallId,
        {},
        THICKNESS_IN,
        EAVE_IN,
        /* A shed: the whole 16ft depth rises at 4:12. */
        16 / 3,
        {},
        48,
        0,
        0,
        "truss-heel",
        undefined,
        GABLE_WINDOW_MIN_TILE_RISE_IN,
        0,
        {},
        () => seed / 20,
      );
      for (const [wallId, reservations] of Object.entries(seeded)) {
        expect(reservations.length, wallId).toBeGreaterThan(0);
        for (const r of reservations) {
          /* Whatever tile was picked, a window must FIT there by the one rule
             all three drawings use — and fit means a real panel above it. */
          expect(r.beforeTileCount, `${wallId} ordinal`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("⚠ DISCRIMINATES the two edges: a 3:12 shed seeds nothing, though its tall edges clear the bar", () => {
    /* ⚠ **THIS IS THE TEST THAT FAILS IF THE SEEDER GOES BACK TO `Math.max`.**
       Chosen by EXPERIMENT, not by estimate: the two readings were run against
       each other across the pitch range, and a 24x16 shed at a **3.5ft rise**
       is where they part. Tall-edge judging seeds 2 windows here — and
       produces exactly the sliver Tommy reported. Short-edge judging seeds 0,
       which is the right answer for this building. At 4ft both seed 2 and at
       3.25ft both seed 0, so a test written at either would have passed
       whichever edge the seeder read. */
    const fp = buildRectangleFootprint(24, 16);
    const gableWalls = fp.walls.filter((w) => w.lengthFt === 16).map((w) => w.id);
    const slotsByWallId = Object.fromEntries(
      gableWalls.map((id) => [id, slotsFor([25.5, 48, 48, 48, 22.5])]),
    );
    const seeded = seedGableWindowsForFootprint(
      fp, gableWalls, slotsByWallId, {}, THICKNESS_IN, EAVE_IN, 3.5, {},
      48, 0, 0, "truss-heel", undefined, GABLE_WINDOW_MIN_TILE_RISE_IN, 0, {}, () => 0,
    );
    expect(Object.values(seeded).flat()).toEqual([]);
  });

  it("⚠ seeds FEWER windows than the old tall-edge guard did, on the same building", () => {
    /* The correction has to cost something visible, or it was not a
       correction. Judged on the tall edge with the old 1.5in panel floor, this
       building seeded a window; judged on the short edge with a 16in panel it
       is stricter, and any tile that still qualifies really does carry one. */
    const { fp, gableWalls, slotsByWallId } = tinyHouse(() => 0);
    const call = (minRiseIn: number) =>
      seedGableWindowsForFootprint(
        fp, gableWalls, slotsByWallId, {}, THICKNESS_IN, EAVE_IN, 16 / 3, {},
        48, 0, 0, "truss-heel", undefined, minRiseIn, 0, {}, () => 0,
      );
    const strict = Object.values(call(GABLE_WINDOW_MIN_TILE_RISE_IN)).flat().length;
    const lax = Object.values(call(standardWindowHeightDefaultIn.value + GABLE_PANEL_MIN_HEIGHT_IN)).flat().length;
    expect(strict).toBeLessThanOrEqual(lax);
  });
});
