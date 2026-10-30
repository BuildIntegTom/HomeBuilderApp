import type { PanelMember } from "./componentSchema";
import { memberBoxSizeIn } from "./panelMemberHelpers";

/**
 * ⚠ EVERY MEMBER IN THIS APP IS A PRISM: a convex polygon extruded along one
 * axis. That is what makes an exact overlap test possible.
 *
 * The problem this replaces: an axis-aligned box drawn round a tilted brace
 * claims space the brace does not fill, so comparing those boxes reports
 * overlaps that are not real. Braced, gable and big-header panels were
 * therefore left out of the overlap check entirely — and the Panel Editor is
 * about to make diagonals ordinary rather than exceptional, so "left out"
 * would have become "most panels unchecked".
 *
 * Full 3D oriented-box intersection is not needed, because nothing here is
 * tilted about more than one axis:
 *
 * - A plain box is a rectangle in two axes, extruded along the third.
 * - A diagonal brace carries `trapezoidCornersIn` — a real four-cornered
 *   polygon in the panel's width/height plane — extruded through its
 *   thickness.
 * - A plan polygon (floor membrane bands) is a polygon in plan, extruded
 *   vertically.
 * - A SECTION polygon (a roof panel's plumb end cut) is a polygon in the
 *   panel's depth/span plane, extruded along its width.
 *
 * So: two prisms sharing an extrusion axis overlap when their intervals
 * overlap AND their polygons overlap, which is a 2D problem with an exact
 * answer.
 */

/** Which axis the polygon is swept along. */
export type PrismAxis = "x" | "y" | "z";

export interface Prism {
  axis: PrismAxis;
  /** The cross-section, in the two axes that are not `axis`, in x/y/z order. */
  polygon: { u: number; v: number }[];
  lo: number;
  hi: number;
}

/** A shared face is contact, not overlap. Tighter than the thinnest real
 * member and looser than float noise. */
const EPS = 1e-6;

export function memberPrism(member: PanelMember): Prism {
  const { xIn, yIn, zIn } = member.position;

  if (member.position.trapezoidCornersIn) {
    /* A brace: its corners are already the real cut, in the panel's
       width/height plane, and its position records the CENTRE through the
       thickness rather than a min corner. */
    const halfIn = member.actualDimsIn.thicknessIn / 2;
    return {
      axis: "y",
      polygon: member.position.trapezoidCornersIn.map((c) => ({ u: c.xIn, v: c.zIn })),
      lo: yIn - halfIn,
      hi: yIn + halfIn,
    };
  }

  if (member.position.sectionCornersIn) {
    /* A plumb-cut roof member: its bevel is already the real cut, in the
       panel's depth/span plane, swept along the width from its min corner. */
    return {
      axis: "x",
      polygon: member.position.sectionCornersIn.map((c) => ({ u: c.yIn, v: c.zIn })),
      lo: xIn,
      hi: xIn + memberBoxSizeIn(member).xIn,
    };
  }

  if (member.position.planPolygonCornersIn) {
    const size = memberBoxSizeIn(member);
    return {
      axis: "z",
      polygon: member.position.planPolygonCornersIn.map((c) => ({ u: c.xIn, v: c.yIn })),
      lo: zIn,
      hi: zIn + size.zIn,
    };
  }

  /* A plain box, swept along Y so it can be compared with braces directly. */
  const size = memberBoxSizeIn(member);
  return {
    axis: "y",
    polygon: [
      { u: xIn, v: zIn },
      { u: xIn + size.xIn, v: zIn },
      { u: xIn + size.xIn, v: zIn + size.zIn },
      { u: xIn, v: zIn + size.zIn },
    ],
    lo: yIn,
    hi: yIn + size.yIn,
  };
}

/** Separating-axis test for two convex polygons. Exact, and the reason a
 * brace no longer has to be approximated by its bounding box. */
function polygonsOverlap(a: { u: number; v: number }[], b: { u: number; v: number }[]): boolean {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i]!;
      const q = polygon[(i + 1) % polygon.length]!;
      /* The outward normal of this edge. A polygon's winding does not matter:
         if either polygon is separated along it, they are separated. */
      const nu = -(q.v - p.v);
      const nv = q.u - p.u;
      const len = Math.hypot(nu, nv);
      if (len < EPS) continue;

      let aMin = Infinity;
      let aMax = -Infinity;
      for (const c of a) {
        const d = (c.u * nu + c.v * nv) / len;
        aMin = Math.min(aMin, d);
        aMax = Math.max(aMax, d);
      }
      let bMin = Infinity;
      let bMax = -Infinity;
      for (const c of b) {
        const d = (c.u * nu + c.v * nv) / len;
        bMin = Math.min(bMin, d);
        bMax = Math.max(bMax, d);
      }
      if (aMax <= bMin + EPS || bMax <= aMin + EPS) return false;
    }
  }
  return true;
}

/**
 * ⚠ A PLAIN BOX CAN BE SWEPT ALONG ANY AXIS, which is what keeps the roof
 * panel's check exact.
 *
 * A plumb-cut member is a prism along X and everything beside it in the same
 * panel — girts, blocking, lid faces — is a prism along Y, so without this
 * every one of those pairs would fall to the bounding-box fallback and a
 * 4:12 roof panel would report overlaps it does not have. A box has a
 * rectangular cross-section in EVERY plane, so re-expressing it along X
 * costs nothing and keeps the answer exact. Returns null for a member whose
 * shape is a real polygon in some other plane — a brace or a membrane band
 * — because those genuinely cannot be re-swept, and neither ever shares a
 * panel with a plumb cut.
 */
function plainBoxPrismAlongX(member: PanelMember): Prism | null {
  const { trapezoidCornersIn, planPolygonCornersIn, sectionCornersIn, tiltDeg } = member.position;
  if (trapezoidCornersIn || planPolygonCornersIn || sectionCornersIn || tiltDeg !== undefined) return null;
  const { xIn, yIn, zIn } = member.position;
  const size = memberBoxSizeIn(member);
  return {
    axis: "x",
    polygon: [
      { u: yIn, v: zIn },
      { u: yIn + size.yIn, v: zIn },
      { u: yIn + size.yIn, v: zIn + size.zIn },
      { u: yIn, v: zIn + size.zIn },
    ],
    lo: xIn,
    hi: xIn + size.xIn,
  };
}

/**
 * Do these two members occupy the same space?
 *
 * ⚠ Two prisms swept along different axes fall back to their bounding boxes,
 * which can report an overlap that is not real. `mixedAxes` says so out loud
 * rather than letting a conservative answer pass for an exact one — and a
 * plumb cut against a plain box is re-swept rather than approximated, so it
 * never reaches that fallback.
 */
export function membersOverlap(a: PanelMember, b: PanelMember): { overlaps: boolean; mixedAxes: boolean } {
  let pa = memberPrism(a);
  let pb = memberPrism(b);

  if (pa.axis !== pb.axis && (pa.axis === "x" || pb.axis === "x")) {
    const reswept = pa.axis === "x" ? plainBoxPrismAlongX(b) : plainBoxPrismAlongX(a);
    if (reswept) {
      if (pa.axis === "x") pb = reswept;
      else pa = reswept;
    }
  }

  if (pa.axis !== pb.axis) {
    const boxA = aabbOf(a);
    const boxB = aabbOf(b);
    const overlaps =
      Math.min(boxA.x1, boxB.x1) - Math.max(boxA.x0, boxB.x0) > EPS &&
      Math.min(boxA.y1, boxB.y1) - Math.max(boxA.y0, boxB.y0) > EPS &&
      Math.min(boxA.z1, boxB.z1) - Math.max(boxA.z0, boxB.z0) > EPS;
    return { overlaps, mixedAxes: true };
  }

  if (Math.min(pa.hi, pb.hi) - Math.max(pa.lo, pb.lo) <= EPS) return { overlaps: false, mixedAxes: false };
  return { overlaps: polygonsOverlap(pa.polygon, pb.polygon), mixedAxes: false };
}

function aabbOf(member: PanelMember) {
  const prism = memberPrism(member);
  const us = prism.polygon.map((p) => p.u);
  const vs = prism.polygon.map((p) => p.v);
  const u0 = Math.min(...us);
  const u1 = Math.max(...us);
  const v0 = Math.min(...vs);
  const v1 = Math.max(...vs);
  if (prism.axis === "x") return { x0: prism.lo, x1: prism.hi, y0: u0, y1: u1, z0: v0, z1: v1 };
  return prism.axis === "y"
    ? { x0: u0, x1: u1, y0: prism.lo, y1: prism.hi, z0: v0, z1: v1 }
    : { x0: u0, x1: u1, y0: v0, y1: v1, z0: prism.lo, z1: prism.hi };
}

/** Every pair of members sharing space, as readable ids. */
export function overlappingMemberPairs(members: PanelMember[]): string[] {
  const found: string[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const { overlaps, mixedAxes } = membersOverlap(members[i]!, members[j]!);
      if (overlaps) {
        found.push(`${members[i]!.memberId} x ${members[j]!.memberId}${mixedAxes ? " (bounding boxes only)" : ""}`);
      }
    }
  }
  return found;
}
