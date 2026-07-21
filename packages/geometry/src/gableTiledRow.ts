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
 */
interface ResolvedAnchors {
  anchors: RoofAnchor[];
  leftSnapped: boolean;
  rightSnapped: boolean;
}

function resolveAnchors(wallWidthIn: number, eaveHeightIn: number, points: RoofProfilePoint[]): ResolvedAnchors {
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
  const runWidthIn = endIn - startIn;
  if (runWidthIn <= 0) return [];
  const panelCount = Math.max(1, Math.ceil(runWidthIn / targetPanelWidthIn));
  const panelWidthIn = runWidthIn / panelCount;
  const panels: GableTiledPanel[] = [];
  for (let i = 0; i < panelCount; i++) {
    const xStartIn = startIn + i * panelWidthIn;
    panels.push(panel(xStartIn, xStartIn + panelWidthIn, anchors));
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
  const runWidthIn = endIn - startIn;
  if (runWidthIn <= 0) return [];
  if (runWidthIn <= GABLE_SAFETY_GAP_MIN_RUN_LENGTH_IN) return tileEvenly(startIn, endIn, anchors, targetPanelWidthIn);

  const budgetIn = runWidthIn - GABLE_SAFETY_GAP_WIDTH_IN;
  const wholePanelCount = Math.floor(budgetIn / targetPanelWidthIn);
  if (wholePanelCount < 1) return tileEvenly(startIn, endIn, anchors, targetPanelWidthIn);

  const leftoverIn = budgetIn - wholePanelCount * targetPanelWidthIn;
  const splitTotalIn = targetPanelWidthIn + leftoverIn;
  const halfSplitIn = splitTotalIn / 2;
  const farPanelCount = wholePanelCount - 1; // full-width panels, away from the gap

  const panels: GableTiledPanel[] = [];
  if (gapEnd === "start") {
    let x = startIn;
    panels.push(panel(x, x + GABLE_SAFETY_GAP_WIDTH_IN, anchors, true));
    x += GABLE_SAFETY_GAP_WIDTH_IN;
    panels.push(panel(x, x + halfSplitIn, anchors));
    x += halfSplitIn;
    panels.push(panel(x, x + halfSplitIn, anchors));
    x += halfSplitIn;
    for (let i = 0; i < farPanelCount; i++) {
      panels.push(panel(x, x + targetPanelWidthIn, anchors));
      x += targetPanelWidthIn;
    }
  } else {
    let x = endIn;
    panels.unshift(panel(x - GABLE_SAFETY_GAP_WIDTH_IN, x, anchors, true));
    x -= GABLE_SAFETY_GAP_WIDTH_IN;
    panels.unshift(panel(x - halfSplitIn, x, anchors));
    x -= halfSplitIn;
    panels.unshift(panel(x - halfSplitIn, x, anchors));
    x -= halfSplitIn;
    for (let i = 0; i < farPanelCount; i++) {
      panels.unshift(panel(x - targetPanelWidthIn, x, anchors));
      x -= targetPanelWidthIn;
    }
  }
  return panels;
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
 */
export function computeGableTiledRow(
  wallWidthIn: number,
  eaveHeightIn: number,
  points: RoofProfilePoint[],
  targetPanelWidthIn: number,
  insetIn = 0,
  includeSafetyGap = true,
): GableTiledPanel[] {
  const { anchors, leftSnapped, rightSnapped } = resolveAnchors(wallWidthIn, eaveHeightIn, points);

  // A shed-snap anywhere kills the inset globally, not just on the snapped
  // side — matches the pre-existing single-peak behavior exactly (Tommy:
  // "if the roof is snapped to a shed roof, then there should not be a
  // 5.5in offset"). insetIn is about clearing the WALL's own two true
  // corners' framing, not "which side is the ridge" — so once any part of
  // the roofline spans corner-to-corner as a shed, neither corner gets an
  // inset, even if the other point is still a genuine (non-snapped) shoulder.
  const effectiveInsetIn = leftSnapped || rightSnapped ? 0 : insetIn;
  const usableStartIn = effectiveInsetIn;
  const usableEndIn = wallWidthIn - effectiveInsetIn;

  const panels: GableTiledPanel[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const segStartIn = Math.max(anchors[i]!.xIn, usableStartIn);
    const segEndIn = Math.min(anchors[i + 1]!.xIn, usableEndIn);
    const gapEnd: "start" | "end" = i === 0 ? "start" : i === anchors.length - 2 ? "end" : "start";
    panels.push(
      ...(includeSafetyGap ? tileRun(segStartIn, segEndIn, anchors, targetPanelWidthIn, gapEnd) : tileEvenly(segStartIn, segEndIn, anchors, targetPanelWidthIn)),
    );
  }
  return panels;
}
