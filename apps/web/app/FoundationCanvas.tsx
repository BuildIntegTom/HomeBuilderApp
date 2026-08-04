import { useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  /** Same portal mechanism FootprintCanvas's own Pan/Zoom/Reset row uses
   * (Tommy: "include the pan/zoom in/out/reset pieces found in the plan
   * view editor in the foundation and elevation editors") — when supplied,
   * the compact icon row renders there instead of inline above the canvas,
   * so it can land in the same sidebar spot Plan View's own row does. */
  toolbarPortalTarget?: HTMLDivElement | null;
}

/** Read-only render of the footprint's perimeter with pier markers overlaid
 * — unlike FootprintCanvas, there's no drawing/editing gesture here: the
 * pier grid is entirely derived from the footprint plus the chosen pier
 * spacing (see computePierGrid, @building-integrity/geometry), not
 * hand-placed. The Measure tool is the one exception (Tommy wanted it
 * available on every editor, not just Wall) — it snaps to the wall
 * outline lines the same way the Wall editor's Measure snaps to wall/panel
 * edges. Pan/zoom (Tommy: "include the pan/zoom in/out/reset pieces found
 * in the plan view editor") is a plain CSS transform on a wrapper div
 * around the SVG, not a viewBox change — every existing pointer-position
 * calculation already derives its own scale ratio from the SVG's real
 * (possibly CSS-scaled) rendered width vs. its fixed internal width (see
 * `pointerPos` below), so it stays correct under any zoom level with no
 * further changes needed once panned/zoomed.
 */
export default function FoundationCanvas({ footprint, offsetPx, piers, toolbarPortalTarget }: FoundationCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const measureGestureRef = useRef(false);
  const [measureAnchor, setMeasureAnchor] = useState<DragPoint | null>(null);
  const [measureEnd, setMeasureEnd] = useState<DragPoint | null>(null);

  // Pan/zoom view — same shape as FootprintCanvas's own (viewOffset/
  // viewScale are a pure rendering concern, entirely local to this
  // component).
  const [viewOffset, setViewOffset] = useState<DragPoint>({ x: 0, y: 0 });
  const [viewScale, setViewScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; viewOffset: DragPoint } | null>(null);

  const zoomIn = () => setViewScale((s) => Math.min(3, s * 1.25));
  const zoomOut = () => setViewScale((s) => Math.max(0.25, s / 1.25));
  const resetView = () => {
    setViewOffset({ x: 0, y: 0 });
    setViewScale(1);
  };

  const toggleMeasuring = () => {
    setIsMeasuring((was) => {
      const next = !was;
      if (next) setIsPanning(false);
      measureGestureRef.current = false;
      setMeasureAnchor(null);
      setMeasureEnd(null);
      return next;
    });
  };

  // Divides out the SVG's own real (CSS-scaled) rendered width against its
  // fixed internal CANVAS_WIDTH, so a click lands on the same wall-outline
  // point regardless of the current zoom level — the same
  // rendered-vs-internal-width ratio WallElevationDiagram's own drag
  // handlers already derive fresh per event, just applied here to a plain
  // click instead of a continuous drag.
  const pointerPos = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>): DragPoint | null => {
    const client = clientPointFromEvent(e);
    if (!client) return null;
    const rect = svgRef.current!.getBoundingClientRect();
    if (rect.width === 0) return null;
    const scaleRatio = rect.width / CANVAS_WIDTH;
    return { x: (client.clientX - rect.left) / scaleRatio, y: (client.clientY - rect.top) / scaleRatio };
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
    if (isPanning) {
      const client = clientPointFromEvent(e);
      if (client) panStartRef.current = { clientX: client.clientX, clientY: client.clientY, viewOffset: { ...viewOffset } };
      return;
    }
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
    if (isPanning) {
      const start = panStartRef.current;
      if (!start) return;
      const client = clientPointFromEvent(e);
      if (!client) return;
      setViewOffset({ x: start.viewOffset.x + (client.clientX - start.clientX), y: start.viewOffset.y + (client.clientY - start.clientY) });
      return;
    }
    if (!isMeasuring || !measureGestureRef.current) return;
    const pos = pointerPos(e);
    const snapped = pos && nearestPointOnSegments(pos, wallLines);
    if (snapped) setMeasureEnd(snapped);
  };

  const handleMouseUp = () => {
    if (isPanning) {
      panStartRef.current = null;
      return;
    }
    if (!isMeasuring) return;
    measureGestureRef.current = false;
  };

  // Same compact icon buttons FootprintCanvas's own Pan/Zoom/Reset row
  // uses, byte-identical styling/labels so the control feels like the same
  // piece of UI everywhere it appears.
  const iconButtonStyle = (active: boolean): CSSProperties => ({
    fontSize: 15,
    lineHeight: 1,
    padding: "6px 9px",
    borderRadius: 6,
    border: active ? "1px solid #4a90d9" : "1px solid #ccc",
    background: active ? "#4a90d9" : "#fff",
    color: active ? "#fff" : "#333",
    cursor: "pointer",
  });

  const viewingToolbar = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button
        type="button"
        title="Pan: drag the canvas to pan around"
        aria-pressed={isPanning}
        onClick={() =>
          setIsPanning((p) => {
            const next = !p;
            if (next) setIsMeasuring(false);
            return next;
          })
        }
        style={iconButtonStyle(isPanning)}
      >
        🍳
      </button>
      <button type="button" title="Zoom out" onClick={zoomOut} style={iconButtonStyle(false)}>
        🔍−
      </button>
      <span style={{ fontSize: 11, color: "#555", minWidth: 28, textAlign: "center" }}>{Math.round(viewScale * 100)}%</span>
      <button type="button" title="Zoom in" onClick={zoomIn} style={iconButtonStyle(false)}>
        🔍+
      </button>
      <button
        type="button"
        title="Reset pan and zoom to the default view"
        onClick={resetView}
        style={{ ...iconButtonStyle(false), fontSize: 12, padding: "6px 10px" }}
      >
        Reset
      </button>
    </div>
  );

  return (
    <div>
      {toolbarPortalTarget ? createPortal(viewingToolbar, toolbarPortalTarget) : viewingToolbar}
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
        <button
          type="button"
          aria-pressed={isMeasuring}
          onClick={toggleMeasuring}
          style={{ fontWeight: isMeasuring ? "bold" : "normal" }}
        >
          Measure
        </button>
      </div>
      <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, overflow: "hidden" }}>
        <div style={{ transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${viewScale})`, transformOrigin: "0 0" }}>
          <svg
            ref={svgRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              border: "1px solid #ccc",
              background: "#fff",
              cursor: isPanning ? "grab" : isMeasuring ? "crosshair" : "default",
              touchAction: "none",
            }}
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
      </div>
    </div>
  );
}
