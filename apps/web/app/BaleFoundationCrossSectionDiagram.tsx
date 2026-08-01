"use client";

import { buildFramingStackMembers, BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN, SUBFLOOR_DEPTH_DEFAULT_IN } from "@building-integrity/panel-catalog";
import { MemberElevationShapes } from "./MemberElevationShapes";

const CANVAS_WIDTH = 480;
const PX_PER_IN = 3.2;
const LEFT_MARGIN_PX = 44;
const TOP_MARGIN_PX = 16;
const BOTTOM_MARGIN_PX = 24;
/** Illustrative segment length — 2 blocking intervals, long enough to show
 * the repeating gap-blocking pattern without needing a real wall length. */
const REPRESENTATIVE_LENGTH_IN = BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN * 2;

export interface BaleFoundationCrossSectionDiagramProps {
  topDepthIn: number;
  bottomDepthIn: number;
  gapIn: number;
}

/**
 * Real, parametric side elevation of ONE bale-foundation framing stack
 * (Tommy: "when looking at it from elevation view, you see the 5.5" side
 * of two 2x6's with a gap between them") — top board, gap (with periodic
 * blocking), bottom board, all at the real configured depths, reusing
 * MemberElevationShapes the same way RoofTrussLayoutView does. Replaces
 * the old illustrative-only rim schematic this feature grew out of — the
 * "doubled" pair (2 of these stacks side by side) is a plan-view fact, not
 * an elevation one, per Tommy's own description, so this diagram
 * deliberately shows just one stack.
 */
export default function BaleFoundationCrossSectionDiagram({ topDepthIn, bottomDepthIn, gapIn }: BaleFoundationCrossSectionDiagramProps) {
  const members = buildFramingStackMembers("stack", REPRESENTATIVE_LENGTH_IN, topDepthIn, bottomDepthIn, gapIn);
  const totalHeightIn = topDepthIn + gapIn + bottomDepthIn;

  const svgWidthPx = Math.min(CANVAS_WIDTH, LEFT_MARGIN_PX + REPRESENTATIVE_LENGTH_IN * PX_PER_IN + 16);
  const scaleX = (svgWidthPx - LEFT_MARGIN_PX - 16) / REPRESENTATIVE_LENGTH_IN;
  const svgHeightPx = TOP_MARGIN_PX + totalHeightIn * PX_PER_IN + BOTTOM_MARGIN_PX;

  const xToPx = (xIn: number) => LEFT_MARGIN_PX + xIn * scaleX;
  const zToPx = (zIn: number) => svgHeightPx - BOTTOM_MARGIN_PX - zIn * PX_PER_IN;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      <svg width={svgWidthPx} height={svgHeightPx} role="img" aria-label="Bale foundation framing stack cross-section">
        <line x1={LEFT_MARGIN_PX} y1={zToPx(0)} x2={xToPx(REPRESENTATIVE_LENGTH_IN)} y2={zToPx(0)} stroke="#999" strokeDasharray="4 3" />
        <text x={4} y={zToPx(0) - 4} fontSize={9} fill="#666">
          bottom
        </text>
        <line x1={LEFT_MARGIN_PX} y1={zToPx(totalHeightIn)} x2={xToPx(REPRESENTATIVE_LENGTH_IN)} y2={zToPx(totalHeightIn)} stroke="#999" strokeDasharray="4 3" />
        <text x={4} y={zToPx(totalHeightIn) - 4} fontSize={9} fill="#666">
          top face (bears at toe-up − {SUBFLOOR_DEPTH_DEFAULT_IN}in subfloor)
        </text>
        <MemberElevationShapes members={members} xToPx={xToPx} zToPx={zToPx} />
      </svg>
      <p style={{ margin: 0, fontSize: 12, color: "#333" }}>
        {topDepthIn}in top + {gapIn}in gap (blocking every {BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN}in) + {bottomDepthIn}in bottom ={" "}
        {totalHeightIn.toFixed(2)}in total. Shown at an illustrative {REPRESENTATIVE_LENGTH_IN}in segment.
      </p>
    </div>
  );
}
