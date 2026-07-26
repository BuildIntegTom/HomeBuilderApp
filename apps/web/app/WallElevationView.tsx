"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeGableTiledRow,
  GABLE_SHED_SNAP_THRESHOLD_IN,
  type GableTiledPanel,
  type PanelSlot,
  type RoofProfilePoint,
  type Wall,
} from "@building-integrity/geometry";
import {
  buildOpeningAssemblyMembers,
  COLUMN_TOTAL_WIDTH_IN,
  computeBoxBeamHeightDeltaIn,
  computeGableColumnHeightIn,
  computeGableRipCallout,
  sillDefaultHeightIn,
  standardWindowHeightDefaultIn,
  type BoxBeamSizeId,
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
const GABLE_SAFETY_GAP_COLOR = "#e08a3c";
const VERTICAL_GAP_COLOR = "#f0c08a";

/** Default along-wall position for a profile point that hasn't been
 * explicitly customized — the single midpoint for a peaked (1-point)
 * profile, or a symmetric flat run spanning the middle third for a
 * flat-top (2-point) profile. Mirrors page.tsx's own gableTilesByWallId
 * resolution exactly, so this preview never disagrees with the real data. */
function defaultPointXIn(pointIndex: number, pointCount: number, wallWidthIn: number): number {
  return pointCount === 1 ? wallWidthIn / 2 : ((pointIndex + 1) * wallWidthIn) / 3;
}

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
  /** True when this wall has at least one tile whose real roofline rise
   * exceeds maxGablePanelHeightIn — it got a real vertical safety-gap
   * filler above the (real 8ft max) Gable End Panel, rendered below. */
  gableEndClamped: boolean;
  /** "peaked" = 1 real profile point (a ridge); "flat-top" = 2
   * independently-placed points. Global (Roof tab) — same type/height
   * every gable-enabled wall shares; only each point's own along-wall
   * POSITION is per-wall (see gableProfilePositionsIn below). */
  roofProfileType: "peaked" | "flat-top";
  /** One real height (ft) per profile point, index-matched to
   * roofProfileType's own point count — read-only here (set on the Roof
   * tab), just used to draw this wall's own roofline preview. */
  roofProfilePointHeightsFt: number[];
  /** The roof-bearing member's own real thickness (0 when no roof system
   * is enabled) — added on top of this wall's own eave height so the
   * roofline (and the gable panels tiling up to it) starts flush with the
   * TOP of that assembly, matching where a real truss's own bottom chord
   * actually bears, not the bare wall-top-plate height. */
  roofBearingAssemblyHeightIn: number;
  /** The real per-tile fabrication ceiling (Tommy: "gable panels...can be
   * up to 8' tall") — a user-tunable threshold; any real rise above it
   * gets filled by a real vertical safety-gap tile instead of clipped. */
  maxGablePanelHeightIn: number;
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
   * a center beam and column panel"). Also only meaningful for a "peaked"
   * profile — a flat-topped roofline has no single peak for a beam to run
   * to/from (see computeRidgeLine's own single-peak assumption); no Column
   * Panel renders for a flat-top profile regardless of roof system. */
  roofSystemTypeId: RoofSystemType;
  /** This wall's own real position (inches from the wall's start corner)
   * for each profile point, index-matched to roofProfileType's own point
   * count. `null`/missing means "not yet customized" (auto-centered). */
  gableProfilePositionsIn: (number | null)[];
  /** Non-null (and disables the checkbox) when turning "Add Gable End" ON
   * for this wall would violate the 2-wall/opposite-pair guardrail — see
   * gableEndToggleBlockReason in page.tsx. Ignored while hasGableEnd is
   * already true (always allowed to turn back off). */
  gableEndToggleBlockReason: string | null;
  onToggleGableEnd: (enabled: boolean) => void;
  onChangeGableProfilePositionIn: (pointIndex: number, positionIn: number | undefined) => void;
  onGenerateShedRoof: () => void;
  /** How far gable end panel material is pulled in from each of this
   * wall's two true corners (Tommy: "gabel end panels need to start at 5.5
   * inch from the sides") — the project's real trussPlateInsetIn value,
   * same "truss bottom's own width" convention the Roof tab already uses.
   * See computeGableTiledRow's own `insetIn` param. */
  insetIn: number;
  /** Energy-heel truss seat height (Tommy: "have the truss seat be the full
   * panel width AND THEN go vertical for 6in (adjustable)") — the project's
   * real heelHeightIn value; 0 disables it. See computeGableTiledRow's own
   * `heelHeightIn` param. */
  heelHeightIn: number;
  /** Whether THIS wall has a Box Beam (rather than a Truss Plate) as its
   * own 2nd-story roof-bearing member (Tommy: "options for being a ring
   * all the way around or just one section of the wall") — only shown/
   * meaningful once `secondStoryEnabled`. See page.tsx's `boxBeamWallIds`. */
  hasBoxBeam: boolean;
  onToggleBoxBeam: (enabled: boolean) => void;
  /** Which box-beam size/material every selected wall uses, project-wide
   * (page.tsx's `boxBeamSizeId`) — used to compute how much shorter this
   * wall's own second-story row is built when `hasBoxBeam` is true (see
   * computeBoxBeamHeightDeltaIn). */
  boxBeamSizeId: BoxBeamSizeId;
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
 * own profile point height(s) — either "peaked" (1 point, a ridge) or
 * "flat-top" (2 independently-placed points, Tommy: "a triangle shaped with
 * the top chopped off"). Each point's own along-wall position — "the
 * inside of the truss seat, and the bottom of the peak of the truss
 * outline" (Tommy) — can be dragged directly on the SVG, dragged via its
 * own slider, or typed as a distance from either end; dragging one within
 * GABLE_SHED_SNAP_THRESHOLD_IN of its own nearest end snaps that side to a
 * single-slope shed (see computeGableTiledRow). Unless snapped to a shed, a
 * Column Panel is centered under a "peaked" profile's own single point
 * (Tommy: "there is always a column panel centered under the peak — and
 * not there if its a shed roof") — shorter than a standard full-height
 * Column Panel by the roof-catcher-beam's own depth so its top can catch
 * the beam — but only when the roof system is structural-panel; a truss
 * roof needs no center support at all, and a "flat-top" profile has no
 * single peak for the beam/column system to reference at all (Tommy: "if
 * trusses, lets panelize the gable end panels with no center column. If
 * the roof is to be panels, we need a center beam and column panel").
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
  roofProfileType,
  roofProfilePointHeightsFt,
  roofBearingAssemblyHeightIn,
  maxGablePanelHeightIn,
  targetPanelWidthIn,
  thicknessIn,
  jackStudConfig,
  includeNailer,
  roofCatcherBeamOffsetIn,
  roofSystemTypeId,
  gableProfilePositionsIn,
  gableEndToggleBlockReason,
  onToggleGableEnd,
  onChangeGableProfilePositionIn,
  onGenerateShedRoof,
  insetIn,
  heelHeightIn,
  hasBoxBeam,
  onToggleBoxBeam,
  boxBeamSizeId,
  secondStoryEnabled,
  onToggleSecondStory,
  onClose,
}: WallElevationViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  const wallWidthIn = wall.lengthFt * 12;
  const eaveHeightIn = wallHeightFt * 12;
  // The roofline's own base — the top of whichever story is tallest (just
  // the ground floor, or ground+second when a second story exists), PLUS
  // the roof-bearing member's own thickness (0 when no roof system is
  // enabled) — a real truss's own bottom chord bears on TOP of that
  // assembly, not the bare wall-top-plate height. The gable row, points,
  // and snap-zone hints all rise from here.
  const secondStoryHeightIn = secondStoryWallHeightFt ? secondStoryWallHeightFt * 12 : 0;
  const roofBaseHeightIn = eaveHeightIn + secondStoryHeightIn + roofBearingAssemblyHeightIn;
  // A Box Beam wall's own second-story row is built shorter (Tommy: "the
  // roof lines needs to be respected" — the row shrinks, not the shared
  // roofline above) — secondStoryHeightIn above stays the NOMINAL height
  // for roofBaseHeightIn's own purposes; this is the row's own real
  // rendered height, used only where the row itself is drawn.
  const secondStoryPanelHeightIn = hasBoxBeam ? secondStoryHeightIn - computeBoxBeamHeightDeltaIn(boxBeamSizeId) : secondStoryHeightIn;

  const pointCount = roofProfilePointHeightsFt.length;
  const resolvedPointXsIn = roofProfilePointHeightsFt.map((_, i) => {
    const stored = gableProfilePositionsIn[i];
    return Math.min(Math.max(stored ?? defaultPointXIn(i, pointCount, wallWidthIn), 0), wallWidthIn);
  });
  // Snap decision is always against the raw wall ends, never inset-adjusted
  // — whether a point snaps to a shed doesn't depend on insetIn (see
  // computeGableTiledRow's own doc comment). Only an explicitly-positioned
  // point (a real stored value, not the auto-default) can snap.
  const pointIsExplicit = roofProfilePointHeightsFt.map((_, i) => gableProfilePositionsIn[i] != null);
  const pointIsSnapped = resolvedPointXsIn.map(
    (xIn, i) => pointIsExplicit[i] && (xIn < GABLE_SHED_SNAP_THRESHOLD_IN || xIn > wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN),
  );
  const isShedRoof = pointIsSnapped.some(Boolean);

  const points: RoofProfilePoint[] = roofProfilePointHeightsFt.map((heightFt, i) => ({
    xIn: resolvedPointXsIn[i]!,
    heightIn: heightFt * 12,
    isExplicitPosition: pointIsExplicit[i],
  }));
  const maxProfileHeightIn = Math.max(...roofProfilePointHeightsFt.map((h) => h * 12), roofBaseHeightIn);

  // Cap each tile's own edges at the real per-panel fabrication ceiling
  // (Tommy: "an ability to put a safety gap inbetween the truss bottom and
  // the gable end top") — any real rise above it becomes a
  // verticalGapHeightIn filler (rendered separately below) instead of
  // being built into (or silently clipped from) the Gable End Panel
  // itself. Mirrors page.tsx's own gableTilesByWallId capping exactly, so
  // this preview never disagrees with the real fabrication data.
  const capHeightIn = roofBaseHeightIn + maxGablePanelHeightIn;
  const rawGablePanels = hasGableEnd
    ? computeGableTiledRow(wallWidthIn, roofBaseHeightIn, points, targetPanelWidthIn, insetIn, true, heelHeightIn)
    : [];
  const gablePanels: (GableTiledPanel & { verticalGapHeightIn?: number })[] = rawGablePanels.map((p) => {
    const leftCappedIn = Math.min(p.leftHeightIn, capHeightIn);
    const rightCappedIn = Math.min(p.rightHeightIn, capHeightIn);
    const overflowIn = Math.max(p.leftHeightIn - leftCappedIn, p.rightHeightIn - rightCappedIn);
    if (overflowIn <= 0) return p;
    return { ...p, leftHeightIn: leftCappedIn, rightHeightIn: rightCappedIn, verticalGapHeightIn: overflowIn };
  });
  // A Column Panel only makes sense under a single, real peak — a
  // flat-topped profile has no one point for the roof-catcher beam to run
  // to/from (computeRidgeLine assumes exactly one peak per wall).
  const showColumnPanel = hasGableEnd && roofProfileType === "peaked" && !isShedRoof && roofSystemTypeId === "structural-panel";
  const singlePeakHeightIn = points[0]?.heightIn ?? roofBaseHeightIn;
  const columnHeightIn = computeGableColumnHeightIn(singlePeakHeightIn, roofCatcherBeamOffsetIn);

  const maxHeightIn = hasGableEnd ? maxProfileHeightIn : roofBaseHeightIn;
  const svgWidthPx = Math.min(CANVAS_WIDTH, LEFT_MARGIN_PX + wallWidthIn * PX_PER_IN + 24);
  const scaleX = (svgWidthPx - LEFT_MARGIN_PX - 24) / wallWidthIn;
  const svgHeightPx = TOP_MARGIN_PX + maxHeightIn * PX_PER_IN + BOTTOM_MARGIN_PX;

  const yPx = (heightIn: number) => svgHeightPx - BOTTOM_MARGIN_PX - heightIn * PX_PER_IN;
  const xPx = (posIn: number) => LEFT_MARGIN_PX + posIn * scaleX;

  useEffect(() => {
    if (draggingPointIndex === null) return;
    const pointIndex = draggingPointIndex;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const pxPerScreenPx = svgWidthPx / rect.width;
      const localPx = (e.clientX - rect.left) * pxPerScreenPx;
      const posIn = Math.min(Math.max((localPx - LEFT_MARGIN_PX) / scaleX, 0), wallWidthIn);
      onChangeGableProfilePositionIn(pointIndex, posIn);
    };
    const handleUp = () => setDraggingPointIndex(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingPointIndex, svgWidthPx, scaleX, wallWidthIn, onChangeGableProfilePositionIn]);

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
          Add Gable End (tiles Gable End Panels up to the Roof tab&apos;s own profile height)
        </label>
        {secondStoryEnabled && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={hasBoxBeam} onChange={(e) => onToggleBoxBeam(e.target.checked)} />
            Box Beam (replaces this wall&apos;s Truss Plate above the 2nd story row — that row is built shorter to
            still reach the same roofline)
          </label>
        )}
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
        <p style={{ fontSize: 12, color: "#a06a1f", marginTop: 0, marginBottom: 8 }}>
          This wall&apos;s roofline rises higher than the {maxGablePanelHeightIn}in max a single Gable End Panel can
          be built at — the real remainder is filled by a vertical safety-gap tile (shown below), not clipped.
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
            only rendered once a second story exists. */}
        {secondStorySlots && (
          <>
            <line
              x1={LEFT_MARGIN_PX}
              y1={yPx(eaveHeightIn + secondStoryPanelHeightIn)}
              x2={xPx(secondStoryRunWidthIn)}
              y2={yPx(eaveHeightIn + secondStoryPanelHeightIn)}
              stroke="#999"
              strokeDasharray="4 3"
            />
            <text x={4} y={yPx(eaveHeightIn + secondStoryPanelHeightIn) + 4} fontSize={10} fill="#666">
              {eaveHeightIn + secondStoryPanelHeightIn}&quot;
              {hasBoxBeam ? " (shortened for Box Beam)" : ""}
            </text>
            {renderRow(secondStorySlots, secondStoryPanelHeightIn, eaveHeightIn, "second")}
          </>
        )}

        {/* Roof-bearing member's own top-plate-like reference line, only
            when it actually adds height on top of the wall/second story —
            this is where the gable row's own low edge starts. */}
        {roofBearingAssemblyHeightIn > 0 && (
          <line x1={LEFT_MARGIN_PX} y1={yPx(roofBaseHeightIn)} x2={xPx(wallWidthIn)} y2={yPx(roofBaseHeightIn)} stroke="#999" strokeDasharray="4 3" />
        )}

        {/* Gable row — a distinct fill for the one dedicated safety-gap
            tile per segment (Tommy: "a safety gap in the run of gable end
            panels"), same GABLE_SAFETY_GAP_COLOR every real fabrication
            page would show it in. */}
        {hasGableEnd &&
          gablePanels.map((p, i) => {
            const points4 = [
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
                <polygon points={points4} fill={p.isSafetyGap ? GABLE_SAFETY_GAP_COLOR : GABLE_COLOR} stroke="#3a5a8a" strokeWidth={1} />
                {!p.isSafetyGap && (
                  <text x={xPx((p.xStartIn + p.xEndIn) / 2)} y={yPx(roofBaseHeightIn) - 6} fontSize={8} textAnchor="middle" fill="#333">
                    {rip.angleDeg.toFixed(1)}&deg; / {rip.lengthIn.toFixed(0)}&quot;
                  </text>
                )}
              </g>
            );
          })}

        {/* Vertical safety gap (Tommy: "an ability to put a safety gap
            inbetween the truss bottom and the gable end top") — the real
            remainder between a capped Gable End Panel's own top and the
            true roofline, filled by a real tile instead of clipped. */}
        {hasGableEnd &&
          gablePanels.map((p, i) => {
            const gapIn = p.verticalGapHeightIn;
            if (!gapIn) return null;
            const points4 = [
              [xPx(p.xStartIn), yPx(p.leftHeightIn)],
              [xPx(p.xEndIn), yPx(p.rightHeightIn)],
              [xPx(p.xEndIn), yPx(p.rightHeightIn + gapIn)],
              [xPx(p.xStartIn), yPx(p.leftHeightIn + gapIn)],
            ]
              .map(([x, y]) => `${x},${y}`)
              .join(" ");
            return <polygon key={`gap-${i}`} points={points4} fill={VERTICAL_GAP_COLOR} stroke="#a06a1f" strokeWidth={1} strokeDasharray="3 2" />;
          })}

        {/* Column Panel, centered under a "peaked" profile's own single
            point — bears the roof-catcher beam, so it's shorter than a
            full-height Column Panel by the beam's own depth
            (roofCatcherBeamOffsetIn). Not shown for a shed roof (single
            slope, no peak to bear a beam under) or a flat-top profile (no
            single peak at all). */}
        {showColumnPanel && (
          <g>
            <rect
              x={xPx(resolvedPointXsIn[0]! - COLUMN_TOTAL_WIDTH_IN / 2)}
              y={yPx(columnHeightIn)}
              width={COLUMN_TOTAL_WIDTH_IN * scaleX}
              height={columnHeightIn * PX_PER_IN}
              fill={SLOT_COLORS.column}
              stroke="#2c5a66"
              strokeWidth={1}
            />
            <text x={xPx(resolvedPointXsIn[0]!)} y={yPx(columnHeightIn / 2)} fontSize={8} textAnchor="middle" fill="#fff">
              Column
            </text>
          </g>
        )}

        {/* One reference line + draggable handle per real profile point. */}
        {hasGableEnd &&
          points.map((point, i) => (
            <g key={i}>
              <line
                x1={LEFT_MARGIN_PX}
                y1={yPx(point.heightIn)}
                x2={xPx(wallWidthIn)}
                y2={yPx(point.heightIn)}
                stroke="#3a5a8a"
                strokeDasharray="4 3"
              />
              <text x={4} y={yPx(point.heightIn) + 4} fontSize={10} fill="#3a5a8a">
                {point.heightIn}&quot;
              </text>

              {/* Snap-zone hints at both ends — always at the raw wall
                  corners (the snap decision never depends on insetIn). */}
              <rect
                x={xPx(0)}
                y={yPx(point.heightIn)}
                width={GABLE_SHED_SNAP_THRESHOLD_IN * scaleX}
                height={Math.max(0, (point.heightIn - roofBaseHeightIn) * PX_PER_IN)}
                fill="#c0392b"
                opacity={0.08}
              />
              <rect
                x={xPx(wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN)}
                y={yPx(point.heightIn)}
                width={GABLE_SHED_SNAP_THRESHOLD_IN * scaleX}
                height={Math.max(0, (point.heightIn - roofBaseHeightIn) * PX_PER_IN)}
                fill="#c0392b"
                opacity={0.08}
              />

              <g
                style={{ cursor: "ew-resize" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraggingPointIndex(i);
                }}
              >
                <line
                  x1={xPx(resolvedPointXsIn[i]!)}
                  y1={yPx(roofBaseHeightIn)}
                  x2={xPx(resolvedPointXsIn[i]!)}
                  y2={yPx(point.heightIn)}
                  stroke="#c0392b"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <circle cx={xPx(resolvedPointXsIn[i]!)} cy={yPx(point.heightIn)} r={7} fill="#c0392b" stroke="#fff" strokeWidth={1.5} />
              </g>
            </g>
          ))}
      </svg>
      {hasGableEnd &&
        points.map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 12, marginTop: 6 }}>
            <span style={{ fontWeight: 600 }}>{pointCount === 1 ? "Peak" : `Point ${i + 1}`}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Position
              <input
                type="range"
                min={0}
                max={wallWidthIn}
                step={1}
                value={resolvedPointXsIn[i]}
                onChange={(e) => onChangeGableProfilePositionIn(i, Number(e.target.value))}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              From left end
              <input
                type="number"
                min={0}
                max={wallWidthIn}
                value={Math.round(resolvedPointXsIn[i]!)}
                onChange={(e) => onChangeGableProfilePositionIn(i, Number(e.target.value))}
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
                value={Math.round(wallWidthIn - resolvedPointXsIn[i]!)}
                onChange={(e) => onChangeGableProfilePositionIn(i, wallWidthIn - Number(e.target.value))}
                style={{ width: 60 }}
              />
              in
            </label>
            <button type="button" onClick={() => onChangeGableProfilePositionIn(i, undefined)}>
              Center
            </button>
            {i === 0 && (
              <button
                type="button"
                onClick={onGenerateShedRoof}
                title="Snaps this point to one end and sets its own height for a 4/12 pitch across this wall's full width"
              >
                Shed Roof (auto 4/12)
              </button>
            )}
            {pointIsSnapped[i] && <span style={{ color: "#c0392b" }}>Snapped to a shed (single slope) on this side</span>}
          </div>
        ))}
      <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
        {hasGableEnd
          ? `${gablePanels.length} Gable End Panel${gablePanels.length === 1 ? "" : "s"} (incl. any safety-gap tiles) tiled at ~${targetPanelWidthIn}in each, ` +
            `rising from the ${roofBaseHeightIn}in eave to ${pointCount === 1 ? `the ${points[0]!.heightIn}in ridge` : "the flat-topped roofline above"}` +
            (isShedRoof ? " (at least one side snapped to a single-slope shed)." : ".") +
            " Each panel's rip angle/length is labeled above it. Drag a red marker, use its own slider, " +
            "or type an exact distance from either end — dragging one within " +
            `${GABLE_SHED_SNAP_THRESHOLD_IN}in of its own nearest end (shaded above) snaps that side to a shed roof. Use the Roof tab to change ` +
            "profile heights/type, or the panel-width setting above to change the tiling." +
            (showColumnPanel
              ? ` A ${columnHeightIn.toFixed(1)}in Column Panel is centered under the peak, ${roofCatcherBeamOffsetIn}in ` +
                "shorter than the ridge so its top can catch the roof-catcher beam (see the Roof tab)."
              : roofProfileType === "flat-top"
                ? " No Column Panel for a flat-topped roofline (no single peak for a beam to reference)."
                : isShedRoof
                  ? " No Column Panel for a shed roof (single slope, no peak to bear a beam under)."
                  : " No Column Panel — Truss roof selected (Roof tab): trusses bear on a truss plate with no center support. Switch to a structural-panel roof for a beam-bearing Column Panel.")
          : "Ground-floor run shown for reference (cycle panel types in the Wall tab, not here). Toggle \"Add Gable End\" " +
            "above to preview a tiled row of Gable End Panels rising to the Roof tab's own profile height."}
      </p>
    </div>
  );
}
