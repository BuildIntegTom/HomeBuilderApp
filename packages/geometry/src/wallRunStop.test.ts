import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import { cornerOwnership, cornerOwnershipWithRunStops, retile, retilePreservingOpenings, wallGeometryFor } from "./retile";
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
    const withZero = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN, { AB: NO_WALL_RUN_STOP });
    expect(withUndefined).toEqual(withNothing);
    expect(withZero).toEqual(withNothing);
    expect(withNothing!.lengthIn).toBe(withNothing!.unstoppedLengthIn);
    expect(withNothing!.startStopIn).toBe(0);
    expect(withNothing!.endStopIn).toBe(0);
    expect(withNothing!.fullyStopped).toBe(false);
  });

  it("shortens the tiled run and keeps the unstopped length for the invariant", () => {
    const stopped = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN, { AB: { startStopIn: 60, endStopIn: 0 } })!;
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
 *   Σ slot widths === this wall's tiling length under the current stop map
 *
 * — exactly, as integer eighths, never as a float comparison.
 *
 * **⚠ Deliberately NOT the form the plan states** (`Σ + startStop + endStop
 * === wallFabricationLengthIn`). That form holds only while no wall's length
 * depends on another wall's stop, and the orphan-corner rule breaks exactly
 * that: a wall whose neighbour stops at their shared corner grows by a wall
 * thickness. Writing the old form is what made the first refusal reject
 * every legitimate stop that reached a corner.
 *
 * The cases in this block have no stopped neighbour, so both forms agree and
 * both are asserted here. The orphan block further down asserts only the
 * true form, and says so.
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
    const geometry = wallGeometryFor(fp, "BC", allPrimary(fp), "A", THICKNESS_IN, { BC: stop })!;
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

  /**
   * Review SHOULD-FIX 6. `applyWallRunStop` clamps against the wall's TILING
   * length; this used to clamp against the raw length. On a wall that butts
   * a longer neighbour those differ by the inset, and a stored stop landing
   * between them made the tiler build nothing while the totals still counted
   * up to one wall-thickness as built — plaster and membrane on a wall with
   * no panels.
   */
  it("agrees with the tiler when a clamped stop wipes out a butting wall's whole run", () => {
    // AB is the 30ft wall of a 30x20 rectangle: it LOSES both corners, so
    // its tiling length is 360 - 2 x 15.5 = 329in against a raw 360in.
    const thicknessIn = 15.5;
    const tilingLengthIn = 360 - 2 * thicknessIn;
    const tilingLengths = { AB: tilingLengthIn };
    // A stop of 340in: past the 329in tiling length, short of the 360in raw
    // length. The tiler builds nothing.
    const stops = { AB: { startStopIn: 340, endStopIn: 0 } };
    const run = applyWallRunStop(
      { lengthIn: tilingLengthIn, hasCornerStart: false, hasCornerEnd: false },
      stops.AB,
    );
    expect(run.fullyStopped).toBe(true);

    expect(builtWallLengthsIn(fp, stops, tilingLengths)["AB"]).toBe(0);
    // Without the tiling base it reported 360 - 340 = 20in of built wall on
    // a wall carrying no panels at all.
    expect(builtWallLengthsIn(fp, stops)["AB"]).toBe(20);
  });

  it("the tiling base changes nothing when the stops actually fit", () => {
    const tilingLengths = { AB: 360 - 2 * 15.5, BC: 240, CD: 360 - 2 * 15.5, DA: 240 };
    const stops = { AB: { startStopIn: 60, endStopIn: 0 } };
    expect(builtWallLengthsIn(fp, stops, tilingLengths)).toEqual(builtWallLengthsIn(fp, stops));
    // ...and with no stops at all it is still exactly the raw perimeter.
    expect(totalBuiltWallPerimeterIn(fp, {}, tilingLengths)).toBeCloseTo(rawPerimeterIn, 9);
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
    // AB is NOT untouched, and that is the orphan-corner rule working: BC
    // owns corner B and has stopped there, so AB stops butting into a corner
    // panel that no longer exists and runs out to its own true end. See the
    // dedicated block below.
    expect(toEighths(sumWidths(next["AB"]!)) - toEighths(sumWidths(base["AB"]!))).toBe(toEighths(THICKNESS_IN));
  });

  /**
   * **The orphan corner — Tommy's decision, 2026-09-25.** When a wall stops
   * at a corner it OWNS, that corner panel is never built, and the neighbour
   * which was butting against it was left insetting a wall-thickness into
   * air: an empty notch with nothing marking it, plus a phantom "adjacent
   * wall" sliver on the elevation for a panel that does not exist. The rule
   * is that neither wall builds a corner there and the butting neighbour
   * runs out to its own true end.
   *
   * This is the FIRST thing in Stage 3 where a stop on one wall changes
   * another wall's tiling, so the invariants get asserted on the neighbour
   * too, not just on the stopped wall.
   */
  describe("the orphan corner", () => {
    // 30x20 rectangle. At corner B (AB.end / BC.start) the SHORTER wall wins,
    // so BC owns it and AB butts — the exact configuration the ADU hits,
    // since stopping a short wall is what reaches a long neighbour.
    const stopAtCornerB = { BC: { startStopIn: 36, endStopIn: 0 } };
    const tile = (stops?: Record<string, WallRunStop>) =>
      retile(fp, "A", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED, undefined, stops);

    it("clears the butting neighbour's inset, and only at the corner that lost its panel", () => {
      const base = cornerOwnership(fp, allPrimary(fp), THICKNESS_IN);
      const adjusted = cornerOwnershipWithRunStops(fp, allPrimary(fp), THICKNESS_IN, stopAtCornerB);
      expect(base["AB"]!.end.insetAmount).toBe(THICKNESS_IN);
      expect(adjusted["AB"]!.end.insetAmount).toBe(0);
      // AB's OTHER end is at corner A, which DA owns and is still building.
      expect(adjusted["AB"]!.start.insetAmount).toBe(base["AB"]!.start.insetAmount);
      // Nobody gains a corner they did not own.
      for (const id of ["AB", "BC", "CD", "DA"]) {
        expect(adjusted[id]!.start.hasCorner).toBe(base[id]!.start.hasCorner);
        expect(adjusted[id]!.end.hasCorner).toBe(base[id]!.end.hasCorner);
      }
    });

    it("is the identity with no stops — every project saved before Stage 3", () => {
      const base = cornerOwnership(fp, allPrimary(fp), THICKNESS_IN);
      expect(cornerOwnershipWithRunStops(fp, allPrimary(fp), THICKNESS_IN)).toEqual(base);
      expect(cornerOwnershipWithRunStops(fp, allPrimary(fp), THICKNESS_IN, {})).toEqual(base);
      expect(cornerOwnershipWithRunStops(fp, allPrimary(fp), THICKNESS_IN, { AB: NO_WALL_RUN_STOP })).toEqual(base);
    });

    it("the neighbour grows by exactly one wall thickness, on the eighth", () => {
      const before = tile();
      const after = tile(stopAtCornerB);
      expect(toEighths(sumWidths(after["AB"]!)) - toEighths(sumWidths(before["AB"]!))).toBe(toEighths(THICKNESS_IN));
      // The far side of the building is genuinely untouched.
      expect(JSON.stringify(after["CD"])).toBe(JSON.stringify(before["CD"]));
    });

    // Every assertion in this block uses `sumWidths === geometry.lengthIn`
    // rather than the plan's `sum + stops === unstoppedLengthIn`, and that is
    // the point rather than an oversight: on an orphan-affected wall the
    // plan's form is measurably false (344.5 vs 329 here), because the rule
    // deliberately lengthens the neighbour.
    it("the neighbour's own sum invariant still closes exactly", () => {
      const after = tile(stopAtCornerB);
      const ab = fp.walls.find((w) => w.id === "AB")!;
      const geometry = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN, stopAtCornerB)!;
      expect(toEighths(sumWidths(after["AB"]!))).toBe(toEighths(geometry.lengthIn));
      // AB has no stop of its own, so its whole run is built; its length is
      // its fabrication length less only the ONE inset it still has.
      expect(toEighths(geometry.lengthIn)).toBe(toEighths(wallFabricationLengthIn(ab) - THICKNESS_IN));
      for (const slot of after["AB"]!) expect(Number.isInteger(toEighths(slot.widthIn))).toBe(true);
    });

    it("a FULLY stopped wall orphans BOTH of the corners it owned", () => {
      const adjusted = cornerOwnershipWithRunStops(fp, allPrimary(fp), THICKNESS_IN, {
        BC: { startStopIn: 20 * 12, endStopIn: 0 },
      });
      // BC owns corners B and C; AB butts at B and CD butts at C.
      expect(adjusted["AB"]!.end.insetAmount).toBe(0);
      expect(adjusted["CD"]!.start.insetAmount).toBe(0);
    });

    it("a stop at an end the wall does NOT own leaves the neighbour alone", () => {
      // AB does not own corner A (DA does), so stopping AB's start orphans
      // nothing — DA keeps building its corner and AB keeps its inset.
      const base = cornerOwnership(fp, allPrimary(fp), THICKNESS_IN);
      const adjusted = cornerOwnershipWithRunStops(fp, allPrimary(fp), THICKNESS_IN, {
        AB: { startStopIn: 60, endStopIn: 0 },
      });
      expect(adjusted).toEqual(base);
    });

    it("REFLEX corners are untouched — their loser never had an inset to clear", () => {
      const rect = buildRectangleFootprint(30, 20);
      const { footprint: bumped, primaryCornerIds } = insertBumpOut(rect, "AB", 10, 15, 5, allPrimary(rect));
      const reflexBase = cornerOwnership(bumped, primaryCornerIds, THICKNESS_IN);
      // Stop every wall on the bumped shape at both ends, which is the most
      // aggressive thing this rule can be asked to do.
      const everythingStopped: Record<string, WallRunStop> = {};
      for (const w of bumped.walls) everythingStopped[w.id] = { startStopIn: 12, endStopIn: 12 };
      const adjusted = cornerOwnershipWithRunStops(bumped, primaryCornerIds, THICKNESS_IN, everythingStopped);
      for (const w of bumped.walls) {
        // Reflex ends are exactly the ones carrying an extension; their
        // partner's inset was already 0 and must stay 0, and no extension
        // may be invented or destroyed.
        expect(adjusted[w.id]!.start.extraLengthIn).toBe(reflexBase[w.id]!.start.extraLengthIn);
        expect(adjusted[w.id]!.end.extraLengthIn).toBe(reflexBase[w.id]!.end.extraLengthIn);
        // An inset may only ever be cleared, never created or enlarged.
        expect(adjusted[w.id]!.start.insetAmount).toBeLessThanOrEqual(reflexBase[w.id]!.start.insetAmount);
        expect(adjusted[w.id]!.end.insetAmount).toBeLessThanOrEqual(reflexBase[w.id]!.end.insetAmount);
      }
    });

    it("a bumped-out shape still closes its sum invariant on every wall, with stops everywhere", () => {
      const rect = buildRectangleFootprint(30, 20);
      const { footprint: bumped, primaryCornerIds } = insertBumpOut(rect, "AB", 10, 15, 5, allPrimary(rect));
      const stops: Record<string, WallRunStop> = {};
      for (const w of bumped.walls) stops[w.id] = { startStopIn: 6, endStopIn: 6 };
      const tiled = retile(
        bumped,
        [...primaryCornerIds][0] ?? bumped.corners[0]!.id,
        primaryCornerIds,
        STANDARD_WIDTH_IN,
        CORNER_PANEL_WIDTH_IN,
        THICKNESS_IN,
        BRACED_SEED,
        undefined,
        stops,
      );
      for (const w of bumped.walls) {
        const geometry = wallGeometryFor(bumped, w.id, primaryCornerIds, [...primaryCornerIds][0] ?? bumped.corners[0]!.id, THICKNESS_IN, stops)!;
        expect(toEighths(sumWidths(tiled[w.id]!))).toBe(toEighths(geometry.lengthIn));
        for (const slot of tiled[w.id]!) expect(Number.isInteger(toEighths(slot.widthIn))).toBe(true);
      }
    });

    it("the MERGED-corner case cannot collide with this — a stopped wall never merges", () => {
      // Tested at `tileWall` rather than through a footprint on purpose:
      // `buildRectangleFootprint` clamps every side to a minimum of 8ft, so a
      // rectangle can never be short enough for two 25.5in corners to
      // overlap. The merged case is only reachable from a bump-out's own
      // short remainder segment — or, as here, from the function that
      // actually decides it.
      const MERGE_LENGTH_IN = 48; // < 2 x 25.5in, so both corners cannot fit
      const unstopped = tileWall(MERGE_LENGTH_IN, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, "end", true, true).slots;
      expect(unstopped).toHaveLength(1);
      expect(unstopped[0]!.type).toBe("corner");
      expect(unstopped[0]!.widthIn).toBe(MERGE_LENGTH_IN);

      // `resolveCorners` merges only when a wall owns corners at BOTH ends,
      // and a stop at either end removes that end's corner — so the merge
      // branch is unreachable on a stopped wall, and nothing has to be done
      // about it beyond proving that.
      const run = applyWallRunStop(
        { lengthIn: MERGE_LENGTH_IN, hasCornerStart: true, hasCornerEnd: true },
        { startStopIn: 12, endStopIn: 0 },
      );
      expect(run.hasCornerStart).toBe(false);
      expect(run.hasCornerEnd).toBe(true);
      const stopped = tileWall(run.lengthIn, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, "end", run.hasCornerStart, run.hasCornerEnd)
        .slots;
      expect(stopped.some((s) => s.widthIn === MERGE_LENGTH_IN)).toBe(false);
      expect(toEighths(sumWidths(stopped)) + toEighths(run.startStopIn)).toBe(toEighths(MERGE_LENGTH_IN));
      for (const slot of stopped) expect(Number.isInteger(toEighths(slot.widthIn))).toBe(true);
    });

    it("is deterministic — repeated evaluation reaches the same fixed point", () => {
      const once = cornerOwnershipWithRunStops(fp, allPrimary(fp), THICKNESS_IN, stopAtCornerB);
      for (let i = 0; i < 5; i++) {
        expect(cornerOwnershipWithRunStops(fp, allPrimary(fp), THICKNESS_IN, stopAtCornerB)).toEqual(once);
      }
      expect(JSON.stringify(tile(stopAtCornerB))).toBe(JSON.stringify(tile(stopAtCornerB)));
    });
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
