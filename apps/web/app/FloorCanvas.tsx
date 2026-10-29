import { useRef, useState } from "react";
import type { FieldFramingLine, FloorPanelRect, Footprint, JoistLayout, PerimeterRingSegment, PierPosition } from "@building-integrity/geometry";
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

export interface FloorCanvasProps {
  footprint: Footprint | null;
  offsetPx: DragPoint;
  floorPanels: FloorPanelRect[];
  piers: PierPosition[];
  joistLayout?: JoistLayout | null;
  /** The ridge beam's run and the columns under it, so the plan shows where
   * they land. Tommy: *"2d should show them and they should be moveable."*
   * Absent on a shed, which has no beam at all. */
  ridgeBeam?: {
    startFt: { x: number; y: number };
    endFt: { x: number; y: number };
    columns: { index: number; atFt: { x: number; y: number }; widthIn: number }[];
  } | null;
  /** Called when a column is dragged, with its new distance from the ridge's
   * start in inches. Omit to leave them read-only. */
  onMoveRidgeColumn?: (index: number, alongIn: number) => void;
  /** Bale Foundation's own 2 doubled rings BRACKETING the wall above —
   * Ring A under the exterior wythe (its outboard face on the wall's
   * exterior face), Ring B under the interior wythe (its inboard face on
   * the wall's interior face) — plus the single field stacks inboard of
   * Ring B. Placement comes from baleFoundationRingPlan; the segments
   * themselves from computeInsetPerimeterRing/computeFieldFramingLayout in
   * packages/geometry/src/perimeterRing.ts. Ring B is null on a collapsed
   * plan (a wall too thin to hold two rings). Undefined/null throughout
   * when the project isn't using the Bale Foundation floor system.
   *
   * A field "line" is one SPAN, not one bay: on a notched footprint a bay
   * can be cut into several disjoint spans, each its own entry with its own
   * `field-<line>-<span>` id. That id is the React key below, so the span
   * index in it is load-bearing, not decoration. */
  baleFoundationRingA?: PerimeterRingSegment[] | null;
  baleFoundationRingB?: PerimeterRingSegment[] | null;
  baleFoundationRingAInner?: PerimeterRingSegment[] | null;
  baleFoundationRingBInner?: PerimeterRingSegment[] | null;
  baleFoundationFieldLayout?: FieldFramingLine[];
}

/** Read-only render of the floor panel grid — bays tiled pier-to-pier on
 * the same spacing/boundaries as the Foundation tab's pier grid (Tommy:
 * the Floor editor "intakes most of its prompts from the foundation
 * editor", so there's no separate spacing control here). Pier positions
 * are shown dimmed underneath, for reference, at the corners where 4
 * panels (or the perimeter) meet. Same Measure tool as FoundationCanvas. */
export default function FloorCanvas({
  footprint,
  offsetPx,
  floorPanels,
  piers,
  joistLayout,
  ridgeBeam,
  onMoveRidgeColumn,
  baleFoundationRingA,
  baleFoundationRingB,
  baleFoundationRingAInner,
  baleFoundationRingBInner,
  baleFoundationFieldLayout,
}: FloorCanvasProps) {
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
        {ridgeBeam && (
          <g>
            {/* The beam itself: one heavy line down the ridge. */}
            <line
              x1={ridgeBeam.startFt.x * SCALE_PX_PER_FT + offsetPx.x}
              y1={ridgeBeam.startFt.y * SCALE_PX_PER_FT + offsetPx.y}
              x2={ridgeBeam.endFt.x * SCALE_PX_PER_FT + offsetPx.x}
              y2={ridgeBeam.endFt.y * SCALE_PX_PER_FT + offsetPx.y}
              stroke="#7a4a1e"
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.85}
            />
            {ridgeBeam.columns.map((column) => {
              const sidePx = (column.widthIn / 12) * SCALE_PX_PER_FT;
              const cx = column.atFt.x * SCALE_PX_PER_FT + offsetPx.x;
              const cy = column.atFt.y * SCALE_PX_PER_FT + offsetPx.y;
              return (
                <rect
                  key={`ridge-column-${column.index}`}
                  x={cx - sidePx / 2}
                  y={cy - sidePx / 2}
                  width={sidePx}
                  height={sidePx}
                  fill="#7a4a1e"
                  stroke="#3d250f"
                  strokeWidth={1.5}
                  data-ridge-column={column.index}
                  style={{ cursor: onMoveRidgeColumn ? "grab" : "default" }}
                  onPointerDown={
                    onMoveRidgeColumn
                      ? (event) => {
                          event.stopPropagation();
                          const svg = event.currentTarget.ownerSVGElement;
                          if (!svg) return;
                          event.currentTarget.setPointerCapture(event.pointerId);
                          /* ⚠ The column slides ALONG THE RIDGE, not freely.
                             A post off the beam carries nothing, so the
                             pointer is projected onto the ridge line and
                             only that distance is reported. */
                          const ax = ridgeBeam.startFt.x * SCALE_PX_PER_FT + offsetPx.x;
                          const ay = ridgeBeam.startFt.y * SCALE_PX_PER_FT + offsetPx.y;
                          const bx = ridgeBeam.endFt.x * SCALE_PX_PER_FT + offsetPx.x;
                          const by = ridgeBeam.endFt.y * SCALE_PX_PER_FT + offsetPx.y;
                          const dx = bx - ax;
                          const dy = by - ay;
                          const lenPx = Math.hypot(dx, dy);
                          if (lenPx <= 0) return;
                          const rect = svg.getBoundingClientRect();
                          const move = (moveEvent: PointerEvent) => {
                            const px = moveEvent.clientX - rect.left - ax;
                            const py = moveEvent.clientY - rect.top - ay;
                            const alongPx = Math.min(Math.max((px * dx + py * dy) / lenPx, 0), lenPx);
                            onMoveRidgeColumn(column.index, (alongPx / SCALE_PX_PER_FT) * 12);
                          };
                          const up = () => {
                            window.removeEventListener("pointermove", move);
                            window.removeEventListener("pointerup", up);
                          };
                          window.addEventListener("pointermove", move);
                          window.addEventListener("pointerup", up);
                        }
                      : undefined
                  }
                />
              );
            })}
          </g>
        )}
        {baleFoundationFieldLayout?.map((line) => (
          <line
            key={line.id}
            x1={line.x1 * SCALE_PX_PER_FT + offsetPx.x}
            y1={line.y1 * SCALE_PX_PER_FT + offsetPx.y}
            x2={line.x2 * SCALE_PX_PER_FT + offsetPx.x}
            y2={line.y2 * SCALE_PX_PER_FT + offsetPx.y}
            stroke="#2f6f3e"
            strokeWidth={2}
          />
        ))}
        {[baleFoundationRingB, baleFoundationRingBInner].map((ring, ringIdx) =>
          ring?.map((seg) => (
            <line
              key={`ring-b-${ringIdx}-${seg.wallId}`}
              x1={seg.startPoint.x * SCALE_PX_PER_FT + offsetPx.x}
              y1={seg.startPoint.y * SCALE_PX_PER_FT + offsetPx.y}
              x2={seg.endPoint.x * SCALE_PX_PER_FT + offsetPx.x}
              y2={seg.endPoint.y * SCALE_PX_PER_FT + offsetPx.y}
              stroke="#2c5a8a"
              strokeWidth={3}
            />
          )),
        )}
        {[baleFoundationRingA, baleFoundationRingAInner].map((ring, ringIdx) =>
          ring?.map((seg) => (
            <line
              key={`ring-a-${ringIdx}-${seg.wallId}`}
              x1={seg.startPoint.x * SCALE_PX_PER_FT + offsetPx.x}
              y1={seg.startPoint.y * SCALE_PX_PER_FT + offsetPx.y}
              x2={seg.endPoint.x * SCALE_PX_PER_FT + offsetPx.x}
              y2={seg.endPoint.y * SCALE_PX_PER_FT + offsetPx.y}
              stroke="#1f3a5f"
              strokeWidth={3}
            />
          )),
        )}
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
