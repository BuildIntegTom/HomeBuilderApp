import type { Point } from "./types";

export type FloorMembraneAxis = "width" | "depth";

export interface FloorMembraneBandPlan {
  /** Which of the floor's own bounding-box dimensions to split into 3
   * parallel bands — whichever is longer (more room for 3 visually
   * distinct bands). "width" is the X extent, "depth" is the Y extent, in
   * the footprint's own plan coordinates — the same convention
   * `computeFloorSkinPieces` clips against. (This used to cite
   * `buildFloorBottomSkinMembers`'s `widthIn`/`depthIn` params; those were
   * deleted when the skin became footprint-shaped and the builder started
   * taking already-clipped `FloorSkinPiece`s instead.) */
  axis: FloorMembraneAxis;
  /** True when the near (least-accessible-corner) end sits at this axis's
   * own MAX rather than MIN — tells the caller which end the fully-opaque
   * band belongs at. */
  nearIsMax: boolean;
}

/**
 * Decides how to split the floor's bottom membrane into 3 parallel
 * opacity bands radiating from the site-wide least-accessible-corner
 * marker (Tommy: "it's hard to see the floor framing... dividing the
 * space into one side being opaque and the other side being 75% opaque
 * followed by 50%") — 3 parallel directional stripes, not a radial
 * gradient, splitting along whichever bounding-box dimension is longer
 * (more room for 3 meaningfully different bands), starting fully opaque
 * at whichever end sits nearest the marker.
 */
export function computeFloorMembraneOpacityBands(
  minXFt: number,
  maxXFt: number,
  minYFt: number,
  maxYFt: number,
  nearPoint: Point,
): FloorMembraneBandPlan {
  const widthFt = maxXFt - minXFt;
  const depthFt = maxYFt - minYFt;
  const axis: FloorMembraneAxis = widthFt >= depthFt ? "width" : "depth";
  const nearIsMax =
    axis === "width"
      ? Math.abs(nearPoint.x - maxXFt) < Math.abs(nearPoint.x - minXFt)
      : Math.abs(nearPoint.y - maxYFt) < Math.abs(nearPoint.y - minYFt);
  return { axis, nearIsMax };
}
