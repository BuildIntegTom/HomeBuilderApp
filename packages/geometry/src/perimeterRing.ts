import { clipSegmentToPolygon } from "./clipSegmentToPolygon";
import { cornerTurnAngleRad, isConvexCorner, isRightAngleCorner } from "./cornerAngle";
import type { Footprint, Point } from "./types";

/**
 * One wall's own segment of a perimeter ring offset inward from the
 * footprint's exterior line by a fixed `insetIn` — used for the bale
 * foundation's rim rings (Tommy: "a perimeter rim joist... flush with the
 * inside of the primary floor plan"). Carries both a plan-space
 * start/end point pair (for 2D drawing, e.g. FloorCanvas) and a
 * center/rotation pair in the SAME shape `wallBoxes3D`'s own `WallBox3D`
 * already uses (for 3D group placement, e.g. Building3DView) — one
 * function serving both consumers instead of two independent derivations.
 */
export interface PerimeterRingSegment {
  wallId: string;
  startPoint: Point;
  endPoint: Point;
  centerX: number;
  centerZ: number;
  lengthFt: number;
  rotationRad: number;
}

/**
 * Offsets every wall of a footprint inward by a fixed `insetIn`, with
 * mitered corners — no such whole-polygon inset utility existed before
 * this (packages/geometry only had `retile.ts`'s `cornerOwnership`, a 1D
 * per-wall tiling-length adjustment, and `wallBoxes3D.ts`'s own per-wall
 * "exterior line minus thickness" convention for solid wall boxes). This
 * generalizes `wallBoxes3D`'s exact reflex-corner-extension algorithm
 * (verified there by direct pixel measurement) from a fixed `thicknessFt`
 * offset to an arbitrary `insetFt` — the extension amount needed to close
 * a reflex-corner gap scales linearly with the offset distance for a 90deg
 * corner, so substituting `insetFt` throughout is correct, not just an
 * approximation.
 *
 * At a CONVEX corner, no extension is applied — the two walls' offset
 * segments simply overlap in a small square at the corner, same
 * "invisible for solid geometry" simplification `wallBoxes3D` already
 * uses (this ring's segments become solid framing-stack members, so the
 * same simplification applies directly). Mitered (non-90deg) corners are
 * left unextended too, same scope cut as `wallBoxes3D` — box/board
 * geometry can't perfectly miter a non-90deg joint.
 *
 * WHICH WAY IS INWARD: the +90deg rotation of each wall's own direction
 * vector, for every wall, with no side test. That follows from the single
 * winding order every footprint in this app is built and maintained in
 * (corners clockwise on screen, Y increasing downward — see
 * `buildRectangleFootprint`/`buildOctagonFootprint`), which makes the
 * inward normal a global property of the polygon rather than a per-wall
 * question; it is the exact negation of `bumpOut.ts`'s `outwardNormal`,
 * whose doc comment carries the full argument. This replaced a
 * vertex-averaged-centroid side test — the same heuristic `bumpOut.ts` was
 * fixed to abandon (regression test at bumpOut.test.ts:204). A vertex
 * average sits inside the convex hull, so it can never fall outside a hull
 * wall, but a notch's tightly clustered new corners drag it far enough to
 * land on the WRONG side of some *other* notch's wall — and that wall's
 * whole ring segment then got offset outward, into open air outside the
 * building (Tommy, on the bale foundation's floor framing: "i see the floor
 * framing on bump outs has a similar problem - and also is spawned wrong").
 * Reversed winding is not handled. It holds for every footprint this app
 * renders today — `buildRectangleFootprint`, `buildOctagonFootprint`,
 * `insertBumpOut`, `dragWallBounded`/`dragWallWithCollapse` all preserve
 * it, and `dragWallBounded` refuses any self-intersecting offset — but do
 * NOT read that as "cannot happen". `editWallLength` has no validity guard
 * at all (only MIN_WALL_LENGTH_FT on the edited wall), and shortening a
 * bumped-out shape enough can invert the signed area from a value typed
 * straight into the UI. Deliberately not defended against here: on such a
 * footprint `bumpOut.ts`'s `outwardNormal` and `dragWall.ts`'s drag axis
 * are wrong in exactly the same way, so normalizing only this function
 * would trade a coherently-broken app for an incoherent one and hide the
 * real defect, which is the missing guard. Tracked as an Open Item.
 * Project load is a sixth path no producer covers — `parseProjectFile`
 * casts without deep validation — safe in practice since files this app
 * writes are always positively wound. Asserted in perimeterRing.test.ts.
 */
export function computeInsetPerimeterRing(footprint: Footprint, insetIn: number, primaryCornerIds: Set<string>): PerimeterRingSegment[] {
  const insetFt = insetIn / 12;

  // At each reflex right-angle corner, exactly one of the 2 meeting walls
  // gets its length extended by insetFt at that end — mirrors
  // wallBoxes3D's own startExtensionFt/endExtensionFt derivation exactly,
  // parameterized by insetFt instead of a fixed thicknessFt.
  const startExtensionFt: Record<string, number> = {};
  const endExtensionFt: Record<string, number> = {};
  for (const wall of footprint.walls) {
    startExtensionFt[wall.id] = 0;
    endExtensionFt[wall.id] = 0;
  }
  for (const wall of footprint.walls) {
    const nextWall = footprint.walls.find((w) => w.startCorner === wall.endCorner);
    if (!nextWall) continue;
    const angle = cornerTurnAngleRad(wall, nextWall, footprint.corners);
    if (!isRightAngleCorner(angle)) continue; // mitered — not handled here
    if (isConvexCorner(wall, nextWall, footprint.corners)) continue; // convex — overlap already covers it

    const shorterWins = () => (wall.lengthFt !== nextWall.lengthFt ? wall.lengthFt < nextWall.lengthFt : wall.id < nextWall.id);
    const wallIsOriginal = primaryCornerIds.has(wall.startCorner) || primaryCornerIds.has(wall.endCorner);
    const nextIsOriginal = primaryCornerIds.has(nextWall.startCorner) || primaryCornerIds.has(nextWall.endCorner);
    const wallWins = wallIsOriginal !== nextIsOriginal ? wallIsOriginal : shorterWins();
    if (wallWins) {
      endExtensionFt[wall.id] = insetFt;
    } else {
      startExtensionFt[nextWall.id] = insetFt;
    }
  }

  return footprint.walls.map((wall) => {
    const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
    const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / length, y: dz / length };
    // Inward is the +90deg rotation of the wall's own direction vector,
    // unconditionally: the exact negation of bumpOut.ts's `outwardNormal`
    // ({ x: dir.y, y: -dir.x }), and the same expression dragWall.ts uses
    // for its own drag axis. See the doc comment above for why no per-wall
    // side test is needed.
    const inward = { x: -dir.y, y: dir.x };
    const exteriorMidX = (start.x + end.x) / 2;
    const exteriorMidZ = (start.y + end.y) / 2;

    const extStart = startExtensionFt[wall.id]!;
    const extEnd = endExtensionFt[wall.id]!;
    const lengthFt = wall.lengthFt + extStart + extEnd;
    const alongShift = (extEnd - extStart) / 2;
    const centerX = exteriorMidX + inward.x * insetFt + dir.x * alongShift;
    const centerZ = exteriorMidZ + inward.y * insetFt + dir.y * alongShift;

    return {
      wallId: wall.id,
      startPoint: { x: centerX - (dir.x * lengthFt) / 2, y: centerZ - (dir.y * lengthFt) / 2 },
      endPoint: { x: centerX + (dir.x * lengthFt) / 2, y: centerZ + (dir.y * lengthFt) / 2 },
      centerX,
      centerZ,
      lengthFt,
      rotationRad: Math.atan2(dz, dx),
    };
  });
}

/** Walls in ring order, following endCorner -> startCorner, starting from
 * `walls[0]`. Returns null if the chain doesn't close over every wall
 * exactly once — `footprint.walls` array order is NOT guaranteed to be ring
 * order, and every consumer that needs a polygon needs the ring order. */
function orderedWallCycle(footprint: Footprint): string[] | null {
  if (footprint.walls.length < 3) return null;
  const byStart = new Map(footprint.walls.map((w) => [w.startCorner, w]));
  const first = footprint.walls[0]!;
  const order: string[] = [first.id];
  const seen = new Set<string>([first.id]);
  let current = first;
  for (let i = 1; i < footprint.walls.length; i++) {
    const next = byStart.get(current.endCorner);
    if (!next || seen.has(next.id)) return null;
    order.push(next.id);
    seen.add(next.id);
    current = next;
  }
  return byStart.get(current.endCorner)?.id === first.id ? order : null;
}

/**
 * The footprint offset inward by `insetIn` as a CLOSED POLYGON, mitered at
 * every corner — the region a member has to stay inside to be `insetIn` clear
 * of every exterior wall.
 *
 * Built ENTIRELY out of `computeInsetPerimeterRing`'s own output rather than
 * a second offsetter: each ring segment already lies on its wall's
 * inward-offset line (that function owns the winding-based inward direction
 * and its whole argument), so the offset polygon's vertices are just the
 * intersections of consecutive segments' infinite lines. That intersection is
 * also what turns the ring's per-wall approximations into an exact polygon:
 * at a convex corner the two segments merely overlap and at a reflex one they
 * are extended by a fixed amount, but both of those move where a segment
 * STOPS along its line, never the line itself.
 *
 * `primaryCornerIds` is passed as empty for the same reason — it only picks
 * WHICH of two walls absorbs a reflex corner's extension, which is a
 * stopping-point decision.
 *
 * Returns [] if the walls don't form a single closed cycle. LIMITATION, and
 * it is REACHABLE — do not repeat the earlier claim that it isn't: a miter
 * offset self-intersects once a feature is narrower than 2 x insetIn, which
 * at the 15.5in default is 2.58ft, BELOW `insertBumpOut`'s own MARGIN_FT of
 * 2ft. Its degenerate-span fallback (`a = max(1, mid-1)`, `b = min(L-1,
 * mid+1)`) produces sub-2ft features on any wall under 4ft, and
 * `snapSpanPointFt` snaps a short wall to {0, 2, L-2, L}, landing on them.
 * Worked repro: rect 30x20, insertBumpOut("AB", 3, 13, -8), then bump the
 * resulting 3ft wall at 1..3 by -6 — the offset polygon gets a vertex at
 * x = -0.29, outside the building. Outward thin arms fail SAFE (the reversed
 * loop reads as outside, so the arm merely gets no framing); inward thin
 * features fail UNSAFE once a leg is under ~one inset. A straight-skeleton
 * offset is not built here; `computeFieldFramingLayout` instead re-clips
 * against the real footprint, which kills the whole class for its own use.
 * Any NEW caller of this function needs that guard too.
 */
export function computeInsetFootprintPolygon(footprint: Footprint, insetIn: number): Point[] {
  const order = orderedWallCycle(footprint);
  if (!order) return [];
  const segments = new Map(computeInsetPerimeterRing(footprint, insetIn, new Set<string>()).map((s) => [s.wallId, s]));
  // Direction taken from the segment's own two endpoints, NOT from
  // cos/sin(rotationRad): atan2-then-cos of a vertical wall returns 6.1e-17
  // instead of 0, which would put every derived vertex an ulp off and cost
  // the exact no-op on an axis-aligned rectangle for nothing.
  const lines = order.map((wallId) => {
    const seg = segments.get(wallId)!;
    const vx = seg.endPoint.x - seg.startPoint.x;
    const vy = seg.endPoint.y - seg.startPoint.y;
    const len = Math.hypot(vx, vy) || 1;
    return { px: seg.centerX, py: seg.centerZ, dx: vx / len, dy: vy / len };
  });

  const polygon: Point[] = [];
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i]!;
    const b = lines[(i + 1) % lines.length]!;
    // Both directions are unit vectors, so denom is sin(angle between them) —
    // this is a parallelism tolerance in radians, purely numerical.
    const denom = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(denom) <= 1e-12) {
      // Consecutive walls parallel (a collinear pair, i.e. a 180deg "corner"):
      // both offset lines are the same line, so any point on it is the joint.
      polygon.push({ x: b.px, y: b.py });
      continue;
    }
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / denom;
    polygon.push({ x: a.px + a.dx * t, y: a.py + a.dy * t });
  }
  return polygon;
}

export interface FieldFramingLine {
  /** `field-${lineIndex}-${spanIndex}`. The span index is NOT decoration: one
   * line can be cut into several disjoint spans by a notch, and this id is
   * used as a React key in FloorCanvas AND as a member-id / OBJ group-label
   * prefix in Building3DView — where a collision would not throw, it would
   * silently merge two separate framing stacks into one exported group. */
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Single (non-doubled) framing-stack centerlines filling the interior span
 * inboard of `insetIn` — the bale foundation's field members, inboard of the
 * doubled Ring A/Ring B perimeter that brackets the wall (see
 * baleFoundationRingPlan.ts, which owns the `insetIn` this is called with).
 *
 * Each line is CLIPPED TO THE INWARD-OFFSET FOOTPRINT POLYGON, not run
 * straight across the footprint's inset bounding box (Tommy, seeing the
 * bounding-box version live: "i see the floor framing on bump outs has a
 * similar problem" — the same defect the floor bottom skin had). On an L or a
 * U the old lines ran through the notch, i.e. through open air outside the
 * building; now only the parts genuinely inside the building survive, and one
 * line can come back as SEVERAL disjoint spans, which is why the id carries a
 * span index.
 *
 * WHAT STAYS BOUNDING-BOX DERIVED, deliberately: which axis the lines run
 * along, and where each line sits along that axis. "Which way is this building
 * longer" is exactly what a bounding box measures, the bays stay evenly spaced
 * across the whole building instead of restarting per arm of an L, and it is
 * what makes this an exact no-op on a rectangle. Same split as
 * `computeFloorMembraneBandPolygons`, which kept its band axis bounding-box
 * derived while making the band SHAPES follow the polygon.
 *
 * Same axis choice and "ceil to whole bays no larger than spacingIn, then
 * evenly redistribute" rule as `computeJoistLayout` (joistLayout.ts) — this
 * is that same function generalized with an inward inset and a polygon clip.
 * `computeJoistLayout` has the identical bounding-box defect and is
 * deliberately NOT fixed here: it is a different floor type (suspended
 * joists), nobody has reported it, and unrelated existing callers depend on
 * its exact no-inset signature. `clipSegmentToPolygon` would drop straight
 * into it when someone does want that.
 */
export function computeFieldFramingLayout(footprint: Footprint, insetIn: number, spacingIn: number): FieldFramingLine[] {
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

  // The inset polygon is contained in the inset bounding box by construction
  // (every one of its points is >= insetFt clear of the exterior), so a line
  // spanning the box edge to edge cannot miss any part of it.
  const clipPolygon = computeInsetFootprintPolygon(footprint, insetIn);

  const lines: FieldFramingLine[] = [];
  const pushClipped = (index: number, x1: number, y1: number, x2: number, y2: number) => {
    // No usable polygon (walls that don't form a closed cycle) — fall back to
    // the unclipped line rather than silently framing nothing.
    if (clipPolygon.length < 3) {
      lines.push({ id: `field-${index}-0`, x1, y1, x2, y2 });
      return;
    }
    // Second clip against the REAL footprint, not just the inset polygon.
    // The miter offset self-intersects once a feature is narrower than
    // 2 x insetIn, and an inverted loop can read as inside by ray parity —
    // which puts a full-height stack straight through a narrow notch, the
    // exact defect this whole stage exists to remove. Reachable from the UI:
    // insertBumpOut's degenerate-span fallback yields sub-2ft features on any
    // wall under 4ft, and snapSpanPointFt lands on them. Free on every sane
    // shape (a span inside a sane inset polygon is inside the footprint by
    // construction), so it is a guard, not a second algorithm.
    clipSegmentToPolygon({ x: x1, y: y1 }, { x: x2, y: y2 }, clipPolygon)
      .flatMap((span) => clipSegmentToPolygon(span.start, span.end, corners))
      .forEach((span, spanIndex) => {
        lines.push({ id: `field-${index}-${spanIndex}`, x1: span.start.x, y1: span.start.y, x2: span.end.x, y2: span.end.y });
      });
  };

  if (width >= depth) {
    const segments = Math.max(1, Math.ceil(width / spacingFt));
    const step = width / segments;
    for (let i = 0; i <= segments; i++) {
      const x = minX + i * step;
      pushClipped(i, x, minY, x, maxY);
    }
  } else {
    const segments = Math.max(1, Math.ceil(depth / spacingFt));
    const step = depth / segments;
    for (let i = 0; i <= segments; i++) {
      const y = minY + i * step;
      pushClipped(i, minX, y, maxX, y);
    }
  }
  return lines;
}
