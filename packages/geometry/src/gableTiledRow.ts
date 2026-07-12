export interface GableTiledPanel {
  xStartIn: number;
  xEndIn: number;
  widthIn: number;
  /** Roofline height at this panel's left (near/x=xStartIn) edge. */
  leftHeightIn: number;
  /** Roofline height at this panel's right (far/x=xEndIn) edge. */
  rightHeightIn: number;
}

/** Tiles one monotonic half-run [0, halfWidthIn] (eave at x=0, ridge at
 * x=halfWidthIn) into evenly-sized panels — same "ceil'd, evenly-divided"
 * rule as computeJoistLayout, so a half-width that doesn't divide evenly by
 * the target still gets a uniform pitch, not a short leftover panel. */
function tileHalfRun(halfWidthIn: number, eaveHeightIn: number, ridgeHeightIn: number, targetPanelWidthIn: number): GableTiledPanel[] {
  const panelCount = Math.max(1, Math.ceil(halfWidthIn / targetPanelWidthIn));
  const panelWidthIn = halfWidthIn / panelCount;
  const panels: GableTiledPanel[] = [];
  for (let i = 0; i < panelCount; i++) {
    const xStartIn = i * panelWidthIn;
    const xEndIn = xStartIn + panelWidthIn;
    panels.push({
      xStartIn,
      xEndIn,
      widthIn: panelWidthIn,
      leftHeightIn: eaveHeightIn + (ridgeHeightIn - eaveHeightIn) * (xStartIn / halfWidthIn),
      rightHeightIn: eaveHeightIn + (ridgeHeightIn - eaveHeightIn) * (xEndIn / halfWidthIn),
    });
  }
  return panels;
}

/** Tommy: "if the peak of gable end panels is less than 2', then snap the
 * line to the edge and only have one slope of gable end panels — like for a
 * shed roof style." Within this distance of either wall end, the peak snaps
 * fully onto that end, degenerating the tiled row into a single-slope shed. */
export const GABLE_SHED_SNAP_THRESHOLD_IN = 24;

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
 */
export function computeGableTiledRow(
  wallWidthIn: number,
  eaveHeightIn: number,
  ridgeHeightIn: number,
  targetPanelWidthIn: number,
  peakPositionIn?: number,
): GableTiledPanel[] {
  const isExplicitPeak = peakPositionIn !== undefined;
  let peakIn = Math.min(Math.max(peakPositionIn ?? wallWidthIn / 2, 0), wallWidthIn);
  if (isExplicitPeak) {
    if (peakIn < GABLE_SHED_SNAP_THRESHOLD_IN) peakIn = 0;
    else if (peakIn > wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN) peakIn = wallWidthIn;
  }

  const nearHalf = peakIn > 0 ? tileHalfRun(peakIn, eaveHeightIn, ridgeHeightIn, targetPanelWidthIn) : [];
  const farWidthIn = wallWidthIn - peakIn;
  const farHalf =
    farWidthIn > 0
      ? tileHalfRun(farWidthIn, eaveHeightIn, ridgeHeightIn, targetPanelWidthIn)
          .map((p) => ({
            xStartIn: wallWidthIn - p.xEndIn,
            xEndIn: wallWidthIn - p.xStartIn,
            widthIn: p.widthIn,
            leftHeightIn: p.rightHeightIn,
            rightHeightIn: p.leftHeightIn,
          }))
          .reverse()
      : [];
  return [...nearHalf, ...farHalf];
}
