import { describe, expect, it } from "vitest";
import {
  computeGableTiledRow,
  GABLE_SHED_SNAP_THRESHOLD_IN,
  retileWithOpenings,
  type GableWallJointSpan,
  type GableWindowReservation,
  type RoofBearingAnchorMode,
  type RoofProfilePoint,
} from "@building-integrity/geometry";
import {
  buildColumnStyleMembers,
  buildGablePanelMembers,
  buildOpeningAssemblyMembers,
  buildSafetyGapMembers,
  buildVerticalGapFillerMembers,
  COLUMN_TOTAL_WIDTH_IN,
  GABLE_PANEL_MAX_HEIGHT_IN,
  GABLE_PANEL_MIN_HEIGHT_IN,
  gableHeelHeightDefaultIn,
  sillDefaultHeightIn,
  standardWindowHeightDefaultIn,
  trussPlateInsetDefaultIn,
} from "@building-integrity/panel-catalog";
import { placeColumnUnderPeak } from "./gableColumnPlacement";
import { computeOpeningGeometry } from "./openingGeometry";
import { capGableTileHeights, gableTileRoofTopLiftIn, gableWindowCapHeightsIn } from "./gableProfilePoints";

/**
 * ⚠ **WHERE THE RIDGE SITS ALONG A GABLE WALL MUST NEVER BE ABLE TO CRASH
 * THE APP**, and it has done, twice.
 *
 * > *"This page couldn't load whenever I lift my fingers off of the shape
 * > draw on mobile"* — Tommy, 2026-10-31
 *
 * `buildGablePanelMembers` answers an impossible panel by THROWING, and it is
 * called inside `Building3DView`'s render — which `BuildingSummaryRender`
 * keeps mounted off-screen at all times. So a throw there does not fail one
 * panel. **It takes the whole page down.** On 2026-11-07 the fifth dimension
 * handle ("Peak along wall") was held back behind
 * `PEAK_HANDLE_ENABLED = false` for exactly that reason, after a crash
 * measured in the browser on a 24 x 16 Tiny House: *0in fine, 12in crash,
 * 24in crash, 36in crash, 48in fine*.
 *
 * That band no longer reproduces — re-driven in the browser on 2026-11-13,
 * every inch 0 -> 192 renders. **This file is why it cannot come back
 * unnoticed.** It sweeps the peak across every inch of a gable wall and
 * replicates, step for step, the chain that crashed:
 *
 * 1. `gableProfilePointsFor` — page.tsx:7414, the profile point for a stored
 *    peak position (`isExplicitPosition` when the user has placed it);
 * 2. the SHED SNAP — `handleChangeGableProfilePositionIn` (page.tsx:2233)
 *    re-pitches the roof to 4:12 the moment a peak lands within
 *    `GABLE_SHED_SNAP_THRESHOLD_IN` of either end, so a slider dragged toward
 *    a corner changes the RISE as well as the position. ⚠ The crash band sat
 *    inside that threshold, and a sweep that moved the peak without snapping
 *    the rise would miss the whole thing;
 * 3. `computeGableTiledRow` — the real 14-argument call at page.tsx:7516;
 * 4. the cap and the too-short-to-build demotion — page.tsx:7595-7640;
 * 5. `Building3DView`'s own per-tile branch — Building3DView.tsx:1790-1875,
 *    including the roof-top lift, which is where a tile's height is finally
 *    decided.
 *
 * ⚠ **The replication is the load-bearing part, and it is a COPY.** Every
 * step above lives inside a `useMemo` in a 15,000-line component and cannot
 * be imported. If any of those five move, this file goes stale silently and
 * will keep passing. The guard against that is the shape assertions in
 * "the replication still matches the app" at the bottom: they fail loudly if
 * the helpers this leans on change their contract.
 *
 * ## ⚠ What this file does NOT establish, measured rather than assumed
 *
 * **It has teeth.** Remove the headroom clamp from `gableTileRoofTopLiftIn`
 * — the one line standing between a steep sliver tile beside a corner-snapped
 * peak and a panel taller than the builder will make — and **7 of these
 * sweeps fail**, on the real message: *"The taller edge height (122.28…)
 * exceeds the …"*. So the class of fault is genuinely caught.
 *
 * **It does not reproduce the 2026-11-07 band, and the ceiling was not what
 * fixed it.** `GABLE_PANEL_MAX_HEIGHT_IN` was raised from 96in to the main
 * story height (120in) in `7b92d11`, the day before this file was written,
 * which was the obvious candidate. Rolled back to 96 by hand, **all 28 of
 * these sweeps still pass** — so whatever closed that band is somewhere else,
 * most likely `2eb5f19` (the gable-window clamp moved to its call site) or
 * `5bbf9b6` (the ridge column's own placement). It is not bisected.
 *
 * So this file is a guard against the fault RECURRING, not a post-mortem of
 * why it stopped. If Tommy hits a crash on the peak again, the thing that
 * closes the gap is a saved project file from just before it goes — that
 * loads straight in here as a case, where a replication cannot be wrong
 * about the state it is replicating.
 */

/** The app's live defaults at the moment a starter template is picked. */
const STANDARD_WIDTH_IN = 48;
const CORNER_WIDTH_IN = 15.5;
const THICKNESS_IN = 15.5;
const WALL_HEIGHT_IN = 120;
const JACK_STUDS = "plywood" as const;

/** Every gable-end wall length a starter template actually produces.
 *
 * ⚠ The gable ends are the SHORT walls, so these are the DEPTHS: the Tiny
 * House's 16ft, the Tank's 24ft and the Cindy's 34'-10". The octagons and the
 * courtyards have no gable end. */
const TEMPLATE_GABLE_WALLS_IN: { name: string; lengthIn: number }[] = [
  { name: "Tiny House (24 x 16)", lengthIn: 16 * 12 },
  { name: "The Tank (48 x 24)", lengthIn: 24 * 12 },
  { name: "The Cindy (34ft 10in gable end)", lengthIn: Math.round((34 + 10 / 12) * 12) },
];

interface SweepCase {
  gableEndsFullHeight: boolean;
  anchorMode: RoofBearingAnchorMode;
  withRidgeColumn: boolean;
  /** ⚠ B3: the gable's joints are forced onto the wall's. A stubbed-out `[]`
   * here lets the tiler divide the row evenly and is the EASY case — the real
   * one hands it fixed boundaries it must honour, which is how a sliver tile
   * beside a corner-snapped peak gets made. */
  withWallJoints: boolean;
  /** A gable window, which has its own crash history (2026-11-13: a window in
   * a tile under ~81.5in threw inside the 3D render). Crossed with the peak
   * because the peak decides how tall that window's tile is. */
  withWindow: boolean;
}

/** The corners of the setting space a gable row is built in. The heel is NOT
 * its own axis — `effectiveHeelHeightIn` (page.tsx:1486) is
 * `gableEndsFullHeight ? 0 : heelHeightIn`, so full-height already pins it. */
const SWEEP_CASES: SweepCase[] = [
  { gableEndsFullHeight: true, anchorMode: "truss-heel", withRidgeColumn: true, withWallJoints: true, withWindow: false },
  { gableEndsFullHeight: true, anchorMode: "truss-heel", withRidgeColumn: true, withWallJoints: false, withWindow: false },
  { gableEndsFullHeight: true, anchorMode: "truss-heel", withRidgeColumn: false, withWallJoints: true, withWindow: false },
  { gableEndsFullHeight: true, anchorMode: "panel-depth", withRidgeColumn: true, withWallJoints: true, withWindow: false },
  { gableEndsFullHeight: true, anchorMode: "truss-heel", withRidgeColumn: true, withWallJoints: true, withWindow: true },
  { gableEndsFullHeight: true, anchorMode: "truss-heel", withRidgeColumn: false, withWallJoints: false, withWindow: true },
  { gableEndsFullHeight: false, anchorMode: "truss-heel", withRidgeColumn: true, withWallJoints: true, withWindow: false },
  { gableEndsFullHeight: false, anchorMode: "panel-depth", withRidgeColumn: false, withWallJoints: false, withWindow: true },
];

/**
 * ⚠ **The wall's own slot run, as the gable row is handed it** —
 * `gableWallJointSpansFor`, page.tsx:7472, cumulative from the wall's start.
 *
 * The ridge column goes in through `placeColumnUnderPeak` rather than at the
 * peak, because that is what the WALL does: it puts its column where the
 * column best fits its own tiling, and the gable then takes that column's
 * edges instead of centring on the peak. So this moves with the sweep.
 */
function wallJointSpansFor(lengthIn: number, peakXIn: number, withRidgeColumn: boolean): GableWallJointSpan[] {
  const bare = retileWithOpenings(lengthIn, STANDARD_WIDTH_IN, CORNER_WIDTH_IN, "end", true, true, [], true, true).slots;
  const placed = withRidgeColumn
    ? placeColumnUnderPeak({
        slots: bare,
        peakXIn,
        startOffsetIn: 0,
        lengthIn,
        standardWidthIn: STANDARD_WIDTH_IN,
        cornerWidthIn: CORNER_WIDTH_IN,
        gapEnd: "end",
        hasCornerStart: true,
        hasCornerEnd: true,
        allowBorrow: true,
        cornerMayWiden: true,
        columnWidthIn: COLUMN_TOTAL_WIDTH_IN,
      })
    : null;
  let atIn = 0;
  return (placed ?? bare).map((slot) => {
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

/** One user-placed gable window, two tiles in from the wall's start. */
const ONE_WINDOW: GableWindowReservation[] = [{ beforeTileCount: 2, widthIn: 48 }];

/**
 * The rise the app would be at with the peak here — i.e. the SHED SNAP.
 *
 * `handleChangeGableProfilePositionIn`: a position newly inside the threshold
 * of either end re-pitches that point to 4:12 over the wall's own run,
 * rounded to the nearest 1/8 of a foot, replacing whatever rise was set.
 */
function riseInForPeak(lengthIn: number, peakXIn: number, restingRiseIn: number): number {
  const lengthFt = lengthIn / 12;
  const shedSnapped = peakXIn < GABLE_SHED_SNAP_THRESHOLD_IN || peakXIn > lengthIn - GABLE_SHED_SNAP_THRESHOLD_IN;
  if (!shedSnapped) return restingRiseIn;
  return (Math.round(lengthFt * (4 / 12) * 12) / 12) * 12;
}

/** page.tsx:7595-7640 — the tiles the 3D view is actually handed. */
function gableTilesFor(lengthIn: number, eaveHeightIn: number, riseIn: number, peakXIn: number | null, c: SweepCase) {
  const points: RoofProfilePoint[] = [
    {
      xIn: peakXIn ?? lengthIn / 2,
      heightIn: eaveHeightIn + riseIn,
      isExplicitPosition: peakXIn != null,
    },
  ];
  const raw = computeGableTiledRow(
    lengthIn,
    eaveHeightIn,
    points,
    STANDARD_WIDTH_IN,
    c.gableEndsFullHeight ? 0 : trussPlateInsetDefaultIn.value,
    true,
    c.gableEndsFullHeight ? 0 : gableHeelHeightDefaultIn.value,
    c.anchorMode,
    c.withWindow ? ONE_WINDOW : [],
    c.withRidgeColumn ? COLUMN_TOTAL_WIDTH_IN : undefined,
    0,
    lengthIn,
    c.withWallJoints ? wallJointSpansFor(lengthIn, points[0]!.xIn, c.withRidgeColumn) : [],
    0,
  );
  const capHeightIn = eaveHeightIn + GABLE_PANEL_MAX_HEIGHT_IN;
  return raw.map((t) => {
    const liftIn = !c.gableEndsFullHeight
      ? 0
      : t.widthIn > 0
        ? THICKNESS_IN * Math.hypot(1, Math.abs(t.rightHeightIn - t.leftHeightIn) / t.widthIn)
        : THICKNESS_IN;
    const capped = capGableTileHeights(
      t.leftHeightIn,
      t.rightHeightIn,
      Math.max(eaveHeightIn + 1, capHeightIn - liftIn),
    );
    const fabricatedTallerIn = Math.max(capped.leftEdgeHeightIn, capped.rightEdgeHeightIn) + liftIn - eaveHeightIn;
    const tooShortToBuild = !t.isWindow && !t.isColumn && fabricatedTallerIn < GABLE_PANEL_MIN_HEIGHT_IN;
    return {
      widthIn: t.widthIn,
      xStartIn: t.xStartIn,
      leftEdgeHeightIn: capped.leftEdgeHeightIn,
      rightEdgeHeightIn: capped.rightEdgeHeightIn,
      ...(capped.verticalGapIn ? { verticalGapIn: capped.verticalGapIn } : {}),
      ...(t.isSafetyGap || tooShortToBuild ? { isSafetyGap: true as const } : {}),
      ...(t.isWindow
        ? { isWindow: true as const, windowHeightIn: t.windowHeightIn, windowSillHeightIn: t.windowSillHeightIn }
        : {}),
      ...(t.isColumn ? { isColumn: true as const } : {}),
    };
  });
}

/** Building3DView.tsx:1790-1875 — the branch that crashed. Returns the taller
 * LOCAL height of every tile it built as a real Gable End Panel, so a caller
 * can check the fabrication window as well as the absence of a throw. */
function buildTiles(
  tiles: ReturnType<typeof gableTilesFor>,
  eaveHeightIn: number,
  c: SweepCase,
  pitchIn12: number | undefined,
): number[] {
  const builtTallerIn: number[] = [];
  for (const tile of tiles) {
    const appliedLiftIn = gableTileRoofTopLiftIn(
      tile,
      c.gableEndsFullHeight,
      THICKNESS_IN,
      pitchIn12,
      eaveHeightIn,
      GABLE_PANEL_MAX_HEIGHT_IN,
    );
    const leftLocalIn = tile.leftEdgeHeightIn + appliedLiftIn - eaveHeightIn;
    const rightLocalIn = tile.rightEdgeHeightIn + appliedLiftIn - eaveHeightIn;
    const tallerLocalIn = Math.max(leftLocalIn, rightLocalIn);
    if (tile.isColumn) {
      buildColumnStyleMembers(tile.widthIn, THICKNESS_IN, tallerLocalIn, true);
    } else if (tile.isWindow) {
      /* Building3DView.tsx:1797-1869 — jack studs and sill from the ordinary
         opening builder (its header discarded), plus a SECOND, smaller gable
         panel for the triangular cap above the window's RO. The cap is the
         part with the crash history: `gableWindowCapHeightsIn` is what stands
         between a window in a short tile and a panel of no height at all. */
      const windowHeightIn = tile.windowHeightIn ?? standardWindowHeightDefaultIn.value;
      const windowSillHeightIn = tile.windowSillHeightIn ?? sillDefaultHeightIn.value;
      const g = computeOpeningGeometry(
        false,
        tile.widthIn,
        Math.max(tallerLocalIn, windowSillHeightIn + windowHeightIn + 1),
        windowSillHeightIn,
        windowHeightIn,
        JACK_STUDS,
        STANDARD_WIDTH_IN,
      );
      buildOpeningAssemblyMembers(
        tile.widthIn,
        THICKNESS_IN,
        "window",
        JACK_STUDS,
        g.sillHeightIn,
        g.jackStudSpanIn,
        0,
        g.sillHeightIn,
        g.sillWidthsIn,
        true,
      );
      const cap = gableWindowCapHeightsIn(leftLocalIn, rightLocalIn, g.roTopZIn, GABLE_PANEL_MIN_HEIGHT_IN);
      if (cap.kind === "cap") {
        buildGablePanelMembers(tile.widthIn, THICKNESS_IN, cap.leftIn, cap.rightIn, true);
        builtTallerIn.push(Math.max(cap.leftIn, cap.rightIn));
      }
    } else if (tile.isSafetyGap) {
      buildSafetyGapMembers(THICKNESS_IN, tallerLocalIn);
    } else {
      buildGablePanelMembers(tile.widthIn, THICKNESS_IN, leftLocalIn, rightLocalIn, true);
      builtTallerIn.push(tallerLocalIn);
    }
    if (tile.verticalGapIn) {
      buildVerticalGapFillerMembers(tile.widthIn, THICKNESS_IN, tile.verticalGapIn.leftIn, tile.verticalGapIn.rightIn);
    }
  }
  return builtTallerIn;
}

describe("⚠ the ridge peak sweeps every inch of its wall without taking the page down", () => {
  for (const wall of TEMPLATE_GABLE_WALLS_IN) {
    for (const c of SWEEP_CASES) {
      const label =
        `${wall.name} — ${c.gableEndsFullHeight ? "full-height gables" : "truss-plate inset"}, ` +
        `${c.anchorMode}${c.withRidgeColumn ? ", ridge column" : ""}` +
        `${c.withWallJoints ? ", on the wall's joints" : ""}${c.withWindow ? ", gable window" : ""}`;

      it(label, () => {
        /* The eave the app would be at: a 10ft ground storey. The roof's own
           bearing height is deliberately NOT added — it varies by shape, and
           raising the eave only moves the whole roofline up together, while
           every height this chain refuses on is measured FROM the eave. */
        const eaveHeightIn = WALL_HEIGHT_IN;
        /* The resting rise outside the snap threshold: 4:12 over half the
           wall, which is what a peaked roof is given. */
        const restingRiseIn = (wall.lengthIn / 2) * (4 / 12);
        let built = 0;

        /* ⚠ Every inch, because the elevation editor's Position slider has
           `step={1}` and the handle's own step is a multiple of it. Both ends
           included: a peak AT an end is how this app stores a shed. */
        for (let peakXIn = 0; peakXIn <= wall.lengthIn; peakXIn++) {
          const riseIn = riseInForPeak(wall.lengthIn, peakXIn, restingRiseIn);
          /* The pitch prop `Building3DView` receives comes from
             `roofTrussLayoutContext`, which withholds itself on several
             shapes — so both the supplied and the absent case are swept, and
             the absent one falls back to each tile's own rake. */
          for (const pitchIn12 of [(riseIn / (wall.lengthIn / 2)) * 12, undefined]) {
            const tiles = gableTilesFor(wall.lengthIn, eaveHeightIn, riseIn, peakXIn, c);
            let tallerIn: number[] = [];
            expect(
              () => {
                tallerIn = buildTiles(tiles, eaveHeightIn, c, pitchIn12);
              },
              `peak at ${peakXIn}in of ${wall.lengthIn}in, rise ${riseIn}in, pitch ${pitchIn12 ?? "unset"}`,
            ).not.toThrow();
            for (const t of tallerIn) {
              expect(t, `peak at ${peakXIn}in: a built Gable End Panel ${t}in tall`).toBeGreaterThanOrEqual(
                GABLE_PANEL_MIN_HEIGHT_IN,
              );
              expect(t, `peak at ${peakXIn}in: a built Gable End Panel ${t}in tall`).toBeLessThanOrEqual(
                GABLE_PANEL_MAX_HEIGHT_IN,
              );
            }
            built += tallerIn.length;
          }
        }

        /* ⚠ A sweep that built nothing would pass every assertion above. */
        expect(built).toBeGreaterThan(wall.lengthIn);
      });
    }
  }

  it("⚠ the sweep really does cross the shed snap, and the snap really does move the rise", () => {
    /* The reason this is asserted rather than assumed: if the threshold or the
       4:12 formula moves, the sweep above silently stops exercising the band
       the crash lived in — and keeps passing. */
    const lengthIn = 16 * 12;
    const restingRiseIn = 32;
    expect(riseInForPeak(lengthIn, GABLE_SHED_SNAP_THRESHOLD_IN, restingRiseIn)).toBe(restingRiseIn);
    expect(riseInForPeak(lengthIn, GABLE_SHED_SNAP_THRESHOLD_IN - 1, restingRiseIn)).not.toBe(restingRiseIn);
    expect(riseInForPeak(lengthIn, 0, restingRiseIn)).toBeCloseTo(64, 6);
    expect(riseInForPeak(lengthIn, lengthIn, restingRiseIn)).toBeCloseTo(64, 6);
    expect(GABLE_SHED_SNAP_THRESHOLD_IN).toBeLessThan(lengthIn / 2);
  });
});

describe("⚠ the replication still matches the app", () => {
  /* This file copies five steps out of page.tsx and Building3DView.tsx
     because they live inside `useMemo`s and cannot be imported. These
     assertions are what fails when one of them changes contract — without
     them, the sweep above would go on passing against a pipeline the app no
     longer has. */

  it("the fabrication window is still a throw on both sides", () => {
    expect(() => buildGablePanelMembers(48, THICKNESS_IN, GABLE_PANEL_MIN_HEIGHT_IN - 0.01, 0, true)).toThrow();
    expect(() => buildGablePanelMembers(48, THICKNESS_IN, GABLE_PANEL_MAX_HEIGHT_IN + 0.01, 0, true)).toThrow();
    expect(() => buildGablePanelMembers(48, THICKNESS_IN, GABLE_PANEL_MAX_HEIGHT_IN, 0, true)).not.toThrow();
  });

  it("⚠ the lift is still clamped by the panel's own ceiling", () => {
    /* `gableTileRoofTopLiftIn`'s headroom term is the only thing standing
       between a steep little tile beside a corner-snapped peak and a panel
       taller than the builder will make. A lift that stopped clamping would
       reopen the crash through the back door, with the tile heights unchanged
       and this file's step 4 still agreeing with page.tsx. */
    const atTheCeiling = { widthIn: 48, leftEdgeHeightIn: 120 + GABLE_PANEL_MAX_HEIGHT_IN, rightEdgeHeightIn: 120 };
    expect(gableTileRoofTopLiftIn(atTheCeiling, true, THICKNESS_IN, 4, 120, GABLE_PANEL_MAX_HEIGHT_IN)).toBe(0);
    const roomToSpare = { widthIn: 48, leftEdgeHeightIn: 120 + 12, rightEdgeHeightIn: 120 };
    expect(gableTileRoofTopLiftIn(roomToSpare, true, THICKNESS_IN, 4, 120, GABLE_PANEL_MAX_HEIGHT_IN)).toBeGreaterThan(
      0,
    );
  });

  it("the tiled row still reports the fields this file reads off it", () => {
    const tiles = computeGableTiledRow(
      192,
      120,
      [{ xIn: 96, heightIn: 152 }],
      48,
      0,
      true,
      0,
      "truss-heel",
      [],
      COLUMN_TOTAL_WIDTH_IN,
      0,
      192,
      [],
      0,
    );
    expect(tiles.length).toBeGreaterThan(1);
    for (const t of tiles) {
      expect(typeof t.widthIn).toBe("number");
      expect(typeof t.xStartIn).toBe("number");
      expect(typeof t.leftHeightIn).toBe("number");
      expect(typeof t.rightHeightIn).toBe("number");
    }
    expect(tiles.some((t) => t.isColumn)).toBe(true);
  });
});
