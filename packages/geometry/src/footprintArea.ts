import type { Footprint } from "./types";

/**
 * Plan-view (flat, straight-down) footprint area via the shoelace formula —
 * `Corner.point.x/y` are already in feet (see buildRectangleFootprint), so
 * this returns square feet directly, no unit conversion needed.
 *
 * Used as an illustrative roof-surface-area placeholder (Tommy: "Intello
 * covers walls and ceilings on the interior surface area of wall panels
 * and roof panels") — the roof system has no real slope/ridge geometry
 * modeled anywhere in this codebase yet, so a real sloped roof surface
 * area isn't computable; this flat plan-view area is a clearly-labeled
 * stand-in, not a claim that roofs are flat.
 */
export function computeFootprintAreaSqFt(footprint: Footprint): number {
  const pts = footprint.corners.map((c) => c.point);
  if (pts.length < 3) return 0;
  let twiceArea = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}
