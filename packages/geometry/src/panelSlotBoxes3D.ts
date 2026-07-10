import { cornerTurnAngleRad, isConvexCorner, isRightAngleCorner } from "./cornerAngle";
import type { Footprint, PanelSlot } from "./types";

/**
 * Per-panel-slot placement for the whole-building 3D preview (Tommy: "is
 * there a way that the 3D Preview button can show these models in their
 * place together on the floor plan?") — one entry per slot across every
 * wall, giving a renderer everything needed to place that slot's own
 * member geometry (or a placeholder) in world space.
 *
 * Unlike `wallBoxes3D`'s one-box-per-wall (thickness-centered) output,
 * `anchorX`/`anchorZ` here is the slot's MIN-CORNER (its start point along
 * the wall, at the wall's EXTERIOR face) — matching the same "position is
 * the member's own min-corner" convention `packages/panel-catalog`'s
 * member builders already use (X=width from the anchor, Y=up from 0,
 * Z=depth from the exterior face at the anchor). A renderer wraps each
 * slot's own local-origin member meshes in one group positioned at
 * (anchorX, 0, anchorZ) and rotated by -rotationRad around Y, and they
 * compose correctly without any further transform math.
 */
export interface PanelSlotBox3D {
  wallId: string;
  slotIndex: number;
  slot: PanelSlot;
  anchorX: number;
  anchorZ: number;
  widthFt: number;
  depthFt: number;
  heightFt: number;
  /** Rotation around the vertical axis, radians — matches `wallBoxes3D`'s
   * convention exactly (0 = wall runs along +X); negate it for a Three.js
   * `rotation.y`. */
  rotationRad: number;
}

/**
 * Reproduces `wallBoxes3D`'s reflex-corner length-extension logic (see its
 * doc comment for the full rationale) rather than importing it, since this
 * needs the pre-extension EXTERIOR-face anchor point that function doesn't
 * expose (it only returns the post-shift, thickness-centered box center).
 */
export function panelSlotBoxes3D(
  footprint: Footprint,
  wallSlots: Record<string, PanelSlot[]>,
  thicknessIn: number,
  heightFt: number,
  primaryCornerIds: Set<string>,
): PanelSlotBox3D[] {
  const thicknessFt = thicknessIn / 12;
  const centroid = {
    x: footprint.corners.reduce((sum, c) => sum + c.point.x, 0) / footprint.corners.length,
    y: footprint.corners.reduce((sum, c) => sum + c.point.y, 0) / footprint.corners.length,
  };

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
    if (!isRightAngleCorner(angle)) continue;
    if (isConvexCorner(wall, nextWall, footprint.corners)) continue;

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

  const result: PanelSlotBox3D[] = [];
  for (const wall of footprint.walls) {
    const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
    const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / length, z: dz / length };
    const rotationRad = Math.atan2(dz, dx);

    const extStart = startExtensionFt[wall.id]!;
    const extEnd = endExtensionFt[wall.id]!;
    const exteriorMidX = (start.x + end.x) / 2;
    const exteriorMidZ = (start.y + end.y) / 2;
    const alongShift = (extEnd - extStart) / 2;
    const lengthFt = wall.lengthFt + extStart + extEnd;
    // Exterior-face midpoint of the (possibly extended) wall, then back up
    // by half its length to the start (min-corner along the wall).
    const wallStartX = exteriorMidX + dir.x * alongShift - (dir.x * lengthFt) / 2;
    const wallStartZ = exteriorMidZ + dir.z * alongShift - (dir.z * lengthFt) / 2;

    const slots = wallSlots[wall.id] ?? [];
    const totalWidthIn = slots.reduce((sum, s) => sum + s.widthIn, 0);
    // Slots should already sum to exactly the wall's tiled length, but
    // rescale defensively so rendering never drifts off the wall's actual
    // (possibly reflex-extended) length even if they don't exactly match.
    const scale = totalWidthIn > 0 ? (lengthFt * 12) / totalWidthIn : 1;

    let offsetFt = 0;
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const slot = slots[slotIndex]!;
      const widthFt = (slot.widthIn * scale) / 12;
      result.push({
        wallId: wall.id,
        slotIndex,
        slot,
        anchorX: wallStartX + dir.x * offsetFt,
        anchorZ: wallStartZ + dir.z * offsetFt,
        widthFt,
        depthFt: thicknessFt,
        heightFt,
        rotationRad,
      });
      offsetFt += widthFt;
    }
  }
  return result;
}
