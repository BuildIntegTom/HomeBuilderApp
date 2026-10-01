import { cornerOwnershipWithRunStops, wallRunFor } from "./retile";
import type { Footprint, PanelSlot, WallRunStop } from "./types";

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
 * Uses the exact same `cornerOwnership` computation `retile()` uses to
 * build the real `PanelSlot[]` arrays this function is placing — critical,
 * not just consistent-for-its-own-sake: a wall that loses a plain convex
 * corner is tiled `thicknessIn` SHORTER than its raw exterior-line length
 * at that end (the other, LONGER wall runs through and owns the corner panel
 * there instead — Tommy, 2026-10-01), and a wall that wins a reflex (bump-out
 * inside) corner is
 * tiled `thicknessIn` LONGER. Using the raw wall length instead (as an
 * earlier version of this function did, duplicating only `wallBoxes3D`'s
 * reflex-only extension logic) silently drifted the computed length away
 * from what the slots actually sum to — on a plain rectangle, the two
 * SHORTER walls lose BOTH corners to the longer perpendicular walls, so
 * their raw length overshot the real tiled length by a full 2x
 * `thicknessIn`, and the defensive rescale below (meant only for tiny
 * floating-point slop) silently stretched every one of that wall's panels
 * to compensate — the reported "long wall's panels are spaced out" bug.
 *
 * **Stage 3's run stops go through that same shared derivation, and they
 * HAVE to.** A stopped wall's slots deliberately sum to less than its full
 * tiled length, so without `runStopsByWallId` the rescale above would read
 * that shortfall as float slop and stretch every panel on the wall to fill
 * the unbuilt span — drawing a solid wall exactly where the plan says to
 * draw nothing. With the stops passed in, the run's length and its start
 * point both shrink, the scale returns to 1, and the unbuilt span is simply
 * empty in 3D. Omitted, nothing changes for any wall.
 */
export function panelSlotBoxes3D(
  footprint: Footprint,
  wallSlots: Record<string, PanelSlot[]>,
  thicknessIn: number,
  heightFt: number,
  primaryCornerIds: Set<string>,
  runStopsByWallId?: Record<string, WallRunStop>,
): PanelSlotBox3D[] {
  const thicknessFt = thicknessIn / 12;
  const ownership = cornerOwnershipWithRunStops(footprint, primaryCornerIds, thicknessIn, runStopsByWallId);

  const result: PanelSlotBox3D[] = [];
  for (const wall of footprint.walls) {
    const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
    const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / length, z: dz / length };
    const rotationRad = Math.atan2(dz, dx);

    const { start: startOwn } = ownership[wall.id]!;
    // `wallRunFor`, not a local `lengthFt * 12` — the same shared derivation
    // `retile()` uses, snapped and already carrying any run stop. These two
    // have to be the SAME number: on an octagon's 45deg wall the tiled slots
    // sum to the snapped (grid) length, so reading the unsnapped one here
    // would leave the rescale below silently absorbing a real
    // model-vs-render disagreement instead of only float slop.
    const { lengthIn, startStopIn } = wallRunFor(wall, ownership[wall.id]!, runStopsByWallId?.[wall.id]);
    // Inset moves the tiling start INWARD (this wall doesn't own the
    // corner there); extraLengthIn moves it OUTWARD (this wall's corner
    // panel reaches past its raw endpoint to close a reflex gap); a start
    // stop moves it further inward again by exactly the span that is not
    // built — same formula `retile()` uses to derive `lengthIn`, applied per
    // axis here.
    const startShiftFt = (startOwn.insetAmount - startOwn.extraLengthIn + startStopIn) / 12;
    const wallStartX = start.x + dir.x * startShiftFt;
    const wallStartZ = start.y + dir.z * startShiftFt;

    const slots = wallSlots[wall.id] ?? [];
    const totalWidthIn = slots.reduce((sum, s) => sum + s.widthIn, 0);
    // Slots should already sum to exactly lengthIn — rescale defensively
    // so rendering never drifts off the wall's actual length even if they
    // don't exactly match, but this should only ever correct tiny
    // floating-point slop now that lengthIn matches retile()'s own formula.
    const scale = totalWidthIn > 0 ? lengthIn / totalWidthIn : 1;

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
