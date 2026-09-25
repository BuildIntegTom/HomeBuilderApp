import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { retile, retilePreservingOpenings, wallGeometryFor } from "./retile";
import { tileWall } from "./tiling";
import { toEighths, wallFabricationLengthIn } from "./eighths";
import {
  NO_WALL_RUN_STOP,
  applyWallRunStop,
  builtWallLengthsIn,
  hasWallRunStop,
  normalizeWallRunStop,
  totalBuiltWallPerimeterIn,
  wallRunStopTotalIn,
} from "./wallRunStop";
import type { Footprint, PanelSlot, WallRunStop } from "./types";

const THICKNESS_IN = 15.5;
const STANDARD_WIDTH_IN = 40;
const CORNER_PANEL_WIDTH_IN = 25.5;
const BRACED_SEED = { spacingIn: 100_000, defaultPattern: "chevron" as const, defaultMirrored: false };
const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
const sumWidths = (slots: PanelSlot[]) => slots.reduce((sum, s) => sum + s.widthIn, 0);

describe("hasWallRunStop / wallRunStopTotalIn", () => {
  it("treats an absent record and an all-zero record as the same thing", () => {
    expect(hasWallRunStop(undefined)).toBe(false);
    expect(hasWallRunStop(NO_WALL_RUN_STOP)).toBe(false);
    expect(wallRunStopTotalIn(undefined)).toBe(0);
    expect(wallRunStopTotalIn(NO_WALL_RUN_STOP)).toBe(0);
  });

  it("sees a stop at either end, and totals both", () => {
    expect(hasWallRunStop({ startStopIn: 48, endStopIn: 0 })).toBe(true);
    expect(hasWallRunStop({ startStopIn: 0, endStopIn: 0.125 })).toBe(true);
    expect(wallRunStopTotalIn({ startStopIn: 48, endStopIn: 12.5 })).toBeCloseTo(60.5, 9);
  });
});

describe("normalizeWallRunStop", () => {
  it("snaps to the 1/8in grid and floors negatives at zero", () => {
    const n = normalizeWallRunStop({ startStopIn: 12.3, endStopIn: -5 }, 360);
    expect(n.startStopIn).toBeCloseTo(12.25, 9);
    expect(n.endStopIn).toBe(0);
    expect(n.clamped).toBe(false);
  });

  it("clamps a pair that overruns the wall, taking it off the END stop first", () => {
    const n = normalizeWallRunStop({ startStopIn: 100, endStopIn: 400 }, 360);
    expect(n.startStopIn).toBe(100);
    expect(n.endStopIn).toBe(260);
    expect(n.clamped).toBe(true);
  });

  it("clamps a single start stop longer than the wall down to the wall", () => {
    const n = normalizeWallRunStop({ startStopIn: 999, endStopIn: 0 }, 360);
    expect(n.startStopIn).toBe(360);
    expect(n.endStopIn).toBe(0);
    expect(n.clamped).toBe(true);
  });
});

describe("applyWallRunStop", () => {
  const base = { lengthIn: 360, hasCornerStart: true, hasCornerEnd: true };

  it("is the identity for an absent stop — today's behaviour, byte-identical", () => {
    expect(applyWallRunStop(base, undefined)).toEqual({
      ...base,
      startStopIn: 0,
      endStopIn: 0,
      clamped: false,
      fullyStopped: false,
    });
    expect(applyWallRunStop(base, NO_WALL_RUN_STOP)).toEqual(applyWallRunStop(base, undefined));
  });

  it("subtracts the stops from the tiled length", () => {
    const run = applyWallRunStop(base, { startStopIn: 48, endStopIn: 12 });
    expect(run.lengthIn).toBe(300);
  });

  it("takes the corner panel with it at a stopped end, and leaves the other end alone", () => {
    const run = applyWallRunStop(base, { startStopIn: 48, endStopIn: 0 });
    expect(run.hasCornerStart).toBe(false);
    expect(run.hasCornerEnd).toBe(true);
  });

  it("never turns a corner this wall does not own back ON", () => {
    const run = applyWallRunStop({ ...base, hasCornerStart: false }, { startStopIn: 0, endStopIn: 24 });
    expect(run.hasCornerStart).toBe(false);
  });

  it("drops BOTH corners on a fully stopped wall, even though only one end carries the stop", () => {
    // Otherwise `resolveCorners` clamps the surviving corner onto a
    // zero-length run and emits a zero-width corner slot — invisible, but a
    // real priced/fabricated panel instance.
    const run = applyWallRunStop(base, { startStopIn: 360, endStopIn: 0 });
    expect(run.fullyStopped).toBe(true);
    expect(run.lengthIn).toBe(0);
    expect(run.hasCornerStart).toBe(false);
    expect(run.hasCornerEnd).toBe(false);
  });

  it("reports a clamp rather than silently swallowing it", () => {
    expect(applyWallRunStop(base, { startStopIn: 200, endStopIn: 200 }).clamped).toBe(true);
    expect(applyWallRunStop(base, { startStopIn: 200, endStopIn: 160 }).clamped).toBe(false);
  });
});

describe("wallGeometryFor with a run stop", () => {
  const fp = buildRectangleFootprint(30, 20);

  it("returns exactly today's numbers when no stop is passed", () => {
    const withNothing = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN);
    const withUndefined = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN, undefined);
    const withZero = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN, NO_WALL_RUN_STOP);
    expect(withUndefined).toEqual(withNothing);
    expect(withZero).toEqual(withNothing);
    expect(withNothing!.lengthIn).toBe(withNothing!.unstoppedLengthIn);
    expect(withNothing!.startStopIn).toBe(0);
    expect(withNothing!.endStopIn).toBe(0);
    expect(withNothing!.fullyStopped).toBe(false);
  });

  it("shortens the tiled run and keeps the unstopped length for the invariant", () => {
    const stopped = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN, { startStopIn: 60, endStopIn: 0 })!;
    const plain = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN)!;
    expect(stopped.unstoppedLengthIn).toBe(plain.lengthIn);
    expect(stopped.lengthIn).toBe(plain.lengthIn - 60);
    expect(stopped.gapEnd).toBe(plain.gapEnd);
    expect(stopped.allowBorrow).toBe(plain.allowBorrow);
  });
});

/**
 * THE Stage 3 invariant, asserted directly:
 *
 *   Σ slot widths + startStopIn + endStopIn === the length the wall would
 *   have tiled at with no stop
 *
 * — exactly, as integer eighths, never as a float comparison. On a wall with
 * no corner inset or reflex extension that right-hand side is literally
 * `wallFabricationLengthIn(wall)`, which is the form the plan states; both
 * forms are covered below.
 */
describe("the sum invariant survives a run stop", () => {
  const cases: { label: string; lengthIn: number; stop: WallRunStop }[] = [
    { label: "a start stop", lengthIn: 360, stop: { startStopIn: 60, endStopIn: 0 } },
    { label: "an end stop", lengthIn: 360, stop: { startStopIn: 0, endStopIn: 37.5 } },
    { label: "both ends", lengthIn: 360, stop: { startStopIn: 48.125, endStopIn: 12.875 } },
    { label: "an odd eighth", lengthIn: 355.375, stop: { startStopIn: 41.625, endStopIn: 0 } },
    { label: "a short wall under the 12ft safety threshold", lengthIn: 120, stop: { startStopIn: 30, endStopIn: 0 } },
    { label: "the whole wall", lengthIn: 360, stop: { startStopIn: 360, endStopIn: 0 } },
  ];

  for (const { label, lengthIn, stop } of cases) {
    it(`holds for ${label}`, () => {
      const run = applyWallRunStop({ lengthIn, hasCornerStart: true, hasCornerEnd: true }, stop);
      const slots = tileWall(
        run.lengthIn,
        STANDARD_WIDTH_IN,
        CORNER_PANEL_WIDTH_IN,
        "end",
        run.hasCornerStart,
        run.hasCornerEnd,
      ).slots;
      expect(toEighths(sumWidths(slots)) + toEighths(run.startStopIn) + toEighths(run.endStopIn)).toBe(
        toEighths(lengthIn),
      );
      for (const slot of slots) expect(Number.isInteger(toEighths(slot.widthIn))).toBe(true);
    });
  }

  it("holds over a sweep of every whole inch of stop on a 30ft wall", () => {
    const lengthIn = 360;
    for (let stopIn = 0; stopIn <= lengthIn; stopIn++) {
      const run = applyWallRunStop({ lengthIn, hasCornerStart: true, hasCornerEnd: true }, { startStopIn: stopIn, endStopIn: 0 });
      const slots = tileWall(run.lengthIn, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, "end", run.hasCornerStart, run.hasCornerEnd)
        .slots;
      expect(toEighths(sumWidths(slots)) + toEighths(run.startStopIn)).toBe(toEighths(lengthIn));
    }
  });

  it("holds in the plan's own form — against wallFabricationLengthIn — on a wall that owns both corners", () => {
    // On a 30x20 rectangle the 20ft walls (BC, DA) win both their corners,
    // so their tiling length IS their fabrication length, with no inset.
    const fp = buildRectangleFootprint(30, 20);
    const wall = fp.walls.find((w) => w.id === "BC")!;
    const stop: WallRunStop = { startStopIn: 36, endStopIn: 0 };
    const geometry = wallGeometryFor(fp, "BC", allPrimary(fp), "A", THICKNESS_IN, stop)!;
    expect(geometry.unstoppedLengthIn).toBe(wallFabricationLengthIn(wall));
    const slots = retile(
      fp,
      "A",
      allPrimary(fp),
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      BRACED_SEED,
      undefined,
      { BC: stop },
    )["BC"]!;
    expect(toEighths(sumWidths(slots)) + toEighths(stop.startStopIn) + toEighths(stop.endStopIn)).toBe(
      toEighths(wallFabricationLengthIn(wall)),
    );
  });
});

/**
 * The acceptance criterion of Stage 3: a total that reads a WALL LENGTH
 * rather than a panel set must not over-count when the wall stops short.
 * These cover the arithmetic every fixed consumer in `page.tsx` now reads —
 * plaster gross area, the Intello membrane runs, the roof-bearing plywood
 * caps and the single-story truss-plate length.
 */
describe("builtWallLengthsIn / totalBuiltWallPerimeterIn", () => {
  const fp = buildRectangleFootprint(30, 20);
  const rawPerimeterIn = fp.walls.reduce((sum, w) => sum + w.lengthFt * 12, 0);

  it("is exactly today's raw perimeter when nothing is stopped", () => {
    expect(totalBuiltWallPerimeterIn(fp)).toBeCloseTo(rawPerimeterIn, 9);
    expect(totalBuiltWallPerimeterIn(fp, {})).toBeCloseTo(rawPerimeterIn, 9);
    expect(totalBuiltWallPerimeterIn(fp, { AB: NO_WALL_RUN_STOP })).toBeCloseTo(rawPerimeterIn, 9);
    expect(builtWallLengthsIn(fp)).toEqual({ AB: 360, BC: 240, CD: 360, DA: 240 });
  });

  it("drops exactly the unbuilt span, and only from the stopped wall", () => {
    const built = builtWallLengthsIn(fp, { AB: { startStopIn: 96, endStopIn: 12 } });
    expect(built["AB"]).toBe(360 - 108);
    expect(built["BC"]).toBe(240);
    expect(totalBuiltWallPerimeterIn(fp, { AB: { startStopIn: 96, endStopIn: 12 } })).toBeCloseTo(
      rawPerimeterIn - 108,
      9,
    );
  });

  it("a wall with no panels at all contributes nothing — never a negative", () => {
    const built = builtWallLengthsIn(fp, { BC: { startStopIn: 9999, endStopIn: 0 } });
    expect(built["BC"]).toBe(0);
    expect(totalBuiltWallPerimeterIn(fp, { BC: { startStopIn: 9999, endStopIn: 0 } })).toBeCloseTo(
      rawPerimeterIn - 240,
      9,
    );
  });

  it("this is what stops plaster and membrane totals over-counting — worked in real units", () => {
    // 9ft walls, one story. A 10ft unbuilt span on the north wall.
    const wallHeightFt = 9;
    const stops = { AB: { startStopIn: 120, endStopIn: 0 } };
    const grossBuiltSqFt = (totalBuiltWallPerimeterIn(fp, stops) / 12) * wallHeightFt;
    const grossRawSqFt = (rawPerimeterIn / 12) * wallHeightFt;
    expect(grossRawSqFt - grossBuiltSqFt).toBeCloseTo(10 * wallHeightFt, 9);
    // 90 sqft of plaster, both faces, that nobody is ever going to apply.
    expect(grossBuiltSqFt).toBeCloseTo(grossRawSqFt - 90, 9);
  });

  it("no footprint is zero, not a crash", () => {
    expect(totalBuiltWallPerimeterIn(null)).toBe(0);
    expect(totalBuiltWallPerimeterIn(undefined, { AB: { startStopIn: 10, endStopIn: 0 } })).toBe(0);
  });
});

describe("retile / retilePreservingOpenings with run stops", () => {
  const fp = buildRectangleFootprint(30, 20);

  it("a wall with no stop entry is byte-identical to today", () => {
    const withoutArg = retile(fp, "A", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    const withEmptyMap = retile(
      fp,
      "A",
      allPrimary(fp),
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      BRACED_SEED,
      undefined,
      {},
    );
    const withOneStoppedWall = retile(
      fp,
      "A",
      allPrimary(fp),
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      BRACED_SEED,
      undefined,
      { AB: { startStopIn: 60, endStopIn: 0 } },
    );
    expect(JSON.stringify(withEmptyMap)).toBe(JSON.stringify(withoutArg));
    // Every OTHER wall is untouched too — a stop is local to its own wall.
    for (const id of ["BC", "CD", "DA"]) {
      expect(JSON.stringify(withOneStoppedWall[id])).toBe(JSON.stringify(withoutArg[id]));
    }
    expect(JSON.stringify(withOneStoppedWall["AB"])).not.toBe(JSON.stringify(withoutArg["AB"]));
  });

  it("emits no slots at all for a fully stopped wall — an edge with no wall on it", () => {
    const slots = retile(
      fp,
      "A",
      allPrimary(fp),
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      BRACED_SEED,
      undefined,
      { BC: { startStopIn: 20 * 12, endStopIn: 0 } },
    )["BC"]!;
    expect(slots).toEqual([]);
  });

  it("drops the corner panel at the stopped end and keeps the one at the other", () => {
    const slots = retile(
      fp,
      "A",
      allPrimary(fp),
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      BRACED_SEED,
      undefined,
      { BC: { startStopIn: 36, endStopIn: 0 } },
    )["BC"]!;
    expect(slots[0]!.type).not.toBe("corner");
    expect(slots[slots.length - 1]!.type).toBe("corner");
  });

  it("retilePreservingOpenings honours stops the same way", () => {
    const stop: WallRunStop = { startStopIn: 48, endStopIn: 0 };
    const base = retile(fp, "A", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    const next = retilePreservingOpenings(
      fp,
      "A",
      allPrimary(fp),
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      base,
      BRACED_SEED,
      undefined,
      { BC: stop },
    );
    const wall = fp.walls.find((w) => w.id === "BC")!;
    expect(toEighths(sumWidths(next["BC"]!)) + toEighths(stop.startStopIn)).toBe(toEighths(wallFabricationLengthIn(wall)));
    expect(JSON.stringify(next["AB"])).toBe(JSON.stringify(base["AB"]));
  });

  it("works on a mitered (octagon) shape too", () => {
    const oct = buildOctagonFootprint(30, 20);
    const wall = oct.walls[0]!;
    const stop: WallRunStop = { startStopIn: 24, endStopIn: 0 };
    const slots = retile(
      oct,
      "0",
      allPrimary(oct),
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      BRACED_SEED,
      undefined,
      { [wall.id]: stop },
    )[wall.id]!;
    const unstopped = wallGeometryFor(oct, wall.id, allPrimary(oct), "0", THICKNESS_IN)!;
    expect(toEighths(sumWidths(slots)) + toEighths(stop.startStopIn)).toBe(toEighths(unstopped.lengthIn));
  });
});
