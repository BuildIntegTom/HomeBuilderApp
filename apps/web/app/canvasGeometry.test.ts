import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, buildOctagonFootprint } from "@building-integrity/geometry";
import {
  SCALE_PX_PER_FT,
  computeSlotRects,
  cornerMarkerPosition,
  findNearestWall,
  findNearestWallCandidates,
  formatFeetInches,
  nearestPointOnSegments,
  parseLengthFt,
  pickWallByDragDirection,
  projectOntoWallFt,
  signedDepthFt,
  signedPerpOffsetFt,
  snapOctagonBoxPx,
  snapSpanPointFt,
  wallAndPanelSnapLines,
  wallLabelPosition,
  wallPointsPx,
} from "./canvasGeometry";

const ORIGIN = { x: 60, y: 60 };

describe("formatFeetInches / parseLengthFt round-trip", () => {
  it("formats and re-parses whole and fractional feet", () => {
    for (const ft of [0, 1, 20, 40.5, 12.25]) {
      expect(parseLengthFt(formatFeetInches(ft))).toBeCloseTo(ft, 6);
    }
  });

  it("accepts plain decimal feet and rejects garbage", () => {
    expect(parseLengthFt("40.5")).toBeCloseTo(40.5, 6);
    expect(parseLengthFt("")).toBeNull();
    expect(parseLengthFt("not a number")).toBeNull();
  });
});

describe("snapSpanPointFt", () => {
  const wallLengthFt = 30;

  it("snaps flush (0) when within the flush threshold of the start", () => {
    expect(snapSpanPointFt(0.5, wallLengthFt)).toBe(0);
  });

  it("snaps up to the 2ft floor when past flush but still inside the dead zone", () => {
    expect(snapSpanPointFt(1.5, wallLengthFt)).toBe(2);
  });

  it("leaves a point already >= 2ft from both ends untouched", () => {
    expect(snapSpanPointFt(15, wallLengthFt)).toBe(15);
  });

  it("mirrors the same rule at the far end", () => {
    expect(snapSpanPointFt(wallLengthFt - 0.5, wallLengthFt)).toBe(wallLengthFt);
    expect(snapSpanPointFt(wallLengthFt - 1.5, wallLengthFt)).toBe(wallLengthFt - 2);
  });
});

describe("snapOctagonBoxPx", () => {
  it("snaps a near-square box to a perfect square (average of the two)", () => {
    expect(snapOctagonBoxPx(300, 310)).toEqual({ widthPx: 305, heightPx: 305 });
  });

  it("leaves a clearly elongated box untouched", () => {
    expect(snapOctagonBoxPx(400, 200)).toEqual({ widthPx: 400, heightPx: 200 });
  });
});

describe("findNearestWall / projectOntoWallFt", () => {
  const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20)

  it("picks the nearest wall within tolerance and clamps along-wall distance to the segment", () => {
    // Top wall AB runs from px (60,60) to (420,60).
    const found = findNearestWall({ x: 240, y: 65 }, fp, ORIGIN);
    expect(found?.wall.id).toBe("AB");
    expect(found?.alongFt).toBeCloseTo(15, 1);
  });

  it("returns null when the point is farther than the pick tolerance from every wall", () => {
    expect(findNearestWall({ x: 240, y: 200 }, fp, ORIGIN)).toBeNull();
  });

  it("projects and clamps a point beyond the wall's end to the segment boundary", () => {
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    const beyondEnd = { x: 60 + 30 * SCALE_PX_PER_FT + 500, y: 60 };
    expect(projectOntoWallFt(beyondEnd, wallAB, fp.corners, ORIGIN)).toBeCloseTo(30, 6);
  });
});

describe("findNearestWallCandidates / pickWallByDragDirection (corner-ambiguity fix)", () => {
  // Corner A sits at px (60,60): wall AB runs right from it (horizontal),
  // wall DA runs down to it from D (vertical) — the same 2 walls a real
  // bump-out drag near this corner has to disambiguate between.
  const fp = buildRectangleFootprint(30, 20);

  it("near a corner, raw closest-distance can favor the perpendicular wall over the intended one", () => {
    // 3px right, 8px down from the corner: closer to DA's vertical line
    // (dist 3) than AB's horizontal line (dist 8) — this is the exact
    // click that reproduced "selection follows perpendicular, not the
    // perimeter" (Tommy's bug report).
    const candidates = findNearestWallCandidates({ x: 63, y: 68 }, fp, ORIGIN);
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates[0]!.wall.id).toBe("DA");
  });

  it("a horizontal drag from that same ambiguous point resolves to the horizontal wall (AB), not DA", () => {
    const downPos = { x: 63, y: 68 };
    const candidates = findNearestWallCandidates(downPos, fp, ORIGIN);
    const dragged = { x: 250, y: 68 }; // purely horizontal movement
    const chosen = pickWallByDragDirection(downPos, dragged, candidates, fp.corners, ORIGIN);
    expect(chosen.wall.id).toBe("AB");
  });

  it("a vertical drag from the same ambiguous point resolves to the vertical wall (DA)", () => {
    const downPos = { x: 63, y: 68 };
    const candidates = findNearestWallCandidates(downPos, fp, ORIGIN);
    const dragged = { x: 63, y: 200 }; // purely vertical movement
    const chosen = pickWallByDragDirection(downPos, dragged, candidates, fp.corners, ORIGIN);
    expect(chosen.wall.id).toBe("DA");
  });

  it("findNearestWall still returns the single raw-closest wall away from any corner (unchanged behavior)", () => {
    const found = findNearestWall({ x: 240, y: 65 }, fp, ORIGIN);
    expect(found?.wall.id).toBe("AB");
  });
});

describe("signedDepthFt / signedPerpOffsetFt", () => {
  const fp = buildRectangleFootprint(30, 20);
  const wallAB = fp.walls.find((w) => w.id === "AB")!;

  it("signedDepthFt is positive when the point is outward (away from centroid) of the wall", () => {
    // Centroid is below AB (y=60+120=180px); a point above AB (y<60) is outward.
    const depth = signedDepthFt({ x: 240, y: 30 }, wallAB, fp, ORIGIN);
    expect(depth).toBeGreaterThan(0);
    expect(depth).toBeCloseTo(2.5, 1);
  });

  it("signedDepthFt is negative when the point is inward (toward centroid)", () => {
    expect(signedDepthFt({ x: 240, y: 90 }, wallAB, fp, ORIGIN)).toBeLessThan(0);
  });

  it("signedPerpOffsetFt uses a fixed rotate(dir,90deg) convention, NOT centroid-relative 'outward' like signedDepthFt", () => {
    // For AB (dir=(1,0)), perp=(0,1) points *toward* the centroid (which
    // sits below AB) — so signedDepthFt flips it to read "outward" as
    // positive, while signedPerpOffsetFt deliberately does NOT flip,
    // giving the opposite sign for the same point. This is intentional
    // (see the doc comment on signedPerpOffsetFt: dragging a wall inward
    // is just as valid as outward, there's no "outward" to orient by) —
    // a live-dragging user sees this in real time via the preview, so the
    // absolute sign for any one wall doesn't matter for usability. This
    // test just locks in that the two functions are NOT interchangeable.
    const point = { x: 240, y: 30 };
    const depth = signedDepthFt(point, wallAB, fp, ORIGIN);
    const offset = signedPerpOffsetFt(point, wallAB, fp, ORIGIN);
    expect(Math.sign(offset)).toBe(-Math.sign(depth));
  });

  it("signedPerpOffsetFt's sign flips when the point crosses to the other side of the wall", () => {
    const above = signedPerpOffsetFt({ x: 240, y: 30 }, wallAB, fp, ORIGIN);
    const below = signedPerpOffsetFt({ x: 240, y: 90 }, wallAB, fp, ORIGIN);
    expect(Math.sign(above)).toBe(-Math.sign(below));
  });
});

describe("wallLabelPosition / cornerMarkerPosition", () => {
  const fp = buildRectangleFootprint(30, 20);

  it("nudges a wall's label outward from the footprint's centroid", () => {
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    const pos = wallLabelPosition(wallAB, fp.corners, ORIGIN);
    // AB is the top wall; its label should sit above the wall's own px line (y=60).
    expect(pos.y).toBeLessThan(ORIGIN.y);
  });

  it("nudges a corner marker diagonally outward from the centroid", () => {
    const cornerA = fp.corners.find((c) => c.id === "A")!;
    const pos = cornerMarkerPosition(cornerA, fp.corners, ORIGIN);
    // A is the top-left corner; the marker should sit up and to the left of it.
    expect(pos.x).toBeLessThan(cornerA.point.x * SCALE_PX_PER_FT + ORIGIN.x);
    expect(pos.y).toBeLessThan(cornerA.point.y * SCALE_PX_PER_FT + ORIGIN.y);
  });
});

describe("computeSlotRects", () => {
  it("lays out slots end-to-end along a wall, in px, without gaps or overlaps", () => {
    const fp = buildRectangleFootprint(30, 20);
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    const slots = [
      { type: "corner" as const, widthIn: 24 },
      { type: "standard" as const, widthIn: 40 },
      { type: "corner" as const, widthIn: 24 },
    ];
    const rects = computeSlotRects(wallAB, slots, fp, ORIGIN, 0, 15.5);
    expect(rects).toHaveLength(3);
    // Each slot's start should exactly match the previous slot's end (along the wall).
    for (let i = 1; i < rects.length; i++) {
      const prevEndPx = rects[i - 1]!.x + rects[i - 1]!.width;
      expect(rects[i]!.x).toBeCloseTo(prevEndPx, 6);
    }
  });

  it("builds trapezoid points instead of a plain rect for corner slots on a mitered (octagon) shape", () => {
    const fp = buildOctagonFootprint(30, 20);
    const wall = fp.walls.find((w) => w.id === "01")!;
    const slots = [
      { type: "safety-oct-corner" as const, widthIn: 24 },
      { type: "standard" as const, widthIn: 40 },
      { type: "corner" as const, widthIn: 24 },
    ];
    const rects = computeSlotRects(wall, slots, fp, ORIGIN, 0, 15.5);
    expect(rects[0]!.trapezoidPoints).toBeDefined();
    expect(rects[rects.length - 1]!.trapezoidPoints).toBeDefined();
    expect(rects[1]!.trapezoidPoints).toBeUndefined(); // middle standard slot: plain rect
  });
});

describe("wallPointsPx", () => {
  it("converts a wall's ft-space endpoints to px using SCALE_PX_PER_FT and the given offset", () => {
    const fp = buildRectangleFootprint(30, 20);
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    const { startPx, endPx } = wallPointsPx(wallAB, fp.corners, ORIGIN);
    expect(startPx).toEqual({ x: ORIGIN.x, y: ORIGIN.y });
    expect(endPx).toEqual({ x: ORIGIN.x + 30 * SCALE_PX_PER_FT, y: ORIGIN.y });
  });
});

describe("nearestPointOnSegments", () => {
  it("clamps to the segment's own length rather than the infinite line", () => {
    const segments = [{ x1: 0, y1: 0, x2: 100, y2: 0 }];
    // (110,5) is past the segment's x2 end - nearest point is the endpoint (100,0), not (110,0).
    expect(nearestPointOnSegments({ x: 110, y: 5 }, segments)).toEqual({ x: 100, y: 0 });
  });

  it("picks whichever of several segments is actually closest", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 100, y2: 0 }, // horizontal line, y=0
      { x1: 50, y1: 10, x2: 50, y2: 100 }, // vertical line, x=50, starting at y=10
    ];
    // (50,3): distance 3 from the horizontal line, distance 7 from the vertical one.
    expect(nearestPointOnSegments({ x: 50, y: 3 }, segments)).toEqual({ x: 50, y: 0 });
  });

  it("returns null when nothing is within MEASURE_SNAP_TOLERANCE_PX", () => {
    const segments = [{ x1: 0, y1: 0, x2: 100, y2: 0 }];
    expect(nearestPointOnSegments({ x: 50, y: 100 }, segments)).toBeNull();
  });
});

describe("wallAndPanelSnapLines", () => {
  const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20)
  const wallSlots = {
    AB: [{ type: "standard" as const, widthIn: 360 }],
    BC: [{ type: "standard" as const, widthIn: 240 }],
    CD: [{ type: "standard" as const, widthIn: 360 }],
    DA: [{ type: "standard" as const, widthIn: 240 }],
  };
  const wallStartOffsetIn = { AB: 0, BC: 0, CD: 0, DA: 0 };

  it("includes each wall's own exterior edge as a snappable line", () => {
    const segments = wallAndPanelSnapLines(fp, wallSlots, ORIGIN, wallStartOffsetIn, 15);
    expect(segments.length).toBeGreaterThan(0);
    // A point just off the top wall's exterior edge (60,60)-(420,60) should snap onto that line.
    const snapped = nearestPointOnSegments({ x: 240, y: 65 }, segments);
    expect(snapped).not.toBeNull();
    expect(snapped!.y).toBeCloseTo(60, 0);
  });

  it("returns null for a point far from every wall/panel edge", () => {
    const segments = wallAndPanelSnapLines(fp, wallSlots, ORIGIN, wallStartOffsetIn, 15);
    // Dead center of the 30x20 footprint - well clear of all 4 walls.
    expect(nearestPointOnSegments({ x: 240, y: 180 }, segments)).toBeNull();
  });
});
