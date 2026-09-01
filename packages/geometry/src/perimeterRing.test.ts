import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import { dragWallBounded, dragWallWithCollapse } from "./dragWall";
import { editWallLength } from "./editWallLength";
import { isPointInPolygon } from "./pointInPolygon";
import {
  computeFieldFramingLayout,
  computeInsetFootprintPolygon,
  computeInsetPerimeterRing,
  type FieldFramingLine,
  type PerimeterRingSegment,
} from "./perimeterRing";
import type { Footprint, Point } from "./types";

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
// A doubled 2x4 ring's own width (2 x PLATE_2X4_THICKNESS_IN). Hardcoded
// because packages/geometry is dependency-free by design and can't import
// the catalog. Only a representative inset for these direction tests — the
// live ones (0/1.5 and 12.5/14 at the 15.5in default) come from
// baleFoundationRingPlan in packages/panel-catalog.
const RING_INSET_IN = 3;

/**
 * The exact pre-fix algorithm — a vertex-averaged "centroid" deciding each
 * wall's inward side — kept here as the thing being compared against, so
 * "unchanged on convex footprints" and "fixed on notched ones" are both
 * asserted against the real old behavior rather than against hand-copied
 * numbers.
 */
function legacyCentroidRing(footprint: Footprint, insetIn: number, primaryCornerIds: Set<string>): PerimeterRingSegment[] {
  const centroid = {
    x: footprint.corners.reduce((sum, c) => sum + c.point.x, 0) / footprint.corners.length,
    y: footprint.corners.reduce((sum, c) => sum + c.point.y, 0) / footprint.corners.length,
  };
  // Reuses the real function for everything except the direction decision:
  // any wall the old heuristic sent the other way gets its offset mirrored
  // back across that wall's own exterior line.
  return computeInsetPerimeterRing(footprint, insetIn, primaryCornerIds).map((seg) => {
    const wall = footprint.walls.find((w) => w.id === seg.wallId)!;
    const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
    const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const len = Math.hypot(dx, dz) || 1;
    const perp = { x: -dz / len, y: dx / len };
    const midX = (start.x + end.x) / 2;
    const midZ = (start.y + end.y) / 2;
    const pointsInward = perp.x * (centroid.x - midX) + perp.y * (centroid.y - midZ) >= 0;
    if (pointsInward) return seg;
    const mirror = (p: Point): Point => {
      const d = (p.x - midX) * perp.x + (p.y - midZ) * perp.y;
      return { x: p.x - 2 * d * perp.x, y: p.y - 2 * d * perp.y };
    };
    const center = mirror({ x: seg.centerX, y: seg.centerZ });
    return { ...seg, startPoint: mirror(seg.startPoint), endPoint: mirror(seg.endPoint), centerX: center.x, centerZ: center.y };
  });
}

const polygonOf = (fp: Footprint): Point[] => fp.corners.map((c) => c.point);

/**
 * Real-geometry check: sample along each ring segment and ask the footprint
 * polygon itself whether the point is inside. Deliberately NOT a re-read of
 * the inset the builder just wrote — a segment offset the wrong way carries
 * exactly the same `insetIn`, and only its position gives it away. Segment
 * ENDS are excluded from the sampling: at a convex corner the ring runs out
 * to the exterior line itself, so the endpoint sits exactly on the boundary,
 * where a ray cast is ambiguous by definition. (Reflex corners are NOT the
 * reason — a reflex extension stops at the intersection of the two inward-
 * offset lines, which is strictly inside the polygon.) The exclusion can't
 * mask the bug this exists to catch: a flipped segment is outside at every
 * interior sample, not just at its ends.
 */
function segmentSamplesOutside(fp: Footprint, segments: PerimeterRingSegment[]): string[] {
  const polygon = polygonOf(fp);
  const outside: string[] = [];
  for (const seg of segments) {
    for (let t = 0.05; t <= 0.951; t += 0.05) {
      const p = {
        x: seg.startPoint.x + (seg.endPoint.x - seg.startPoint.x) * t,
        y: seg.startPoint.y + (seg.endPoint.y - seg.startPoint.y) * t,
      };
      if (!isPointInPolygon(p, polygon)) {
        outside.push(`${seg.wallId}@t=${t.toFixed(2)}`);
        break;
      }
    }
  }
  return outside;
}

function signedArea2x(fp: Footprint): number {
  const pts = polygonOf(fp);
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

describe("computeInsetPerimeterRing", () => {
  it("offsets every wall of a rectangle inward by the inset, keeping length and rotation", () => {
    const fp = buildRectangleFootprint(40, 30);
    const ring = computeInsetPerimeterRing(fp, 6, allPrimary(fp)); // 6in = 0.5ft
    const byId = new Map(ring.map((s) => [s.wallId, s]));
    expect(byId.get("AB")!.centerZ).toBeCloseTo(0.5, 9); // top wall moves down (+y)
    expect(byId.get("CD")!.centerZ).toBeCloseTo(29.5, 9); // bottom wall moves up
    expect(byId.get("BC")!.centerX).toBeCloseTo(39.5, 9); // right wall moves left
    expect(byId.get("DA")!.centerX).toBeCloseTo(0.5, 9); // left wall moves right
    expect(byId.get("AB")!.lengthFt).toBeCloseTo(40, 9);
    expect(byId.get("BC")!.lengthFt).toBeCloseTo(30, 9);
    expect(byId.get("AB")!.rotationRad).toBeCloseTo(0, 9);
    expect(byId.get("BC")!.rotationRad).toBeCloseTo(Math.PI / 2, 9);
  });

  it("keeps every segment inside the footprint on a rectangle and an octagon", () => {
    const shapes = [buildRectangleFootprint(40, 30), buildRectangleFootprint(30, 40), buildOctagonFootprint(40, 30), buildOctagonFootprint(30, 30)];
    for (const fp of shapes) {
      for (const insetIn of [RING_INSET_IN, 15.5, 30]) {
        expect(segmentSamplesOutside(fp, computeInsetPerimeterRing(fp, insetIn, allPrimary(fp)))).toEqual([]);
      }
    }
  });

  it("extends exactly one wall of each reflex right-angle corner by the inset", () => {
    const rect = buildRectangleFootprint(40, 30);
    const { footprint, primaryCornerIds } = insertBumpOut(rect, "CD", 23, 40, -8, allPrimary(rect)); // notch out of the bottom-left corner
    const ring = computeInsetPerimeterRing(footprint, 6, primaryCornerIds);
    const totalExtraFt = ring.reduce((sum, seg) => sum + (seg.lengthFt - footprint.walls.find((w) => w.id === seg.wallId)!.lengthFt), 0);
    const reflexCorners = 1; // an L-shape has exactly one inside corner
    expect(totalExtraFt).toBeCloseTo(reflexCorners * 0.5, 9);
  });

  it("is bit-identical to the old centroid heuristic on convex footprints (this fix is a visible no-op there)", () => {
    const shapes = [buildRectangleFootprint(40, 30), buildRectangleFootprint(30, 40), buildOctagonFootprint(40, 30), buildOctagonFootprint(30, 30)];
    for (const fp of shapes) {
      for (const insetIn of [0, RING_INSET_IN, 12.5, 15.5]) {
        expect(computeInsetPerimeterRing(fp, insetIn, allPrimary(fp))).toEqual(legacyCentroidRing(fp, insetIn, allPrimary(fp)));
      }
    }
  });
});

describe("regression: ring direction stays inward after a bump-out skews a naive vertex average", () => {
  // Mirrors bumpOut.test.ts's own regression (bumpOut.test.ts:204). Tommy,
  // on the bale foundation: "i see the floor framing on bump outs has a
  // similar problem - and also is spawned wrong." A vertex-averaged
  // "centroid" always lies inside the convex hull, so it never misjudges a
  // hull wall — but a notch's 4 tightly-clustered new corners drag it far
  // enough sideways to land on the wrong side of an UNRELATED notch's wall
  // elsewhere on the building, and that wall's whole ring segment then gets
  // offset outward, into open air outside the building.
  function twoNotchFootprint() {
    // Notch 1: bottom-left, 19ft wide x 8ft deep, flush with the left wall.
    const rect = buildRectangleFootprint(40, 30);
    const first = insertBumpOut(rect, "CD", 21, 40, -8, allPrimary(rect));
    // Notch 2: top-left, 10ft wide x 13ft deep — unrelated to notch 1, and
    // its corner cluster is what drags the vertex average.
    const topWall = first.footprint.walls.find((w) => {
      const s = first.footprint.corners.find((c) => c.id === w.startCorner)!.point;
      const e = first.footprint.corners.find((c) => c.id === w.endCorner)!.point;
      return s.y === 0 && e.y === 0 && e.x > s.x;
    })!;
    return { first, second: insertBumpOut(first.footprint, topWall.id, 0, 10, -13, first.primaryCornerIds) };
  }

  it("keeps every ring segment inside a two-notch footprint the old heuristic got wrong", () => {
    const { first, second } = twoNotchFootprint();

    // With only notch 1 present, the old heuristic and the fix agree — every
    // segment is inside either way. Nothing about notch 1 is the problem.
    const oneNotch = computeInsetPerimeterRing(first.footprint, RING_INSET_IN, first.primaryCornerIds);
    expect(segmentSamplesOutside(first.footprint, oneNotch)).toEqual([]);
    expect(segmentSamplesOutside(first.footprint, legacyCentroidRing(first.footprint, RING_INSET_IN, first.primaryCornerIds))).toEqual([]);

    // Adding the second, unrelated notch drags the vertex average sideways
    // past notch 1's own wall, flipping THAT wall's ring segment outward.
    const fp = second.footprint;
    expect(segmentSamplesOutside(fp, computeInsetPerimeterRing(fp, RING_INSET_IN, second.primaryCornerIds))).toEqual([]);
    const legacy = legacyCentroidRing(fp, RING_INSET_IN, second.primaryCornerIds);
    expect(segmentSamplesOutside(fp, legacy).length).toBeGreaterThan(0); // documents the bug being fixed
  });

  it("keeps every ring segment inside a deep, wide single notch at every inset the foundation uses", () => {
    const rect = buildRectangleFootprint(40, 30);
    const { footprint, primaryCornerIds } = insertBumpOut(rect, "AB", 5, 35, -12, allPrimary(rect));
    for (const insetIn of [RING_INSET_IN, 12.5, 15.5]) {
      expect(segmentSamplesOutside(footprint, computeInsetPerimeterRing(footprint, insetIn, primaryCornerIds))).toEqual([]);
    }
    // The old heuristic sent this notch's own walls outward, into the notch.
    expect(segmentSamplesOutside(footprint, legacyCentroidRing(footprint, RING_INSET_IN, primaryCornerIds)).length).toBeGreaterThan(0);
  });

  it("keeps every ring segment inside an outward bump-out and a U-shape", () => {
    const rect = buildRectangleFootprint(40, 30);
    const bump = insertBumpOut(rect, "AB", 5, 20, -6, allPrimary(rect)); // outward addition off the top wall
    expect(segmentSamplesOutside(bump.footprint, computeInsetPerimeterRing(bump.footprint, RING_INSET_IN, bump.primaryCornerIds))).toEqual([]);

    const notch1 = insertBumpOut(rect, "AB", 4, 12, -10, allPrimary(rect)); // notch cut into the top wall
    const topRight = notch1.footprint.walls.find((w) => {
      const s = notch1.footprint.corners.find((c) => c.id === w.startCorner)!.point;
      const e = notch1.footprint.corners.find((c) => c.id === w.endCorner)!.point;
      return s.y === 0 && e.y === 0 && e.x - s.x > 15; // the long remainder of the top wall
    })!;
    const uShape = insertBumpOut(notch1.footprint, topRight.id, 4, 12, -10, notch1.primaryCornerIds); // second notch -> U
    expect(segmentSamplesOutside(uShape.footprint, computeInsetPerimeterRing(uShape.footprint, RING_INSET_IN, uShape.primaryCornerIds))).toEqual([]);
  });
});

describe("the winding-order invariant the inward direction relies on", () => {
  // Deleting the centroid side test makes the ring depend on every footprint
  // arriving in this app's one winding order (corners clockwise on screen,
  // Y increasing downward = a positive shoelace sum). bumpOut.ts's
  // `outwardNormal` and dragWall.ts's drag axis already depend on the same
  // invariant; this pins it down across every producer rather than assuming it.
  // NOTE the deliberate limit: editWallLength is swept only on a convex
  // rectangle, the one shape class that provably cannot invert. It has no
  // validity guard, and shortening a BUMPED-OUT shape through it can reverse
  // the winding — see computeInsetPerimeterRing's doc comment and the Open
  // Item. Asserting that case here would pin broken behavior, so it is left
  // to the guard fix rather than encoded as expected.
  it("holds for every footprint-producing operation, editWallLength on convex shapes only", () => {
    const rect = buildRectangleFootprint(40, 30);
    expect(signedArea2x(rect)).toBeGreaterThan(0);
    expect(signedArea2x(buildRectangleFootprint(8, 60))).toBeGreaterThan(0);
    expect(signedArea2x(buildOctagonFootprint(40, 30))).toBeGreaterThan(0);
    expect(signedArea2x(editWallLength(rect, "AB", 60))).toBeGreaterThan(0);
    expect(signedArea2x(editWallLength(rect, "AB", 9))).toBeGreaterThan(0);

    for (const wall of rect.walls) {
      for (const offsetFt of [-40, -25, -10, 10, 25, 40]) {
        expect(signedArea2x(dragWallBounded(rect, wall.id, offsetFt))).toBeGreaterThan(0);
        expect(signedArea2x(dragWallWithCollapse(rect, wall.id, offsetFt, allPrimary(rect)).footprint)).toBeGreaterThan(0);
      }
    }

    let current = { footprint: rect, primaryCornerIds: allPrimary(rect) };
    for (let i = 0; i < 4; i++) {
      const wall = current.footprint.walls[i % current.footprint.walls.length]!;
      current = insertBumpOut(current.footprint, wall.id, 1, Math.min(6, wall.lengthFt), i % 2 === 0 ? 6 : -6, current.primaryCornerIds);
      expect(signedArea2x(current.footprint)).toBeGreaterThan(0);
    }
    for (const wall of current.footprint.walls) {
      for (const offsetFt of [-12, 12]) {
        expect(signedArea2x(dragWallWithCollapse(current.footprint, wall.id, offsetFt, current.primaryCornerIds).footprint)).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * The EXACT pre-fix field layout — lines run straight across the footprint's
 * inset BOUNDING BOX — kept here for the same reason `legacyCentroidRing` is:
 * "unchanged on a rectangle" and "fixed on a notched footprint" then both get
 * asserted against the real old behavior instead of hand-copied numbers. Ids
 * carry the new `-0` span suffix so the rectangle comparison is about
 * geometry, not about the id scheme.
 */
function legacyBoundingBoxFieldLayout(footprint: Footprint, insetIn: number, spacingIn: number): FieldFramingLine[] {
  const corners = footprint.corners.map((c) => c.point);
  const insetFt = insetIn / 12;
  const minX = Math.min(...corners.map((p) => p.x)) + insetFt;
  const maxX = Math.max(...corners.map((p) => p.x)) - insetFt;
  const minY = Math.min(...corners.map((p) => p.y)) + insetFt;
  const maxY = Math.max(...corners.map((p) => p.y)) - insetFt;
  const width = maxX - minX;
  const depth = maxY - minY;
  const spacingFt = spacingIn / 12;
  if (width <= 0 || depth <= 0) return [];
  const lines: FieldFramingLine[] = [];
  if (width >= depth) {
    const segments = Math.max(1, Math.ceil(width / spacingFt));
    const step = width / segments;
    for (let i = 0; i <= segments; i++) {
      const x = minX + i * step;
      lines.push({ id: `field-${i}-0`, x1: x, y1: minY, x2: x, y2: maxY });
    }
  } else {
    const segments = Math.max(1, Math.ceil(depth / spacingFt));
    const step = depth / segments;
    for (let i = 0; i <= segments; i++) {
      const y = minY + i * step;
      lines.push({ id: `field-${i}-0`, x1: minX, y1: y, x2: maxX, y2: y });
    }
  }
  return lines;
}

/**
 * Real-geometry check, the same shape as `segmentSamplesOutside` above and for
 * the same reason: ask the FOOTPRINT POLYGON ITSELF whether each sampled point
 * along an emitted span is inside it. Deliberately NOT a re-read of the inset
 * the layout was built from — a span running through a notch carries exactly
 * the same inset as a correct one, and only its position gives it away. (The
 * floor-membrane band bug survived ~900 tests precisely because the test
 * asserted the field the builder had just written.)
 *
 * Unlike the ring version, span ENDPOINTS are sampled too: every point of the
 * inward-offset polygon is `insetFt` clear of the exterior, so a correct
 * span's ends are STRICTLY inside the footprint, never on its boundary.
 */
function fieldSamplesOutside(fp: Footprint, lines: FieldFramingLine[]): string[] {
  const polygon = polygonOf(fp);
  const outside: string[] = [];
  for (const line of lines) {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const p = { x: line.x1 + (line.x2 - line.x1) * t, y: line.y1 + (line.y2 - line.y1) * t };
      if (!isPointInPolygon(p, polygon)) {
        outside.push(`${line.id}@t=${t.toFixed(2)}`);
        break;
      }
    }
  }
  return outside;
}

const totalFieldLengthFt = (lines: FieldFramingLine[]) => lines.reduce((sum, l) => sum + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0);

/** A 30x20 rectangle with a 14ft-tall notch cut 10ft into the LEFT wall — the
 * one shape in this file where a single field line genuinely comes back as two
 * disjoint spans. The field lines run vertically (width >= depth), so only a
 * notch entering from a wall PARALLEL to them can cut one in half; a notch off
 * the top or bottom wall just shortens lines from one end. */
function sideNotchFootprint() {
  const rect = buildRectangleFootprint(30, 20);
  return insertBumpOut(rect, "DA", 6, 14, -10, allPrimary(rect));
}

/** A 30x20 rectangle with a 15ft x 8ft notch out of the bottom-right — Tommy's
 * "floor framing on bump outs" case in its simplest form. */
function lShapeFootprint() {
  const rect = buildRectangleFootprint(30, 20);
  return insertBumpOut(rect, "CD", 15, 30, -8, allPrimary(rect));
}

/** Two notches off the top wall. */
function uShapeFootprint() {
  const rect = buildRectangleFootprint(30, 20);
  const first = insertBumpOut(rect, "AB", 4, 10, -8, allPrimary(rect));
  const topRight = first.footprint.walls.find((w) => {
    const s = first.footprint.corners.find((c) => c.id === w.startCorner)!.point;
    const e = first.footprint.corners.find((c) => c.id === w.endCorner)!.point;
    return s.y === 0 && e.y === 0 && e.x - s.x > 12;
  })!;
  return insertBumpOut(first.footprint, topRight.id, 4, 12, -8, first.primaryCornerIds);
}

/** A TRUE outward addition (positive depth) — behaves differently from a
 * notch: it grows the bounding box rather than hollowing it, so the old code
 * ran lines across ground the building doesn't cover on either side of the
 * bump. */
function outwardBumpFootprint() {
  const rect = buildRectangleFootprint(30, 20);
  return insertBumpOut(rect, "AB", 5, 15, 6, allPrimary(rect));
}

const FIELD_INSET_IN = 15.5; // the 15.5in default panel thickness; see baleFoundationRingPlan
const FIELD_SPACING_IN = 16;

describe("computeInsetFootprintPolygon", () => {
  it("is the rectangle's own inset box, corner for corner", () => {
    const fp = buildRectangleFootprint(30, 20);
    const poly = computeInsetFootprintPolygon(fp, 6); // 0.5ft
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    expect(poly).toHaveLength(4);
    expect(Math.min(...xs)).toBeCloseTo(0.5, 9);
    expect(Math.max(...xs)).toBeCloseTo(29.5, 9);
    expect(Math.min(...ys)).toBeCloseTo(0.5, 9);
    expect(Math.max(...ys)).toBeCloseTo(19.5, 9);
  });

  it("keeps every vertex strictly inside the footprint, on notched and mitered shapes alike", () => {
    const shapes = [
      buildRectangleFootprint(30, 20),
      buildOctagonFootprint(30, 20),
      lShapeFootprint().footprint,
      uShapeFootprint().footprint,
      sideNotchFootprint().footprint,
      outwardBumpFootprint().footprint,
    ];
    for (const fp of shapes) {
      for (const insetIn of [RING_INSET_IN, 12.5, FIELD_INSET_IN]) {
        const poly = computeInsetFootprintPolygon(fp, insetIn);
        expect(poly.length).toBe(fp.walls.length);
        for (const vertex of poly) expect(isPointInPolygon(vertex, polygonOf(fp))).toBe(true);
      }
    }
  });
});

describe("computeFieldFramingLayout follows the polygon, not the bounding box", () => {
  it("is an exact no-op on a rectangle", () => {
    for (const fp of [buildRectangleFootprint(30, 20), buildRectangleFootprint(20, 30), buildRectangleFootprint(48, 24)]) {
      for (const spacingIn of [16, 24]) {
        for (const insetIn of [14, FIELD_INSET_IN, 15.75]) {
          expect(computeFieldFramingLayout(fp, insetIn, spacingIn)).toEqual(legacyBoundingBoxFieldLayout(fp, insetIn, spacingIn));
        }
      }
    }
  });

  it("keeps every span inside the footprint on every shape the app can draw", () => {
    const shapes: [string, Footprint][] = [
      ["rectangle", buildRectangleFootprint(30, 20)],
      ["tall rectangle", buildRectangleFootprint(20, 30)],
      ["octagon", buildOctagonFootprint(30, 20)],
      ["octagon square", buildOctagonFootprint(30, 30)],
      ["L (notch)", lShapeFootprint().footprint],
      ["U (two notches)", uShapeFootprint().footprint],
      ["side notch", sideNotchFootprint().footprint],
      ["outward bump-out", outwardBumpFootprint().footprint],
    ];
    for (const [name, fp] of shapes) {
      for (const spacingIn of [16, 24]) {
        const lines = computeFieldFramingLayout(fp, FIELD_INSET_IN, spacingIn);
        expect(lines.length, name).toBeGreaterThan(0);
        expect(fieldSamplesOutside(fp, lines), `${name} @ ${spacingIn}in`).toEqual([]);
      }
    }
  });

  it("documents the bug being fixed: the bounding-box layout ran spans through open air", () => {
    // Every notched shape had spans outside the building; the outward
    // bump-out did too, on the ground either side of the bump; and so did the
    // OCTAGON, whose mitered corners the bounding box overhangs — that one is
    // not a bump-out at all, and nobody had reported it.
    const broken = [
      lShapeFootprint().footprint,
      uShapeFootprint().footprint,
      sideNotchFootprint().footprint,
      outwardBumpFootprint().footprint,
      buildOctagonFootprint(30, 20),
    ];
    for (const fp of broken) {
      expect(fieldSamplesOutside(fp, legacyBoundingBoxFieldLayout(fp, FIELD_INSET_IN, FIELD_SPACING_IN)).length).toBeGreaterThan(0);
    }
    // The rectangle is the one shape a bounding box describes exactly, which
    // is why this shipped and stayed invisible.
    const rect = buildRectangleFootprint(30, 20);
    expect(fieldSamplesOutside(rect, legacyBoundingBoxFieldLayout(rect, FIELD_INSET_IN, FIELD_SPACING_IN))).toEqual([]);
  });

  it("cuts a single line into several separately-identified spans across a side notch", () => {
    const { footprint } = sideNotchFootprint();
    const lines = computeFieldFramingLayout(footprint, FIELD_INSET_IN, FIELD_SPACING_IN);
    const spansPerLine = new Map<string, number>();
    for (const line of lines) {
      const index = line.id.slice(0, line.id.lastIndexOf("-"));
      spansPerLine.set(index, (spansPerLine.get(index) ?? 0) + 1);
    }
    expect([...spansPerLine.values()].filter((n) => n > 1).length).toBeGreaterThan(0);
    // The notch runs y 6..14, so a split line's two spans stop 15.5in short of it.
    const split = lines.filter((l) => l.id.startsWith("field-0-"));
    expect(split).toHaveLength(2);
    expect(split[0]!.y2).toBeCloseTo(6 - FIELD_INSET_IN / 12, 9);
    expect(split[1]!.y1).toBeCloseTo(14 + FIELD_INSET_IN / 12, 9);
  });

  it("gives every span a unique id — these are React keys AND OBJ group labels", () => {
    // A collision here doesn't throw. It silently merges two framing stacks
    // into one exported group and corrupts React reconciliation.
    const shapes = [
      buildRectangleFootprint(30, 20),
      buildOctagonFootprint(30, 20),
      lShapeFootprint().footprint,
      uShapeFootprint().footprint,
      sideNotchFootprint().footprint,
      outwardBumpFootprint().footprint,
    ];
    for (const fp of shapes) {
      for (const spacingIn of [16, 24]) {
        const ids = computeFieldFramingLayout(fp, FIELD_INSET_IN, spacingIn).map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("never emits a zero-length span, including where a notch lands exactly on a line position", () => {
    // 30ft wide, inset 15.5in -> 27.417ft of field at 16in bays -> 21 bays of
    // 1.3056ft. Sweep a notch edge across a whole bay so it lands exactly on a
    // line position, and either side of it.
    const rect = buildRectangleFootprint(30, 20);
    const step = (30 - (2 * FIELD_INSET_IN) / 12) / 21;
    for (let k = 0; k <= 8; k++) {
      const notchStartFt = FIELD_INSET_IN / 12 + 5 * step + (k * step) / 8;
      const { footprint } = insertBumpOut(rect, "CD", 30 - (notchStartFt + 8), 30 - notchStartFt, -8, allPrimary(rect));
      const lines = computeFieldFramingLayout(footprint, FIELD_INSET_IN, FIELD_SPACING_IN);
      for (const line of lines) expect(Math.hypot(line.x2 - line.x1, line.y2 - line.y1)).toBeGreaterThan(0);
      expect(fieldSamplesOutside(footprint, lines)).toEqual([]);
      expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
    }
  });

  it("drops field lumber on a notched footprint and holds it exactly on a rectangle", () => {
    const rect = buildRectangleFootprint(30, 20);
    expect(totalFieldLengthFt(computeFieldFramingLayout(rect, FIELD_INSET_IN, FIELD_SPACING_IN))).toBe(
      totalFieldLengthFt(legacyBoundingBoxFieldLayout(rect, FIELD_INSET_IN, FIELD_SPACING_IN)),
    );
    const notched = [
      lShapeFootprint().footprint,
      uShapeFootprint().footprint,
      sideNotchFootprint().footprint,
      outwardBumpFootprint().footprint,
      buildOctagonFootprint(30, 20),
    ];
    for (const fp of notched) {
      const after = totalFieldLengthFt(computeFieldFramingLayout(fp, FIELD_INSET_IN, FIELD_SPACING_IN));
      const before = totalFieldLengthFt(legacyBoundingBoxFieldLayout(fp, FIELD_INSET_IN, FIELD_SPACING_IN));
      expect(after).toBeLessThan(before);
    }
  });
});

describe("regression: a self-intersecting inset polygon must not frame through open air", () => {
  // computeInsetFootprintPolygon's miter offset self-intersects once a feature
  // is narrower than 2 x insetIn (2.58ft at the 15.5in default) — BELOW
  // insertBumpOut's own 2ft MARGIN_FT, so the UI can reach it. An inverted
  // loop can read as inside by ray parity, which put a full-height stack
  // straight through a 1ft notch: the exact defect stage 3 removes. Guarded by
  // re-clipping every span against the real footprint.
  const FIELD_INSET_IN = 15.5;
  const SPACING_IN = 16;

  function thinNotchFootprint(): Footprint {
    const rect = buildRectangleFootprint(30, 20);
    const once = insertBumpOut(rect, "AB", 3, 13, -8, allPrimary(rect)).footprint;
    // The remainder wall left by that notch is ~3ft; notching it 1..3 is
    // snap-reachable and leaves a feature far narrower than the inset.
    const shortWall = once.walls.reduce((a, b) => (a.lengthFt <= b.lengthFt ? a : b));
    return insertBumpOut(once, shortWall.id, 1, 3, -6, allPrimary(once)).footprint;
  }

  it("emits no field span outside the footprint on a sub-inset notch", () => {
    const fp = thinNotchFootprint();
    const polygon = fp.corners.map((c) => c.point);
    const lines = computeFieldFramingLayout(fp, FIELD_INSET_IN, SPACING_IN);
    for (const line of lines) {
      for (const t of [0.05, 0.25, 0.5, 0.75, 0.95]) {
        const p = { x: line.x1 + (line.x2 - line.x1) * t, y: line.y1 + (line.y2 - line.y1) * t };
        expect(isPointInPolygon(p, polygon)).toBe(true);
      }
    }
  });

  it("still frames the sane part of that footprint rather than bailing out", () => {
    expect(computeFieldFramingLayout(thinNotchFootprint(), FIELD_INSET_IN, SPACING_IN).length).toBeGreaterThan(0);
  });
});
