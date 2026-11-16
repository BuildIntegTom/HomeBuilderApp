import { describe, expect, it } from "vitest";
import {
  computeGableTiledRow,
  footprintLoops,
  gableEndWallIdsFor,
  retile,
  ringRoofGableBlockReason,
  seedGableWindows,
  simpleRoofPlanes,
  wallCompassDirection,
  wallGeometryFor,
  type Footprint,
  type GableWallJointSpan,
  type GableWindowReservation,
  type PanelSlot,
} from "@building-integrity/geometry";
import {
  buildGablePanelMembers,
  COLUMN_TOTAL_WIDTH_IN,
  decideRoofForm,
  GABLE_PANEL_MAX_HEIGHT_IN,
  GABLE_PANEL_MIN_HEIGHT_IN,
  seedWindowWidthsIn,
  standardWindowHeightDefaultIn,
} from "@building-integrity/panel-catalog";
import { STARTER_TEMPLATES, footprintForPlan, type StarterPlan } from "./starterTemplates";
import { seedGableWindowsForFootprint } from "./gableWindowSeed";
import { placeColumnUnderPeak } from "./gableColumnPlacement";
import {
  capGableTileHeights,
  computeRiseFtForPitch,
  gableProfilePointsForWall,
  gableTileRoofTopLiftIn,
  gableWindowCapHeightsIn,
  resolveHeelSeat,
} from "./gableProfilePoints";

/**
 * ⚠ **EVERY STARTER TEMPLATE, DRAWN THE WAY THE APP DRAWS IT, SWEPT FOR GABLE
 * FAULTS.**
 *
 * > *"Unnoticed, there's still some glitches happening with Gable end panels."*
 * > — Tommy, 2026-11-15
 *
 * The one found that morning was a stale gable window surviving a re-draw. He
 * said *glitches*, plural, so this is the systematic pass: **the Home tiles are
 * a stranger's first thirty seconds**, and a fault in one of them is a fault
 * everybody sees.
 *
 * ## How this differs from `gablePeakSweep.test.ts`, which already exists
 *
 * That file sweeps the PEAK POSITION across three hand-listed wall lengths and
 * asks one question: does the chain throw. It is a crash guard, and it could
 * not have caught either defect below, because:
 *
 * 1. its wall lengths are **typed in** (`TEMPLATE_GABLE_WALLS_IN`), so the
 *    templates can change under it — and its own comment that *"the octagons
 *    and the courtyards have no gable end"* is **wrong**, see the octagon
 *    section at the bottom;
 * 2. it builds its roof profile by hand, so it never runs the real
 *    footprint to roof form to gable walls to slots to seeded windows chain;
 * 3. a window with no panel over it **does not throw**. Its `buildTiles`
 *    simply skips the cap when `gableWindowCapHeightsIn` returns `"none"`, so
 *    a hole in the wall passes every assertion it makes.
 *
 * This file starts from `STARTER_TEMPLATES` itself and asks a different
 * question: **is the row geometrically sound, and does a seeded window land on
 * a tile that can hold it.**
 *
 * ## ⚠ The two defects it was written against, both measured
 *
 * Both were in `seedGableWindowsForFootprint`, which tiles the row a second
 * time to decide which tile may hold a window. Both made it judge a DIFFERENT
 * row than the app builds, and the symptom of both was the same: a 48in window
 * standing through its own roofline with no panel above it.
 *
 * **On every SHED** — it built its profile point without `isExplicitPosition`,
 * so a point stored at x = 0 (how this app stores a shed) was not recognised as
 * one. Its row grew a spurious 1in tile rising 0 to 64in and every ordinal
 * shifted by one. On the Tiny House, ordinal 2 was judged at 59.14in and built
 * at 42.83in: **5.17in proud**.
 *
 * **On every PEAK** — it counted the ridge column as an ordinal, which
 * `seedGableWindows` documents as excluded *"by construction"*. On the Cindy
 * every ordinal from the column rightward landed one tile late (ordinal 7
 * judged at 51.66in, built at 37.60in: **10.4in proud**) and the last ordinal
 * was **dropped entirely**.
 *
 * ⚠ **Neither was reproducible on demand**, which is why they read as
 * "glitches": which ordinal gets a window is random, so the breach appeared on
 * some draws and not others. That is also why the core test below does **not**
 * draw at random — it forces a window onto **every ordinal the seeder would
 * approve** and checks them all.
 */

/* The app's live defaults at the moment a starter template is picked. */
const STANDARD_WIDTH_IN = 48;
const CORNER_WIDTH_IN = 15.5;
const WALL_HEIGHT_FT = 10;
const EAVE_IN = WALL_HEIGHT_FT * 12;
const PITCH_IN12 = 4;
/* `gableEndsFullHeight` is on by default, which pins the inset and the heel to
   0 (see `effectiveHeelHeightIn`). */
const INSET_IN = 0;
const HEEL_IN = 0;
const ANCHOR = "truss-heel" as const;
/* `columnTopDropIn` — 0, because the column runs full height to the peak. */
const COLUMN_TOP_DROP_IN = 0;
const MIN_TILE_RISE_FOR_WINDOW_IN = standardWindowHeightDefaultIn.value + GABLE_PANEL_MIN_HEIGHT_IN;

interface DrawnTemplate {
  fp: Footprint;
  thicknessIn: number;
  gableWallIds: string[];
  form: "shed" | "peaked";
  riseFt: number;
  positionsInByWallId: Record<string, number[]>;
  slots: Record<string, PanelSlot[]>;
  leastAccessible: string;
  primary: Set<string>;
}

/**
 * ⚠ **`applyRoofDefaultsForFootprint` + `commitNewFootprint`, replicated.**
 *
 * Like `gablePeakSweep.test.ts`, this is a COPY of steps that live inside a
 * 15,000-line component and cannot be imported, so it can go stale silently.
 * The guard against that is the contract assertions at the bottom — and, more
 * usefully, that the two things it leans on hardest
 * (`seedGableWindowsForFootprint` and `gableProfilePointsForWall`) are real
 * modules the app itself calls rather than copies of them.
 */
function drawTemplate(plan: StarterPlan): DrawnTemplate | null {
  const { footprint: fp } = footprintForPlan(plan);
  const thicknessIn = plan.thicknessIn ?? 15.5;
  const leastAccessible = fp.corners[0]!.id;
  const primary = new Set(fp.corners.map((c) => c.id));

  const gableWallIds = ringRoofGableBlockReason(fp) === null ? gableEndWallIdsFor(fp) : [];
  if (gableWallIds.length === 0) return null;

  /* ⚠ `acrossFt` is the GABLE WALL's own length, which is what the app uses.
     On a box that is the across-the-ridge span; on an octagon it is one facet.
     That difference is a real finding, pinned at the bottom of this file rather
     than quietly corrected here. */
  const gableWall = fp.walls.find((w) => gableWallIds.includes(w.id))!;
  const a = fp.corners.find((c) => c.id === gableWall.startCorner)!.point;
  const b = fp.corners.find((c) => c.id === gableWall.endCorner)!.point;
  const wallWidthIn = Math.hypot(b.x - a.x, b.y - a.y) * 12;
  const form = decideRoofForm({ buildingWidthIn: wallWidthIn, pitchIn12: PITCH_IN12 }).kind === "shed" ? "shed" : "peaked";

  const seat = resolveHeelSeat(wallWidthIn, STANDARD_WIDTH_IN, HEEL_IN, form === "shed" ? 1 : 2, ANCHOR, INSET_IN);
  const runForPitchIn = (form === "shed" ? wallWidthIn : wallWidthIn / 2) - seat.runOffsetIn;
  const riseFt = computeRiseFtForPitch(PITCH_IN12, runForPitchIn, seat.heelOffsetIn);

  /* A shed stores its point at x = 0 on the gable wall whose start corner is
     the high one, and at x = the wall's own length on the other; a peak stores
     nothing at all. */
  const shedPlane =
    form === "shed"
      ? simpleRoofPlanes(fp, { form: "shed", pitchIn12: PITCH_IN12, eaveHeightFt: WALL_HEIGHT_FT }).planes[0]
      : undefined;
  const pointOf = (id: string) => fp.corners.find((c) => c.id === id)?.point;
  const positionsInByWallId: Record<string, number[]> =
    shedPlane === undefined
      ? {}
      : Object.fromEntries(
          gableWallIds.map((id) => {
            const w = fp.walls.find((x) => x.id === id);
            const s = w && pointOf(w.startCorner);
            const e = w && pointOf(w.endCorner);
            if (!w || !s || !e) return [id, [0]];
            const hx = (shedPlane.highStart.x + shedPlane.highEnd.x) / 2;
            const hy = (shedPlane.highStart.y + shedPlane.highEnd.y) / 2;
            const startIsHigh = Math.hypot(s.x - hx, s.y - hy) < Math.hypot(e.x - hx, e.y - hy);
            return [id, [startIsHigh ? 0 : w.lengthFt * 12]];
          }),
        );

  let slots = retile(fp, leastAccessible, primary, STANDARD_WIDTH_IN, CORNER_WIDTH_IN, thicknessIn, { windowWidthsIn: seedWindowWidthsIn.value }, {}, true);
  if (form === "peaked") {
    for (const wallId of gableWallIds) {
      const w = fp.walls.find((x) => x.id === wallId);
      const g = wallGeometryFor(fp, wallId, primary, leastAccessible, thicknessIn, {});
      if (!w || !g) continue;
      const placed = placeColumnUnderPeak({
        slots: slots[wallId] ?? [],
        peakXIn: (w.lengthFt * 12) / 2,
        startOffsetIn: g.runStartOffsetIn,
        lengthIn: g.lengthIn,
        standardWidthIn: STANDARD_WIDTH_IN,
        cornerWidthIn: CORNER_WIDTH_IN,
        gapEnd: g.gapEnd,
        hasCornerStart: g.hasCornerStart,
        hasCornerEnd: g.hasCornerEnd,
        allowBorrow: g.allowBorrow,
        /* `cornerMayWidenForTiling` — true for every panelization but Square
           Bale, whose 39in whole-bale corner cannot be cut off nominal. */
        cornerMayWiden: true,
        columnWidthIn: COLUMN_TOTAL_WIDTH_IN,
      });
      if (placed) slots = { ...slots, [wallId]: placed };
    }
  }
  return { fp, thicknessIn, gableWallIds, form, riseFt, positionsInByWallId, slots, leastAccessible, primary };
}

/** `gableWallJointSpansFor` — cumulative from the wall's own RUN START. */
function jointSpansFor(d: DrawnTemplate, wallId: string): GableWallJointSpan[] {
  const g = wallGeometryFor(d.fp, wallId, d.primary, d.leastAccessible, d.thicknessIn, {});
  let atIn = g?.runStartOffsetIn ?? 0;
  return (d.slots[wallId] ?? []).map((slot) => {
    const span = {
      xStartIn: atIn,
      xEndIn: atIn + slot.widthIn,
      isSafetyGap: slot.type === "safety-gap",
      isColumn: slot.type === "column",
    };
    atIn += slot.widthIn;
    return span;
  });
}

/** `gableTilesByWallId`'s own `computeGableTiledRow` call, argument for argument. */
function rowFor(d: DrawnTemplate, wallId: string, windows: GableWindowReservation[]) {
  const wall = d.fp.walls.find((w) => w.id === wallId)!;
  const lengthIn = wall.lengthFt * 12;
  return computeGableTiledRow(
    lengthIn,
    EAVE_IN,
    gableProfilePointsForWall(lengthIn, [d.riseFt], d.positionsInByWallId[wallId] ?? [], EAVE_IN),
    STANDARD_WIDTH_IN,
    INSET_IN,
    true,
    HEEL_IN,
    ANCHOR,
    windows,
    d.form === "peaked" ? COLUMN_TOTAL_WIDTH_IN : undefined,
    0,
    lengthIn,
    jointSpansFor(d, wallId),
    COLUMN_TOP_DROP_IN,
  );
}

/** The seeder, with the die rigged, so what it returns is deterministic. */
function seedFor(d: DrawnTemplate, wallId: string, minRiseIn: number, die: () => number) {
  return seedGableWindowsForFootprint(
    d.fp,
    [wallId],
    d.slots,
    {},
    d.thicknessIn,
    EAVE_IN,
    d.riseFt,
    d.positionsInByWallId,
    STANDARD_WIDTH_IN,
    INSET_IN,
    HEEL_IN,
    ANCHOR,
    d.form === "peaked" ? COLUMN_TOTAL_WIDTH_IN : undefined,
    minRiseIn,
    COLUMN_TOP_DROP_IN,
    die,
  );
}

/** ⚠ **Rigged dice, so what the seeder returns is deterministic.** Wide
 * enough to reach the LAST candidate as well as the first: a defect that
 * shifts ordinals rightward only shows up on the ordinals nearest the end, and
 * a narrow set of dice is how the first version of this file missed exactly
 * that. */
const DICE = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.999].map((r) => () => r);

/* ⚠ **Totals across the whole sweep, asserted at the bottom.** Per template
   they would be the wrong question: a building whose gable is too shallow for
   any window legitimately checks zero ordinals and refuses instead. What must
   not happen is that the WHOLE sweep quietly degenerates to that. */
let checked = 0;
let refusals = 0;

const DRAWN = STARTER_TEMPLATES.flatMap((tpl) =>
  tpl.options.map((opt) => ({ label: `${tpl.name} — ${opt.label}`, plan: opt.plan, drawn: drawTemplate(opt.plan) })),
);

describe("⚠ every starter template's gable row is a sound row", () => {
  for (const { label, plan, drawn } of DRAWN) {
    if (!drawn) {
      it(`${label} — carries no gable row at all`, () => {
        /* Not a skip: WHICH templates have gable ends is itself a fact worth
           pinning, since `ringRoofGableBlockReason` is what decides it and a
           courtyard losing (or gaining) a gable row is a real change. */
        const { footprint } = footprintForPlan(plan);
        expect(footprintLoops(footprint).length).toBeGreaterThan(1);
        expect(ringRoofGableBlockReason(footprint)).not.toBeNull();
      });
      continue;
    }

    it(`${label} — the row covers its wall exactly, with no gap and no sliver`, () => {
      for (const wallId of drawn.gableWallIds) {
        const wall = drawn.fp.walls.find((w) => w.id === wallId)!;
        const lengthIn = wall.lengthFt * 12;
        const tiles = rowFor(drawn, wallId, []);
        const where = `${label} wall ${wallId} (${wallCompassDirection(wall, drawn.fp)})`;
        expect(tiles.length, `${where}: built no tiles`).toBeGreaterThan(0);
        let cursor = tiles[0]!.xStartIn;
        expect(cursor, `${where}: the row does not start at the wall's corner`).toBeCloseTo(0, 6);
        for (const t of tiles) {
          expect(t.xStartIn, `${where}: a gap or overlap in the row at x${t.xStartIn}`).toBeCloseTo(cursor, 6);
          expect(t.widthIn, `${where}: a zero- or negative-width tile at x${t.xStartIn}`).toBeGreaterThan(0);
          if (t.apexXIn !== undefined) {
            expect(t.apexXIn, `${where}: the ridge sits outside the tile carrying it`).toBeGreaterThanOrEqual(t.xStartIn - 1e-6);
            expect(t.apexXIn).toBeLessThanOrEqual(t.xStartIn + t.widthIn + 1e-6);
          }
          cursor = t.xStartIn + t.widthIn;
        }
        expect(cursor, `${where}: the row ends at ${cursor}in, not the wall's ${lengthIn}in`).toBeCloseTo(lengthIn, 6);
      }
    });

    it(`⚠ ${label} — EVERY ordinal the seeder would approve really can hold its window`, () => {
      /* ⚠ **THE CORE TEST, and it is deliberately not random.** Both defects
         this file was written against were invisible on most draws, because
         `seedGableWindows` picks its ordinals with `Math.random`. So instead of
         drawing once, this walks the whole candidate set the seeder is allowed
         to choose from and checks every one of them against the row the app
         really builds.

         A failure here is a 48in window with no panel over its head. */
      for (const wallId of drawn.gableWallIds) {
        const wall = drawn.fp.walls.find((w) => w.id === wallId)!;
        const where = `${label} wall ${wallId} (${wallCompassDirection(wall, drawn.fp)})`;
        const bare = rowFor(drawn, wallId, []);
        /* The ordinal space `beforeTileCount` counts in — safety gaps and the
           ridge column excluded, which is the contract `seedGableWindows`
           states in its own first parameter. */
        const risesIn = bare
          .filter((t) => !t.isSafetyGap && !t.isColumn)
          .map((t) => Math.max(t.leftHeightIn, t.rightHeightIn) - EAVE_IN);
        /* ⚠ **EVERY ordinal that could hold a window, enumerated directly** —
           every interior one, since `seedGableWindows` excludes the two end
           tiles (*"the end tiles are its SHORTEST, down at the eave"*). This
           is deliberately WIDER than the seeder's own candidate rule: a window
           must survive wherever one could ever be placed, by seeding or by
           hand, not only where today's bar happens to allow it.

           ⚠ Rigging the seeder's own die was tried first and **measured the
           same 10 ordinals**, so the two agree today. Enumeration is kept
           anyway for two reasons that do not depend on that: it does not go
           stale if the seeder's picking changes, and a hand-placed window is
           not subject to the seeder's bar at all. The cross-check below keeps
           what die-rigging was for: whatever the seeder does return must be
           inside this set. */
        const candidates = new Set<number>();
        for (let ordinal = 1; ordinal < risesIn.length - 1; ordinal++) {
          if ((risesIn[ordinal] ?? 0) >= MIN_TILE_RISE_FOR_WINDOW_IN) candidates.add(ordinal);
        }
        for (const die of [() => 0, () => 0.25, () => 0.5, () => 0.75, () => 0.999]) {
          for (const w of seedGableWindows(risesIn, wall.lengthFt * 12, STANDARD_WIDTH_IN, MIN_TILE_RISE_FOR_WINDOW_IN, die)) {
            expect(
              candidates.has(w.beforeTileCount),
              `${where}: the seeder returned ordinal ${w.beforeTileCount}, which this sweep does not cover`,
            ).toBe(true);
          }
        }

        /* ⚠ **No candidate is an ANSWER, not a gap in the sweep.** The Tank's
           gable rises 48in all told, so no interior tile of it can hold a 48in
           window with a panel above — and both Octagons are shallower still.
           What has to be true there is that nothing is seeded at all, which is
           precisely what this morning's stale-window bug violated. */
        if (candidates.size === 0) {
          for (const die of [() => 0, () => 0.5, () => 0.999]) {
            expect(
              seedFor(drawn, wallId, MIN_TILE_RISE_FOR_WINDOW_IN, die)[wallId] ?? [],
              `${where}: no tile here can hold a window, yet one was seeded`,
            ).toEqual([]);
          }
          refusals++;
          continue;
        }

        for (const ordinal of candidates) {
          const tiles = rowFor(drawn, wallId, [{ beforeTileCount: ordinal, widthIn: STANDARD_WIDTH_IN }]);
          const windowTiles = tiles.filter((t) => t.isWindow);
          /* ⚠ A window the seeder promised and the row never placed is a
             silent loss, which is how the last ordinal behaved on the Cindy. */
          expect(windowTiles, `${where}: ordinal ${ordinal} was approved but no window tile was built`).toHaveLength(1);
          const t = windowTiles[0]!;
          const windowHeightIn = t.windowHeightIn ?? standardWindowHeightDefaultIn.value;
          /* ⚠ Measured against the ROOFLINE with no lift, the same basis
             `seedGableWindows`' own guard uses — see
             `gableWindowRooflineReviewEntries` in page.tsx for why the lifted
             basis is the wrong one to judge this on. */
          const cap = gableWindowCapHeightsIn(
            t.leftHeightIn - EAVE_IN,
            t.rightHeightIn - EAVE_IN,
            windowHeightIn,
            GABLE_PANEL_MIN_HEIGHT_IN,
          );
          const proudIn = cap.kind === "none" ? cap.exceedsRooflineIn : 0;
          const riseIn = Math.max(t.leftHeightIn, t.rightHeightIn) - EAVE_IN;
          expect(
            proudIn,
            `${where}: ordinal ${ordinal} was judged at ${(risesIn[ordinal] ?? NaN).toFixed(2)}in and built on a ${riseIn.toFixed(2)}in tile at x${t.xStartIn.toFixed(1)} — a ${windowHeightIn}in window standing through its own roofline`,
          ).toBeLessThanOrEqual(1e-6);
          /* And the tile it landed on IS the tile that was judged. */
          expect(
            riseIn,
            `${where}: ordinal ${ordinal} landed on a tile of a different height than the one judged`,
          ).toBeCloseTo(risesIn[ordinal] ?? NaN, 6);
          expect(t.isColumn, `${where}: ordinal ${ordinal} put a window on the ridge column`).toBeFalsy();
          checked++;
        }
      }
    });

    it(`${label} — no tile is outside the fabrication window, and nothing throws`, () => {
      for (const wallId of drawn.gableWallIds) {
        const where = `${label} wall ${wallId}`;
        const capHeightIn = EAVE_IN + GABLE_PANEL_MAX_HEIGHT_IN;
        for (const t of rowFor(drawn, wallId, [])) {
          if (t.isSafetyGap || t.isWindow) continue;
          /* page.tsx's own cap, then the lift the 3D view applies. */
          const liftForCapIn = drawn.thicknessIn * Math.hypot(1, Math.abs(t.rightHeightIn - t.leftHeightIn) / Math.max(t.widthIn, 1e-9));
          const capped = capGableTileHeights(t.leftHeightIn, t.rightHeightIn, Math.max(EAVE_IN + 1, capHeightIn - liftForCapIn));
          const appliedLiftIn = gableTileRoofTopLiftIn(
            { widthIn: t.widthIn, leftEdgeHeightIn: capped.leftEdgeHeightIn, rightEdgeHeightIn: capped.rightEdgeHeightIn },
            true,
            drawn.thicknessIn,
            PITCH_IN12,
            EAVE_IN,
            GABLE_PANEL_MAX_HEIGHT_IN,
          );
          const leftLocalIn = capped.leftEdgeHeightIn + appliedLiftIn - EAVE_IN;
          const rightLocalIn = capped.rightEdgeHeightIn + appliedLiftIn - EAVE_IN;
          /* Shorter than its own two skins and the row demotes it to a real
             safety-gap filler instead of asking for a panel. */
          if (Math.max(leftLocalIn, rightLocalIn) < GABLE_PANEL_MIN_HEIGHT_IN) continue;
          expect(
            () => buildGablePanelMembers(t.widthIn, drawn.thicknessIn, leftLocalIn, rightLocalIn, true),
            `${where}: a tile at x${t.xStartIn.toFixed(1)} (${leftLocalIn.toFixed(2)}/${rightLocalIn.toFixed(2)}in) cannot be fabricated`,
          ).not.toThrow();
        }
      }
    });
  }
});

describe("⚠ the seeder judges the row the app builds", () => {
  /* The single invariant both defects broke. Stated on its own because it is
     the property; the per-template tests above are only its symptoms. */
  for (const { label, drawn } of DRAWN) {
    if (!drawn) continue;
    it(`${label} — it never offers an ordinal the app's row does not have`, () => {
      for (const wallId of drawn.gableWallIds) {
        const ordinalSpace = rowFor(drawn, wallId, []).filter((t) => !t.isSafetyGap && !t.isColumn);

        /* An impossible bar, so nothing is seeded — this is the "it really does
           refuse" half, without which the assertion below passes on a function
           that never returns anything. */
        expect(seedFor(drawn, wallId, Number.POSITIVE_INFINITY, () => 0)).toEqual({});

        /* ⚠ **THE DECISIVE ASSERTION, and the one this file first got wrong.**
           An earlier version checked only that the ordinal was inside the row
           (`beforeTileCount < ordinalSpace.length`) and **a mutation putting
           the ridge column back into the ordinal space passed all 26 tests** —
           because the shift only pushes the LAST ordinal off the end, and the
           rigged dice rarely pick the last one.

           What has to hold is not that the ordinal exists but that the tile it
           lands on is one the seeder would have approved. So: hand the seeder
           the app's real height bar, take what it returns, build the row the
           app would build from it, and measure the tile the window actually
           got. Every window on the wall is checked, not just the first. */
        for (const die of DICE) {
          const reservations = seedFor(drawn, wallId, MIN_TILE_RISE_FOR_WINDOW_IN, die)[wallId] ?? [];
          if (reservations.length === 0) continue;
          for (const w of reservations) {
            expect(
              w.beforeTileCount,
              `${label} wall ${wallId}: the seeder returned ordinal ${w.beforeTileCount}, past the ${ordinalSpace.length} tiles the app's row has`,
            ).toBeLessThan(ordinalSpace.length);
          }
          const built = rowFor(drawn, wallId, reservations).filter((t) => t.isWindow);
          expect(
            built,
            `${label} wall ${wallId}: the seeder asked for ${reservations.length} window(s) and the row built ${built.length}`,
          ).toHaveLength(reservations.length);
          for (const t of built) {
            const riseIn = Math.max(t.leftHeightIn, t.rightHeightIn) - EAVE_IN;
            expect(
              riseIn,
              `${label} wall ${wallId}: the seeder approved ordinals ${reservations.map((r) => r.beforeTileCount).join("/")} against a ${MIN_TILE_RISE_FOR_WINDOW_IN}in bar, and a window was built on a ${riseIn.toFixed(2)}in tile at x${t.xStartIn.toFixed(1)}`,
            ).toBeGreaterThanOrEqual(MIN_TILE_RISE_FOR_WINDOW_IN - 1e-6);
            expect(t.isColumn, `${label} wall ${wallId}: a window was seeded onto the ridge column`).toBeFalsy();
          }
        }
      }
    });
  }
});

describe("⚠ the sweep really swept", () => {
  /* ⚠ **The guard against a sweep that passes by doing nothing.** Vitest runs
     these describes in file order, so by the time this runs every template
     above has been through the core test. Without it, a change that emptied
     every candidate set — a stricter height bar, a seeder that returns early,
     a `risesIn` filter that removes everything — would turn this whole file
     green while testing nothing at all. */
  it("checked real ordinals on the deep gables and real refusals on the shallow ones", () => {
    /* ⚠ **Measured 2026-11-15, not estimated: 10 and 6.** The 10 are the
       Tiny House's two shed walls (1 placeable ordinal each) and the Cindy's
       two peaked walls (4 each). The 6 are The Tank's pair and both Octagons'
       — gables too shallow for a 48in window anywhere, which is an answer and
       not a gap.

       A floor rather than an equality so that adding a template cannot fail
       it; but a DROP below these means fewer places a window may legally go
       than when this was written, which is worth someone looking at. */
    expect(checked, `only ${checked} ordinals were checked across every template`).toBeGreaterThanOrEqual(10);
    expect(refusals, `only ${refusals} gable walls refused a window`).toBeGreaterThanOrEqual(6);
  });
});

describe("⚠ KNOWN AND REPORTED: an octagon's roof does not meet its walls", () => {
  /**
   * ⚠ **NOT A PASSING BILL OF HEALTH — this section pins a fault that is still
   * OPEN**, so that it is visible and cannot change unnoticed. Found by this
   * sweep on 2026-11-15 and reported to Tommy rather than fixed, because what
   * an octagon's roof should DO is his decision and not a code question.
   *
   * `gableEndWallIdsFor` returns the walls whose compass direction is exactly
   * E/W (or N/S) — **two of an octagon's eight**. Five of the remaining six
   * have roof above them and no gable row under it (the sixth is the one down
   * at the eave, which needs none). And the two that do get a row have
   * the row anchored at the EAVE at both ends, while the roof over those
   * corners is already well up the slope, because an octagon's E facet spans
   * only the middle third of the building's depth.
   *
   * It is also why `decideRoofForm` is asked the wrong number: the app feeds it
   * the gable WALL's length, which on a box is the across-the-ridge span and on
   * an octagon is one facet. At 32ft across it is asked about 13.25ft, answers
   * "shed", and the app builds a shed that would need a 33.7ft roof panel
   * against the 17.1ft one reaches at 4:12.
   *
   * ⚠ Both octagon tiles are Home tiles, and *"make all the pre-designs
   * presentable"* is his January scope — see
   * `docs/queue-january-hardening-scope.md`.
   */
  for (const acrossFt of [16, 32]) {
    it(`the ${acrossFt}ft octagon: 5 of its 8 walls carry roof and no gable row`, () => {
      const { footprint: fp } = footprintForPlan({ shape: "octagon", widthFt: acrossFt, depthFt: acrossFt });
      const gableWallIds = new Set(gableEndWallIdsFor(fp));
      expect(gableWallIds.size).toBe(2);

      const plane = simpleRoofPlanes(fp, { form: "shed", pitchIn12: PITCH_IN12, eaveHeightFt: WALL_HEIGHT_FT }).planes[0]!;
      const yLow = plane.lowStart.y;
      const yHigh = plane.highStart.y;
      const roofAboveEaveIn = (y: number) =>
        (plane.lowHeightFt + ((y - yLow) / (yHigh - yLow)) * (plane.highHeightFt - plane.lowHeightFt) - WALL_HEIGHT_FT) * 12;

      let unroofedWalls = 0;
      let worstOpenIn = 0;
      for (const w of fp.walls) {
        const a = fp.corners.find((c) => c.id === w.startCorner)!.point;
        const b = fp.corners.find((c) => c.id === w.endCorner)!.point;
        const highestIn = Math.max(roofAboveEaveIn(a.y), roofAboveEaveIn(b.y));
        if (gableWallIds.has(w.id) || highestIn <= 1e-6) continue;
        unroofedWalls++;
        worstOpenIn = Math.max(worstOpenIn, highestIn);
      }
      /* ⚠ **FIVE, not six, and the difference is worth stating.** The S wall
         sits right at the eave where the shed runs out, so it legitimately
         needs nothing above it. The five that do are N, NE, SE, SW and NW. */
      expect(unroofedWalls).toBe(5);
      /* The full rise of the shed across the building: 64in of open wall on
         the 16ft octagon, 128in on the 32ft one. */
      expect(worstOpenIn).toBeCloseTo(acrossFt * PITCH_IN12, 6);

      /* And the two gable walls' own ends: the roof is already up the slope
         there, while the row starts at the eave. */
      for (const id of gableWallIds) {
        const w = fp.walls.find((x) => x.id === id)!;
        const a = fp.corners.find((c) => c.id === w.startCorner)!.point;
        const b = fp.corners.find((c) => c.id === w.endCorner)!.point;
        const lowerEndIn = Math.min(roofAboveEaveIn(a.y), roofAboveEaveIn(b.y));
        expect(
          lowerEndIn,
          `the ${acrossFt}ft octagon's ${id}: the roof is ${lowerEndIn.toFixed(1)}in up at its low corner, where the gable row starts at 0`,
        ).toBeGreaterThan(1);
      }
    });
  }

  it("⚠ the 32ft octagon's roof form is decided from one facet, not from its span", () => {
    const { footprint: fp } = footprintForPlan({ shape: "octagon", widthFt: 32, depthFt: 32 });
    const facetFt = fp.walls.find((w) => wallCompassDirection(w, fp) === "E")!.lengthFt;
    expect(facetFt).toBeCloseTo(13.25, 2);
    /* What the app asks it, and what it would answer about the building. */
    expect(decideRoofForm({ buildingWidthIn: facetFt * 12, pitchIn12: PITCH_IN12 }).kind).toBe("shed");
    expect(decideRoofForm({ buildingWidthIn: 32 * 12, pitchIn12: PITCH_IN12 }).kind).toBe("peaked");
  });
});
