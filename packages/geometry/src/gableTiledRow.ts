import { distributeEighths, fromEighths, toEighths } from "./eighths";

export interface GableTiledPanel {
  xStartIn: number;
  xEndIn: number;
  widthIn: number;
  /** Roofline height at this panel's left (near/x=xStartIn) edge. */
  leftHeightIn: number;
  /** Roofline height at this panel's right (far/x=xEndIn) edge. */
  rightHeightIn: number;
  /** True for the one dedicated safety-gap tile a run's own leftover width
   * got absorbed into (see GABLE_SAFETY_GAP_WIDTH_IN) — never a real,
   * fabricated Gable End Panel. */
  isSafetyGap?: boolean;
  /** True for a tile reserved by a `GableWindowReservation` (Tommy: "add an
   * option to click-edit gable end panels to become window gable end
   * panels") — this tile's own `leftHeightIn`/`rightHeightIn` are still the
   * tile's full true roofline edges (its own local floor is flat at the
   * eave, same as any other tile); a caller splits it into a lower window
   * assembly (jack studs + sill, up to `windowHeightIn` above
   * `windowSillHeightIn`) and an upper gable cap (a second, smaller
   * buildGablePanelMembers call, anchored at the window's own RO-top
   * instead of the eave). Never set alongside `isSafetyGap`. */
  isWindow?: boolean;
  /** Only set when `isWindow` — this window's own Rough Opening height
   * (sill-top to the underside of the gable cap above it). */
  windowHeightIn?: number;
  /** Only set when `isWindow` — this window's own sill height (floor/eave
   * to Rough Opening bottom). */
  windowSillHeightIn?: number;
  /** True for the auto-centered structural Column Panel reserved under a
   * single-peak roofline's own ridge (Tommy: "the panelizer will spawn a
   * column panel centered under the peak... a flat top that is 12in down
   * from the peak" — spawned when a gable wall is in "panels/beam" mode,
   * see `computeGableTiledRow`'s own `columnReservationWidthIn` param).
   * Unlike a window, this tile is NEVER sloped — `leftHeightIn` and
   * `rightHeightIn` are always equal (the flat top), and it's always
   * centered on the peak rather than anchored to a user-clicked ordinal. */
  isColumn?: boolean;
}

/** A gable tile reserved for a window (Tommy: "add an option to click-edit
 * gable end panels to become window gable end panels, similarly splitting
 * into two distinct panels") — anchored the same way `OpeningAnchor` in
 * tiling.ts anchors a wall-slot opening: "how many non-safety-gap gable
 * tiles precede this reservation," counted globally left-to-right across
 * the WHOLE wall (every segment), not per-segment. `heightIn`/
 * `sillHeightIn` ride along so the tiler can stamp them onto the resulting
 * tile (see `GableTiledPanel.windowHeightIn`/`windowSillHeightIn`) — the
 * tiler itself never reads them, purely a pass-through so a caller doesn't
 * need a separate post-hoc ordinal re-match to reattach them. */
export interface GableWindowReservation {
  beforeTileCount: number;
  widthIn: number;
  heightIn?: number;
  sillHeightIn?: number;
}

/** Tommy: "if the peak of gable end panels is less than 2', then snap the
 * line to the edge and only have one slope of gable end panels — like for a
 * shed roof style." Within this distance of either wall end, a profile
 * point snaps fully onto that end, degenerating that side into a
 * single-slope shed. */
export const GABLE_SHED_SNAP_THRESHOLD_IN = 24;

/** Fixed width of the dedicated safety-gap tile a tiled run's own leftover
 * width gets absorbed into (mirrors packages/geometry/src/tiling.ts's own
 * SAFETY_GAP_WIDTH_IN — duplicated rather than imported, since this package
 * has no dependency on panel-catalog and that file can't be shared either). */
export const GABLE_SAFETY_GAP_WIDTH_IN = 0.75;

/** A run shorter than this never bothers with a dedicated safety-gap tile —
 * mirrors tiling.ts's own SAFETY_PANEL_MIN_WALL_LENGTH_IN (12ft), applied
 * per-segment here rather than per-wall, consistent with every other part
 * of this tiler already treating each rise/flat/fall segment independently. */
export const GABLE_SAFETY_GAP_MIN_RUN_LENGTH_IN = 144;

/** How far below the true peak height the structural Column Panel's own
 * flat top sits (Tommy: "it has a flat top that is 12in down from the
 * peak") — see `computeGableTiledRow`'s own `columnReservationWidthIn`. */
export const GABLE_COLUMN_FLAT_TOP_DROP_IN = 12;

/** A real, user-placed profile point — the roofline's own "top" (a single
 * peak, or one of a flat-topped run's 2 shoulders) — fully independent in
 * both height and along-wall position. */
export interface RoofProfilePoint {
  xIn: number;
  heightIn: number;
  /** False (or omitted) means `xIn` is an unset/default position (e.g. an
   * auto-centered point) — such a point never shed-snaps, matching the
   * pre-existing single-peak behavior where only an explicitly dragged
   * peak could snap to a shed. Callers resolve their own "unset" sentinel
   * (e.g. `undefined` in a per-wall stored position) into a real default
   * `xIn` before calling this — this flag is the only thing that survives
   * that resolution to preserve the snap-eligibility distinction. */
  isExplicitPosition?: boolean;
}

interface RoofAnchor {
  xIn: number;
  heightIn: number;
}

/** Where an unclaimed (non-shed-snapped) end's roofline slope actually
 * starts lifting off (Tommy: "the slope needs to be based on exactly where
 * we expect the truss to lift off at - either at the panel depth OR... the
 * truss heel height... flush with the top of the trusses or flush with the
 * inside edge of them"). `"truss-heel"` is today's pre-existing behavior —
 * a flat run for one full `targetPanelWidthIn` panel, then the slope starts
 * `heelHeightIn` above the eave (an energy-heel truss seat). `"panel-depth"`
 * is new — the slope starts flush at the eave height itself, but inset by
 * `insetIn` (the same truss-bottom/panel-material inset `trussPlateInsetIn`
 * already trims panel material by) instead of a full panel width, and with
 * no height bump — modeling a truss that lifts off right at its own seat
 * depth rather than riding a raised heel. */
export type RoofBearingAnchorMode = "panel-depth" | "truss-heel";

// A degenerate-input safety floor only (e.g. 2 profile points dragged to
// the same spot) — not a meaningful design constraint, real usage should
// never approach it.
const MIN_ANCHOR_GAP_IN = 1;

/**
 * Resolves a wall's own eave height + however many real profile points
 * (0, 1, or 2 today) into a sorted list of (xIn, heightIn) anchors running
 * corner to corner — eave, then every non-snapped point in between, then
 * eave again. A point within GABLE_SHED_SNAP_THRESHOLD_IN of its own
 * nearest end (and explicitly positioned) snaps fully onto that end,
 * REPLACING that end's own eave-height anchor with the point's own height
 * (not zeroing it) — e.g. a single snapped peak turns the whole wall into
 * one shed slope from the snapped end's new (ridge) height down to the
 * opposite end's own eave height, exactly matching the pre-existing
 * single-peak snap behavior. If 2 points would both snap onto the SAME end,
 * only the first (in input order) actually claims it — the second is
 * clamped back to just outside the snap threshold instead, so both points
 * stay distinct rather than silently colliding.
 *
 * If `heelHeightIn > 0`, each unclaimed (non-snapped) end's own corner
 * anchor is then shifted inward by `targetPanelWidthIn` and up by
 * `heelHeightIn` — modeling an energy-heel truss seat (the flat run below
 * that point is the wall's own already-flat top, not a fabricated cap tile,
 * so no anchor is added there, just the corner anchor's own position moved)
 * — unless doing so on both unclaimed ends would make them cross (a wall
 * too narrow for the seat(s) it would need), in which case the heel is
 * skipped entirely and the corner(s) stay at the plain eave height. Any real
 * point that would then fall inside an active seat zone is clamped out to
 * that zone's own boundary, same "clamp instead of collide" treatment as
 * the already-claimed-end case above.
 */
interface ResolvedAnchors {
  anchors: RoofAnchor[];
  leftSnapped: boolean;
  rightSnapped: boolean;
}

function resolveAnchors(
  wallWidthIn: number,
  eaveHeightIn: number,
  points: RoofProfilePoint[],
  targetPanelWidthIn: number,
  heelHeightIn: number,
  anchorMode: RoofBearingAnchorMode,
  insetIn: number,
): ResolvedAnchors {
  let leftAnchor: RoofAnchor = { xIn: 0, heightIn: eaveHeightIn };
  let rightAnchor: RoofAnchor = { xIn: wallWidthIn, heightIn: eaveHeightIn };
  let leftClaimed = false;
  let rightClaimed = false;
  const internal: RoofAnchor[] = [];

  for (const p of points) {
    let xIn = Math.min(Math.max(p.xIn, 0), wallWidthIn);
    if (p.isExplicitPosition) {
      if (!leftClaimed && xIn < GABLE_SHED_SNAP_THRESHOLD_IN) {
        leftAnchor = { xIn: 0, heightIn: p.heightIn };
        leftClaimed = true;
        continue;
      }
      if (!rightClaimed && xIn > wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN) {
        rightAnchor = { xIn: wallWidthIn, heightIn: p.heightIn };
        rightClaimed = true;
        continue;
      }
      // Already-claimed end this point would otherwise have snapped to —
      // clamp just outside the threshold instead of colliding with it.
      if (xIn < GABLE_SHED_SNAP_THRESHOLD_IN) xIn = GABLE_SHED_SNAP_THRESHOLD_IN;
      else if (xIn > wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN) xIn = wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN;
    }
    internal.push({ xIn, heightIn: p.heightIn });
  }

  // Energy-heel truss seat (Tommy: "have the truss seat be the full panel
  // width AND THEN go vertical for 6in") — on each unclaimed (non-shed)
  // end, the wall's own already-flat top up to eaveHeightIn already IS the
  // seat, so no cap tile is built over that stretch at all; the cap row's
  // own corner anchor just shifts inward by one target panel width and up
  // by heelHeightIn, so the first real cap tile starts flush there. Skipped
  // if it wouldn't fit (a wall narrower than the seat(s) it would need) —
  // falls back to today's flat-corner behavior rather than producing a
  // squeezed/negative-width seat.
  if (anchorMode === "truss-heel") {
    if (heelHeightIn > 0) {
      const leftEligible = !leftClaimed;
      const rightEligible = !rightClaimed;
      const seatWidthNeededIn = (leftEligible ? targetPanelWidthIn : 0) + (rightEligible ? targetPanelWidthIn : 0);
      const heelFits = seatWidthNeededIn > 0 && seatWidthNeededIn <= wallWidthIn;
      if (heelFits) {
        if (leftEligible) leftAnchor = { xIn: targetPanelWidthIn, heightIn: eaveHeightIn + heelHeightIn };
        if (rightEligible) rightAnchor = { xIn: wallWidthIn - targetPanelWidthIn, heightIn: eaveHeightIn + heelHeightIn };
        // A real point that would otherwise fall inside a now-active seat
        // zone (e.g. dragged past the shed-snap threshold but still inside
        // the seat) gets pushed out to that zone's own boundary — same
        // "clamp instead of collide" treatment as the already-claimed-end
        // case above.
        for (const pt of internal) {
          if (leftEligible && pt.xIn < leftAnchor.xIn) pt.xIn = leftAnchor.xIn;
          if (rightEligible && pt.xIn > rightAnchor.xIn) pt.xIn = rightAnchor.xIn;
        }
      }
    }
  } else {
    // "panel-depth": same "does the seat fit" shape as truss-heel above,
    // but the seat is `insetIn` wide (the truss bottom's own real seat
    // depth, mirrors trussPlateInsetIn) instead of a full target panel
    // width, and the anchor stays at the plain eave height — no riser,
    // since the truss lifts off flush with its own seat rather than above
    // a raised heel. Killed globally (same as the material inset's own
    // shed-kill rule in computeGableTiledRow) once either end has snapped
    // to a shed, not just locally on the snapped side.
    const anchorInsetIn = leftClaimed || rightClaimed ? 0 : insetIn;
    const leftEligible = !leftClaimed;
    const rightEligible = !rightClaimed;
    const seatWidthNeededIn = (leftEligible ? anchorInsetIn : 0) + (rightEligible ? anchorInsetIn : 0);
    const insetFits = anchorInsetIn > 0 && seatWidthNeededIn <= wallWidthIn;
    if (insetFits) {
      if (leftEligible) leftAnchor = { xIn: anchorInsetIn, heightIn: eaveHeightIn };
      if (rightEligible) rightAnchor = { xIn: wallWidthIn - anchorInsetIn, heightIn: eaveHeightIn };
      for (const pt of internal) {
        if (leftEligible && pt.xIn < leftAnchor.xIn) pt.xIn = leftAnchor.xIn;
        if (rightEligible && pt.xIn > rightAnchor.xIn) pt.xIn = rightAnchor.xIn;
      }
    }
  }

  internal.sort((a, b) => a.xIn - b.xIn);
  const anchors = [leftAnchor, ...internal, rightAnchor];
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i]!.xIn <= anchors[i - 1]!.xIn) {
      anchors[i] = { ...anchors[i]!, xIn: Math.min(anchors[i - 1]!.xIn + MIN_ANCHOR_GAP_IN, wallWidthIn) };
    }
  }
  return { anchors, leftSnapped: leftClaimed, rightSnapped: rightClaimed };
}

/** The roofline's height at absolute wall position `xIn`, given the true
 * (uninset) resolved anchor list — linear interpolation within whichever
 * segment `xIn` falls in. Anchored to the true geometry regardless of any
 * inset applied when tiling panels, since the roofline itself doesn't
 * move — only where panel material starts/ends does. */
function heightAtAnchors(xIn: number, anchors: RoofAnchor[]): number {
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    if (xIn <= b.xIn || i === anchors.length - 2) {
      const spanIn = b.xIn - a.xIn;
      const t = spanIn > 0 ? Math.min(Math.max((xIn - a.xIn) / spanIn, 0), 1) : 0;
      return a.heightIn + (b.heightIn - a.heightIn) * t;
    }
  }
  return anchors[anchors.length - 1]!.heightIn;
}

function panel(xStartIn: number, xEndIn: number, anchors: RoofAnchor[], isSafetyGap = false): GableTiledPanel {
  return {
    xStartIn,
    xEndIn,
    widthIn: xEndIn - xStartIn,
    leftHeightIn: heightAtAnchors(xStartIn, anchors),
    rightHeightIn: heightAtAnchors(xEndIn, anchors),
    ...(isSafetyGap ? { isSafetyGap: true } : {}),
  };
}

/** Tiles one absolute-coordinate run [startIn, endIn] into evenly-sized
 * panels, reading each panel's own edge heights off the wall's true
 * roofline — same "ceil'd, evenly-divided" rule as computeJoistLayout, so a
 * run that doesn't divide evenly by the target still gets a uniform pitch,
 * not a short leftover panel. Returns no panels for a non-positive run
 * width (e.g. fully consumed by an inset). */
function tileEvenly(startIn: number, endIn: number, anchors: RoofAnchor[], targetPanelWidthIn: number): GableTiledPanel[] {
  // Integer eighths, same as tiling.ts: the run's two ends snap to the
  // 1/8in grid and the widths are distributed over it, so every tile is a
  // whole eighth and the tiles still span the run exactly. The old even
  // division put an entire gable row on sixteenths (or worse) the moment a
  // run didn't divide cleanly by the target width.
  const startEighths = toEighths(startIn);
  const runEighths = toEighths(endIn) - startEighths;
  if (runEighths <= 0) return [];
  const panelCount = Math.max(1, Math.ceil(fromEighths(runEighths) / targetPanelWidthIn));
  const panels: GableTiledPanel[] = [];
  let cursorEighths = startEighths;
  for (const widthEighths of distributeEighths(runEighths, panelCount)) {
    if (widthEighths <= 0) continue;
    panels.push(panel(fromEighths(cursorEighths), fromEighths(cursorEighths + widthEighths), anchors));
    cursorEighths += widthEighths;
  }
  return panels;
}

/** Tiles one absolute-coordinate run at a fixed `targetPanelWidthIn`,
 * reserving one dedicated GABLE_SAFETY_GAP_WIDTH_IN-wide tile at the run's
 * own OUTER (`gapEnd`) side rather than evenly redistributing overflow
 * across every panel — mirrors packages/geometry/src/tiling.ts's own
 * computePlainSizing/buildPlainMiddle shape: floor-divide what's left after
 * the gap into whole target-width panels, then absorb whatever remainder
 * doesn't divide evenly by splitting the ONE panel adjacent to the gap into
 * 2 even panels (both still under targetPanelWidthIn) instead of growing
 * any panel oversized. The gap sits at the run's own eave-side end, never
 * the peak-adjacent end, so the "a panel boundary always lands exactly on
 * every control point" invariant near the peak/shoulder stays untouched.
 * Falls back to `tileEvenly` for runs too short to bother (mirrors
 * SAFETY_PANEL_MIN_WALL_LENGTH_IN's own 12ft gate). */
function tileRun(
  startIn: number,
  endIn: number,
  anchors: RoofAnchor[],
  targetPanelWidthIn: number,
  gapEnd: "start" | "end",
): GableTiledPanel[] {
  const startEighths = toEighths(startIn);
  const runEighths = toEighths(endIn) - startEighths;
  if (runEighths <= 0) return [];
  if (fromEighths(runEighths) <= GABLE_SAFETY_GAP_MIN_RUN_LENGTH_IN) return tileEvenly(startIn, endIn, anchors, targetPanelWidthIn);

  const gapEighths = toEighths(GABLE_SAFETY_GAP_WIDTH_IN);
  const targetEighths = Math.max(1, toEighths(targetPanelWidthIn));
  const budgetEighths = runEighths - gapEighths;
  const wholePanelCount = Math.floor(budgetEighths / targetEighths);
  if (wholePanelCount < 1) return tileEvenly(startIn, endIn, anchors, targetPanelWidthIn);

  const leftoverEighths = budgetEighths - wholePanelCount * targetEighths;
  // The same uneven split tiling.ts's computePlainSizing now does — the two
  // halves differ by at most one eighth, both are whole eighths, and they
  // still sum to targetEighths + leftoverEighths exactly. Laid out in the
  // array order distributeEighths returns (extra eighth to the lowest
  // index), matching buildPlainMiddle's own convention.
  const splitEighths = distributeEighths(targetEighths + leftoverEighths, 2);
  const farPanelCount = wholePanelCount - 1; // full-width panels, away from the gap
  const farEighths = Array.from({ length: farPanelCount }, () => targetEighths);

  const widthsEighths = gapEnd === "start"
    ? [gapEighths, ...splitEighths, ...farEighths]
    : [...farEighths, ...splitEighths, gapEighths];
  const gapIndex = gapEnd === "start" ? 0 : widthsEighths.length - 1;

  const panels: GableTiledPanel[] = [];
  let cursorEighths = startEighths;
  widthsEighths.forEach((widthEighths, i) => {
    panels.push(panel(fromEighths(cursorEighths), fromEighths(cursorEighths + widthEighths), anchors, i === gapIndex));
    cursorEighths += widthEighths;
  });
  return panels;
}

/**
 * Tiles one segment's own run exactly like `tileRun`/`tileEvenly` already
 * do, but with 0+ window reservations (already localized to this segment's
 * own ordinal numbering — see `computeGableTiledRow`'s own global-to-local
 * mapping) carved out first — mirrors `retileWithOpenings`'s own shape in
 * tiling.ts: subtract every reservation's width from the plain budget,
 * tile whatever's left exactly as before, then splice each reservation
 * back in at its own ordinal position (walking `localWindows` in order,
 * inserting one right before the plain tile that would otherwise be the
 * Nth real, non-safety-gap tile). A plain tile's own position/edge-heights
 * are recomputed from a running cursor rather than reused as-is, since
 * `tileRun`'s own internal budget math was run against the SHRUNK range
 * (`endIn - windowsTotalWidthIn`), not the segment's true absolute extent.
 * A no-reservations call is byte-identical to calling `tileRun`/`tileEvenly`
 * directly (same fallback either way), so every pre-existing caller stays
 * unaffected.
 */
function tileRunWithWindows(
  startIn: number,
  endIn: number,
  anchors: RoofAnchor[],
  targetPanelWidthIn: number,
  gapEnd: "start" | "end",
  includeSafetyGap: boolean,
  localWindows: { ordinal: number; widthIn: number; heightIn?: number; sillHeightIn?: number }[],
): GableTiledPanel[] {
  const plainTile = (a: number, b: number, anchors: RoofAnchor[]) =>
    includeSafetyGap ? tileRun(a, b, anchors, targetPanelWidthIn, gapEnd) : tileEvenly(a, b, anchors, targetPanelWidthIn);
  if (localWindows.length === 0) return plainTile(startIn, endIn, anchors);

  // Every window's reserved width is snapped to the grid before it is
  // subtracted, so the plain budget left for real tiles is itself a whole
  // number of eighths — otherwise one off-grid window would push every
  // other tile in the segment off the grid with it.
  const startEighths = toEighths(startIn);
  const windowsTotalEighths = localWindows.reduce((sum, w) => sum + Math.max(0, toEighths(w.widthIn)), 0);
  const plainBudgetEighths = Math.max(0, toEighths(endIn) - startEighths - windowsTotalEighths);
  const plainTiles = plainTile(startIn, fromEighths(startEighths + plainBudgetEighths), anchors);

  const sortedWindows = [...localWindows].sort((a, b) => a.ordinal - b.ordinal);
  const result: GableTiledPanel[] = [];
  let realTileCount = 0; // non-safety-gap tiles placed so far
  let windowIdx = 0;
  let cursorEighths = startEighths;
  const pushWindow = (w: (typeof sortedWindows)[number]) => {
    const widthEighths = Math.max(0, toEighths(w.widthIn));
    result.push({
      ...panel(fromEighths(cursorEighths), fromEighths(cursorEighths + widthEighths), anchors),
      isWindow: true,
      ...(w.heightIn !== undefined && { windowHeightIn: w.heightIn }),
      ...(w.sillHeightIn !== undefined && { windowSillHeightIn: w.sillHeightIn }),
    });
    cursorEighths += widthEighths;
  };
  for (const tile of plainTiles) {
    while (windowIdx < sortedWindows.length && sortedWindows[windowIdx]!.ordinal <= realTileCount) {
      pushWindow(sortedWindows[windowIdx]!);
      windowIdx++;
    }
    const widthEighths = toEighths(tile.xEndIn - tile.xStartIn);
    result.push({ ...panel(fromEighths(cursorEighths), fromEighths(cursorEighths + widthEighths), anchors, tile.isSafetyGap) });
    cursorEighths += widthEighths;
    if (!tile.isSafetyGap) realTileCount++;
  }
  while (windowIdx < sortedWindows.length) {
    pushWindow(sortedWindows[windowIdx]!);
    windowIdx++;
  }
  return result;
}

/**
 * A gable window's REAL position along the wall, in inches from the wall's
 * own start corner — derived from the unclamped row, so it does not depend
 * on where the panel run happens to stop.
 */
export interface GableWindowPlacement {
  xStartIn: number;
  xEndIn: number;
  heightIn?: number;
  sillHeightIn?: number;
}

/**
 * Places windows at their TRUE x positions and tiles the gaps between them.
 *
 * **Tommy, 2026-09-25: a gable window stays put on the building.** Stopping
 * the near end of a wall must not move a window at the far end — a window is
 * dimensioned from the building, not from wherever the panel run begins.
 *
 * The ordinal path (`tileRunWithWindows`) cannot express that: its
 * `beforeTileCount` is positional in the run, and a start clamp removes
 * leading tiles, so every window slides by the clamp. Measured before this
 * existed: clamping a 240in wall's start to 60in moved two windows from
 * x=[60,150] to x=[120,210], carrying the second one across the peak.
 *
 * So the clamped path places by POSITION instead. The unclamped path is
 * untouched and still goes through `tileRunWithWindows`, which is why every
 * existing project tiles byte-identically.
 */
function tileRunWithPositionedWindows(
  startIn: number,
  endIn: number,
  anchors: RoofAnchor[],
  targetPanelWidthIn: number,
  gapEnd: "start" | "end",
  includeSafetyGap: boolean,
  windows: GableWindowPlacement[],
): GableTiledPanel[] {
  const plainTile = (a: number, b: number) =>
    includeSafetyGap ? tileRun(a, b, anchors, targetPanelWidthIn, gapEnd) : tileEvenly(a, b, anchors, targetPanelWidthIn);
  const inRange = windows
    .filter((w) => toEighths(w.xStartIn) >= toEighths(startIn) && toEighths(w.xEndIn) <= toEighths(endIn))
    .sort((a, b) => a.xStartIn - b.xStartIn);
  if (inRange.length === 0) return plainTile(startIn, endIn);

  const out: GableTiledPanel[] = [];
  let cursorIn = startIn;
  for (const w of inRange) {
    if (toEighths(w.xStartIn) > toEighths(cursorIn)) out.push(...plainTile(cursorIn, w.xStartIn));
    out.push({
      ...panel(w.xStartIn, w.xEndIn, anchors),
      isWindow: true,
      ...(w.heightIn !== undefined && { windowHeightIn: w.heightIn }),
      ...(w.sillHeightIn !== undefined && { windowSillHeightIn: w.sillHeightIn }),
    });
    cursorIn = w.xEndIn;
  }
  if (toEighths(endIn) > toEighths(cursorIn)) out.push(...plainTile(cursorIn, endIn));
  return out;
}

/**
 * Tiles a wall's width into evenly-sized panels reading their heights off a
 * gable roofline defined by 0-2 real profile points (Tommy: a "peaked"
 * profile has 1 point — the ridge; a "flat-topped" profile has 2
 * independently-placed points — the 2 shoulders where the slope levels
 * out) — eave height at both wall ends, rising/falling to/between whichever
 * points are given. The roofline is broken into one segment per pair of
 * consecutive anchors (eave, each point in x-order, eave) and each tiled
 * independently (see `tileRun`) so a panel boundary always lands exactly on
 * every real control point — otherwise a panel straddling one would sample
 * equal heights at its own left/right edges and render flat-topped,
 * silently missing the actual point strictly inside it. Every returned
 * panel is therefore monotonic within its own segment — a caller building
 * real Gable End Panel geometry (see buildGablePanelMembers, which always
 * takes a low edge then a high edge) can just take min/max of
 * left/rightHeightIn directly, no further sorting needed within a single
 * panel.
 *
 * A point with `isExplicitPosition: true` snaps fully onto its own nearest
 * end when dragged within GABLE_SHED_SNAP_THRESHOLD_IN of it, degenerating
 * that side into a single-slope shed — see `resolveAnchors`'s own doc
 * comment for the exact (non-zeroing, override-the-eave-anchor) mechanics
 * and the same-end tie-break rule. A point without `isExplicitPosition`
 * (e.g. an un-set/auto-centered default) never snaps, even on a wall narrow
 * enough that its own default position would otherwise fall inside the
 * threshold, since a plain (non-dragged) default point is still meant to
 * form a real slope, not degenerate to a shed.
 *
 * Each segment reserves a dedicated safety-gap tile (see `tileRun`) for its
 * own leftover width instead of evenly redistributing it across every
 * panel — mirrors the ground-floor wall tiling's own safety-gap convention
 * (packages/geometry/src/tiling.ts). Set `includeSafetyGap: false` to fall
 * back to plain even redistribution (this parameter exists mainly for
 * tests/callers that want the older, gap-free behavior).
 *
 * `insetIn` (default 0) pulls panel material in from each of the wall's two
 * TRUE corners (x=0 and x=wallWidthIn) — same "truss bottom's own width"
 * concept as `trussPlateInsetDefaultIn` in panel-catalog's data.ts (Tommy:
 * "gabel end panels need to start at 5.5 inch from the sides") — mirroring
 * how ground-floor wall tiling (`tiling.ts`'s `resolveCorners`/
 * `fixedEndsIn`) subtracts a fixed end margin before tiling. Height
 * fractions stay anchored to the true (uninset) roofline geometry
 * throughout — only the panel material's own start/end shifts. The inset
 * does NOT apply on a side that snapped to a pure shed there (Tommy: "if
 * the roof is snapped to a shed roof, then there should not be a 5.5in
 * offset") — a shed's single-slope run spans the wall's full true width at
 * that end, corner to corner, with no truss-seat inset. The shed-snap
 * decision itself is always made against the raw `GABLE_SHED_SNAP_THRESHOLD_IN`
 * (never inset-adjusted), so whether a given point snaps doesn't depend on
 * `insetIn` at all.
 *
 * `heelHeightIn` (default 0) models an energy-heel/raised-heel truss seat
 * (Tommy: "have the truss seat be the full panel width AND THEN go vertical
 * for 6in") — on each unclaimed (non-shed-snapped) end, no cap tile is built
 * over the first `targetPanelWidthIn` from that corner (the wall's own
 * already-flat top there already IS the seat — no separate fabricated riser
 * piece), and the roofline's own first real cap tile starts flush at that
 * point, `heelHeightIn` above the eave. See `resolveAnchors`'s own doc
 * comment for the exact mechanics, including the narrow-wall fallback and
 * the seat-zone point-clamp. Skipped entirely on a shed-snapped side, and
 * on a wall too narrow to fit the seat(s) it would need. Only used when
 * `anchorMode` is `"truss-heel"` (the default, matching this function's
 * pre-existing behavior) — under `"panel-depth"` mode, the slope instead
 * starts flush at plain `eaveHeightIn`, inset by `insetIn` rather than a
 * full panel width (Tommy: "the slope needs to be based on exactly where we
 * expect the truss to lift off at - either at the panel depth OR... the
 * truss heel height" — see `RoofBearingAnchorMode`/`resolveAnchors`).
 *
 * `windowReservations` (default none — Tommy: "add an option to click-edit
 * gable end panels to become window gable end panels") carve out 0+ fixed-
 * width window slots at their own anchored ordinal position, exactly the
 * way `retileWithOpenings` in tiling.ts reserves a wall-slot opening —
 * every OTHER tile re-flows around them, the wall's total width still adds
 * up exactly. `beforeTileCount` is counted globally, left to right across
 * every segment (rise, flat, fall) together, since that's how a user reads
 * "the Nth tile" when clicking one on screen — resolved here via a 2-pass
 * approach: first tile every segment with no windows at all (today's exact
 * behavior) purely to learn each segment's own natural real-tile count,
 * then walk the running global-ordinal offset to localize each reservation
 * to whichever segment (and local ordinal within it) it actually falls in,
 * then re-tile each segment for real via `tileRunWithWindows`. A
 * reservation past the very last segment's own natural count clamps onto
 * that segment's own tail instead of silently vanishing (mirrors
 * `retileWithOpenings`'s own "extras append past the plain middle" case).
 *
 * `columnReservationWidthIn` (default none — Tommy: "panels/beam" mode
 * spawns "a column panel centered under the peak") reserves a fixed-width,
 * always-centered structural Column Panel tile — unlike a window, it's
 * never anchored to a user-clicked ordinal. Only applies to a genuine
 * single-peak, non-shed roofline (`anchors` resolves to exactly
 * `[eave, peak, eave]`, i.e. `points.length === 1` and neither end
 * shed-snapped) — a flat-topped profile or a shed has no single peak to
 * center under, so the reservation is silently skipped (same "not every
 * wall gets one" tolerance a too-narrow wall already gets below). Shrinks
 * both segments meeting at the peak by half the column's own width from
 * their shared boundary — the same shape `insetIn` already uses at the
 * wall's own two TRUE outer corners, just applied at this internal one —
 * so the column tile fills the gap between them instead of displacing an
 * ordinal the way a window reservation does. Skipped (falls back to a
 * plain, un-reserved roofline) if the wall is too narrow for the column to
 * fit within the peak's own segment pair.
 */
export function computeGableTiledRow(
  wallWidthIn: number,
  eaveHeightIn: number,
  points: RoofProfilePoint[],
  targetPanelWidthIn: number,
  insetIn = 0,
  includeSafetyGap = true,
  heelHeightIn = 0,
  anchorMode: RoofBearingAnchorMode = "truss-heel",
  windowReservations: GableWindowReservation[] = [],
  columnReservationWidthIn?: number,
  /**
   * Smearforn Stage 3 — the span of this wall that is actually BUILT, in
   * inches from the wall's own start corner. Defaults to the whole wall,
   * which is every project without a run stop.
   *
   * **This is a panel GENERATOR, which is why it has to know.** Everything
   * else the Stage 3 audit touched was a total that read a wall length; this
   * reads a wall length and emits real `"gable"` panel instances that flow
   * through the same pipeline as every other type. Left unclamped, a stopped
   * Gable End wall fabricates, prices, weighs, BOMs and cut-lists gable
   * panels sitting above a span that same wall declares carries no panels —
   * real parts cut wrong, not a number read wrong. Tommy's decision: clamp
   * the row to the built run.
   *
   * **The ROOFLINE is deliberately not clamped.** `points`/`anchors` are
   * still resolved across the full `wallWidthIn`, so the ridge, the profile
   * and every sampled roofline height are unchanged — the roof still spans
   * the wall it always did. Only the tiles stop.
   */
  builtStartIn = 0,
  builtEndIn = wallWidthIn,
): GableTiledPanel[] {
  const { anchors, leftSnapped, rightSnapped } = resolveAnchors(wallWidthIn, eaveHeightIn, points, targetPanelWidthIn, heelHeightIn, anchorMode, insetIn);

  // A shed-snap anywhere kills the inset globally, not just on the snapped
  // side — matches the pre-existing single-peak behavior exactly (Tommy:
  // "if the roof is snapped to a shed roof, then there should not be a
  // 5.5in offset"). insetIn is about clearing the WALL's own two true
  // corners' framing, not "which side is the ridge" — so once any part of
  // the roofline spans corner-to-corner as a shed, neither corner gets an
  // inset, even if the other point is still a genuine (non-snapped) shoulder.
  const effectiveInsetIn = leftSnapped || rightSnapped ? 0 : insetIn;
  // The truss-plate inset and the run stop both pull the usable run in; the
  // TIGHTER of the two wins at each end. A stop is measured from the wall's
  // own corner, same origin the inset uses, so they compose by max/min with
  // no extra bookkeeping.
  const usableStartIn = Math.max(effectiveInsetIn, builtStartIn);
  const usableEndIn = Math.min(wallWidthIn - effectiveInsetIn, builtEndIn);
  // A fully stopped gable wall builds NOTHING up there — not one zero-width
  // tile, which would still be a real priced and fabricated panel instance.
  // Same guard the roof-bearing plate carries for the same reason.
  if (usableEndIn - usableStartIn <= 0) return [];

  // Is the row actually clamped by a run stop (as opposed to only by the
  // truss-plate inset, which has always been there)?
  const isClamped = toEighths(builtStartIn) > 0 || toEighths(builtEndIn) < toEighths(wallWidthIn);
  // **Windows stay put on the building** (Tommy, 2026-09-25). Their true
  // positions come from the UNCLAMPED row — one recursion, guarded by
  // `isClamped` so it cannot repeat — and the clamped row then places the
  // survivors at exactly those x values. See
  // `tileRunWithPositionedWindows` for why the ordinal path cannot do this.
  const positionedWindows: GableWindowPlacement[] =
    isClamped && windowReservations.length > 0
      ? computeGableTiledRow(
          wallWidthIn,
          eaveHeightIn,
          points,
          targetPanelWidthIn,
          insetIn,
          includeSafetyGap,
          heelHeightIn,
          anchorMode,
          windowReservations,
          columnReservationWidthIn,
        )
          .filter((p) => p.isWindow)
          .map((p) => ({ xStartIn: p.xStartIn, xEndIn: p.xEndIn, heightIn: p.windowHeightIn, sillHeightIn: p.windowSillHeightIn }))
          // Entirely inside the built run survives; entirely outside is
          // simply not built (inference — see the as-built note); one the
          // stop CUTS THROUGH is dropped here defensively and refused at the
          // point of edit, because half a window is a fabricated part that
          // does not exist.
          .filter((w) => toEighths(w.xStartIn) >= toEighths(usableStartIn) && toEighths(w.xEndIn) <= toEighths(usableEndIn))
      : [];

  // Segment boundaries are snapped to the 1/8in grid HERE rather than
  // inside the tilers, so that consecutive segments provably share an
  // identical boundary value and the tiles stay contiguous across it. An
  // anchor x is derived from a dragged profile point or an inset, so it is
  // exactly the sort of value that arrives off the grid; moving it by at
  // most 1/16in changes no roofline height a shop could measure (heights
  // are still sampled off the true, unsnapped anchors).
  const snapIn = (valueIn: number) => fromEighths(toEighths(valueIn));
  const segments: { segStartIn: number; segEndIn: number; gapEnd: "start" | "end" }[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    segments.push({
      segStartIn: snapIn(Math.max(anchors[i]!.xIn, usableStartIn)),
      segEndIn: snapIn(Math.min(anchors[i + 1]!.xIn, usableEndIn)),
      gapEnd: i === 0 ? "start" : i === anchors.length - 2 ? "end" : "start",
    });
  }

  // A segment can be squeezed out entirely once a run stop clamps the
  // usable run past one of the anchors. Tiles are taken through this helper
  // everywhere — including the `naturalCounts` pass, whose per-segment
  // counts set the window ordinals, so skipping a segment in one place and
  // not the other would silently renumber every window after it.
  const tilesForSegment = (seg: { segStartIn: number; segEndIn: number; gapEnd: "start" | "end" }): GableTiledPanel[] => {
    if (seg.segEndIn - seg.segStartIn <= 0) return [];
    return includeSafetyGap
      ? tileRun(seg.segStartIn, seg.segEndIn, anchors, targetPanelWidthIn, seg.gapEnd)
      : tileEvenly(seg.segStartIn, seg.segEndIn, anchors, targetPanelWidthIn);
  };

  let columnTile: GableTiledPanel | null = null;
  // `anchors.length === 3` already guarantees two segments — `segments` is
  // built with exactly `anchors.length - 1` entries and clamping collapses a
  // segment to zero width rather than removing it, so indexing [0] and [1]
  // below is safe. (An earlier version of this line also tested
  // `segments.length >= 2` and claimed a clamp could drop one; that was
  // false, and a guard asserting a false fact about the code is worse than
  // no guard.) What actually protects the column against a clamp is the
  // bounds test below, which drops it cleanly — `columnTile` stays null and
  // nothing downstream is keyed to it.
  if (columnReservationWidthIn !== undefined && anchors.length === 3) {
    const peakAnchor = anchors[1]!;
    // Centered to within one eighth rather than exactly: the column's own
    // width stays exactly what was asked for, and its two edges stay on the
    // grid, which is what the two segments either side of it need. An odd
    // number of eighths therefore sits 1/16in off the true peak.
    const columnWidthEighths = Math.max(0, toEighths(columnReservationWidthIn));
    const columnStartEighths = toEighths(peakAnchor.xIn) - Math.floor(columnWidthEighths / 2);
    const columnStartIn = fromEighths(columnStartEighths);
    const columnEndIn = fromEighths(columnStartEighths + columnWidthEighths);
    if (columnStartIn >= segments[0]!.segStartIn && columnEndIn <= segments[1]!.segEndIn) {
      segments[0]!.segEndIn = columnStartIn;
      segments[1]!.segStartIn = columnEndIn;
      const flatTopHeightIn = peakAnchor.heightIn - GABLE_COLUMN_FLAT_TOP_DROP_IN;
      columnTile = {
        xStartIn: columnStartIn,
        xEndIn: columnEndIn,
        widthIn: fromEighths(columnWidthEighths),
        leftHeightIn: flatTopHeightIn,
        rightHeightIn: flatTopHeightIn,
        isColumn: true,
      };
    }
  }

  if (isClamped && windowReservations.length > 0) {
    // Positional placement — the windows are already where they belong.
    const panels: GableTiledPanel[] = [];
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx]!;
      if (seg.segEndIn - seg.segStartIn > 0) {
        panels.push(
          ...tileRunWithPositionedWindows(
            seg.segStartIn,
            seg.segEndIn,
            anchors,
            targetPanelWidthIn,
            seg.gapEnd,
            includeSafetyGap,
            positionedWindows,
          ),
        );
      }
      if (segIdx === 0 && columnTile) panels.push(columnTile);
    }
    return panels;
  }

  if (windowReservations.length === 0) {
    const panels: GableTiledPanel[] = [];
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx]!;
      panels.push(...tilesForSegment(seg));
      if (segIdx === 0 && columnTile) panels.push(columnTile);
    }
    return panels;
  }

  const naturalCounts = segments.map((seg) => tilesForSegment(seg).filter((p) => !p.isSafetyGap).length);
  const segmentWindows: { ordinal: number; widthIn: number; heightIn?: number; sillHeightIn?: number }[][] = segments.map(() => []);
  let globalBase = 0;
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    for (const w of windowReservations) {
      if (w.beforeTileCount >= globalBase && w.beforeTileCount < globalBase + naturalCounts[segIdx]!) {
        segmentWindows[segIdx]!.push({ ordinal: w.beforeTileCount - globalBase, widthIn: w.widthIn, heightIn: w.heightIn, sillHeightIn: w.sillHeightIn });
      }
    }
    globalBase += naturalCounts[segIdx]!;
  }
  const lastSegIdx = segments.length - 1;
  for (const w of windowReservations) {
    if (w.beforeTileCount >= globalBase) {
      segmentWindows[lastSegIdx]!.push({ ordinal: Infinity, widthIn: w.widthIn, heightIn: w.heightIn, sillHeightIn: w.sillHeightIn });
    }
  }

  const panels: GableTiledPanel[] = [];
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx]!;
    if (seg.segEndIn - seg.segStartIn > 0) {
      panels.push(...tileRunWithWindows(seg.segStartIn, seg.segEndIn, anchors, targetPanelWidthIn, seg.gapEnd, includeSafetyGap, segmentWindows[segIdx]!));
    }
    if (segIdx === 0 && columnTile) panels.push(columnTile);
  }
  return panels;
}

export interface GableWindowsAgainstRunStop {
  /** Windows the stop leaves fully built — the normal case. */
  kept: GableWindowPlacement[];
  /** Windows entirely inside the unbuilt span. They are simply NOT BUILT, so
   * they generate no panel and no cut-list part. **Inference**, consistent
   * with everything else in Stage 3, but never confirmed by Tommy. */
  dropped: GableWindowPlacement[];
  /** Windows the stop CUTS THROUGH. Deliberately NOT resolved here: half a
   * window is a fabricated part that does not exist, and silently swallowing
   * a whole one is worse. The caller refuses the stop and names the window.
   */
  straddling: GableWindowPlacement[];
}

/**
 * How a candidate run stop would treat this wall's gable windows, without
 * tiling anything the caller has to interpret.
 *
 * Exists so the stop REFUSAL can name a window the stop would cut through,
 * rather than the tiler quietly producing a half window. The positions come
 * from the unclamped row, so they are the windows' real positions on the
 * building — the same basis `computeGableTiledRow` places them against.
 */
export function classifyGableWindowsAgainstRunStop(
  wallWidthIn: number,
  eaveHeightIn: number,
  points: RoofProfilePoint[],
  targetPanelWidthIn: number,
  insetIn: number,
  includeSafetyGap: boolean,
  heelHeightIn: number,
  anchorMode: RoofBearingAnchorMode,
  windowReservations: GableWindowReservation[],
  columnReservationWidthIn: number | undefined,
  builtStartIn: number,
  builtEndIn: number,
): GableWindowsAgainstRunStop {
  const result: GableWindowsAgainstRunStop = { kept: [], dropped: [], straddling: [] };
  if (windowReservations.length === 0) return result;
  const full = computeGableTiledRow(
    wallWidthIn,
    eaveHeightIn,
    points,
    targetPanelWidthIn,
    insetIn,
    includeSafetyGap,
    heelHeightIn,
    anchorMode,
    windowReservations,
    columnReservationWidthIn,
  ).filter((p) => p.isWindow);
  for (const p of full) {
    const w: GableWindowPlacement = {
      xStartIn: p.xStartIn,
      xEndIn: p.xEndIn,
      heightIn: p.windowHeightIn,
      sillHeightIn: p.windowSillHeightIn,
    };
    const startsInside = toEighths(w.xStartIn) >= toEighths(builtStartIn);
    const endsInside = toEighths(w.xEndIn) <= toEighths(builtEndIn);
    if (startsInside && endsInside) result.kept.push(w);
    else if (!startsInside && !endsInside) result.dropped.push(w); // spans the whole built run
    else if (toEighths(w.xEndIn) <= toEighths(builtStartIn) || toEighths(w.xStartIn) >= toEighths(builtEndIn)) result.dropped.push(w);
    else result.straddling.push(w);
  }
  return result;
}
