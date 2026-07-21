"use client";

import { useEffect, useRef, useState } from "react";
import { computeGableTiledRow, GABLE_SHED_SNAP_THRESHOLD_IN, type PanelSlot, type Wall } from "@building-integrity/geometry";
import {
  buildOpeningAssemblyMembers,
  COLUMN_TOTAL_WIDTH_IN,
  computeGableColumnHeightIn,
  computeGableRipCallout,
  sillDefaultHeightIn,
  standardWindowHeightDefaultIn,
  type JackStudConfig,
  type RoofSystemType,
} from "@building-integrity/panel-catalog";
import { computeOpeningGeometry } from "./openingGeometry";
import { MemberElevationShapes } from "./MemberElevationShapes";

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
  /** This wall's own second-story slots/height, if a second story exists
   * (Tommy: "each story's row for a given wall is independently clickable/
   * editable") — undefined when there's no second story, mirroring how
   * `hasGableEnd` already gates the gable band. Rendered as its own row
   * stacked above the ground row, below any gable row. */
  secondStorySlots: PanelSlot[] | undefined;
  secondStoryWallHeightFt: number | undefined;
  /** Cycles one panel's type — same 3-arg contract Building3DView's own
   * Edit tool already uses, so both surfaces share one story-aware handler
   * in page.tsx. Unlike FootprintCanvas/Building3DView, this view has no
   * separate "tool" state to gate clicking behind — there's nothing else a
   * click here could mean, so every rendered panel is always clickable. */
  onToggleOpening: (story: "ground" | "second", wallId: string, slotIndex: number) => void;
  hasGableEnd: boolean;
  /** True when this wall's own ridge height would push a Gable End Panel
   * taller than the real 8ft (GABLE_PANEL_MAX_HEIGHT_IN) max a single panel
   * can be built at (Tommy: "gable panels...can be up to 8' tall") — the
   * panel's own high edge is clamped there rather than built oversized, so
   * this surfaces that clamp instead of leaving it silent. */
  gableEndClamped: boolean;
  ridgeHeightFt: number;
  targetPanelWidthIn: number;
  thicknessIn: number;
  jackStudConfig: JackStudConfig;
  includeNailer: boolean;
  /** Beam-depth allowance under the peak — see computeGableColumnHeightIn. */
  roofCatcherBeamOffsetIn: number;
  /** Truss roofs bear on a truss plate with no center support (Tommy: "if
   * trusses, lets panelize the gable end panels with no center column");
   * only a structural-panel roof needs the center Column Panel + roof-
   * catcher beam it bears on (Tommy: "if the roof is to be panels, we need
   * a center beam and column panel"). */
  roofSystemTypeId: RoofSystemType;
  /** Inches from the wall's start corner — undefined means "not yet
   * customized" (auto-centered at the wall's own midpoint). */
  gablePeakPositionIn: number | undefined;
  /** Non-null (and disables the checkbox) when turning "Add Gable End" ON
   * for this wall would violate the 2-wall/opposite-pair guardrail — see
   * gableEndToggleBlockReason in page.tsx. Ignored while hasGableEnd is
   * already true (always allowed to turn back off). */
  gableEndToggleBlockReason: string | null;
  onToggleGableEnd: (enabled: boolean) => void;
  onChangeGablePeakPositionIn: (positionIn: number | undefined) => void;
  onGenerateShedRoof: () => void;
  /** How far gable end panel material is pulled in from each of this
   * wall's two true corners (Tommy: "gabel end panels need to start at 5.5
   * inch from the sides") — the project's real trussPlateInsetIn value,
   * same "truss bottom's own width" convention the Roof tab already uses.
   * See computeGableTiledRow's own `insetIn` param. */
  insetIn: number;
  /** Whole-building second story toggle (Tommy: "the add lay[er] button
   * should be next to add gable end button") — a second entry point to the
   * exact same action as the 2D toolbar's "Add Second Story" button, just
   * reachable from here too. */
  secondStoryEnabled: boolean;
  onToggleSecondStory: () => void;
  onClose: () => void;
}

/**
 * Per-wall face-on 2D view (X = position along the wall, Y = height) —
 * Tommy: "an arrow button for each wall section, where we can see the whole
 * line up still in 2d view." Shows the existing ground-floor run (same
 * slots/colors as the plan view, read-only here — cycle panel types in the
 * Wall tab, not here) and, when "Add Gable End" is toggled on for this
 * wall, a tiled row of Gable End Panels above it rising to the Roof tab's
 * ridge height. The peak — "the inside of the truss seat, and the bottom of
 * the peak of the truss outline" (Tommy) — can be dragged directly on the
 * SVG, dragged via the slider, or typed as a distance from either end;
 * dragging it within GABLE_SHED_SNAP_THRESHOLD_IN of an end snaps the whole
 * row to a single-slope shed roofline (see computeGableTiledRow). Unless
 * snapped to a shed, a Column Panel is centered under the peak (Tommy:
 * "there is always a column panel centered under the peak — and not there
 * if its a shed roof") — shorter than a standard full-height Column Panel
 * by the roof-catcher-beam's own depth so its top can catch the beam — but
 * only when the roof system is structural-panel; a truss roof needs no
 * center support at all (Tommy: "if trusses, lets panelize the gable end
 * panels with no center column. If the roof is to be panels, we need a
 * center beam and column panel").
 */
export default function WallElevationView({
  wall,
  slots,
  wallHeightFt,
  secondStorySlots,
  secondStoryWallHeightFt,
  onToggleOpening,
  hasGableEnd,
  gableEndClamped,
  ridgeHeightFt,
  targetPanelWidthIn,
  thicknessIn,
  jackStudConfig,
  includeNailer,
  roofCatcherBeamOffsetIn,
  roofSystemTypeId,
  gablePeakPositionIn,
  gableEndToggleBlockReason,
  onToggleGableEnd,
  onChangeGablePeakPositionIn,
  onGenerateShedRoof,
  insetIn,
  secondStoryEnabled,
  onToggleSecondStory,
  onClose,
}: WallElevationViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDraggingPeak, setIsDraggingPeak] = useState(false);

  const wallWidthIn = wall.lengthFt * 12;
  const eaveHeightIn = wallHeightFt * 12;
  // The roofline's own base — the top of whichever story is tallest (just
  // the ground floor, or ground+second when a second story exists). The
  // gable row, ridge, column, and snap-zone hints all rise from here, not
  // from the ground floor's own height, so they correctly sit on top of a
  // second story when one is present.
  const secondStoryHeightIn = secondStoryWallHeightFt ? secondStoryWallHeightFt * 12 : 0;
  const roofBaseHeightIn = eaveHeightIn + secondStoryHeightIn;
  const ridgeHeightIn = Math.max(ridgeHeightFt * 12, roofBaseHeightIn);
  const peakPositionIn = Math.min(Math.max(gablePeakPositionIn ?? wallWidthIn / 2, 0), wallWidthIn);
  // Snap decision is always against the raw wall ends, never inset-adjusted
  // — whether a peak snaps to a shed doesn't depend on insetIn (see
  // computeGableTiledRow's own doc comment).
  const isShedRoof = peakPositionIn < GABLE_SHED_SNAP_THRESHOLD_IN || peakPositionIn > wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN;

  const gablePanels = hasGableEnd
    ? computeGableTiledRow(wallWidthIn, roofBaseHeightIn, ridgeHeightIn, targetPanelWidthIn, gablePeakPositionIn, insetIn)
    : [];
  const showColumnPanel = hasGableEnd && !isShedRoof && roofSystemTypeId === "structural-panel";
  const columnHeightIn = computeGableColumnHeightIn(ridgeHeightIn, roofCatcherBeamOffsetIn);

  const maxHeightIn = hasGableEnd ? ridgeHeightIn : roofBaseHeightIn;
  const svgWidthPx = Math.min(CANVAS_WIDTH, LEFT_MARGIN_PX + wallWidthIn * PX_PER_IN + 24);
  const scaleX = (svgWidthPx - LEFT_MARGIN_PX - 24) / wallWidthIn;
  const svgHeightPx = TOP_MARGIN_PX + maxHeightIn * PX_PER_IN + BOTTOM_MARGIN_PX;

  const yPx = (heightIn: number) => svgHeightPx - BOTTOM_MARGIN_PX - heightIn * PX_PER_IN;
  const xPx = (posIn: number) => LEFT_MARGIN_PX + posIn * scaleX;

  useEffect(() => {
    if (!isDraggingPeak) return;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const pxPerScreenPx = svgWidthPx / rect.width;
      const localPx = (e.clientX - rect.left) * pxPerScreenPx;
      const posIn = Math.min(Math.max((localPx - LEFT_MARGIN_PX) / scaleX, 0), wallWidthIn);
      onChangeGablePeakPositionIn(posIn);
    };
    const handleUp = () => setIsDraggingPeak(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingPeak, svgWidthPx, scaleX, wallWidthIn, onChangeGablePeakPositionIn]);

  // A wall's own `slots` don't always cover its full geometric length —
  // for a plain rectangle, corner panels are only stored on one pair of
  // opposite walls (drawn once per building corner, attributed to whichever
  // wall "owns" it, per the tiling convention), so a row's slots can
  // legitimately stop short of `wallWidthIn` at one or both ends. Each
  // row's own top-plate line should reflect what's actually drawn in that
  // row, not the wall's raw length, or it visibly runs past the last real
  // panel.
  const rowRunWidthIn = (rowSlots: PanelSlot[]) => rowSlots.reduce((sum, s) => sum + s.widthIn, 0);
  const groundRunWidthIn = rowRunWidthIn(slots);
  const secondStoryRunWidthIn = secondStorySlots ? rowRunWidthIn(secondStorySlots) : 0;

  // Renders one story's row of panels — windows break down into their real
  // header/jack-stud/sill framing (Tommy: "they should break down in the 2d
  // elevations just like they do in the 3D box views"), colored exactly
  // like the 3D Framed view via the same computeOpeningGeometry/
  // buildOpeningAssemblyMembers geometry WindowSizeDiagram/Building3DView
  // already share. Every other slot type (and doors — no sill to make the
  // distinction meaningful for) keeps a flat SLOT_COLORS rect. Shared by
  // both the ground row and the second-story row (Tommy: "each story's row
  // for a given wall is independently clickable/editable") — `rowFloorHeightIn`
  // is this row's own floor, in global inches-from-actual-floor (0 for
  // ground, the ground's own height for a second story), so a shared local
  // `localYPx` can place both rows' geometry correctly without duplicating
  // this rendering logic per story.
  const renderRow = (rowSlots: PanelSlot[], rowWallHeightIn: number, rowFloorHeightIn: number, story: "ground" | "second") => {
    const rects = rowSlots.reduce<{ slot: PanelSlot; i: number; x0: number; x1: number }[]>((acc, slot, i) => {
      const x0 = acc.length > 0 ? acc[acc.length - 1]!.x1 : 0;
      acc.push({ slot, i, x0, x1: x0 + slot.widthIn });
      return acc;
    }, []);
    const localYPx = (localHeightIn: number) => yPx(rowFloorHeightIn + localHeightIn);
    return rects.map(({ slot, i, x0, x1 }) => {
      if (slot.type === "window") {
        const g = computeOpeningGeometry(
          false,
          slot.widthIn,
          rowWallHeightIn,
          slot.sillHeightIn ?? sillDefaultHeightIn.value,
          slot.heightIn ?? standardWindowHeightDefaultIn.value,
          jackStudConfig,
          targetPanelWidthIn,
        );
        const members = buildOpeningAssemblyMembers(
          slot.widthIn,
          thicknessIn,
          "window",
          jackStudConfig,
          g.sillHeightIn,
          g.jackStudSpanIn,
          g.headerHeightIn,
          g.sillHeightIn,
          g.sillWidthsIn,
          includeNailer,
        );
        const localXToPx = (xIn: number) => xPx(x0 + xIn);
        // The actual glazed opening — open, not filled by any member,
        // matching the 3D view, inset between the two jack studs.
        const roGapXPx = localXToPx(g.jackThicknessIn);
        const roGapWidthPx = localXToPx(slot.widthIn - g.jackThicknessIn) - roGapXPx;
        const roGapTopPx = localYPx(g.roTopZIn);
        const roGapHeightPx = localYPx(g.sillHeightIn) - roGapTopPx;
        return (
          <g key={`${story}-${i}`} onClick={() => onToggleOpening(story, wall.id, i)} style={{ cursor: "pointer" }}>
            <MemberElevationShapes members={members} xToPx={localXToPx} zToPx={localYPx} />
            <rect
              x={roGapXPx}
              y={roGapTopPx}
              width={Math.max(0, roGapWidthPx)}
              height={Math.max(0, roGapHeightPx)}
              fill="none"
              stroke="#6fa0c9"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            <text x={xPx((x0 + x1) / 2)} y={localYPx(rowWallHeightIn) - 6} fontSize={8} textAnchor="middle" fill="#333">
              {slot.widthIn}&quot;
            </text>
          </g>
        );
      }
      return (
        <g key={`${story}-${i}`} onClick={() => onToggleOpening(story, wall.id, i)} style={{ cursor: "pointer" }}>
          <rect
            x={xPx(x0)}
            y={localYPx(rowWallHeightIn)}
            width={(x1 - x0) * scaleX}
            height={rowWallHeightIn * PX_PER_IN}
            fill={SLOT_COLORS[slot.type]}
            stroke="#666"
            strokeWidth={1}
          />
          <text x={xPx((x0 + x1) / 2)} y={localYPx(rowWallHeightIn / 2)} fontSize={9} textAnchor="middle" fill="#333">
            {slot.widthIn}&quot;
          </text>
        </g>
      );
    });
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Wall {wall.id} elevation</strong>
        <button type="button" onClick={onClose} style={{ fontSize: 12 }}>
          Close
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 4 }}>
        <label
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          title={!hasGableEnd && gableEndToggleBlockReason ? gableEndToggleBlockReason : undefined}
        >
          <input
            type="checkbox"
            checked={hasGableEnd}
            disabled={!hasGableEnd && !!gableEndToggleBlockReason}
            onChange={(e) => onToggleGableEnd(e.target.checked)}
          />
          Add Gable End (tiles Gable End Panels up to the Roof tab&apos;s ridge height)
        </label>
        <button
          type="button"
          onClick={onToggleSecondStory}
          aria-pressed={secondStoryEnabled}
          title="Stacks a second full pass of wall panels at this wall's own top-plate height (same action as the 2D toolbar's Add Second Story button)."
          style={{ fontSize: 13 }}
        >
          {secondStoryEnabled ? "Remove Layer" : "Add Layer"}
        </button>
      </div>
      {!hasGableEnd && gableEndToggleBlockReason && (
        <p style={{ fontSize: 12, color: "#c0392b", marginTop: 0, marginBottom: 8 }}>{gableEndToggleBlockReason}</p>
      )}
      {hasGableEnd && gableEndClamped && (
        <p style={{ fontSize: 12, color: "#c0392b", marginTop: 0, marginBottom: 8 }}>
          This wall&apos;s ridge is tall enough that its Gable End Panel(s) have been clamped to the real 8ft max a
          single panel can be built at — lower the Roof tab&apos;s ridge height, or move this wall&apos;s peak, to
          avoid clipping.
        </p>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidthPx} ${svgHeightPx}`}
        style={{ width: "100%", maxWidth: svgWidthPx, height: "auto", background: "#fafafa" }}
        role="img"
        aria-label={`Elevation view of wall ${wall.id}`}
      >
        {/* Ground top-plate line — spans only the ground row's own actual
            width (see groundRunWidthIn above), not the wall's raw
            geometric length. Always the ground floor's own height,
            regardless of whether a second story exists above it. */}
        <line x1={LEFT_MARGIN_PX} y1={yPx(eaveHeightIn)} x2={xPx(groundRunWidthIn)} y2={yPx(eaveHeightIn)} stroke="#999" strokeDasharray="4 3" />
        <text x={4} y={yPx(eaveHeightIn) + 4} fontSize={10} fill="#666">
          {eaveHeightIn}&quot;
        </text>
        {renderRow(slots, eaveHeightIn, 0, "ground")}

        {/* Second-story row + its own top-plate line (Tommy: "each story's
            row for a given wall is independently clickable/editable") —
            only rendered once a second story exists; this is also the
            roofline's own base (roofBaseHeightIn) once present. */}
        {secondStorySlots && (
          <>
            <line
              x1={LEFT_MARGIN_PX}
              y1={yPx(roofBaseHeightIn)}
              x2={xPx(secondStoryRunWidthIn)}
              y2={yPx(roofBaseHeightIn)}
              stroke="#999"
              strokeDasharray="4 3"
            />
            <text x={4} y={yPx(roofBaseHeightIn) + 4} fontSize={10} fill="#666">
              {roofBaseHeightIn}&quot;
            </text>
            {renderRow(secondStorySlots, secondStoryHeightIn, eaveHeightIn, "second")}
          </>
        )}

        {/* Gable row */}
        {hasGableEnd &&
          gablePanels.map((p, i) => {
            const points = [
              [xPx(p.xStartIn), yPx(roofBaseHeightIn)],
              [xPx(p.xEndIn), yPx(roofBaseHeightIn)],
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
                <text x={xPx((p.xStartIn + p.xEndIn) / 2)} y={yPx(roofBaseHeightIn) - 6} fontSize={8} textAnchor="middle" fill="#333">
                  {rip.angleDeg.toFixed(1)}&deg; / {rip.lengthIn.toFixed(0)}&quot;
                </text>
              </g>
            );
          })}

        {/* Column Panel, centered under the peak — bears the roof-catcher
            beam, so it's shorter than a full-height Column Panel by the
            beam's own depth (roofCatcherBeamOffsetIn). Not shown for a shed
            roof (single slope, no peak to bear a beam under). */}
        {showColumnPanel && (
          <g>
            <rect
              x={xPx(peakPositionIn - COLUMN_TOTAL_WIDTH_IN / 2)}
              y={yPx(columnHeightIn)}
              width={COLUMN_TOTAL_WIDTH_IN * scaleX}
              height={columnHeightIn * PX_PER_IN}
              fill={SLOT_COLORS.column}
              stroke="#2c5a66"
              strokeWidth={1}
            />
            <text x={xPx(peakPositionIn)} y={yPx(columnHeightIn / 2)} fontSize={8} textAnchor="middle" fill="#fff">
              Column
            </text>
          </g>
        )}

        {/* Ridge line */}
        {hasGableEnd && (
          <>
            <line x1={LEFT_MARGIN_PX} y1={yPx(ridgeHeightIn)} x2={xPx(wallWidthIn)} y2={yPx(ridgeHeightIn)} stroke="#3a5a8a" strokeDasharray="4 3" />
            <text x={4} y={yPx(ridgeHeightIn) + 4} fontSize={10} fill="#3a5a8a">
              {ridgeHeightIn}&quot;
            </text>

            {/* Snap-zone hints at both ends — always at the raw wall
                corners (see isShedRoof's own comment: the snap decision
                never depends on insetIn). */}
            <rect
              x={xPx(0)}
              y={yPx(ridgeHeightIn)}
              width={GABLE_SHED_SNAP_THRESHOLD_IN * scaleX}
              height={(ridgeHeightIn - roofBaseHeightIn) * PX_PER_IN}
              fill="#c0392b"
              opacity={0.08}
            />
            <rect
              x={xPx(wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN)}
              y={yPx(ridgeHeightIn)}
              width={GABLE_SHED_SNAP_THRESHOLD_IN * scaleX}
              height={(ridgeHeightIn - roofBaseHeightIn) * PX_PER_IN}
              fill="#c0392b"
              opacity={0.08}
            />

            {/* Draggable peak handle */}
            <g
              style={{ cursor: "ew-resize" }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingPeak(true);
              }}
            >
              <line
                x1={xPx(peakPositionIn)}
                y1={yPx(roofBaseHeightIn)}
                x2={xPx(peakPositionIn)}
                y2={yPx(ridgeHeightIn)}
                stroke="#c0392b"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <circle cx={xPx(peakPositionIn)} cy={yPx(ridgeHeightIn)} r={7} fill="#c0392b" stroke="#fff" strokeWidth={1.5} />
            </g>
          </>
        )}
      </svg>
      {hasGableEnd && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 12, marginTop: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            Peak
            <input
              type="range"
              min={0}
              max={wallWidthIn}
              step={1}
              value={peakPositionIn}
              onChange={(e) => onChangeGablePeakPositionIn(Number(e.target.value))}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            From left end
            <input
              type="number"
              min={0}
              max={wallWidthIn}
              value={Math.round(peakPositionIn)}
              onChange={(e) => onChangeGablePeakPositionIn(Number(e.target.value))}
              style={{ width: 60 }}
            />
            in
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            From right end
            <input
              type="number"
              min={0}
              max={wallWidthIn}
              value={Math.round(wallWidthIn - peakPositionIn)}
              onChange={(e) => onChangeGablePeakPositionIn(wallWidthIn - Number(e.target.value))}
              style={{ width: 60 }}
            />
            in
          </label>
          <button type="button" onClick={() => onChangeGablePeakPositionIn(undefined)}>
            Center
          </button>
          <button type="button" onClick={onGenerateShedRoof} title="Snaps the peak to one end and sets the ridge height for a 4/12 pitch across this wall's full width">
            Shed Roof (auto 4/12)
          </button>
          {isShedRoof && <span style={{ color: "#c0392b" }}>Snapped to a shed roof (single slope)</span>}
        </div>
      )}
      <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
        {hasGableEnd
          ? `${gablePanels.length} Gable End Panel${gablePanels.length === 1 ? "" : "s"} tiled at ~${targetPanelWidthIn}in each, ` +
            `rising from the ${roofBaseHeightIn}in eave to the ${ridgeHeightIn}in ridge` +
            (isShedRoof ? " (snapped to a single-slope shed)." : ` (peak ${Math.round(peakPositionIn)}in from the left end).`) +
            " Each panel's rip angle/length is labeled above it. Drag the red peak marker, use the slider, " +
            "or type an exact distance from either end — dragging within " +
            `${GABLE_SHED_SNAP_THRESHOLD_IN}in of an end (shaded above) snaps to a shed roof. Use the Roof tab to change the ` +
            "ridge height, or the panel-width setting above to change the tiling." +
            (showColumnPanel
              ? ` A ${columnHeightIn.toFixed(1)}in Column Panel is centered under the peak, ${roofCatcherBeamOffsetIn}in ` +
                "shorter than the ridge so its top can catch the roof-catcher beam (see the Roof tab)."
              : isShedRoof
                ? " No Column Panel for a shed roof (single slope, no peak to bear a beam under)."
                : " No Column Panel — Truss roof selected (Roof tab): trusses bear on a truss plate with no center support. Switch to a structural-panel roof for a beam-bearing Column Panel.")
          : "Ground-floor run shown for reference (cycle panel types in the Wall tab, not here). Toggle \"Add Gable End\" " +
            "above to preview a tiled row of Gable End Panels rising to the Roof tab's ridge height."}
      </p>
    </div>
  );
}
