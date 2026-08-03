"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  computeGableTiledRow,
  computeRoofBearingSegments,
  computeWallVerticalBandsForSlotWithMaxHeight,
  effectiveZonesForSlot,
  isSlotBoxBeamCovered,
  zoneFromSlot,
  type BoxBeamCoverage,
  type GableTiledPanel,
  type PanelSlot,
  type PanelSlotZone,
  type RoofProfilePoint,
  type Wall,
  type WallVerticalBand,
} from "@building-integrity/geometry";
import {
  buildOpeningAssemblyMembers,
  COLUMN_TOTAL_WIDTH_IN,
  computeBoxBeamHeightDeltaIn,
  computeGableColumnHeightIn,
  computeGableRipCallout,
  GABLE_PANEL_MAX_HEIGHT_IN,
  panelHeightInRange,
  sillDefaultHeightIn,
  standardWindowHeightDefaultIn,
  type BoxBeamSizeId,
  type JackStudConfig,
  type RoofSystemType,
} from "@building-integrity/panel-catalog";
import { computeOpeningGeometry } from "./openingGeometry";
import { MemberElevationShapes } from "./MemberElevationShapes";
import { NAMED_PANEL_TYPE_COLORS } from "./panelColors";
import { capGableTileHeights, GABLE_SHED_SNAP_THRESHOLD_IN, matchStandardPitchIn12, resolveGableProfilePoints } from "./gableProfilePoints";
import {
  LINTEL_MIN_HEIGHT_IN,
  MID_WALL_BEAM_HEADER_SNAP_THRESHOLD_IN,
  MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN,
  midWallBeamsToGeometry,
  resolveMidWallBeamAssemblyHeightIn,
  type MidWallBeam,
} from "./midWallBeam";

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

export interface WallElevationDiagramProps {
  wall: Wall;
  slots: PanelSlot[];
  wallHeightFt: number;
  /** Whether THIS wall owns a real "corner" PanelSlot at its own start/end
   * (Tommy: "you see all the panel surfaces on that wall — including the
   * panelwidth side of the opposing wall for the walls that dont start of
   * end with corner panels") — see cornerOwnership in
   * packages/geometry/src/retile.ts: at a plain 90deg corner only the
   * locally SHORTER of the two walls meeting there owns the corner panel,
   * the longer one butts flush against it instead. False at either end
   * means this wall's own slots stop `thicknessIn` short of that end's true
   * corner, and a filler sliver (the neighboring wall's own corner panel,
   * visible edge-on) is drawn in that gap instead. */
  hasCornerStart: boolean;
  hasCornerEnd: boolean;
  /** This wall's own second-story slots/height, if a second story exists
   * (Tommy: "each story's row for a given wall is independently clickable/
   * editable") — undefined when there's no second story, mirroring how
   * `hasGableEnd` already gates the gable band. Rendered as its own row
   * stacked above the ground row, below any gable row. */
  secondStorySlots: PanelSlot[] | undefined;
  secondStoryWallHeightFt: number | undefined;
  /** Cycles one panel's type — same story-aware handler Building3DView's own
   * Edit tool also uses. Unlike FootprintCanvas/Building3DView, this view
   * has no separate "tool" state to gate clicking behind — there's nothing
   * else a click here could mean, so every rendered panel is always
   * clickable.
   *
   * `zoneIndex`: which of this slot's own independently-typed vertical
   * zones (see PanelSlotZone) was clicked — 0 = bottom-most, matching
   * `PanelSlot.zones`' own ordering. Undefined for a slot with no real
   * zone-of-its-own to target (not yet split, or a beam-affected slot,
   * which still shares one type across every band in Stride 1 — see
   * bandsAndZonesPerSlot's own doc comment). */
  onToggleOpening: (story: "ground" | "second", wallId: string, slotIndex: number, zoneIndex?: number) => void;
  /** A wall column taller than this auto-splits into stacked, independently
   * editable zones (page.tsx's own `maxPanelHeightIn`) — only applied to a
   * slot with NO covering Mid-Wall Bond Beam, same restriction
   * allPanelInstances' own maxPanelHeightIn param already has (Stride 1;
   * unifying with beam-affected slots is a later, separately-scoped pass). */
  maxPanelHeightIn: number;
  hasGableEnd: boolean;
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
  /** Shows/activates the draggable max-height line below (Tommy: "a button
   * that you highlight and then you can drag the line down on the
   * editor") — toggled by a button in page.tsx's own sidebar; this
   * component owns only the drag interaction itself. */
  isAdjustingMaxGablePanelHeight: boolean;
  /** Global (Tommy: "applies to all gable panels as its adjusted") — same
   * setter the Roof tab's own plain number input already uses. */
  onChangeMaxGablePanelHeightIn: (heightIn: number) => void;
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
  onChangeGableProfilePositionIn: (pointIndex: number, positionIn: number | undefined) => void;
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
  /** This wall's own Box Beam coverage range, if any (Tommy: "options for
   * being a ring all the way around or just one section of the wall...
   * dragged shorter and snap to the edge of each panel, allowing the
   * previous panel to grow back up to the roofline height") — undefined
   * means this wall uses a Truss Plate along its own full length. Slot-
   * index based (not raw inches) — see BoxBeamCoverage's own doc comment.
   * Only shown/meaningful once a second story exists. */
  boxBeamCoverage: BoxBeamCoverage | undefined;
  /** Drag-driven range adjustment — snapping to slot boundaries is handled
   * entirely by this component (it already has the real slot widths); the
   * caller just stores whatever range it's given (or clears it, via
   * `null`, if a drag would leave an empty/inverted range). */
  onChangeBoxBeamCoverage: (coverage: BoxBeamCoverage | null) => void;
  /** Which box-beam size/material every selected wall uses, project-wide
   * (page.tsx's `boxBeamSizeId`) — used to compute how much shorter this
   * wall's own covered slots are built (see computeBoxBeamHeightDeltaIn). */
  boxBeamSizeId: BoxBeamSizeId;
  /** This wall's own Mid-Wall Bond Beams — empty means this row renders
   * as one flat full-height run, same as before this feature existed.
   * Unlike boxBeamCoverage (second-story-only), a bond beam can exist on
   * EITHER story, so ground and second are separate props rather than one
   * story-agnostic pair. A wall can have multiple beams stacked at
   * different heights, each with its own independent horizontal coverage
   * range (same BoxBeamCoverage shape the roofline Box Beam already uses)
   * and own size/kind. */
  midWallBeams: MidWallBeam[];
  secondStoryMidWallBeams: MidWallBeam[];
  onChangeMidWallBeamHeight: (story: "ground" | "second", beamId: string, heightIn: number) => void;
  /** Web-braced-lintel-only — a lintel's own real assembly height, directly
   * user-adjustable via its own draggable top edge, unlike a box beam's
   * catalog-picked sizeId. */
  onChangeMidWallBeamLintelHeightIn: (story: "ground" | "second", beamId: string, lintelHeightIn: number) => void;
  onChangeMidWallBeamCoverage: (story: "ground" | "second", beamId: string, coverage: BoxBeamCoverage) => void;
}

/**
 * Per-wall face-on 2D diagram (X = position along the wall, Y = height) —
 * Tommy: "an arrow button for each wall section, where we can see the whole
 * line up still in 2d view." Shows the existing ground-floor run (same
 * slots/colors as the plan view, read-only here — cycle panel types in the
 * Wall tab, not here) and, when this wall's own Gable End is on, a tiled row
 * of Gable End Panels above it rising to the Roof tab's own profile point
 * height(s) — either "peaked" (1 point, a ridge) or "flat-top" (2
 * independently-placed points, Tommy: "a triangle shaped with the top
 * chopped off"). Each point's own along-wall position — "the inside of the
 * truss seat, and the bottom of the peak of the truss outline" (Tommy) —
 * can be dragged directly on the SVG (its own slider/number-input controls
 * live in the sidebar, see page.tsx's elevationControls); dragging one
 * within GABLE_SHED_SNAP_THRESHOLD_IN of its own nearest end snaps that side
 * to a single-slope shed (see computeGableTiledRow). Unless snapped to a
 * shed, a Column Panel is centered under a "peaked" profile's own single
 * point (Tommy: "there is always a column panel centered under the peak —
 * and not there if its a shed roof") — shorter than a standard full-height
 * Column Panel by the roof-catcher-beam's own depth so its top can catch
 * the beam — but only when the roof system is structural-panel; a truss
 * roof needs no center support at all, and a "flat-top" profile has no
 * single peak for the beam/column system to reference at all (Tommy: "if
 * trusses, lets panelize the gable end panels with no center column. If
 * the roof is to be panels, we need a center beam and column panel").
 *
 * This component owns only the diagram itself and its own drag-interaction
 * state — every other control (add/remove beam, toggle gable end, per-point
 * position inputs, help text) lives in page.tsx's sidebar controls, which
 * call the same handler props this component also uses directly (see
 * page.tsx's elevationControls/renderMidWallBeamSection).
 */
export default function WallElevationDiagram({
  wall,
  slots,
  wallHeightFt,
  hasCornerStart,
  hasCornerEnd,
  secondStorySlots,
  secondStoryWallHeightFt,
  onToggleOpening,
  maxPanelHeightIn,
  hasGableEnd,
  roofProfileType,
  roofProfilePointHeightsFt,
  roofBearingAssemblyHeightIn,
  maxGablePanelHeightIn,
  isAdjustingMaxGablePanelHeight,
  onChangeMaxGablePanelHeightIn,
  targetPanelWidthIn,
  thicknessIn,
  jackStudConfig,
  includeNailer,
  roofCatcherBeamOffsetIn,
  roofSystemTypeId,
  gableProfilePositionsIn,
  onChangeGableProfilePositionIn,
  insetIn,
  heelHeightIn,
  boxBeamCoverage,
  onChangeBoxBeamCoverage,
  boxBeamSizeId,
  midWallBeams,
  secondStoryMidWallBeams,
  onChangeMidWallBeamHeight,
  onChangeMidWallBeamLintelHeightIn,
  onChangeMidWallBeamCoverage,
}: WallElevationDiagramProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const [draggingBoxBeamHandle, setDraggingBoxBeamHandle] = useState<"start" | "end" | null>(null);
  const [isDraggingMaxHeight, setIsDraggingMaxHeight] = useState(false);
  type MidWallBeamDragHandle = "height" | "lintel-top" | "coverage-start" | "coverage-end";
  const [midWallBeamDrag, setMidWallBeamDrag] = useState<{
    story: "ground" | "second";
    beamId: string;
    handle: MidWallBeamDragHandle;
  } | null>(null);

  const wallWidthIn = wall.lengthFt * 12;
  // A wall that doesn't own its own corner at an end has its real slots
  // stop thicknessIn short of that end's true corner (see hasCornerStart/
  // hasCornerEnd's own doc comment) — every along-wall position in this
  // component is anchored off these two offsets rather than assuming
  // content always starts flush at this wall's own true x=0.
  const startOffsetIn = hasCornerStart ? 0 : thicknessIn;
  const endOffsetIn = hasCornerEnd ? 0 : thicknessIn;
  const eaveHeightIn = wallHeightFt * 12;
  // The roofline's own base — the top of whichever story is tallest (just
  // the ground floor, or ground+second when a second story exists), PLUS
  // the roof-bearing member's own thickness (0 when no roof system is
  // enabled) — a real truss's own bottom chord bears on TOP of that
  // assembly, not the bare wall-top-plate height. The gable row, points,
  // and snap-zone hints all rise from here.
  const secondStoryHeightIn = secondStoryWallHeightFt ? secondStoryWallHeightFt * 12 : 0;
  const roofBaseHeightIn = eaveHeightIn + secondStoryHeightIn + roofBearingAssemblyHeightIn;
  // A Box Beam-covered slot's own row is built shorter (Tommy: "the roof
  // lines needs to be respected" — the row shrinks, not the shared
  // roofline above; "dragged shorter... allowing the previous panel to
  // grow back up to the roofline height") — secondStoryHeightIn above
  // stays the NOMINAL height for roofBaseHeightIn's own purposes; this is
  // a given slot's own real rendered height, used only where the row
  // itself is drawn. Uncovered slots (or no coverage at all) render at the
  // plain nominal height, same as before Box Beam had per-slot coverage.
  const boxBeamHeightDeltaIn = boxBeamCoverage ? computeBoxBeamHeightDeltaIn(boxBeamSizeId) : 0;
  // Cumulative along-wall offsets (0..N, one more entry than slots —
  // offsetsIn[i] is where slot i starts, offsetsIn[i+1] is where it ends)
  // — the shared source both a row's own rendering AND every drag-to-
  // adjust-coverage handle (Box Beam's, and now each Mid-Wall Bond Beam's
  // own) snaps to, so "the boundary always lands on a real panel edge" is
  // automatic. Seeded at startOffsetIn (not always 0) so a wall missing its
  // own start corner still has every real slot land at its true along-wall
  // position, not flush against this wall's own local x=0.
  const groundOffsetsIn = slots.reduce<number[]>((acc, slot) => [...acc, acc[acc.length - 1]! + slot.widthIn], [startOffsetIn]);
  const secondStoryOffsetsIn = (secondStorySlots ?? []).reduce<number[]>(
    (acc, slot) => [...acc, acc[acc.length - 1]! + slot.widthIn],
    [startOffsetIn],
  );

  // Mid-Wall Bond Beam — each slot can see a DIFFERENT band split now
  // (multiple beams, each with its own horizontal coverage range), so
  // bands are computed per slot, not once for the whole row.
  // computeWallVerticalBandsForSlotWithMaxHeight's own bottom-to-top
  // ordering means the LAST band for a given slot is always the topmost
  // one — the only one a
  // roofline Box Beam's own per-slot height reduction can ever apply
  // within, since that shortening always comes from the very top of the
  // row regardless of how many bond beams also split it lower down.
  //
  // Stride 2: a beam-covered slot and a beam-free max-height-split slot go
  // through the SAME zone-aware banding now — every band (beam-driven or
  // height-driven alike) gets its own real, independently-typed
  // PanelSlotZone (falling back to `effectiveZonesForSlot`'s "standard"
  // padding until something reconciles real zone data into `slot.zones`),
  // instead of a beam-affected slot sharing one type across every band
  // (the "panel above/below a beam changes together" bug this feature
  // exists to fix). Mirrors allPanelInstances' own per-slot banding
  // exactly, so this diagram never disagrees with the named/counted panel
  // list.
  const bandsAndZonesPerSlot = (
    rowSlots: PanelSlot[],
    storyHeightIn: number,
    beams: MidWallBeam[],
  ): { bands: WallVerticalBand[]; zones: PanelSlotZone[] }[] => {
    const geom = beams.length > 0 ? midWallBeamsToGeometry(beams) : [];
    return rowSlots.map((slot, i) => {
      const bands = computeWallVerticalBandsForSlotWithMaxHeight(i, storyHeightIn, geom, maxPanelHeightIn, panelHeightInRange.minIn);
      return { bands, zones: effectiveZonesForSlot(slot, bands.length) };
    });
  };
  const groundBandsAndZones = bandsAndZonesPerSlot(slots, eaveHeightIn, midWallBeams);
  const secondBandsAndZones = secondStorySlots ? bandsAndZonesPerSlot(secondStorySlots, secondStoryHeightIn, secondStoryMidWallBeams) : [];

  const { pointCount, resolvedPointXsIn, pointIsExplicit, pointIsSnapped, isShedRoof } = resolveGableProfilePoints(
    roofProfilePointHeightsFt,
    gableProfilePositionsIn,
    wallWidthIn,
  );

  // heightFt is a RISE above the eave, not an absolute height (see
  // roofProfilePointHeightsFt's own doc comment) — computeGableTiledRow
  // still expects an absolute anchor in the same coordinate space as
  // roofBaseHeightIn, so convert here at the call site, mirroring
  // page.tsx's own gableTilesByWallId resolution exactly.
  const points: RoofProfilePoint[] = roofProfilePointHeightsFt.map((heightFt, i) => ({
    xIn: resolvedPointXsIn[i]!,
    heightIn: roofBaseHeightIn + heightFt * 12,
    isExplicitPosition: pointIsExplicit[i],
  }));
  const maxProfileHeightIn = Math.max(...roofProfilePointHeightsFt.map((h) => roofBaseHeightIn + h * 12), roofBaseHeightIn);

  // Cap each tile's own edges at the real per-panel fabrication ceiling
  // (Tommy: "an ability to put a safety gap inbetween the truss bottom and
  // the gable end top") via the SAME shared capGableTileHeights page.tsx's
  // own gableTilesByWallId already uses, so this preview can never disagree
  // with the real fabrication data (a 3rd independent re-derivation of this
  // math used to exist here, which could — and did — drift). Any real rise
  // above the cap becomes a verticalGapIn filler (rendered separately
  // below) instead of being built into (or silently clipped from) the
  // Gable End Panel itself — every tile ends up either fully true-sloped or
  // fully flat, never a mixed quadrilateral.
  const capHeightIn = roofBaseHeightIn + maxGablePanelHeightIn;
  const rawGablePanels = hasGableEnd
    ? computeGableTiledRow(wallWidthIn, roofBaseHeightIn, points, targetPanelWidthIn, insetIn, true, heelHeightIn)
    : [];
  const gablePanels: (GableTiledPanel & { verticalGapIn?: { leftIn: number; rightIn: number } })[] = rawGablePanels.map((p) => {
    const capped = capGableTileHeights(p.leftHeightIn, p.rightHeightIn, capHeightIn);
    return { ...p, leftHeightIn: capped.leftEdgeHeightIn, rightHeightIn: capped.rightEdgeHeightIn, verticalGapIn: capped.verticalGapIn };
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

  // Max-height line drag (Tommy: "a button that you highlight and then you
  // can drag the line down on the editor... it snaps to the height of each
  // panel's shortest height when that panel is horizontal") — same
  // cursor-Y-to-inches shape as the Mid-Wall Bond Beam height drag below,
  // but ALWAYS snapped (not just clamped) to the nearest of this wall's own
  // real tiles' own "shortest true edge" — the height at which that
  // specific tile would become perfectly flat (see capGableTileHeights).
  // Deliberately discrete, not continuous: free-form intermediate values
  // would just recreate the mixed-angle problem this whole feature exists
  // to avoid picking. Reads from rawGablePanels (the pre-cap tiles), not
  // gablePanels, since candidates must reflect the wall's own true
  // roofline, independent of whatever cap is currently being dragged.
  useEffect(() => {
    if (!isDraggingMaxHeight) return;
    const candidatesIn = rawGablePanels.map((t) => Math.min(t.leftHeightIn, t.rightHeightIn) - roofBaseHeightIn);
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.height === 0) return;
      const pxPerScreenPx = svgHeightPx / rect.height;
      const localPy = (e.clientY - rect.top) * pxPerScreenPx;
      const rawHeightIn = (svgHeightPx - BOTTOM_MARGIN_PX - localPy) / PX_PER_IN - roofBaseHeightIn;
      if (candidatesIn.length === 0) return;
      let nearestIn = candidatesIn[0]!;
      let nearestDistIn = Math.abs(nearestIn - rawHeightIn);
      for (const candidateIn of candidatesIn) {
        const distIn = Math.abs(candidateIn - rawHeightIn);
        if (distIn < nearestDistIn) {
          nearestDistIn = distIn;
          nearestIn = candidateIn;
        }
      }
      onChangeMaxGablePanelHeightIn(Math.min(Math.max(nearestIn, 12), GABLE_PANEL_MAX_HEIGHT_IN));
    };
    const handleUp = () => setIsDraggingMaxHeight(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingMaxHeight, rawGablePanels, roofBaseHeightIn, svgHeightPx, onChangeMaxGablePanelHeightIn]);

  // Box Beam coverage handle drag — same shape as the gable-point drag
  // above, but snaps to the NEAREST real slot boundary (secondStoryOffsetsIn)
  // instead of a continuous inch value, since a covered range is always a
  // whole number of consecutive slots (Tommy: "dragged shorter and snap to
  // the edge of each panel"). Clamps so the range never crosses itself
  // (always at least 1 slot covered) — dragging past that just holds at the
  // boundary; the plain checkbox is how you turn Box Beam off entirely.
  useEffect(() => {
    if (!draggingBoxBeamHandle || !boxBeamCoverage) return;
    const handle = draggingBoxBeamHandle;
    const coverage = boxBeamCoverage;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const pxPerScreenPx = svgWidthPx / rect.width;
      const localPx = (e.clientX - rect.left) * pxPerScreenPx;
      const posIn = Math.min(Math.max((localPx - LEFT_MARGIN_PX) / scaleX, 0), wallWidthIn);
      let nearestIndex = 0;
      let nearestDistIn = Infinity;
      secondStoryOffsetsIn.forEach((offsetIn, i) => {
        const distIn = Math.abs(offsetIn - posIn);
        if (distIn < nearestDistIn) {
          nearestDistIn = distIn;
          nearestIndex = i;
        }
      });
      if (handle === "start") {
        const startSlotIndex = Math.max(0, Math.min(nearestIndex, coverage.endSlotIndex - 1));
        if (startSlotIndex !== coverage.startSlotIndex) onChangeBoxBeamCoverage({ startSlotIndex, endSlotIndex: coverage.endSlotIndex });
      } else {
        const endSlotIndex = Math.min(secondStoryOffsetsIn.length - 1, Math.max(nearestIndex, coverage.startSlotIndex + 1));
        if (endSlotIndex !== coverage.endSlotIndex) onChangeBoxBeamCoverage({ startSlotIndex: coverage.startSlotIndex, endSlotIndex });
      }
    };
    const handleUp = () => setDraggingBoxBeamHandle(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingBoxBeamHandle, boxBeamCoverage, svgWidthPx, scaleX, wallWidthIn, secondStoryOffsetsIn, onChangeBoxBeamCoverage]);

  // Mid-Wall Bond Beam vertical (height) drag — continuous/unsnapped (a
  // real height, not a slot index), mirroring the gable-point drag's own
  // shape above but inverting yPx (Y-axis) instead of xPx (X-axis).
  // Clamped into that story's own floor-relative [0, storyHeightIn] range.
  // Two independent snaps can fire, in order:
  // 1. (Stride 3b) If this beam covers a "window" slot, dragging its own
  //    bottom edge within MID_WALL_BEAM_HEADER_SNAP_THRESHOLD_IN of that
  //    window's own RO-top (= its header's own bottom) snaps flush with it
  //    — Tommy: "box beams, when their bottom is 3 inches from a door or
  //    window header's bottom, should snap to that." No separate "push the
  //    header" step needed afterward: that window's own band already stops
  //    exactly at this beam's own bottom (computeWallVerticalBandsForSlot),
  //    so its header (computeOpeningGeometry, sized against that band's own
  //    height) already shrinks to fit within it, automatically.
  // 2. (Stride 3a) Once the beam's own TOP is within
  //    MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN of the ceiling, it snaps
  //    flush with THAT instead (Tommy: "when a li[n]tel panel is 6" or
  //    closer to the roof line, lets snap it into place as the tallest
  //    panel that fills that space") — generalized from lintel-only to
  //    box-beam too. A lintel's own height GROWS to close the gap (bottom
  //    edge unmoved, since its own assembly height is independently user-
  //    adjustable); a box-beam has no such concept (its depth is fixed by
  //    sizeId), so it instead snaps `heightIn` itself — the whole beam
  //    slides up flush with the ceiling.
  useEffect(() => {
    if (!midWallBeamDrag || midWallBeamDrag.handle !== "height") return;
    const { story, beamId } = midWallBeamDrag;
    const beams = story === "ground" ? midWallBeams : secondStoryMidWallBeams;
    const beam = beams.find((b) => b.id === beamId);
    if (!beam) return;
    const rowSlots = story === "ground" ? slots : (secondStorySlots ?? []);
    const storyFloorAbsIn = story === "ground" ? 0 : eaveHeightIn;
    const storyHeightIn = story === "ground" ? eaveHeightIn : secondStoryHeightIn;
    const assemblyHeightIn = resolveMidWallBeamAssemblyHeightIn(beam);
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.height === 0) return;
      const pxPerScreenPx = svgHeightPx / rect.height;
      const localPy = (e.clientY - rect.top) * pxPerScreenPx;
      const absHeightIn = (svgHeightPx - BOTTOM_MARGIN_PX - localPy) / PX_PER_IN;
      let heightIn = Math.min(Math.max(absHeightIn - storyFloorAbsIn, 0), storyHeightIn);
      for (let i = beam.startSlotIndex; i < beam.endSlotIndex && i < rowSlots.length; i++) {
        const slot = rowSlots[i];
        if (!slot || slot.type !== "window") continue;
        const roTopZIn = (slot.sillHeightIn ?? sillDefaultHeightIn.value) + (slot.heightIn ?? standardWindowHeightDefaultIn.value);
        if (Math.abs(heightIn - roTopZIn) <= MID_WALL_BEAM_HEADER_SNAP_THRESHOLD_IN) {
          heightIn = roTopZIn;
          break;
        }
      }
      onChangeMidWallBeamHeight(story, beamId, heightIn);
      const gapIn = storyHeightIn - (heightIn + assemblyHeightIn);
      if (gapIn >= 0 && gapIn <= MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN) {
        if (beam.kind === "web-braced-lintel") {
          onChangeMidWallBeamLintelHeightIn(story, beamId, storyHeightIn - heightIn);
        } else {
          onChangeMidWallBeamHeight(story, beamId, storyHeightIn - assemblyHeightIn);
        }
      }
    };
    const handleUp = () => setMidWallBeamDrag(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    midWallBeamDrag,
    midWallBeams,
    secondStoryMidWallBeams,
    slots,
    secondStorySlots,
    svgHeightPx,
    eaveHeightIn,
    secondStoryHeightIn,
    onChangeMidWallBeamHeight,
    onChangeMidWallBeamLintelHeightIn,
  ]);

  // Web-braced-lintel-only: vertical drag of the lintel's own TOP edge —
  // same continuous/unsnapped shape as the height drag above, but adjusts
  // lintelHeightIn (holding the bottom edge fixed) instead. Snaps flush
  // with the ceiling under the same MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN
  // rule. Box-beam has no independent top-edge handle of its own (its depth
  // is fixed by sizeId) — its own ceiling snap lives entirely in the height
  // drag effect above.
  useEffect(() => {
    if (!midWallBeamDrag || midWallBeamDrag.handle !== "lintel-top") return;
    const { story, beamId } = midWallBeamDrag;
    const beams = story === "ground" ? midWallBeams : secondStoryMidWallBeams;
    const beam = beams.find((b) => b.id === beamId);
    if (!beam || beam.kind !== "web-braced-lintel") return;
    const storyFloorAbsIn = story === "ground" ? 0 : eaveHeightIn;
    const storyHeightIn = story === "ground" ? eaveHeightIn : secondStoryHeightIn;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.height === 0) return;
      const pxPerScreenPx = svgHeightPx / rect.height;
      const localPy = (e.clientY - rect.top) * pxPerScreenPx;
      const absTopIn = (svgHeightPx - BOTTOM_MARGIN_PX - localPy) / PX_PER_IN;
      const rawTopIn = Math.min(Math.max(absTopIn - storyFloorAbsIn, beam.heightIn + LINTEL_MIN_HEIGHT_IN), storyHeightIn);
      const topIn = storyHeightIn - rawTopIn <= MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN ? storyHeightIn : rawTopIn;
      onChangeMidWallBeamLintelHeightIn(story, beamId, topIn - beam.heightIn);
    };
    const handleUp = () => setMidWallBeamDrag(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [midWallBeamDrag, midWallBeams, secondStoryMidWallBeams, svgHeightPx, eaveHeightIn, secondStoryHeightIn, onChangeMidWallBeamLintelHeightIn]);

  // Mid-Wall Bond Beam horizontal coverage drag — same shape as the Box
  // Beam coverage-handle drag above, snapping to the nearest real slot
  // boundary, just resolved against whichever beam/story is being dragged.
  useEffect(() => {
    if (!midWallBeamDrag || (midWallBeamDrag.handle !== "coverage-start" && midWallBeamDrag.handle !== "coverage-end")) return;
    const { story, beamId, handle } = midWallBeamDrag;
    const beams = story === "ground" ? midWallBeams : secondStoryMidWallBeams;
    const beam = beams.find((b) => b.id === beamId);
    if (!beam) return;
    const offsetsIn = story === "ground" ? groundOffsetsIn : secondStoryOffsetsIn;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const pxPerScreenPx = svgWidthPx / rect.width;
      const localPx = (e.clientX - rect.left) * pxPerScreenPx;
      const posIn = Math.min(Math.max((localPx - LEFT_MARGIN_PX) / scaleX, 0), wallWidthIn);
      let nearestIndex = 0;
      let nearestDistIn = Infinity;
      offsetsIn.forEach((offsetIn, i) => {
        const distIn = Math.abs(offsetIn - posIn);
        if (distIn < nearestDistIn) {
          nearestDistIn = distIn;
          nearestIndex = i;
        }
      });
      if (handle === "coverage-start") {
        const startSlotIndex = Math.max(0, Math.min(nearestIndex, beam.endSlotIndex - 1));
        if (startSlotIndex !== beam.startSlotIndex) {
          onChangeMidWallBeamCoverage(story, beamId, { startSlotIndex, endSlotIndex: beam.endSlotIndex });
        }
      } else {
        const endSlotIndex = Math.min(offsetsIn.length - 1, Math.max(nearestIndex, beam.startSlotIndex + 1));
        if (endSlotIndex !== beam.endSlotIndex) {
          onChangeMidWallBeamCoverage(story, beamId, { startSlotIndex: beam.startSlotIndex, endSlotIndex });
        }
      }
    };
    const handleUp = () => setMidWallBeamDrag(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    midWallBeamDrag,
    midWallBeams,
    secondStoryMidWallBeams,
    groundOffsetsIn,
    secondStoryOffsetsIn,
    svgWidthPx,
    scaleX,
    wallWidthIn,
    onChangeMidWallBeamCoverage,
  ]);

  // A wall's own `slots` don't always cover its full geometric length —
  // for a plain rectangle, corner panels are only stored on one pair of
  // opposite walls (drawn once per building corner, attributed to whichever
  // wall "owns" it, per the tiling convention), so a row's slots can
  // legitimately stop short of `wallWidthIn` at one or both ends. Each
  // row's own top-plate line runs from startOffsetIn (not always 0 — see
  // its own doc comment) to startOffsetIn + this raw run width, reflecting
  // exactly what's actually drawn in that row.
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
  // for a given wall is independently clickable/editable"). `bandsAndZonesForRow`
  // is index-matched to `rowSlots` — different slots of the SAME row can
  // see different band counts now (each Mid-Wall Bond Beam has its own
  // horizontal coverage, and a beam-free slot can independently auto-split
  // by max panel height), so the outer loop is band-index, not slot; a
  // slot with no band at a given index simply isn't drawn there. Each
  // band's own rendered type/height/sill/braced-style comes from its own
  // real `PanelSlotZone`, not the slot's shared top-level fields — this is
  // what makes the panel above vs. below a beam (or a max-height split)
  // independently editable. `rowFloorHeightIn` is this row's own STORY
  // floor only (0 for ground, the ground's own height for a second story)
  // — each slot's own band supplies its own `bottomIn` on top of that.
  const renderRow = (
    rowSlots: PanelSlot[],
    bandsAndZonesForRow: { bands: WallVerticalBand[]; zones: PanelSlotZone[] }[],
    rowFloorHeightIn: number,
    story: "ground" | "second",
    heightOverrideForSlotBand?: (slotIndex: number, band: WallVerticalBand, isTopmostForSlot: boolean) => number,
  ) => {
    const rects = rowSlots.reduce<{ slot: PanelSlot; i: number; x0: number; x1: number }[]>((acc, slot, i) => {
      const x0 = acc.length > 0 ? acc[acc.length - 1]!.x1 : startOffsetIn;
      acc.push({ slot, i, x0, x1: x0 + slot.widthIn });
      return acc;
    }, []);
    const maxBandCount = Math.max(0, ...bandsAndZonesForRow.map((b) => b.bands.length));
    const elements: ReactNode[] = [];
    for (let bandIndex = 0; bandIndex < maxBandCount; bandIndex++) {
      for (const { slot, i, x0, x1 } of rects) {
        const entry = bandsAndZonesForRow[i];
        const band = entry?.bands[bandIndex];
        if (!band || !entry) continue;
        const zone = entry.zones[bandIndex] ?? zoneFromSlot(slot);
        // Every band now targets its own real zone by index (Stride 2 —
        // beam-driven and height-driven bands are the same zone-aware
        // system; see bandsAndZonesPerSlot's own doc comment). zoneIndex 0
        // on a single-band (unsplit) slot behaves identically to omitting
        // it — handleToggleOpening treats both as "the slot's own bottom/
        // only zone."
        const zoneIndexForClick = bandIndex;
        const isTopmostForSlot = bandIndex === entry.bands.length - 1;
        const rowWallHeightIn = heightOverrideForSlotBand?.(i, band, isTopmostForSlot) ?? band.topIn - band.bottomIn;
        const localYPx = (localHeightIn: number) => yPx(rowFloorHeightIn + band.bottomIn + localHeightIn);
        if (zone.type === "window") {
          const g = computeOpeningGeometry(
            false,
            slot.widthIn,
            rowWallHeightIn,
            zone.sillHeightIn ?? sillDefaultHeightIn.value,
            zone.heightIn ?? standardWindowHeightDefaultIn.value,
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
          // Header/sill render as flat colored boxes (Tommy: "change the 2d
          // rendering of headers and sills to be 2d versions of their 3d
          // counterparts: just boxes that are green and orange") — the same
          // colors NAMED_PANEL_TYPE_COLORS already uses for them in the 3D
          // simplified box view. Jack studs keep their real per-member
          // MemberElevationShapes rendering (unaffected — filtered out of
          // `members` here since header/sill no longer go through it).
          const jackStudMembers = members.filter((m) => m.role === "jack_stud");
          const localXToPx = (xIn: number) => xPx(x0 + xIn);
          // The actual glazed opening — open, not filled by any member,
          // matching the 3D view, inset between the two jack studs.
          const roGapXPx = localXToPx(g.jackThicknessIn);
          const roGapWidthPx = localXToPx(slot.widthIn - g.jackThicknessIn) - roGapXPx;
          const roGapTopPx = localYPx(g.roTopZIn);
          const roGapHeightPx = localYPx(g.sillHeightIn) - roGapTopPx;
          // Each sill tile sits side by side, inset from the slot's own
          // edges by one jack stud's thickness (same run computeSillRunWidths
          // itself tiles), left to right.
          const sillOffsetsIn = g.sillWidthsIn.reduce<number[]>(
            (acc, w) => [...acc, acc[acc.length - 1]! + w],
            [g.jackThicknessIn],
          );
          elements.push(
            <g
              key={`${story}-${bandIndex}-${i}`}
              onClick={() => onToggleOpening(story, wall.id, i, zoneIndexForClick)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={xPx(x0)}
                y={localYPx(rowWallHeightIn)}
                width={(x1 - x0) * scaleX}
                height={Math.max(0, localYPx(g.roTopZIn) - localYPx(rowWallHeightIn))}
                fill={NAMED_PANEL_TYPE_COLORS.header}
                stroke="#8a6a3a"
                strokeWidth={1}
              />
              {g.sillWidthsIn.map((sillWidthIn, sillIdx) => (
                <rect
                  key={sillIdx}
                  x={localXToPx(sillOffsetsIn[sillIdx]!)}
                  y={localYPx(g.sillHeightIn)}
                  width={localXToPx(sillOffsetsIn[sillIdx]! + sillWidthIn) - localXToPx(sillOffsetsIn[sillIdx]!)}
                  height={Math.max(0, localYPx(0) - localYPx(g.sillHeightIn))}
                  fill={NAMED_PANEL_TYPE_COLORS.sill}
                  stroke="#3a6a4a"
                  strokeWidth={1}
                />
              ))}
              <MemberElevationShapes members={jackStudMembers} xToPx={localXToPx} zToPx={localYPx} />
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
            </g>,
          );
        } else {
          elements.push(
            <g
              key={`${story}-${bandIndex}-${i}`}
              onClick={() => onToggleOpening(story, wall.id, i, zoneIndexForClick)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={xPx(x0)}
                y={localYPx(rowWallHeightIn)}
                width={(x1 - x0) * scaleX}
                height={rowWallHeightIn * PX_PER_IN}
                fill={SLOT_COLORS[zone.type]}
                stroke="#666"
                strokeWidth={1}
              />
              <text x={xPx((x0 + x1) / 2)} y={localYPx(rowWallHeightIn / 2)} fontSize={9} textAnchor="middle" fill="#333">
                {slot.widthIn}&quot;
              </text>
            </g>,
          );
        }
      }
    }
    return elements;
  };

  // At an end this wall doesn't own its own corner, the wall physically
  // butts against the shorter neighboring wall's own corner panel instead
  // (see hasCornerStart/hasCornerEnd's own doc comment) — that panel's
  // narrow return face (thicknessIn deep) is what's actually visible here,
  // not a gap. Drawn as a static reference sliver, not a real slot on this
  // wall: no click handler, and not split into this wall's own mid-wall-
  // bond-beam bands (the neighboring wall's own beam layout is independent
  // and isn't looked up here) — always one plain full-height rect per row.
  const renderAdjacentWallFiller = (floorHeightIn: number, ceilingHeightIn: number, story: "ground" | "second") => {
    const heightIn = ceilingHeightIn - floorHeightIn;
    if (heightIn <= 0) return null;
    const sliver = (xStartIn: number, key: string) => (
      <g key={key}>
        <rect
          x={xPx(xStartIn)}
          y={yPx(ceilingHeightIn)}
          width={thicknessIn * scaleX}
          height={heightIn * PX_PER_IN}
          fill={SLOT_COLORS.corner}
          fillOpacity={0.35}
          stroke="#666"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
        <text
          x={xPx(xStartIn + thicknessIn / 2)}
          y={yPx((floorHeightIn + ceilingHeightIn) / 2)}
          fontSize={7}
          textAnchor="middle"
          fill="#555"
          transform={`rotate(-90 ${xPx(xStartIn + thicknessIn / 2)} ${yPx((floorHeightIn + ceilingHeightIn) / 2)})`}
        >
          adjacent wall
        </text>
      </g>
    );
    return (
      <>
        {!hasCornerStart && sliver(0, `${story}-adjacent-start`)}
        {!hasCornerEnd && sliver(wallWidthIn - thicknessIn, `${story}-adjacent-end`)}
      </>
    );
  };

  return (
    <div>
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
        <line x1={xPx(startOffsetIn)} y1={yPx(eaveHeightIn)} x2={xPx(startOffsetIn + groundRunWidthIn)} y2={yPx(eaveHeightIn)} stroke="#999" strokeDasharray="4 3" />
        <text x={4} y={yPx(eaveHeightIn) + 4} fontSize={10} fill="#666">
          {eaveHeightIn}&quot;
        </text>
        {renderRow(slots, groundBandsAndZones, 0, "ground")}
        {renderAdjacentWallFiller(0, eaveHeightIn, "ground")}

        {/* Mid-Wall Bond Beams (ground floor) — one filled rect per beam
            at its own real position/coverage/thickness, each with its own
            height-drag handle (vertical, continuous — not slot-snapped,
            since this is a real height, not a horizontal panel boundary)
            and 2 coverage-drag handles (horizontal, snap-to-slot, same
            pattern as the Box Beam handles below). */}
        {midWallBeams.map((beam) => {
          const isLintel = beam.kind === "web-braced-lintel";
          const assemblyHeightIn = resolveMidWallBeamAssemblyHeightIn(beam);
          const fillColor = isLintel ? "#9fb8e0" : "#c9a26f";
          const strokeColor = isLintel ? "#3a5a8a" : "#7a5a2e";
          const startXIn = groundOffsetsIn[beam.startSlotIndex] ?? startOffsetIn;
          const endXIn = groundOffsetsIn[beam.endSlotIndex] ?? startOffsetIn + groundRunWidthIn;
          const midYIn = beam.heightIn + assemblyHeightIn / 2;
          return (
            <g key={beam.id}>
              <rect
                x={xPx(startXIn)}
                y={yPx(beam.heightIn + assemblyHeightIn)}
                width={(endXIn - startXIn) * scaleX}
                height={assemblyHeightIn * PX_PER_IN}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={1}
              />
              <text x={xPx(startXIn) + 4} y={yPx(beam.heightIn) + 4} fontSize={9} fill={strokeColor}>
                {beam.heightIn.toFixed(1)}&quot; {isLintel ? "lintel" : "bond beam"}
              </text>
              <g
                style={{ cursor: "ns-resize" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setMidWallBeamDrag({ story: "ground", beamId: beam.id, handle: "height" });
                }}
              >
                <line
                  x1={xPx(startXIn)}
                  y1={yPx(midYIn)}
                  x2={xPx(endXIn)}
                  y2={yPx(midYIn)}
                  stroke={strokeColor}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <circle cx={xPx((startXIn + endXIn) / 2)} cy={yPx(midYIn)} r={7} fill={strokeColor} stroke="#fff" strokeWidth={1.5} />
              </g>
              {isLintel && (
                <g
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMidWallBeamDrag({ story: "ground", beamId: beam.id, handle: "lintel-top" });
                  }}
                >
                  <circle cx={xPx((startXIn + endXIn) / 2)} cy={yPx(beam.heightIn + assemblyHeightIn)} r={5} fill="#2c5c8a" stroke="#fff" strokeWidth={1.5} />
                </g>
              )}
              {(["coverage-start", "coverage-end"] as const).map((handle) => {
                const hxIn = handle === "coverage-start" ? startXIn : endXIn;
                return (
                  <g
                    key={handle}
                    style={{ cursor: "ew-resize" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMidWallBeamDrag({ story: "ground", beamId: beam.id, handle });
                    }}
                  >
                    <circle cx={xPx(hxIn)} cy={yPx(midYIn)} r={5} fill="#2c7a4b" stroke="#fff" strokeWidth={1.5} />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Second-story row + its own top-plate line(s) (Tommy: "each
            story's row for a given wall is independently clickable/
            editable") — only rendered once a second story exists. One
            reference line PER real roof-bearing segment (see
            computeRoofBearingSegments) so a partially Box-Beam-covered row
            visibly steps up/down exactly at the covered boundary, instead
            of one flat (and, for a partial selection, wrong) line. */}
        {secondStorySlots && (
          <>
            {computeRoofBearingSegments(secondStorySlots, boxBeamCoverage).map((seg, i) => {
              const segHeightIn = seg.kind === "box-beam" ? secondStoryHeightIn - boxBeamHeightDeltaIn : secondStoryHeightIn;
              // seg.startXIn is relative to this wall's own first slot (see
              // computeRoofBearingSegments's own doc comment) — offset by
              // startOffsetIn to land at this wall's true along-wall
              // position, same as every other along-wall value here.
              return (
                <line
                  key={`second-top-${i}`}
                  x1={xPx(startOffsetIn + seg.startXIn)}
                  y1={yPx(eaveHeightIn + segHeightIn)}
                  x2={xPx(startOffsetIn + seg.startXIn + seg.lengthIn)}
                  y2={yPx(eaveHeightIn + segHeightIn)}
                  stroke="#999"
                  strokeDasharray="4 3"
                />
              );
            })}
            <text x={4} y={yPx(eaveHeightIn + secondStoryHeightIn) + 4} fontSize={10} fill="#666">
              {eaveHeightIn + secondStoryHeightIn}&quot;
              {boxBeamCoverage ? ` (Box Beam sections ${boxBeamHeightDeltaIn.toFixed(2)}in shorter)` : ""}
            </text>
            {renderRow(secondStorySlots, secondBandsAndZones, eaveHeightIn, "second", (slotIndex, band, isTopmostForSlot) => {
              const bandHeightIn = band.topIn - band.bottomIn;
              return isTopmostForSlot && isSlotBoxBeamCovered(slotIndex, boxBeamCoverage)
                ? bandHeightIn - boxBeamHeightDeltaIn
                : bandHeightIn;
            })}
            {renderAdjacentWallFiller(eaveHeightIn, eaveHeightIn + secondStoryHeightIn, "second")}

            {/* Mid-Wall Bond Beams (second story) — same shape as the
                ground-floor ones above, offset by eaveHeightIn (absolute). */}
            {secondStoryMidWallBeams.map((beam) => {
              const isLintel = beam.kind === "web-braced-lintel";
              const assemblyHeightIn = resolveMidWallBeamAssemblyHeightIn(beam);
              const fillColor = isLintel ? "#9fb8e0" : "#c9a26f";
              const strokeColor = isLintel ? "#3a5a8a" : "#7a5a2e";
              const startXIn = secondStoryOffsetsIn[beam.startSlotIndex] ?? startOffsetIn;
              const endXIn = secondStoryOffsetsIn[beam.endSlotIndex] ?? startOffsetIn + secondStoryRunWidthIn;
              const midYIn = eaveHeightIn + beam.heightIn + assemblyHeightIn / 2;
              return (
                <g key={beam.id}>
                  <rect
                    x={xPx(startXIn)}
                    y={yPx(eaveHeightIn + beam.heightIn + assemblyHeightIn)}
                    width={(endXIn - startXIn) * scaleX}
                    height={assemblyHeightIn * PX_PER_IN}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={1}
                  />
                  <text x={xPx(startXIn) + 4} y={yPx(eaveHeightIn + beam.heightIn) + 4} fontSize={9} fill={strokeColor}>
                    {beam.heightIn.toFixed(1)}&quot; {isLintel ? "lintel" : "bond beam"}
                  </text>
                  <g
                    style={{ cursor: "ns-resize" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMidWallBeamDrag({ story: "second", beamId: beam.id, handle: "height" });
                    }}
                  >
                    <line
                      x1={xPx(startXIn)}
                      y1={yPx(midYIn)}
                      x2={xPx(endXIn)}
                      y2={yPx(midYIn)}
                      stroke={strokeColor}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <circle cx={xPx((startXIn + endXIn) / 2)} cy={yPx(midYIn)} r={7} fill={strokeColor} stroke="#fff" strokeWidth={1.5} />
                  </g>
                  {isLintel && (
                    <g
                      style={{ cursor: "ns-resize" }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setMidWallBeamDrag({ story: "second", beamId: beam.id, handle: "lintel-top" });
                      }}
                    >
                      <circle
                        cx={xPx((startXIn + endXIn) / 2)}
                        cy={yPx(eaveHeightIn + beam.heightIn + assemblyHeightIn)}
                        r={5}
                        fill="#2c5c8a"
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                    </g>
                  )}
                  {(["coverage-start", "coverage-end"] as const).map((handle) => {
                    const hxIn = handle === "coverage-start" ? startXIn : endXIn;
                    return (
                      <g
                        key={handle}
                        style={{ cursor: "ew-resize" }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setMidWallBeamDrag({ story: "second", beamId: beam.id, handle });
                        }}
                      >
                        <circle cx={xPx(hxIn)} cy={yPx(midYIn)} r={5} fill="#2c7a4b" stroke="#fff" strokeWidth={1.5} />
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Box Beam coverage drag handles — one at each end of the
                covered range, snapping to the nearest real slot boundary
                (secondStoryOffsetsIn) as dragged. Only shown once Box Beam
                coverage exists (the sidebar checkbox controls whether it
                exists at all). */}
            {boxBeamCoverage &&
              (["start", "end"] as const).map((handle) => {
                const slotIndex = handle === "start" ? boxBeamCoverage.startSlotIndex : boxBeamCoverage.endSlotIndex;
                const handleXIn = secondStoryOffsetsIn[slotIndex] ?? (handle === "start" ? startOffsetIn : startOffsetIn + secondStoryRunWidthIn);
                const handleYIn = eaveHeightIn + secondStoryHeightIn - boxBeamHeightDeltaIn;
                return (
                  <g
                    key={handle}
                    style={{ cursor: "ew-resize" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDraggingBoxBeamHandle(handle);
                    }}
                  >
                    <line
                      x1={xPx(handleXIn)}
                      y1={yPx(eaveHeightIn)}
                      x2={xPx(handleXIn)}
                      y2={yPx(handleYIn)}
                      stroke="#2c7a4b"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <circle cx={xPx(handleXIn)} cy={yPx(handleYIn)} r={7} fill="#2c7a4b" stroke="#fff" strokeWidth={1.5} />
                  </g>
                );
              })}
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

        {/* Per-side pitch summary — one label centered above each side's
            own full run (left of the peak, right of it), showing the
            real resulting slope as a plain degree figure, or the matching
            "X/12" fraction once it happens to land exactly on one of the
            Shed/Centered Peak dropdowns' own selectable pitches — additive
            alongside the per-tile rip callouts above (Tommy: keep both).
            Only meaningful for a real single peak (a flat-top profile has
            no one peak for "each side" to mean anything). Run/rise for
            each side is read off the OUTERMOST real tile's own anchor
            (gablePanels' first/last entry), not re-derived from the raw
            eave height — an energy-heel truss seat (heelHeightIn) excludes
            a real flat zone from each unclaimed corner (see
            computeGableTiledRow's own doc comment), so the true sloped run
            is shorter than the wall's own raw half-width; reading it off
            the already-correct tile anchors guarantees this can never
            disagree with the per-tile labels above. Skips a side with no
            real tile at all — the peak sitting exactly on that edge (a
            shed on this side), nothing to summarize there. */}
        {hasGableEnd &&
          roofProfileType === "peaked" &&
          points[0] &&
          gablePanels.length > 0 &&
          (() => {
            const peakXIn = resolvedPointXsIn[0]!;
            const peakHeightIn = points[0]!.heightIn;
            const firstTile = gablePanels[0]!;
            const lastTile = gablePanels[gablePanels.length - 1]!;
            const sides = [
              {
                key: "left",
                runIn: peakXIn - firstTile.xStartIn,
                riseIn: peakHeightIn - firstTile.leftHeightIn,
                midXIn: (firstTile.xStartIn + peakXIn) / 2,
                midHeightIn: (firstTile.leftHeightIn + peakHeightIn) / 2,
              },
              {
                key: "right",
                runIn: lastTile.xEndIn - peakXIn,
                riseIn: peakHeightIn - lastTile.rightHeightIn,
                midXIn: (peakXIn + lastTile.xEndIn) / 2,
                midHeightIn: (peakHeightIn + lastTile.rightHeightIn) / 2,
              },
            ];
            return sides.map((side) => {
              if (side.runIn <= 0) return null;
              const rip = computeGableRipCallout(side.runIn, peakHeightIn - side.riseIn, peakHeightIn);
              const matchedPitch = matchStandardPitchIn12(side.riseIn, side.runIn);
              return (
                <text
                  key={side.key}
                  x={xPx(side.midXIn)}
                  y={yPx(side.midHeightIn) - 10}
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                  fill="#1f3a5f"
                >
                  {matchedPitch ? `${matchedPitch}/12` : `${rip.angleDeg.toFixed(1)}°`}
                </text>
              );
            });
          })()}

        {/* Vertical safety gap (Tommy: "an ability to put a safety gap
            inbetween the truss bottom and the gable end top") — the real
            remainder between a capped (now always FLAT) Gable End Panel's
            own top and the true roofline, filled by a real tile instead of
            clipped. Each edge's own gap is added independently (never a
            single uniform offset) so the top edge lands exactly on the true
            roofline on both sides — the common straddling-the-cap case has
            one edge's own gap at exactly 0, producing a clean triangular
            taper rather than a rectangle that overshoots past the roof on
            the side that needed no filler at all. */}
        {hasGableEnd &&
          gablePanels.map((p, i) => {
            if (!p.verticalGapIn) return null;
            const points4 = [
              [xPx(p.xStartIn), yPx(p.leftHeightIn)],
              [xPx(p.xEndIn), yPx(p.rightHeightIn)],
              [xPx(p.xEndIn), yPx(p.rightHeightIn + p.verticalGapIn.rightIn)],
              [xPx(p.xStartIn), yPx(p.leftHeightIn + p.verticalGapIn.leftIn)],
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

        {/* Draggable max-height line (Tommy: "a button that you highlight
            and then you can drag the line down on the editor") — only
            shown while the sidebar's own toggle button is active (see
            isAdjustingMaxGablePanelHeight's own doc comment); the drag
            itself always snaps to the height that makes some real tile on
            THIS wall flat (see the useEffect above). */}
        {hasGableEnd && isAdjustingMaxGablePanelHeight && (
          <g>
            <line
              x1={xPx(0)}
              y1={yPx(capHeightIn)}
              x2={xPx(wallWidthIn)}
              y2={yPx(capHeightIn)}
              stroke="#2c7a4b"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text x={4} y={yPx(capHeightIn) - 4} fontSize={10} fill="#2c7a4b">
              max {maxGablePanelHeightIn}in
            </text>
            <g
              style={{ cursor: "ns-resize" }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingMaxHeight(true);
              }}
            >
              <circle cx={xPx(wallWidthIn / 2)} cy={yPx(capHeightIn)} r={7} fill="#2c7a4b" stroke="#fff" strokeWidth={1.5} />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
