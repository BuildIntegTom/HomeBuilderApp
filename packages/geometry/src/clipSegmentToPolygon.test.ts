import { describe, expect, it } from "vitest";
import { clipSegmentToPolygon } from "./clipSegmentToPolygon";
import type { Point } from "./types";

const p = (x: number, y: number): Point => ({ x, y });

/** A 10x10 square, and the same square with a 4-wide notch cut 6 deep into
 * its LEFT edge — the shape that genuinely splits a vertical segment in two. */
const SQUARE = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];
const LEFT_NOTCHED = [p(0, 0), p(10, 0), p(10, 10), p(0, 10), p(0, 7), p(6, 7), p(6, 3), p(0, 3)];

const spanLength = (s: { start: Point; end: Point }) => Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);

describe("clipSegmentToPolygon", () => {
  it("returns a fully-interior segment unchanged, to the bit", () => {
    const start = p(2, 3);
    const end = p(7, 3);
    const spans = clipSegmentToPolygon(start, end, SQUARE);
    expect(spans).toEqual([{ start, end }]);
  });

  it("returns nothing for a segment entirely outside", () => {
    expect(clipSegmentToPolygon(p(-5, 5), p(-1, 5), SQUARE)).toEqual([]);
    expect(clipSegmentToPolygon(p(1, 5), p(5, 5), LEFT_NOTCHED)).toEqual([]); // inside the notch
  });

  it("trims a segment that hangs out of one side", () => {
    const spans = clipSegmentToPolygon(p(-4, 5), p(6, 5), SQUARE);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.start.x).toBeCloseTo(0, 12);
    expect(spans[0]!.end).toEqual(p(6, 5));
  });

  it("returns SEVERAL spans where a notch cuts one segment in two", () => {
    const spans = clipSegmentToPolygon(p(3, -2), p(3, 12), LEFT_NOTCHED);
    expect(spans).toHaveLength(2);
    expect(spans[0]!.start.y).toBeCloseTo(0, 12);
    expect(spans[0]!.end.y).toBeCloseTo(3, 12);
    expect(spans[1]!.start.y).toBeCloseTo(7, 12);
    expect(spans[1]!.end.y).toBeCloseTo(10, 12);
    // Ordered along the segment, so a caller's span index is deterministic.
    expect(spans[0]!.start.y).toBeLessThan(spans[1]!.start.y);
  });

  it("treats the boundary as INSIDE: a segment lying exactly along an edge is kept in full", () => {
    // Load-bearing for computeFieldFramingLayout — on every rectangle its
    // outermost field lines sit exactly on the inset polygon's own edge, and
    // an outside-the-boundary reading would silently delete them.
    const start = p(0, 1);
    const end = p(0, 9);
    expect(clipSegmentToPolygon(start, end, SQUARE)).toEqual([{ start, end }]);
    // ...including the case where the collinear edge is only PART of the run.
    const long = clipSegmentToPolygon(p(0, -3), p(0, 13), SQUARE);
    expect(long).toHaveLength(1);
    expect(long[0]!.start.y).toBeCloseTo(0, 12);
    expect(long[0]!.end.y).toBeCloseTo(10, 12);
  });

  it("drops a segment that only grazes a convex vertex from outside", () => {
    // The line x = 10 touches the square's right edge, which IS the boundary,
    // so that one is kept; a true single-vertex graze is a diamond's corner.
    const diamond = [p(5, 0), p(10, 5), p(5, 10), p(0, 5)];
    expect(clipSegmentToPolygon(p(10, -5), p(10, 15), diamond)).toEqual([]);
  });

  it("does not split a span at a breakpoint that never changed inside/outside", () => {
    // The vertical line x = 6 passes exactly through the notch's two reflex
    // corners. Every crossing there is a breakpoint, but the polygon is on the
    // inside the whole way down, so this must come back as ONE span, not three
    // — the degeneracy that a ring clipper turns into a collinear spike.
    const spans = clipSegmentToPolygon(p(6, 0), p(6, 10), LEFT_NOTCHED);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.start).toEqual(p(6, 0));
    expect(spans[0]!.end).toEqual(p(6, 10));
  });

  it("never emits a zero-length span", () => {
    const shapes = [SQUARE, LEFT_NOTCHED];
    for (const shape of shapes) {
      for (let x = -1; x <= 11; x += 0.25) {
        for (const span of clipSegmentToPolygon(p(x, -3), p(x, 13), shape)) {
          expect(spanLength(span)).toBeGreaterThan(0);
        }
      }
    }
  });

  it("returns nothing for degenerate inputs", () => {
    expect(clipSegmentToPolygon(p(2, 2), p(2, 2), SQUARE)).toEqual([]); // zero-length segment
    expect(clipSegmentToPolygon(p(0, 2), p(9, 2), [p(0, 0), p(1, 1)])).toEqual([]); // not a polygon
  });

  it("is winding-agnostic", () => {
    const cw = [...SQUARE].reverse();
    expect(clipSegmentToPolygon(p(-4, 5), p(6, 5), cw)).toEqual(clipSegmentToPolygon(p(-4, 5), p(6, 5), SQUARE));
  });
});
