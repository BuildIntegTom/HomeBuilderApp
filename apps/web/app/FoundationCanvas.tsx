import { useRef, useState } from "react";
import type { Footprint, PierPosition } from "@building-integrity/geometry";
import {
  SCALE_PX_PER_FT,
  clientPointFromEvent,
  formatFeetInches,
  nearestPointOnSegments,
  wallPointsPx,
  type DragPoint,
  type LineSegment,
} from "./canvasGeometry";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 480;

export interface FoundationCanvasProps {
  footprint: Footprint | null;
  offsetPx: DragPoint;
  piers: PierPosition[];
}

/** Read-only render of the footprint's perimeter with pier markers overlaid
 * — unlike FootprintCanvas, there's no drawing/editing gesture here: the
 * pier grid is entirely derived from the footprint plus the chosen pier
 * spacing (see computePierGrid, @building-integrity/geometry), not
 * hand-placed. The Measure tool is the one exception (Tommy wanted it
 * available on every editor, not just Wall) — it snaps to the wall
 * outline lines the same way the Wall editor's Measure snaps to wall/panel
 * edges, just without this canvas's own pan/zoom (there isn't one). */
export default function FoundationCanvas({ footprint, offsetPx, piers }: FoundationCanvasProps) {
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

  const pointerPos = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>): DragPoint | null => {
    const client = clientPointFromEvent(e);
    if (!client) return null;
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: client.clientX - rect.left, y: client.clientY - rect.top };
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

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!isMeasuring) return;
    const pos = pointerPos(e);
    const snapped = pos && nearestPointOnSegments(pos, wallLines);
    if (snapped) {
      measureGestureRef.current = true;
      setMeasureAnchor(snapped);
      setMeasureEnd(snapped);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!isMeasuring || !measureGestureRef.current) return;
    const pos = pointerPos(e);
    const snapped = pos && nearestPointOnSegments(pos, wallLines);
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
        style={{ border: "1px solid #ccc", background: "#fff", cursor: isMeasuring ? "crosshair" : "default", touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        {footprint.walls.map((wall) => {
          const { startPx, endPx } = wallPointsPx(wall, footprint.corners, offsetPx);
          return (
            <line key={wall.id} x1={startPx.x} y1={startPx.y} x2={endPx.x} y2={endPx.y} stroke="#8a6a3a" strokeWidth={3} />
          );
        })}
        {piers.map((pier) => {
          const cx = pier.point.x * SCALE_PX_PER_FT + offsetPx.x;
          const cy = pier.point.y * SCALE_PX_PER_FT + offsetPx.y;
          return <circle key={pier.id} cx={cx} cy={cy} r={7} fill="#b8b8b8" stroke="#555" strokeWidth={1.5} />;
        })}
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
