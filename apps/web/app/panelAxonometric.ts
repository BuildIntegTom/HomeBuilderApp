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
  /** One per member, in the same order as the input list. */
  centroids: { uIn: number; vIn: number }[];
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

/**
 * Every visible face of every member, projected and sorted FARTHEST FIRST so a
 * caller can simply draw them in order (the painter's algorithm).
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
  const faces: AxonometricFace[] = [];
  const centroids: { uIn: number; vIn: number }[] = [];
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;

  members.forEach((member, memberIndex) => {
    const corners = memberLocalCornersIn(member);
    const projected = corners.map((c) => projectPoint(c[0], c[1], c[2], angles));

    let sumU = 0;
    let sumV = 0;
    for (const p of projected) {
      sumU += p.uIn;
      sumV += p.vIn;
      if (p.uIn < minU) minU = p.uIn;
      if (p.uIn > maxU) maxU = p.uIn;
      if (p.vIn < minV) minV = p.vIn;
      if (p.vIn > maxV) maxV = p.vIn;
    }
    centroids.push({ uIn: sumU / projected.length, vIn: sumV / projected.length });

    for (const indices of memberFaceIndices(member)) {
      const pts = indices.map((i) => projected[i - 1]!);
      faces.push({
        memberIndex,
        points: pts.map((p) => ({ uIn: p.uIn, vIn: p.vIn })),
        depthIn: pts.reduce((sum, p) => sum + p.depthIn, 0) / pts.length,
        shade: faceShade(corners, indices),
      });
    }
  });

  faces.sort((a, b) => b.depthIn - a.depthIn);

  return {
    faces,
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
