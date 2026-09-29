/**
 * Wall-elevation viewport maths — the pure part of WallElevationDiagram's
 * "fit the wall height, scroll the wall length" view (Tommy, 2026-09-29:
 * "the elevation viewers appear super small and do not have zoom or scroll
 * capabilities").
 *
 * Extracted here for one reason only: **the drag handlers' screen-to-inches
 * mapping is load-bearing and has to be provable without a browser.** Every
 * drag in WallElevationDiagram (gable profile points, the max-height line,
 * Box Beam and Mid-Wall Bond Beam coverage handles, and the panel-boundary
 * drag that is how Tommy sets real panel widths) re-derives its own ratio
 * per event from `svgWidthPx / svgRect.width`. Growing the drawing and
 * letting it be zoomed is only safe while that ratio stays exact, which in
 * turn is only true while the drawing is scaled UNIFORMLY on both axes.
 * `wallPosInFromScreenX` below is that mapping, byte-for-byte the arithmetic
 * the drag effects run, so `elevationViewport.test.ts` can pin it.
 *
 * ⚠ Every number in this file is a SCREEN measurement — pixels per drawing
 * inch, margins, zoom limits. None of it is a building value; nothing here
 * carries a `status`/`note` or belongs in the Review Log. Changing
 * `ELEVATION_PX_PER_IN` changes how big the drawing looks and nothing about
 * what gets built.
 *
 * NOT shared with FootprintCanvas / FoundationCanvas / FloorCanvas, which
 * carry their own copies of the same `CANVAS_WIDTH = 720` problem. Whether
 * all four canvases move together is Tommy's call, not a side effect of
 * fixing one of them — see the note in WallElevationDiagram.
 */

/**
 * The drawing's own internal unit: 1.6 internal SVG px per real inch, used
 * on BOTH axes.
 *
 * **This is the fix to the anisotropy.** It used to be the vertical scale
 * only; horizontal came from `(svgWidthPx - margins) / wallWidthIn` against
 * a hard 720px canvas cap, so past ~33.75ft the horizontal scale fell below
 * the vertical one and panels drew narrow-and-tall — a 60ft wall drew its
 * width at 56% of its height's scale. A fabrication elevation must not lie
 * about proportion, so the cap is gone and one scale serves both axes; the
 * drawing is then sized on screen by `fitHeightScale` x the user's zoom.
 */
export const ELEVATION_PX_PER_IN = 1.6;

/** Room at the left of the drawing for the height tick labels. */
export const ELEVATION_LEFT_MARGIN_PX = 48;
/** Room at the right for the F.F.L label that hangs off the wall's end. */
export const ELEVATION_RIGHT_MARGIN_PX = 24;

/**
 * Breathing room kept around the drawing when it is fitted to the viewport
 * height, so the top dimension callout and the bottom NO PANELS line never
 * sit flush against the editor's edges.
 */
export const ELEVATION_FIT_SLACK_PX = 32;

/** Zoom limits, relative to the fitted view (100% == fits the height). */
export const ELEVATION_MIN_VIEW_SCALE = 0.25;
export const ELEVATION_MAX_VIEW_SCALE = 4;
/** One click of Zoom in / Zoom out. */
export const ELEVATION_ZOOM_STEP = 1.25;

/**
 * Sanity bounds on the fit itself, so a viewport that has not been measured
 * yet (height 0 during the first paint) or an absurdly tall one cannot
 * produce a degenerate drawing.
 */
export const ELEVATION_MIN_FIT_SCALE = 0.1;
export const ELEVATION_MAX_FIT_SCALE = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * The drawing's own internal width, in internal SVG px, at the uniform
 * scale. No cap: the wall is as long as it is, and the viewport scrolls.
 */
export function elevationSvgWidthPx(wallWidthIn: number): number {
  return ELEVATION_LEFT_MARGIN_PX + Math.max(0, wallWidthIn) * ELEVATION_PX_PER_IN + ELEVATION_RIGHT_MARGIN_PX;
}

/**
 * Tommy's chosen default view: the wall's full height fills the available
 * editor height (less slack), and the length scrolls.
 *
 * Returns 1 when the viewport has not been measured yet, so the first paint
 * is the old fixed-scale drawing rather than a collapsed one; the
 * ResizeObserver corrects it on the very next frame.
 */
export function fitHeightScale(viewportHeightPx: number, svgHeightPx: number): number {
  if (!(viewportHeightPx > 0) || !(svgHeightPx > 0)) return 1;
  const usable = viewportHeightPx - ELEVATION_FIT_SLACK_PX;
  if (!(usable > 0)) return ELEVATION_MIN_FIT_SCALE;
  return clamp(usable / svgHeightPx, ELEVATION_MIN_FIT_SCALE, ELEVATION_MAX_FIT_SCALE);
}

/**
 * The size the SVG is actually given on screen: the internal drawing scaled
 * by the fit and then by the user's zoom. Both axes by the SAME factor —
 * that is what keeps every drag handler's ratio exact.
 */
export function renderedDrawingSizePx(args: {
  svgWidthPx: number;
  svgHeightPx: number;
  fitScale: number;
  viewScale: number;
}): { widthPx: number; heightPx: number; displayScale: number } {
  const displayScale = args.fitScale * args.viewScale;
  return {
    widthPx: args.svgWidthPx * displayScale,
    heightPx: args.svgHeightPx * displayScale,
    displayScale,
  };
}

/** One Zoom in / Zoom out click, clamped to the zoom limits. */
export function steppedViewScale(viewScale: number, direction: "in" | "out"): number {
  const next = direction === "in" ? viewScale * ELEVATION_ZOOM_STEP : viewScale / ELEVATION_ZOOM_STEP;
  return clamp(next, ELEVATION_MIN_VIEW_SCALE, ELEVATION_MAX_VIEW_SCALE);
}

/**
 * Wheel zoom. `deltaY < 0` (wheel away from the user) zooms in, matching
 * every map and drawing tool. Exponential in the delta so a trackpad's many
 * small events and a mouse's few large ones feel the same.
 */
export function wheelZoomedViewScale(viewScale: number, deltaY: number): number {
  return clamp(viewScale * Math.exp(-deltaY / 400), ELEVATION_MIN_VIEW_SCALE, ELEVATION_MAX_VIEW_SCALE);
}

/**
 * **The mapping the drag handlers depend on.** Given the SVG's real rendered
 * box on screen, turn a cursor's client X into a position along the wall in
 * inches — exactly as every `handleMove` in WallElevationDiagram does:
 *
 *   pxPerScreenPx = svgWidthPx / rect.width
 *   localPx       = (clientX - rect.left) * pxPerScreenPx
 *   posIn         = (localPx - LEFT_MARGIN) / pxPerIn
 *
 * It is correct at ANY rendered width — that is the whole point: the ratio
 * is re-derived per event from the element's own measured box, so fitting,
 * zooming and scrolling are all invisible to it, PROVIDED the drawing is
 * scaled uniformly (a separate X scale would make `rect.width` the wrong
 * thing to divide by on the Y axis and vice versa).
 */
export function wallPosInFromScreenX(args: {
  clientX: number;
  svgLeftPx: number;
  svgRenderedWidthPx: number;
  svgWidthPx: number;
  wallWidthIn: number;
}): number {
  if (!(args.svgRenderedWidthPx > 0)) return 0;
  const pxPerScreenPx = args.svgWidthPx / args.svgRenderedWidthPx;
  const localPx = (args.clientX - args.svgLeftPx) * pxPerScreenPx;
  return clamp((localPx - ELEVATION_LEFT_MARGIN_PX) / ELEVATION_PX_PER_IN, 0, args.wallWidthIn);
}

/** The inverse: where on screen a given position along the wall is drawn. */
export function screenXFromWallPosIn(args: {
  posIn: number;
  svgLeftPx: number;
  svgRenderedWidthPx: number;
  svgWidthPx: number;
}): number {
  const screenPxPerPx = args.svgRenderedWidthPx / args.svgWidthPx;
  return args.svgLeftPx + (ELEVATION_LEFT_MARGIN_PX + args.posIn * ELEVATION_PX_PER_IN) * screenPxPerPx;
}

/**
 * Wheel-zoom about the pointer: after the scale has changed and the element
 * has been re-measured, how far to move the scroll position so the drawing
 * point that was under the cursor is under it again.
 *
 * `frac*` are the pointer's position within the drawing captured BEFORE the
 * zoom (0..1 of the rendered box); `newLeft`/`newWidth` etc. are the box
 * AFTER it. Adding these to `scrollLeft`/`scrollTop` re-pins the point.
 */
export function zoomAnchorScrollDelta(args: {
  fracX: number;
  fracY: number;
  clientX: number;
  clientY: number;
  newLeftPx: number;
  newTopPx: number;
  newWidthPx: number;
  newHeightPx: number;
}): { dxPx: number; dyPx: number } {
  return {
    dxPx: args.newLeftPx + args.fracX * args.newWidthPx - args.clientX,
    dyPx: args.newTopPx + args.fracY * args.newHeightPx - args.clientY,
  };
}
