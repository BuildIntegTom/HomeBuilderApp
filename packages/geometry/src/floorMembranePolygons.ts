import { computeFloorMembraneOpacityBands } from "./floorMembraneOpacityBands";
import type { Footprint, Point } from "./types";

/** Coincidence tolerance in FEET — two points closer than this are the same
 * point, and a point this close to a clip line is on it. Band boundaries
 * come from exact arithmetic on the footprint's own bounding box, so real
 * floating-point noise is many orders below this, and no real building
 * feature is a billionth of a foot. Purely numerical, not a building
 * value. */
const POINT_TOLERANCE_FT = 1e-9;

/** Below this, a clipped piece is a sliver with no area — what a band
 * boundary landing exactly on a footprint vertex produces — and is dropped
 * rather than emitted as a zero-area member. */
const AREA_TOLERANCE_SQFT = 1e-6;

export interface FloorMembraneBandPiece {
  /** 0 = the band NEAREST the least-accessible-corner marker, i.e. the
   * fully-opaque one. Near-to-far ordering is resolved HERE (off
   * `computeFloorMembraneOpacityBands`' own `nearIsMax`) so that no consumer
   * has to reverse anything: the member builder can index its opacity table
   * by this directly, and the member id's own `band_N` agrees with the note
   * text that says the bands radiate from the marker. */
  bandIndex: number;
  /** >0 only where a notch cuts one band into several disconnected pieces —
   * a U-shaped footprint (a mid-wall notch with non-flush ends) does this.
   * All pieces of a band share that band's opacity. */
  pieceIndex: number;
  /** Ring in footprint coordinates (feet), counter-clockwise, first point
   * not repeated at the end. */
  polygon: Point[];
}

function ringSignedArea2X(ring: Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

function ringAreaSqFt(ring: Point[]): number {
  return Math.abs(ringSignedArea2X(ring)) / 2;
}

function dropRepeatedPoints(ring: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of ring) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) <= POINT_TOLERANCE_FT) continue;
    out.push(p);
  }
  while (out.length > 1) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(first.x - last.x, first.y - last.y) <= POINT_TOLERANCE_FT) out.pop();
    else break;
  }
  return out;
}

/**
 * Clips ONE counter-clockwise ring against the half-plane
 * `n . p <= c`, returning zero, one, or SEVERAL rings.
 *
 * The several is the whole point. Plain Sutherland-Hodgman always returns a
 * single ring, so a clip that genuinely separates the polygon into two
 * pieces (a band strip across a U-shaped footprint, cut in two by the
 * notch) comes back as one ring joined by a zero-width bridge running down
 * and back along the notch — an invisible-but-real defect that would render
 * as a hairline artifact and export as degenerate faces.
 *
 * Instead this keeps the maximal runs of retained vertices as open CHAINS,
 * then reconnects them along the clip line. Because the ring is CCW and the
 * retained side is on the left, the boundary always runs along the clip line
 * in the single direction `u` (the clip normal turned 90 degrees), so each
 * chain's exit point joins to the NEXT chain start along `u`. Chains lying
 * entirely on the clip line (the polygon merely grazing it from outside)
 * contribute no area and are dropped.
 */
function clipRingToHalfPlane(ring: Point[], nx: number, ny: number, c: number): Point[][] {
  const n = ring.length;
  if (n < 3) return [];
  const dist = ring.map((p) => c - (nx * p.x + ny * p.y)); // >= 0 is retained
  if (dist.every((d) => d >= -POINT_TOLERANCE_FT)) return [ring];
  if (dist.every((d) => d <= POINT_TOLERANCE_FT)) return [];

  // Walk the ring, keeping retained vertices and inserting the crossing
  // point on any edge that genuinely straddles the line.
  const seq: { p: Point; retained: boolean; onLine: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    const da = dist[i]!;
    const db = dist[(i + 1) % n]!;
    seq.push({ p: a, retained: da >= -POINT_TOLERANCE_FT, onLine: Math.abs(da) <= POINT_TOLERANCE_FT });
    if ((da > POINT_TOLERANCE_FT && db < -POINT_TOLERANCE_FT) || (da < -POINT_TOLERANCE_FT && db > POINT_TOLERANCE_FT)) {
      const t = da / (da - db);
      seq.push({ p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, retained: true, onLine: true });
    }
  }

  // Maximal cyclic runs of retained vertices.
  const startIdx = seq.findIndex((v, i) => v.retained && !seq[(i - 1 + seq.length) % seq.length]!.retained);
  if (startIdx < 0) return [];
  const chains: Point[][] = [];
  let current: Point[] | null = null;
  for (let k = 0; k < seq.length; k++) {
    const v = seq[(startIdx + k) % seq.length]!;
    if (v.retained) {
      if (!current) {
        current = [];
        chains.push(current);
      }
      current.push(v.p);
    } else {
      current = null;
    }
  }

  // A chain entirely on the clip line is a tangential touch — no area.
  const usable = chains
    .map((chain) => dropRepeatedPoints(chain))
    .filter((chain) => chain.length >= 2 && chain.some((p) => Math.abs(c - (nx * p.x + ny * p.y)) > POINT_TOLERANCE_FT));
  if (usable.length === 0) return [];
  if (usable.length === 1) return [dropRepeatedPoints(usable[0]!)];

  // Reconnect: `u` is the clip normal rotated +90deg, i.e. the one direction
  // the retained boundary can run along the line for a CCW ring.
  const ux = -ny;
  const uy = nx;
  const along = (p: Point): number => ux * p.x + uy * p.y;
  const ends = usable.map((chain) => along(chain[chain.length - 1]!));
  const starts = usable.map((chain) => along(chain[0]!));
  const nextChain = ends.map((endS, i) => {
    let best = -1;
    let bestS = Infinity;
    for (let j = 0; j < usable.length; j++) {
      const s = starts[j]!;
      if (s < endS - POINT_TOLERANCE_FT) continue; // behind us along the line
      if (s < bestS) {
        bestS = s;
        best = j;
      }
    }
    return best >= 0 ? best : i;
  });

  const used = new Array(usable.length).fill(false);
  const rings: Point[][] = [];
  for (let i = 0; i < usable.length; i++) {
    if (used[i]) continue;
    const out: Point[] = [];
    let cursor = i;
    let guard = usable.length + 1;
    while (!used[cursor] && guard-- > 0) {
      used[cursor] = true;
      out.push(...usable[cursor]!);
      cursor = nextChain[cursor]!;
    }
    const cleaned = dropRepeatedPoints(out);
    if (cleaned.length >= 3) rings.push(cleaned);
  }
  return rings;
}

/**
 * The floor bottom skin's real shape, band by band: the FOOTPRINT POLYGON
 * intersected with each of the 3 opacity-band strips, rather than the
 * footprint's bounding rectangle (Tommy, seeing the bounding-box version
 * live: "i see how it overlaps on the current live version - not what i
 * want. lets make that the same size as the footprint."). On a rectangle
 * this returns 3 rectangles, exactly as before; on an octagon, a bump-out,
 * an L or a U it returns the building's own outline.
 *
 * The SPLIT AXIS and the equal-width band boundaries are deliberately still
 * bounding-box derived — `computeFloorMembraneOpacityBands`, called here and
 * otherwise untouched. "Which way is this building longer" is exactly what a
 * bounding box measures, and the bands read as distance from the
 * least-accessible-corner marker, which a polygon principal axis or
 * equal-AREA boundaries would both muddy (equal-area boundaries sit at
 * positions corresponding to nothing physical, and on an L would crowd two
 * of them into the narrow arm).
 *
 * A band never comes back empty — every strip between the bounding box's own
 * extremes meets the polygon — but it CAN come back as several disconnected
 * pieces where a notch cuts the strip in two, which is why the return type
 * is a flat piece list rather than a fixed 3-tuple. "3 bands" was always
 * about opacity, never about member count.
 *
 * `footprint.corners` is used in array order as the ring, the same
 * convention `computeFootprintAreaSqFt` follows.
 */
export function computeFloorMembraneBandPolygons(footprint: Footprint, nearPoint: Point): FloorMembraneBandPiece[] {
  const corners = footprint.corners.map((c) => c.point);
  if (corners.length < 3) return [];

  const ring = ringSignedArea2X(corners) < 0 ? [...corners].reverse() : [...corners];
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const plan = computeFloorMembraneOpacityBands(minX, maxX, minY, maxY, nearPoint);
  const isWidthAxis = plan.axis === "width";
  const axisMin = isWidthAxis ? minX : minY;
  const axisMax = isWidthAxis ? maxX : maxY;
  const bandSize = (axisMax - axisMin) / 3;
  // Outward normal of the half-plane "axis coordinate <= c".
  const nx = isWidthAxis ? 1 : 0;
  const ny = isWidthAxis ? 0 : 1;

  const pieces: FloorMembraneBandPiece[] = [];
  for (let k = 0; k < 3; k++) {
    const lo = axisMin + k * bandSize;
    const hi = k === 2 ? axisMax : axisMin + (k + 1) * bandSize;
    // Two half-plane clips: coordinate <= hi, then coordinate >= lo (the
    // same half-plane form with the normal flipped).
    const upper = clipRingToHalfPlane(ring, nx, ny, hi);
    const strip: Point[][] = [];
    for (const r of upper) strip.push(...clipRingToHalfPlane(r, -nx, -ny, -lo));

    const kept = strip
      .filter((r) => r.length >= 3 && ringAreaSqFt(r) > AREA_TOLERANCE_SQFT)
      .map((r) => (ringSignedArea2X(r) < 0 ? [...r].reverse() : r))
      // Deterministic piece ordering: along the band's own long direction,
      // so a U-shape's two pieces don't swap indices between renders.
      .sort((a, b) => {
        const key = (r: Point[]) => (isWidthAxis ? Math.min(...r.map((p) => p.y)) : Math.min(...r.map((p) => p.x)));
        return key(a) - key(b);
      });

    // `nearIsMax` means the marker sits at the axis MAX, so band 0 (the
    // opaque one) is the last strip, not the first.
    const bandIndex = plan.nearIsMax ? 2 - k : k;
    kept.forEach((polygon, pieceIndex) => pieces.push({ bandIndex, pieceIndex, polygon }));
  }

  return pieces.sort((a, b) => a.bandIndex - b.bandIndex || a.pieceIndex - b.pieceIndex);
}
