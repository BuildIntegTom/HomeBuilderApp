import type { PanelMember } from "./componentSchema";

/**
 * Octagon roof-catcher ring (Tommy: "for octagon roofs, lets do an octagon
 * ring made out of LVL's that are 14x1.75in that corresponds to the wall
 * directions. this will be the 'beam'") — 8 mitered 1-3/4in x 14in LVL
 * segments (thickness x depth, on edge — 14in vertical, matching the
 * roof-catcher beam's own LVL convention in roofCatcherBeamMembers.ts),
 * one per compass direction, forming a small closed ring (2, 3, or 4ft
 * outside diameter) — a compression ring near the roof's apex, sized
 * independently of the building's own (much larger) octagon footprint.
 *
 * "Outside diameter" is read as the flat-to-flat distance across the ring
 * (the standard way octagonal hardware/rings are sized — the width you'd
 * measure with calipers across two parallel flats), not point-to-point
 * across the corners.
 */
export const OCTAGON_RING_THICKNESS_IN = 1.75; // radial thickness ("1-3/4in")
export const OCTAGON_RING_DEPTH_IN = 14; // vertical depth ("14in"), on edge
export const OCTAGON_RING_MITER_ANGLE_DEG = 22.5; // half the octagon's 45deg exterior turning angle at each corner
export const OCTAGON_RING_DIAMETER_OPTIONS_FT = [2, 3, 4] as const;
export type OctagonRingDiameterFt = (typeof OCTAGON_RING_DIAMETER_OPTIONS_FT)[number];

const SEGMENT_COUNT = 8;
const MITER_ANGLE_RAD = (OCTAGON_RING_MITER_ANGLE_DEG * Math.PI) / 180;

/**
 * One segment's own length, measured along its centerline (radially
 * mid-thickness) between its two mitered ends — the dimension a shop would
 * actually cut to, letting the miter angle itself account for the outer
 * edge being longer and the inner edge shorter (Tommy: "all corners are
 * mitered").
 */
export function computeOctagonRingSegmentLengthIn(outsideDiameterIn: number): number {
  const centerlineApothemIn = outsideDiameterIn / 2 - OCTAGON_RING_THICKNESS_IN / 2;
  return 2 * centerlineApothemIn * Math.tan(MITER_ANGLE_RAD);
}

/**
 * The single reusable segment cross-section/length (every one of the 8 is
 * identical, by regular-octagon symmetry) — a caller places 8 copies per
 * `computeOctagonRingSegmentPlacements` below. Modeled as a straight box,
 * same "angle-cut ends simplified, not true beveled geometry" convention
 * used for header/brace members elsewhere in this catalog.
 *
 * Pre-centered on its own local origin (position.xIn/yIn offset by half its
 * own length/thickness) rather than the usual min-corner-at-0 convention —
 * so a caller can wrap it in a `<group>` rotated/translated straight to one
 * of `computeOctagonRingSegmentPlacements`' center points without it
 * drifting off-axis first.
 */
export function buildOctagonRingSegmentMembers(outsideDiameterIn: number): PanelMember[] {
  const lengthIn = computeOctagonRingSegmentLengthIn(outsideDiameterIn);
  return [
    {
      memberId: "ring_segment",
      material: "dimensional_lumber",
      speciesGrade: "LVL",
      plySpec: null,
      nominalSize: "1-3/4x14 LVL",
      actualDimsIn: { thicknessIn: OCTAGON_RING_THICKNESS_IN, widthIn: OCTAGON_RING_DEPTH_IN, lengthIn },
      orientation: "horizontal",
      position: { xIn: -lengthIn / 2, yIn: -OCTAGON_RING_THICKNESS_IN / 2, zIn: 0, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: `Mitered ${OCTAGON_RING_MITER_ANGLE_DEG}deg at both ends (simplified to a straight box here, not true beveled geometry) — one of ${SEGMENT_COUNT} identical segments forming the closed octagon ring.`,
    },
  ];
}

export interface OctagonRingSegmentPlacement {
  /** 0..7, clockwise from north — matches wallCompassDirection's own
   * clockwise-from-N convention in packages/geometry, so a caller that
   * also imports that package can line the two up by index without this
   * package needing to depend on geometry itself. */
  index: number;
  /** This segment's centerline center point, in a local ring-centered
   * (X = east, Z = south) frame — a caller positions/rotates its own
   * `buildOctagonRingSegmentMembers` group at this point. */
  centerXIn: number;
  centerZIn: number;
  /** Yaw, degrees, clockwise from facing north — 0 at index 0, +45 per
   * subsequent index. */
  rotationDeg: number;
}

/**
 * World placements for all 8 ring segments — mirrors the existing
 * `WorldPlacedPanel` pattern (packages/panel-catalog's own OBJ exporter)
 * since, unlike every other combined-member builder in this catalog, a
 * ring's 8 segments sit at 8 different rotations and can't be expressed as
 * one shifted-but-unrotated `PanelMember[]`.
 */
export function computeOctagonRingSegmentPlacements(outsideDiameterIn: number): OctagonRingSegmentPlacement[] {
  const centerlineApothemIn = outsideDiameterIn / 2 - OCTAGON_RING_THICKNESS_IN / 2;
  return Array.from({ length: SEGMENT_COUNT }, (_, index) => {
    const rotationDeg = index * 45;
    const angleRad = (rotationDeg * Math.PI) / 180;
    return {
      index,
      centerXIn: centerlineApothemIn * Math.sin(angleRad),
      centerZIn: -centerlineApothemIn * Math.cos(angleRad),
      rotationDeg,
    };
  });
}
