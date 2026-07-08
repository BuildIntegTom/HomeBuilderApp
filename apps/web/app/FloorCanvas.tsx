import { useRef, useState } from "react";
import type { FloorPanelRect, Footprint, JoistLayout, PierPosition } from "@building-integrity/geometry";
import {
  SCALE_PX_PER_FT,
  formatFeetInches,
  nearestPointOnSegments,
  wallPointsPx,
  type DragPoint,
  type LineSegment,
} from "./canvasGeometry";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 480;

export interface FloorCanvasProps {
  footprint: Footprint | null;
  offsetPx: DragPoint;
  floorPanels: FloorPanelRect[];
  piers: PierPosition[];
  joistLayout?: JoistLayout | null;
}

/** Read-only render of the floor panel grid — bays tiled pier-to-pier on
 * the same spacing/boundaries as the Foundation tab's pier grid (Tommy:
 * the Floor editor "intakes most of its prompts from the foundation
 * editor", so there's no separate spacing control here). Pier positions
 * are shown dimmed underneath, for reference, at the corners where 4
 * panels (or the perimeter) meet. Same Measure tool as FoundationCanvas. */
export default function FloorCanvas({ footprint, offsetPx, floorPanels, piers, joistLayout }: FloorCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const measureGestureRef = useRef(false);
  const [measureAnchor, setMeasureAnchor] = useState<DragPoint | null>(null);
  const [measureEnd, setMeasureEnd] = useState<DragPoint | null>(null);

  const toggleMeasuring = () => {
    setIsMeasuring((was) => {
      measureGestureRef.current = false;
      setMeasureAnchor(null);
      setMeasureEnd(null);
      return !was;
    });
  };

  const pointerPos = (e: React.MouseEvent<SVGSVGElement>): DragPoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  if (!footprint) {
    return (
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          border: "1px solid #ccc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#777",
          fontSize: 13,
        }}
      >
        Draw a footprint in the Wall editor first.
      </div>
    );
  }

  const wallLines: LineSegment[] = footprint.walls.map((wall) => {
    const { startPx, endPx } = wallPointsPx(wall, footprint.corners, offsetPx);
    return { x1: startPx.x, y1: startPx.y, x2: endPx.x, y2: endPx.y };
  });

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMeasuring) return;
    const snapped = nearestPointOnSegments(pointerPos(e), wallLines);
    if (snapped) {
      measureGestureRef.current = true;
      setMeasureAnchor(snapped);
      setMeasureEnd(snapped);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMeasuring || !measureGestureRef.current) return;
    const snapped = nearestPointOnSegments(pointerPos(e), wallLines);
    if (snapped) setMeasureEnd(snapped);
  };

  const handleMouseUp = () => {
    if (!isMeasuring) return;
    measureGestureRef.current = false;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <button
          type="button"
          aria-pressed={isMeasuring}
          onClick={toggleMeasuring}
          style={{ fontWeight: isMeasuring ? "bold" : "normal" }}
        >
          Measure
        </button>
      </div>
      <svg
        ref={svgRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ border: "1px solid #ccc", background: "#fff", cursor: isMeasuring ? "crosshair" : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {floorPanels.map((panel) => {
          const x = panel.x * SCALE_PX_PER_FT + offsetPx.x;
          const y = panel.y * SCALE_PX_PER_FT + offsetPx.y;
          const width = panel.width * SCALE_PX_PER_FT;
          const height = panel.height * SCALE_PX_PER_FT;
          return (
            <g key={panel.id}>
              <rect x={x} y={y} width={width} height={height} fill="#e8dcc4" stroke="#8a6a3a" strokeWidth={1} />
              <text x={x + width / 2} y={y + height / 2} fontSize={11} fill="#555" textAnchor="middle" dominantBaseline="middle">
                {panel.id}
              </text>
            </g>
          );
        })}
        {footprint.walls.map((wall) => {
          const { startPx, endPx } = wallPointsPx(wall, footprint.corners, offsetPx);
          return (
            <line key={wall.id} x1={startPx.x} y1={startPx.y} x2={endPx.x} y2={endPx.y} stroke="#8a6a3a" strokeWidth={3} />
          );
        })}
        {piers.map((pier) => {
          const cx = pier.point.x * SCALE_PX_PER_FT + offsetPx.x;
          const cy = pier.point.y * SCALE_PX_PER_FT + offsetPx.y;
          return <circle key={pier.id} cx={cx} cy={cy} r={4} fill="#b8b8b8" stroke="#555" strokeWidth={1} opacity={0.6} />;
        })}
        {joistLayout?.joists.map((joist) => (
          <line
            key={joist.id}
            x1={joist.x1 * SCALE_PX_PER_FT + offsetPx.x}
            y1={joist.y1 * SCALE_PX_PER_FT + offsetPx.y}
            x2={joist.x2 * SCALE_PX_PER_FT + offsetPx.x}
            y2={joist.y2 * SCALE_PX_PER_FT + offsetPx.y}
            stroke="#2f6f3e"
            strokeWidth={2}
          />
        ))}
        {measureAnchor && measureEnd && (
          <>
            <line
              x1={measureAnchor.x}
              y1={measureAnchor.y}
              x2={measureEnd.x}
              y2={measureEnd.y}
              stroke="#e0392b"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
            <circle cx={measureAnchor.x} cy={measureAnchor.y} r={4} fill="#e0392b" />
            <circle cx={measureEnd.x} cy={measureEnd.y} r={4} fill="#e0392b" />
            <text
              x={(measureAnchor.x + measureEnd.x) / 2 + 8}
              y={(measureAnchor.y + measureEnd.y) / 2 - 10}
              fontSize={13}
              fontWeight="bold"
              fill="#e0392b"
            >
              {formatFeetInches(Math.hypot(measureEnd.x - measureAnchor.x, measureEnd.y - measureAnchor.y) / SCALE_PX_PER_FT)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
