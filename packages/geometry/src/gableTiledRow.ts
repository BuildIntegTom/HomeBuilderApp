export interface GableTiledPanel {
  xStartIn: number;
  xEndIn: number;
  widthIn: number;
  /** Roofline height at this panel's left (near/x=xStartIn) edge. */
  leftHeightIn: number;
  /** Roofline height at this panel's right (far/x=xEndIn) edge. */
  rightHeightIn: number;
}

/** Tommy: "if the peak of gable end panels is less than 2', then snap the
 * line to the edge and only have one slope of gable end panels — like for a
 * shed roof style." Within this distance of either wall end, the peak snaps
 * fully onto that end, degenerating the tiled row into a single-slope shed. */
export const GABLE_SHED_SNAP_THRESHOLD_IN = 24;

/** The roofline's height at absolute wall position `xIn`, given the true
 * (uninset) peak location — eave height at both wall ends (x=0 and
 * x=wallWidthIn), rising to ridge height at x=peakIn. Anchored to the true
 * geometry regardless of any inset applied when tiling panels, since the
 * roofline itself doesn't move — only where panel material starts/ends
 * does. `peakIn === 0` or `peakIn === wallWidthIn` (a snapped shed) is
 * handled without dividing by a zero-width half. */
function heightAtX(xIn: number, peakIn: number, wallWidthIn: number, eaveHeightIn: number, ridgeHeightIn: number): number {
  if (xIn <= peakIn) {
    return peakIn > 0 ? eaveHeightIn + (ridgeHeightIn - eaveHeightIn) * (xIn / peakIn) : ridgeHeightIn;
  }
  const farWidthIn = wallWidthIn - peakIn;
  return farWidthIn > 0 ? eaveHeightIn + (ridgeHeightIn - eaveHeightIn) * ((wallWidthIn - xIn) / farWidthIn) : ridgeHeightIn;
}

/** Tiles one absolute-coordinate run [startIn, endIn] into evenly-sized
 * panels, reading each panel's own edge heights off the wall's true
 * roofline — same "ceil'd, evenly-divided" rule as computeJoistLayout, so a
 * run that doesn't divide evenly by the target still gets a uniform pitch,
 * not a short leftover panel. Returns no panels for a non-positive run
 * width (e.g. fully consumed by an inset). */
function tileRun(
  startIn: number,
  endIn: number,
  peakIn: number,
  wallWidthIn: number,
  eaveHeightIn: number,
  ridgeHeightIn: number,
  targetPanelWidthIn: number,
): GableTiledPanel[] {
  const runWidthIn = endIn - startIn;
  if (runWidthIn <= 0) return [];
  const panelCount = Math.max(1, Math.ceil(runWidthIn / targetPanelWidthIn));
  const panelWidthIn = runWidthIn / panelCount;
  const panels: GableTiledPanel[] = [];
  for (let i = 0; i < panelCount; i++) {
    const xStartIn = startIn + i * panelWidthIn;
    const xEndIn = xStartIn + panelWidthIn;
    panels.push({
      xStartIn,
      xEndIn,
      widthIn: panelWidthIn,
      leftHeightIn: heightAtX(xStartIn, peakIn, wallWidthIn, eaveHeightIn, ridgeHeightIn),
      rightHeightIn: heightAtX(xEndIn, peakIn, wallWidthIn, eaveHeightIn, ridgeHeightIn),
    });
  }
  return panels;
}

/**
 * Tiles a wall's width into evenly-sized panels reading their heights off a
 * gable roofline — eave height at both wall ends, rising to the ridge height
 * at `peakPositionIn` (default: the wall's midpoint, a symmetric gable). The
 * near (0..peak) and far (peak..wallWidthIn) runs are tiled independently
 * (each meeting exactly at the peak) so a panel boundary always lands
 * exactly on the ridge — otherwise a panel straddling the peak would sample
 * equal heights at its own left/right edges and render flat-topped, silently
 * missing the actual peak strictly inside it. Every returned panel is
 * therefore monotonic (uniformly rising in the near run, uniformly falling
 * in the far run) — a caller building real Gable End Panel geometry (see
 * buildGablePanelMembers, which always takes a low edge then a high edge)
 * can just take min/max of left/rightHeightIn directly, no further sorting
 * needed within a single panel.
 *
 * When an explicit `peakPositionIn` (e.g. a user dragging the peak) falls
 * within GABLE_SHED_SNAP_THRESHOLD_IN of either end, it snaps fully onto
 * that end — the near or far run collapses to zero width and drops out
 * entirely, leaving a single-slope shed roofline spanning the whole wall
 * (ridge height at the snapped end, eave height at the other). The
 * snap only applies when a peak position is explicitly passed — the default
 * symmetric midpoint never snaps, even on a wall narrow enough that its own
 * midpoint would otherwise fall inside the threshold, since a plain
 * (non-dragged) narrow gable is still meant to peak, not degenerate to a shed.
 *
 * A first-pass tiling: doesn't yet handle safety/gap-style leftover-width
 * absorption the way the ground-floor wall tiling does.
 *
 * `insetIn` (default 0) pulls panel material in from each of the wall's two
 * TRUE corners (x=0 and x=wallWidthIn) — same "truss bottom's own width"
 * concept as `trussPlateInsetDefaultIn` in panel-catalog's data.ts (Tommy:
 * "gabel end panels need to start at 5.5 inch from the sides") — mirroring
 * how ground-floor wall tiling (`tiling.ts`'s `resolveCorners`/
 * `fixedEndsIn`) subtracts a fixed end margin before tiling, which this
 * function previously had no equivalent of at all. Height fractions stay
 * anchored to the true (uninset) peak/wall geometry throughout — only the
 * panel material's own start/end shifts.
 *
 * The inset does NOT apply once the peak snaps to a pure shed (Tommy: "if
 * the roof is snapped to a shed roof, then there should not be a 5.5in
 * offset") — a shed's single-slope run spans the wall's full true width,
 * corner to corner, with no truss-seat inset at either end. The shed-snap
 * decision itself is always made against the raw `GABLE_SHED_SNAP_THRESHOLD_IN`
 * (never inset-adjusted), so whether a given peak position snaps doesn't
 * depend on `insetIn` at all.
 */
export function computeGableTiledRow(
  wallWidthIn: number,
  eaveHeightIn: number,
  ridgeHeightIn: number,
  targetPanelWidthIn: number,
  peakPositionIn?: number,
  insetIn = 0,
): GableTiledPanel[] {
  const isExplicitPeak = peakPositionIn !== undefined;
  let peakIn = Math.min(Math.max(peakPositionIn ?? wallWidthIn / 2, 0), wallWidthIn);
  let snappedToShed = false;
  if (isExplicitPeak) {
    if (peakIn < GABLE_SHED_SNAP_THRESHOLD_IN) {
      peakIn = 0;
      snappedToShed = true;
    } else if (peakIn > wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN) {
      peakIn = wallWidthIn;
      snappedToShed = true;
    }
  }
  const effectiveInsetIn = snappedToShed ? 0 : insetIn;

  const usableStartIn = effectiveInsetIn;
  const usableEndIn = wallWidthIn - effectiveInsetIn;
  const nearEndIn = Math.min(peakIn, usableEndIn);
  const farStartIn = Math.max(peakIn, usableStartIn);

  const nearRun = tileRun(usableStartIn, nearEndIn, peakIn, wallWidthIn, eaveHeightIn, ridgeHeightIn, targetPanelWidthIn);
  const farRun = tileRun(farStartIn, usableEndIn, peakIn, wallWidthIn, eaveHeightIn, ridgeHeightIn, targetPanelWidthIn);
  return [...nearRun, ...farRun];
}
