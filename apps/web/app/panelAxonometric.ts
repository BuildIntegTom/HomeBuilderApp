import { memberFaceIndices, memberLocalCornersIn, type PanelMember } from "@building-integrity/panel-catalog";

/**
 * A PANEL AS A PRINTABLE AXONOMETRIC — the shop drawing's own 3D view.
 *
 * Tommy, 2026-10-11: *"the shop drawing image of each panel should be what that
 * panel looks like from the exterior up and left tilted as it would appear when
 * isolated in the 3D view"* — and, asked whether that should replace the
 * lettered elevation or keep its labels, he chose **3D with the badges on it**.
 *
 * ⚠ **This is SVG geometry, not a WebGL camera, and that is a deliberate
 * choice for a document rather than a shortcut.**
 *
 *   - **It prints.** A shop sheet goes to paper and to PDF. Vector polygons
 *     stay sharp at any DPI; a `<canvas>` is a raster image that prints at
 *     whatever pixel density it happened to be composited at.
 *   - **It scales to a packet.** The Print page opens every formal document at
 *     once — twenty-plus sheets. A WebGL context per sheet would hit the
 *     browser's hard cap (~16 live contexts) and start silently dropping the
 *     earliest ones.
 *   - **The badges can share one coordinate space.** The lettered badges are
 *     placed by the elevation's own `placeBadges`, which works in SVG pixels.
 *     Projecting into the same space means the 3D view reuses that placement
 *     exactly, rather than reimplementing collision avoidance against a canvas.
 *   - **It is deterministic.** The same panel yields the same drawing on every
 *     machine, which a GPU-rendered image does not guarantee.
 *
 * The geometry itself is NOT re-derived: corners come from
 * `memberLocalCornersIn` and faces from `memberFaceIndices`, the very functions
 * the live 3D view and the OBJ exporter already share. So this view cannot
 * disagree with those about what a panel is shaped like.
 */

/** View-space is Y-up: X = panel width, Y = height, Z = depth through the wall
 * with 0 at the EXTERIOR face (see `componentSchema`'s `MemberPosition`). */
export interface AxonometricAngles {
  /** Degrees swung off looking straight at the exterior face. Positive swings
   * the camera toward +X, which puts the panel's left end nearer the viewer. */
  yawDeg: number;
  /** Degrees raised above the panel's own horizon, so the top faces read. */
  pitchDeg: number;
}

/**
 * Exterior face, tilted up and to the left — Tommy's words, as angles.
 *
 * 28° of pitch and 26° of yaw: enough that the top and one end read as solid
 * form, little enough that the exterior face still dominates and a fabricator
 * reads the panel rather than a box. A 45° yaw weights face and end equally,
 * which is a nice picture and a worse drawing.
 */
export const SHOP_DRAWING_ANGLES: AxonometricAngles = { yawDeg: 26, pitchDeg: 28 };

export interface ProjectedPoint {
  /** Projected horizontal, in inches — NOT pixels. The caller fits and scales. */
  uIn: number;
  /** Projected vertical, in inches, already Y-DOWN for SVG. */
  vIn: number;
  /** Distance from the viewer, for sorting. Larger is farther away. */
  depthIn: number;
}

export interface AxonometricFace {
  /** Index into the `members` array this face belongs to. */
  memberIndex: number;
  points: { uIn: number; vIn: number }[];
  /** Mean depth of the face's own corners — the painter's-algorithm key. */
  depthIn: number;
  /** 0..1 brightness from the face's angle to the light. */
  shade: number;
}

export interface PanelAxonometric {
  faces: AxonometricFace[];
  /** One per member, in the same order as the input list.
   *
   * ⚠ Carries `depthIn` because the sheet labels only the NEAREST occurrence
   * of each cut (Tommy, 2026-10-13). A 3D view shows both wythes, so every
   * letter would otherwise appear twice — about 24 badges on a braced panel
   * whose cut list has 7 letters — burying the drawing the badges are there
   * to explain. Pointing a leader at a member hidden behind another is also
   * worse than useless, so near is the right one to keep. */
  centroids: { uIn: number; vIn: number; depthIn: number }[];
  bounds: { minU: number; minV: number; maxU: number; maxV: number };
}

/**
 * Rotate a view-space point by yaw (about the vertical axis) then pitch (about
 * the horizontal), and drop it to 2D.
 *
 * ⚠ The returned `vIn` is already negated into SVG's y-down convention, so no
 * caller has to remember to flip it — forgetting that flip renders a panel
 * upside down, which looks plausible enough on a symmetrical panel to survive
 * a glance.
 */
export function projectPoint(
  x: number,
  y: number,
  z: number,
  { yawDeg, pitchDeg }: AxonometricAngles,
): ProjectedPoint {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const u = x * cosYaw - z * sinYaw;
  const zAfterYaw = x * sinYaw + z * cosYaw;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const v = y * cosPitch - zAfterYaw * sinPitch;
  const depth = y * sinPitch + zAfterYaw * cosPitch;
  return { uIn: u, vIn: -v, depthIn: depth };
}

/** Light from over the viewer's left shoulder, slightly above — the convention
 * every axonometric shop drawing uses, so the top face is brightest and the
 * two visible sides separate from each other. */
const LIGHT: [number, number, number] = [-0.35, 0.86, -0.37];

function faceShade(corners: [number, number, number][], indices: number[]): number {
  // Newell's method: a stable normal for any polygon, including the non-planar
  // ones a trapezoid prism's side quads can become under floating point.
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < indices.length; i++) {
    const a = corners[indices[i]! - 1]!;
    const b = corners[indices[(i + 1) % indices.length]! - 1]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len === 0) return 1;
  const dot = Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / len);
  // Floor at 0.62 rather than 0: an unlit face on a shop drawing should still
  // show its edges and its wood colour, not read as a hole in the panel.
  return 0.62 + 0.38 * Math.min(1, dot);
}

/* ─────────────────── drawing order ───────────────────
   ⚠ **A PANEL IS SORTED MEMBER BY MEMBER, NOT FACE BY FACE — 2026-11-24.**

   The old order was one `faces.sort()` on each face's MEAN depth, and it had
   a standing defect nobody had named: mean depth conflates TALL with FAR.
   `projectPoint` folds height into depth (`y * sinPitch`), so a 95in stud's
   side face takes its depth from its own mid-height and sorts to the back,
   while the 3/4in plywood plate it stands on sorts to the front and is
   painted over it. Tommy found it on a gable tile whose studs are only
   15 5/8in, where that stripe is a fifth of the drawing:

   > *"the vertical studs on this very small panel need to sit on top of the
   > 3/4-in plywood plate underneath it. It appears as though they are
   > overlapping at the bottom of the studs."*

   They were not overlapping. `overlappingMemberPairs` returns nothing for
   that panel, and a stud's base is exactly the plywood's top face. The
   geometry was right and the drawing was lying.

   **What makes the fix possible is his own no-overlap rule.** Two solids
   that share volume have no correct draw order at all; a set of solids that
   merely touch has one, and the audit now says every panel in the catalog is
   such a set. So the members are ordered against each other first — by where
   their own near surfaces actually are, wherever their silhouettes overlap —
   and only then are each member's own faces sorted among themselves, which
   mean depth has always got right for a single convex board.

   Measured as the fraction of drawn area painted by a face that is genuinely
   farther than the face it covers: Tommy's gable tile **10.05% -> 0.00%**, a
   48in gable 10.05% -> 2.11%, a 48in standard 9.81% -> 1.88%, a 48in braced
   chevron 9.11% -> 3.66%. See `panelAxonometric.test.ts`, which scores it
   rather than trusting it.

   What is left over is a girt bar and the web resting on it, which genuinely
   interleave in projection: over part of their shared outline the bar is
   nearer and over the rest the web is. No per-member order settles that; it
   wants faces split, which is not worth it for a hairline on a shop drawing.

   ⚠ **And some of the residue is a MODEL defect, not a drawing one, which
   is worth keeping.** A 48in standard panel with the optional nailer scores
   6.33% where the same panel without it scores 1.88% — the difference is
   `stud_centre_1_exterior x nailer`, the pair the Review Log reports as two
   boards in one volume, *"the same board asked for twice."* Nothing drawn can
   order a pair that occupies one space. When the overlap goes, so does the
   stripe. */

interface Point2D {
  u: number;
  v: number;
}

/** A member's whole projection: its faces, and the silhouette around them. */
interface ProjectedSolid {
  memberIndex: number;
  faces: AxonometricFace[];
  /** Face corner depths, parallel to `faces[i].points`, for ray sampling. */
  faceDepths: number[][];
  hull: Point2D[];
  minDepth: number;
  maxDepth: number;
  meanDepth: number;
}

/** Monotone chain. Collinear points are dropped; a degenerate set returns as-is. */
function convexHull2D(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.u - b.u || a.v - b.v);
  const cross = (o: Point2D, a: Point2D, b: Point2D) => (a.u - o.u) * (b.v - o.v) - (a.v - o.v) * (b.u - o.u);
  const build = (pts: Point2D[]) => {
    const out: Point2D[] = [];
    for (const p of pts) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const hull = [...build(sorted), ...build([...sorted].reverse())];
  return hull.length >= 3 ? hull : points;
}

/** Sutherland–Hodgman. `clipper` must be convex and wound counter-clockwise. */
function clipPolygon(subject: Point2D[], clipper: Point2D[]): Point2D[] {
  let out = subject;
  for (let i = 0; i < clipper.length && out.length > 0; i++) {
    const a = clipper[i]!;
    const b = clipper[(i + 1) % clipper.length]!;
    const side = (p: Point2D) => (b.u - a.u) * (p.v - a.v) - (b.v - a.v) * (p.u - a.u);
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j]!;
      const prev = input[(j + input.length - 1) % input.length]!;
      const sc = side(cur);
      const sp = side(prev);
      if (sc >= 0) {
        if (sp < 0) {
          const t = sp / (sp - sc);
          out.push({ u: prev.u + t * (cur.u - prev.u), v: prev.v + t * (cur.v - prev.v) });
        }
        out.push(cur);
      } else if (sp >= 0) {
        const t = sp / (sp - sc);
        out.push({ u: prev.u + t * (cur.u - prev.u), v: prev.v + t * (cur.v - prev.v) });
      }
    }
  }
  return out;
}

function polygonCentroid(poly: Point2D[]): Point2D {
  let u = 0;
  let v = 0;
  for (const p of poly) {
    u += p.u;
    v += p.v;
  }
  return { u: u / poly.length, v: v / poly.length };
}

function counterClockwise(poly: Point2D[]): Point2D[] {
  let twiceArea = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    twiceArea += p.u * q.v - q.u * p.v;
  }
  return twiceArea < 0 ? [...poly].reverse() : poly;
}

/**
 * The depth of a face's own surface at `(u, v)`, or null if the point misses
 * it. A triangle fan with barycentric weights, which is exact for the planar
 * quads and tolerant of the slightly non-planar ones a trapezoid prism's side
 * walls become under floating point (the same caveat `faceShade` carries).
 */
function faceDepthAt(points: readonly Point2D[], depths: readonly number[], u: number, v: number): number | null {
  for (let i = 1; i + 1 < points.length; i++) {
    const a = points[0]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const den = (b.v - c.v) * (a.u - c.u) + (c.u - b.u) * (a.v - c.v);
    if (Math.abs(den) < 1e-12) continue;
    const wa = ((b.v - c.v) * (u - c.u) + (c.u - b.u) * (v - c.v)) / den;
    const wb = ((c.v - a.v) * (u - c.u) + (a.u - c.u) * (v - c.v)) / den;
    const wc = 1 - wa - wb;
    if (wa >= -1e-9 && wb >= -1e-9 && wc >= -1e-9) {
      return wa * depths[0]! + wb * depths[i]! + wc * depths[i + 1]!;
    }
  }
  return null;
}

/** Where a view ray at `(u, v)` first meets this member, or null if it misses. */
function nearestDepthAt(solid: ProjectedSolid, u: number, v: number): number | null {
  let nearest: number | null = null;
  for (let i = 0; i < solid.faces.length; i++) {
    const d = faceDepthAt(solid.faces[i]!.points.map((p) => ({ u: p.uIn, v: p.vIn })), solid.faceDepths[i]!, u, v);
    if (d !== null && (nearest === null || d < nearest)) nearest = d;
  }
  return nearest;
}

/**
 * Members ordered FARTHEST FIRST.
 *
 * Pairs whose depth ranges do not meet are settled outright. The rest are
 * voted on: sample inside the two silhouettes' shared region, ask each member
 * where its own near surface is there, and let the majority of samples decide.
 * A vote that ties, or a ray that misses both, leaves the pair unconstrained —
 * which is the honest answer when two boards do not really occlude each other.
 *
 * The result is a topological sort of those constraints, seeded in mean-depth
 * order so that unconstrained pairs keep exactly the order they have always
 * had, and so a cycle (two boards each in front of the other somewhere —
 * possible, and not worth splitting faces over on a shop drawing) degrades to
 * that old order rather than to nothing.
 */
function orderSolidsBackToFront(solids: ProjectedSolid[]): ProjectedSolid[] {
  const n = solids.length;
  /* `drawnBefore[x]` holds the members that must be painted AFTER x, because
     x is the farther one wherever the two meet. Stated that way round on
     purpose: "in front of" reads naturally and is the opposite of the
     painting order, which is exactly the slip to avoid here. */
  const drawnBefore: Set<number>[] = solids.map(() => new Set<number>());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = solids[i]!;
      const b = solids[j]!;
      // Separated along the view axis: no sampling needed, and this is most pairs.
      if (a.maxDepth <= b.minDepth) {
        drawnBefore[j]!.add(i); // a is in front, so b is painted first
        continue;
      }
      if (b.maxDepth <= a.minDepth) {
        drawnBefore[i]!.add(j);
        continue;
      }
      const shared = clipPolygon(a.hull, b.hull);
      if (shared.length < 3) continue;
      const centre = polygonCentroid(shared);
      let aFront = 0;
      let bFront = 0;
      const samples: Point2D[] = [centre];
      for (const p of shared)
        for (const t of [0.4, 0.75])
          samples.push({ u: centre.u + (p.u - centre.u) * t, v: centre.v + (p.v - centre.v) * t });
      for (const sample of samples) {
        const da = nearestDepthAt(a, sample.u, sample.v);
        const db = nearestDepthAt(b, sample.u, sample.v);
        // 1e-4in: flush-touching boards share a surface, and a tie there says
        // nothing about which one the viewer sees.
        if (da === null || db === null || Math.abs(da - db) < 1e-4) continue;
        if (da < db) aFront++;
        else bFront++;
      }
      if (aFront > bFront) drawnBefore[j]!.add(i);
      else if (bFront > aFront) drawnBefore[i]!.add(j);
    }
  }

  const seed = [...solids.keys()].sort((a, b) => solids[b]!.meanDepth - solids[a]!.meanDepth);
  const order: number[] = [];
  const settled = new Set<number>();
  const onStack = new Set<number>();
  const visit = (i: number) => {
    if (settled.has(i) || onStack.has(i)) return; // revisiting on the stack IS the cycle
    onStack.add(i);
    for (const j of seed) if (drawnBefore[j]!.has(i)) visit(j);
    onStack.delete(i);
    settled.add(i);
    order.push(i);
  };
  for (const i of seed) visit(i);
  return order.map((i) => solids[i]!);
}

/**
 * Every visible face of every member, projected and sorted FARTHEST FIRST so a
 * caller can simply draw them in order (the painter's algorithm) — member by
 * member, for the reasons set out above this function.
 *
 * ⚠ Back-face culling is deliberately NOT done. A panel's members are thin
 * boards seen nearly edge-on at the ends, and culling by winding would drop
 * faces whose normals round to zero area under projection — leaving visible
 * gaps in a drawing someone is going to build from. Painting every face costs
 * a few hundred extra polygons and cannot produce a hole.
 */
export function projectPanelAxonometric(
  members: readonly PanelMember[],
  angles: AxonometricAngles = SHOP_DRAWING_ANGLES,
): PanelAxonometric {
  const solids: ProjectedSolid[] = [];
  const centroids: { uIn: number; vIn: number; depthIn: number }[] = [];
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;

  members.forEach((member, memberIndex) => {
    const corners = memberLocalCornersIn(member);
    const projected = corners.map((c) => projectPoint(c[0], c[1], c[2], angles));

    let sumU = 0;
    let sumV = 0;
    let sumDepth = 0;
    let solidMinDepth = Infinity;
    let solidMaxDepth = -Infinity;
    for (const p of projected) {
      sumU += p.uIn;
      sumV += p.vIn;
      sumDepth += p.depthIn;
      if (p.uIn < minU) minU = p.uIn;
      if (p.uIn > maxU) maxU = p.uIn;
      if (p.vIn < minV) minV = p.vIn;
      if (p.vIn > maxV) maxV = p.vIn;
      if (p.depthIn < solidMinDepth) solidMinDepth = p.depthIn;
      if (p.depthIn > solidMaxDepth) solidMaxDepth = p.depthIn;
    }
    centroids.push({
      uIn: sumU / projected.length,
      vIn: sumV / projected.length,
      depthIn: sumDepth / projected.length,
    });

    const faces: AxonometricFace[] = [];
    const faceDepths: number[][] = [];
    for (const indices of memberFaceIndices(member)) {
      const pts = indices.map((i) => projected[i - 1]!);
      faces.push({
        memberIndex,
        points: pts.map((p) => ({ uIn: p.uIn, vIn: p.vIn })),
        depthIn: pts.reduce((sum, p) => sum + p.depthIn, 0) / pts.length,
        shade: faceShade(corners, indices),
      });
      faceDepths.push(pts.map((p) => p.depthIn));
    }
    // Each member's own faces: mean depth is exact for one convex board.
    const faceOrder = [...faces.keys()].sort((a, b) => faces[b]!.depthIn - faces[a]!.depthIn);

    solids.push({
      memberIndex,
      faces: faceOrder.map((i) => faces[i]!),
      faceDepths: faceOrder.map((i) => faceDepths[i]!),
      hull: counterClockwise(convexHull2D(projected.map((p) => ({ u: p.uIn, v: p.vIn })))),
      minDepth: solidMinDepth,
      maxDepth: solidMaxDepth,
      meanDepth: sumDepth / projected.length,
    });
  });

  return {
    faces: orderSolidsBackToFront(solids).flatMap((s) => s.faces),
    centroids,
    bounds: Number.isFinite(minU) ? { minU, minV, maxU, maxV } : { minU: 0, minV: 0, maxU: 0, maxV: 0 },
  };
}

/** Darkens a `#rrggbb` by a 0..1 shade, for a face's own fill. */
export function shadeHex(hex: string, shade: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const channel = (pair: string) => {
    const scaled = Math.round(Math.min(255, Math.max(0, parseInt(pair, 16) * shade)));
    return scaled.toString(16).padStart(2, "0");
  };
  return `#${channel(m[1]!)}${channel(m[2]!)}${channel(m[3]!)}`;
}
