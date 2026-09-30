"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  computeGableTiledRow,
  computeRoofBearingSegments,
  computeWallVerticalBandsForSlotWithMaxHeight,
  effectiveZonesForSlot,
  insertableBoundaryRange,
  isSlotBoxBeamCovered,
  resolvePanelBoundaryDrag,
  zoneFromSlot,
  type BoxBeamCoverage,
  type GableTiledPanel,
  type GableWindowReservation,
  type PanelSlot,
  type PanelSlotZone,
  type RoofBearingAnchorMode,
  type RoofProfilePoint,
  type Wall,
  type WallVerticalBand,
} from "@building-integrity/geometry";
import {
  buildOpeningAssemblyMembers,
  COLUMN_TOTAL_WIDTH_IN,
  computeBoxBeamHeightDeltaIn,
  computeGableRipCallout,
  fabricationMinPanelWidthIn,
  GABLE_PANEL_MAX_HEIGHT_IN,
  panelHeightInRange,
  sillDefaultHeightIn,
  standardWindowHeightDefaultIn,
  type BoxBeamSizeId,
  type JackStudConfig,
} from "@building-integrity/panel-catalog";
import { computeOpeningGeometry } from "./openingGeometry";
import { formatFeetInches } from "./canvasGeometry";
import { MemberElevationShapes } from "./MemberElevationShapes";
import { NAMED_PANEL_TYPE_COLORS } from "./panelColors";
import { combinedPanelLabel, type PanelInstance } from "./panelInstances";
import { capGableTileHeights, GABLE_SHED_SNAP_THRESHOLD_IN, matchStandardPitchIn12, resolveGableProfilePoints } from "./gableProfilePoints";
import {
  BIG_HEADER_BEAM_MIN_HEIGHT_IN,
  MID_WALL_BEAM_HEADER_SNAP_THRESHOLD_IN,
  MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN,
  midWallBeamsToGeometry,
  resolveMidWallBeamAssemblyHeightIn,
  type MidWallBeam,
} from "./midWallBeam";
import { resolveSpanningHeaderHeightIn, spanningHeadersToGeometry, wallBandGeometry, type SpanningHeader } from "./spanningHeader";
import {
  ELEVATION_LEFT_MARGIN_PX,
  ELEVATION_PX_PER_IN,
  elevationSvgWidthPx,
  fitHeightScale,
  renderedDrawingSizePx,
  steppedViewScale,
  viewScaleForWall,
  wallPosInFromScreenX,
  wheelZoomedViewScale,
  zoomAnchorScrollDelta,
} from "./elevationViewport";

// The drawing's own internal unit and margins live in `elevationViewport.ts`
// with the fit/zoom maths and its tests — see that file's header for why the
// 720px `CANVAS_WIDTH` cap that used to sit here is gone and why the scale is
// now uniform on both axes.
//
// ⚠ FIVE other drawing surfaces still carry a 720px cap and have the same
// underlying problem. An earlier version of this note said "all four
// canvases" and named three of them; the true list, read off the files rather
// than remembered, is:
//   FootprintCanvas.tsx      CANVAS_WIDTH 720 / CANVAS_HEIGHT 480
//   FoundationCanvas.tsx     CANVAS_WIDTH 720 / CANVAS_HEIGHT 480
//   FloorCanvas.tsx          CANVAS_WIDTH 720 / CANVAS_HEIGHT 480
//   RoofTrussLayoutView.tsx  CANVAS_WIDTH 720 (width cap only)
//   Building3DView.tsx       CANVAS_WIDTH 720 / CANVAS_HEIGHT 480
// (BaleFoundationCrossSectionDiagram.tsx caps at 480 and is a representative
// detail rather than a to-scale plan, so it is not one of them.)
// They are deliberately NOT changed here: whether they all move to a fitted,
// scrollable viewport together is Tommy's decision, not a side effect of
// fixing the elevation.
const PX_PER_IN = ELEVATION_PX_PER_IN;
const TOP_MARGIN_PX = 44; // 24 base + ~20 for the "Overall Width" dimension callout
const BOTTOM_MARGIN_PX = 36;
const LEFT_MARGIN_PX = ELEVATION_LEFT_MARGIN_PX;

const SLOT_COLORS: Record<PanelSlot["type"], string> = {
  corner: "#8a8a8a",
  "safety-oct-corner": "#5c4a2e",
  standard: "#d9c9a3",
  braced: "#b06fc9",
  "safety-gap": "#e08a3c",
  window: "#8fc7e8",
  door: "#7a4a2b",
  column: "#4a90a4",
  "big-header": "#e85d9c",
};

// Small line-icon SVGs for the pan/zoom/ID toolbar — matches the Stitch
// mockup's icon style (small outlined glyphs, not emoji) without pulling in
// a new icon-font dependency. FootprintCanvas.tsx keeps its own byte-
// identical copy of these same three pan/zoom icons, same "each file keeps
// its own small copy" convention this file already uses elsewhere.
const ICON_PROPS = { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const PanIcon = () => (
  <svg {...ICON_PROPS}>
    <polyline points="5 9 2 12 5 15" />
    <polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" />
    <polyline points="19 9 22 12 19 15" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </svg>
);
const ZoomOutIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);
const ZoomInIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);
const TagIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.29-7.29a1 1 0 0 0 0-1.41L12 2Z" />
    <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const GABLE_COLOR = "#9fb8e0";
const GABLE_SAFETY_GAP_COLOR = "#e08a3c";
const VERTICAL_GAP_COLOR = "#f0c08a";
// Panel drag-resize (Tommy: "when you click and drag a panel, it moves,
// snapping (when within 2 inches along the drag) to other panels' edges...
// otherwise, it shrinks one panel and adds it to another, snapping to when
// a shrinking panel becomes 2' at which point it snaps there for plus or
// minus 2 inches and then switches spots").
//
// The floor this drag stops at is NOT a local constant any more: the 2' it
// used to hard-code is Building Integrity's real fabrication minimum, now
// `fabricationMinPanelWidthIn` in the catalog (confirmed, Tommy, 2026-09-24),
// and the typed-width field refuses at the same number. One definition, two
// consumers. The ±2in snap window below stays exactly where it is — that one
// is ergonomics, not a building value, and nothing sources it.
const PANEL_DRAG_SNAP_TOLERANCE_IN = 2;
const PANEL_DRAG_HANDLE_HALF_WIDTH_PX = 4;

export interface WallElevationDiagramProps {
  wall: Wall;
  slots: PanelSlot[];
  wallHeightFt: number;
  /** This wall's own real named panel instances (page.tsx's own
   * `allInstances`/`secondStoryAllInstances`, filtered here by wallId) —
   * lets each rendered rect show the same real compass-based ID (e.g.
   * "N3", merged as "N3+4+5" for a window's header+sills) Plan View and
   * the 3D view already show for that exact slot, instead of inventing a
   * second ID scheme just for this view. */
  allInstances: PanelInstance[];
  secondStoryAllInstances: PanelInstance[];
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
  /**
   * How far this wall's run is inset at each end because the NEIGHBOUR's
   * corner panel physically occupies it — 0 when this wall owns the corner
   * itself, `thicknessIn` when it butts.
   *
   * **A number rather than the old `hasCornerStart`/`hasCornerEnd` booleans,
   * and the difference is Stage 3's orphan-corner rule.** "This wall does not
   * own the corner" and "the neighbour's corner panel is really there" used
   * to be the same fact. They are not any more: when the neighbour stops at
   * that corner it never builds the panel, so this wall runs out to its own
   * true end (inset 0) and the "adjacent wall" filler sliver must NOT draw.
   * `> 0` is exactly the right test for both. */
  startInsetIn: number;
  endInsetIn: number;
  /** Stage 3 — inches at each end of this wall that are deliberately NOT
   * built (Tommy: "a stop wall tool so that it is possible to make
   * incomplete walls"). Drawn as a **dashed boundary line, not a hatched
   * wall**: it is where the building ends, not a wall of unknown type. It
   * carries its own dimension, labelled NO PANELS on a printed sheet.
   *
   * Independent of `hasCornerStart`/`hasCornerEnd`, which are about corner
   * OWNERSHIP and stay true: a stop does not change the neighbour, so where
   * the neighbour owns the corner its panel is still there and the
   * "adjacent wall" filler sliver is still drawn — with the unbuilt span
   * between that sliver and this wall's own run. 0/0 = unchanged. */
  startStopIn?: number;
  endStopIn?: number;
  /** Stage 3 — where this wall's BUILT run starts and ends, in inches from
   * its own true start corner, exactly as page.tsx computes it for the
   * model. The gable row is clamped to this.
   *
   * Passed in rather than re-derived from `startStopIn` + the corner inset,
   * because those two are not the same number on a reflex-corner winner
   * (inset 0, extension > 0) and the drawing would then disagree with the
   * model by a wall thickness. Undefined = the whole wall. */
  gableBuiltStartIn?: number;
  gableBuiltEndIn?: number;
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
  /**
   * Select a slot WITHOUT cycling its type — the entry point Smearforn
   * Stage 1's typed width needs, and the gesture Tommy described first:
   * "click the numerical value of width of one panel... so you can type in
   * a new value."
   *
   * **Why it had to exist.** Clicking a panel's BODY runs the type cycle
   * (`onToggleOpening`), and from a standard panel the first stop on that
   * cycle is a window — `handleToggleOpening` then selects the opening it
   * just made, and selects nothing at all when a slot lands back on
   * "standard". So a standard panel could never BE the selected panel, and
   * the width field in the Selected Panel note would have been unreachable
   * for exactly the panels this stage is about. The width LABEL is the one
   * part of a panel with no gesture of its own, and it is the one Tommy
   * pointed at. It selects only; the editing still happens in the note.
   */
  onSelectSlot: (story: "ground" | "second", wallId: string, slotIndex: number, zoneIndex?: number) => void;
  /**
   * Smearforn Stage 2's placement tool, armed from the left bar: "place" = a
   * panel type is picked and a click lands it, "delete" = a click removes
   * the panel it lands on, null = the tool is off and every click does what
   * it has always done.
   *
   * While it is armed, a panel's BODY replaces rather than cycles, and the
   * boundaries between panels become their own click targets (drawn, so the
   * places a panel can go are visible rather than guessed at). The
   * panel-boundary DRAG is suspended for as long as it is armed — the same
   * strip cannot mean two things at once.
   */
  panelToolMode: "place" | "delete" | null;
  /** Replace the panel at `slotIndex` with whatever the tool is set to. */
  onReplacePanel: (story: "ground" | "second", wallId: string, slotIndex: number) => void;
  /** Insert before `boundaryIndex` — the slot index the new panel takes. */
  onInsertPanel: (story: "ground" | "second", wallId: string, boundaryIndex: number) => void;
  onDeletePanel: (story: "ground" | "second", wallId: string, slotIndex: number) => void;
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
  /** This specific wall's own membership in gableStructuralPanelWallIds
   * (Tommy: "panels/beam" mode) — reserves a real, centered structural
   * Column Panel tile in the gable row (see computeGableTiledRow's own
   * columnReservationWidthIn param) with a flat top GABLE_COLUMN_FLAT_TOP_DROP_IN
   * below the peak, instead of open truss framing. Only ever reserved for a
   * genuine single-peak, non-shed roofline — computeGableTiledRow itself
   * silently skips it otherwise (a flat-topped roofline has no single peak
   * to center under). */
  hasStructuralColumnPanel: boolean;
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
  /** Where the roofline slope actually starts lifting off — the project's
   * real roofBearingAnchorMode value. See computeGableTiledRow's own
   * RoofBearingAnchorMode doc comment. */
  roofBearingAnchorMode: RoofBearingAnchorMode;
  /** This wall's own gable window reservations (page.tsx's own
   * gableWindowAnchorsByWallId[wall.id]) — see computeGableTiledRow's own
   * `windowReservations` doc comment. */
  gableWindowReservations: GableWindowReservation[];
  /** Click-to-cycle a gable tile plain <-> window (Tommy: "add an option to
   * click-edit gable end panels to become window gable end panels") —
   * `tileOrdinal` is "how many non-safety-gap gable tiles precede this
   * one," `naturalWidthIn` is the clicked tile's own current width (seeds
   * a brand-new reservation's own default width). */
  onToggleGableWindow: (tileOrdinal: number, naturalWidthIn: number) => void;
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
  /** This wall's own spanning ("triple") headers, per story — Smearforn
   * Stage 2b. Drawn as a real header band across the panels it spans, and
   * fed into the SAME band computation the beams go through, so the panels
   * beneath it are shortened here exactly as they are in the named-instance
   * list and in 3D. Empty means this row renders exactly as it did before
   * the feature existed. */
  spanningHeaders: SpanningHeader[];
  secondStorySpanningHeaders: SpanningHeader[];
  /** Each header's own building-wide name (`H1`), by header id. Resolved by
   * page.tsx through the single global walk, and passed in rather than
   * re-derived here — two independent numberings of one series is how the
   * drawing and the sheet come to disagree. */
  spanningHeaderNameById: Map<string, string>;
  onChangeMidWallBeamHeight: (story: "ground" | "second", beamId: string, heightIn: number) => void;
  /** Big-header-beam-only — this beam's own real assembly height, directly
   * user-adjustable via its own draggable top edge, unlike a box beam's
   * catalog-picked sizeId. */
  onChangeMidWallBeamBigHeaderHeightIn: (story: "ground" | "second", beamId: string, bigHeaderBeamHeightIn: number) => void;
  onChangeMidWallBeamCoverage: (story: "ground" | "second", beamId: string, coverage: BoxBeamCoverage) => void;
  /** Commits a panel drag-resize tick directly (Tommy: "when you click and
   * drag a panel, it moves... shrinks one panel and adds it to another") —
   * a direct two-slot patch (widthIn + lockedWidthIn on both
   * `leftSlotIndex` and `leftSlotIndex + 1`), not a retile — called
   * continuously during the drag, same "patch parent state directly, no
   * retile until mouseup" shape every other drag handler here already
   * uses. */
  onDragResizePanels: (story: "ground" | "second", wallId: string, leftSlotIndex: number, leftWidthIn: number, rightWidthIn: number) => void;
  /** Same portal mechanism FootprintCanvas's own Pan/Zoom/Reset row uses
   * (Tommy: "include the pan/zoom in/out/reset pieces found in the plan
   * view editor in the foundation and elevation editors") — when supplied,
   * the compact icon row renders there instead of inline above the SVG. */
  toolbarPortalTarget?: HTMLDivElement | null;
}

/** Same grouping Building3DView's own groupInstancesBySlot uses (this file
 * re-derives it locally rather than sharing a util, matching that file's own
 * convention of one small per-consumer copy). */
function groupInstancesBySlot(instances: PanelInstance[]): Map<string, PanelInstance[]> {
  const map = new Map<string, PanelInstance[]>();
  for (const inst of instances) {
    const key = `${inst.wallId}-${inst.slotIndexInWall}`;
    const existing = map.get(key);
    if (existing) existing.push(inst);
    else map.set(key, [inst]);
  }
  return map;
}

/** Same band-aware narrowing Building3DView's own instancesForBox uses — a
 * Mid-Wall Bond Beam-affected slot shares one wallId+slotIndex key across
 * its stacked-band instances (same convention a window's header+sill
 * already use), so `midWallBandIndex` narrows the lookup to just the one
 * band this rendered rect belongs to. `undefined` (a genuinely unaffected
 * slot — see allPanelInstances' own isGenuinelyUnaffected) returns every
 * instance for that key unfiltered. */
function instancesForSlotBand(
  instancesBySlot: Map<string, PanelInstance[]>,
  wallId: string,
  slotIndex: number,
  midWallBandIndex: number | undefined,
): PanelInstance[] {
  const all = instancesBySlot.get(`${wallId}-${slotIndex}`) ?? [];
  if (midWallBandIndex === undefined) return all;
  return all.filter((i) => i.midWallBandIndex === midWallBandIndex);
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
  allInstances,
  secondStoryAllInstances,
  startInsetIn,
  endInsetIn,
  startStopIn = 0,
  gableBuiltStartIn,
  gableBuiltEndIn,
  endStopIn = 0,
  secondStorySlots,
  secondStoryWallHeightFt,
  onToggleOpening,
  onSelectSlot,
  panelToolMode,
  onReplacePanel,
  onInsertPanel,
  onDeletePanel,
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
  hasStructuralColumnPanel,
  gableProfilePositionsIn,
  onChangeGableProfilePositionIn,
  insetIn,
  heelHeightIn,
  roofBearingAnchorMode,
  gableWindowReservations,
  onToggleGableWindow,
  boxBeamCoverage,
  onChangeBoxBeamCoverage,
  boxBeamSizeId,
  midWallBeams,
  secondStoryMidWallBeams,
  spanningHeaders,
  secondStorySpanningHeaders,
  spanningHeaderNameById,
  onChangeMidWallBeamHeight,
  onChangeMidWallBeamBigHeaderHeightIn,
  onChangeMidWallBeamCoverage,
  onDragResizePanels,
  toolbarPortalTarget,
}: WallElevationDiagramProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Pan/zoom/scroll view (Tommy: "include the pan/zoom in/out/reset pieces
  // found in the plan view editor in the foundation and elevation editors",
  // and 2026-09-29: "the elevation viewers appear super small and do not
  // have zoom or scroll capabilities").
  //
  // **This used to be a CSS transform on a wrapper inside `overflow:
  // hidden`.** Zooming in therefore pushed the drawing off the edge with no
  // scrollbars to bring it back — the only recovery was switching to Pan
  // and dragging, which is why zoom read as "no zoom". It is now a real
  // scrollable viewport: the SVG is given a real pixel size (fit x zoom) and
  // the container scrolls it, so ordinary horizontal scrolling reaches a
  // long wall and the scrollbars say the content is there.
  //
  // Every EXISTING drag handler in this file still needs no changes, for the
  // same reason as before AND one new one: each derives its own ratio fresh
  // per event from the SVG's real rendered width vs. its fixed internal
  // svgWidthPx (see `pxPerScreenPx` throughout), which is exact under any
  // rendered size — PROVIDED the drawing is scaled uniformly. It now is (see
  // `scaleX` below); it was not before past ~33.75ft.
  //
  // While `isPanning` is on, a transparent overlay rect (rendered last, on
  // top of everything) captures the drag and moves the scroll position
  // instead of touching any of those handlers — nothing else needs to know
  // pan mode exists at all.
  //
  // Own local toggle, independent of FootprintCanvas's own same-named
  // showPanelLabels state (Tommy: keep this local rather than lifting a
  // shared toggle into page.tsx) — same "Panel ID Visibility" concept, just
  // not wired together.
  const [showPanelLabels, setShowPanelLabels] = useState(true);
  /**
   * The user's zoom, **remembered per wall so that a DIFFERENT WALL OPENS
   * FITTED.** This component is not remounted when the view control steps from
   * one elevation stop to the next — same `WallElevationDiagram`, new `wall`
   * prop — so a plain `useState(1)` let a new wall inherit the previous one's
   * 400% zoom together with its scroll offset, which on a shorter wall is very
   * often a blank patch of paper with nothing to say why.
   *
   * ⚠ DERIVED, not written by an effect, and deliberately so on two counts:
   * an effect that reset it would paint the new wall once at the old zoom
   * before correcting itself, and `setState` in an effect body is a lint error
   * in this app (`react-hooks/set-state-in-effect`) rather than a style
   * preference. The stored wall id simply stops matching and the getter falls
   * back to the fitted 1.
   *
   * ⚠ `wallIdRef`, not the `wall.id` in scope, because `setViewScale` is
   * captured by the `[]`-dependency wheel effect below: a closure over the
   * FIRST render's wall id would file every later wheel-zoom under the wrong
   * wall and the zoom would silently stop responding after a stop change.
   */
  const [viewState, setViewState] = useState<{ wallId: string; scale: number }>({ wallId: wall.id, scale: 1 });
  const wallIdRef = useRef(wall.id);
  const viewScale = viewScaleForWall(viewState, wall.id);
  /**
   * **And the SCROLL of that same wall, so that A -> B -> A puts you back
   * where you were looking and not merely back at the zoom you were using.**
   *
   * ⚠ This closes a third behaviour that nobody chose. `viewState` above
   * remembers one wall's zoom, so stepping A -> B -> A matched the stored id
   * and restored 244% — while the layout effect below unconditionally reset
   * `scrollLeft`/`scrollTop` to 0. The wall came back at the right size and
   * at the wrong place: half-remembered, and documented as neither.
   *
   * The two candidates were "always reset to 1 on any id change" and "remember
   * the scroll alongside the scale". **This is the second, and the first was
   * not a free choice.** Resetting on EVERY id change — including a return to
   * a wall whose zoom is still in state — needs either `setState` during
   * render or a `key`-based remount: the first is the same severity-2
   * `react-hooks` error family as the `set-state-in-effect` the derived getter
   * above exists to avoid, and the second would also throw away the editor's
   * tool and label state on every step of the view dial. Remembering the
   * scroll needs neither — it is DOM state written in a layout effect that
   * already writes it.
   *
   * **ONE wall's view is remembered, zoom and scroll together.** They can
   * never be restored for different walls, because the slot is only ever
   * written while looking at the wall that owns the remembered SCALE, and is
   * dropped the moment that scale changes hands (see `setViewScale`). Every
   * other wall opens fitted, at the start of the wall.
   *
   * ⚠ TOMMY'S TO OVERRULE. "A wall you come back to is where you left it" is a
   * judgement about how the elevation viewer should feel, not a building
   * value; if he would rather every wall change reset the zoom outright, this
   * ref and the restore branch below come out and the getter loses its stored
   * id. `smearforn-stage-0-1`'s `each-wall-arrives-fitted-and-unscrolled` step
   * pins the part that is NOT in question: a wall you have not adjusted opens
   * at 100% and scrolled to 0.
   */
  const rememberedScrollRef = useRef<{ wallId: string; scrollLeft: number; scrollTop: number } | null>(null);
  const setViewScale = (next: number | ((current: number) => number)) => {
    // The remembered scroll belongs to whoever owns the remembered scale. The
    // moment that changes hands, the old wall's place is forgotten with it.
    const remembered = rememberedScrollRef.current;
    if (remembered && remembered.wallId !== wallIdRef.current) rememberedScrollRef.current = null;
    setViewState((prev) => {
      const wallId = wallIdRef.current;
      const current = viewScaleForWall(prev, wallId);
      return { wallId, scale: typeof next === "function" ? next(current) : next };
    });
  };
  const [isPanning, setIsPanning] = useState(false);
  const [panDragging, setPanDragging] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; scrollLeft: number; scrollTop: number } | null>(null);
  // The scrollable viewport the drawing lives in, and its measured box. The
  // height is what "fit height" fits to, so it has to be observed rather
  // than assumed — the editor is fullscreen and resizes with the window.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSizePx, setViewportSizePx] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // ⚠ THIS EFFECT AND THE WHEEL EFFECT BELOW BOTH BAIL ON A NULL REF AND
  // NEVER RETRY. That is safe *today* only because the viewport div is
  // rendered unconditionally, so `viewportRef.current` is always set by the
  // time an `[]`-dep effect runs. The day anyone wraps that div in a
  // condition — a placeholder while the wall loads, a "no panels yet" state —
  // these become silent no-ops: no ResizeObserver, so the fit stays at 1, and
  // no wheel listener, so Ctrl+wheel zooms the whole browser page. Neither
  // failure raises anything. If the div ever becomes conditional, key these
  // effects on the element (a ref callback or a state-held node) instead.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // ⚠ Measured on the BORDER box (offsetWidth/offsetHeight), not the
    // content box. A content-box measurement shrinks when a scrollbar
    // appears, which would feed back into the fit — and for a wall whose
    // drawing is only just wider than the viewport that is a genuine
    // oscillation (scrollbar appears -> fit shrinks -> drawing fits ->
    // scrollbar goes -> fit grows -> ...). The border box does not move when
    // a scrollbar appears, and ELEVATION_FIT_SLACK_PX is what pays for the
    // scrollbar's own thickness. ⚠ Counted ONCE, which an earlier version of
    // this comment did not do: the div has no padding, so with a 15px
    // horizontal scrollbar the content box is `offsetHeight - 15` while the
    // drawing is fitted to `offsetHeight - 32` — 32 less 15 leaves **17px
    // spare**, and a spurious VERTICAL scrollbar therefore needs a horizontal
    // one thicker than 32px, not thicker than 17px. See that constant's note.
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setViewportSizePx((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Pointer-anchored zoom: captured before the scale changes, applied after
  // the element has been re-measured (see the layout effect below).
  const zoomAnchorRef = useRef<{ fracX: number; fracY: number; clientX: number; clientY: number } | null>(null);
  const captureZoomAnchor = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    zoomAnchorRef.current = { fracX: (clientX - r.left) / r.width, fracY: (clientY - r.top) / r.height, clientX, clientY };
  };
  const zoomAboutViewportCentre = (direction: "in" | "out") => {
    const el = viewportRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      captureZoomAnchor(r.left + r.width / 2, r.top + r.height / 2);
    }
    setViewScale((s) => steppedViewScale(s, direction));
  };
  const zoomIn = () => zoomAboutViewportCentre("in");
  const zoomOut = () => zoomAboutViewportCentre("out");
  const resetView = () => {
    zoomAnchorRef.current = null;
    setViewScale(1);
    const el = viewportRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  };
  // The other half of "a different wall opens fitted": the SCROLL position,
  // which is DOM state rather than React state and so does have to be written.
  // A layout effect, before the browser paints, so the new wall is never shown
  // scrolled to the old wall's offset — and declared BEFORE the zoom-anchor
  // layout effect below so that the anchor it clears is already gone by the
  // time that one looks. Keyed on `wall.id` rather than on the wall object, so
  // that editing the wall you are looking at does not yank the view back.
  // `wallIdRef` is updated here, in an effect, rather than during render.
  //
  // The restore branch is the other half of `rememberedScrollRef` above: the
  // ONE wall whose zoom is remembered gets its place back too, and every other
  // wall starts at 0. Reading the ref here needs no dependency, which is the
  // practical reason the scroll lives in a ref and not in `viewState`.
  useLayoutEffect(() => {
    wallIdRef.current = wall.id;
    zoomAnchorRef.current = null;
    const el = viewportRef.current;
    if (el) {
      const remembered = rememberedScrollRef.current;
      const back = remembered && remembered.wallId === wall.id ? remembered : null;
      el.scrollLeft = back ? back.scrollLeft : 0;
      el.scrollTop = back ? back.scrollTop : 0;
    }
  }, [wall.id]);
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    zoomAnchorRef.current = null;
    if (!anchor) return;
    const el = viewportRef.current;
    const svg = svgRef.current;
    if (!el || !svg) return;
    const r = svg.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const { dxPx, dyPx } = zoomAnchorScrollDelta({
      fracX: anchor.fracX,
      fracY: anchor.fracY,
      clientX: anchor.clientX,
      clientY: anchor.clientY,
      newLeftPx: r.left,
      newTopPx: r.top,
      newWidthPx: r.width,
      newHeightPx: r.height,
    });
    el.scrollLeft += dxPx;
    el.scrollTop += dyPx;
  }, [viewScale]);
  // Wheel handling. **Ctrl/Cmd + wheel zooms; a plain wheel scrolls.**
  // Reasoning, since this is a deliberate choice: the default view scrolls
  // HORIZONTALLY (a wall is long and short), so the wheel's primary job here
  // is reaching the far end of the wall — and taking plain wheel for zoom
  // would have left the app with a zoom gesture and no scroll gesture, which
  // is the exact complaint this change exists to fix. Ctrl/Cmd+wheel is also
  // what the browser itself, every map and every drawing tool already use
  // for zoom. So: plain wheel scrolls the drawing, and while the drawing
  // fits vertically — which it does at the default view, by definition of
  // "fit height" — a vertical wheel is redirected to HORIZONTAL, because
  // otherwise it would have nothing to scroll.
  //
  // ⚠ **That redirect only applies at the default view, and an earlier
  // version of this note over-claimed by saying "the gesture is never
  // dead".** Zoom in and there IS vertical overflow, so `canScrollVertically`
  // is true, the redirect branch is skipped, and a plain wheel scrolls the
  // drawing UP AND DOWN like any other scroller. Reaching along the wall then
  // needs Shift+wheel, the horizontal scrollbar, or Pan. That is ordinary
  // scroll-container behaviour and is left as it is on purpose — hijacking a
  // vertical wheel on a surface that really can scroll vertically is worse —
  // but it is a deliberate choice, not an accident, and Tommy has not been
  // asked about it. Shift+wheel is the browser's own horizontal scroll and is
  // left alone in both cases.
  //
  // Attached natively with `{ passive: false }` rather than via React's
  // `onWheel`: React registers wheel listeners on the root as PASSIVE, so a
  // `preventDefault()` from an `onWheel` handler is ignored and Ctrl+wheel
  // would zoom the whole browser page instead of the drawing.
  //
  // ⚠ **DO NOT "TIDY" THIS INTO `onWheel`.** That is the whole reason it looks
  // unidiomatic, and it now has a committed check standing over it:
  // `smearforn-stage-0-1`'s `ctrl-wheel-zooms-the-drawing-not-the-page` step
  // dispatches a real Ctrl+wheel and asserts `event.defaultPrevented` from a
  // bubble-phase listener on `window` — i.e. after this handler has run, so a
  // true reading there means `preventDefault()` really landed. A passive
  // registration makes that step go red.
  //
  // ⚠ `devicePixelRatio` is NOT a proof of this and was briefly claimed as
  // one. A CDP-synthesised wheel is injected into the RENDERER; browser page
  // zoom is browser-UI behaviour that a synthetic event may never reach at
  // all, so `devicePixelRatio` reads 1 whether or not `preventDefault()`
  // landed. `defaultPrevented` is the thing that actually distinguishes them.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        captureZoomAnchor(e.clientX, e.clientY);
        setViewScale((s) => wheelZoomedViewScale(s, e.deltaY));
        return;
      }
      if (e.shiftKey || e.deltaY === 0) return; // the browser's own horizontal scroll
      const canScrollVertically = el.scrollHeight - el.clientHeight > 1;
      const canScrollHorizontally = el.scrollWidth - el.clientWidth > 1;
      if (!canScrollVertically && canScrollHorizontally) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);
  useEffect(() => {
    if (!panDragging) return;
    const handleMove = (e: MouseEvent) => {
      const start = panStartRef.current;
      const el = viewportRef.current;
      if (!start || !el) return;
      // Drag right => the drawing follows the cursor right => scroll left.
      el.scrollLeft = start.scrollLeft - (e.clientX - start.clientX);
      el.scrollTop = start.scrollTop - (e.clientY - start.clientY);
    };
    const handleUp = () => setPanDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [panDragging]);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const [draggingBoxBeamHandle, setDraggingBoxBeamHandle] = useState<"start" | "end" | null>(null);
  const [isDraggingMaxHeight, setIsDraggingMaxHeight] = useState(false);
  type MidWallBeamDragHandle = "height" | "big-header-beam-top" | "coverage-start" | "coverage-end";
  const [midWallBeamDrag, setMidWallBeamDrag] = useState<{
    story: "ground" | "second";
    beamId: string;
    handle: MidWallBeamDragHandle;
  } | null>(null);
  // Panel drag-resize (Tommy: "when you click and drag a panel, it moves,
  // snapping... to other panels' edges... otherwise, it shrinks one panel
  // and adds it to another, snapping to when a shrinking panel becomes 2'
  // at which point it snaps there... and then switches spots") — the
  // shared boundary between `leftSlotIndex` and `leftSlotIndex + 1`.
  // `leftSlotIndex` itself can advance mid-drag (role handoff — see the
  // drag effect below), so this is re-read fresh every render rather than
  // captured once at mousedown.
  const [draggingPanelBoundary, setDraggingPanelBoundary] = useState<{ story: "ground" | "second"; leftSlotIndex: number } | null>(
    null,
  );

  const wallWidthIn = wall.lengthFt * 12;
  // A wall whose NEIGHBOUR builds the corner at an end has its real slots
  // stop thicknessIn short of that end's true corner (see startInsetIn/
  // endInsetIn's own doc comment) — every along-wall position in this
  // component is anchored off these two offsets rather than assuming
  // content always starts flush at this wall's own true x=0.
  // Stage 3: a run stop pushes this wall's content further in by exactly
  // the span that isn't built. Folded into these two offsets rather than
  // handled separately, so every along-wall position in this component
  // (panel rows, beam handles, drag hit-testing) moves together.
  const cornerInsetStartIn = startInsetIn;
  const cornerInsetEndIn = endInsetIn;
  const startOffsetIn = cornerInsetStartIn + startStopIn;
  const endOffsetIn = cornerInsetEndIn + endStopIn;
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
    // Stage 2b: a spanning header splits a column exactly as a beam does, so
    // it goes into the SAME list. Passing only the beams here would draw the
    // panels beneath a header at full height while the named-instance list
    // and the 3D view had already shortened them.
    headers: SpanningHeader[],
  ): { bands: WallVerticalBand[]; zones: PanelSlotZone[] }[] => {
    const geom = wallBandGeometry(beams.length > 0 ? midWallBeamsToGeometry(beams) : [], spanningHeadersToGeometry(headers));
    return rowSlots.map((slot, i) => {
      const bands = computeWallVerticalBandsForSlotWithMaxHeight(i, storyHeightIn, geom, maxPanelHeightIn, panelHeightInRange.minIn);
      return { bands, zones: effectiveZonesForSlot(slot, bands.length) };
    });
  };
  const groundBandsAndZones = bandsAndZonesPerSlot(slots, eaveHeightIn, midWallBeams, spanningHeaders);
  const secondBandsAndZones = secondStorySlots
    ? bandsAndZonesPerSlot(secondStorySlots, secondStoryHeightIn, secondStoryMidWallBeams, secondStorySpanningHeaders)
    : [];

  const groundInstancesBySlot = groupInstancesBySlot(allInstances);
  const secondStoryInstancesBySlot = groupInstancesBySlot(secondStoryAllInstances);

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
    ? computeGableTiledRow(
        wallWidthIn,
        roofBaseHeightIn,
        points,
        targetPanelWidthIn,
        insetIn,
        true,
        heelHeightIn,
        roofBearingAnchorMode,
        gableWindowReservations,
        hasStructuralColumnPanel ? COLUMN_TOTAL_WIDTH_IN : undefined,
        // Stage 3: the gable row stops where the wall does. These come in as
        // props computed by the same `wallGeometryFor` call page.tsx feeds
        // its own model, rather than being re-derived here from
        // `startOffsetIn` — that local form used the corner INSET only, and
        // on a reflex-corner winner (inset 0, extension > 0) it disagreed
        // with the model by a full wall thickness.
        gableBuiltStartIn ?? 0,
        gableBuiltEndIn ?? wallWidthIn,
      )
    : [];
  const gablePanels: (GableTiledPanel & { verticalGapIn?: { leftIn: number; rightIn: number } })[] = rawGablePanels.map((p) => {
    const capped = capGableTileHeights(p.leftHeightIn, p.rightHeightIn, capHeightIn);
    return { ...p, leftHeightIn: capped.leftEdgeHeightIn, rightHeightIn: capped.rightEdgeHeightIn, verticalGapIn: capped.verticalGapIn };
  });
  const maxHeightIn = hasGableEnd ? maxProfileHeightIn : roofBaseHeightIn;
  // ⚠ ONE UNIFORM SCALE, both axes. `scaleX` used to be
  // `(svgWidthPx - margins) / wallWidthIn` against a hard 720px cap, so past
  // ~33.75ft it fell below the vertical PX_PER_IN and the drawing rendered
  // panels narrow-and-tall — on a 60ft wall, horizontal at 56% of vertical.
  // A fabrication elevation must not lie about proportion, so the cap is
  // gone and the drawing's real size on screen comes from the fit + zoom
  // below instead. It stays a NAMED binding rather than being replaced by
  // PX_PER_IN at its ~40 call sites so the X axis is still visibly its own
  // thing (and so every `useEffect` dependency list keeps working).
  const svgWidthPx = elevationSvgWidthPx(wallWidthIn);
  const scaleX = PX_PER_IN;
  // A stopped wall needs one more line of room under the F.F.L for the
  // unbuilt span's own NO PANELS dimension. Conditional so that every wall
  // without a stop keeps the exact layout it has today.
  const bottomMarginPx = startStopIn > 0 || endStopIn > 0 ? BOTTOM_MARGIN_PX + 18 : BOTTOM_MARGIN_PX;
  const svgHeightPx = TOP_MARGIN_PX + maxHeightIn * PX_PER_IN + bottomMarginPx;

  // Tommy's chosen default view, 2026-09-29: FIT HEIGHT, SCROLL WIDTH. The
  // wall's full height fills the available editor height (less slack) and
  // the length scrolls when it is longer than the viewport — chosen over
  // "fit the whole wall" and over "fixed readable scale". `viewScale` (the
  // Zoom buttons and Ctrl+wheel) multiplies the fit, so 100% means "fits
  // the height" and Reset returns there.
  const fitScale = fitHeightScale(viewportSizePx.height, svgHeightPx);
  const rendered = renderedDrawingSizePx({ svgWidthPx, svgHeightPx, fitScale, viewScale });

  const yPx = (heightIn: number) => svgHeightPx - bottomMarginPx - heightIn * PX_PER_IN;
  const xPx = (posIn: number) => LEFT_MARGIN_PX + posIn * scaleX;

  useEffect(() => {
    if (draggingPointIndex === null) return;
    const pointIndex = draggingPointIndex;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const posIn = wallPosInFromScreenX({
        clientX: e.clientX,
        svgLeftPx: rect.left,
        svgRenderedWidthPx: rect.width,
        svgWidthPx,
        wallWidthIn,
        clampToWall: true,
      });
      onChangeGableProfilePositionIn(pointIndex, posIn);
    };
    const handleUp = () => setDraggingPointIndex(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingPointIndex, svgWidthPx, wallWidthIn, onChangeGableProfilePositionIn]);

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
      const rawHeightIn = (svgHeightPx - bottomMarginPx - localPy) / PX_PER_IN - roofBaseHeightIn;
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
  }, [isDraggingMaxHeight, rawGablePanels, roofBaseHeightIn, svgHeightPx, bottomMarginPx, onChangeMaxGablePanelHeightIn]);

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
      const posIn = wallPosInFromScreenX({
        clientX: e.clientX,
        svgLeftPx: rect.left,
        svgRenderedWidthPx: rect.width,
        svgWidthPx,
        wallWidthIn,
        clampToWall: true,
      });
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
  }, [draggingBoxBeamHandle, boxBeamCoverage, svgWidthPx, wallWidthIn, secondStoryOffsetsIn, onChangeBoxBeamCoverage]);

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
  //    panel that fills that space") — generalized from big-header-beam-only
  //    to box-beam too. A Big Header's own height GROWS to close the gap
  //    (bottom edge unmoved, since its own assembly height is independently
  //    user-adjustable); a box-beam has no such concept (its depth is fixed
  //    by sizeId), so it instead snaps `heightIn` itself — the whole beam
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
      const absHeightIn = (svgHeightPx - bottomMarginPx - localPy) / PX_PER_IN;
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
        if (beam.kind === "big-header-beam") {
          onChangeMidWallBeamBigHeaderHeightIn(story, beamId, storyHeightIn - heightIn);
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
    bottomMarginPx,
    eaveHeightIn,
    secondStoryHeightIn,
    onChangeMidWallBeamHeight,
    onChangeMidWallBeamBigHeaderHeightIn,
  ]);

  // Big-header-beam-only: vertical drag of the beam's own TOP edge — same
  // continuous/unsnapped shape as the height drag above, but adjusts
  // bigHeaderBeamHeightIn (holding the bottom edge fixed) instead. Snaps
  // flush with the ceiling under the same MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN
  // rule. Box-beam has no independent top-edge handle of its own (its depth
  // is fixed by sizeId) — its own ceiling snap lives entirely in the height
  // drag effect above.
  useEffect(() => {
    if (!midWallBeamDrag || midWallBeamDrag.handle !== "big-header-beam-top") return;
    const { story, beamId } = midWallBeamDrag;
    const beams = story === "ground" ? midWallBeams : secondStoryMidWallBeams;
    const beam = beams.find((b) => b.id === beamId);
    if (!beam || beam.kind !== "big-header-beam") return;
    const storyFloorAbsIn = story === "ground" ? 0 : eaveHeightIn;
    const storyHeightIn = story === "ground" ? eaveHeightIn : secondStoryHeightIn;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.height === 0) return;
      const pxPerScreenPx = svgHeightPx / rect.height;
      const localPy = (e.clientY - rect.top) * pxPerScreenPx;
      const absTopIn = (svgHeightPx - bottomMarginPx - localPy) / PX_PER_IN;
      const rawTopIn = Math.min(Math.max(absTopIn - storyFloorAbsIn, beam.heightIn + BIG_HEADER_BEAM_MIN_HEIGHT_IN), storyHeightIn);
      const topIn = storyHeightIn - rawTopIn <= MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN ? storyHeightIn : rawTopIn;
      onChangeMidWallBeamBigHeaderHeightIn(story, beamId, topIn - beam.heightIn);
    };
    const handleUp = () => setMidWallBeamDrag(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [midWallBeamDrag, midWallBeams, secondStoryMidWallBeams, svgHeightPx, bottomMarginPx, eaveHeightIn, secondStoryHeightIn, onChangeMidWallBeamBigHeaderHeightIn]);

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
      const posIn = wallPosInFromScreenX({
        clientX: e.clientX,
        svgLeftPx: rect.left,
        svgRenderedWidthPx: rect.width,
        svgWidthPx,
        wallWidthIn,
        clampToWall: true,
      });
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
    wallWidthIn,
    onChangeMidWallBeamCoverage,
  ]);

  // Panel drag-resize — free positioning along the wall, but landing on the
  // 1/8in grid (unlike the Box Beam/Mid-Wall Bond Beam coverage drags above,
  // which jump to the nearest real slot boundary, and unlike this drag's own
  // former behaviour, which was continuous and put a hand-set width straight
  // off the grid where the load-time repair silently absorbed it — see
  // resolvePanelBoundaryDrag). The BOUNDARY is what snaps; both widths are
  // derived from it, so the pair's total is conserved exactly.
  // `leftSlotIndex`/`leftSlotIndex+1` are the CURRENTLY active pair,
  // re-derived fresh every time this effect (re-)runs — a mid-drag role
  // handoff (see below) changes `draggingPanelBoundary` itself, which
  // re-triggers this same effect with the new pair.
  useEffect(() => {
    if (!draggingPanelBoundary) return;
    const { story, leftSlotIndex } = draggingPanelBoundary;
    const rowSlots = story === "ground" ? slots : (secondStorySlots ?? []);
    const offsetsIn = story === "ground" ? groundOffsetsIn : secondStoryOffsetsIn;
    const isPanel = (s: PanelSlot | undefined) => !!s && (s.type === "standard" || s.type === "braced");
    const left = rowSlots[leftSlotIndex];
    const right = rowSlots[leftSlotIndex + 1];
    if (!isPanel(left) || !isPanel(right)) return;
    const pairStartIn = offsetsIn[leftSlotIndex]!;
    const pairEndIn = offsetsIn[leftSlotIndex + 2]!;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      // ⚠ NOT clamped to the wall, deliberately — the one X drag that isn't.
      // `resolvePanelBoundaryDrag` needs to see a cursor that has gone past
      // `pairStartIn`/`pairEndIn`, because that overshoot is what fires the
      // 24in floor snap and the role handoff to the next pair out.
      const cursorIn = wallPosInFromScreenX({
        clientX: e.clientX,
        svgLeftPx: rect.left,
        svgRenderedWidthPx: rect.width,
        svgWidthPx,
        wallWidthIn,
      });
      // Floor + role handoff (Tommy: "it shrinks one panel and adds it to
      // another, snapping to when a shrinking panel becomes 2' at which
      // point it snaps there for plus or minus 2 inches and then switches
      // spots") and the eighth-snap, both resolved in one pure function so
      // they are testable without a browser.
      const { leftWidthIn, rightWidthIn } = resolvePanelBoundaryDrag({
        cursorIn,
        pairStartIn,
        pairEndIn,
        floorIn: fabricationMinPanelWidthIn.value,
        snapToleranceIn: PANEL_DRAG_SNAP_TOLERANCE_IN,
      });
      onDragResizePanels(story, wall.id, leftSlotIndex, leftWidthIn, rightWidthIn);
      // "Switches spots" — once the cursor has moved past whichever side
      // just floored, the ACTIVE pair hands off to the next one out (the
      // just-floored slot becomes the new pair's OTHER member, free to
      // grow again as dragging continues — see this effect's own re-run
      // once `draggingPanelBoundary` changes). Skipped when there's no
      // eligible neighbor to hand off to (a corner/opening/column sits
      // there instead) — dragging simply stops affecting anything further,
      // per Tommy's confirmed "stop at the boundary" answer.
      if (cursorIn < pairStartIn && leftSlotIndex > 0 && isPanel(rowSlots[leftSlotIndex - 1])) {
        setDraggingPanelBoundary({ story, leftSlotIndex: leftSlotIndex - 1 });
      } else if (cursorIn > pairEndIn && isPanel(rowSlots[leftSlotIndex + 2])) {
        setDraggingPanelBoundary({ story, leftSlotIndex: leftSlotIndex + 1 });
      }
    };
    const handleUp = () => setDraggingPanelBoundary(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingPanelBoundary, slots, secondStorySlots, groundOffsetsIn, secondStoryOffsetsIn, svgWidthPx, wallWidthIn, wall.id, onDragResizePanels]);

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
    /** This row's own flat nominal story height (eaveHeightIn for ground,
     * secondStoryHeightIn for second) — needed only to tell a genuinely
     * unaffected slot (1 band spanning the whole story) apart from a real
     * single PARTIAL band left over after a beam ate part of the height;
     * both have bands.length === 1, but only the latter has a real
     * midWallBandIndex on its own PanelInstance (see allPanelInstances' own
     * isGenuinelyUnaffected). */
    storyHeightIn: number,
    heightOverrideForSlotBand?: (slotIndex: number, band: WallVerticalBand, isTopmostForSlot: boolean) => number,
  ) => {
    const instancesBySlot = story === "ground" ? groundInstancesBySlot : secondStoryInstancesBySlot;
    const rects = rowSlots.reduce<{ slot: PanelSlot; i: number; x0: number; x1: number }[]>((acc, slot, i) => {
      const x0 = acc.length > 0 ? acc[acc.length - 1]!.x1 : startOffsetIn;
      acc.push({ slot, i, x0, x1: x0 + slot.widthIn });
      return acc;
    }, []);
    const maxBandCount = Math.max(0, ...bandsAndZonesForRow.map((b) => b.bands.length));
    const elements: ReactNode[] = [];
    // What a click on a panel's body means right now. With the placement
    // tool armed it REPLACES (or deletes) instead of cycling — a direct
    // select in place of the click-through wheel, which is the whole of
    // Tommy's "select which type of panel you want to add, and then click
    // where to put it". The tool acts on the whole slot/column: a width
    // reservation is shared by every zone stacked in it.
    const bodyClick = (slotIndex: number, zoneIndexForClick: number) => () => {
      if (panelToolMode === "place") onReplacePanel(story, wall.id, slotIndex);
      else if (panelToolMode === "delete") onDeletePanel(story, wall.id, slotIndex);
      else onToggleOpening(story, wall.id, slotIndex, zoneIndexForClick);
    };
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
        const isGenuinelyUnaffectedBand = entry.bands.length === 1 && entry.bands[0]!.bottomIn === 0 && entry.bands[0]!.topIn === storyHeightIn;
        const panelLabel = combinedPanelLabel(
          instancesForSlotBand(instancesBySlot, wall.id, i, isGenuinelyUnaffectedBand ? undefined : band.bandIndex),
        );
        if (panelLabel && showPanelLabels) {
          const labelXPx = xPx((x0 + x1) / 2);
          const labelYPx = localYPx(rowWallHeightIn) + 12;
          elements.push(
            <text
              key={`label-${story}-${bandIndex}-${i}`}
              x={labelXPx}
              y={labelYPx}
              fontSize={7}
              fontWeight={600}
              textAnchor="middle"
              fill="#333"
              transform={`rotate(-90 ${labelXPx} ${labelYPx})`}
            >
              {panelLabel}
            </text>,
          );
        }
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
              onClick={bodyClick(i, zoneIndexForClick)}
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
              onClick={bodyClick(i, zoneIndexForClick)}
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
              <text
                x={xPx((x0 + x1) / 2)}
                y={localYPx(rowWallHeightIn / 2)}
                fontSize={9}
                textAnchor="middle"
                fill="#333"
                // The label SELECTS this panel (the body still cycles its
                // type) — see onSelectSlot's own doc comment. Bold means the
                // width is hand-set, so a pin is visible on the drawing
                // rather than only in the note.
                // While the placement tool is armed the label has no gesture
                // of its own — swallowing the click here would make the panel
                // under it the one spot on the wall the tool cannot reach.
                onClick={
                  panelToolMode === null && (zone.type === "standard" || zone.type === "braced")
                    ? (e) => {
                        e.stopPropagation();
                        onSelectSlot(story, wall.id, i, zoneIndexForClick);
                      }
                    : undefined
                }
                style={
                  zone.type === "standard" || zone.type === "braced"
                    ? { cursor: "pointer", fontWeight: slot.lockedWidthIn === undefined ? "normal" : "bold" }
                    : undefined
                }
              >
                {slot.widthIn}&quot;
              </text>
            </g>,
          );
        }
      }
    }

    // Panel drag-resize hit-zones (Tommy: "when you click and drag a
    // panel, it moves...") — a thin strip centered on the shared boundary
    // between 2 ADJACENT standard/braced slots only (Tommy's confirmed
    // answer: dragging stops cleanly at any other boundary type — corner/
    // safety-gap/window/door/column — rather than resizing an opening), so
    // the strip only exists where a drag is actually legal and never
    // competes with a window/door/corner slot's own whole-body onClick.
    // Spans the row's own full height (every band together, not just one)
    // — a slot's widthIn is shared across all its bands.
    const rowMaxHeightIn = Math.max(0, ...bandsAndZonesForRow.flatMap((e) => e.bands.map((b) => b.topIn)));

    // Smearforn Stage 2's insert targets: one per boundary a panel may go
    // at, drawn so the legal places are visible rather than guessed at, and
    // spanning the row's full height like the drag strips they replace.
    // `insertableBoundaryRange` keeps them inside the corners — a corner
    // panel stays at the end of the wall it belongs to.
    if (panelToolMode === "place" && rects.length > 0) {
      const { minIndex, maxIndex } = insertableBoundaryRange(rowSlots);
      for (let b = minIndex; b <= maxIndex; b++) {
        const xIn = b < rects.length ? rects[b]!.x0 : rects[rects.length - 1]!.x1;
        elements.push(
          <g key={`insert-${story}-${b}`} style={{ cursor: "copy" }} onClick={() => onInsertPanel(story, wall.id, b)}>
            <rect
              x={xPx(xIn) - PANEL_DRAG_HANDLE_HALF_WIDTH_PX}
              y={yPx(rowFloorHeightIn + rowMaxHeightIn)}
              width={PANEL_DRAG_HANDLE_HALF_WIDTH_PX * 2}
              height={rowMaxHeightIn * PX_PER_IN}
              fill="#4a90d9"
              fillOpacity={0.12}
              style={{ pointerEvents: "all" }}
            />
            <line
              x1={xPx(xIn)}
              y1={yPx(rowFloorHeightIn + rowMaxHeightIn)}
              x2={xPx(xIn)}
              y2={yPx(rowFloorHeightIn)}
              stroke="#4a90d9"
              strokeWidth={2}
              strokeDasharray="5 3"
              pointerEvents="none"
            />
          </g>,
        );
      }
    }

    // Panel drag-resize hit-zones — see the comment above.
    //
    // **Drawn only while NO tool is armed**, not just while the place tool
    // is: with Delete armed these strips are still on top of the panel
    // bodies, so a click near a panel edge started a resize drag instead of
    // deleting the panel under the cursor. One strip cannot be both "drag
    // this boundary" and "place/delete here", and the spec says the drag
    // stands down for as long as the tool is armed — which includes Delete.
    //
    // Guarded rather than returned early on purpose: an early return here
    // would silently skip anything a later pass appends to this function
    // (Stage 3's unbuilt-span line is going to sit below), and a row element
    // that vanishes only when a tool happens to be armed is the worst kind
    // of bug to find.
    const isDraggablePanel = (s: PanelSlot) => s.type === "standard" || s.type === "braced";
    if (panelToolMode === null) {
      for (let i = 0; i < rects.length - 1; i++) {
        const leftRect = rects[i]!;
        const rightRect = rects[i + 1]!;
        if (!isDraggablePanel(leftRect.slot) || !isDraggablePanel(rightRect.slot)) continue;
        elements.push(
          <rect
            key={`drag-${story}-${i}`}
            x={xPx(leftRect.x1) - PANEL_DRAG_HANDLE_HALF_WIDTH_PX}
            y={yPx(rowFloorHeightIn + rowMaxHeightIn)}
            width={PANEL_DRAG_HANDLE_HALF_WIDTH_PX * 2}
            height={rowMaxHeightIn * PX_PER_IN}
            fill="transparent"
            style={{ cursor: "ew-resize", pointerEvents: "all" }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setDraggingPanelBoundary({ story, leftSlotIndex: i });
            }}
          />,
        );
      }
    }
    return elements;
  };

  // At an end where the neighbouring wall builds the corner, this wall
  // physically butts against that corner panel (see startInsetIn/endInsetIn's
  // own doc comment, and note it is the INSET that decides this, not mere
  // ownership — a neighbour that stops short never builds the panel, and
  // then there is nothing here to draw) — that panel's
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
        {startInsetIn > 0 && sliver(0, `${story}-adjacent-start`)}
        {endInsetIn > 0 && sliver(wallWidthIn - endInsetIn, `${story}-adjacent-end`)}
      </>
    );
  };

  /**
   * Stage 3 — the span of this wall that is deliberately NOT built.
   *
   * **A dashed boundary outline, never a hatched wall.** This is where the
   * building ends, not a wall of unknown type, and the two must not look
   * alike: an unfilled dashed rectangle reads as "nothing here, and that is
   * on purpose", where any fill or hatch would read as a panel whose type
   * is still to be decided. The label is NO PANELS, which is also exactly
   * what prints.
   *
   * One outline per stopped end, spanning the full built height of the wall
   * (both stories when there are two — the stop record is per WALL, not per
   * story), plus its own dimension below the F.F.L line so it sits beside
   * the Overall Width callout rather than fighting the panel row for space.
   */
  const renderUnbuiltSpans = () => {
    if (startStopIn <= 0 && endStopIn <= 0) return null;
    const topIn = eaveHeightIn + secondStoryHeightIn;
    const spans: { key: string; fromIn: number; toIn: number }[] = [];
    if (startStopIn > 0) spans.push({ key: "start", fromIn: cornerInsetStartIn, toIn: cornerInsetStartIn + startStopIn });
    if (endStopIn > 0) {
      spans.push({ key: "end", fromIn: wallWidthIn - cornerInsetEndIn - endStopIn, toIn: wallWidthIn - cornerInsetEndIn });
    }
    return (
      <>
        {spans.map(({ key, fromIn, toIn }) => {
          const widthPx = Math.max(0, (toIn - fromIn) * scaleX);
          const midIn = (fromIn + toIn) / 2;
          const dimY = yPx(0) + 18;
          return (
            <g key={`unbuilt-${key}`}>
              <rect
                x={xPx(fromIn)}
                y={yPx(topIn)}
                width={widthPx}
                height={topIn * PX_PER_IN}
                fill="none"
                stroke="#8a8a8a"
                strokeWidth={1.25}
                strokeDasharray="7 5"
              />
              <text x={xPx(midIn)} y={yPx(topIn / 2)} fontSize={9} fontWeight={600} textAnchor="middle" fill="#6a6a6a">
                NO PANELS
              </text>
              {/* Its own dimension, in the band under the F.F.L line. */}
              <line x1={xPx(fromIn)} y1={dimY} x2={xPx(toIn)} y2={dimY} stroke="#8a8a8a" strokeWidth={1} />
              <line x1={xPx(fromIn)} y1={dimY - 4} x2={xPx(fromIn)} y2={dimY + 4} stroke="#8a8a8a" strokeWidth={1} />
              <line x1={xPx(toIn)} y1={dimY - 4} x2={xPx(toIn)} y2={dimY + 4} stroke="#8a8a8a" strokeWidth={1} />
              <text x={xPx(midIn)} y={dimY + 14} fontSize={9} fontWeight={600} textAnchor="middle" fill="#6a6a6a">
                NO PANELS: {formatFeetInches((toIn - fromIn) / 12)}
              </text>
            </g>
          );
        })}
      </>
    );
  };

  /**
   * Spanning ("triple") headers — Smearforn Stage 2b.
   *
   * A real header panel drawn across the panels it spans, in the Big Header
   * panel colour (it IS a header panel, not a beam), labelled with its own
   * building-wide name. The band beneath it has already been shortened by
   * `bandsAndZonesPerSlot`, so this draws into space the row left for it
   * rather than over the top of a panel.
   *
   * `storyFloorIn` is this story's own floor in the diagram's absolute
   * coordinates (0 for the ground row, the eave height for the second), the
   * same convention the Mid-Wall Bond Beam blocks use.
   */
  const renderSpanningHeaders = (headers: SpanningHeader[], offsetsIn: number[], storyFloorIn: number, runWidthIn: number) => {
    if (headers.length === 0) return null;
    return (
      <>
        {headers.map((header) => {
          const assemblyHeightIn = resolveSpanningHeaderHeightIn(header);
          const startXIn = offsetsIn[header.startSlotIndex] ?? startOffsetIn;
          const endXIn = offsetsIn[header.endSlotIndex] ?? startOffsetIn + runWidthIn;
          const bottomIn = storyFloorIn + header.heightIn;
          const spanIn = Math.max(0, endXIn - startXIn);
          // Its own real name, looked up by id. Never derived here: one
          // series, one walk, in page.tsx.
          const name = spanningHeaderNameById.get(header.id) ?? "H?";
          return (
            <g key={header.id}>
              <rect
                x={xPx(startXIn)}
                y={yPx(bottomIn + assemblyHeightIn)}
                width={spanIn * scaleX}
                height={assemblyHeightIn * PX_PER_IN}
                fill={SLOT_COLORS["big-header"]}
                fillOpacity={0.85}
                stroke="#8c2f5c"
                strokeWidth={1.25}
              />
              <text
                x={xPx(startXIn + spanIn / 2)}
                y={yPx(bottomIn + assemblyHeightIn / 2) + 3}
                fontSize={10}
                fontWeight={700}
                textAnchor="middle"
                fill="#fff"
              >
                {name}
              </text>
              {/* The span, dimensioned on the drawing — it is this header's
                  own fabricated width, and it is derived from the panels
                  underneath rather than typed, so it is worth showing. */}
              <text x={xPx(startXIn + spanIn / 2)} y={yPx(bottomIn + assemblyHeightIn) - 3} fontSize={9} textAnchor="middle" fill="#8c2f5c">
                {formatFeetInches(spanIn / 12)}
              </text>
            </g>
          );
        })}
      </>
    );
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
  // Two presentations, one state (the same discipline `viewerMenus.ts` uses
  // for the Design/View menus): the SIDEBAR copy is exactly what shipped
  // before and is not removed, and a DOCK copy sits over the drawing itself,
  // following the `.compassDock` / `.legendDock` precedent, because
  // unlabelled icons at the top of a 240px scrolling side panel are not
  // where anyone looks for zoom. The dock copy is the labelled one.
  // ⚠ Two visible copies of the same row is a judgement call, not Tommy's
  // decision — if he wants only one, deleting either is a one-line change.
  const viewingToolbar = (variant: "sidebar" | "dock") => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button
        type="button"
        title="Pan: drag the drawing to move around it"
        aria-pressed={isPanning}
        onClick={() => setIsPanning((p) => !p)}
        style={iconButtonStyle(isPanning)}
      >
        <PanIcon />
        {variant === "dock" && <span style={{ fontSize: 12, marginLeft: 4 }}>Pan</span>}
      </button>
      <button type="button" title="Zoom out" onClick={zoomOut} style={iconButtonStyle(false)}>
        <ZoomOutIcon />
      </button>
      <span style={{ fontSize: 11, color: "#555", minWidth: 28, textAlign: "center" }}>{Math.round(viewScale * 100)}%</span>
      <button type="button" title="Zoom in" onClick={zoomIn} style={iconButtonStyle(false)}>
        <ZoomInIcon />
      </button>
      <button
        type="button"
        title="Reset the view: fit the wall's full height to the window and scroll back to its start"
        onClick={resetView}
        style={{ ...iconButtonStyle(false), fontSize: 12, padding: "6px 10px" }}
      >
        {variant === "dock" ? "Fit height" : "Reset"}
      </button>
      <button
        type="button"
        title="Show or hide the panel ID labels drawn on each panel"
        aria-pressed={showPanelLabels}
        onClick={() => setShowPanelLabels((v) => !v)}
        style={{
          ...iconButtonStyle(showPanelLabels),
          fontSize: 12,
          padding: "6px 10px",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <TagIcon /> ID
      </button>
    </div>
  );

  return (
    // Fills the editor canvas area rather than floating a small drawing in
    // the middle of it — `.editorCanvasLayer` is `flex: 1 1 auto; height:
    // 100%` and centres its child, so `alignSelf: stretch` is what takes the
    // height it was already offering. `position: relative` anchors the
    // docked toolbar below.
    <div
      style={{
        width: "100%",
        height: "100%",
        alignSelf: "stretch",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {toolbarPortalTarget ? createPortal(viewingToolbar("sidebar"), toolbarPortalTarget) : viewingToolbar("sidebar")}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 45,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "6px 8px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 3,
        }}
      >
        {viewingToolbar("dock")}
        {/* The wheel is the one gesture with no button, so it gets a line of
            its own — on a SECOND line rather than beside the buttons, which
            made the dock wide enough to cover the whole "Overall Width"
            dimension callout it floats over. */}
        <span style={{ fontSize: 11, color: "#666" }}>Ctrl + scroll to zoom &middot; scroll to move along the wall</span>
      </div>
      {/* The real scrollable viewport. `overflow: auto` plus an SVG given a
          real pixel size is what makes a zoomed or over-long drawing
          reachable by ordinary scrolling — the previous `overflow: hidden`
          plus a CSS transform made zoomed-in content unreachable except by
          Pan. `margin: auto` on the child (rather than flex centring) is the
          form that centres a SMALL drawing without making the overflowing
          start of a LARGE one unscrollable. */}
      <div
        ref={viewportRef}
        style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, overflow: "auto", display: "flex" }}
        // Where this wall is being looked at, kept in a ref so that scrolling
        // never re-renders the drawing. Gated on the wall that owns the
        // remembered SCALE, which is what keeps zoom and scroll from ever
        // being restored for two different walls — see rememberedScrollRef.
        onScroll={(e) => {
          if (viewState.wallId !== wall.id) return;
          const el = e.currentTarget;
          rememberedScrollRef.current = { wallId: wall.id, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
        }}
      >
        <div style={{ margin: "auto", flex: "0 0 auto" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidthPx} ${svgHeightPx}`}
            width={rendered.widthPx}
            height={rendered.heightPx}
            style={{
              display: "block",
              width: rendered.widthPx,
              height: rendered.heightPx,
              background: "#fafafa",
              cursor: isPanning ? "grab" : undefined,
            }}
            role="img"
            aria-label={`Elevation view of wall ${wall.id}`}
          >
        {/* "Overall Width" dimension callout — this wall's own true
            lengthFt (not groundRunWidthIn, which can stop short at an end
            this wall doesn't own its own corner at), formatted the same
            way every other wall-length label in the app already is. Drawn
            above maxHeightIn (TOP_MARGIN_PX was bumped for exactly this)
            so it never collides with gable/roofline content also sharing
            this SVG. */}
        <g>
          <line x1={xPx(0)} y1={8} x2={xPx(wallWidthIn)} y2={8} stroke="#666" strokeWidth={1} />
          <line x1={xPx(0)} y1={4} x2={xPx(0)} y2={12} stroke="#666" strokeWidth={1} />
          <line x1={xPx(wallWidthIn)} y1={4} x2={xPx(wallWidthIn)} y2={12} stroke="#666" strokeWidth={1} />
          <text x={xPx(wallWidthIn / 2)} y={7} fontSize={9} fontWeight={600} textAnchor="middle" fill="#444">
            Overall Width: {formatFeetInches(wall.lengthFt)}
          </text>
        </g>
        {/* Ground top-plate line — spans only the ground row's own actual
            width (see groundRunWidthIn above), not the wall's raw
            geometric length. Always the ground floor's own height,
            regardless of whether a second story exists above it. */}
        <line x1={xPx(startOffsetIn)} y1={yPx(eaveHeightIn)} x2={xPx(startOffsetIn + groundRunWidthIn)} y2={yPx(eaveHeightIn)} stroke="#999" strokeDasharray="4 3" />
        <text x={4} y={yPx(eaveHeightIn) + 4} fontSize={10} fill="#666">
          {eaveHeightIn}&quot;
        </text>
        {/* F.F.L (Finish Floor Line) — the ground row's own y=0 baseline is
            already the real reference every wall height in the app
            measures from; this just labels it. */}
        <line x1={xPx(0)} y1={yPx(0)} x2={xPx(wallWidthIn)} y2={yPx(0)} stroke="#666" strokeWidth={1.5} />
        <text x={xPx(wallWidthIn) + 4} y={yPx(0) + 3} fontSize={9} fontWeight={600} fill="#444">
          F.F.L
        </text>
        {renderRow(slots, groundBandsAndZones, 0, "ground", eaveHeightIn)}
        {renderAdjacentWallFiller(0, eaveHeightIn, "ground")}
        {renderUnbuiltSpans()}

        {/* Mid-Wall Bond Beams (ground floor) — one filled rect per beam
            at its own real position/coverage/thickness, each with its own
            height-drag handle (vertical, continuous — not slot-snapped,
            since this is a real height, not a horizontal panel boundary)
            and 2 coverage-drag handles (horizontal, snap-to-slot, same
            pattern as the Box Beam handles below). */}
        {midWallBeams.map((beam) => {
          const isBigHeaderBeam = beam.kind === "big-header-beam";
          const assemblyHeightIn = resolveMidWallBeamAssemblyHeightIn(beam);
          const fillColor = isBigHeaderBeam ? "#9fb8e0" : "#c9a26f";
          const strokeColor = isBigHeaderBeam ? "#3a5a8a" : "#7a5a2e";
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
                {beam.heightIn.toFixed(1)}&quot; {isBigHeaderBeam ? "big header" : "bond beam"}
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
              {isBigHeaderBeam && (
                <g
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMidWallBeamDrag({ story: "ground", beamId: beam.id, handle: "big-header-beam-top" });
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

        {/* Spanning ("triple") headers, ground floor — Smearforn Stage 2b.
            One real header panel per record, drawn across the panels it
            spans at its own height, labelled with its building-wide name
            (`H1` — no direction letter, by decision). Deliberately NOT
            drag-handled: its coverage and heights are typed in the left bar,
            because a header's span is a set of whole panels rather than a
            free position, and the numbers it is built from are the ones a
            shop sheet quotes. */}
        {renderSpanningHeaders(spanningHeaders, groundOffsetsIn, 0, groundRunWidthIn)}

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
            {renderRow(secondStorySlots, secondBandsAndZones, eaveHeightIn, "second", secondStoryHeightIn, (slotIndex, band, isTopmostForSlot) => {
              const bandHeightIn = band.topIn - band.bottomIn;
              return isTopmostForSlot && isSlotBoxBeamCovered(slotIndex, boxBeamCoverage)
                ? bandHeightIn - boxBeamHeightDeltaIn
                : bandHeightIn;
            })}
            {renderAdjacentWallFiller(eaveHeightIn, eaveHeightIn + secondStoryHeightIn, "second")}

            {/* Mid-Wall Bond Beams (second story) — same shape as the
                ground-floor ones above, offset by eaveHeightIn (absolute). */}
            {secondStoryMidWallBeams.map((beam) => {
              const isBigHeaderBeam = beam.kind === "big-header-beam";
              const assemblyHeightIn = resolveMidWallBeamAssemblyHeightIn(beam);
              const fillColor = isBigHeaderBeam ? "#9fb8e0" : "#c9a26f";
              const strokeColor = isBigHeaderBeam ? "#3a5a8a" : "#7a5a2e";
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
                    {beam.heightIn.toFixed(1)}&quot; {isBigHeaderBeam ? "big header" : "bond beam"}
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
                  {isBigHeaderBeam && (
                    <g
                      style={{ cursor: "ns-resize" }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setMidWallBeamDrag({ story: "second", beamId: beam.id, handle: "big-header-beam-top" });
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

            {/* Spanning headers, second story — same block as the ground
                floor's, offset by the eave height (absolute). */}
            {renderSpanningHeaders(secondStorySpanningHeaders, secondStoryOffsetsIn, eaveHeightIn, secondStoryRunWidthIn)}
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
            page would show it in. Every non-safety-gap tile is click-to-
            toggle into a window (Tommy: "add an option to click-edit gable
            end panels to become window gable end panels") — `ordinal`
            (running, non-safety-gap tiles only) is the SAME "how many real
            tiles precede this one" identity computeGableTiledRow's own
            window-reservation ordinals use, so a click here always targets
            the exact tile the user sees. A window tile splits into a lower
            RO+jack-studs+sill (same real geometry/coloring a normal wall
            window's own 2D rendering already uses) and an upper, smaller
            gable cap — "just a small version of an inclined panel," not a
            new shape (Tommy) — anchored at the window's own RO-top instead
            of the eave. */}
        {hasGableEnd &&
          (() => {
            let ordinal = 0;
            return gablePanels.map((p, i) => {
              if (p.isSafetyGap) {
                const points4 = [
                  [xPx(p.xStartIn), yPx(roofBaseHeightIn)],
                  [xPx(p.xEndIn), yPx(roofBaseHeightIn)],
                  [xPx(p.xEndIn), yPx(p.rightHeightIn)],
                  [xPx(p.xStartIn), yPx(p.leftHeightIn)],
                ]
                  .map(([x, y]) => `${x},${y}`)
                  .join(" ");
                return <polygon key={i} points={points4} fill={GABLE_SAFETY_GAP_COLOR} stroke="#3a5a8a" strokeWidth={1} />;
              }
              // Structural Column Panel — auto-managed (see
              // gableStructuralPanelWallIds in page.tsx), never user-click-
              // toggleable, and never counted toward `ordinal` — it isn't
              // part of computeGableTiledRow's own window-ordinal numbering
              // (the column reservation already shrank the segments window
              // ordinals are counted against, before this tile was spliced
              // in), so skipping it here keeps a click on any LATER tile
              // targeting the exact position that same numbering expects.
              if (p.isColumn) {
                return (
                  <rect
                    key={i}
                    x={xPx(p.xStartIn)}
                    y={yPx(p.leftHeightIn)}
                    width={(p.xEndIn - p.xStartIn) * scaleX}
                    height={yPx(roofBaseHeightIn) - yPx(p.leftHeightIn)}
                    fill={SLOT_COLORS.column}
                    stroke="#2c5a66"
                    strokeWidth={1}
                  />
                );
              }
              const thisOrdinal = ordinal;
              ordinal++;
              const toggle = () => onToggleGableWindow(thisOrdinal, p.widthIn);
              if (!p.isWindow) {
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
                  <g key={i} onClick={toggle} style={{ cursor: "pointer" }}>
                    <polygon points={points4} fill={GABLE_COLOR} stroke="#3a5a8a" strokeWidth={1} />
                    <text x={xPx((p.xStartIn + p.xEndIn) / 2)} y={yPx(roofBaseHeightIn) - 6} fontSize={8} textAnchor="middle" fill="#333">
                      {rip.angleDeg.toFixed(1)}&deg; / {rip.lengthIn.toFixed(0)}&quot;
                    </text>
                  </g>
                );
              }
              // Window tile — split render.
              const windowHeightIn = p.windowHeightIn ?? standardWindowHeightDefaultIn.value;
              const windowSillHeightIn = p.windowSillHeightIn ?? sillDefaultHeightIn.value;
              const tileMaxLocalRiseIn = Math.max(p.leftHeightIn, p.rightHeightIn) - roofBaseHeightIn;
              const g = computeOpeningGeometry(
                false,
                p.widthIn,
                Math.max(tileMaxLocalRiseIn, windowSillHeightIn + windowHeightIn + 1),
                windowSillHeightIn,
                windowHeightIn,
                jackStudConfig,
                targetPanelWidthIn,
              );
              const members = buildOpeningAssemblyMembers(p.widthIn, thicknessIn, "window", jackStudConfig, g.sillHeightIn, g.jackStudSpanIn, 0, g.sillHeightIn, g.sillWidthsIn, includeNailer);
              const jackStudMembers = members.filter((m) => m.role === "jack_stud");
              const localXToPx = (xIn: number) => xPx(p.xStartIn + xIn);
              const localYPx = (localHeightIn: number) => yPx(roofBaseHeightIn + localHeightIn);
              const roGapXPx = localXToPx(g.jackThicknessIn);
              const roGapWidthPx = localXToPx(p.widthIn - g.jackThicknessIn) - roGapXPx;
              const roGapTopPx = localYPx(g.roTopZIn);
              const roGapHeightPx = localYPx(g.sillHeightIn) - roGapTopPx;
              const sillOffsetsIn = g.sillWidthsIn.reduce<number[]>((acc, w) => [...acc, acc[acc.length - 1]! + w], [g.jackThicknessIn]);
              // Upper cap — same trapezoid as a plain tile, just floored at
              // the window's own RO-top (roofBaseHeightIn + g.roTopZIn)
              // instead of the true eave; clamped to >=0 so an edge the
              // window already reaches all the way up to renders flush
              // (zero-height on that side) instead of inverting.
              const capFloorIn = roofBaseHeightIn + g.roTopZIn;
              const capLeftIn = Math.max(capFloorIn, p.leftHeightIn);
              const capRightIn = Math.max(capFloorIn, p.rightHeightIn);
              const capPoints4 = [
                [xPx(p.xStartIn), yPx(capFloorIn)],
                [xPx(p.xEndIn), yPx(capFloorIn)],
                [xPx(p.xEndIn), yPx(capRightIn)],
                [xPx(p.xStartIn), yPx(capLeftIn)],
              ]
                .map(([x, y]) => `${x},${y}`)
                .join(" ");
              const capRip = computeGableRipCallout(p.widthIn, Math.min(capLeftIn, capRightIn) - capFloorIn, Math.max(capLeftIn, capRightIn) - capFloorIn);
              return (
                <g key={i} onClick={toggle} style={{ cursor: "pointer" }}>
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
                  />
                  <polygon points={capPoints4} fill={GABLE_COLOR} stroke="#3a5a8a" strokeWidth={1} />
                  <text x={xPx((p.xStartIn + p.xEndIn) / 2)} y={yPx(capFloorIn) - 6} fontSize={8} textAnchor="middle" fill="#333">
                    {capRip.angleDeg.toFixed(1)}&deg; / {capRip.lengthIn.toFixed(0)}&quot;
                  </text>
                </g>
              );
            });
          })()}

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
        {/* Pan-mode overlay (Tommy: "include the pan/zoom... pieces found
            in the plan view editor") — rendered last (on top of every
            other element), so while Pan is active it captures the drag
            instead of any of the gable/beam/panel-resize handlers above,
            with no changes needed to any of them. Absent entirely
            otherwise, so it can never intercept a click when Pan is off. */}
        {isPanning && (
          <rect
            x={0}
            y={0}
            width={svgWidthPx}
            height={svgHeightPx}
            fill="transparent"
            style={{ cursor: "grab", pointerEvents: "all" }}
            onMouseDown={(e) => {
              const el = viewportRef.current;
              panStartRef.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                scrollLeft: el?.scrollLeft ?? 0,
                scrollTop: el?.scrollTop ?? 0,
              };
              setPanDragging(true);
            }}
          />
        )}
          </svg>
        </div>
      </div>
    </div>
  );
}
