"use client";

import { computeGableTiledRow, type PanelSlot, type Wall } from "@building-integrity/geometry";
import { computeGableRipCallout } from "@building-integrity/panel-catalog";

const CANVAS_WIDTH = 720;
const PX_PER_IN = 1.6;
const TOP_MARGIN_PX = 24;
const BOTTOM_MARGIN_PX = 36;
const LEFT_MARGIN_PX = 48;

const SLOT_COLORS: Record<PanelSlot["type"], string> = {
  corner: "#8a8a8a",
  "safety-oct-corner": "#5c4a2e",
  standard: "#d9c9a3",
  braced: "#b06fc9",
  "safety-gap": "#e08a3c",
  window: "#8fc7e8",
  door: "#7a4a2b",
  column: "#4a90a4",
};

const GABLE_COLOR = "#9fb8e0";

export interface WallElevationViewProps {
  wall: Wall;
  slots: PanelSlot[];
  wallHeightFt: number;
  hasGableEnd: boolean;
  ridgeHeightFt: number;
  targetPanelWidthIn: number;
  onToggleGableEnd: (enabled: boolean) => void;
  onClose: () => void;
}

/**
 * Per-wall face-on 2D view (X = position along the wall, Y = height) —
 * Tommy: "an arrow button for each wall section, where we can see the whole
 * line up still in 2d view." Shows the existing ground-floor run (same
 * slots/colors as the plan view, read-only here — cycle panel types in the
 * Wall tab, not here) and, when "Add Gable End" is toggled on for this
 * wall, a tiled row of Gable End Panels above it rising to the Roof tab's
 * ridge height. This first pass is read/visualize + the gable toggle only
 * — dragging/resizing individual gable panels (the way Drag Wall/Edit
 * Length already work in the plan view) isn't wired up yet.
 */
export default function WallElevationView({
  wall,
  slots,
  wallHeightFt,
  hasGableEnd,
  ridgeHeightFt,
  targetPanelWidthIn,
  onToggleGableEnd,
  onClose,
}: WallElevationViewProps) {
  const wallWidthIn = wall.lengthFt * 12;
  const eaveHeightIn = wallHeightFt * 12;
  const ridgeHeightIn = Math.max(ridgeHeightFt * 12, eaveHeightIn);

  const gablePanels = hasGableEnd ? computeGableTiledRow(wallWidthIn, eaveHeightIn, ridgeHeightIn, targetPanelWidthIn) : [];

  const maxHeightIn = hasGableEnd ? ridgeHeightIn : eaveHeightIn;
  const svgWidthPx = Math.min(CANVAS_WIDTH, LEFT_MARGIN_PX + wallWidthIn * PX_PER_IN + 24);
  const scaleX = (svgWidthPx - LEFT_MARGIN_PX - 24) / wallWidthIn;
  const svgHeightPx = TOP_MARGIN_PX + maxHeightIn * PX_PER_IN + BOTTOM_MARGIN_PX;

  const yPx = (heightIn: number) => svgHeightPx - BOTTOM_MARGIN_PX - heightIn * PX_PER_IN;
  const xPx = (posIn: number) => LEFT_MARGIN_PX + posIn * scaleX;

  let cursorIn = 0;
  const groundRects = slots.map((slot, i) => {
    const x0 = cursorIn;
    cursorIn += slot.widthIn;
    return { slot, i, x0, x1: cursorIn };
  });

  return (
    <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Wall {wall.id} elevation</strong>
        <button type="button" onClick={onClose} style={{ fontSize: 12 }}>
          Close
        </button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 8 }}>
        <input type="checkbox" checked={hasGableEnd} onChange={(e) => onToggleGableEnd(e.target.checked)} />
        Add Gable End (tiles Gable End Panels up to the Roof tab&apos;s ridge height)
      </label>
      <svg
        viewBox={`0 0 ${svgWidthPx} ${svgHeightPx}`}
        style={{ width: "100%", maxWidth: svgWidthPx, height: "auto", background: "#fafafa" }}
        role="img"
        aria-label={`Elevation view of wall ${wall.id}`}
      >
        {/* Eave line */}
        <line x1={LEFT_MARGIN_PX} y1={yPx(eaveHeightIn)} x2={xPx(wallWidthIn)} y2={yPx(eaveHeightIn)} stroke="#999" strokeDasharray="4 3" />
        <text x={4} y={yPx(eaveHeightIn) + 4} fontSize={10} fill="#666">
          {eaveHeightIn}&quot;
        </text>

        {/* Ground-row slots */}
        {groundRects.map(({ slot, i, x0, x1 }) => (
          <g key={i}>
            <rect
              x={xPx(x0)}
              y={yPx(eaveHeightIn)}
              width={(x1 - x0) * scaleX}
              height={eaveHeightIn * PX_PER_IN}
              fill={SLOT_COLORS[slot.type]}
              stroke="#666"
              strokeWidth={1}
            />
            <text x={xPx((x0 + x1) / 2)} y={yPx(eaveHeightIn / 2)} fontSize={9} textAnchor="middle" fill="#333">
              {slot.widthIn}&quot;
            </text>
          </g>
        ))}

        {/* Gable row */}
        {hasGableEnd &&
          gablePanels.map((p, i) => {
            const points = [
              [xPx(p.xStartIn), yPx(eaveHeightIn)],
              [xPx(p.xEndIn), yPx(eaveHeightIn)],
              [xPx(p.xEndIn), yPx(p.rightHeightIn)],
              [xPx(p.xStartIn), yPx(p.leftHeightIn)],
            ]
              .map(([x, y]) => `${x},${y}`)
              .join(" ");
            const lowIn = Math.min(p.leftHeightIn, p.rightHeightIn);
            const highIn = Math.max(p.leftHeightIn, p.rightHeightIn);
            const rip = computeGableRipCallout(p.widthIn, lowIn, highIn);
            return (
              <g key={i}>
                <polygon points={points} fill={GABLE_COLOR} stroke="#3a5a8a" strokeWidth={1} />
                <text x={xPx((p.xStartIn + p.xEndIn) / 2)} y={yPx(eaveHeightIn) - 6} fontSize={8} textAnchor="middle" fill="#333">
                  {rip.angleDeg.toFixed(1)}&deg; / {rip.lengthIn.toFixed(0)}&quot;
                </text>
              </g>
            );
          })}

        {/* Ridge line */}
        {hasGableEnd && (
          <>
            <line x1={LEFT_MARGIN_PX} y1={yPx(ridgeHeightIn)} x2={xPx(wallWidthIn)} y2={yPx(ridgeHeightIn)} stroke="#3a5a8a" strokeDasharray="4 3" />
            <text x={4} y={yPx(ridgeHeightIn) + 4} fontSize={10} fill="#3a5a8a">
              {ridgeHeightIn}&quot;
            </text>
          </>
        )}
      </svg>
      <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
        {hasGableEnd
          ? `${gablePanels.length} Gable End Panel${gablePanels.length === 1 ? "" : "s"} tiled at ~${targetPanelWidthIn}in each, ` +
            `rising from the ${eaveHeightIn}in eave to the ${ridgeHeightIn}in ridge (symmetric peak at the wall's midpoint). ` +
            "Each panel's rip angle/length is labeled above it. Read/visualize only for now — drag/resize individual gable " +
            "panels isn't wired up yet (use the Roof tab to change the ridge height, or the panel-width setting above to " +
            "change the tiling)."
          : "Ground-floor run shown for reference (cycle panel types in the Wall tab, not here). Toggle \"Add Gable End\" " +
            "above to preview a tiled row of Gable End Panels rising to the Roof tab's ridge height."}
      </p>
    </div>
  );
}
