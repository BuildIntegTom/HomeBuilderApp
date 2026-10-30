import { standardPanelBom, standardPanelHeightIn } from "./data";
import type { PanelMember, PanelSpacePoint2D, PlanSpacePoint2D } from "./componentSchema";

/**
 * Shared cross-section constants + member builders behind both
 * `buildStandardPanelMembers` and `buildBracedPanelMembers` — a braced
 * panel is a standard panel's skins/plates/studs/nailer with a different
 * number of girt rows plus a diagonal brace, so those 4 pieces live here
 * once instead of being duplicated per panel type.
 */

/**
 * Translates a true beveled brace's 4 absolute panel-space corners by
 * (deltaXIn, deltaZIn) — for callers that reposition an already-built
 * member array (e.g. openingAssemblyMembers.ts's `shiftAndPrefix`,
 * columnPanelMembers.ts's `shiftMembersX`). A brace's actual rendered
 * geometry comes from these corners directly (see `memberLocalCornersIn`),
 * NOT from `position.xIn`/`zIn` — a caller that only shifts the latter
 * silently leaves the real geometry behind. Preserves the 4-tuple type
 * (a plain `.map()` degrades it to a general array).
 */
export function shiftTrapezoidCorners(
  corners: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] | undefined,
  deltaXIn: number,
  deltaZIn: number,
): [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] | undefined {
  if (!corners) return undefined;
  return corners.map((c) => ({ xIn: c.xIn + deltaXIn, zIn: c.zIn + deltaZIn })) as [
    PanelSpacePoint2D,
    PanelSpacePoint2D,
    PanelSpacePoint2D,
    PanelSpacePoint2D,
  ];
}

export const SKIN_THICKNESS_IN = standardPanelBom.bottomPlateSkin.thicknessIn; // 0.75
export const SKIN_PLY_SPEC = "3/4in_5ply_CDX";
export const PLATE_2X4_THICKNESS_IN = 1.5; // standard nominal 2x4 actual thickness
export const PLATE_2X4_WIDTH_IN = 3.5; // standard nominal 2x4 actual width
export const LUMBER_SPECIES_GRADE = "No. 2 Pine";
export const GIRT_WEB_THICKNESS_IN = standardPanelBom.girts.web.thicknessIn; // 0.5
export const GIRT_WEB_HEIGHT_IN = standardPanelBom.girts.web.widthIn; // 8.75
export const GIRT_WEB_PLY_SPEC = "1/2in_3ply_CDX";
export const NAILER_THICKNESS_IN = standardPanelBom.nailer.thicknessIn; // 1.5
export const NAILER_WIDTH_IN = standardPanelBom.nailer.widthIn; // 3.5

/**
 * A `plySpec` as a human reads it: `"3/4in_5ply_CDX"` -> `"3/4in 5-ply CDX"`.
 *
 * Exists so the Material Totals and Project Summary rows can SAY the real
 * spec — thickness, ply count and grade — instead of carrying their own prose
 * copy of it. Tommy asked for the grade by name (*"1/2\" CDX plywood should be
 * a material that we calculate with all the totals and summary pages next to
 * 3/4\" stats."*), and the two rows said neither "CDX" nor a ply count while
 * this package had both all along. **The ply count is the part a reader would
 * not guess: the 3/4in sheet is 5-ply and the 1/2in sheet is 3-ply**, which
 * matters to whoever orders sheets.
 *
 * Deliberately a dumb token formatter, not a parser: an unrecognised spec
 * comes back with its underscores turned to spaces rather than throwing or
 * being silently dropped, because a label is never worth a crash.
 */
export function formatPlySpecLabel(plySpec: string): string {
  return plySpec
    .split("_")
    .map((token) => (/^\d+ply$/.test(token) ? `${token.replace("ply", "")}-ply` : token))
    .join(" ");
}

// Tommy: bottom/top plate 2x4s sit "centered on Nin width, 1.5in clear
// each end" — a fixed clearance rule, independent of the selected width.
export const PLATE_END_CLEARANCE_IN = 1.5;

// Tommy: the web plywood is 0.5in longer than the clear span between the
// two stud doubles (split evenly, 0.25in overlap onto each girt bar's
// span) — extra bearing surface for where it rests on the bars, not a
// literal edge-to-edge fit.
export const WEB_OVERHANG_TOTAL_IN = 0.5;

// Derived from the confirmed 120in-tall reference BOM's nailer length
// (115.5in — a 4.5in total deficit vs. the full panel height); applied at
// whatever height is actually selected.
export const NAILER_LENGTH_DEFICIT_IN = standardPanelHeightIn.value - standardPanelBom.nailer.lengthIn;

/**
 * The X/Y/Z box size (inches) a renderer/exporter should draw for this
 * member, derived from its `actualDimsIn` per (orientation, rotationDeg):
 * - "flat", 0deg (skins, plate 2x4s, girt web): lying flat on the XY plane — X=length, Y=width, Z=thickness.
 * - "vertical", 0deg (studs, nailer): standing upright — X=thickness, Y=width, Z=length.
 * - "diagonal", 0deg: tilted brace, wide face spanning Y — X=thickness, Y=width, Z=length (unused today).
 * - "diagonal", 90deg (braced panel's diagonal braces, header/gable/truss web braces): rotated so the
 *   wide face spans X instead — X=width, Y=thickness, Z=length — keeps the brace confined to a thin
 *   Y-slice (e.g. the exterior wythe) instead of centered across the panel's full depth.
 * - "horizontal", 90deg: standing on its 1.5in edge, spanning Y — X=thickness, Y=length, Z=width
 *   (unused today, kept for a future member that genuinely stands tall on its narrow edge).
 * - "horizontal", 180deg (girt bars, Tommy: "rotate girt bars 90 degrees hotdog style" — rolled about
 *   its own long/Y axis from the 90deg case above): laid onto its wide 3.5in face instead, spanning Y —
 *   X=width, Y=length, Z=thickness — a real bearing ledge (3.5in) for the girt web to rest on, with
 *   only a thin (1.5in) vertical footprint.
 * - "horizontal", 0deg: on edge, spanning X — X=length, Y=thickness, Z=width (unused today, kept for a
 *   future member that genuinely stands on edge rather than lying flat).
 * Shared here (not duplicated per-consumer) since the 3D renderer and any
 * future SketchUp exporter both need to agree on it exactly.
 */
export function memberBoxSizeIn(member: PanelMember): { xIn: number; yIn: number; zIn: number } {
  const { thicknessIn: t, widthIn: w, lengthIn: l } = member.actualDimsIn;
  if (member.orientation === "diagonal" && member.position.rotationDeg === 90) return { xIn: w, yIn: t, zIn: l };
  if (member.orientation === "vertical" || member.orientation === "diagonal") return { xIn: t, yIn: w, zIn: l };
  if (member.orientation === "horizontal" && member.position.rotationDeg === 90) return { xIn: t, yIn: l, zIn: w };
  if (member.orientation === "horizontal" && member.position.rotationDeg === 180) return { xIn: w, yIn: l, zIn: t };
  if (member.orientation === "horizontal") return { xIn: l, yIn: t, zIn: w };
  return { xIn: l, yIn: w, zIn: t }; // "flat"
}

/** Every box/trapezoid-prism member's 6 quad faces, as 1-indexed corner
 * references into the 8-corner array `memberLocalCornersIn` returns — this
 * table is purely topological (which corner-index belongs to which face)
 * and works identically for a true box OR a trapezoid prism, since both
 * shapes share the same "2 sets of 4 corners, one at each depth extreme"
 * structure. Shared by the OBJ exporter (`buildPanelObj`/`buildBuildingObj`
 * in panelObjExport.ts) and the 3D renderer (`PanelMembersGroup.tsx`, which
 * builds a matching `THREE.BufferGeometry` from the same 8 corners for any
 * member carrying `position.trapezoidCornersIn`). */
export const BOX_FACES: [number, number, number, number][] = [
  [1, 2, 6, 5], // -Y face
  [2, 3, 7, 6], // +X face
  [3, 4, 8, 7], // +Y face
  [1, 4, 8, 5], // -X face
  [4, 3, 2, 1], // -Z face
  [5, 6, 7, 8], // +Z face
];

/** Coincidence/degeneracy tolerance for a plan-polygon ring, in inches —
 * same order as `SQUARE_TOLERANCE_IN` below, and used the same way: ring
 * points come from exact arithmetic (a clip against a straight band
 * boundary), so floating-point noise never approaches this, and a real
 * geometric feature is never this small. Purely numerical; not a
 * real-world building value. */
const POLYGON_TOLERANCE_IN = 1e-6;

/** Twice the signed area of a plan ring (the shoelace sum) — positive is
 * counter-clockwise in member-space plan coordinates. */
function planRingSignedArea2X(ring: PlanSpacePoint2D[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.xIn * b.yIn - b.xIn * a.yIn;
  }
  return sum;
}

function triangleCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/**
 * Inside-OR-ON test for a CCW triangle. Inclusive deliberately: an L-shaped
 * ring's reflex vertex can land exactly on a candidate ear's own edge (an L
 * whose notch corner sits on the chord between two other corners does this
 * on the very first clip), and treating that as "not inside" lets an ear be
 * clipped straight across the notch — a cap that covers the bounding shape
 * instead of the real one, silently. Matches how every production ear
 * clipper (earcut and friends) writes this test.
 */
function pointInOrOnTriangle(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  const d1 = triangleCross(ax, ay, bx, by, px, py);
  const d2 = triangleCross(bx, by, cx, cy, px, py);
  const d3 = triangleCross(cx, cy, ax, ay, px, py);
  return d1 >= -POLYGON_TOLERANCE_IN && d2 >= -POLYGON_TOLERANCE_IN && d3 >= -POLYGON_TOLERANCE_IN;
}

/**
 * Ear-clipping triangulation of a simple (non-self-intersecting) plan ring,
 * CONCAVE OR CONVEX — returns triangles as index triples into the ring
 * array, each wound counter-clockwise in plan space regardless of which way
 * the input ring itself is wound (self-normalizing, the same way
 * `computeBraceTrapezoidCornersIn` normalizes its own winding).
 *
 * Private to this file and hand-rolled rather than pulled in: this package
 * deliberately has no dependency on `packages/geometry` (the same reason
 * `BracePattern` in that package's `types.ts` is duplicated rather than
 * imported — see its own note), neither package has a triangulator
 * today, and both are dependency-free — so nothing is being duplicated and
 * no npm package is being added for ~40 lines.
 *
 * Duplicate and collinear vertices are dropped first (within
 * `POLYGON_TOLERANCE_IN`), so a band boundary landing exactly on a footprint
 * vertex doesn't produce zero-area triangles. Dropped vertices still EXIST
 * in the member's corner array — they simply sit on an edge of the
 * triangulated cap, which covers the same region either way.
 *
 * If no ear can be found, it falls back to a fan over the remaining vertices
 * rather than looping forever. Do NOT read that as unreachable: callers CAN
 * hand this a non-simple ring — `clipRingToHalfPlane` produces one when a
 * footprint edge lies exactly on a band boundary (see the Open Item). What
 * saves those cases in practice is the collinear/duplicate removal above,
 * which resolves the back-tracking before clipping starts; 12k fuzzed rings
 * found no cap the fan got wrong. Note the fallback's failure mode is a
 * SILENTLY wrong cap on a translucent member, not a visible one — so if a
 * ring ever does reach it, fix the ring upstream rather than the fan.
 */
function earClipRingTriangles(ring: PlanSpacePoint2D[]): [number, number, number][] {
  // Working list of ORIGINAL indices, with duplicates and collinear points removed.
  const kept: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const prev = kept.length > 0 ? ring[kept[kept.length - 1]!]! : undefined;
    if (prev && Math.hypot(p.xIn - prev.xIn, p.yIn - prev.yIn) <= POLYGON_TOLERANCE_IN) continue;
    kept.push(i);
  }
  while (kept.length > 2) {
    const first = ring[kept[0]!]!;
    const last = ring[kept[kept.length - 1]!]!;
    if (Math.hypot(first.xIn - last.xIn, first.yIn - last.yIn) <= POLYGON_TOLERANCE_IN) kept.pop();
    else break;
  }
  // Collinear pass — a vertex whose two neighbours' cross product vanishes
  // adds no shape, and would otherwise be clipped as a zero-area ear.
  for (let pass = 0; pass < kept.length && kept.length > 3; pass++) {
    let removedAny = false;
    for (let i = 0; i < kept.length && kept.length > 3; i++) {
      const a = ring[kept[(i - 1 + kept.length) % kept.length]!]!;
      const b = ring[kept[i]!]!;
      const c = ring[kept[(i + 1) % kept.length]!]!;
      if (Math.abs(triangleCross(a.xIn, a.yIn, b.xIn, b.yIn, c.xIn, c.yIn)) <= POLYGON_TOLERANCE_IN) {
        kept.splice(i, 1);
        i--;
        removedAny = true;
      }
    }
    if (!removedAny) break;
  }
  if (kept.length < 3) return [];

  // Ear clipping assumes one known orientation; normalize to CCW, then emit
  // every triangle CCW so callers get one predictable sense.
  const workRing = kept.map((i) => ring[i]!);
  const isCcw = planRingSignedArea2X(workRing) > 0;
  const work = isCcw ? [...kept] : [...kept].reverse();

  const triangles: [number, number, number][] = [];
  let guard = work.length * work.length + 8;
  while (work.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < work.length; i++) {
      const ai = work[(i - 1 + work.length) % work.length]!;
      const bi = work[i]!;
      const ci = work[(i + 1) % work.length]!;
      const a = ring[ai]!;
      const b = ring[bi]!;
      const c = ring[ci]!;
      if (triangleCross(a.xIn, a.yIn, b.xIn, b.yIn, c.xIn, c.yIn) <= POLYGON_TOLERANCE_IN) continue; // reflex or degenerate
      let blocked = false;
      for (const oi of work) {
        if (oi === ai || oi === bi || oi === ci) continue;
        const o = ring[oi]!;
        if (pointInOrOnTriangle(o.xIn, o.yIn, a.xIn, a.yIn, b.xIn, b.yIn, c.xIn, c.yIn)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      triangles.push([ai, bi, ci]);
      work.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // no ear found — fall through to the fan below
  }
  if (work.length === 3) {
    triangles.push([work[0]!, work[1]!, work[2]!]);
  } else if (work.length > 3) {
    for (let i = 1; i < work.length - 1; i++) triangles.push([work[0]!, work[i]!, work[i + 1]!]);
  }
  return triangles;
}

/**
 * One member's face topology, as 1-indexed references into the corner array
 * `memberLocalCornersIn` returns for that SAME member — the companion to
 * `BOX_FACES`, which it returns verbatim for every member without
 * `position.planPolygonCornersIn` (i.e. every plain box and every trapezoid
 * prism: both are "2 rings of 4 corners", which that fixed table already
 * describes exactly).
 *
 * For an n-gon prism (`planPolygonCornersIn` — the floor bottom skin's
 * footprint-shaped opacity bands) the corner array is 2n long, so a fixed
 * table can't describe it: this returns n side quads plus ear-clipped
 * triangle caps. Winding is normalized off the ring's own shoelace sign so
 * faces point outward either way, and NO face ever has more than 4 vertices
 * — the same tris-and-quads-only guarantee today's `.obj` already makes.
 *
 * Both consumers (`panelObjExport.ts` and `PanelMembersGroup.tsx`) call this
 * instead of reaching for `BOX_FACES` directly, which EXTENDS the "the
 * downloadable file can never visually disagree with what's on screen"
 * invariant `memberLocalCornersIn` established: corners and topology now
 * both come from one shared place, instead of corners shared and topology
 * assumed identically in two files.
 */
export function memberFaceIndices(member: PanelMember): number[][] {
  /* ⚠ A SECTION prism goes down the same n-gon path a plan prism does, and
     has to: its ring can be a TRIANGLE (the tall end's bearing wedge), which
     `BOX_FACES`' fixed 4-and-4 table cannot describe. The plane differs but
     the topology does not — both are two matching rings joined by side
     quads — so the section ring is relabelled into the same {xIn,yIn} shape
     purely to reuse that code. Winding may come out reversed for a section
     prism, the same caveat `memberLocalCornersIn` already carries. */
  const ring = member.position.trapezoidCornersIn
    ? undefined
    : (member.position.planPolygonCornersIn ?? member.position.sectionCornersIn?.map((c) => ({ xIn: c.zIn, yIn: c.yIn })));
  if (!ring) return BOX_FACES;
  const n = ring.length;
  if (n < 3) return [];

  const faces: number[][] = [];
  // Side quads: bottom-ring edge i->i+1, then up to the top ring and back.
  // This order faces outward for a CLOCKWISE plan ring, so a counter-
  // clockwise one is reversed. The CAPS need no such correction — their
  // winding comes from the ear clipper, which normalizes independently of
  // how the ring itself was handed in.
  const ringIsCcw = planRingSignedArea2X(ring) > 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const quad = [i + 1, j + 1, j + 1 + n, i + 1 + n];
    faces.push(ringIsCcw ? quad.reverse() : quad);
  }
  // `earClipRingTriangles` always returns CCW-in-plan triangles: on the
  // BOTTOM ring that already points down (-Y in view space), and the top cap
  // is the same triangle reversed so it points up. Same "one ring forward,
  // the other reversed" convention as `BOX_FACES`' own [4,3,2,1] / [5,6,7,8].
  const triangles = earClipRingTriangles(ring);
  for (const [a, b, c] of triangles) faces.push([a + 1, b + 1, c + 1]);
  for (const [a, b, c] of triangles) faces.push([c + 1 + n, b + 1 + n, a + 1 + n]);

  return faces;
}

/**
 * One member's 8 corners in VIEW SPACE (Y-up: X=width, Y=height up,
 * Z=depth) — the space the 3D renderer and the .obj file use, NOT the
 * member space its `position` fields are authored in (see `MemberPosition`
 * in componentSchema.ts, where Y=depth and Z=height up). This function is
 * where that swap happens (`position.zIn` -> Y, `position.yIn` -> Z); no
 * builder should be writing view-space coordinates itself.
 *
 * For a true beveled brace (`position.trapezoidCornersIn` present — see `computeBraceTrapezoidCornersIn`), the
 * 4 already-absolute panel-space (X,Z) corners are used directly as both
 * depth faces (`Y = position.yIn +- thicknessIn/2`, the same depth span
 * every diagonal brace already occupies) — no rotation math needed, since
 * they're already the real cut shape. Every other member: min-corner at
 * (0,0,0) for every orientation except "diagonal" (center-anchored,
 * rotated by `tiltDeg` around view-space Z — the same rotation `tiltDeg`
 * describes as member-space Y, matching the 3D renderer's `rotation.z`). Shared by `buildPanelObj`/`buildBuildingObj`
 * (panelObjExport.ts, one panel at a time / placed in world space) and
 * `PanelMembersGroup.tsx` (the on-screen 3D renderer) — one function, so
 * the downloadable .obj can never visually disagree with what's on screen.
 */
export function memberLocalCornersIn(member: PanelMember): [number, number, number][] {
  const { trapezoidCornersIn, planPolygonCornersIn, sectionCornersIn } = member.position;
  if (trapezoidCornersIn) {
    const halfThicknessIn = member.actualDimsIn.thicknessIn / 2;
    const centerDepthIn = member.position.yIn;
    const near: [number, number, number][] = trapezoidCornersIn.map((c) => [c.xIn, c.zIn, centerDepthIn - halfThicknessIn]);
    const far: [number, number, number][] = trapezoidCornersIn.map((c) => [c.xIn, c.zIn, centerDepthIn + halfThicknessIn]);
    return [...near, ...far];
  }

  // An n-gon PRISM (the floor bottom skin's footprint-shaped bands): the
  // ring is a member-space PLAN (X-Y) polygon, so member-Y is DEPTH and
  // becomes view-space Z, while `position.zIn` is HEIGHT and becomes
  // view-space Y — the same one swap this function performs for every other
  // member. 2n corners: the whole bottom ring, then the whole top ring one
  // thickness above it, so `memberFaceIndices`' `i <-> i + n` pairing holds.
  if (planPolygonCornersIn) {
    const bottomYIn = member.position.zIn;
    const topYIn = bottomYIn + member.actualDimsIn.thicknessIn;
    const bottom: [number, number, number][] = planPolygonCornersIn.map((c) => [c.xIn, bottomYIn, c.yIn]);
    const top: [number, number, number][] = planPolygonCornersIn.map((c) => [c.xIn, topYIn, c.yIn]);
    return [...bottom, ...top];
  }

  /* A beveled SECTION prism — the roof panel's plumb end cut. The 4 corners
     are already-absolute member-space (Y,Z), so they drop straight into view
     space as (Y -> view Z, Z -> view Y), the same one swap every branch here
     performs; the extrusion runs along X, which is the member's own box
     X-extent. Two rings of 4 in matching perimeter order, so `BOX_FACES`
     describes the topology exactly as it does for a trapezoid prism.

     ⚠ The rings differ in X here, where a box's and a trapezoid's differ in
     Z, so some of `BOX_FACES`' quads come out wound the other way. Both
     consumers already guard that: the renderer draws `DoubleSide` and the
     .obj's own importers treat winding as advisory. Normals are recomputed
     from the geometry on screen either way. */
  if (sectionCornersIn) {
    const nearXIn = member.position.xIn;
    const farXIn = nearXIn + memberBoxSizeIn(member).xIn;
    const near: [number, number, number][] = sectionCornersIn.map((c) => [nearXIn, c.zIn, c.yIn]);
    const far: [number, number, number][] = sectionCornersIn.map((c) => [farXIn, c.zIn, c.yIn]);
    return [...near, ...far];
  }

  const sizeIn = memberBoxSizeIn(member);
  const hx = sizeIn.xIn / 2;
  const hy = sizeIn.zIn / 2;
  const hz = sizeIn.yIn / 2;
  const { tiltDeg } = member.position;
  const isTilted = tiltDeg !== undefined;

  const centerX = isTilted ? member.position.xIn : member.position.xIn + hx;
  const centerY = isTilted ? member.position.zIn : member.position.zIn + hy;
  const centerZ = isTilted ? member.position.yIn : member.position.yIn + hz;
  const tiltRad = isTilted ? ((tiltDeg as number) * Math.PI) / 180 : 0;
  const cos = Math.cos(tiltRad);
  const sin = Math.sin(tiltRad);

  const localCorners: [number, number, number][] = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, hy, -hz],
    [-hx, hy, -hz],
    [-hx, -hy, hz],
    [hx, -hy, hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ];

  return localCorners.map(([x, y, z]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return [centerX + rx, centerY + ry, centerZ + z];
  });
}

/** Bottom + top plywood skins, spanning the full widthIn x depthIn footprint. */
export function buildSkins(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return [
    {
      memberId: "bottom_plate_skin",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
    },
    {
      memberId: "top_plate_skin",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: heightIn - SKIN_THICKNESS_IN, rotationDeg: 0 },
      role: "skin",
      qty: 1,
    },
  ];
}

/** Bottom + top plate 2x4s (ext + int wythe edges), 1.5in clear at each end. */
export function buildPlates(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const plateLengthIn = widthIn - 2 * PLATE_END_CLEARANCE_IN;
  const members: PanelMember[] = [];
  for (const [prefix, zIn] of [
    ["bottom", SKIN_THICKNESS_IN],
    ["top", heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN],
  ] as const) {
    members.push(
      {
        memberId: `${prefix}_plate_2x4_ext`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: plateLengthIn },
        orientation: "flat",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn: 0, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: "exterior-wythe edge",
      },
      {
        memberId: `${prefix}_plate_2x4_int`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: plateLengthIn },
        orientation: "flat",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn: depthIn - PLATE_2X4_WIDTH_IN, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: "interior-wythe edge",
      },
    );
  }
  return members;
}

/**
 * The spacing a wall panel's studs may never exceed.
 *
 * Equal to the floor/roof panel module on purpose. A floor or roof panel
 * carries its joists on its two side edges, so a seam lands every 24in; a
 * stud under every one of those seams is what makes the load path run
 * straight down instead of through a top plate in bending.
 *
 * > *"I like the idea of 4' panels potentially getting a nailer stud of
 * > different type of braced piece, allowing them to work with the floor and
 * > roof panels and be 4'."* — Tommy, 2026-10-23
 */
export const MAX_STUD_SPACING_IN = 24;

/**
 * The centre nailers a panel needs so no stud bay is wider than
 * `MAX_STUD_SPACING_IN`.
 *
 * A 48in panel gets one pair at mid-width; a 24in panel gets none. They are
 * built exactly like corner studs — one on each wythe, full stud span
 * between the skins — because that is what the floor seam above and below
 * needs to land on.
 */
/**
 * Where a panel's centre nailer studs sit across its width, as [start, end]
 * pairs. Exported so anything laying a member across the panel can break
 * around them instead of running through them.
 */
export function centreNailerStudSpansIn(widthIn: number): [number, number][] {
  const bays = Math.max(1, Math.ceil(widthIn / MAX_STUD_SPACING_IN - 1e-9));
  const spans: [number, number][] = [];
  for (let bay = 1; bay < bays; bay++) {
    const xIn = (widthIn * bay) / bays - PLATE_2X4_THICKNESS_IN / 2;
    spans.push([xIn, xIn + PLATE_2X4_THICKNESS_IN]);
  }
  return spans;
}

export function buildCentreNailerStuds(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const bays = Math.max(1, Math.ceil(widthIn / MAX_STUD_SPACING_IN - 1e-9));
  if (bays < 2) return [];
  /* ⚠ A centre nailer is a real stud: it sits ON the bottom plate and the
     top plate sits on IT. The corner posts run the full height instead,
     because they stand outside the plates' span in x and nothing is in their
     way. A centre nailer is not — it lands mid-plate, so it stops at the
     plate faces. Measured before this: four interferences, one per plate. */
  const plateFaceIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const studSpanIn = heightIn - 2 * plateFaceIn;
  const members: PanelMember[] = [];
  for (let bay = 1; bay < bays; bay++) {
    const centreXIn = (widthIn * bay) / bays - PLATE_2X4_THICKNESS_IN / 2;
    for (const [face, yIn] of [
      ["exterior", 0],
      ["interior", depthIn - PLATE_2X4_WIDTH_IN],
    ] as [string, number][]) {
      members.push({
        memberId: `stud_centre_${bay}_${face}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: studSpanIn },
        orientation: "vertical",
        position: { xIn: centreXIn, yIn, zIn: plateFaceIn, rotationDeg: 0 },
        role: "stud",
        qty: 1,
        notes:
          bay === 1 && face === "exterior"
            ? `centre nailer — keeps every stud bay at or under ${MAX_STUD_SPACING_IN}in so a floor or roof seam always lands on a stud`
            : undefined,
      });
    }
  }
  return members;
}

/** All 4 corner studs, spanning the full stud height between the 2 skins. */
export function buildCornerStuds(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const cornerXs = [0, widthIn - PLATE_2X4_THICKNESS_IN];
  const cornerYs = [0, depthIn - PLATE_2X4_WIDTH_IN];
  const members: PanelMember[] = [];
  let cornerIdx = 0;
  for (const yIn of cornerYs) {
    for (const xIn of cornerXs) {
      cornerIdx++;
      members.push({
        memberId: `stud_corner_${cornerIdx}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: studSpanIn },
        orientation: "vertical",
        position: { xIn, yIn, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
        role: "stud",
        qty: 1,
        notes: cornerIdx === 1 ? "one per corner, 4 total" : undefined,
      });
    }
  }
  return members;
}

/** Optional vertical nailer, centered along the width on the exterior wythe. */
/**
 * `offsetIn` slides the nailer along the exterior wythe from its default
 * centered position (Tommy: "nailer studs should be able to slide on the
 * wyth they are on" — square-bale panels lean on this heavily). This is a
 * numeric position control, not a literal drag gesture in the 3D/2D view
 * yet — flagged as a simplification of "slide."
 */
export function buildNailer(widthIn: number, heightIn: number, offsetIn = 0): PanelMember {
  const nailerLengthIn = heightIn - NAILER_LENGTH_DEFICIT_IN;
  return {
    memberId: "nailer",
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: NAILER_THICKNESS_IN, widthIn: NAILER_WIDTH_IN, lengthIn: nailerLengthIn },
    orientation: "vertical",
    position: { xIn: widthIn / 2 - NAILER_THICKNESS_IN / 2 + offsetIn, yIn: 0, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
    role: "nailer",
    qty: 1,
    notes:
      "OPTIONAL — \"with nailer\" vs \"bare standard\". 3.5in face oriented outward as exterior surface." +
      (offsetIn !== 0 ? ` Slid ${offsetIn > 0 ? "+" : ""}${offsetIn}in from center along the exterior wythe.` : " Centered on exterior wythe."),
  };
}

/**
 * Minimum brace angle (Tommy: "the math with the triangle parts of the
 * headers cannot go outside the range of 30-45 degrees") — used by
 * `computeTrussWebPeakCount` to decide how many repeating peaks a truss
 * web needs so no single web segment ends up too shallow. There's no
 * matching MAX constant because the upper bound only ever gets tighter as
 * peak count grows (more, narrower segments only get steeper), so nothing
 * needs to clamp against exceeding 45deg from this side — see that
 * function's own doc comment.
 */
export const TRUSS_WEB_MIN_ANGLE_DEG = 30;

/**
 * How many repeating peaks a "W-truss" web (see `buildTrussWebBraces`)
 * needs so every individual web segment's rise angle is at least
 * `TRUSS_WEB_MIN_ANGLE_DEG` — Tommy: "door headers just have one upside
 * down V" (1 peak) but a wider "long header" or a gable's full width
 * needs more, narrower peaks to stay in a sane bracing angle instead of
 * one shallow, wide one. `riseIn` is the (possibly conservative/shortest)
 * vertical rise available to a peak; `widthIn` is the full span being
 * webbed. Always returns at least 1 (an isolated call site — e.g. a door
 * header — can force exactly 1 regardless of this).
 */
export function computeTrussWebPeakCount(widthIn: number, riseIn: number): number {
  const minAngleRad = (TRUSS_WEB_MIN_ANGLE_DEG * Math.PI) / 180;
  const n = Math.ceil((widthIn * Math.tan(minAngleRad)) / (2 * riseIn));
  return Math.max(1, n);
}

/** The rise angle (degrees, from horizontal) one truss-web peak makes,
 * given how many peaks share `widthIn` and how much vertical `riseIn` each
 * has — the inverse of what `computeTrussWebPeakCount` solves for, used to
 * report/flag the actual resulting angle (e.g. a door header's forced
 * single peak might land outside the 30-45deg range for an unusually
 * wide/short opening; this is how a caller would notice and flag it). */
export function computeTrussWebAngleDeg(widthIn: number, riseIn: number, peakCount: number): number {
  const halfSegmentIn = widthIn / (2 * peakCount);
  return (Math.atan2(riseIn, halfSegmentIn) * 180) / Math.PI;
}

/**
 * The real end-cut bevel angle (degrees off a plain square crosscut) a
 * fabricator needs to cut a diagonal brace's end so it sits FLUSH — full
 * face contact, not just touching at one edge — against the flat,
 * horizontal surface it lands on (a chord, plate, or girt bar's own
 * top/bottom face) — Tommy: "lets come up with a way to really hone in on
 * the math involved with cutting the angles of braced panels."
 *
 * The derivation: every brace in this app tilts ONLY within the wall's own
 * elevation plane (X = along-wall, Z = height) — its depth-wise (Y)
 * dimension never rotates (see the "diagonal"+rotationDeg=90 case in
 * `memberBoxSizeIn`, which keeps the board's thin 1.5in face square to Y).
 * That means a single bevel (one miter-saw blade-tilt setting, around an
 * axis parallel to the board's own depth) is enough to produce a flat end
 * face flush against a horizontal surface — no compound/2-axis miter
 * needed, unlike e.g. a hip-roof rafter's cut.
 *
 * `tiltDeg` (`makeBrace`/`makeWebBrace`'s own `atan2(-(x1-centerX),
 * z1-centerZ)`) is a real rotation angle for drawing the box — perfectly
 * fine for that, since a box rotated 180deg from "true" occupies the exact
 * same visual space — but it's NOT normalized to a small "deviation from
 * plumb": swapping which endpoint a caller labels (x1,z1) vs (x2,z2) shifts
 * the raw value by a full 180deg, and it can come out anywhere in
 * (-180,180]. The real, physical tilt-off-plumb only ever needs a value in
 * [0,90] (a board can't lean past horizontal), so this first folds the raw
 * angle into (-90,90] — treating 180deg swings as the same physical board
 * — before taking the magnitude: a perfectly vertical board (folded value
 * 0) already meets a level surface at square (0deg off); a perfectly flat
 * one (folded value +-90) would need the cut plane running parallel to its
 * own length (90deg off square, the other limit). The board's own
 * centerline length (endpoint-to-endpoint, already how every brace's
 * `actualDimsIn.lengthIn` is computed) doesn't change — a bevel cut only
 * re-angles the end face around that same centerline endpoint, it doesn't
 * add or remove length.
 */
export function computeBraceEndCutAngleDeg(tiltDeg: number): number {
  const foldedDeg = (((tiltDeg + 90) % 180) + 180) % 180 - 90;
  return Math.abs(foldedDeg);
}

/**
 * The 4 absolute panel-space corners of a diagonal brace's true beveled
 * shape (Tommy: "trapezoid cuts... derived from the angle that the
 * trapezoid has been rotated"). A brace has 2 different end cuts, not one
 * angle at both ends: a LEVEL (horizontal) cut at the plate end, flush
 * against the plate's/girt's own flat face (`levelZIn`) — the existing
 * `computeBraceEndCutAngleDeg` angle — and a PLUMB (vertical) cut at the
 * stud end, flush against the stud's own face (`plumbXIn`) — the
 * complementary `90 - computeBraceEndCutAngleDeg(...)` angle. These 2 cuts
 * are never parallel to each other (except at exactly 45deg), so the
 * brace is a genuine trapezoid, not a parallelogram: one pair of parallel
 * sides (the 2 long edges, both parallel to the centerline `A->B`) and
 * one non-parallel pair (the 2 end cuts).
 *
 * Computed by intersecting the board's own 2 long edges — each offset
 * +-boardWidthIn/2 from the centerline along the width direction
 * perpendicular to it — against the 2 known target planes directly, more
 * robust than an abstract shear-angle formula (and verified to exactly
 * reproduce what `PanelMembersGroup.tsx`'s own `tiltDeg` rotation draws
 * for the untrimmed reference case).
 *
 * Self-normalizes winding (via the shoelace signed area) so every caller
 * — chevron and both hatch styles, which mirror which end is plumb vs.
 * level — always gets the same rotational sense `memberLocalCornersIn`'s
 * plain-box corners already use, keeping `BOX_FACES`' fixed face-index
 * topology valid for either shape. Because that normalization can swap
 * which array positions hold the long vs. short edges, `braceLongestEdgeIn`
 * below never assumes a fixed index pairing — see its own doc comment.
 */
export function computeBraceTrapezoidCornersIn(
  xA: number,
  zA: number,
  xB: number,
  zB: number,
  boardWidthIn: number,
  plumbXIn: number,
  levelZIn: number,
  /** When given, rigidly shifts the level end's own 2 corners (together,
   * never distorting the board's true width) so that whichever one sits
   * farther from the plumb end — the "long point" (Tommy: "i want the 2x4
   * trapezoid to end on the top plate with the long point ending where the
   * vertical stud and the plate 2x4 runner intersect") — lands exactly on
   * this X. A hard target, not a clamp that only engages when the raw
   * (unconstrained) computation would overshoot past it — it applies every
   * time it's given, even pulling the long point IN to reach the target if
   * the raw computation would otherwise have fallen short. A caller must
   * NOT instead clamp an overshooting corner's own `xIn` after the fact
   * (`buildDiagonalBraces`'s own prior approach) — that only moves the ONE
   * overshooting corner, shrinking the board's apparent cut width instead
   * of preserving it; shifting BOTH corners together (this parameter)
   * keeps the true `boardWidthIn` projection intact, exactly the fix
   * already proven for `computeHeaderBraceTrapezoidCornersIn`'s own
   * `boundaryXIn` (see `HeaderBraceLevelTarget`'s doc comment) — same
   * concept, adapted to this function's single implicit level end instead
   * of a per-end target list. */
  boundaryXIn?: number,
): [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] {
  const dx = xB - xA;
  const dz = zB - zA;
  const lengthIn = Math.hypot(dx, dz);
  const ux = dx / lengthIn;
  const uz = dz / lengthIn;
  const wx = uz;
  const wz = -ux;
  const halfWidthIn = boardWidthIn / 2;

  function edgeCorners(sign: 1 | -1): [PanelSpacePoint2D, PanelSpacePoint2D] {
    const px = xA + sign * halfWidthIn * wx;
    const pz = zA + sign * halfWidthIn * wz;
    const tPlumb = (plumbXIn - px) / ux;
    const tLevel = (levelZIn - pz) / uz;
    return [
      { xIn: plumbXIn, zIn: pz + tPlumb * uz },
      { xIn: px + tLevel * ux, zIn: levelZIn },
    ];
  }

  const [plumbPlus, levelPlus] = edgeCorners(1);
  const [plumbMinus, levelMinus] = edgeCorners(-1);

  let finalLevelPlus = levelPlus;
  let finalLevelMinus = levelMinus;
  if (boundaryXIn !== undefined) {
    const outerIsPlus = Math.abs(levelPlus.xIn - xA) > Math.abs(levelMinus.xIn - xA);
    const shiftIn = boundaryXIn - (outerIsPlus ? levelPlus.xIn : levelMinus.xIn);
    finalLevelPlus = { ...levelPlus, xIn: levelPlus.xIn + shiftIn };
    finalLevelMinus = { ...levelMinus, xIn: levelMinus.xIn + shiftIn };
  }

  const corners: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] = [
    plumbPlus,
    finalLevelPlus,
    finalLevelMinus,
    plumbMinus,
  ];

  let signedArea2x = 0;
  for (let i = 0; i < 4; i++) {
    const c = corners[i]!;
    const next = corners[(i + 1) % 4]!;
    signedArea2x += c.xIn * next.zIn - next.xIn * c.zIn;
  }
  return signedArea2x < 0 ? [corners[0]!, corners[3]!, corners[2]!, corners[1]!] : corners;
}

/** This end meets ANOTHER brace at a shared peak/foot point, rather than a
 * stationary plate/stud/chord face — Tommy: "insides of their long points
 * meet." `otherDirXIn`/`otherDirZIn` is the OTHER brace's own centerline
 * direction, pointing AWAY from this shared point into that other board's
 * own body (need not be normalized). */
export interface HeaderBraceMiterTarget {
  kind: "miter";
  otherDirXIn: number;
  otherDirZIn: number;
}

/** This end meets a stationary chord face (`levelZIn`) head-on, with NO
 * plumb constraint — Tommy, correcting an earlier spec: "notice that there
 * are no plum[b] cuts on headers — unlike full height braced panels — the
 * trapezoid has parallel cuts that meet the top and bottom chords... headers
 * for window openings and doors are made sideways in the shop." A header has
 * no internal vertical member for a brace to plumb-cut against (a braced
 * panel's corner/jack studs sit OUTSIDE a header's own truss, not inside
 * it) — every end, including the 2 outermost feet touching the bottom
 * chord, is a plain level cut, the same as an ordinary roof/floor truss's
 * web-to-chord joint. */
export interface HeaderBraceLevelTarget {
  kind: "level";
  levelZIn: number;
  /** Set only on the header's own 2 genuinely outermost feet (the first
   * rise brace's left foot at X=0, the last fall brace's right foot at
   * X=widthIn) — the true panel-edge X this end's OUTER edge (not its
   * centerline) must land flush against. A board has real width, so
   * offsetting a centerline point that sits exactly ON the boundary by
   * +-halfWidth always pushes one edge past it; `levelCorner` uses this to
   * shift the centerline reference inward by exactly enough that the outer
   * edge — not the centerline — ends up flush with `boundaryXIn`, keeping
   * the board's true, undistorted, constant cross-section width instead of
   * the previous "clamp whichever corner overshot" approach, which cut the
   * outer cap's apparent width in half instead of shifting the whole board. */
  boundaryXIn?: number;
}

export type HeaderBraceEndTarget = HeaderBraceMiterTarget | HeaderBraceLevelTarget;

/**
 * The 4 absolute panel-space corners of a header truss-web brace's true
 * beveled trapezoid shape, where EACH of its 2 ends can independently be
 * either a MITER (this brace meets another brace at a shared peak/foot) or
 * a LEVEL cut (this brace meets the header's own top/bottom chord directly,
 * no plumb component) — see `HeaderBraceMiterTarget`/`HeaderBraceLevelTarget`.
 *
 * Generalizes `computeBraceTrapezoidCornersIn`'s "2 well-separated
 * stationary targets" case (kept completely untouched — this is a new,
 * separate function, not a modification of it) to a header's own 2
 * different joint types, which that function can't produce correctly:
 *
 * - A brace-to-brace MITER is standard picture-frame-corner geometry — for
 *   2 board centerlines converging at a shared point, both directions
 *   pointing away from it, the cut plane bisects the angle between them
 *   (`normalize(dirA + dirB)`, cut line = its own perpendicular). This
 *   isn't generally axis-aligned, so it needs real line-line intersection,
 *   not `computeBraceTrapezoidCornersIn`'s axis-aligned parametric
 *   shortcut.
 * - A LEVEL end just intersects the board's 2 long edges with the single
 *   `levelZIn` plane — simpler than `computeBraceTrapezoidCornersIn`'s own
 *   2-target case (which needs a plumb target too), so it's handled
 *   directly here rather than by delegating to that function.
 */
export function computeHeaderBraceTrapezoidCornersIn(
  xA: number,
  zA: number,
  xB: number,
  zB: number,
  boardWidthIn: number,
  endA: HeaderBraceEndTarget,
  endB: HeaderBraceEndTarget,
): [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] {
  const dx = xB - xA;
  const dz = zB - zA;
  const lengthIn = Math.hypot(dx, dz);
  const ux = dx / lengthIn;
  const uz = dz / lengthIn;
  const wx = uz;
  const wz = -ux;
  const halfWidthIn = boardWidthIn / 2;

  function levelCorner(
    sign: 1 | -1,
    nearXIn: number,
    nearZIn: number,
    target: HeaderBraceLevelTarget,
    otherEndXIn: number,
  ): PanelSpacePoint2D {
    let effectiveNearXIn = nearXIn;
    if (target.boundaryXIn !== undefined) {
      // Half the board's own horizontal spread at this level cut (see the
      // shortcut derivation in HeaderBraceLevelTarget's own doc comment:
      // since nearZIn already sits exactly on target.levelZIn for every
      // real caller, xIn = nearXIn +- halfWidthIn/uz). Shifting the
      // centerline reference inward by exactly this amount, toward the
      // other end (the peak), makes the OUTER edge — not the centerline —
      // land exactly on boundaryXIn, so the board keeps its true width
      // instead of one corner getting clamped away.
      const halfSpanIn = Math.abs(halfWidthIn / uz);
      const dirSign = Math.sign(otherEndXIn - target.boundaryXIn) || 1;
      effectiveNearXIn = target.boundaryXIn + dirSign * halfSpanIn;
    }
    const px = effectiveNearXIn + sign * halfWidthIn * wx;
    const pz = nearZIn + sign * halfWidthIn * wz;
    const tLevel = (target.levelZIn - pz) / uz;
    return { xIn: px + tLevel * ux, zIn: target.levelZIn };
  }

  function miterCorner(
    sign: 1 | -1,
    nearXIn: number,
    nearZIn: number,
    ownDirXIn: number,
    ownDirZIn: number,
    target: HeaderBraceMiterTarget,
  ): PanelSpacePoint2D {
    const ex = nearXIn + sign * halfWidthIn * wx;
    const ez = nearZIn + sign * halfWidthIn * wz;
    const ownLenIn = Math.hypot(ownDirXIn, ownDirZIn);
    const oax = ownDirXIn / ownLenIn;
    const oaz = ownDirZIn / ownLenIn;
    const otherLenIn = Math.hypot(target.otherDirXIn, target.otherDirZIn);
    const obx = target.otherDirXIn / otherLenIn;
    const obz = target.otherDirZIn / otherLenIn;
    let bx = oax + obx;
    let bz = oaz + obz;
    const bLenIn = Math.hypot(bx, bz);
    if (bLenIn < 1e-9) {
      // The 2 braces run exactly opposite (a straight 180deg run) — any
      // perpendicular works as the bisector's own perpendicular.
      bx = -oaz;
      bz = oax;
    } else {
      bx /= bLenIn;
      bz /= bLenIn;
    }
    const cx = -bz; // cut line direction = perp(bisector), through the shared point
    const cz = bx;
    const denom = ux * cz - uz * cx;
    const t = ((nearXIn - ex) * cz - (nearZIn - ez) * cx) / denom;
    return { xIn: ex + t * ux, zIn: ez + t * uz };
  }

  function endCorner(sign: 1 | -1, end: "A" | "B"): PanelSpacePoint2D {
    const target = end === "A" ? endA : endB;
    const nearXIn = end === "A" ? xA : xB;
    const nearZIn = end === "A" ? zA : zB;
    const otherEndXIn = end === "A" ? xB : xA;
    const ownDirXIn = end === "A" ? ux : -ux;
    const ownDirZIn = end === "A" ? uz : -uz;
    return target.kind === "level"
      ? levelCorner(sign, nearXIn, nearZIn, target, otherEndXIn)
      : miterCorner(sign, nearXIn, nearZIn, ownDirXIn, ownDirZIn, target);
  }

  const corners: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] = [
    endCorner(1, "A"),
    endCorner(1, "B"),
    endCorner(-1, "B"),
    endCorner(-1, "A"),
  ];

  let signedArea2x = 0;
  for (let i = 0; i < 4; i++) {
    const c = corners[i]!;
    const next = corners[(i + 1) % 4]!;
    signedArea2x += c.xIn * next.zIn - next.xIn * c.zIn;
  }
  return signedArea2x < 0 ? [corners[0]!, corners[3]!, corners[2]!, corners[1]!] : corners;
}

/**
 * The longer of a trapezoid brace's 2 long (centerline-parallel) edges —
 * Tommy: "board feet numbers... calculated with these trapezoid pieces
 * from longest point to longest point" — written into `actualDimsIn.
 * lengthIn` in place of the plain centerline length, since
 * `computeBoardFeetByNominalSize` reads that field verbatim with no other
 * override mechanism.
 *
 * Never assumes which array positions hold the long vs. short edges —
 * `computeBraceTrapezoidCornersIn`'s winding self-normalization can swap
 * them. Instead this compares both possible opposite-edge pairings and
 * picks whichever pair has the greater total length: since a board's own
 * width (a few inches) is always tiny next to its real length (feet), the
 * true long pair's total is always far greater than the short pair's,
 * regardless of winding.
 */
export function braceLongestEdgeIn(corners: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D]): number {
  function dist(a: PanelSpacePoint2D, b: PanelSpacePoint2D): number {
    return Math.hypot(b.xIn - a.xIn, b.zIn - a.zIn);
  }
  const e01 = dist(corners[0], corners[1]);
  const e12 = dist(corners[1], corners[2]);
  const e23 = dist(corners[2], corners[3]);
  const e30 = dist(corners[3], corners[0]);
  return e01 + e23 > e12 + e30 ? Math.max(e01, e23) : Math.max(e12, e30);
}

export interface BraceEndCut {
  kind: "plumb" | "level" | "angled";
  /** Bevel angle off a square crosscut (perpendicular to the board's own
   * length), degrees, always in [0,90]. */
  angleDeg: number;
  /**
   * The cut edge's own length — the distance the saw actually travels across
   * the face.
   *
   * ⚠ Reported because it is the HYPOTENUSE of the triangle the cut removes,
   * and that triangle is what the shop builds a jig from. Tommy, 2026-10-11:
   * *"we will have to build a reversed triangle block for it - knowing the
   * missing rise and run dimensions would actually be critically helpful in
   * creating accurate jig blocks."* With this and `angleDeg`, both legs follow
   * exactly — `cutEdgeLengthIn * cos(angle)` across the face and
   * `* sin(angle)` along the length — with no need to re-derive the board's
   * width from somewhere else and no chance of disagreeing with the angle
   * printed beside it. See `missingTriangleFor` in `shopCutNotes.ts`.
   */
  cutEdgeLengthIn: number;
}

// Real cuts here are always constructed from exact arithmetic (a literal
// plumbXIn/levelZIn assignment, no trig involved) — floating-point noise
// from unrelated normalize/atan2 calls elsewhere never approaches this,
// so a tight tolerance is safe and won't misclassify a genuine miter as
// plumb/level or vice versa.
const SQUARE_TOLERANCE_IN = 1e-6;

/**
 * Classifies and measures BOTH of a trapezoid brace's own end cuts,
 * directly from its already-computed corners — general enough for ANY
 * trapezoid brace regardless of which function produced it (a Braced
 * Panel's plumb+level brace via `computeBraceTrapezoidCornersIn`, or a
 * header's mix of level and mitered ends via
 * `computeHeaderBraceTrapezoidCornersIn`), rather than assuming a fixed
 * "one plumb end, one complementary level end" shape the way deriving
 * everything from `tiltDeg` alone would. Each end's own cut edge (one of
 * the trapezoid's 2 SHORT edges — the pair NOT selected by
 * `braceLongestEdgeIn`'s own robust length-based long/short split, which
 * this reuses since winding-normalization can swap which array positions
 * hold which pair) is compared against the board's own square-crosscut
 * reference direction (perpendicular to the 2 LONG, centerline-parallel
 * edges) — the angle between them is the real bevel a fabricator needs to
 * cut. A cut edge with constant X is "plumb" (vertical); constant Z is
 * "level" (horizontal). "angled" means neither — a header brace never
 * produces this today (every end, including internal peaks/feet, is a
 * plain `HeaderBraceLevelTarget` — see `buildHeaderTrussWebBraces`'s own
 * doc comment); it only shows up for a genuinely non-axis-aligned miter,
 * which no current caller builds.
 */
export function describeBraceEndCuts(
  corners: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D],
): [BraceEndCut, BraceEndCut] {
  function edgeVec(a: PanelSpacePoint2D, b: PanelSpacePoint2D): [number, number] {
    return [b.xIn - a.xIn, b.zIn - a.zIn];
  }
  const e01 = edgeVec(corners[0], corners[1]);
  const e12 = edgeVec(corners[1], corners[2]);
  const e23 = edgeVec(corners[2], corners[3]);
  const e30 = edgeVec(corners[3], corners[0]);
  const len = (v: [number, number]) => Math.hypot(v[0], v[1]);
  const longIs0123 = len(e01) + len(e23) > len(e12) + len(e30);
  // The 2 LONG edges (parallel to the centerline) share one direction —
  // either one gives the board's own square-crosscut reference.
  const [longEdge, shortEdgeA, shortEdgeB] = longIs0123 ? [e01, e30, e12] : [e12, e01, e23];
  const squareLen = len(longEdge);
  const sqx = longEdge[1] / squareLen;
  const sqz = -longEdge[0] / squareLen;

  function describe(edge: [number, number]): BraceEndCut {
    const edgeLen = len(edge);
    const ex = edge[0] / edgeLen;
    const ez = edge[1] / edgeLen;
    const dot = ex * sqx + ez * sqz;
    const cross = ex * sqz - ez * sqx;
    let angleDeg = Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
    if (angleDeg > 90) angleDeg = 180 - angleDeg;
    const isPlumb = Math.abs(edge[0]) < SQUARE_TOLERANCE_IN;
    const isLevel = Math.abs(edge[1]) < SQUARE_TOLERANCE_IN;
    const kind = isPlumb ? "plumb" : isLevel ? "level" : "angled";
    return { kind, angleDeg, cutEdgeLengthIn: edgeLen };
  }

  return [describe(shortEdgeA), describe(shortEdgeB)];
}

/**
 * Two diagonal 2x4s can't literally converge to one shared atom-point
 * (Tommy: "the ends of the diagonal pieces of header brace should be
 * angled like the bracing panels" — the same "flank instead of pinch"
 * principle as a Braced Panel's chevron braces around its girt bar) — every
 * PEAK (a triangle's own rise meeting its own fall) and every INTERNAL foot
 * (one triangle's fall meeting the next triangle's rise) stops each piece
 * `PEAK_GAP_IN / 2` short of the shared point instead, flanking a small gap
 * the width of one 2x4. The very first/last foot (touching the continuous
 * bottom chord, not another diagonal piece) is unaffected.
 */
export const PEAK_GAP_IN = PLATE_2X4_THICKNESS_IN;

/** A point `distIn` inches from (fromX,fromZ) along the line toward (towardX,towardZ). */
function retreatPoint(fromXIn: number, fromZIn: number, towardXIn: number, towardZIn: number, distIn: number): [number, number] {
  const dx = towardXIn - fromXIn;
  const dz = towardZIn - fromZIn;
  const lenIn = Math.hypot(dx, dz);
  if (lenIn === 0) return [fromXIn, fromZIn];
  const t = distIn / lenIn;
  return [fromXIn + dx * t, fromZIn + dz * t];
}

/**
 * A tilted member running from (x1,z1) to (x2,z2) in a panel's own
 * width-height plane — "diagonal" orientation, center-anchored, rotated by
 * `tiltDeg` around world Z (see `memberBoxSizeIn`/`memberLocalCornersIn`'s
 * own "diagonal" handling). Originally the Gable End Panel's own private
 * helper for its sloped top plate/skin (reusing the exact same convention
 * the Braced Panel's brace already used); moved here so
 * `buildVerticalGapFillerMembers` (a capped gable tile's own sloped filler,
 * flush with the flat panel top below it) can build the same shape without
 * duplicating this trig.
 */
export function tiltedMember(
  memberId: string,
  material: PanelMember["material"],
  plySpec: string | null,
  nominalSize: string | null,
  thicknessIn: number,
  crossWidthIn: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  yIn: number,
  role: PanelMember["role"],
  notes: string,
): PanelMember {
  const centerX = (x1 + x2) / 2;
  const centerZ = (z1 + z2) / 2;
  const lengthIn = Math.hypot(x2 - x1, z2 - z1);
  const tiltDeg = (Math.atan2(-(x1 - centerX), z1 - centerZ) * 180) / Math.PI;
  return {
    memberId,
    material,
    speciesGrade: material === "dimensional_lumber" ? LUMBER_SPECIES_GRADE : null,
    plySpec,
    nominalSize,
    actualDimsIn: { thicknessIn, widthIn: crossWidthIn, lengthIn },
    orientation: "diagonal",
    position: { xIn: centerX, yIn, zIn: centerZ, rotationDeg: 0, tiltDeg },
    role,
    qty: 1,
    notes,
  };
}

/**
 * A continuous "W-truss" zigzag of `peakCount` triangular webs between a
 * flat bottom chord and a (possibly sloped) top chord — Tommy, from
 * reference photos of real straw-bale wall/gable bracing: repeating
 * "upside-down V" triangles sharing their feet/peaks continuously
 * (foot0-peak0-foot1-peak1-...-footN) rather than isolated, gapped
 * triangles, the same way a real truss's web members connect — except each
 * internal peak/foot flanks a small gap instead of sharing one exact point
 * (see `PEAK_GAP_IN`/`retreatPoint`). `topZAt(x)` lets the top chord follow
 * a slope (a Gable End Panel's rip) or stay flat (headers — pass a constant
 * function). Every brace is a 2x4, rotated 90deg so it's confined to a thin
 * (1.5in) Y-slice — pass `yIn` to place that slice on whichever wythe (see
 * the "diagonal" + rotationDeg=90 case in `memberBoxSizeIn`).
 */
export function buildTrussWebBraces(
  peakCount: number,
  widthIn: number,
  bottomZIn: number,
  topZAt: (xIn: number) => number,
  yIn: number,
  idPrefix: string,
): PanelMember[] {
  const members: PanelMember[] = [];
  const segWidthIn = widthIn / peakCount;

  function makeWebBrace(memberId: string, x1: number, z1: number, x2: number, z2: number, notes: string): PanelMember {
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const lengthIn = Math.hypot(x2 - x1, z2 - z1);
    const tiltDeg = (Math.atan2(-(x1 - centerX), z1 - centerZ) * 180) / Math.PI;
    return {
      memberId,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
      orientation: "diagonal",
      position: { xIn: centerX, yIn, zIn: centerZ, rotationDeg: 90, tiltDeg },
      role: "brace",
      qty: 1,
      notes,
    };
  }

  for (let i = 0; i < peakCount; i++) {
    const footLeftXIn = i * segWidthIn;
    const footRightXIn = (i + 1) * segWidthIn;
    const peakXIn = footLeftXIn + segWidthIn / 2;
    const peakZIn = topZAt(peakXIn);
    const halfGapIn = PEAK_GAP_IN / 2;

    const [riseFootXIn, riseFootZIn] =
      i === 0 ? [footLeftXIn, bottomZIn] : retreatPoint(footLeftXIn, bottomZIn, peakXIn, peakZIn, halfGapIn);
    const [risePeakXIn, risePeakZIn] = retreatPoint(peakXIn, peakZIn, footLeftXIn, bottomZIn, halfGapIn);
    const [fallPeakXIn, fallPeakZIn] = retreatPoint(peakXIn, peakZIn, footRightXIn, bottomZIn, halfGapIn);
    const [fallFootXIn, fallFootZIn] =
      i === peakCount - 1 ? [footRightXIn, bottomZIn] : retreatPoint(footRightXIn, bottomZIn, peakXIn, peakZIn, halfGapIn);

    members.push(
      makeWebBrace(
        `${idPrefix}_${i + 1}_rise`,
        riseFootXIn,
        riseFootZIn,
        risePeakXIn,
        risePeakZIn,
        `web ${i + 1} of ${peakCount}, rising from the bottom chord to the peak — stops short of the peak/foot on either end, flanking a small gap rather than pinching to a shared point with the adjacent piece.`,
      ),
      makeWebBrace(
        `${idPrefix}_${i + 1}_fall`,
        fallPeakXIn,
        fallPeakZIn,
        fallFootXIn,
        fallFootZIn,
        `web ${i + 1} of ${peakCount}, falling from the peak back to the bottom chord — stops short of the peak/foot on either end, flanking a small gap rather than pinching to a shared point with the adjacent piece.`,
      ),
    );
  }
  return members;
}

/**
 * A header-only sibling to `buildTrussWebBraces` — same continuous W-truss
 * zigzag of `peakCount` triangular webs between a flat bottom chord and a
 * flat top chord (a header's top chord never slopes, unlike a gable's
 * `topZAt`), but with TRUE beveled trapezoid ends instead of a plain
 * tilted box, and no `PEAK_GAP_IN` gap-flanking — Tommy: "Header panels on
 * windows and doors braces need to be trapeziod, have the insides of their
 * long points meet." No end is ever plumb-cut (Tommy, correcting an
 * earlier spec that gave the 2 outermost feet a plumb cut against the jack
 * stud: "there are no plum[b] cuts on headers — unlike full height braced
 * panels — the trapezoid has parallel cuts that meet the top and bottom
 * chords") — a header has no internal vertical member to plumb against; the
 * jack studs sit OUTSIDE the header's own truss, in the wall panel it's
 * installed into, not part of this assembly. `buildTrussWebBraces` itself
 * stays completely untouched (still plain-tilted-box, still gap-flanked) —
 * gable and classic-truss webs keep today's behavior; this is a
 * header-only addition, not a generalization of the shared function.
 *
 * Every internal peak (a triangle's own rise meeting its own fall) and
 * every internal foot (one triangle's fall meeting the next triangle's
 * rise) is, like the header's own 2 outermost feet, a plain LEVEL cut
 * against the flat chord it sits on — NOT a brace-to-brace MITER. Tommy,
 * live in the app: "the centerlines of those lumber pieces converge in the
 * center on the bottom edge of the 2x4 on the top plate... each tip of the
 * dimensional lumber edge of the braces should move away from the center
 * until their tips meet... they need to meet in the center with no space."
 * An earlier version DID use a brace-to-brace miter here — mathematically
 * plausible (2 boards meeting a shared point) but wrong for this specific
 * shape: a miter bisects the angle BETWEEN 2 boards, which only avoids
 * overlap when the 2 boards sit on genuinely different planes converging
 * at that angle (a true picture-frame corner). Here, both boards are
 * level-cut against the SAME flat chord — the miter math still produced a
 * cut line, but BOTH boards ended up claiming that entire cut line as
 * their own edge, so their solid bodies overlapped in a wedge right at the
 * joint instead of meeting flush. Since this is really "2 independent
 * level cuts sharing one target X," each side just needs its own
 * `boundaryXIn` (peakXIn for a peak, footLeftXIn/footRightXIn for an
 * internal foot) — the exact same mechanism the 2 outermost feet already
 * use to land their own outer edge flush with the end-cap plywood, reused
 * here with the shared joint's own X as the target instead of the panel's
 * true edge. See `computeHeaderBraceTrapezoidCornersIn`'s `boundaryXIn`
 * (on `HeaderBraceLevelTarget`) for the underlying trig — no changes were
 * needed there; only which target TYPE gets constructed for each end,
 * below, changed.
 */
export function buildHeaderTrussWebBraces(
  peakCount: number,
  widthIn: number,
  bottomZIn: number,
  topZIn: number,
  yIn: number,
  idPrefix: string,
): PanelMember[] {
  const members: PanelMember[] = [];
  const segWidthIn = widthIn / peakCount;
  const peakXAt = (idx: number) => idx * segWidthIn + segWidthIn / 2;

  function makeWebBrace(
    memberId: string,
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    end1: HeaderBraceEndTarget,
    end2: HeaderBraceEndTarget,
    notes: string,
  ): PanelMember {
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const tiltDeg = (Math.atan2(-(x1 - centerX), z1 - centerZ) * 180) / Math.PI;
    // The header's 2 genuinely outermost feet (end1/end2's own `level`
    // targets, when they carry `boundaryXIn`) already come out correctly
    // bounded at the source — see HeaderBraceLevelTarget's own doc comment
    // — so no post-hoc clamp is needed (an earlier version clamped
    // whichever corner overshot X=0/widthIn here instead, which cut that
    // outer cap's apparent width in half rather than shifting the whole
    // board; see panelMemberHelpers.test.ts's own regression test).
    const trapezoidCornersIn = computeHeaderBraceTrapezoidCornersIn(x1, z1, x2, z2, PLATE_2X4_WIDTH_IN, end1, end2);
    const lengthIn = braceLongestEdgeIn(trapezoidCornersIn);
    return {
      memberId,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
      orientation: "diagonal",
      position: { xIn: centerX, yIn, zIn: centerZ, rotationDeg: 90, tiltDeg, trapezoidCornersIn },
      role: "brace",
      qty: 1,
      notes,
    };
  }

  for (let i = 0; i < peakCount; i++) {
    const footLeftXIn = i * segWidthIn;
    const footRightXIn = (i + 1) * segWidthIn;
    const peakXIn = peakXAt(i);
    const peakZIn = topZIn;

    // The header's own 2 genuinely outermost feet must clear the end-cap
    // plywood (see buildHeaderEndCaps — a full-height sheet SKIN_THICKNESS_IN
    // wide at each of the header's true X=0/X=widthIn extremes), not land
    // flush with the bare panel edge itself, or the brace's own outer edge
    // cuts straight through that sheet (Tommy: "the points of the trapezoid
    // braced piece should be 3/4in plywood depth on the x axis towards the
    // center of the panel"). `boundaryXIn` already shifts the CENTERLINE
    // reference (not a raw corner) inward by exactly enough that the outer
    // EDGE — not the centerline — lands on this target, so the board keeps
    // its true undistorted width at whatever angle this brace happens to
    // tilt at (see HeaderBraceLevelTarget's own doc comment) — no separate
    // angle-specific adjustment needed here.
    // Every internal joint (a peak, or — for a multi-peak window header —
    // an internal foot between 2 adjacent triangles) is a LEVEL cut too,
    // targeting the shared joint's own X as `boundaryXIn` — same mechanism
    // as the outer feet above, just aimed at an internal point instead of
    // the panel's true edge. See this function's own doc comment for why a
    // brace-to-brace MITER (the previous approach) was wrong here.
    const riseFootEnd: HeaderBraceEndTarget =
      i === 0
        ? { kind: "level", levelZIn: bottomZIn, boundaryXIn: SKIN_THICKNESS_IN }
        : { kind: "level", levelZIn: bottomZIn, boundaryXIn: footLeftXIn };
    const risePeakEnd: HeaderBraceEndTarget = { kind: "level", levelZIn: topZIn, boundaryXIn: peakXIn };
    const fallPeakEnd: HeaderBraceEndTarget = { kind: "level", levelZIn: topZIn, boundaryXIn: peakXIn };
    const fallFootEnd: HeaderBraceEndTarget =
      i === peakCount - 1
        ? { kind: "level", levelZIn: bottomZIn, boundaryXIn: widthIn - SKIN_THICKNESS_IN }
        : { kind: "level", levelZIn: bottomZIn, boundaryXIn: footRightXIn };

    members.push(
      makeWebBrace(
        `${idPrefix}_${i + 1}_rise`,
        footLeftXIn,
        bottomZIn,
        peakXIn,
        peakZIn,
        riseFootEnd,
        risePeakEnd,
        `web ${i + 1} of ${peakCount}, rising from the bottom chord to the peak — true beveled trapezoid, long points meeting the adjacent brace(s) with no gap.`,
      ),
      makeWebBrace(
        `${idPrefix}_${i + 1}_fall`,
        peakXIn,
        peakZIn,
        footRightXIn,
        bottomZIn,
        fallPeakEnd,
        fallFootEnd,
        `web ${i + 1} of ${peakCount}, falling from the peak back to the bottom chord — true beveled trapezoid, long points meeting the adjacent brace(s) with no gap.`,
      ),
    );
  }
  return members;
}

/**
 * `rowCount` girt rows, evenly spaced across the stud span (Tommy: the
 * Standard Panel always uses 2; the Braced Panel uses 3+, see
 * `computeBracedGirtRowCount`). Each row is 2 short 2x4 bars (one per
 * stud double) plus 1 plywood web that rests flat on top of both bars,
 * spanning between them with a little extra bearing overhang past each
 * bar (`WEB_OVERHANG_TOTAL_IN`) — modeling how the web physically slides
 * down the stud channels into place during fabrication. Each bar's OUTER
 * edge sits flush to its stud pair's INSIDE face and extends inward
 * (toward the panel's center) by its own 3.5in face — rolled 90deg
 * "hotdog style" from a standing-on-edge orientation (Tommy: "rotate girt
 * bars 90 degrees hotdog style") so that wide face lies horizontal,
 * giving the web a real 3.5in-deep bearing ledge instead of a thin 1.5in
 * one; the bar's own vertical footprint shrinks to its 1.5in thickness.
 * Each row's own CENTER Z is a fixed fraction of the total stud span
 * (Tommy: "the center of the girt bar... should be [determined] based on
 * total height of the panel") — the reference other members (the web
 * above, and a Braced Panel's diagonal braces) align to, not the bar's
 * own top/bottom face. This in-plane placement is an interpretation of
 * the confirmed girt qty/cross-section sizes (exact position wasn't
 * independently specified elsewhere).
 */
export function buildGirtRows(rowCount: number, widthIn: number, depthIn: number, studSpanIn: number): PanelMember[] {
  const members: PanelMember[] = [];
  const leftStudInnerFaceXIn = PLATE_2X4_THICKNESS_IN;
  const rightStudInnerFaceXIn = widthIn - PLATE_2X4_THICKNESS_IN;
  const barLeftXIn = leftStudInnerFaceXIn;
  const barRightXIn = rightStudInnerFaceXIn - PLATE_2X4_WIDTH_IN;
  const studFaceSpanIn = widthIn - 2 * PLATE_2X4_THICKNESS_IN;
  /* ⚠ The web is RIPPED to the clear space between the studs it runs past.
     The BOM calls it 8 3/4in, but a 15.5in panel leaves only 8 1/2in between
     the studs' inner faces, so the nominal web measurably stood 1/8in into
     every stud it crossed — 8 interferences per panel, and 4 more for every
     centre nailer a 4ft panel now carries. Two solids cannot share a volume:
     *"It doesn't make sense to allow any overlapping because these need to
     possible to build."* A 1/4in rip at the shop is what that costs. */
  const webHeightIn = Math.min(GIRT_WEB_HEIGHT_IN, depthIn - 2 * PLATE_2X4_WIDTH_IN);

  for (let row = 1; row <= rowCount; row++) {
    const centerZIn = SKIN_THICKNESS_IN + (studSpanIn * row) / (rowCount + 1);
    const barTopZIn = centerZIn + PLATE_2X4_THICKNESS_IN / 2;

    for (const [side, barXIn] of [
      ["left", barLeftXIn],
      ["right", barRightXIn],
    ] as const) {
      members.push({
        memberId: `girt_${row}_bar_${side}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: depthIn },
        orientation: "horizontal",
        position: { xIn: barXIn, yIn: 0, zIn: centerZIn - PLATE_2X4_THICKNESS_IN / 2, rotationDeg: 180 },
        role: "girt",
        qty: 1,
        notes: `girt ${row} of ${rowCount}, ${side} bar — flush to the inside face of the ${side} stud double, rolled onto its 3.5in face so the web has a real bearing ledge to rest on; centered at a fixed fraction of the total panel height.`,
      });
    }

    members.push({
      memberId: `girt_${row}_web`,
      material: "plywood",
      speciesGrade: null,
      plySpec: GIRT_WEB_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: {
        thicknessIn: GIRT_WEB_THICKNESS_IN,
        widthIn: webHeightIn,
        lengthIn: studFaceSpanIn + WEB_OVERHANG_TOTAL_IN,
      },
      orientation: "flat",
      position: {
        xIn: barLeftXIn - WEB_OVERHANG_TOTAL_IN / 2,
        yIn: depthIn / 2 - webHeightIn / 2,
        zIn: barTopZIn,
        rotationDeg: 0,
      },
      role: "girt_web",
      qty: 1,
      notes: `girt ${row} web, rests on top of both girt_${row}_bar_left/right`,
    });
  }

  return members;
}

/** Standard 4ft x 8ft sheet, the unit plywood is actually purchased in. */
export const PLYWOOD_SHEET_AREA_SQFT = 32;

/**
 * Total real sheet area (sqft) of every plywood member at a given
 * thickness — `actualDimsIn.widthIn x actualDimsIn.lengthIn` is always the
 * member's true physical size regardless of its 3D orientation/tilt (a
 * rip-cut gable skin's `lengthIn` is already its full rip length), so this
 * works uniformly across every panel type's member list. Used for the
 * Material Totals page (Tommy: "take note of this for 3/4in plywood
 * material totals").
 */
export function computePlywoodAreaSqFt(members: PanelMember[], thicknessIn: number, toleranceIn = 0.05): number {
  return members
    .filter((m) => m.material === "plywood" && Math.abs(m.actualDimsIn.thicknessIn - thicknessIn) < toleranceIn)
    .reduce((sum, m) => sum + (m.actualDimsIn.widthIn * m.actualDimsIn.lengthIn) / 144, 0);
}

/**
 * A chevron brace as a TRUE RIGID BOARD, placed by two anchor points that both
 * lie on ONE of its long edges.
 *
 * ⚠ **This replaces `computeBraceTrapezoidCornersIn`'s boundary-shift for
 * chevron braces, on Tommy's ruling of 2026-10-13:** *"the point should meet
 * the top of the Girt bar"*, and — asked whether the far end must still come
 * flush to the panel edge — *"Flush, and let the angle shift instead."*
 *
 * **Why the old construction could not be right.** It ran the brace's
 * CENTRELINE from the girt bar to the plate, which pinned the plumb end
 * centred on the bar. That, plus landing level on the plate, plus bringing the
 * long point flush to the panel edge, is four constraints on a rigid board's
 * two degrees of freedom. The code satisfied all four by shifting only the two
 * level corners — which looks width-preserving but is not, because the two long
 * edges start parallel with DIFFERENT lengths and adding one vector to both
 * leaves them non-parallel. The modelled board measured 3.4628" across at one
 * end and 3.5156" at the other on a 2x4: nearly 1/16" of disagreement in the
 * dimension a shop builds a cutting jig from, found by the shop-drawing work
 * rather than by review.
 *
 * **What makes this well-posed.** Both anchors sit on the same long edge, so
 * two points fix that edge — direction and position together. The stock width
 * places the other edge. The end cuts are then just lines the board is crossed
 * by (plumb at the stud face, level at the plate), not extra constraints. Zero
 * degrees of freedom left, nothing over-determined, and the board stays a
 * board. **The brace's angle is an OUTPUT of the anchors**, not the nominal
 * stud-corner-to-plate-corner line it used to be.
 *
 * @param pointXIn/@param pointZIn  The LOW POINT: on the girt bar's own face,
 *   at the stud face's X. This is the corner Tommy means by "the point".
 * @param longPointXIn/@param longPointZIn  The FAR LONG POINT: flush with the
 *   panel edge, on the plate's Z.
 */
export function computeBraceBoardCornersIn(
  pointXIn: number,
  pointZIn: number,
  longPointXIn: number,
  longPointZIn: number,
  boardWidthIn: number,
): [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] {
  const dx = longPointXIn - pointXIn;
  const dz = longPointZIn - pointZIn;
  const lengthIn = Math.hypot(dx, dz);
  const ux = dx / lengthIn;
  const uz = dz / lengthIn;

  /* The board sits on the PLATE side of its reference edge: an upper brace's
     body is above the edge because the top plate is above, a lower brace's is
     below. Derived from the anchors rather than passed in as a flag, so a
     caller cannot hand in a brace that builds itself inside the girt bar. */
  let nx = -uz;
  let nz = ux;
  if (nz * dz < 0) {
    nx = -nx;
    nz = -nz;
  }

  /* The two cuts, as lines crossing a strip of width `boardWidthIn`.

     The far edge's corners are NOT `anchor + width * n` — that lands beside the
     anchor, not on the cut line. Sliding along the strip to reach the cut gives
     the exact offsets below: `width / ux` along Z at the plumb cut, and
     `width / uz` along X at the level cut. (Both fall out of the same algebra:
     move by `t` along `u` until the moved point meets the cut, then simplify
     with `ux² + uz² = 1`.) Degenerate only for a perfectly vertical or
     perfectly horizontal brace, neither of which is a diagonal brace. */
  const plumbFar: PanelSpacePoint2D = { xIn: pointXIn, zIn: pointZIn + (boardWidthIn * Math.sign(nz)) / Math.abs(ux) };
  const levelFar: PanelSpacePoint2D = {
    xIn: longPointXIn - (boardWidthIn * Math.sign(nx === 0 ? 1 : -nx)) / Math.abs(uz),
    zIn: longPointZIn,
  };

  const corners: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] = [
    { xIn: pointXIn, zIn: pointZIn },
    { xIn: longPointXIn, zIn: longPointZIn },
    levelFar,
    plumbFar,
  ];

  // Same winding normalization every other corner producer here uses, so the
  // face table and the OBJ exporter see a consistent orientation.
  let signedArea2x = 0;
  for (let i = 0; i < 4; i++) {
    const c = corners[i]!;
    const next = corners[(i + 1) % 4]!;
    signedArea2x += c.xIn * next.zIn - next.xIn * c.zIn;
  }
  return signedArea2x < 0 ? [corners[0]!, corners[3]!, corners[2]!, corners[1]!] : corners;
}
