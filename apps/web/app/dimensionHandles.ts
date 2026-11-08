/**
 * ⚠ **U6 stride 2 — five dimension handles, floating on the model.** His ask,
 * 2026-11-05:
 *
 * > *"Nothing crazy, but height (oh boy maybe we run into panel setting tiling
 * > ordering issues here), width, depth of building, as well as the roof
 * > slider (slides the peak position), and I guess roof height too."*
 *
 * ⚠ **Every handle commits through a seam that already exists**, and that is
 * the whole design. Stride 1 built the resize seam precisely so this layer
 * could be thin: a handle computes WHERE it sits and WHAT it would change to,
 * and hands the number to the same function the typed field calls. It owns no
 * resize logic of its own, so it cannot drift from the typed path and cannot
 * become the fifth thing that replaces a footprint without re-deriving a roof.
 *
 * ⚠ **The typed value stays the master**, his rule for this item and the one
 * B29/B30 built the panel editor's drag under: *the gesture proposes, the
 * arithmetic disposes.* A pointer gives a continuous number; `resizeBuildingBoxFt`
 * snaps it to the eighth, and for an octagon `setStraightWall` SOLVES for the
 * box rather than taking the dragged length literally. So the number that
 * lands is a real dimension, not the one the mouse happened to stop on.
 *
 * This module is the arithmetic only — where a handle sits in the scene and
 * what it reads. The drag itself needs the camera and lives in
 * `DimensionHandlesGroup`.
 */

import { GABLE_SHED_SNAP_THRESHOLD_IN, type Footprint } from "@building-integrity/geometry";
import { boxAxisForWall, type BuildingShapeKind } from "./buildingResize";

export type DimensionHandleId = "width" | "depth" | "wallHeight" | "roofHeight" | "roofPeak";

/** What kind of number a handle is showing, which decides how it is written
 * and what a sensible chevron step is. */
export type DimensionHandleKind =
  /** A length of building, in feet and inches. */
  | "length"
  /** A height above the ground or above the eave. */
  | "height"
  /** A distance along a wall, from its start corner. */
  | "position";

export interface DimensionHandle {
  id: DimensionHandleId;
  /** The short name on the badge. */
  label: string;
  /** A sentence for the badge's title attribute — what this number means and
   * what moving it will move with it. */
  hint: string;
  kind: DimensionHandleKind;
  /** Where the badge floats, in scene feet: `[x, height, z]`. */
  anchorFt: [number, number, number];
  /** The unit direction in the scene that a drag runs along. */
  axisFt: [number, number, number];
  /** The current value, feet. */
  valueFt: number;
  /** The chevron step, feet. */
  stepFt: number;
  /** The wall this handle belongs to, where it belongs to one — the id the
   * commit needs. */
  wallId: string | null;
}

/** How far outside the building a badge floats, feet. Enough to clear the
 * wall's own depth and the plaster beyond it without drifting off the model. */
export const HANDLE_STANDOFF_FT = 2.5;

/** The chevron steps. ⚠ Not building values: they are how far one click of a
 * control moves, chosen so a click is useful and a held click is not wild.
 * A length steps by a FOOT, because buildings are drawn in feet and an
 * eighth-inch chevron would be unusable; the typed field is how an eighth is
 * entered, which is the point of the typed field staying the master. */
export const HANDLE_STEP_FT: Record<DimensionHandleKind, number> = {
  length: 1,
  height: 0.5,
  /* ⚠ The peak steps by the SHED-SNAP THRESHOLD, so a click always lands on
     a position the roof can actually be in — see `clampHandleValueFt`. */
  position: GABLE_SHED_SNAP_THRESHOLD_IN / 12,
};

interface WallFrame {
  /** Midpoint of the wall, plan feet. */
  midX: number;
  midZ: number;
  /** Unit vector along the wall, start corner to end corner. */
  dirX: number;
  dirZ: number;
  /** Unit vector pointing out of the building. */
  outX: number;
  outZ: number;
  lengthFt: number;
  startX: number;
  startZ: number;
}

/**
 * The frame a badge needs for one wall: where its middle is, which way it
 * runs, and which way is OUT.
 *
 * ⚠ **Outwardness is measured, not assumed from winding.** A footprint can be
 * wound either way and a courtyard's inner ring is wound against its outer
 * one, so the normal is chosen by testing it against the plan's own centroid
 * rather than by trusting a sign.
 */
export function wallFrame(footprint: Footprint, wallId: string): WallFrame | null {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const a = footprint.corners.find((c) => c.id === wall.startCorner)?.point;
  const b = footprint.corners.find((c) => c.id === wall.endCorner)?.point;
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dz = b.y - a.y;
  const length = Math.hypot(dx, dz);
  if (length < 1e-9) return null;
  const dirX = dx / length;
  const dirZ = dz / length;
  const midX = (a.x + b.x) / 2;
  const midZ = (a.y + b.y) / 2;
  const centroidX = footprint.corners.reduce((s, c) => s + c.point.x, 0) / footprint.corners.length;
  const centroidZ = footprint.corners.reduce((s, c) => s + c.point.y, 0) / footprint.corners.length;
  // Either perpendicular will do; keep the one that points away from the middle.
  let outX = -dirZ;
  let outZ = dirX;
  if (outX * (midX - centroidX) + outZ * (midZ - centroidZ) < 0) {
    outX = -outX;
    outZ = -outZ;
  }
  return { midX, midZ, dirX, dirZ, outX, outZ, lengthFt: length, startX: a.x, startZ: a.y };
}

export interface DimensionHandleInput {
  footprint: Footprint;
  shapeKind: BuildingShapeKind;
  /** Height of the ground-storey walls, feet. */
  wallHeightFt: number;
  /** Where the roof bears, feet above the ground — the gable's own base. */
  eaveHeightFt: number;
  /** The ridge's rise ABOVE the eave, feet, or null when there is no roof to
   * speak of. ⚠ A rise, not an absolute height: see
   * `gable_roofline_height_relative_to_eave`, where storing it as an absolute
   * put a valley in every two-storey roofline. */
  roofRiseFt: number | null;
  /** A gable end wall to hang the roof handles off, or null. */
  gableWallId: string | null;
  /** The peak's distance along that wall from its start corner, feet. Null
   * when the peak has not been placed by hand, which means centred. */
  peakPositionFt: number | null;
  /** See `PEAK_HANDLE_ENABLED`. Defaults to it; the tests pass `true` so the
   * geometry stays measured while the control is held back. */
  includePeakHandle?: boolean;
}

/**
 * ⚠ **THE PEAK SLIDER IS BUILT, TESTED AND HELD BACK — 2026-11-07.**
 *
 * It is the one handle of the five that cannot be shipped yet, and the reason
 * is a defect it did not cause. A gable peak stored too close to a wall's end
 * produces a gable row containing a zero-height tile, and
 * `buildGablePanelMembers` THROWS on it during render rather than refusing —
 * which takes the **whole page** down, because `BuildingSummaryRender` keeps a
 * `Building3DView` mounted off-screen at all times.
 *
 * Measured in the browser on a 24 x 16 Tiny House: **0in fine, 12in crash,
 * 24in crash, 36in crash, 48in fine.** The unsafe band is wider than the
 * 24in shed-snap threshold, and where it really ends is a property of
 * `computeGableTiledRow`, not of this file. ⚠ **Picking a number here would be
 * guessing at a building value**, which is the one thing this app does not do
 * — so the control waits rather than being fenced with an invented limit.
 * (My first attempt did exactly that: it snapped to the 24in threshold while
 * the 36in crash was already measured and on the page in front of me.)
 *
 * ⚠ **The defect is PRE-EXISTING and still live.** The elevation editor's own
 * Position slider has shipped for weeks with `step={1}` and reaches every one
 * of those values. It is written up as its own task with the reproduction, the
 * measurements and the two candidate fix sites. When it is fixed, delete this
 * constant and the handle comes back with no other change.
 */
export const PEAK_HANDLE_ENABLED = false;

/**
 * The handles this building has right now.
 *
 * ⚠ **A handle that cannot commit is not drawn.** A freeform plan has no width
 * or depth to show; a building with no gable end has no ridge and no peak to
 * slide. Showing a control that refuses on contact is worse than showing none,
 * and `boxRefusalReason` is where the explanation lives for the user who went
 * looking.
 */
export function dimensionHandles(input: DimensionHandleInput): DimensionHandle[] {
  const {
    footprint,
    shapeKind,
    wallHeightFt,
    eaveHeightFt,
    roofRiseFt,
    gableWallId,
    peakPositionFt,
    includePeakHandle = PEAK_HANDLE_ENABLED,
  } = input;
  const out: DimensionHandle[] = [];

  const wallFor = (axis: "width" | "depth") =>
    footprint.walls.find((w) => boxAxisForWall(shapeKind, w.id) === axis)?.id ?? null;

  const widthWallId = wallFor("width");
  const depthWallId = wallFor("depth");

  /* ⚠ The length badges sit a third of the way UP the wall rather than on the
     ground. On the ground they collide with U4's props and U5's lawn, and at
     the top plate they collide with the roof. */
  const lengthBadgeHeightFt = Math.max(1, wallHeightFt * 0.35);

  for (const [axis, wallId] of [
    ["width", widthWallId],
    ["depth", depthWallId],
  ] as const) {
    if (!wallId) continue;
    const frame = wallFrame(footprint, wallId);
    if (!frame) continue;
    out.push({
      id: axis,
      label: axis === "width" ? "Width" : "Depth",
      hint:
        shapeKind === "octagon"
          ? "This straight wall's length. An octagon has two degrees of freedom, so moving it also moves the four corner walls — see the octagon size panel."
          : "This wall's length. The wall opposite moves with it, because a rectangle is two numbers.",
      kind: "length",
      anchorFt: [
        frame.midX + frame.outX * HANDLE_STANDOFF_FT,
        lengthBadgeHeightFt,
        frame.midZ + frame.outZ * HANDLE_STANDOFF_FT,
      ],
      axisFt: [frame.dirX, 0, frame.dirZ],
      valueFt: frame.lengthFt,
      stepFt: HANDLE_STEP_FT.length,
      wallId,
    });
  }

  /* ⚠ **The wall-height handle goes on a wall the GABLE is not on**, and
     that rule was written by the browser rather than by reasoning. It first
     hung off the depth wall's start corner at the top plate — which on a
     one-storey building is within inches of the eave, where the roof handles
     already sit. On a 24 x 16 Tiny House the height badge and the peak slider
     landed on top of each other, and the unit test did not catch it because
     its fixture put the eave a foot above the wall. Measured 2026-11-07.

     ⚠ On a FREEFORM plan there is no width or depth wall at all, and the
     height handle still belongs: a wall height is one number on any shape,
     bumped out or not. It falls back to any wall rather than disappearing
     with the two that genuinely have nothing to show. */
  const heightWallId =
    [widthWallId, depthWallId, ...footprint.walls.map((w) => w.id)].find(
      (id): id is string => id !== null && id !== gableWallId,
    ) ?? null;
  const heightFrame = heightWallId ? wallFrame(footprint, heightWallId) : null;
  if (heightFrame) {
    out.push({
      id: "wallHeight",
      label: "Wall height",
      hint: "The ground storey's wall height, floor to top plate. The roof rides on it, so the whole building gets taller.",
      kind: "height",
      anchorFt: [
        heightFrame.startX + heightFrame.outX * HANDLE_STANDOFF_FT,
        wallHeightFt,
        heightFrame.startZ + heightFrame.outZ * HANDLE_STANDOFF_FT,
      ],
      axisFt: [0, 1, 0],
      valueFt: wallHeightFt,
      stepFt: HANDLE_STEP_FT.height,
      wallId: heightWallId,
    });
  }

  const gableFrame = gableWallId ? wallFrame(footprint, gableWallId) : null;
  if (gableFrame && roofRiseFt !== null) {
    /* The peak's own distance along the gable wall — centred until somebody
       places it, which is what a null position means. */
    const peakFt = peakPositionFt ?? gableFrame.lengthFt / 2;
    const peakX = gableFrame.startX + gableFrame.dirX * peakFt;
    const peakZ = gableFrame.startZ + gableFrame.dirZ * peakFt;
    out.push({
      id: "roofHeight",
      label: "Ridge rise",
      hint: "How far the ridge rises ABOVE the eave — not its height off the ground, so a second storey does not move it.",
      kind: "height",
      anchorFt: [
        peakX + gableFrame.outX * HANDLE_STANDOFF_FT,
        eaveHeightFt + roofRiseFt,
        peakZ + gableFrame.outZ * HANDLE_STANDOFF_FT,
      ],
      axisFt: [0, 1, 0],
      valueFt: roofRiseFt,
      stepFt: HANDLE_STEP_FT.height,
      wallId: gableWallId,
    });
    if (includePeakHandle)
      out.push({
        id: "roofPeak",
        label: "Peak along wall",
        hint: "Where the ridge sits along the gable wall, measured from its start corner. Slide it to an end and the roof becomes a shed; the opposite gable mirrors it.",
        kind: "position",
        anchorFt: [
          peakX + gableFrame.outX * HANDLE_STANDOFF_FT,
          eaveHeightFt,
          peakZ + gableFrame.outZ * HANDLE_STANDOFF_FT,
        ],
        axisFt: [gableFrame.dirX, 0, gableFrame.dirZ],
        valueFt: peakFt,
        stepFt: HANDLE_STEP_FT.position,
        wallId: gableWallId,
      });
  }

  return out;
}

/**
 * ⚠ **What a handle is allowed to become.**
 *
 * A drag can be thrown anywhere, and three of these five have a hard floor
 * that is not a matter of taste:
 *
 * - a LENGTH or a HEIGHT cannot be zero or negative — there is no building
 *   there, and the tiler would be asked to fill a wall that does not exist;
 * - a PEAK POSITION cannot leave its own wall, because it is measured along
 *   it. Its two ends are not an error, though: a peak AT an end is exactly
 *   how this app stores a shed.
 *
 * ⚠ Everything beyond that is left to the real refusal. A wall that cannot
 * shrink any further is refused by `resizeWallRun`'s own shortfall and
 * reported by `resizeBuildingBoxFt`, which knows the panels; clamping to a
 * made-up minimum here would be guessing at a building number.
 */
export function clampHandleValueFt(handle: DimensionHandle, valueFt: number, wallLengthFt: number): number {
  if (handle.kind === "position") return snapPeakPositionFt(valueFt, wallLengthFt);
  return Math.max(valueFt, MIN_HANDLE_VALUE_FT);
}

/**
 * ⚠ **THE DEAD ZONE BESIDE EACH END IS NOT A PLACE THE ROOF CAN BE, and the
 * peak handle refuses to stop in it.**
 *
 * `resolveGableProfilePoints` snaps any explicitly-placed point within
 * `GABLE_SHED_SNAP_THRESHOLD_IN` (24in) of an end back to that end — that is
 * how this app stores a shed. So a position of, say, 12in is stored as 12in
 * and DRAWN as 0: the number and the model disagree, and a badge reading
 * `0'-1"` over a roof that is a shed at zero is lying about the building.
 * Snapping out of the zone is what makes the badge tell the truth, and the
 * chevron step is the threshold itself so one click always lands clear.
 *
 * ⚠ **It also keeps this control out of a crash that is not U6's.** A stored
 * position inside that zone produces a gable row with a zero-height tile, and
 * `buildGablePanelMembers` throws on it rather than refusing — which takes the
 * whole page down, because `BuildingSummaryRender` keeps a `Building3DView`
 * mounted off-screen at all times. Measured 2026-11-07 on a 24 x 16 Tiny
 * House: 12in and 36in crash, 0in and 48in are fine. ⚠ **That defect is
 * PRE-EXISTING and is NOT fixed here** — the elevation editor's own Position
 * slider reaches the same values with `step={1}` and still does. It is written
 * up as its own task; this snap only means U6's handle is not a new way in.
 *
 * On a wall shorter than two thresholds there is no legal middle at all, so
 * the only positions are its two ends — which is correct: a 3ft gable wall
 * cannot carry a peak with a real roof plane either side of it.
 */
export function snapPeakPositionFt(valueFt: number, wallLengthFt: number): number {
  const thresholdFt = GABLE_SHED_SNAP_THRESHOLD_IN / 12;
  if (!(wallLengthFt > 0)) return 0;
  if (valueFt <= 0) return 0;
  if (valueFt >= wallLengthFt) return wallLengthFt;
  if (wallLengthFt <= 2 * thresholdFt) return valueFt < wallLengthFt / 2 ? 0 : wallLengthFt;
  if (valueFt < thresholdFt) return valueFt <= thresholdFt / 2 ? 0 : thresholdFt;
  if (valueFt > wallLengthFt - thresholdFt) {
    return valueFt >= wallLengthFt - thresholdFt / 2 ? wallLengthFt : wallLengthFt - thresholdFt;
  }
  return valueFt;
}

/** One inch. Not a building minimum — just "greater than nothing", so a drag
 * thrown past the origin does not ask for a wall of zero or a negative height.
 * The real floor is whatever the panels can absorb, and that one refuses. */
export const MIN_HANDLE_VALUE_FT = 1 / 12;
