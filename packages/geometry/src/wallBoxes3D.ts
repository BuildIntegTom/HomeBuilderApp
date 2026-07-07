import { cornerTurnAngleRad, isConvexCorner, isRightAngleCorner } from "./cornerAngle";
import type { Footprint } from "./types";

/**
 * Plain, framework-agnostic per-wall box spec for a 3D preview — no
 * Three.js (or any renderer) types involved, just numbers, so this is
 * tested the same way as everything else in this package. A renderer maps
 * each entry directly onto a box mesh: `centerX`/`centerZ` is the box's
 * horizontal center, `lengthFt` x `thicknessFt` x `heightFt` its
 * dimensions (along its own direction, across it, and up), and
 * `rotationRad` how far to rotate it around the vertical axis.
 *
 * Ft-space's `y` (the 2D plan's "depth" axis) becomes 3D `z` here — 3D
 * `y` is reserved for "up" (`heightFt`), which the 2D plan has no
 * equivalent of at all.
 */
export interface WallBox3D {
  wallId: string;
  centerX: number;
  centerZ: number;
  lengthFt: number;
  thicknessFt: number;
  heightFt: number;
  /** Rotation around the vertical axis, radians — 0 means the wall runs
   * along +X. Matches `Math.atan2(dz, dx)` of the wall's own direction. */
  rotationRad: number;
}

/**
 * Converts every wall of a footprint into a 3D box spec, extruded to a
 * uniform `heightFt` — no roof, no openings, just the shell's footprint
 * pushed up. `thicknessIn` is the same wall-panel thickness already used
 * for 2D tiling/corner-ownership (see `retile.ts`); `primaryCornerIds` is
 * the same "which corners predate any bump-out" set threaded through
 * `retile`/`cornerOwnership` too — it's what decides which wall wins a
 * reflex corner below.
 *
 * The footprint's corner points are the panels' EXTERIOR edge (same
 * convention `computeSlotRects` in `apps/web/app/canvasGeometry.ts`
 * already uses for the 2D rendering) — thickness extends inward from
 * that line, it doesn't straddle it. Centering each box on the
 * corner-to-corner line instead (splitting thickness evenly to both
 * sides) was tried first and is wrong: it shifts every wall out from
 * where the 2D plan actually puts it.
 *
 * At a CONVEX right-angle corner, extending thickness inward from the
 * shared exterior point is already enough on its own: the two walls'
 * boxes overlap in the small square where they meet (invisible for solid
 * geometry), no length adjustment needed. At a REFLEX right-angle corner
 * (only possible once a bump-out exists) it's the opposite problem — the
 * two boxes fall *short* of each other, leaving a real `thicknessFt` x
 * `thicknessFt` gap neither box covers, for the same underlying reason
 * the 2D corner-ownership rule exists (see `retile.ts`'s `cornerOwnership`
 * doc comment). The fix mirrors that 2D rule exactly: the *original*
 * (pre-existing) wall — the one with a primary corner endpoint — wins and
 * extends its own length by `thicknessFt` past the shared corner, closing
 * the gap; the new (bump-out-introduced) wall is untouched. Mitered
 * (non-90deg) corners are left alone for now — box geometry can't
 * perfectly miter a 45deg joint, and that's out of scope for this
 * "no roof yet" pass.
 */
export function wallBoxes3D(
  footprint: Footprint,
  thicknessIn: number,
  heightFt: number,
  primaryCornerIds: Set<string>,
): WallBox3D[] {
  const thicknessFt = thicknessIn / 12;
  const centroid = {
    x: footprint.corners.reduce((sum, c) => sum + c.point.x, 0) / footprint.corners.length,
    y: footprint.corners.reduce((sum, c) => sum + c.point.y, 0) / footprint.corners.length,
  };

  // At each reflex right-angle corner, exactly one of the 2 meeting walls
  // gets its length extended by thicknessFt at that end — never both,
  // never neither (see the doc comment above).
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

    const shorterWins = () =>
      wall.lengthFt !== nextWall.lengthFt ? wall.lengthFt < nextWall.lengthFt : wall.id < nextWall.id;
    const wallIsOriginal = primaryCornerIds.has(wall.startCorner) || primaryCornerIds.has(wall.endCorner);
    const nextIsOriginal = primaryCornerIds.has(nextWall.startCorner) || primaryCornerIds.has(nextWall.endCorner);
    const wallWins = wallIsOriginal !== nextIsOriginal ? wallIsOriginal : shorterWins();
    if (wallWins) {
      endExtensionFt[wall.id] = thicknessFt;
    } else {
      startExtensionFt[nextWall.id] = thicknessFt;
    }
  }

  return footprint.walls.map((wall) => {
    const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
    const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / length, y: dz / length };
    const perp = { x: -dir.y, y: dir.x };
    const exteriorMidX = (start.x + end.x) / 2;
    const exteriorMidZ = (start.y + end.y) / 2;
    const pointsInward = perp.x * (centroid.x - exteriorMidX) + perp.y * (centroid.y - exteriorMidZ) >= 0;
    const inward = pointsInward ? perp : { x: -perp.x, y: -perp.y };

    const extStart = startExtensionFt[wall.id]!;
    const extEnd = endExtensionFt[wall.id]!;
    const alongShift = (extEnd - extStart) / 2;

    return {
      wallId: wall.id,
      centerX: exteriorMidX + (inward.x * thicknessFt) / 2 + dir.x * alongShift,
      centerZ: exteriorMidZ + (inward.y * thicknessFt) / 2 + dir.y * alongShift,
      lengthFt: wall.lengthFt + extStart + extEnd,
      thicknessFt,
      heightFt,
      rotationRad: Math.atan2(dz, dx),
    };
  });
}
