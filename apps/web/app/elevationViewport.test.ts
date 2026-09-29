import { describe, expect, it } from "vitest";
import {
  ELEVATION_FIT_SLACK_PX,
  ELEVATION_LEFT_MARGIN_PX,
  ELEVATION_MAX_FIT_SCALE,
  ELEVATION_MAX_VIEW_SCALE,
  ELEVATION_MIN_FIT_SCALE,
  ELEVATION_MIN_VIEW_SCALE,
  ELEVATION_PX_PER_IN,
  ELEVATION_RIGHT_MARGIN_PX,
  elevationSvgWidthPx,
  fitHeightScale,
  renderedDrawingSizePx,
  screenXFromWallPosIn,
  steppedViewScale,
  wallPosInFromScreenX,
  wheelZoomedViewScale,
  zoomAnchorScrollDelta,
} from "./elevationViewport";

/**
 * The drawing's internal height, reproduced here the way
 * WallElevationDiagram computes it (TOP_MARGIN + height x px/in + bottom
 * margin), so the fit/rendered-size tests below run on real figures rather
 * than round numbers.
 */
const TOP_MARGIN_PX = 44;
const BOTTOM_MARGIN_PX = 36;
const svgHeightPxFor = (maxHeightIn: number) => TOP_MARGIN_PX + maxHeightIn * ELEVATION_PX_PER_IN + BOTTOM_MARGIN_PX;

describe("elevationSvgWidthPx", () => {
  it("is uncapped — a long wall gets a long drawing, not a 720px one", () => {
    // The old cap: Math.min(720, 48 + wallWidthIn * 1.6 + 24). A 60ft wall
    // pinned at 720 and its horizontal scale collapsed to 0.9 px/in.
    expect(elevationSvgWidthPx(60 * 12)).toBeGreaterThan(720);
    expect(elevationSvgWidthPx(60 * 12)).toBe(ELEVATION_LEFT_MARGIN_PX + 720 * ELEVATION_PX_PER_IN + ELEVATION_RIGHT_MARGIN_PX);
  });

  it("scales the drawing width linearly with the wall's real length", () => {
    const tenFt = elevationSvgWidthPx(10 * 12) - ELEVATION_LEFT_MARGIN_PX - ELEVATION_RIGHT_MARGIN_PX;
    const twentyFt = elevationSvgWidthPx(20 * 12) - ELEVATION_LEFT_MARGIN_PX - ELEVATION_RIGHT_MARGIN_PX;
    expect(twentyFt).toBeCloseTo(tenFt * 2, 9);
  });
});

/**
 * ⚠ THE POINT OF THE WHOLE CHANGE. The horizontal scale used to be
 * `(svgWidthPx - margins) / wallWidthIn`, which equals 1.6 only while the
 * 720px cap is not binding; past ~33.75ft it fell away and the drawing
 * stopped telling the truth about proportion.
 */
describe("the scale is uniform on both axes at every wall length", () => {
  for (const lengthFt of [8, 20, 33.75, 34, 48, 60, 120]) {
    it(`${lengthFt}ft draws its width at the same px/in as its height`, () => {
      const wallWidthIn = lengthFt * 12;
      const drawnWidthPx = elevationSvgWidthPx(wallWidthIn) - ELEVATION_LEFT_MARGIN_PX - ELEVATION_RIGHT_MARGIN_PX;
      expect(drawnWidthPx / wallWidthIn).toBeCloseTo(ELEVATION_PX_PER_IN, 12);
    });
  }

  it("a square opening on a 60ft wall is square, which it was not before", () => {
    const wallWidthIn = 60 * 12;
    const oldSvgWidthPx = Math.min(720, ELEVATION_LEFT_MARGIN_PX + wallWidthIn * ELEVATION_PX_PER_IN + 24);
    const oldScaleX = (oldSvgWidthPx - ELEVATION_LEFT_MARGIN_PX - 24) / wallWidthIn;
    // The recorded distortion: horizontal was 56% of vertical.
    expect(oldScaleX / ELEVATION_PX_PER_IN).toBeLessThan(0.6);

    const newDrawnWidthPx = elevationSvgWidthPx(wallWidthIn) - ELEVATION_LEFT_MARGIN_PX - ELEVATION_RIGHT_MARGIN_PX;
    const newScaleX = newDrawnWidthPx / wallWidthIn;
    const a36inSquare = { widthPx: 36 * newScaleX, heightPx: 36 * ELEVATION_PX_PER_IN };
    expect(a36inSquare.widthPx).toBeCloseTo(a36inSquare.heightPx, 9);
  });
});

describe("fitHeightScale", () => {
  it("fills the available editor height, less slack", () => {
    const svgHeightPx = svgHeightPxFor(120); // a one-story 10ft wall: 272px
    expect(svgHeightPx).toBeCloseTo(272, 9);
    const fit = fitHeightScale(800, svgHeightPx);
    expect(svgHeightPx * fit).toBeCloseTo(800 - ELEVATION_FIT_SLACK_PX, 9);
  });

  it("returns 1 before the viewport has been measured", () => {
    expect(fitHeightScale(0, svgHeightPxFor(120))).toBe(1);
  });

  it("clamps rather than producing a degenerate drawing", () => {
    expect(fitHeightScale(ELEVATION_FIT_SLACK_PX, svgHeightPxFor(120))).toBe(ELEVATION_MIN_FIT_SCALE);
    expect(fitHeightScale(100_000, svgHeightPxFor(120))).toBe(ELEVATION_MAX_FIT_SCALE);
  });

  it("a taller wall fits smaller, so both fill the same height", () => {
    const oneStory = svgHeightPxFor(120);
    const twoStoryWithGable = svgHeightPxFor(120 + 108 + 96);
    const viewportHeightPx = 760;
    expect(oneStory * fitHeightScale(viewportHeightPx, oneStory)).toBeCloseTo(
      twoStoryWithGable * fitHeightScale(viewportHeightPx, twoStoryWithGable),
      9,
    );
  });
});

describe("renderedDrawingSizePx", () => {
  it("scales both axes by the same factor", () => {
    const svgWidthPx = elevationSvgWidthPx(20 * 12);
    const svgHeightPx = svgHeightPxFor(120);
    const fitScale = fitHeightScale(800, svgHeightPx);
    const r = renderedDrawingSizePx({ svgWidthPx, svgHeightPx, fitScale, viewScale: 1.75 });
    expect(r.widthPx / svgWidthPx).toBeCloseTo(r.heightPx / svgHeightPx, 12);
    expect(r.displayScale).toBeCloseTo(fitScale * 1.75, 12);
  });

  it("a 20ft one-story wall stops being 456x272 in a fullscreen editor", () => {
    const svgWidthPx = elevationSvgWidthPx(20 * 12);
    const svgHeightPx = svgHeightPxFor(120);
    const before = { widthPx: 456, heightPx: 272 };
    const after = renderedDrawingSizePx({
      svgWidthPx,
      svgHeightPx,
      fitScale: fitHeightScale(800, svgHeightPx),
      viewScale: 1,
    });
    expect(after.heightPx).toBeCloseTo(768, 9);
    expect(after.heightPx).toBeGreaterThan(before.heightPx * 2.8);
    expect(after.widthPx).toBeGreaterThan(before.widthPx * 2.8);
  });
});

describe("zoom stepping", () => {
  it("steps in and out and clamps at the limits", () => {
    expect(steppedViewScale(1, "in")).toBeCloseTo(1.25, 12);
    expect(steppedViewScale(1, "out")).toBeCloseTo(0.8, 12);
    expect(steppedViewScale(ELEVATION_MAX_VIEW_SCALE, "in")).toBe(ELEVATION_MAX_VIEW_SCALE);
    expect(steppedViewScale(ELEVATION_MIN_VIEW_SCALE, "out")).toBe(ELEVATION_MIN_VIEW_SCALE);
  });

  it("wheel away from the user zooms in, toward zooms out, and both clamp", () => {
    expect(wheelZoomedViewScale(1, -100)).toBeGreaterThan(1);
    expect(wheelZoomedViewScale(1, 100)).toBeLessThan(1);
    expect(wheelZoomedViewScale(1, -100_000)).toBe(ELEVATION_MAX_VIEW_SCALE);
    expect(wheelZoomedViewScale(1, 100_000)).toBe(ELEVATION_MIN_VIEW_SCALE);
  });

  it("is symmetric: an equal-and-opposite wheel returns to where it started", () => {
    expect(wheelZoomedViewScale(wheelZoomedViewScale(1, -120), 120)).toBeCloseTo(1, 12);
  });
});

/**
 * ⚠ THE DRAG-SAFETY PROOF, the unit half of it. The browser half is
 * `smearforn-stage-0-1`, which drags real panel boundaries at two different
 * zoom levels against the real app. This half pins the arithmetic: a point
 * drawn at N inches along the wall must read back as N inches when the
 * cursor is over it, at ANY rendered width.
 */
describe("screen <-> wall-inches round trip, at every zoom the UI can reach", () => {
  const wallLengthsFt = [10, 20, 48, 60];
  const viewScales = [ELEVATION_MIN_VIEW_SCALE, 0.5, 1, 1.25, 1.953125, 3, ELEVATION_MAX_VIEW_SCALE];

  for (const lengthFt of wallLengthsFt) {
    for (const viewScale of viewScales) {
      it(`${lengthFt}ft wall at ${Math.round(viewScale * 100)}% zoom`, () => {
        const wallWidthIn = lengthFt * 12;
        const svgWidthPx = elevationSvgWidthPx(wallWidthIn);
        const svgHeightPx = svgHeightPxFor(120);
        const fitScale = fitHeightScale(800, svgHeightPx);
        const { widthPx } = renderedDrawingSizePx({ svgWidthPx, svgHeightPx, fitScale, viewScale });
        // An arbitrary, deliberately un-round element left edge: the drawing
        // is scrolled and centred, so its box can start anywhere.
        const svgLeftPx = -137.4;

        for (const posIn of [0, 0.125, 25.5, 40, wallWidthIn / 3, wallWidthIn - 24, wallWidthIn]) {
          const screenX = screenXFromWallPosIn({ posIn, svgLeftPx, svgRenderedWidthPx: widthPx, svgWidthPx });
          const back = wallPosInFromScreenX({ clientX: screenX, svgLeftPx, svgRenderedWidthPx: widthPx, svgWidthPx, wallWidthIn });
          expect(back).toBeCloseTo(posIn, 6);
        }
      });
    }
  }

  it("clamps a cursor dragged off either end of the wall", () => {
    const wallWidthIn = 20 * 12;
    const svgWidthPx = elevationSvgWidthPx(wallWidthIn);
    const common = { svgLeftPx: 0, svgRenderedWidthPx: svgWidthPx * 2, svgWidthPx, wallWidthIn };
    expect(wallPosInFromScreenX({ clientX: -5000, ...common })).toBe(0);
    expect(wallPosInFromScreenX({ clientX: 5000, ...common })).toBe(wallWidthIn);
  });

  it("a one-screen-pixel cursor move is a FINER inch step the more you zoom in", () => {
    const wallWidthIn = 48 * 12;
    const svgWidthPx = elevationSvgWidthPx(wallWidthIn);
    const svgHeightPx = svgHeightPxFor(120);
    const fitScale = fitHeightScale(800, svgHeightPx);
    const inchesPerScreenPxAt = (viewScale: number) => {
      const { widthPx } = renderedDrawingSizePx({ svgWidthPx, svgHeightPx, fitScale, viewScale });
      // Mid-drawing, so neither sample is clamped at an end of the wall.
      const mid = widthPx / 2;
      const a = wallPosInFromScreenX({ clientX: mid, svgLeftPx: 0, svgRenderedWidthPx: widthPx, svgWidthPx, wallWidthIn });
      const b = wallPosInFromScreenX({ clientX: mid + 1, svgLeftPx: 0, svgRenderedWidthPx: widthPx, svgWidthPx, wallWidthIn });
      return b - a;
    };
    expect(inchesPerScreenPxAt(2)).toBeLessThan(inchesPerScreenPxAt(1));
    expect(inchesPerScreenPxAt(1)).toBeLessThan(inchesPerScreenPxAt(0.5));
  });
});

describe("zoomAnchorScrollDelta", () => {
  it("re-pins the drawing point that was under the cursor", () => {
    // Cursor at client x=500 over a box that runs 100..900 -> fraction 0.5.
    const fracX = (500 - 100) / 800;
    const fracY = (300 - 50) / 500;
    // After a 2x zoom the box is twice as wide and, being centred/scrolled,
    // now starts at -300.
    const { dxPx, dyPx } = zoomAnchorScrollDelta({
      fracX,
      fracY,
      clientX: 500,
      clientY: 300,
      newLeftPx: -300,
      newTopPx: -200,
      newWidthPx: 1600,
      newHeightPx: 1000,
    });
    // Applying the delta to scrollLeft/scrollTop moves the box by -delta,
    // which puts the same fractional point back under the cursor.
    expect(-300 + fracX * 1600 - dxPx).toBeCloseTo(500, 9);
    expect(-200 + fracY * 1000 - dyPx).toBeCloseTo(300, 9);
  });

  it("is a no-op when nothing moved", () => {
    const d = zoomAnchorScrollDelta({
      fracX: 0.25,
      fracY: 0.75,
      clientX: 100 + 0.25 * 800,
      clientY: 50 + 0.75 * 500,
      newLeftPx: 100,
      newTopPx: 50,
      newWidthPx: 800,
      newHeightPx: 500,
    });
    expect(d.dxPx).toBeCloseTo(0, 9);
    expect(d.dyPx).toBeCloseTo(0, 9);
  });
});
