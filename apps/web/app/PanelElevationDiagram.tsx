import { memberBoxSizeIn, memberLocalCornersIn } from "@building-integrity/panel-catalog";
import { computePanelCutList } from "@building-integrity/panel-catalog";
import type { PanelMember } from "@building-integrity/panel-catalog";
import styles from "./DiagramLegend.module.css";

export interface PanelElevationDiagramProps {
  members: PanelMember[];
  widthIn: number;
  heightIn: number;
}

// Same navy-badge/white-text/dashed-leader convention already established
// by DiagramLegend.module.css's 8 other consumers (e.g. SlabFoundationDiagram.tsx).
const BADGE_RADIUS_PX = 10;
const INSIDE_THRESHOLD_PX = 26; // badge diameter (20px) + clearance
const LEADER_OFFSET_IN = 3.5; // in real inches, so it scales with the drawing like everything else

const MAX_CANVAS_HEIGHT_PX = 480;
const MIN_CANVAS_WIDTH_PX = 170; // a Safety/Gap panel is only 0.75in wide — floor so it isn't an unreadable sliver
const MARGIN_PX = 44; // room for leader-line badges to sit outside the panel's own outline

// Same colors PanelMembersGroup.tsx uses for the live 3D model, for a
// consistent look between the two.
const MATERIAL_FILL: Record<"dimensional_lumber" | "plywood", string> = {
  dimensional_lumber: "#c9a876",
  plywood: "#e8dcc0",
};
const MATERIAL_STROKE: Record<"dimensional_lumber" | "plywood", string> = {
  dimensional_lumber: "#8a6a3a",
  plywood: "#a68a5c",
};

interface ProjectedShape {
  member: PanelMember;
  letter: string;
  kind: "rect" | "polygon";
  rect?: { xPx: number; yPx: number; widthPx: number; heightPx: number };
  points?: { xPx: number; yPx: number }[];
  centroidPx: { xPx: number; yPx: number };
  minorDimIn: number;
}

/**
 * To-scale 2D front elevation of one panel's real member geometry (Tommy:
 * "a 2d snap shot... labeling each dimensional lumber and plywood piece in
 * the panel") — X = panel width, Z = panel height, with the standard SVG
 * Y-flip (Z increases up from the panel's own bottom face; SVG y increases
 * down) applied once per projected point. Reuses `memberLocalCornersIn`
 * (the exact function the live 3D view and the OBJ exporter already
 * share) for every projection instead of re-deriving rotation math, so
 * this diagram can never visually disagree with the 3D model — correct
 * uniformly for a plain axis-aligned box, a tiltDeg-only rotated box
 * (header/gable/truss diagonal bracing), and a true beveled trapezoid
 * brace alike.
 *
 * Letters come from `computePanelCutList` — the SAME function a cut-list
 * table (PanelFabricationPage.tsx) also calls, so a letter always means
 * the same cut in both places.
 */
export default function PanelElevationDiagram({ members, widthIn, heightIn }: PanelElevationDiagramProps) {
  const cutList = computePanelCutList(members);
  const letterByMemberId = new Map<string, string>();
  for (const row of cutList) {
    for (const m of row.members) letterByMemberId.set(m.memberId, row.letter);
  }

  const pxPerIn = MAX_CANVAS_HEIGHT_PX / heightIn;
  const panelHeightPx = heightIn * pxPerIn;
  const panelWidthPx = Math.max(MIN_CANVAS_WIDTH_PX - 2 * MARGIN_PX, widthIn * pxPerIn);

  const svgY = (zIn: number) => (heightIn - zIn) * pxPerIn;

  const shapes: ProjectedShape[] = [];
  for (const member of members) {
    const letter = letterByMemberId.get(member.memberId);
    if (!letter) continue; // not a lumber/plywood cut-list member — not part of this diagram's scope

    const size = memberBoxSizeIn(member);
    const minorDimIn = Math.min(size.xIn, size.zIn);

    if (member.position.tiltDeg === undefined) {
      const xPx = member.position.xIn * pxPerIn;
      const widthPx = size.xIn * pxPerIn;
      const yPx = svgY(member.position.zIn + size.zIn);
      const heightPx = size.zIn * pxPerIn;
      shapes.push({
        member,
        letter,
        kind: "rect",
        rect: { xPx, yPx, widthPx, heightPx },
        centroidPx: { xPx: xPx + widthPx / 2, yPx: yPx + heightPx / 2 },
        minorDimIn,
      });
    } else {
      const corners = memberLocalCornersIn(member).slice(0, 4);
      const points = corners.map(([xIn, zIn]) => ({ xPx: xIn * pxPerIn, yPx: svgY(zIn) }));
      const centroidPx = {
        xPx: points.reduce((s, p) => s + p.xPx, 0) / points.length,
        yPx: points.reduce((s, p) => s + p.yPx, 0) / points.length,
      };
      shapes.push({ member, letter, kind: "polygon", points, centroidPx, minorDimIn });
    }
  }

  const viewBoxWidth = Math.max(MIN_CANVAS_WIDTH_PX, panelWidthPx + 2 * MARGIN_PX);
  const viewBoxHeight = panelHeightPx + 2 * MARGIN_PX;
  const originX = (viewBoxWidth - panelWidthPx) / 2;
  const originY = MARGIN_PX;

  const panelCenterPx = { xPx: originX + panelWidthPx / 2, yPx: originY + panelHeightPx / 2 };

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        style={{ width: "100%", maxWidth: 420, height: "auto" }}
        role="img"
        aria-label={`To-scale front elevation, ${widthIn}in wide x ${heightIn}in tall, with lettered part callouts`}
      >
        {/* Panel outline, for reference */}
        <rect x={originX} y={originY} width={panelWidthPx} height={panelHeightPx} fill="none" stroke="#bbb" strokeWidth={1} />

        {shapes.map((shape) => {
          const isPlywood = shape.member.material === "plywood";
          const fill = MATERIAL_FILL[shape.member.material as "dimensional_lumber" | "plywood"];
          const stroke = MATERIAL_STROKE[shape.member.material as "dimensional_lumber" | "plywood"];
          const dash = isPlywood ? "4 3" : undefined;

          return (
            <g key={shape.member.memberId}>
              {shape.kind === "rect" ? (
                <rect
                  x={originX + shape.rect!.xPx}
                  y={originY + shape.rect!.yPx}
                  width={shape.rect!.widthPx}
                  height={shape.rect!.heightPx}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray={dash}
                />
              ) : (
                <polygon
                  points={shape.points!.map((p) => `${originX + p.xPx},${originY + p.yPx}`).join(" ")}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray={dash}
                />
              )}
            </g>
          );
        })}

        {shapes.map((shape) => {
          const centroid = { xPx: originX + shape.centroidPx.xPx, yPx: originY + shape.centroidPx.yPx };
          const inside = shape.minorDimIn * pxPerIn >= INSIDE_THRESHOLD_PX;

          if (inside) {
            return (
              <g key={`${shape.member.memberId}-badge`}>
                <circle cx={centroid.xPx} cy={centroid.yPx} r={BADGE_RADIUS_PX} fill="#1c3d5a" />
                <text x={centroid.xPx} y={centroid.yPx + 4} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">
                  {shape.letter}
                </text>
              </g>
            );
          }

          // Leader line: push outward from the member's own centroid, away
          // from the panel's center, along whichever axis has less room
          // (the member's own short axis) — enough separation at the
          // realistic panel/lumber scales this diagram renders at, without
          // a full collision solver.
          const dx = centroid.xPx - panelCenterPx.xPx;
          const dy = centroid.yPx - panelCenterPx.yPx;
          const horizontal = Math.abs(dx) >= Math.abs(dy);
          const dirX = horizontal ? Math.sign(dx) || 1 : 0;
          const dirY = horizontal ? 0 : Math.sign(dy) || 1;
          const offsetPx = LEADER_OFFSET_IN * pxPerIn;
          const badgeX = centroid.xPx + dirX * offsetPx;
          const badgeY = centroid.yPx + dirY * offsetPx;

          return (
            <g key={`${shape.member.memberId}-badge`}>
              <line
                x1={centroid.xPx}
                y1={centroid.yPx}
                x2={badgeX - dirX * (BADGE_RADIUS_PX + 2)}
                y2={badgeY - dirY * (BADGE_RADIUS_PX + 2)}
                stroke="#999"
                strokeWidth={1}
                strokeDasharray="3 2"
              />
              <circle cx={badgeX} cy={badgeY} r={BADGE_RADIUS_PX} fill="#1c3d5a" />
              <text x={badgeX} y={badgeY + 4} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">
                {shape.letter}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
