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

/**
 * Tiles a wall's width into evenly-sized panels reading their heights off a
 * symmetric gable roofline — eave height at both wall ends, rising to the
 * ridge height at the wall's midpoint. The near and far halves are tiled
 * independently (each meeting exactly at the midpoint) so a panel boundary
 * always lands exactly on the ridge — otherwise a panel straddling the
 * peak would sample equal heights at its own left/right edges and render
 * flat-topped, silently missing the actual peak strictly inside it. Every
 * returned panel is therefore monotonic (uniformly rising in the near half,
 * uniformly falling in the far half) — a caller building real Gable End
 * Panel geometry (see buildGablePanelMembers, which always takes a low
 * edge then a high edge) can just take min/max of left/rightHeightIn
 * directly, no further sorting needed within a single panel. A first-pass
 * tiling: doesn't yet handle safety/gap-style leftover-width absorption
 * the way the ground-floor wall tiling does.
 */
export function computeGableTiledRow(
  wallWidthIn: number,
  eaveHeightIn: number,
  ridgeHeightIn: number,
  targetPanelWidthIn: number,
): GableTiledPanel[] {
  const halfWidthIn = wallWidthIn / 2;
  const nearHalf = tileHalfRun(halfWidthIn, eaveHeightIn, ridgeHeightIn, targetPanelWidthIn);
  const farHalf = tileHalfRun(halfWidthIn, eaveHeightIn, ridgeHeightIn, targetPanelWidthIn)
    .map((p) => ({
      xStartIn: wallWidthIn - p.xEndIn,
      xEndIn: wallWidthIn - p.xStartIn,
      widthIn: p.widthIn,
      leftHeightIn: p.rightHeightIn,
      rightHeightIn: p.leftHeightIn,
    }))
    .reverse();
  return [...nearHalf, ...farHalf];
}
