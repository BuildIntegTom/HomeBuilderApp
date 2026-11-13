import { GABLE_SHED_SNAP_THRESHOLD_IN, type RoofBearingAnchorMode } from "@building-integrity/geometry";
import { roofTopAboveRooflineIn } from "@building-integrity/panel-catalog";

export { GABLE_SHED_SNAP_THRESHOLD_IN };

/** Default along-wall position for a profile point that hasn't been
 * explicitly customized — the single midpoint for a peaked (1-point)
 * profile, or a symmetric flat run spanning the middle third for a
 * flat-top (2-point) profile. */
function defaultPointXIn(pointIndex: number, pointCount: number, wallWidthIn: number): number {
  return pointCount === 1 ? wallWidthIn / 2 : ((pointIndex + 1) * wallWidthIn) / 3;
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
