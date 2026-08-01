"use client";

import { computeTrussLayout, type TrussDoublingStrategy } from "@building-integrity/geometry";
import type { PanelMember } from "@building-integrity/panel-catalog";
import { MemberElevationShapes } from "./MemberElevationShapes";

const CANVAS_WIDTH = 720;
const PX_PER_IN = 1.6;
const LEFT_MARGIN_PX = 48;
const ELEV_TOP_MARGIN_PX = 16;
const ELEV_BOTTOM_MARGIN_PX = 28;
const PLAN_TOP_MARGIN_PX = 16;
const PLAN_BOTTOM_MARGIN_PX = 20;
const PLAN_MAX_CONTENT_HEIGHT_PX = 260;
const PLAN_MIN_CONTENT_HEIGHT_PX = 80;

export interface RoofTrussLayoutViewProps {
  /** One representative truss's own member geometry (local x: 0..spanIn,
   * z: 0..peakHeightIn) — same convention every trussMembers.ts builder
   * already uses, so this is whatever the selected style's build()/
   * buildXTrussMembers(spanIn, pitchIn12, ...) call returned. */
  trussMembers: PanelMember[];
  spanIn: number;
  /** The built truss's own overall ridge/high-end height, for the
   * elevation strip's vertical extent — callers already know this (it's
   * either a ClassicTrussTypeDef's own peakHeightIn, or the high-perf
   * schema builders' own computed peakZIn/topEndZIn), cheaper than
   * re-deriving it generically from tilted member endpoints here. */
  peakHeightIn: number;
  /** Ridge run length (inches) this truss style repeats across. */
  runIn: number;
  spacingIn: number;
  doubling: TrussDoublingStrategy;
  /** Real eave/bearing height this truss's local z=0 sits on — shown only
   * as a labeled reference line, not used as a coordinate offset (this
   * view's own vertical axis stays local to the truss). */
  roofBaseHeightIn: number;
  /** Asymmetric-peak caveat ("using the steeper side's pitch...") or
   * similar, shown under the elevation strip when set. */
  note?: string;
}

/**
 * Roof tab's own 2-pane truss layout: one representative truss's elevation
 * on top (reusing MemberElevationShapes, the same 2D member projector
 * WallElevationDiagram already uses for window/door framing), and directly
 * below it, a plan (top-down) view of every truss position across the real
 * roof run at the chosen spacing/doubling — Tommy: "i want to see the full
 * 'panelized' layout... the elevation view can be at the top... with the
 * layout directly below it with the plan look of the roof members."
 *
 * The plan strip reuses the elevation strip's own horizontal scale
 * (LEFT_MARGIN_PX/scaleX, both keyed to spanIn) so the two stay visually
 * aligned — each truss is drawn as a horizontal line spanning the full
 * width (matching the elevation's own span axis), repeating down the page
 * as you move along the run, the same "one line per repeating member"
 * convention FloorCanvas already uses for joists, just stacked vertically
 * instead of laid out across a footprint.
 */
export default function RoofTrussLayoutView({
  trussMembers,
  spanIn,
  peakHeightIn,
  runIn,
  spacingIn,
  doubling,
  roofBaseHeightIn,
  note,
}: RoofTrussLayoutViewProps) {
  const svgWidthPx = Math.min(CANVAS_WIDTH, LEFT_MARGIN_PX + spanIn * PX_PER_IN + 24);
  const scaleX = (svgWidthPx - LEFT_MARGIN_PX - 24) / spanIn;
  const xToPx = (xIn: number) => LEFT_MARGIN_PX + xIn * scaleX;

  const elevHeightPx = ELEV_TOP_MARGIN_PX + peakHeightIn * PX_PER_IN + ELEV_BOTTOM_MARGIN_PX;
  const zToPx = (zIn: number) => elevHeightPx - ELEV_BOTTOM_MARGIN_PX - zIn * PX_PER_IN;

  const planContentHeightPx = Math.min(PLAN_MAX_CONTENT_HEIGHT_PX, Math.max(PLAN_MIN_CONTENT_HEIGHT_PX, runIn * 0.35));
  const planScaleY = planContentHeightPx / Math.max(runIn, 1);
  const planHeightPx = PLAN_TOP_MARGIN_PX + planContentHeightPx + PLAN_BOTTOM_MARGIN_PX;
  const runToPx = (positionIn: number) => PLAN_TOP_MARGIN_PX + positionIn * planScaleY;

  const positions = computeTrussLayout(runIn, spacingIn, doubling);
  const totalUnits = positions.reduce((sum, p) => sum + p.count, 0);
  const doubledCount = positions.filter((p) => p.count === 2).length;
  const doublingLabel =
    doubling === "doubled-ends" ? ` (${doubledCount} doubled at the ends)` : doubling === "doubled-all" ? ` (all ${doubledCount} doubled)` : "";
  const summary = `${positions.length} trusses @ ${spacingIn}in o.c.${doublingLabel} — ${totalUnits} total truss units.`;
  const rowGapPx = Math.max(3, 1.5 * planScaleY);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      <svg width={svgWidthPx} height={elevHeightPx} role="img" aria-label="Representative truss elevation">
        <line
          x1={LEFT_MARGIN_PX}
          y1={zToPx(0)}
          x2={xToPx(spanIn)}
          y2={zToPx(0)}
          stroke="#999"
          strokeDasharray="4 3"
        />
        <text x={4} y={zToPx(0) - 4} fontSize={9} fill="#666">
          bears at {roofBaseHeightIn.toFixed(0)}&quot;
        </text>
        <MemberElevationShapes members={trussMembers} xToPx={xToPx} zToPx={zToPx} />
      </svg>

      <svg width={svgWidthPx} height={planHeightPx} role="img" aria-label="Truss run plan view">
        <rect
          x={LEFT_MARGIN_PX}
          y={PLAN_TOP_MARGIN_PX}
          width={spanIn * scaleX}
          height={runIn * planScaleY}
          fill="none"
          stroke="#bbb"
          strokeWidth={1}
        />
        {positions.map((p) =>
          p.count === 1 ? (
            <line
              key={p.id}
              x1={LEFT_MARGIN_PX}
              x2={xToPx(spanIn)}
              y1={runToPx(p.positionIn)}
              y2={runToPx(p.positionIn)}
              stroke="#2c7a4b"
              strokeWidth={2}
            />
          ) : (
            <g key={p.id}>
              <line
                x1={LEFT_MARGIN_PX}
                x2={xToPx(spanIn)}
                y1={runToPx(p.positionIn) - rowGapPx / 2}
                y2={runToPx(p.positionIn) - rowGapPx / 2}
                stroke="#1f5c33"
                strokeWidth={2}
              />
              <line
                x1={LEFT_MARGIN_PX}
                x2={xToPx(spanIn)}
                y1={runToPx(p.positionIn) + rowGapPx / 2}
                y2={runToPx(p.positionIn) + rowGapPx / 2}
                stroke="#1f5c33"
                strokeWidth={2}
              />
            </g>
          ),
        )}
      </svg>

      <p style={{ margin: 0, fontSize: 12, color: "#333" }}>{summary}</p>
      {note && (
        <p style={{ margin: 0, fontSize: 11, color: "#a06a1f" }}>
          {note}
        </p>
      )}
    </div>
  );
}
