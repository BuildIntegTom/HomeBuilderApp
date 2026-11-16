import { describe, expect, it } from "vitest";
import {
  computeGableTiledRow,
  footprintLoops,
  gableEndWallIdsFor,
  isMiteredShape,
  retile,
  ringRoofGableBlockReason,
  roofHeightFtAt,
  roofSpanFt,
  seedGableWindows,
  simpleRoofPlanes,
  shedTallWallId,
  wallCompassDirection,
  wallGeometryFor,
  wallRoofTopsFor,
  type Footprint,
  type GableWallJointSpan,
  type GableWindowReservation,
  type PanelSlot,
  type WallRoofTop,
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
import { crossTiltWallIdsFor } from "./crossTiltTakeoff";
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
  /** ⚠ Null on a rectangle. On a mitered shape, each wall's roofline taken
   *  from the roof above its own two corners — see `gableProfilePointsFor`. */
  roofTops: Map<string, WallRoofTop> | null;
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

  /* ⚠ **The building's span across the ridge**, which is what the app now
     reads. It used to measure the gable WALL, equal on a box and one eighth
     facet on an octagon — see the octagon section at the bottom. */
  const wallWidthIn = roofSpanFt(fp) * 12;
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

  /* ⚠ **On a mitered shape every wall under the roof carries a row**, minus
     the shed's tall wall which the cross-tilt row closes. page.tsx does the
     same, right after the form and rise are known. */
  const roof = simpleRoofPlanes(fp, { form, pitchIn12: PITCH_IN12, eaveHeightFt: WALL_HEIGHT_FT });
  const mitered = isMiteredShape(fp) && roof.refusal === null;
  const roofTops = mitered ? new Map(wallRoofTopsFor(fp, roof, WALL_HEIGHT_FT).map((t) => [t.wallId, t])) : null;
  const rowWallIds = (() => {
    if (!roofTops) return gableWallIds;
    const tallWallId = form === "shed" ? shedTallWallId(fp, { form: "shed", pitchIn12: PITCH_IN12, eaveHeightFt: WALL_HEIGHT_FT }) : null;
    return [...roofTops.values()]
      .filter((t) => t.tallerAboveEaveIn > GABLE_PANEL_MIN_HEIGHT_IN && t.wallId !== tallWallId)
      .map((t) => t.wallId);
  })();

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
  return { fp, thicknessIn, gableWallIds: rowWallIds, form, riseFt, positionsInByWallId, slots, leastAccessible, primary, roofTops };
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

/** `gableProfilePointsFor` — a mitered wall takes its roofline from the roof
 *  above its own two corners, plus the ridge where one crosses it. */
function pointsFor(d: DrawnTemplate, wallId: string) {
  const lengthIn = d.fp.walls.find((w) => w.id === wallId)!.lengthFt * 12;
  const top = d.roofTops?.get(wallId);
  if (!top) return gableProfilePointsForWall(lengthIn, [d.riseFt], d.positionsInByWallId[wallId] ?? [], EAVE_IN);
  return [
    { xIn: 0, heightIn: EAVE_IN + top.startAboveEaveIn, isExplicitPosition: true },
    ...(top.ridgeCrossing ? [{ xIn: top.ridgeCrossing.atIn, heightIn: EAVE_IN + top.ridgeCrossing.aboveEaveIn }] : []),
    { xIn: lengthIn, heightIn: EAVE_IN + top.endAboveEaveIn, isExplicitPosition: true },
  ];
}

/** `gableTilesByWallId`'s own `computeGableTiledRow` call, argument for argument. */
function rowFor(d: DrawnTemplate, wallId: string, windows: GableWindowReservation[]) {
  const wall = d.fp.walls.find((w) => w.id === wallId)!;
  const lengthIn = wall.lengthFt * 12;
  return computeGableTiledRow(
    lengthIn,
    EAVE_IN,
    pointsFor(d, wallId),
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
    /* ⚠ The mitered rooflines, so the seeder judges the row `rowFor` builds. */
    Object.fromEntries([...(d.roofTops?.keys() ?? [])].map((id) => [id, pointsFor(d, id)])),
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
        /* ⚠ **The row spans the WHOLE wall, corner to corner** — full-height
           gables take no truss-plate inset, so this is the floor plan's own
           width and NOT the wall's slot run, which is shorter wherever a
           neighbour owns the corners (161in under a 192in gable wall on the
           Tiny House).

           ⚠ To within an EIGHTH, because an octagon's four diagonal facets are
           not a whole number of eighths long — the 16ft tile's are 79.5495in —
           and this app tiles in eighths. The wall below rounds them exactly
           the same way (79.5495 -> 79.5000, 159.0990 -> 159.1250), so the two
           layers agree with each other; what they cannot do is agree with a
           number that is not on the grid. */
        expect(
          Math.abs(cursor - lengthIn),
          `${where}: the row spans ${cursor}in of a ${lengthIn}in wall, past the eighth-inch grid`,
        ).toBeLessThanOrEqual(0.125 + 1e-9);
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
    /* ⚠ **Measured 2026-11-15, not estimated: 17 and 2.**
       It was 10 and 6 when this file was written, and the octagon fix is what
       moved it — both Octagons used to refuse every window because their rows
       were derived from one 6ft 7in facet and rose 27in. Now that each wall
       takes its roofline from the roof above its own two corners, their gables
       are real and can hold windows, so four refusals became placements. The
       two refusals left are The Tank's pair, whose gable genuinely rises only
       48in, which is less than a 48in window plus a panel above it.

       Floors rather than equalities so that adding a template cannot fail it;
       but a DROP below these means fewer places a window may legally go than
       when this was last measured, which is worth someone looking at. */
    expect(checked, `only ${checked} ordinals were checked across every template`).toBeGreaterThanOrEqual(17);
    expect(refusals, `only ${refusals} gable walls refused a window`).toBeGreaterThanOrEqual(2);
  });
});

describe("⚠ an octagon's roof meets its walls", () => {
  /**
   * > *"Octagon roofs does not meet, correct. I like the shed style on the
   * > octagon though as an option. I think octagon shed is possible, there's
   * > just going to be some very unique gable panels."* — Tommy, 2026-11-15
   *
   * This section used to be headed **KNOWN AND REPORTED** and pinned the fault
   * rather than its absence. What it pins now is the acceptance bar for his
   * answer: **every row on an octagon ends exactly where the roof above its
   * own two corners ends**, and the walls that get no row are only the ones
   * that genuinely need none.
   *
   * ⚠ The "unique gable panels" he expected are real, and this is what makes
   * them unique: a NE facet's top edge is a straight line lying in the roof
   * plane while the wall runs 45 degrees to the fall, so its rake is neither
   * the pitch nor level, and both of its ends are up in the air. No new panel
   * TYPE was needed for any of it — `buildGablePanelMembers` already takes an
   * arbitrary left and right height, equal heights included.
   */
  for (const acrossFt of [16, 32]) {
    it(`the ${acrossFt}ft octagon: every row meets the roof at both ends and in the middle`, () => {
      const drawn = drawTemplate({ shape: "octagon", widthFt: acrossFt, depthFt: acrossFt })!;
      expect(drawn).toBeTruthy();
      const roof = simpleRoofPlanes(drawn.fp, {
        form: drawn.form,
        pitchIn12: PITCH_IN12,
        eaveHeightFt: WALL_HEIGHT_FT,
      });
      const tops = new Map(wallRoofTopsFor(drawn.fp, roof, WALL_HEIGHT_FT).map((t) => [t.wallId, t]));

      /* Six walls carry a row on both tiles: the two E/W facets and the four
         diagonals. The other two are the shed's tall wall (closed by the
         cross-tilt row) and the wall down at the eave — or, on the peak, the
         two eave walls. */
      expect(drawn.gableWallIds).toHaveLength(6);

      for (const wallId of drawn.gableWallIds) {
        const wall = drawn.fp.walls.find((w) => w.id === wallId)!;
        const lengthIn = wall.lengthFt * 12;
        const top = tops.get(wallId)!;
        const tiles = rowFor(drawn, wallId, []);
        const where = `${acrossFt}ft octagon, wall ${wallId} (${wallCompassDirection(wall, drawn.fp)})`;

        /* ⚠ The row's two outer edges against the roof at the same corners.
           Before this, the E facet's row ran 27in down to 0 while the roof
           over it went 45 1/4in down to 18 3/4in — meeting at neither end. */
        expect(tiles[0]!.leftHeightIn - EAVE_IN, `${where}: the row's start does not meet the roof`).toBeCloseTo(
          top.startAboveEaveIn,
          1,
        );
        expect(
          tiles[tiles.length - 1]!.rightHeightIn - EAVE_IN,
          `${where}: the row's end does not meet the roof`,
        ).toBeCloseTo(top.endAboveEaveIn, 1);

        /* ⚠ **And in the MIDDLE, which is the assertion with teeth on a peak.**
           Meeting at both ends is not enough for a wall the ridge crosses: the
           32ft Octagon's E facet has both corners 37 1/2in up and its ridge
           64in up, so a row built from the corners alone met both ends and ran
           26 1/2in flat across the top. */
        const a = drawn.fp.corners.find((c) => c.id === wall.startCorner)!.point;
        const b = drawn.fp.corners.find((c) => c.id === wall.endCorner)!.point;
        const roofMidIn = (roofHeightFtAt({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, roof)! - WALL_HEIGHT_FT) * 12;
        const midTile = tiles.find((t) => t.xStartIn <= lengthIn / 2 && t.xStartIn + t.widthIn >= lengthIn / 2)!;
        /* ⚠ **A tile carrying the ridge answers with its APEX, not with its
           edges.** The ridge column is a flat-topped tile with the peak
           recorded in `apexXIn`/`apexHeightIn` — on the 32ft Octagon's E facet
           its top is flat at 59 3/4in with the ridge 4 1/4in above it, which
           is the same shape a rectangle's column has (see the Gable Peak
           Panel). Lerping its edges reads 4 1/4in low and says "sag" about a
           row that is correct. */
        const rowMidIn =
          midTile.apexHeightIn !== undefined
            ? midTile.apexHeightIn - EAVE_IN
            : midTile.leftHeightIn +
              ((lengthIn / 2 - midTile.xStartIn) / midTile.widthIn) * (midTile.rightHeightIn - midTile.leftHeightIn) -
              EAVE_IN;
        expect(rowMidIn, `${where}: the row sags or stands proud of the roof at mid-span`).toBeCloseTo(roofMidIn, 1);
      }
    });
  }

  it("⚠ the shed's tall wall gets NO gable row, because the cross-tilt row already closes it", () => {
    /* Giving it one would build the same wall twice. This is the correction to
       the sweep's first reading, which counted it among the open walls. */
    const drawn = drawTemplate({ shape: "octagon", widthFt: 16, depthFt: 16 })!;
    expect(drawn.form).toBe("shed");
    const tallId = shedTallWallId(drawn.fp, { form: "shed", pitchIn12: PITCH_IN12, eaveHeightFt: WALL_HEIGHT_FT })!;
    expect(wallCompassDirection(drawn.fp.walls.find((w) => w.id === tallId)!, drawn.fp)).toBe("N");
    expect(drawn.gableWallIds).not.toContain(tallId);
    expect(crossTiltWallIdsFor(drawn.fp, "shed", PITCH_IN12, WALL_HEIGHT_FT).has(tallId)).toBe(true);
  });

  it("⚠ the 32ft octagon is PEAKED now, and for the right reason", () => {
    /* It used to be a shed, because `decideRoofForm` was handed one 13.25ft
       facet instead of the 32ft span — a roof needing a 33.7ft panel against
       the 17.1ft one reaches at 4:12. His shed option lives on the 16ft tile,
       where the span really is inside one panel's reach. */
    const big = drawTemplate({ shape: "octagon", widthFt: 32, depthFt: 32 })!;
    const small = drawTemplate({ shape: "octagon", widthFt: 16, depthFt: 16 })!;
    expect(roofSpanFt(big.fp)).toBeCloseTo(32, 6);
    expect(roofSpanFt(small.fp)).toBeCloseTo(16, 6);
    expect(big.form).toBe("peaked");
    expect(small.form).toBe("shed");
  });

  it("⚠ a mitered row BEARS the roof — no roof-top lift, so the roof rests on it", () => {
    /**
     * > *"roof panels resting on top of gable panels for shed octagon ... it
     * > also looks like the smallest two gable end trapezoids are kind of tall
     * > on their lower side - the roof panels should be fully sitting on their
     * > 15.5" wall and then rest on the gable end panels as the incline
     * > rises."* — Tommy, 2026-11-15
     *
     * On a box, `gableEndsFullHeight` lifts a gable to the roof's TOP surface
     * so it closes the building's end over the roof's edge — his 2026-10-29
     * rule, unchanged. A mitered shape's rows are not ends, they are BEARING,
     * and lifting them put every one 16 3/8in proud of the roof it carries.
     * He saw both symptoms on screen before anything was measured; the numbers
     * below are what they were.
     */
    const drawn = drawTemplate({ shape: "octagon", widthFt: 16, depthFt: 16 })!;
    const roof = simpleRoofPlanes(drawn.fp, { form: "shed", pitchIn12: PITCH_IN12, eaveHeightFt: WALL_HEIGHT_FT });
    const tallId = shedTallWallId(drawn.fp, { form: "shed", pitchIn12: PITCH_IN12, eaveHeightFt: WALL_HEIGHT_FT })!;
    const tops = new Map(wallRoofTopsFor(drawn.fp, roof, WALL_HEIGHT_FT).map((t) => [t.wallId, t]));

    /* ⚠ `gableRowsCloseOverRoof` in page.tsx is `gableEndsFullHeight &&
       !isMiteredShape(footprint)` — false here, which is the whole change. */
    const liftFor = (tile: { widthIn: number; leftEdgeHeightIn: number; rightEdgeHeightIn: number }, closesOver: boolean) =>
      gableTileRoofTopLiftIn(tile, closesOver, drawn.thicknessIn, PITCH_IN12, EAVE_IN, GABLE_PANEL_MAX_HEIGHT_IN);

    for (const wallId of drawn.gableWallIds) {
      const wall = drawn.fp.walls.find((w) => w.id === wallId)!;
      const where = `16ft octagon, wall ${wallId} (${wallCompassDirection(wall, drawn.fp)})`;
      for (const t of rowFor(drawn, wallId, [])) {
        const tile = { widthIn: t.widthIn, leftEdgeHeightIn: t.leftHeightIn, rightEdgeHeightIn: t.rightHeightIn };
        expect(liftFor(tile, false), `${where}: a bearing row was lifted off the roof it carries`).toBe(0);
      }
    }

    /* ⚠ **The two corners he pointed at, by the numbers.** */
    const dirOf = (id: string) => wallCompassDirection(drawn.fp.walls.find((w) => w.id === id)!, drawn.fp);
    const ne = drawn.gableWallIds.find((id) => dirOf(id) === "NE")!;
    const se = drawn.gableWallIds.find((id) => dirOf(id) === "SE")!;

    /* The NE facet's tall end must land exactly on the roof height the
       cross-tilt row beside it is built to — 64in, flush, no step. */
    const neTiles = rowFor(drawn, ne, []);
    const neTallestIn = Math.max(...neTiles.flatMap((t) => [t.leftHeightIn, t.rightHeightIn])) - EAVE_IN;
    expect(neTallestIn).toBeCloseTo(64, 1);
    expect(tops.get(tallId)!.tallerAboveEaveIn, "the cross-tilt wall's roof height").toBeCloseTo(64, 1);
    /* ⚠ Lifted, it was 80.34in — 16 3/8in proud of the row next to it. */
    const neTallTile = neTiles.find((t) => Math.max(t.leftHeightIn, t.rightHeightIn) - EAVE_IN > 63)!;
    expect(
      neTallestIn + liftFor({ widthIn: neTallTile.widthIn, leftEdgeHeightIn: neTallTile.leftHeightIn, rightEdgeHeightIn: neTallTile.rightHeightIn }, true),
    ).toBeCloseTo(80.34, 1);

    /* The SE facet has to run OUT at the eave corner, so the roof lands on the
       15 1/2in wall there rather than on a panel. Lifted, its low end was
       16.35in tall under a roofline of zero. */
    const seLowestIn = Math.min(...rowFor(drawn, se, []).flatMap((t) => [t.leftHeightIn, t.rightHeightIn])) - EAVE_IN;
    expect(seLowestIn, "the SE facet does not reach the eave").toBeLessThan(GABLE_PANEL_MIN_HEIGHT_IN);
  });

  it("a rectangle is untouched by all of it", () => {
    /* The safety property: these templates must draw exactly as before. */
    for (const plan of [
      { shape: "rectangle" as const, widthFt: 24, depthFt: 16 },
      { shape: "rectangle" as const, widthFt: 48, depthFt: 24 },
    ]) {
      const drawn = drawTemplate(plan)!;
      expect(drawn.gableWallIds).toHaveLength(2);
      expect(drawn.gableWallIds.sort()).toEqual(gableEndWallIdsFor(drawn.fp).sort());
      const roof = simpleRoofPlanes(drawn.fp, { form: drawn.form, pitchIn12: PITCH_IN12, eaveHeightFt: WALL_HEIGHT_FT });
      /* No wall of a rectangle is described by corner heights alone when it is
         peaked, which is exactly why rectangles keep the stored-rise path. */
      expect(wallRoofTopsFor(drawn.fp, roof, WALL_HEIGHT_FT).length).toBe(4);
    }
  });
});
