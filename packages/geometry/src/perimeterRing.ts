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

export interface FieldFramingLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Single (non-doubled) framing-stack centerlines filling the interior span
 * beyond a footprint's own bounding box inset by `insetIn` on every side —
 * the bale foundation's field members, beyond the doubled Ring A/Ring B
 * perimeter (see baleFoundationMembers.ts). Same axis choice and "ceil to
 * whole bays no larger than spacingIn, then evenly redistribute" rule as
 * `computeJoistLayout` (joistLayout.ts) — this is that same function
 * generalized with an inward inset, not a new algorithm; `computeJoistLayout`
 * itself is left untouched (unrelated existing callers depend on its
 * exact no-inset signature).
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

  const lines: FieldFramingLine[] = [];
  if (width >= depth) {
    const segments = Math.max(1, Math.ceil(width / spacingFt));
    const step = width / segments;
    for (let i = 0; i <= segments; i++) {
      const x = minX + i * step;
      lines.push({ id: `field-${i}`, x1: x, y1: minY, x2: x, y2: maxY });
    }
  } else {
    const segments = Math.max(1, Math.ceil(depth / spacingFt));
    const step = depth / segments;
    for (let i = 0; i <= segments; i++) {
      const y = minY + i * step;
      lines.push({ id: `field-${i}`, x1: minX, y1: y, x2: maxX, y2: y });
    }
  }
  return lines;
}
