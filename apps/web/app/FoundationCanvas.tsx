import type { Footprint, PierPosition } from "@building-integrity/geometry";
import { SCALE_PX_PER_FT, wallPointsPx, type DragPoint } from "./canvasGeometry";

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
 * hand-placed. */
export default function FoundationCanvas({ footprint, offsetPx, piers }: FoundationCanvasProps) {
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

  return (
    <svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ border: "1px solid #ccc", background: "#fff" }}>
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
    </svg>
  );
}
