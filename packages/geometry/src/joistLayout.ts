import type { Footprint } from "./types";

/** The axis the joists themselves run along (their own span direction) —
 * "y" means each joist is a line running in the Y direction (spanning the
 * footprint's depth), "x" means each joist runs in the X direction
 * (spanning the footprint's width). */
export type JoistAxis = "x" | "y";

export interface JoistLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface JoistLayout {
  axis: JoistAxis;
  joists: JoistLine[];
}

/**
 * Suspended-floor joist centerlines, running perpendicular to the
 * footprint's longest walls and landing their ends on the two long walls
 * (Tommy) — e.g. a 30ft (wide) x 20ft (deep) building's long walls run
 * along X, so joists run along Y, each spanning the full 20ft depth, at
 * regular intervals across the 30ft width. Evenly divides the
 * perpendicular span into whole bays no larger than `spacingIn`, the same
 * "ceil'd, evenly-divided" rule as computeGridBays (so a span that
 * doesn't divide evenly by the spacing still gets a uniform pitch, not a
 * short leftover bay). This models a single clear span between the two
 * long walls — an interior beam row (over a pier grid's interior piers)
 * would break a long span into shorter segments, which isn't represented
 * here yet. The precise rim-joist thermal-break detail (edge-rim -> gap
 * -> rim joist -> field joists) is illustrated separately as a schematic,
 * not built into these live centerlines.
 */
export function computeJoistLayout(footprint: Footprint, spacingIn: number): JoistLayout {
  const corners = footprint.corners.map((c) => c.point);
  const minX = Math.min(...corners.map((p) => p.x));
  const maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const maxY = Math.max(...corners.map((p) => p.y));
  const width = maxX - minX;
  const depth = maxY - minY;
  const spacingFt = spacingIn / 12;

  const axis: JoistAxis = width >= depth ? "y" : "x";
  const joists: JoistLine[] = [];

  if (axis === "y") {
    const segments = Math.max(1, Math.ceil(width / spacingFt));
    const step = width / segments;
    for (let i = 0; i <= segments; i++) {
      const x = minX + i * step;
      joists.push({ id: `joist-${i}`, x1: x, y1: minY, x2: x, y2: maxY });
    }
  } else {
    const segments = Math.max(1, Math.ceil(depth / spacingFt));
    const step = depth / segments;
    for (let i = 0; i <= segments; i++) {
      const y = minY + i * step;
      joists.push({ id: `joist-${i}`, x1: minX, y1: y, x2: maxX, y2: y });
    }
  }

  return { axis, joists };
}
