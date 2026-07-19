import {
  footprintIsAllRightAngles,
  type CornerId,
  type Footprint,
  type PanelSlot,
} from "@building-integrity/geometry";
import {
  SCALE_PX_PER_FT,
  computeSlotRects,
  cornerMarkerPosition,
  formatFeetInches,
  wallLabelPosition,
  type DragPoint,
} from "./canvasGeometry";
import { combinedPanelLabel, type PanelInstance } from "./panelInstances";
import { PANEL_TYPE_COLORS } from "./panelColors";

const MARGIN_PX = 60; // room for wall dimension labels/corner markers/compass sticking out past the footprint's own bounding box

export interface PlanViewDiagramProps {
  footprint: Footprint;
  wallSlots: Record<string, PanelSlot[]>;
  wallStartOffsetIn: Record<string, number>;
  thicknessIn: number;
  allInstances: PanelInstance[];
  primaryCornerIds: Set<CornerId>;
  leastAccessibleCorner: CornerId;
}

/**
 * A static, to-scale SVG rendering of the whole footprint + panel layout —
 * the printable counterpart to the live, interactive `FootprintCanvas.tsx`
 * (Tommy: "is there a way to print plan view?" — a `<canvas>` bitmap
 * doesn't reflow/print the way SVG does, so this is a genuinely separate
 * renderer, not a screenshot of the live one). Reuses the exact same pure
 * geometry functions FootprintCanvas itself calls (`computeSlotRects`,
 * `wallLabelPosition`, `cornerMarkerPosition`, `formatFeetInches`, all from
 * `canvasGeometry.ts`) so this can never visually disagree with the live
 * plan — only the rendering target (SVG shapes instead of Konva) differs.
 *
 * `offsetPx` here is NOT the live editor's pannable-canvas offset — it's
 * computed fresh from the footprint's own bounding box so the whole
 * drawing sits flush in a tightly-fit `viewBox` (no wasted blank canvas
 * the way the live 720x480 pannable stage has).
 */
export default function PlanViewDiagram({
  footprint,
  wallSlots,
  wallStartOffsetIn,
  thicknessIn,
  allInstances,
  primaryCornerIds,
  leastAccessibleCorner,
}: PlanViewDiagramProps) {
  const wallThicknessPx = (thicknessIn / 12) * SCALE_PX_PER_FT;

  const xs = footprint.corners.map((c) => c.point.x);
  const ys = footprint.corners.map((c) => c.point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const offsetPx: DragPoint = { x: -minX * SCALE_PX_PER_FT + MARGIN_PX, y: -minY * SCALE_PX_PER_FT + MARGIN_PX };
  const viewBoxWidth = (maxX - minX) * SCALE_PX_PER_FT + 2 * MARGIN_PX;
  const viewBoxHeight = (maxY - minY) * SCALE_PX_PER_FT + 2 * MARGIN_PX;

  // Same key convention as FootprintCanvas's own panelNameByKey — a window
  // slot's header+sill(s) share one rendered rect, combined into one label.
  const panelNameByKey = new Map<string, string>();
  const grouped = new Map<string, PanelInstance[]>();
  for (const inst of allInstances) {
    const key = `${inst.wallId}-${inst.slotIndexInWall}`;
    const list = grouped.get(key);
    if (list) list.push(inst);
    else grouped.set(key, [inst]);
  }
  for (const [key, instances] of grouped) panelNameByKey.set(key, combinedPanelLabel(instances));

  const isRightAngled = footprintIsAllRightAngles(footprint);

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      style={{ width: "100%", height: "auto", background: "#fcfcfa" }}
      role="img"
      aria-label="To-scale plan view of the drawn footprint and panel layout"
    >
      {footprint.walls.flatMap((wall) =>
        computeSlotRects(wall, wallSlots[wall.id] ?? [], footprint, offsetPx, wallStartOffsetIn[wall.id] ?? 0, wallThicknessPx).map((r) => {
          const key = `${r.wallId}-${r.slotIndex}`;
          const panelName = panelNameByKey.get(key);
          const baseColor = PANEL_TYPE_COLORS[r.slot.secondaryType ?? r.slot.type];
          const hatchColor = r.slot.secondaryType ? PANEL_TYPE_COLORS[r.slot.type] : null;
          const hatchId = hatchColor ? `plan-hatch-${hatchColor.replace("#", "")}` : null;

          if (r.trapezoidPoints) {
            const pointsAttr = [];
            for (let i = 0; i < r.trapezoidPoints.length; i += 2) pointsAttr.push(`${r.trapezoidPoints[i]},${r.trapezoidPoints[i + 1]}`);
            const labelX = r.trapezoidPoints[6]!;
            const labelY = r.trapezoidPoints[7]!;
            return (
              <g key={key}>
                <polygon points={pointsAttr.join(" ")} fill={baseColor} stroke="#555" strokeWidth={0.5} />
                {hatchId && <polygon points={pointsAttr.join(" ")} fill={`url(#${hatchId})`} />}
                {panelName && (
                  <text x={labelX + 2} y={labelY - 3} fontSize={9} fill="#fff" stroke="#333" strokeWidth={0.6}>
                    {panelName}
                  </text>
                )}
              </g>
            );
          }

          const localY = r.height < 0 ? r.height : 0;
          const localHeight = Math.abs(r.height);
          const labelLocalY = r.height > 0 ? r.height - 3 : r.height - 8;
          return (
            <g key={key} transform={`translate(${r.x},${r.y}) rotate(${r.rotationDeg})`}>
              <rect x={0} y={localY} width={r.width} height={localHeight} fill={baseColor} stroke="#555" strokeWidth={0.5} />
              {hatchId && <rect x={0} y={localY} width={r.width} height={localHeight} fill={`url(#${hatchId})`} />}
              {panelName && (
                <text x={2} y={labelLocalY} fontSize={9} fill="#fff" stroke="#333" strokeWidth={0.6}>
                  {panelName}
                </text>
              )}
              {r.slot.type === "safety-gap" && (
                <>
                  <line x1={r.width + 16} y1={-4} x2={r.width} y2={r.height / 2} stroke="#b8630f" strokeWidth={1.5} markerEnd="url(#plan-safety-gap-arrow)" />
                  <text x={r.width + 11} y={-8} fontSize={9} fontWeight="bold" fill="#b8630f" stroke="#fff" strokeWidth={0.5}>
                    Safety Gap
                  </text>
                </>
              )}
            </g>
          );
        }),
      )}

      {isRightAngled &&
        footprint.corners
          .filter((c) => primaryCornerIds.has(c.id))
          .map((c) => {
            const pos = cornerMarkerPosition(c, footprint.corners, offsetPx);
            return (
              <circle
                key={c.id}
                cx={pos.x}
                cy={pos.y}
                r={9}
                fill={c.id === leastAccessibleCorner ? "#c0392b" : "#fff"}
                stroke="#333"
                strokeWidth={1.5}
              />
            );
          })}

      {footprint.walls.map((wall) => {
        const pos = wallLabelPosition(wall, footprint.corners, offsetPx);
        return (
          <text key={`label-${wall.id}`} x={pos.x} y={pos.y + 4} fontSize={12} fill="#333" textAnchor="middle">
            {formatFeetInches(wall.lengthFt)}
          </text>
        );
      })}

      {/* Fixed "up = North" compass mark — a print page has one static
          orientation, unlike the live editor's own rotatable compass widget. */}
      <g transform={`translate(${MARGIN_PX / 2}, ${MARGIN_PX / 2})`}>
        <line x1={0} y1={14} x2={0} y2={-14} stroke="#333" strokeWidth={1.5} markerEnd="url(#plan-north-arrow)" />
        <text x={0} y={-18} fontSize={11} fontWeight="bold" fill="#333" textAnchor="middle">
          N
        </text>
      </g>

      <defs>
        <marker id="plan-north-arrow" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#333" />
        </marker>
        <marker id="plan-safety-gap-arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#b8630f" />
        </marker>
        {Array.from(new Set(footprint.walls.flatMap((wall) => (wallSlots[wall.id] ?? []).map((s) => (s.secondaryType ? PANEL_TYPE_COLORS[s.type] : null)).filter((c): c is string => c !== null)))).map(
          (color) => (
            <pattern key={color} id={`plan-hatch-${color.replace("#", "")}`} width={8} height={8} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1={0} y1={0} x2={0} y2={8} stroke={color} strokeWidth={2} />
            </pattern>
          ),
        )}
      </defs>
    </svg>
  );
}
