import { GABLE_SHED_SNAP_THRESHOLD_IN, type RoofBearingAnchorMode, type RoofProfilePoint } from "@building-integrity/geometry";
import { roofTopAboveRooflineIn } from "@building-integrity/panel-catalog";

export { GABLE_SHED_SNAP_THRESHOLD_IN };

/** Default along-wall position for a profile point that hasn't been
 * explicitly customized — the single midpoint for a peaked (1-point)
 * profile, or a symmetric flat run spanning the middle third for a
 * flat-top (2-point) profile. */
function defaultPointXIn(pointIndex: number, pointCount: number, wallWidthIn: number): number {
  return pointCount === 1 ? wallWidthIn / 2 : ((pointIndex + 1) * wallWidthIn) / 3;
}

/**
 * ⚠ **THE ONE CONSTRUCTION OF A GABLE WALL'S ROOF-PROFILE POINTS**, shared so
 * that nothing can tile a different roof than the app draws.
 *
 * It existed twice. `page.tsx`'s `gableProfilePointsFor` built the real one;
 * `seedGableWindowsForFootprint` built its own, and **the two disagreed about
 * whether the roof was a shed** — the seeder omitted `isExplicitPosition`, so
 * a point stored at x = 0 (which is exactly how this app stores a shed, see
 * `applyRoofDefaultsForFootprint`) was not recognised as one. `resolveAnchors`
 * then kept it as an INTERNAL anchor at x = 0 alongside the left corner
 * anchor at eave height, and the seeder's row grew a **spurious 1in tile
 * rising 0 -> 64in** that the app's row does not have.
 *
 * ⚠ **The consequence was a real defect, measured 2026-11-15 on the Tiny
 * House** — the first tile on the Home page. `beforeTileCount` is an ordinal
 * into the row's real tiles, so one extra tile at the start shifted every
 * ordinal by one:
 *
 * | ordinal | the seeder's row | the app's row |
 * |---------|------------------|---------------|
 * | 0       | 64.00in (w 1.0)  | 64.00in       |
 * | 1       | 64.00in (w 14.5) | 58.83in       |
 * | 2       | **59.14in**      | **42.83in**   |
 *
 * `seedGableWindows` approved ordinal 2 because 59.14in clears the 49.5in a
 * 48in window plus a panel above it needs. The app then put that window on a
 * 42.83in tile — **5.17in of window standing through its own roofline, with
 * no panel over it.** Every gate passed: the seeder's height guard had run
 * and said yes, about a tile that was not the one used.
 *
 * It reached **every shed template** (the Tiny House and both Octagons) and
 * only a shed, because a peaked roof stores no position and both callers
 * therefore passed `undefined` and agreed by accident. And it reads as an
 * intermittent glitch rather than a bug because which ordinal is chosen is
 * random, so the breach appears on some draws and not others.
 *
 * @param storedPositionsIn this wall's stored point positions; a gap means
 * "auto-centred", which is **not** the same as a stored value that happens to
 * equal the centre — only a stored one may snap to a shed.
 */
export function gableProfilePointsForWall(
  wallLengthIn: number,
  roofProfilePointHeightsFt: readonly number[],
  /* ⚠ `null` as well as a hole: `page.tsx` stores these as
     `(number | null)[]`, and `!= null` below is what makes the two the same
     thing — an auto-centred point. */
  storedPositionsIn: readonly (number | null | undefined)[],
  gableEaveHeightIn: number,
): RoofProfilePoint[] {
  return roofProfilePointHeightsFt.map((heightFt, i) => {
    const storedXIn = storedPositionsIn[i];
    return {
      xIn: storedXIn ?? defaultPointXIn(i, roofProfilePointHeightsFt.length, wallLengthIn),
      heightIn: gableEaveHeightIn + heightFt * 12,
      isExplicitPosition: storedXIn != null,
    };
  });
}

export interface ResolvedGableProfilePoints {
  pointCount: number;
  resolvedPointXsIn: number[];
  pointIsExplicit: boolean[];
  pointIsSnapped: boolean[];
  isShedRoof: boolean;
}

/**
 * Resolves each roof profile point's own along-wall position, whether it's
 * explicitly stored or defaulted, and whether it's snapped to a single-slope
 * shed — the one piece of gable-profile math both the Elevation diagram
 * (drag handle placement) and the Elevation sidebar controls (slider/input
 * values, "snapped to shed" text) need identically, so it's a single shared
 * function rather than two independently-maintained copies that could drift.
 * Mirrors page.tsx's own gableTilesByWallId resolution exactly.
 */
export function resolveGableProfilePoints(
  roofProfilePointHeightsFt: number[],
  gableProfilePositionsIn: (number | null)[],
  wallWidthIn: number,
): ResolvedGableProfilePoints {
  const pointCount = roofProfilePointHeightsFt.length;
  const resolvedPointXsIn = roofProfilePointHeightsFt.map((_, i) => {
    const stored = gableProfilePositionsIn[i];
    return Math.min(Math.max(stored ?? defaultPointXIn(i, pointCount, wallWidthIn), 0), wallWidthIn);
  });
  // Snap decision is always against the raw wall ends, never inset-adjusted
  // — whether a point snaps to a shed doesn't depend on insetIn (see
  // computeGableTiledRow's own doc comment). Only an explicitly-positioned
  // point (a real stored value, not the auto-default) can snap.
  const pointIsExplicit = roofProfilePointHeightsFt.map((_, i) => gableProfilePositionsIn[i] != null);
  const pointIsSnapped = resolvedPointXsIn.map(
    (xIn, i) => pointIsExplicit[i] && (xIn < GABLE_SHED_SNAP_THRESHOLD_IN || xIn > wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN),
  );
  const isShedRoof = pointIsSnapped.some(Boolean);
  return { pointCount, resolvedPointXsIn, pointIsExplicit, pointIsSnapped, isShedRoof };
}

/** Selectable standard roof pitches (rise:12 run) for the Elevation
 * sidebar's Shed/Centered Peak dropdowns. */
export const ROOF_PITCH_OPTIONS_IN12 = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Rise (ft, rounded to the nearest inch) for a given pitch over a given
 * run — shared by the Shed dropdown (run = the wall's own full width) and
 * the Centered Peak dropdown (run = half the wall's width, since a
 * centered peak splits the rise symmetrically). `heelOffsetIn` (default 0)
 * adds a flat energy-heel amount on top of the sloped portion's own rise —
 * see `resolveHeelSeat`, which callers use to derive both this and the
 * run they pass in. */
export function computeRiseFtForPitch(pitchIn12: number, runIn: number, heelOffsetIn = 0): number {
  return (Math.round(runIn * (pitchIn12 / 12)) + heelOffsetIn) / 12;
}

/**
 * How much an energy-heel truss seat (`heelHeightIn`) shortens a side's own
 * real sloped run, and raises its own starting height, when picking a pitch
 * from the Shed/Centered Peak dropdowns — mirrors gableTiledRow.ts's own
 * `resolveAnchors` "does the seat fit" check exactly (`heelFits`), so a
 * dropdown-picked pitch always matches what the real tiled roofline (and
 * the per-side slope labels reading off it) will actually show, instead of
 * the naive corner-to-peak figure. `cornerCount` is 1 for a Shed pitch (only
 * the far, non-snapped corner is heel-eligible — the snapped/near corner is
 * claimed by the point itself) or 2 for a Centered Peak pitch (a re-centered
 * peak's own position is never "explicit", so neither corner ever
 * shed-claims — see resolveAnchors). Returns zero offsets if heel is
 * disabled, or the wall is too narrow to fit the seat(s) needed.
 *
 * Under `anchorMode: "panel-depth"`, the same shape of check runs against
 * `insetIn` instead — the run shortens by the truss's own seat depth rather
 * than a full panel width, and `heelOffsetIn` always stays 0 (no riser),
 * mirroring `resolveAnchors`'s own panel-depth branch exactly. */
export function resolveHeelSeat(
  wallWidthIn: number,
  standardWidthIn: number,
  heelHeightIn: number,
  cornerCount: 1 | 2,
  anchorMode: RoofBearingAnchorMode = "truss-heel",
  insetIn = 0,
): { runOffsetIn: number; heelOffsetIn: number } {
  if (anchorMode === "panel-depth") {
    const seatWidthNeededIn = cornerCount * insetIn;
    const insetFits = insetIn > 0 && seatWidthNeededIn > 0 && seatWidthNeededIn <= wallWidthIn;
    return insetFits ? { runOffsetIn: insetIn, heelOffsetIn: 0 } : { runOffsetIn: 0, heelOffsetIn: 0 };
  }
  const seatWidthNeededIn = cornerCount * standardWidthIn;
  const heelFits = heelHeightIn > 0 && seatWidthNeededIn > 0 && seatWidthNeededIn <= wallWidthIn;
  return heelFits ? { runOffsetIn: standardWidthIn, heelOffsetIn: heelHeightIn } : { runOffsetIn: 0, heelOffsetIn: 0 };
}

/** Reverse lookup: does a real rise/run ratio land on one of the
 * dropdown's own selectable pitches (within half an inch of rise, to
 * absorb the rounding computeRiseFtForPitch already applies)? Used by the
 * Elevation diagram's per-side slope labels to show "4/12" instead of a
 * raw degree figure once a dragged peak's own actual slope happens to
 * match a standard pitch again. */
export function matchStandardPitchIn12(riseIn: number, runIn: number): number | null {
  if (runIn <= 0) return null;
  const pitchIn12 = (riseIn * 12) / runIn;
  const rounded = Math.round(pitchIn12);
  if (rounded < ROOF_PITCH_OPTIONS_IN12[0]! || rounded > ROOF_PITCH_OPTIONS_IN12.at(-1)!) return null;
  return Math.abs(riseIn - (rounded / 12) * runIn) < 0.5 ? rounded : null;
}

export interface CappedGableTileHeights {
  leftEdgeHeightIn: number;
  rightEdgeHeightIn: number;
  /** Present only when this tile got flattened by the cap — either field
   * can be exactly 0 (see capGableTileHeights's own doc comment). */
  verticalGapIn?: { leftIn: number; rightIn: number };
}

/** Caps one Gable End Panel tile's own edges to `capHeightIn` (Tommy:
 * "gable panels...can be up to 8' tall") so every real panel is either
 * fully parallel to the true roofline (untouched) or fully flat/horizontal
 * — never a mixed quadrilateral with one edge capped and the other still
 * sloped, which independently capping each edge (`Math.min` per side) used
 * to produce whenever a tile's true roofline crossed the cap partway across
 * its own width.
 *
 * If the tile's taller true edge already fits under the cap, both edges
 * keep their true (possibly different) heights — a clean parallelogram
 * matching the real roofline exactly, no filler needed.
 *
 * Otherwise the WHOLE tile flattens to `min(leftHeightIn, rightHeightIn,
 * capHeightIn)` — the largest flat height that never exceeds either the
 * true roofline on the shorter edge (flattening any higher would make the
 * panel stick up past the real roof there) or the fabrication cap itself.
 * The real remainder above that flat top is reported per edge
 * (`verticalGapIn`) so a filler can be built flush with the flat panel top,
 * reaching exactly to the true roofline on each side independently — a
 * tile straddling the cap (one true edge under it, one over) flattens to
 * its own shorter edge, so that side's own gap is exactly 0 and the other
 * side's gap is the full difference: a clean triangular taper, not a
 * uniform-height box. Shared by page.tsx's `gableTilesByWallId` and
 * WallElevationDiagram's own preview so the 2 can never disagree. */
export function capGableTileHeights(leftHeightIn: number, rightHeightIn: number, capHeightIn: number): CappedGableTileHeights {
  const tallerIn = Math.max(leftHeightIn, rightHeightIn);
  if (tallerIn <= capHeightIn) return { leftEdgeHeightIn: leftHeightIn, rightEdgeHeightIn: rightHeightIn };
  const flatHeightIn = Math.min(leftHeightIn, rightHeightIn, capHeightIn);
  return {
    leftEdgeHeightIn: flatHeightIn,
    rightEdgeHeightIn: flatHeightIn,
    verticalGapIn: { leftIn: leftHeightIn - flatHeightIn, rightIn: rightHeightIn - flatHeightIn },
  };
}

/**
 * How much taller a Gable End Panel tile is built when the gable closes to
 * the **TOP** of the roof panels instead of stopping under them.
 *
 * ⚠ **THE PANEL AS FABRICATED IS NOT THE ROOFLINE.** A tile's two edge
 * heights are the roof's UNDERSIDE, and they have to stay that way — half a
 * dozen derivations read them so, and folding the lift into them once made a
 * 4:12 roof report itself as 2.5:12. The lift travels beside them, and this
 * is the one function that says how far it goes, so the 3D view and the cut
 * list cannot disagree about it. They did: the view lifted the gable and the
 * shop drawings did not, which is both a part cut short and — at a shed's low
 * corner, where the roofline runs to nothing — a panel asked to be shorter
 * than its own two skins.
 *
 * It is the roof's PLUMB thickness, `depth / cos(slope)` — 16 3/8in through a
 * 15 1/2in panel at 4:12, not 15 1/2in. A roof panel leans and a gable is
 * measured vertically.
 *
 * ⚠ Clamped to the fabrication maximum `buildGablePanelMembers` enforces by
 * THROWING, because a throw inside the 3D view's memo takes the whole
 * viewport rather than one panel.
 *
 * ⚠ Falls back to the tile's OWN RAKE when no resolved pitch arrives. A
 * missing pitch used to make the lift silently zero, which read on screen as
 * *"still not tall enough"*; the rake a gable tile is already cut to IS the
 * roof's pitch there, so it is the right answer rather than a guess.
 */
export function gableTileRoofTopLiftIn(
  tile: { widthIn: number; leftEdgeHeightIn: number; rightEdgeHeightIn: number },
  gableEndsFullHeight: boolean,
  roofPanelDepthIn: number,
  roofPitchIn12: number | undefined,
  gableEaveHeightIn: number,
  maxPanelHeightIn: number,
): number {
  if (!gableEndsFullHeight) return 0;
  const tileRakeIn12 =
    tile.widthIn > 0 ? (Math.abs(tile.rightEdgeHeightIn - tile.leftEdgeHeightIn) / tile.widthIn) * 12 : 0;
  const liftIn = roofTopAboveRooflineIn(roofPanelDepthIn, roofPitchIn12 ?? tileRakeIn12);
  const headroomIn = maxPanelHeightIn - Math.max(tile.leftEdgeHeightIn, tile.rightEdgeHeightIn) + gableEaveHeightIn;
  return Math.max(0, Math.min(liftIn, headroomIn));
}

/**
 * The gable cap above a gable WINDOW — or the statement that there is none.
 *
 * ⚠ **THE "none" CASE IS THE WHOLE POINT: this path took the page down.** The
 * 3D view built the cap as
 * `buildGablePanelMembers(w, d, max(0, leftLocalIn - roTopZIn), max(0, rightLocalIn - roTopZIn), …)`,
 * and `roTopZIn` is the window's sill plus its own height — a figure with no
 * relation to how tall the tile is. Put a window in a SHORT gable tile and
 * both of those clamp to 0, so the builder is handed a panel of no height at
 * all and answers the only way it can:
 *
 * > *"Neither edge of this Gable End Panel (0 and 0 across 24in) reaches the
 * > 1.5in it needs for its own two skins"*
 *
 * — a `throw`, raised inside the 3D view's render, which does not fail one
 * panel. It fails the viewport. This is the same shape of fault as the
 * 2026-10-31 crash recorded on `buildGablePanelMembers` itself (*"This page
 * couldn't load whenever I lift my fingers off of the shape draw on
 * mobile"*), and it survived that fix because it lives at the CALL SITE: one
 * `Math.max(0, …)` making an impossible number look like a legal one.
 *
 * ⚠ **Two different situations arrive here as the same clamp to zero, and the
 * caller is told which.** A window whose head lands ON its own roofline
 * genuinely has no gable material above it — a real answer, not a swallowed
 * error. A window standing THROUGH the roof plane is a part that does not
 * fit, and `exceedsRooflineIn` is how far. The first version of this returned
 * plain `null` and carried that figure on the success value, where it could
 * never be read — a breach always produces no cap. So the refusal carries
 * it.
 *
 * ⚠ No caller reports the breach into the Review Log yet. Flagged rather
 * than guessed at.
 */
/**
 * ⚠ **HOW TALL THE PANEL ABOVE A GABLE WINDOW MUST BE — Tommy, 2026-11-19.**
 *
 * > *"gable windows on a shed rectangle (tiny house) seem to be like drawn
 * > right, but theres an obvious gap. the tilted part should be flush with the
 * > top of the roof line like all the other gable panels and the window RO
 * > space should be under it with no sill."*
 *
 * **The dependency used to run the wrong way.** The rough opening was fixed at
 * the standard 48in window height and the gable panel above it took whatever
 * was left — so on a shed Tiny House, whose whole gable row rises only 66in,
 * the panel came out **12.9in at its tall edge and 3.2in at its short one**.
 * Flush with the roofline, technically; not a panel. Lower down the slope a
 * tile under 48in got **no panel at all** and the opening stood through the
 * roof plane.
 *
 * ⚠ **THE OLD GUARD WAS THE REAL CULPRIT, AND IT WAS 1.5in.** A tile could
 * hold a window once it cleared `windowHeight + GABLE_PANEL_MIN_HEIGHT_IN`,
 * and that constant is `2 * SKIN_THICKNESS_IN` — **two sheets of plywood with
 * nothing between them.** It is the right floor for "can `buildGablePanelMembers`
 * physically return members", which is what it was written for, and the wrong
 * one entirely for "is this a panel the shop would build".
 *
 * **So it is inverted now: the panel comes first.** Its SHORT edge gets
 * `GABLE_WINDOW_MIN_CAP_HEIGHT_IN`, and the rough opening is what is left
 * underneath — which is his sentence, in the order he said it.
 */
export const GABLE_WINDOW_MIN_CAP_HEIGHT_IN = 16;

/**
 * ⚠ **THE SMALLEST ROUGH OPENING WORTH SEEDING — AN APP ASSUMPTION, NOT HIS.**
 *
 * Asked what gives on a tile too short for a 48in window plus the panel, he
 * chose *"shrink the window — every tile that **qualifies** gets a window, but
 * they vary in height along the slope"*, over refusing outright and over
 * shrinking to a named floor. So a window shrinks; but "qualifies" still needs
 * a line, or a 20in tile would be seeded a 4in window.
 *
 * **24in is this building system's own module** — the floor and roof panel
 * width, the narrow window width, the number everything else here is built on
 * — so it is the least invented figure available. A window may still be
 * hand-placed below it; this governs only what the seeder spawns.
 */
export const GABLE_WINDOW_MIN_RO_HEIGHT_IN = 24;

/** What a tile must RISE AT ITS SHORT EDGE before the seeder may put a window
 *  in it. ⚠ The short edge, not the tall one — see `gableWindowFit`. */
export const GABLE_WINDOW_MIN_TILE_RISE_IN =
  GABLE_WINDOW_MIN_RO_HEIGHT_IN + GABLE_WINDOW_MIN_CAP_HEIGHT_IN;

export interface GableWindowFit {
  /** False when the tile cannot carry a panel and any opening at all. */
  fits: boolean;
  /** The rough opening's top above the row's own base — equivalently, how far
   *  the gable panel's bottom plate is raised onto its jack studs. */
  roTopZIn: number;
  /** The cap's own two edge heights, measured UP FROM `roTopZIn`. */
  capLeftIn: number;
  capRightIn: number;
  /** True when the requested opening had to be reduced to keep the panel. */
  shrunk: boolean;
  requestedRoHeightIn: number;
  why: string;
}

/**
 * **The one place that decides where a gable window's head goes.**
 *
 * ⚠ **IT MEASURES THE SHORT EDGE, AND THAT IS THE WHOLE CORRECTION.** A gable
 * tile is a trapezoid: its two roofline edges differ by the pitch across its
 * own width. Sizing the opening off the TALL edge — which both the seeder and
 * every consumer did — leaves the short edge short by exactly that difference,
 * which on a 4:12 shed is a third of the tile's width. That is where the 3.2in
 * sliver came from, and it is why a tile can pass a height guard and still
 * produce a part nobody can build.
 *
 * ⚠ **IT REPLACES THREE COPIES OF THIS ARITHMETIC** — the 3D view, the
 * elevation drawing and `panelInstances` each had their own, which is already
 * on record as how the elevation came to draw a sill the fabrication data no
 * longer had. A rule that lives in three places is a rule that will differ in
 * three places.
 */
export function gableWindowFit(
  leftLocalIn: number,
  rightLocalIn: number,
  requestedRoHeightIn: number,
  minCapHeightIn: number = GABLE_WINDOW_MIN_CAP_HEIGHT_IN,
): GableWindowFit {
  const shortIn = Math.min(leftLocalIn, rightLocalIn);
  const headroomIn = shortIn - minCapHeightIn;
  if (!(headroomIn > 0)) {
    return {
      fits: false,
      roTopZIn: 0,
      capLeftIn: leftLocalIn,
      capRightIn: rightLocalIn,
      shrunk: false,
      requestedRoHeightIn,
      why: `This tile rises ${shortIn.toFixed(1)}in at its short edge, which leaves nothing under a ${minCapHeightIn}in gable panel. No window fits here.`,
    };
  }
  const roTopZIn = Math.min(requestedRoHeightIn, headroomIn);
  return {
    fits: true,
    roTopZIn,
    capLeftIn: leftLocalIn - roTopZIn,
    capRightIn: rightLocalIn - roTopZIn,
    shrunk: roTopZIn < requestedRoHeightIn - 1e-9,
    requestedRoHeightIn,
    why:
      roTopZIn < requestedRoHeightIn - 1e-9
        ? `Rough opening shortened from ${requestedRoHeightIn.toFixed(1)}in to ${roTopZIn.toFixed(1)}in so the gable panel above it keeps ${minCapHeightIn}in at its short edge. The panel stays flush with the roofline; the opening is what is left under it.`
        : `Rough opening at its full ${requestedRoHeightIn.toFixed(1)}in; the gable panel above keeps ${(shortIn - roTopZIn).toFixed(1)}in at its short edge.`,
  };
}

export type GableWindowCap =
  | { kind: "cap"; leftIn: number; rightIn: number }
  | {
      kind: "none";
      /** How far the window's head stands above the tile's own roofline. 0
       * means it lands on it, which is the legitimate case; anything above 0
       * is a window that does not fit, waiting to be reported. */
      exceedsRooflineIn: number;
    };

export function gableWindowCapHeightsIn(
  leftLocalIn: number,
  rightLocalIn: number,
  roTopZIn: number,
  minPanelHeightIn: number,
): GableWindowCap {
  const leftIn = Math.max(0, leftLocalIn - roTopZIn);
  const rightIn = Math.max(0, rightLocalIn - roTopZIn);
  if (Math.max(leftIn, rightIn) < minPanelHeightIn) {
    return { kind: "none", exceedsRooflineIn: Math.max(0, roTopZIn - Math.max(leftLocalIn, rightLocalIn)) };
  }
  return { kind: "cap", leftIn, rightIn };
}

/**
 * ⚠ **A GABLE INSTANCE'S HEIGHTS ABOVE ITS OWN BASE — the one place that
 * knows a window cap measures from a different zero.**
 *
 * `PanelInstance.leftEdgeHeightIn`/`rightEdgeHeightIn` are ABSOLUTE for an
 * ordinary gable tile (heights above the floor, so a consumer subtracts the
 * eave) and **already LOCAL** for a gable window's cap, which `panelInstances`
 * stores as `max(0, tile.leftEdgeHeightIn - roTopIn)` because the cap is
 * anchored at the window's own rough-opening top rather than at the eave.
 *
 * Every consumer in `page.tsx` subtracted the eave height unconditionally, so
 * the moment a gable row carried a window the cap came out
 * `0 - gableEaveHeightIn` — about **-122in on a 10ft wall** — and
 * `buildGablePanelMembers` threw inside a `useMemo`, taking the page down.
 * Found 2026-11-14 the moment windows started being auto-spawned; before that
 * it needed a hand-toggled gable window to reach.
 *
 * Related to `gableWindowCapHeightsIn`, which guards the OTHER end of the same
 * story (how tall the cap should be at all). This one answers "what do these
 * two numbers mean", which is a question every consumer was getting wrong.
 */
export function gableLocalEdgeHeightIn(
  edgeHeightIn: number | undefined,
  /* A gable instance whose source slot is a window IS the cap above that
     window — the same discriminator the jack-stud derivation already uses. */
  sourceSlotType: string | undefined,
  gableEaveHeightIn: number,
): number {
  const baseIn = sourceSlotType === "window" ? 0 : gableEaveHeightIn;
  return Math.max(0, (edgeHeightIn ?? baseIn) - baseIn);
}

/** The taller of the two, which is the panel's own height. */
export function gableLocalTallerHeightIn(
  leftEdgeHeightIn: number | undefined,
  rightEdgeHeightIn: number | undefined,
  sourceSlotType: string | undefined,
  gableEaveHeightIn: number,
): number {
  return Math.max(
    gableLocalEdgeHeightIn(leftEdgeHeightIn, sourceSlotType, gableEaveHeightIn),
    gableLocalEdgeHeightIn(rightEdgeHeightIn, sourceSlotType, gableEaveHeightIn),
  );
}
