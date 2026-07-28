import { memberBoxSizeIn, memberLocalCornersIn } from "@building-integrity/panel-catalog";
import type { PanelMember } from "@building-integrity/panel-catalog";

// Same colors PanelMembersGroup.tsx uses for the live 3D model, for a
// consistent look between the two. Every member `buildOpeningAssemblyMembers`
// or a panel's own BOM can produce is dimensional_lumber or plywood only —
// no other material keys are needed here.
export const MATERIAL_FILL: Record<"dimensional_lumber" | "plywood", string> = {
  dimensional_lumber: "#c9a876",
  plywood: "#e8dcc0",
};
export const MATERIAL_STROKE: Record<"dimensional_lumber" | "plywood", string> = {
  dimensional_lumber: "#8a6a3a",
  plywood: "#a68a5c",
};

export interface ProjectedShape {
  member: PanelMember;
  kind: "rect" | "polygon";
  rect?: { xPx: number; yPx: number; widthPx: number; heightPx: number };
  points?: { xPx: number; yPx: number }[];
  centroidPx: { xPx: number; yPx: number };
  minorDimIn: number;
}

/**
 * Projects a member list into 2D shapes via caller-supplied coordinate-
 * mapping callbacks (rather than one shared pxPerIn+origin) — every current
 * caller's own mapping is a plain affine function, but callers differ in
 * offset (a window's own local frame vs. a whole wall's run) and can even
 * differ in X/Y scale (WallElevationDiagram's scaleX shrinks below its fixed
 * vertical PX_PER_IN once a wall exceeds its canvas width cap), so a shared
 * projector can't assume a single uniform scale — it just needs `xToPx`/
 * `zToPx` to be affine and `zToPx` to be Y-flipping (decreasing as zIn
 * increases), which is true of every caller's own existing function.
 *
 * Reuses `memberLocalCornersIn` (the exact function the live 3D view and
 * the OBJ exporter already share) for diagonal members instead of
 * re-deriving rotation math — correct uniformly for a plain axis-aligned
 * box, a tiltDeg-only rotated box (header/gable/truss diagonal bracing),
 * and a true beveled trapezoid brace alike.
 */
export function projectMemberShapes(
  members: PanelMember[],
  xToPx: (xIn: number) => number,
  zToPx: (zIn: number) => number,
): ProjectedShape[] {
  const shapes: ProjectedShape[] = [];
  for (const member of members) {
    const size = memberBoxSizeIn(member);
    const minorDimIn = Math.min(size.xIn, size.zIn);

    if (member.position.tiltDeg === undefined) {
      const xPx = xToPx(member.position.xIn);
      const widthPx = xToPx(member.position.xIn + size.xIn) - xPx;
      const yPx = zToPx(member.position.zIn + size.zIn);
      const heightPx = zToPx(member.position.zIn) - yPx;
      shapes.push({
        member,
        kind: "rect",
        rect: { xPx, yPx, widthPx, heightPx },
        centroidPx: { xPx: xPx + widthPx / 2, yPx: yPx + heightPx / 2 },
        minorDimIn,
      });
    } else {
      const corners = memberLocalCornersIn(member).slice(0, 4);
      const points = corners.map(([xIn, zIn]) => ({ xPx: xToPx(xIn), yPx: zToPx(zIn) }));
      const centroidPx = {
        xPx: points.reduce((s, p) => s + p.xPx, 0) / points.length,
        yPx: points.reduce((s, p) => s + p.yPx, 0) / points.length,
      };
      shapes.push({ member, kind: "polygon", points, centroidPx, minorDimIn });
    }
  }
  return shapes;
}

export interface MemberElevationShapesProps {
  members: PanelMember[];
  xToPx: (xIn: number) => number;
  zToPx: (zIn: number) => number;
}

/** Thin presentational wrapper around `projectMemberShapes` — just the
 * colored/dashed rects and polygons, no badges/lettering (callers that need
 * lettered callouts, e.g. PanelElevationDiagram, do their own second pass
 * over `projectMemberShapes`'s output instead of using this component). */
export function MemberElevationShapes({ members, xToPx, zToPx }: MemberElevationShapesProps) {
  const shapes = projectMemberShapes(members, xToPx, zToPx);
  return (
    <>
      {shapes.map((shape) => {
        const isPlywood = shape.member.material === "plywood";
        const fill = MATERIAL_FILL[shape.member.material as "dimensional_lumber" | "plywood"];
        const stroke = MATERIAL_STROKE[shape.member.material as "dimensional_lumber" | "plywood"];
        const dash = isPlywood ? "4 3" : undefined;

        return (
          <g key={shape.member.memberId}>
            {shape.kind === "rect" ? (
              <rect
                x={shape.rect!.xPx}
                y={shape.rect!.yPx}
                width={shape.rect!.widthPx}
                height={shape.rect!.heightPx}
                fill={fill}
                stroke={stroke}
                strokeWidth={1}
                strokeDasharray={dash}
              />
            ) : (
              <polygon
                points={shape.points!.map((p) => `${p.xPx},${p.yPx}`).join(" ")}
                fill={fill}
                stroke={stroke}
                strokeWidth={1}
                strokeDasharray={dash}
              />
            )}
          </g>
        );
      })}
    </>
  );
}
