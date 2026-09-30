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
 * `wallPosInFromScreenX` below is that mapping, and **all four X-axis drag
 * effects in WallElevationDiagram now CALL it** rather than inlining the same
 * three lines, so `elevationViewport.test.ts` is pinning the real handlers
 * and not a copy of them.
 *
 * ⚠ It was a copy for one day, and the difference was not cosmetic: the
 * extracted version clamped to `[0, wallWidthIn]` and the panel-boundary
 * handler deliberately does not (it needs positions past `pairStartIn` /
 * `pairEndIn` for the mid-drag role handoff). A test suite over a clamping
 * copy could not have caught a change to the non-clamping original. Hence
 * `clampToWall`, opt-in per call site — three drags pass it, the panel
 * boundary does not.
 *
 * ⚠ Every number in this file is a SCREEN measurement — pixels per drawing
 * inch, margins, zoom limits. None of it is a building value; nothing here
 * carries a `status`/`note` or belongs in the Review Log. Changing
 * `ELEVATION_PX_PER_IN` changes how big the drawing looks and nothing about
 * what gets built.
 *
 * NOT shared with the app's other drawing surfaces, which carry their own
 * copies of the same `CANVAS_WIDTH = 720` problem. **There are FIVE of them,
 * not the "four canvases" an earlier version of this note claimed:**
 * `FootprintCanvas` (720x480), `FoundationCanvas` (720x480), `FloorCanvas`
 * (720x480), `RoofTrussLayoutView` (720) and `Building3DView` (720x480).
 * Whether they all move to a fitted, scrollable viewport together is Tommy's
 * call, not a side effect of fixing one of them — see the note in
 * WallElevationDiagram.
 */

/**
 * ⚠ FOR THE SPEC ENTRY THAT STILL OWES THIS CHANGE A WRITE-UP. It is not
 * written here because three agents were editing `building_integrity_app_spec.md`
 * on 2026-09-29 and a fourth would have manufactured a conflict; these are the
 * three things it owes, measured rather than remembered, so they are not lost:
 *
 * 1. **THE ROOT CAUSE WAS NOT THE 720px CAP.** The cap made long walls draw
 *    anisotropically (point 3), but it is not why Tommy's elevations were
 *    tiny. The SVG was a SHRINK-TO-FIT FLEX ITEM: measured before the fix, at
 *    1280x800, 1600x900 and 1920x1080, EVERY wall rendered exactly
 *    **300px wide** inside a canvas layer 870 / 1190 / 1510px wide — including
 *    a 12'-6" wall whose own internal drawing is 312px and never touches the
 *    720 cap. Height used: 11-16% of the available layer on a 48ft wall.
 *    Removing the cap alone would have changed nothing a user could see.
 *    After: 96-97% of the available height, at every one of those viewports.
 * 2. **The elevation no longer lies about proportion past 33.75ft.** That
 *    figure is exact, not approximate: the old horizontal scale was
 *    `(720 - 72) / wallWidthIn`, which equals the fixed vertical 1.6px/in at
 *    exactly 405in = 33.75ft. Past it the drawing got narrower than it was
 *    tall — the measured 48'-4" ADU wall drew its width at 1.117px/in against
 *    a vertical 1.6px/in, i.e. **70%**, so a square window drew as a portrait
 *    rectangle on a fabrication drawing.
 * 3. **Five surfaces still have the 720 problem, not four** — the list is in
 *    WallElevationDiagram's header and in this file's own, and it is the thing
 *    the next coder inherits.
 */

/**
 * The drawing's own internal unit: 1.6 internal SVG px per real inch, used
 * on BOTH axes.
 *
 * **This is the fix to the anisotropy.** It used to be the vertical scale
 * only; horizontal came from `(svgWidthPx - margins) / wallWidthIn` against
 * a hard 720px canvas cap, so past 33.75ft exactly — where
 * `(720 - 72) / wallWidthIn` crosses 1.6 — the horizontal scale fell below
 * the vertical one and panels drew narrow-and-tall: 70% on the measured
 * 48'-4" ADU wall, 56% on a 60ft one. A fabrication elevation must not lie
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
 *
 * ⚠ **It is also, silently, the horizontal scrollbar's budget, and that is a
 * coupling rather than a coincidence.** The viewport is measured on its
 * BORDER box (see the ResizeObserver in WallElevationDiagram) so that a
 * scrollbar appearing cannot feed back into the fit and oscillate. The cost
 * of that choice is that the scrollbar eats into the same space this slack
 * provides: measured on Chrome/Windows the default view leaves 17px spare
 * against a 15px scrollbar, i.e. 2px of margin. A THICKER scrollbar — an
 * accessibility setting, a different platform, a future browser default —
 * therefore puts a spurious VERTICAL scrollbar on a view that is supposed to
 * fit exactly. If that shows up, this number is the one to raise (or the fit
 * has to subtract a measured `offsetHeight - clientHeight` instead).
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
 * **The mapping the drag handlers run** — not a restatement of it. All four
 * X-axis `handleMove`s in WallElevationDiagram call this function:
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
 *
 * **`clampToWall` is opt-in because one caller must NOT clamp.** The gable
 * profile point, the Box Beam coverage handle and the Mid-Wall Bond Beam
 * coverage handle all want a position inside the wall and pass `true`. The
 * panel-boundary drag passes nothing: `resolvePanelBoundaryDrag` is handed a
 * raw cursor position and is entitled to see it beyond `pairStartIn` /
 * `pairEndIn`, because that overshoot is exactly what triggers the floor snap
 * and the mid-drag role handoff. Clamping it would quietly disable the
 * handoff at the ends of a wall.
 *
 * `ELEVATION_PX_PER_IN` is the divisor here and `scaleX` is the multiplier in
 * the drawing; they are the same constant by construction (`const scaleX =
 * PX_PER_IN`), which is the property the uniform-scale tests pin.
 */
export function wallPosInFromScreenX(args: {
  clientX: number;
  svgLeftPx: number;
  svgRenderedWidthPx: number;
  svgWidthPx: number;
  wallWidthIn: number;
  clampToWall?: boolean;
}): number {
  if (!(args.svgRenderedWidthPx > 0)) return 0;
  const pxPerScreenPx = args.svgWidthPx / args.svgRenderedWidthPx;
  const localPx = (args.clientX - args.svgLeftPx) * pxPerScreenPx;
  const posIn = (localPx - ELEVATION_LEFT_MARGIN_PX) / ELEVATION_PX_PER_IN;
  return args.clampToWall ? clamp(posIn, 0, args.wallWidthIn) : posIn;
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
