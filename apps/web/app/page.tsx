"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAdditionalRowBracedPattern,
  applyUniformPanelization,
  applyZonesToSlot,
  areWallsOppositePair,
  buildOctagonFootprint,
  allWallPanelJoints,
  isCourtyardFootprint,
  ringRoofGableBlockReason,
  removeCourtyards,
  insertCornerAtWallOffset,
  isSplitRefusal,
  splitSlotsAtJoint,
  octagonBoxOf,
  splitFootprintByChord,
  splitRefusalMessage,
  type SplitResult,
  setStraightWall,
  buildRectangleFootprint,
  collapseNearZeroWalls,
  computeFieldFramingLayout,
  computeFloorPanelGrid,
  computeFootprintAreaSqFt,
  classifyGableWindowsAgainstRunStop,
  computeGableTiledRow,
  computeInsetPerimeterRing,
  computeJoistLayout,
  footprintSpanAndRun,
  gableEndWallIdsFor,
  GABLE_COLUMN_FLAT_TOP_DROP_IN,
  GABLE_SHED_SNAP_THRESHOLD_IN,
  computePanelLoadOrder,
  computePanelsPerStack,
  computePierGrid,
  computeRidgeLine,
  computeRoofBearingSegments,
  computeSillRunWidths,
  computeTruckLoads,
  computeTrussLayout,
  computeWallVerticalBandsForSlotWithMaxHeight,
  effectiveZonesForSlot,
  partitionLongHeaders,
  dragWallBounded,
  editWallLength,
  footprintIsAllRightAngles,
  gapEndFor,
  findAbsorbedCornerWalls,
  findCornerBraceCombineRefusals,
  findSubMinimumPanelWidths,
  discardLockedWidths,
  findUnhonouredLockedWidths,
  planLockedWidthReforce,
  type LockedWidthRefusal,
  getOpeningAnchors,
  toEighths,
  insertBumpOut,
  isMiteredShape,
  isPointNearPier,
  markSafetyCorner,
  nextPanelCycleState,
  pointAlongRidgeLine,
  reconcileBracedPlacement,
  redistributeFreeRun,
  narrowestAcceptablePinWidthIn,
  resolvePanelDelete,
  shiftSlotCoverage,
  resolvePanelInsert,
  resolvePanelReplace,
  resolvePanelWidthEdit,
  reconcilePanelSlotZones,
  retile as retilePure,
  retilePreservingOpeningsWithRunStopMemory as retilePreservingOpeningsPure,
  runStopOpeningFit,
  movePanelWithinWall,
  retileWithOpenings,
  wallCompassDirection,
  wallDisplayLabelWithId,
  wallDisplayLabelsByWallId,
  wallGeometryFor as wallGeometryForPure,
  resizeWallRun,
  applyRulePlacedParts,
  runChangeEndFromInsets,
  applySafetyGapSpacing,
  safetyGapWidthForRunIn,
  TILER_MIN_PANEL_WIDTH_IN,
  applyRunStopChange,
  tidyUnbuildableLeftovers,
  withheldOpeningCount,
  stoppedSlotsRestoreFidelity,
  type StoppedSlots,
  wallGrowthEnd,
  hasWallRunStop,
  normalizeWallRunStop,
  NO_WALL_RUN_STOP,
  builtWallLengthsIn,
  totalBuiltWallPerimeterIn as totalBuiltWallPerimeterInPure,
  isSlotBoxBeamCovered,
  zoneFromSlot,
  defaultSpanningHeaderBottomHeightIn,
  resolveSpanningHeaderPlacement,
  spanningHeaderCoveredSlotCount,
  spanningHeaderOpeningConflicts,
  spanningHeaderSpanOutOfRange,
  spanningHeaderSpanWidthIn,
  type SpanningHeaderPlacementResult,
  type MidWallBeamGeometry,
  type BoxBeamCoverage,
  type CornerId,
  type Footprint,
  type PanelGroup,
  type PanelPlacementResult,
  type PanelSlot,
  type PanelSlotZone,
  type PlaceablePanelType,
  type PlacementPanel,
  type GableWindowReservation,
  type OpeningSeed,
  type RetileWithRunStopMemoryResult,
  type RunStopOpeningMemory,
  type RoofBearingAnchorMode,
  type RoofProfilePoint,
  type Story,
  type TruckDims,
  type TrussDoublingStrategy,
  type Wall,
  type WallEnd,
  type WallRunStop,
} from "@building-integrity/geometry";
import {
  computeAssemblyPerm,
  computeBoardFeetByNominalSize,
  computeBracedPanelShearCapacityLb,
  computeBuiltUpColumnBearingCapacityLb,
  computeCarbonRange,
  computeCO2eEquivalencies,
  computeConcretePierVolume,
  computeFastenerWeight,
  computeInsulationWeight,
  computeJackStudFastenerWeight,
  computeMembraneCoverage,
  computeMemberSetWoodWeight,
  computeNetEmbodiedCarbonCO2e,
  computePanelWeightBreakdown,
  computePlasterLaborCost,
  computePlasterLaborHours,
  computePrice,
  computeSillTapeLengthFt,
  computeStandardPanelStrawVolume,
  computeStrawWeight,
  computeStudPackBearingCapacityLb,
  formatLengthIn,
  MM_PER_IN,
  toReviewLog,
  validateVaporOpenness,
  type PanelWeightBreakdown,
  type Season,
} from "@building-integrity/calc-engine";
import {
  bomWidthMismatchWarning,
  bracedPanelDisplayLabel,
  bracingStyleToPatternMirror,
  patternMirrorToBracingStyle,
  BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN,
  BALE_FOUNDATION_FIELD_SPACING_OPTIONS_IN,
  BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN,
  BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_GAP_DEFAULT_IN,
  SUBFLOOR_DEPTH_DEFAULT_IN,
  baleFoundationRingPlan,
  baleFoundationTopFaceZIn,
  buildDoubledStackPair,
  buildFramingStackMembers,
  steelMeshPriceDefaults,
  type BaleFoundationFieldSpacingIn,
  BOX_BEAM_SIZE_DEFAULT,
  BOX_BEAM_SIZE_OPTIONS,
  buildBoxBeamMembers,
  buildBigHeaderBeamMembers,
  buildBigHeaderMembers,
  buildBracedPanelMembers,
  buildColumnPanelMembers,
  buildCornerPanelMembers,
  buildDoorHeaderMembers,
  buildGablePanelMembers,
  buildJackStudMembers,
  buildSafetyGapMembers,
  buildSquareBaleCornerPanelMembers,
  buildSquareBalePanelMembers,
  buildSillPanelMembers,
  buildStandardPanelMembers,
  buildTrussPlateMembers,
  buildVerticalGapFillerMembers,
  buildWindowHeaderMembers,
  computeDoorRoughOpeningHeightIn,
  computeHeaderHeightIn,
  computeRoughOpeningWidthIn,
  doorRoughOpeningSelectedHeightIn,
  jackStudThicknessIn,
  JACK_STUD_THICKNESS_IN,
  safetyGapSheetThicknessIn,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  carbonFractionOfDryMass,
  COLUMN_TOTAL_WIDTH_IN,
  bigHeaderWidthInRange,
  bigHeaderHeightInRange,
  bigHeaderDefaultWidthIn,
  bigHeaderDefaultHeightIn,
  computeBoxBeamAssemblyHeightIn,
  computeBoxBeamHeightDeltaIn,
  computeDensePackCelluloseVolume,
  computePlywoodAreaSqFt,
  computeRoofBearingAssemblyHeightIn,
  computeRoofCatcherBeamPostPositions,
  computeRoofCatcherBeamSegments,
  computeSharedRooflineBearingHeightIn,
  computeTimberHpVolume,
  DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN,
  GABLE_PANEL_MAX_HEIGHT_IN,
  OCTAGON_RING_DIAMETER_OPTIONS_FT,
  PLYWOOD_SHEET_AREA_SQFT,
  concreteEmbodiedCarbonKgPerFt3,
  concretePierDimensions,
  cornerPanelWidthIn,
  densePackCelluloseDensityLbFt3,
  fastenerSpacingTable,
  fastenerTableStatus,
  FIELD_JOIST_DEPTH_REDUCTION_IN,
  floorAddOnLayerLayers,
  floorAssemblyLayers,
  floorCornerCavityDetail,
  floorFieldBayDetail,
  floorInsulationSequencingRule,
  floorJoistTypes,
  bearingEdgeReferenceOptions,
  CLASSIC_TRUSS_DISCLAIMER,
  CLASSIC_TRUSS_TYPES,
  buildEnergyHeelTrussSchema,
  buildParallelChordTrussSchema,
  HIGH_PERF_TRUSS_BEARING_SHAPES,
  HIGH_PERF_TRUSS_CAVITY_DEPTH_OPTIONS_IN,
  ROOF_TRUSS_SPACING_DEFAULT_IN,
  ROOF_TRUSS_SPACING_OPTIONS_IN,
  floorLongSideBlockingNote,
  floorRimJoistDetail,
  foundationFastenerSchedule,
  foundationTypes,
  gableHeelHeightDefaultIn,
  headerSillDunnageGapIn,
  groundScrewProducts,
  groundScrewProductsStatus,
  looseDensePackDefaultThicknessIn,
  looseDensePackThicknessOptionsIn,
  looseDensePackWidthIn,
  panelHeightInRange,
  panelTypes,
  fabricationMinPanelWidthIn,
  panelWidthInRange,
  perpendicular2x4Addition,
  pierSpacingDefaultFt,
  pierSpacingOptionsFt,
  pierSpacingStatus,
  plasterCoatThicknessInDefaults,
  plasterLaborRatesRef,
  plasterMixPartsDefaults,
  plasterPriceDefaults,
  priceRates,
  referenceDensities,
  roofCatcherBeamShapeDefault,
  roofCatcherBeamShapeOptions,
  roofBearingMemberNote,
  roofSystemTypes,
  slabFoundationDimensions,
  squareBalePanel,
  bracedWallLineSpacingFt,
  bracedWallLineSpacingStatus,
  seismicBracedPanelSpacingFt,
  sillDefaultHeightIn,
  sillHeaderHeightInRange,
  toeUpHeightIn,
  shippingRatePerMileDefault,
  shippingStackBufferIn,
  standardPanelBomReferenceWidthIn,
  standardPanelHeightIn,
  standardWindowHeightDefaultIn,
  standardWindowHeightsIn,
  standardWindowWidthsIn,
  strawMoistureContent,
  targetDensityKgM3,
  timberHpDensityLbFt3,
  truckBedTypes,
  trussPlateInsetDefaultIn,
  wallAssemblyLayers,
  windowHeaderWidthInRange,
  type BoxBeamSizeId,
  type BracePattern,
  type BracingStyle,
  type ClassicTrussTypeId,
  type HighPerfTrussBearingShapeId,
  type HighPerfTrussCavityDepthIn,
  type HighPerfTrussTypeId,
  type JackStudConfig,
  type OctagonRingDiameterFt,
  type PanelMember,
  type PanelStructuralStatus,
  planFloorRoofPanelRun,
  decideRoofForm,
  FLOOR_ROOF_MIN_PANEL_WIDTH_IN,
  type RoofCatcherBeamShape,
  type RoofSystemType,
  type RoofTrussSpacingIn,
  type SeismicZone,
  type StudConfig,
  type WallAssemblyLayer,
} from "@building-integrity/panel-catalog";
import { formatFeetInches } from "./canvasGeometry";
import LengthInput from "./LengthInput";
import SlotIndexInput from "./SlotIndexInput";
import ConcreteBlockStemWallDiagram from "./ConcreteBlockStemWallDiagram";
import DetailGuidePage from "./DetailGuidePage";
import FloorAddOnLayerDiagram from "./FloorAddOnLayerDiagram";
import FloorAssemblyDiagram from "./FloorAssemblyDiagram";
import FloorCanvas from "./FloorCanvas";
import FloorCornerDetailDiagram from "./FloorCornerDetailDiagram";
import BaleFoundationCrossSectionDiagram from "./BaleFoundationCrossSectionDiagram";
import FloorJoistDiagram from "./FloorJoistDiagram";
import FoundationCanvas from "./FoundationCanvas";
import { allPanelInstances, type NamedPanelType, type PanelInstance } from "./panelInstances";
import {
  TILING_BASIS_CONTROL_LABELS,
  pendingTilingControls,
  pendingTilingSummary,
  tilingBasisDifferences,
  type TilingBasis,
} from "./tilingBasis";
import PendingRetileMark from "./PendingRetileMark";
import { repanelizeConfirmation, repanelizeWallConfirmation, wallsThatWouldChange } from "./repanelize";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  emptyUndoHistory,
  pushUndoEntry,
  redoTo,
  sameDocument,
  undoTo,
  type UndoHistory,
} from "./undoHistory";
import { PLYWOOD_HALF_ROW_LABEL, PLYWOOD_THREE_QUARTER_ROW_LABEL } from "./plywoodRowLabels";
import { resolveBracedStyle } from "./bracedStyle";
import { shouldAutoUpgradeToBigHeader } from "./bigHeaderAutoUpgrade";
import { capGableTileHeights, computeRiseFtForPitch, resolveGableProfilePoints, resolveHeelSeat, ROOF_PITCH_OPTIONS_IN12 } from "./gableProfilePoints";
import {
  BIG_HEADER_BEAM_MIN_HEIGHT_IN,
  MID_WALL_BEAM_HEADER_SNAP_THRESHOLD_IN,
  MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN,
  midWallBeamsToGeometry,
  resolveMidWallBeamAssemblyHeightIn,
  type MidWallBeam,
  type MidWallBeamKind,
} from "./midWallBeam";
import {
  resolveSpanningHeaderHeightIn,
  resolveSpanningHeaders,
  spannedPanelNames,
  spanningHeaderSheetLocation,
  spanningHeadersToGeometry,
  SPANNING_HEADER_LIMITS_IN,
  wallBandGeometry,
  type SpanningHeader,
} from "./spanningHeader";
import { pinnedSlotIndexWallIds } from "./pinnedSlotIndexWalls";
import { spanningHeaderCommitNotice, spanningHeaderRefusalNotice, spanningHeaderRunStopRefusal } from "./spanningHeaderNotice";
import type { WallReviewNote } from "./wallReviewNotes";
import PierFoundationDiagram from "./PierFoundationDiagram";
import PlasterCoatEditor from "./PlasterCoatEditor";
import {
  computePlasterCoatResult,
  type PlasterCoat,
  type PlasterCoatInputs,
  type PlasterInputsState,
  type PlasterSide,
} from "./plasterTypes";
import { parseProjectFile, serializeProject, type ProjectState } from "./projectFile";
import { isLastEnabledScopeBranch, LAST_SCOPE_BRANCH_TITLE, type ScopeOfWork } from "./editorTabs";
import { resolveTitleBlockDate, titleBlockDateLabel } from "./titleBlockDate";
import { useDocumentSession } from "./cloud/useDocumentSession";
import { useCloudProjects } from "./cloud/useCloudProjects";
import RubbleTrenchDiagram from "./RubbleTrenchDiagram";
import ShopDrawingPage from "./ShopDrawingPage";
import PlanViewPage from "./PlanViewPage";
import PanelFabricationPage from "./PanelFabricationPage";
import BuildingSummaryRender from "./BuildingSummaryRender";
import CompassWidget from "./CompassWidget";
import PageFeaturesButton from "./PageFeaturesButton";
import {
  BugIcon,
  ReadMeIcon,
  ReviewLogIcon,
  SidebarIconButton,
  SidebarIconCluster,
} from "./SidebarIconCluster";
import ReadMeContent from "./read-me/ReadMeContent";
import ReportBugContent from "./report-bug/ReportBugContent";
import { currentViewLabel, isViewStopLive } from "./viewLabels";
import { DocumentMetaProvider } from "./DocumentMetaContext";
import { BrowseModeProvider } from "./BrowseModeContext";
import { PRICE_GAP, PRICE_REDACTED_NOTE, VIEWER_OWN_DEFAULTS_NOTE } from "./cloud/browseDisplay";
import DrawingToolPen, { type ShapeTool as DrawingToolPenShapeTool } from "./DrawingToolPen";
import OctagonSizePanel from "./OctagonSizePanel";
import DrawWallChooser from "./DrawWallChooser";
import CourtyardPanel from "./CourtyardPanel";
import OctagonRingPreview from "./OctagonRingPreview";
import RoofTrussLayoutView from "./RoofTrussLayoutView";
import PanelLegend from "./PanelLegend";
import { PANEL_TYPE_LABELS } from "./panelColors";
import ProjectSummaryPage from "./ProjectSummaryPage";
import { SectionSurfaceProvider, type SectionSurfaceValue } from "./SectionSurfaceContext";
import { hostSurfaceForSection, unreachableSections } from "./sectionSurfaces";
import SlabFoundationDiagram from "./SlabFoundationDiagram";
import StickyNote from "./StickyNote";
import TopBar from "./TopBar";
import AppFooter from "./AppFooter";
import type { ViewerStop } from "./viewerMenus";
import WindowSizeDiagram from "./WindowSizeDiagram";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import WallElevationDiagram from "./WallElevationDiagram";
import styles from "./page.module.css";
import elevationStyles from "./ElevationControls.module.css";
import { tilerWouldChangeThePanelCount } from "./handPlacedWallRetile";
import { pruneOpeningMemoryToLiveWalls, type OpeningMemoryByStoryAndWallId } from "./runStopOpeningMemory";
import {
  lockedWidthEditRefusalSentence,
  unhonouredLockedWidthReviewNote,
  unhonouredLockedWidthSentence,
} from "./lockedWidthNotices";
import {
  runStopFitRefusalSentence,
  withheldOpeningTotal,
  withheldOpeningsElevationClause,
  withheldOpeningsReviewNote,
  type WithheldOpeningsOnStory,
} from "./runStopNotices";
import {
  placementCommitNotice,
  placementRefusalNotice,
  placementRefusalSentence,
  type PlacementOp,
  type SpanningHeaderWidthChange,
} from "./placementNotice";
import { preChangeTilingReviewNote, type StoredWallRun } from "./preChangeTilingNotice";
import {
  findSquareBaleBandWalls,
  findSquareBaleMergedCornerWalls,
  findSquareBaleMergedCorners,
  squareBaleMergedCornerNote,
  squareBalePanelizationRefusalMessage,
  squareBaleRefusalWallFacts,
} from "./squareBaleCornerRefusal";

const FootprintCanvas = dynamic(() => import("./FootprintCanvas"), { ssr: false });
const Building3DView = dynamic(() => import("./Building3DView"), { ssr: false });
const StandardPanel3DView = dynamic(() => import("./StandardPanel3DView"), { ssr: false });
const TruckLoad3DView = dynamic(() => import("./TruckLoad3DView"), { ssr: false });

const BEARING_ELIGIBLE_TYPES = new Set(["standard", "corner", "safety-oct-corner", "braced", "column"]);
// Every real wall panel type, straw-filled or not (Safety/Gap included —
// it's a real plywood wall panel, just with no straw cavity, see
// strawSlots' own exclusion of it below).
const WALL_PANEL_SLOT_TYPES = new Set(["corner", "safety-oct-corner", "standard", "safety-gap", "braced", "column"]);
/** ⚠ His default, 2026-10-26: a real pitch, replacing a 16ft default RISE
 * that was never chosen as one — it was picked so the ridge always sat
 * above the eave, and only became a 24:12 roof once gables auto-spawned. */
const DEFAULT_ROOF_PITCH_IN12 = 4;

const STRAW_BALE_WEIGHT_LB = 40;
const KG_TO_LB = 2.20462;
const LB_FT3_TO_KG_M3 = 16.018463;
const FT3_TO_M3 = 0.0283168;

const ROOF_BEARING_STRUCTURAL_STATUS: PanelStructuralStatus = {
  status: "pending-BI-confirmation",
  note: "Not yet modeled — pending Building Integrity engineering review.",
};

// "both" is for accessory products (Exto Seal, Tescon Vana) that aren't
// inherently one-sided — they show up in both checkbox lists.
const interiorLayers = wallAssemblyLayers.filter((l) => l.side === "interior" || l.side === "both");
const exteriorLayers = wallAssemblyLayers.filter((l) => l.side === "exterior" || l.side === "both");

// Fed to computeAssemblyPerm/validateVaporOpenness (unchanged) when nothing
// rated is checked on a side — its null perms make them report "not
// computable," identical to today's behavior for a lone unrated layer.
const UNRATED_SENTINEL: WallAssemblyLayer = {
  id: "none",
  side: "interior",
  label: "(none checked)",
  permWinter: null,
  permSummer: null,
  status: "pending-BI-confirmation",
  note: "No rated product checked on this side.",
};

/** Tommy: "when multiple interior (or exterior) items are checked... the
 * perm-rating math uses whichever checked item is most vapor-restrictive"
 * — the real vapor control layer in a physical assembly is whichever
 * layer is hardest to pass through, not a sum of everything present. */
function mostRestrictiveLayer(layers: WallAssemblyLayer[], checkedIds: Set<string>, season: Season): WallAssemblyLayer | null {
  const rated = layers.filter((l) => checkedIds.has(l.id) && (season === "winter" ? l.permWinter : l.permSummer) !== null);
  if (rated.length === 0) return null;
  const permOf = (l: WallAssemblyLayer) => (season === "winter" ? l.permWinter! : l.permSummer!);
  return rated.reduce((most, l) => (permOf(l) < permOf(most) ? l : most));
}

/** A trailer's own length runs tens of feet — too long for the plain
 * inch-fraction convention (formatLengthIn) to read naturally, so imperial
 * uses the feet-inches form (`48'-0"`); metric still always shows mm
 * (Tommy: "for metric, make to the nearest mm").
 *
 * This used to print decimal feet (`48.0ft`), which made it the app's one
 * long-length outlier — the same trailer read one way here and another way
 * on the footprint canvas. Tommy settled it on 2026-08-30: long lengths are
 * feet-inches-eighths everywhere, this site named explicitly. */
function formatTrailerLengthIn(valueIn: number, unitSystem: "imperial" | "metric"): string {
  return unitSystem === "metric" ? formatLengthIn(valueIn, unitSystem) : formatFeetInches(valueIn / 12);
}

const PHASE2_ASSUMPTIONS = [
  {
    label: "Safety/gap panel pricing",
    status: "pending-BI-confirmation" as const,
    note: "No distinct price rate given for safety/gap panels — priced at the standard rate ($28/sqft) as a placeholder.",
  },
  {
    label: "Header/sill panel area",
    status: "pending-BI-confirmation" as const,
    note: "Header/sill pricing uses the opening's width x full wall height (same area convention as every other panel type) — real header/sill components are shorter than a full wall panel, but their actual dimensions aren't specified yet.",
  },
  {
    label: "Gable End Panel pricing",
    status: "pending-BI-confirmation" as const,
    note: "Gable End Panels are priced at the roof rate ($42/sqft placeholder) using the trapezoid's own average height above the eave; a tile's vertical safety-gap filler is priced at the standard rate instead, since it's the exact same member a wall-level safety-gap panel uses.",
  },
  {
    label: "Box Beam/Truss Plate/Mid-Wall Bond Beam pricing",
    status: "pending-BI-confirmation" as const,
    note: "These are linear members, not flat wall panels, so there's no real width x wall-height face to price — priced at the roof rate ($42/sqft placeholder) using each piece's own covered length x its own assembly's cross-sectional height as a stand-in face area.",
  },
  {
    label: "Mid-Wall Bond Beam \"Web Braced Lintel\" renamed to \"Big Header (Mid-Wall Beam)\"",
    status: "pending-BI-confirmation" as const,
    note: "Pure terminology rename (kind: \"web-braced-lintel\" -> \"big-header-beam\") to avoid clashing with the new opening-spanning Big Header panel type — no geometry or behavior change. Existing saved projects are remapped on load.",
  },
  {
    label: "Big Header structural estimating",
    status: "pending-BI-confirmation" as const,
    note: "Geometry only (rotated-stud chords + multi-peak W-truss brace + 2 jack studs, per Tommy's own spec) — no fastener schedule or real load/shear estimate exists yet for this assembly, unlike the bearing/shear placeholders already computed for Standard/Braced panels above.",
  },
  {
    label: "Big Header Shop Drawing / Material Totals pricing not yet wired",
    status: "pending-BI-confirmation" as const,
    note: "A Big Header panel renders correctly in the 2D elevation and live 3D view and is fully editable (width/height/sill) from its own Selected Panel note, but doesn't yet have its own Panel Fabrication/Shop Drawing detail page or a Material Totals price rate the way Column/Standard/Braced panels do — flagged for a follow-up pass.",
  },
];

/**
 * Catalog dimensions that MOVED on Building Integrity's own authority.
 *
 * These are not pending values — they are `confirmed`, and `toReviewLog`
 * correctly filters `confirmed` entries out. They are here anyway, appended
 * after that filter rather than mislabelled as pending, because a reviewer
 * needs to be told when a sourced number was superseded. A dimension that
 * changes because a shop said so is exactly the thing a reviewer should see,
 * and a ⅜in move is small enough to be mistaken for a rounding if nobody
 * says otherwise.
 *
 * Add to this list only when a real building value is deliberately changed;
 * it is not a changelog for the app.
 */
const CATALOG_SUPERSESSIONS = [
  {
    label: "Sill panel minimum width moved to 24in (Building Integrity, superseding the manufacturer)",
    status: "confirmed" as const,
    note:
      "sillMinWidthIn read 23.625in — the mfr spec sheet's 600mm (23.622in) at the app's nearest-1/8in convention — until 2026-09-24. " +
      "Tommy: \"I can't make any panels that are left to right elevation view shorter than 2'\", and asked directly whether that rule also " +
      "governs sills, he answered yes. A sill is a short Standard Panel, so it takes the same 24in shop minimum. NOT a rounding: the " +
      "manufacturer's figure is still recorded in the catalog note it superseded, and this line is here so the change is seen rather than absorbed.",
  },
];

/* ⚠ IMPORTED, not redeclared. This file carried its own copy of the union
   until 2026-10-21, and the two drifted the moment `draw-wall` was added to
   one of them — tsc caught it, which is the only reason it was a minute's
   work rather than a puzzle. `DrawingToolPen` owns the list because it owns
   the buttons. */
type ShapeTool = DrawingToolPenShapeTool;
type PanelizationType = "loose-packed-braced" | "square-bale-panels" | "timber-frame-curtain";

// Every wall panel type with real member geometry gets a Shop Drawing page
// (Tommy also wants floor/roof panels covered, but floor/roof paneling
// itself doesn't exist yet — see the "not yet in the layout system" note
// below). Corner's safety-oct-corner variant shares the "corner" page (same
// fabrication, priced identically elsewhere already). Header and sill are
// derived from window/door slots (see panelInstances.ts) — a window is a
// header + sill, a door is a header only, not their own PanelSlot type.
// Gable is the same idea — no PanelSlotType exists for it either, but
// allPanelInstances' own gableTilesByWallId parameter produces real "gable"
// instances directly from each gable wall's tiled row (see page.tsx's
// gableTilesByWallId memo), so it flows through this same real-instance
// pipeline like every other type below.
const SHOP_DRAWING_PANEL_TYPES: {
  namedTypes: NamedPanelType[];
  panelTypeId: "standard" | "corner" | "braced" | "safety-gap" | "header" | "sill" | "column" | "gable" | "jack-stud";
}[] = [
  { namedTypes: ["standard"], panelTypeId: "standard" },
  { namedTypes: ["corner", "safety-oct-corner"], panelTypeId: "corner" },
  { namedTypes: ["braced"], panelTypeId: "braced" },
  { namedTypes: ["safety-gap"], panelTypeId: "safety-gap" },
  { namedTypes: ["header"], panelTypeId: "header" },
  { namedTypes: ["sill"], panelTypeId: "sill" },
  { namedTypes: ["column"], panelTypeId: "column" },
  { namedTypes: ["gable"], panelTypeId: "gable" },
  // Plywood Jack Stud is always derived from a header/sill opening, never
  // its own placed slot — namedTypes: [] since it has no PanelInstance
  // identity of its own (unlike gable, which now does).
  { namedTypes: [], panelTypeId: "jack-stud" },
];

/**
 * Smearforn Stage 2's left-bar roster — the click-through cycle's own
 * types, with a braced panel's four styles spelled out as four buttons
 * (Tommy: "I want to be able to include each panel style for braced panels
 * in the click-through cycle for panel type selections").
 *
 * **Corner and Safety Gap are not on it, on purpose.** Both are placed by
 * rules — corner ownership and the gap-end/second-to-last-panel rule — and
 * a hand-placed one would be overwritten by the systems that own them. The
 * roster itself is `PLACEABLE_PANEL_TYPES` in packages/geometry, where a
 * test asserts it against `nextPanelCycleState`'s own reachable set so the
 * two cannot drift apart.
 */
const PANEL_PLACEMENT_TOOL_OPTIONS: {
  key: string;
  label: string;
  title: string;
  type: PlaceablePanelType;
  bracedPattern?: BracePattern;
  bracedMirrored?: boolean;
}[] = [
  { key: "standard", label: "Standard", title: "A plain Standard Panel, born at the project's Standard width.", type: "standard" },
  {
    key: "braced-chevron",
    label: 'Braced "<"',
    title: "A Braced Panel, chevron pattern, born at the project's Standard width.",
    type: "braced",
    bracedPattern: "chevron",
    bracedMirrored: false,
  },
  {
    key: "braced-chevron-mirrored",
    label: 'Braced ">"',
    title: "A Braced Panel, mirrored chevron.",
    type: "braced",
    bracedPattern: "chevron",
    bracedMirrored: true,
  },
  {
    key: "braced-hatch",
    label: 'Braced "/"',
    title: "A Braced Panel, hatch pattern.",
    type: "braced",
    bracedPattern: "hatch",
    bracedMirrored: false,
  },
  {
    key: "braced-hatch-mirrored",
    label: 'Braced "\\"',
    title: "A Braced Panel, mirrored hatch.",
    type: "braced",
    bracedPattern: "hatch",
    bracedMirrored: true,
  },
  { key: "window", label: "Window", title: "A window opening, born at the project's Standard width.", type: "window" },
  { key: "door", label: "Door", title: "A door opening, born at the project's Standard width.", type: "door" },
  { key: "column", label: "Column", title: "A Column Panel — always fabricated at its own fixed width.", type: "column" },
  {
    key: "big-header",
    label: "Big Header",
    title: "A Big Header, born at its own catalog default width and height.",
    type: "big-header",
  },
];

type EditorTab = "wall" | "foundation" | "floor" | "roof";

export default function LayoutEditor() {
  // Which building system is being laid out — wall/foundation/floor/roof
  // are all views onto the same shared footprint/panel state below, so
  // switching tabs never resets anything (Tommy). Floor intakes most of
  // its prompts from Foundation (same footprint + pier spacing, no
  // independent control of its own). Roof has no editor yet (future work).
  const [editorTab, setEditorTab] = useState<EditorTab>("wall");
  /** U4 — which surface fills the editor's canvas column.
   *
   * ⚠ **Local state, deliberately not in `ProjectState`** — unlike
   * `editorTab` directly above, which IS a saved field. Two reasons, and
   * both are about not surprising the user: saving it would mean loading a
   * project drops you on the Summary page instead of your drawing, and undo
   * must never undo *which page you are looking at*. Keeping it out of the
   * document means `undoHistory` cannot see it at all, which beats
   * classifying it `transient` and trusting the classification to hold. */
  const [editorSurface, setEditorSurface] = useState<"drawing" | "summary" | "print">("drawing");
  /** The Summary page's host element, held as state rather than a ref so
   * that the sections portalling into it re-render the moment it exists.
   * A `useRef` would be filled during the same commit and read on a render
   * that never happens, and the page would come up empty until something
   * else moved. */
  const [summaryHostEl, setSummaryHostEl] = useState<HTMLDivElement | null>(null);
  const [printHostEl, setPrintHostEl] = useState<HTMLDivElement | null>(null);
  /** Clicking an edit tab comes BACK to the drawing — the 2026-09-26 plan
   * §13: *"clicking any of them returns you to the drawing. Not a modal
   * mode."* One action sets both, so there is no frame in which the tab has
   * changed but the surface has not. */
  const handleEditorTabChange = (tab: EditorTab) => {
    setEditorSurface("drawing");
    setEditorTab(tab);
  };
  const [viewMode, setViewMode] = useState<"plan" | "3d">("plan");
  // Tommy: "lets simplify (and have this be an option for the 3D view
  // somewhere) for panels to appear as their respective color and just
  // appear as the primary 3D shapes that they are" — off by default (full
  // member detail), since the Shipping page's own truck-load 3D views
  // always render this way regardless of this toggle.
  const [simplified3D, setSimplified3D] = useState(false);
  // 3D Wraps view (Tommy: "3d model selected after box mode and is
  // everything box mode is with a few changes: panels not labeled, and
  // the 3D models of the wraps appear") — always implies simplified3D too
  // (same box geometry), see handleViewerStopChange below. Ephemeral UI
  // view-state, same category as viewMode/simplified3D — not persisted in
  // ProjectState.
  const [showWraps, setShowWraps] = useState(false);
  /* Which decks the 3D viewer draws. Default ON so that checking Floors or
     Roof in the scope of work actually shows you something — Tommy: "If the
     floors and roof are check marked, the 3D viewer framed/boxes/membrane
     should show them". The scope checkbox is the outer gate; these are the
     per-layer toggles beside the viewer. */
  const [showFloorDeck3D, setShowFloorDeck3D] = useState(true);
  const [showRoofDeck3D, setShowRoofDeck3D] = useState(true);
  /* ⚠ Half the roof is see-through by default, so a new project shows the
     inside of the building rather than a lid.

     Tommy, 2026-10-26: *"east default is transparent or south if n/s>e/w"*.
     Only one of those can ever apply, because the two planes a roof has
     depend on which way its ridge runs: a wide building's planes face N and
     S, a tall one's face E and W. So the rule is read as "whichever of this
     roof's own two planes faces east or south" — east when it exists, south
     otherwise — which honours both halves of his sentence in the only way
     the geometry allows. */
  const [showRoofDeck3DSolid, setShowRoofDeck3DSolid] = useState(false);
  /* ⚠ A gable end means a pitched roof, and the deck can only be placed
     FLAT so far — drawn on a gabled building it runs straight through the
     gable panels, which Tommy saw immediately and which is exactly the
     overlap the app is not allowed to have. So it is withheld there, with
     the sidebar saying why, rather than drawn wrong. */
  // The 3D viewer's own, deliberately smaller tool vocabulary (Tommy: "build
  // the 3d viewer into an editor with all the same tools as the 2d plan
  // editor" — Phase 1 ships Edit-cycle parity + the Sill & Header drag
  // tool; draw/bump-out/drag-wall are a later phase) — see Building3DView's
  // `tool3D` prop doc comment.
  const [tool3D, setTool3D] = useState<"orbit" | "edit" | "sill-header">("orbit");
  const [shapeTool, setShapeTool] = useState<ShapeTool>("rectangle");
  const [footprint, setFootprint] = useState<Footprint | null>(null);
  // Whether the current footprint has had a bump-out added since it was
  // last drawn from scratch — a bump-out'd shape has more free parameters
  // than "2 numbers regenerate the whole footprint", so per-wall length
  // editing is out of scope for it (see isWallLengthEditable below).
  const [isBumpedOut, setIsBumpedOut] = useState(false);
  // Which corner ids are "original" (present before any bump-out) vs
  // introduced by one — drives both which corners get a least-accessible
  // dot and which wall wins a reflex (inside) corner. Remapped through each
  // bump-out's renumbering by insertBumpOut itself.
  const [primaryCornerIds, setPrimaryCornerIds] = useState<Set<string>>(new Set());
  const [offsetPx, setOffsetPx] = useState({ x: 60, y: 60 });
  const [baseWallSlots, setBaseWallSlots] = useState<Record<string, PanelSlot[]>>({});
  const [leastAccessibleCorner, setLeastAccessibleCorner] = useState<CornerId>("A");
  /** REPANELIZE R0 — the settings the CURRENT tiling was produced under,
   * so a setting changed since then can be shown as pending rather than
   * silently doing nothing. See `tilingBasis.ts`. Null until this project
   * has been tiled at least once, and null on every file saved before R0;
   * null claims nothing rather than claiming everything. */
  const [tilingBasis, setTilingBasis] = useState<TilingBasis | null>(null);

  const [standardWidthIn, setStandardWidthIn] = useState(looseDensePackWidthIn.value);
  const [thicknessIn, setThicknessIn] = useState(looseDensePackDefaultThicknessIn.value);
  const [densityLbFt3, setDensityLbFt3] = useState(
    Math.round((targetDensityKgM3.value / LB_FT3_TO_KG_M3) * 10) / 10,
  );
  const [wallHeightFt, setWallHeightFt] = useState(standardPanelHeightIn.value / 12);
  // Max panel height (Tommy: "panels should have a default max height of
  // 10'... so when a user selects for a wall taller than the selected max
  // height, lets say 16' for example, it spawns a 10' panel and a 6'
  // panel") — a wall column taller than this auto-splits into stacked
  // zones (packages/geometry/src/wallVerticalBands.ts's own
  // subdivideBandForMaxHeight), independent of any Mid-Wall Bond Beam.
  const [maxPanelHeightIn, setMaxPanelHeightIn] = useState(standardPanelHeightIn.value);
  const [includeNailer, setIncludeNailer] = useState(false);
  // Square Bale Panel-only controls (Tommy: nailer "slide" along the wythe
  // + "double 2x4 studs, or double 2x6 studs" — see buildNailer/
  // buildSquareBalePanelMembers doc comments for how each is modeled).
  const [nailerOffsetIn, setNailerOffsetIn] = useState(0);
  const [squareBaleStudConfig, setSquareBaleStudConfig] = useState<StudConfig>("single-2x4");
  // Which diagonal-brace pattern every "braced"-typed slot uses project-wide
  // (Tommy: "add another bracing option... Hatch Forward, and Hatch Back...
  // we need all braced panel types to both be on the toggle cycle") — no new
  // PanelSlotType, just which geometry buildBracedPanelMembers builds.
  const [bracingStyle, setBracingStyle] = useState<BracingStyle>("chevron");
  // Tommy: "RO's depend on jack studs, which i want to be able to change
  // from a default of 3/4in plywood to vertical 2x4's" — default matches
  // the original single-sheet jack stud behavior.
  const [jackStudConfig, setJackStudConfig] = useState<JackStudConfig>("plywood");
  const [checkedInteriorIds, setCheckedInteriorIds] = useState<Set<string>>(new Set([interiorLayers[1]!.id]));
  const [checkedExteriorIds, setCheckedExteriorIds] = useState<Set<string>>(new Set([exteriorLayers[1]!.id]));
  const [season, setSeason] = useState<Season>("winter");

  const [seismicZone, setSeismicZone] = useState<SeismicZone>("moderate");
  const [foundationTypeId, setFoundationTypeId] = useState(foundationTypes[0]!.id);
  const [pierSpacingFt, setPierSpacingFt] = useState<number>(pierSpacingDefaultFt);
  // Real ground-screw product selection (Tommy: "pick the top 3 options...
  // include them as sub objects with their relative specs") — only shown/
  // relevant when foundationTypeId === "ground-screw"; doesn't affect any
  // calculation yet (loadCapacity display only), same as the generic
  // groundScrewLoadPath figure it supplements.
  const [selectedGroundScrewProductId, setSelectedGroundScrewProductId] = useState(groundScrewProducts[0]!.id);
  const [zipCode, setZipCode] = useState("");
  // Title-block metadata (Tommy: "title block stuff on the right side...
  // project, site, date, etc.") — projectName is the only genuinely new
  // input; site label and date are derived from state that already exists.
  const [projectName, setProjectName] = useState("Untitled Project");
  // Shipping (Tommy: "which truck bed size are we using... how many trucks
  // will be needed... a changeable equation for how many trucks x how many
  // miles x a changeable dollars per hour that defaults at $6/mile one
  // way") — truck count itself isn't state, it's computed from the
  // stacking calculation below; only the truck TYPE, miles, and rate are
  // user inputs.
  const [selectedTruckBedId, setSelectedTruckBedId] = useState(truckBedTypes.value[0]!.id);
  const [shippingMiles, setShippingMiles] = useState(0);
  const [shippingRatePerMile, setShippingRatePerMile] = useState(shippingRatePerMileDefault.value);
  // Plaster Master (Tommy: "total materials and total price for plaster
  // options... link whether this turns on or off to the exterior or
  // interior finish options") — only relevant when interior=clay-plaster
  // and/or exterior=lime-plaster (see hasClayPlaster/hasLimePlaster
  // below). Each side gets its own independent Base Coat + Finish Coat
  // inputs (thickness + sand/clay/lime/straw mix ratio) since the two
  // sides can use different plaster types; pricing/labor-rate inputs are
  // shared (same suppliers/crew either side).
  const [plasterInputs, setPlasterInputs] = useState<PlasterInputsState>({
    interior: {
      base: { thicknessIn: plasterCoatThicknessInDefaults.base.value, parts: { ...plasterMixPartsDefaults.baseCoat.value } },
      finish: { thicknessIn: plasterCoatThicknessInDefaults.finish.value, parts: { ...plasterMixPartsDefaults.finishCoatClay.value } },
    },
    exterior: {
      base: { thicknessIn: plasterCoatThicknessInDefaults.base.value, parts: { ...plasterMixPartsDefaults.baseCoat.value } },
      finish: { thicknessIn: plasterCoatThicknessInDefaults.finish.value, parts: { ...plasterMixPartsDefaults.finishCoatLime.value } },
    },
    floorBottom: {
      base: { thicknessIn: plasterCoatThicknessInDefaults.base.value, parts: { ...plasterMixPartsDefaults.baseCoat.value } },
      finish: { thicknessIn: plasterCoatThicknessInDefaults.finish.value, parts: { ...plasterMixPartsDefaults.finishCoatClay.value } },
    },
  });
  const [plasterSandPricePerCuYd, setPlasterSandPricePerCuYd] = useState(plasterPriceDefaults.sandPricePerCuYd.value);
  const [plasterClayPricePerBag, setPlasterClayPricePerBag] = useState(plasterPriceDefaults.clayPricePerBag.value);
  const [plasterLimePricePerBag, setPlasterLimePricePerBag] = useState(plasterPriceDefaults.limePricePerBag.value);
  const [plasterStrawPricePerCuFt, setPlasterStrawPricePerCuFt] = useState(plasterPriceDefaults.strawPricePerCuFt.value);
  const [steelMeshPricePerSqFt, setSteelMeshPricePerSqFt] = useState(steelMeshPriceDefaults.pricePerSqFt.value);
  const [plasterLaborRatePerHour, setPlasterLaborRatePerHour] = useState(plasterPriceDefaults.laborRatePerHour.value);
  const [plasterFussyHoursExtra, setPlasterFussyHoursExtra] = useState(0);
  const updatePlasterCoatThickness = (side: PlasterSide, coat: PlasterCoat, thicknessIn: number) => {
    setPlasterInputs((prev) => ({ ...prev, [side]: { ...prev[side], [coat]: { ...prev[side][coat], thicknessIn } } }));
  };
  const updatePlasterCoatPart = (side: PlasterSide, coat: PlasterCoat, part: keyof PlasterCoatInputs["parts"], value: number) => {
    setPlasterInputs((prev) => ({
      ...prev,
      [side]: { ...prev[side], [coat]: { ...prev[side][coat], parts: { ...prev[side][coat].parts, [part]: value } } },
    }));
  };
  const [role, setRole] = useState<ViewerRole>("fabricator");
  // Engineer role's own per-wall attributed notes (Tommy's Engineer Lens
  // mockup: a free-text note signed "- Eng. Smith") — see
  // wallReviewNotes.ts's own doc comment for why this is separate from
  // reviewLog. draftNoteAuthor/draftNoteText hold whatever's currently
  // being typed into the "add a note" form, shared across whichever wall
  // is open (reset on submit, not persisted per-wall — the overwhelmingly
  // common case is writing one note then moving on).
  const [wallReviewNotes, setWallReviewNotes] = useState<WallReviewNote[]>([]);
  const [draftNoteAuthor, setDraftNoteAuthor] = useState("");
  const [draftNoteText, setDraftNoteText] = useState("");
  const handleAddWallReviewNote = (wallId: string) => {
    if (!draftNoteText.trim()) return;
    setWallReviewNotes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), wallId, author: draftNoteAuthor.trim() || "Unnamed", note: draftNoteText.trim() },
    ]);
    setDraftNoteAuthor("");
    setDraftNoteText("");
  };
  const handleRemoveWallReviewNote = (id: string) => {
    setWallReviewNotes((prev) => prev.filter((n) => n.id !== id));
  };
  // Fabricator/admin-only (Tommy) — shows every Detail Guide/Shop Drawing
  // page regardless of the existing "relevant to current design" filter.
  const [showAllDetailPages, setShowAllDetailPages] = useState(false);
  // Governs which dimensional-lumber standard framing members use (e.g.
  // nominal 2x sizing vs. metric equivalents) — not wired into any
  // calculation yet, but set at the very top since it'll determine sizing
  // choices added later in the app (Tommy).
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">("imperial");
  // Fabricator/admin-only markup (Tommy) — public viewers see the base
  // material cost with no markup applied, regardless of this value.
  const [priceModifier, setPriceModifier] = useState(priceRates.totalModifier);
  // Covers the suspended-joist options, the Thermally Broken Slab option,
  // and the Bale Foundation rim/field framing system — mutually exclusive,
  // so one state covers the whole button group. Bale Foundation is the
  // real default (Tommy: "the default option is the double 2x6 + 1.5in
  // gap 'bale foundation'"), unlike the other options which stay null
  // until explicitly picked ("autogenerate when the button is clicked").
  const [floorSystemId, setFloorSystemId] = useState<(typeof floorJoistTypes)[number]["id"] | "thermal-slab" | "bale-foundation" | null>(
    "bale-foundation",
  );
  const [perpendicular2x4Enabled, setPerpendicular2x4Enabled] = useState(false);
  // Bale Foundation framing (Tommy: "the top framing member, bottom
  // framing member, and gap to be ui changable... single framing members
  // span the rest of the space on a left bar selectable 16" or 24"
  // spacing") — global per-project, same as every other floor/roof
  // sizing control. Blocking spacing (every 3ft, inside the gap) is a
  // fixed constant (BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN), not in this
  // list — Tommy only named these 4 as UI-changeable.
  const [baleFoundationTopDepthIn, setBaleFoundationTopDepthIn] = useState(BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN);
  const [baleFoundationBottomDepthIn, setBaleFoundationBottomDepthIn] = useState(BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN);
  const [baleFoundationGapIn, setBaleFoundationGapIn] = useState(BALE_FOUNDATION_GAP_DEFAULT_IN);
  const [baleFoundationFieldSpacingIn, setBaleFoundationFieldSpacingIn] = useState<BaleFoundationFieldSpacingIn>(BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN);
  // Rodent/air-sealed steel + clay bottom skin (Tommy: "an option to do
  // rodent and air sealed steel clay bottom which is a default option") —
  // default ON, unlike every other Bale Foundation control above (which
  // default to their own illustrative sizing but aren't themselves an
  // on/off toggle). Only meaningful while isBaleFoundationFloor is true.
  const [floorBottomSkinEnabled, setFloorBottomSkinEnabled] = useState(true);

  // Roof is its own system (parallel to the Floor tab's joist catalog), not
  // a wall panel type — see the Roof tab below. Truss plate / box beam
  // geometry itself is flagged to model later (Tommy); these are just the
  // inset/height/offset numbers that feed the Gable End Panel + Column
  // Panel previews. roofSystemTypeId itself is declared further down,
  // derived from gableStructuralPanelWallIds (see its own doc comment).
  // The roofline gable-end panels tile up to meet (Tommy: "options for
  // peaked trusses with 1 point on the top, or two points to make a
  // triangle shaped with the top chopped off") — "peaked" has 1 real
  // profile point (a ridge, replacing the old single bottomOfTrussMaxHeightFt);
  // "flat-top" has 2, fully independent in both height and along-wall
  // position (see gableProfilePositionsInByWallId below). Global (Roof
  // tab), same as the single ridge height it replaces.
  const [roofProfileType, setRoofProfileType] = useState<"peaked" | "flat-top">("peaked");
  // Each entry is a RISE above the eave (ft), not an absolute height — see
  // ProjectState's own roofProfilePointHeightsFt doc comment. A 16ft
  // default rise always sits above the eave regardless of story count or
  // box beam choice, unlike an absolute height would.
  const [roofProfilePointHeightsFt, setRoofProfilePointHeightsFt] = useState<number[]>([16]);
  const handleChangeRoofProfileType = (type: "peaked" | "flat-top") => {
    setRoofProfileType(type);
    setRoofProfilePointHeightsFt((was) => (type === "peaked" ? [was[0] ?? 16] : was.length >= 2 ? was.slice(0, 2) : [was[0] ?? 16, was[0] ?? 16]));
  };
  const handleChangeRoofProfilePointHeightFt = useCallback((pointIndex: number, heightFt: number) => {
    setRoofProfilePointHeightsFt((was) => {
      const next = [...was];
      next[pointIndex] = heightFt;
      return next;
    });
  }, []);
  // A single Gable End Panel can't be fabricated taller than
  // GABLE_PANEL_MAX_HEIGHT_IN (packages/panel-catalog) — this is a
  // user-tunable threshold at or below that real physical ceiling; the
  // difference (if any) between it and the true truss-bottom height is
  // filled by a real vertical safety-gap tile instead of silently clamped.
  const [maxGablePanelHeightIn, setMaxGablePanelHeightIn] = useState(96);
  // Toggles the Elevation view's own draggable max-height line (Tommy: "a
  // button that you highlight and then you can drag the line down on the
  // editor") — an alternate, visual way to set the SAME maxGablePanelHeightIn
  // above; not itself persisted (ephemeral UI mode, resets on wall switch —
  // see the elevationViewWallId effect below).
  const [adjustingGableMaxHeight, setAdjustingGableMaxHeight] = useState(false);
  const [trussPlateInsetIn, setTrussPlateInsetIn] = useState(trussPlateInsetDefaultIn.value);
  // Energy-heel truss seat (Tommy: "have the truss seat be the full panel
  // width AND THEN go vertical for 6in (adjustable)") — see
  // computeGableTiledRow's own heelHeightIn doc comment for the mechanics.
  const [heelHeightIn, setHeelHeightIn] = useState(gableHeelHeightDefaultIn.value);
  // Where the gable roofline's slope actually starts lifting off (Tommy:
  // "the slope needs to be based on exactly where we expect the truss to
  // lift off at - either at the panel depth OR... the truss heel height...
  // flush with the top of the trusses or flush with the inside edge of
  // them") — see computeGableTiledRow's/resolveAnchors' own
  // RoofBearingAnchorMode doc comment for the mechanics. "truss-heel" is
  // the pre-existing default (matches every gable wall built before this
  // toggle existed, since heelHeightIn already defaults nonzero).
  const [roofBearingAnchorMode, setRoofBearingAnchorMode] = useState<RoofBearingAnchorMode>("truss-heel");
  const [roofCatcherBeamOffsetIn, setRoofCatcherBeamOffsetIn] = useState(DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN);
  const [roofCatcherBeamShape, setRoofCatcherBeamShape] = useState<RoofCatcherBeamShape>(roofCatcherBeamShapeDefault);
  // Octagon roof-catcher ring (Tommy: "for octagon roofs, lets do an octagon
  // ring made out of LVL's that are 14x1.75in") — only relevant when the
  // footprint is an octagon (8 corners, the octagon drawing tool's own
  // shape), independent of roofSystemTypeId.
  const [octagonRingDiameterFt, setOctagonRingDiameterFt] = useState<OctagonRingDiameterFt>(3);

  // Roof tab's own truss layout editor (Tommy: "i want to be able to design
  // roof panels with this... the full 'panelized' layout") — which of the 8
  // truss styles (6 classic + 2 high-performance) is driving the real
  // project's own truss layout. Classic/high-perf keep their own separate
  // id spaces (ClassicTrussTypeId vs HighPerfTrussTypeId) since each has
  // its own catalog array; roofTrussCategory just says which one is
  // currently active — a single flat button group in the sidebar sets both
  // the category and the matching id together. Unlike the old "always
  // available, independent of the project" reference-gallery framing this
  // replaced, these ARE real per-project settings now, so they round-trip
  // in ProjectFile (see roofTrussSpacingIn's own doc comment below).
  const [roofTrussCategory, setRoofTrussCategory] = useState<"classic" | "high-perf">("classic");
  const [selectedClassicTrussId, setSelectedClassicTrussId] = useState<ClassicTrussTypeId>(CLASSIC_TRUSS_TYPES[0]!.id);
  const selectedClassicTruss = CLASSIC_TRUSS_TYPES.find((t) => t.id === selectedClassicTrussId)!;

  // High-Performance Truss (Tommy: "we are designing for a high performance
  // house here... each of these trusses should be able to meet a variety of
  // different slopes, 2/12 to 12/12... have them sit on the 2x12's that are
  // up there (or 14in LVL)") — cavity-depth/bearing-shape controls, shown
  // only when roofTrussCategory is "high-perf". Pitch always comes from the
  // real resolved wall (roofTrussLayoutContext below), same as every
  // classic truss style — no separate manual pitch override.
  const [highPerfTrussTypeId, setHighPerfTrussTypeId] = useState<HighPerfTrussTypeId>("energy-heel");
  const [highPerfTrussCavityDepthIn, setHighPerfTrussCavityDepthIn] = useState<HighPerfTrussCavityDepthIn>(18);
  const [highPerfTrussBearingShapeId, setHighPerfTrussBearingShapeId] = useState<HighPerfTrussBearingShapeId>(HIGH_PERF_TRUSS_BEARING_SHAPES[0]!.id);
  // On-center truss spacing + sistering strategy (Tommy: "certain changable
  // via ui variable such as spacing and doubles at the ends, or every
  // member is a double stud") — global per-project, same as every other
  // Roof tab setting (heelHeightIn, trussPlateInsetIn, etc.), feeding
  // computeTrussLayout (packages/geometry/src/trussLayout.ts).
  const [roofTrussSpacingIn, setRoofTrussSpacingIn] = useState<RoofTrussSpacingIn>(ROOF_TRUSS_SPACING_DEFAULT_IN);
  const [roofTrussDoublingStrategy, setRoofTrussDoublingStrategy] = useState<TrussDoublingStrategy>("single");

  // Per-wall elevation view (Tommy: "an arrow button for each wall section,
  // where we can see the whole line up still in 2d view") — additive to the
  // existing ground-floor PanelSlot[] row, not a replacement for it.
  // gableEndWallIds tracks which walls have a Gable End tiled on top;
  // elevationViewWallId is which wall's elevation view is currently open
  // (only one at a time).
  const [gableEndWallIds, setGableEndWallIds] = useState<Set<string>>(new Set());
  // Which gable-end wall(s) are in "panels/beam" mode — a subset of
  // gableEndWallIds (Tommy: "the gable end panels [should] be the
  // determining factor for roof options... layout of trusses needs to
  // take into account... if the gable panels are under or next to [the
  // trusses]"). roofSystemTypeId (below) is DERIVED from this instead of
  // its own independent Roof-tab setting — gable config is now the single
  // source of truth for whether the roof bears on real structural columns
  // or open truss framing.
  const [gableStructuralPanelWallIds, setGableStructuralPanelWallIds] = useState<Set<string>>(new Set());
  const roofSystemTypeId: RoofSystemType = gableStructuralPanelWallIds.size > 0 ? "structural-panel" : "truss";
  const [elevationViewWallId, setElevationViewWallId] = useState<string | null>(null);
  // Gable end window panels (Tommy: "add an option to click-edit gable end
  // panels to become window gable end panels, similarly splitting into two
  // distinct panels") — anchored per wall the same way an opening on a
  // normal wall is (see OpeningAnchor.beforeStandardCount): "how many
  // non-safety-gap gable tiles precede this reservation," so a reservation
  // survives an unrelated retile (roofline/heel/width change) instead of
  // drifting or vanishing. GableWindowReservation's own field shape is
  // reused directly (beforeTileCount/widthIn/heightIn/sillHeightIn) — no
  // separate app-level anchor type needed, it's already exactly this.
  const [gableWindowAnchorsByWallId, setGableWindowAnchorsByWallId] = useState<Record<string, GableWindowReservation[]>>({});
  // The max-height drag mode doesn't carry meaning across a wall switch —
  // avoids it silently staying "on" against a different wall's own diagram.
  useEffect(() => {
    setAdjustingGableMaxHeight(false);
  }, [elevationViewWallId]);
  // Same reason the max-height drag mode resets: an armed placement tool
  // carries no meaning across a wall switch, and leaving it on would make
  // the first click on the NEXT wall replace a panel the user was only
  // looking at.
  useEffect(() => {
    setPanelPlacementTool(null);
  }, [elevationViewWallId]);
  // Which panel a click in Edit mode most recently landed on (2D or 3D —
  // both route through handleToggleOpening below) — drives the "Selected
  // Panel" note. Re-derived fresh from baseWallSlots on every render (see
  // that note's isOpen check), so a stale wallId/slotIndex after a redraw
  // just fails to find a slot and the note stops rendering, rather than
  // showing the wrong panel.
  // zoneIndex: which of this slot's own independently-typed vertical zones
  // (see PanelSlotZone) is selected — 0 = bottom-most. Undefined means "the
  // slot as a whole" (today's pre-zone behavior; also what a beam-affected
  // slot's click always reports in Stride 1 — see handleToggleOpening).
  const [selectedSlot, setSelectedSlot] = useState<{ wallId: string; slotIndex: number; story: "ground" | "second"; zoneIndex?: number } | null>(
    null,
  );
  // Feedback for the Selected Panel note's window-sill controls (number
  // input + WindowSizeDiagram's drag handle) — Tommy: "when a drag or the
  // number input gets clamped... show a brief inline note instead of
  // silently snapping". Set by handleSetWindowSillHeight itself, so both
  // input paths share one source of truth for what actually got clamped.
  const [sillClampNotice, setSillClampNotice] = useState<string | null>(null);
  const sillClampNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Same "clamped, briefly say so" pattern as sillClampNotice, for the
  // window Width field once it became a free-typed number instead of a
  // fixed-preset dropdown (Tommy: window headers "can be however wide up
  // to 10 ft wide").
  const [windowWidthClampNotice, setWindowWidthClampNotice] = useState<string | null>(null);
  const windowWidthClampNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The same pattern again for a hand-set PANEL width (Smearforn Stage 1).
  // Deliberately NOT where a refusal goes — a refusal belongs in the field
  // itself, which keeps what was typed and does not commit. This carries the
  // two things that are not refusals: a clamp at the catalog maximum, and
  // the "this edit would have moved the wall's total length, so nothing was
  // changed" guard.
  const [panelWidthNotice, setPanelWidthNotice] = useState<string | null>(null);
  const panelWidthNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPanelWidthNotice = (message: string) => {
    if (panelWidthNoticeTimerRef.current) clearTimeout(panelWidthNoticeTimerRef.current);
    setPanelWidthNotice(message);
    panelWidthNoticeTimerRef.current = setTimeout(() => setPanelWidthNotice(null), 6000);
  };
  // --- Smearforn Stage 2: the panel placement tool ------------------------
  //
  // Tommy: "There should be a way to add a panel, select which type of panel
  // you want to add, and then click where to put it. This would either
  // replace a panel or add one between."
  //
  // Armed from the wall-elevation left bar: pick a type (or Delete), then
  // click a panel to replace it or a boundary to insert between. Null = the
  // tool is off and a click on a panel does what it has always done (the
  // type cycle). Corner and safety-gap are not on the roster — see
  // PLACEABLE_PANEL_TYPES' own doc comment.
  const [panelPlacementTool, setPanelPlacementTool] = useState<
    { mode: "place"; type: PlaceablePanelType; bracedPattern?: BracePattern; bracedMirrored?: boolean } | { mode: "delete" } | null
  >(null);
  const [panelPlacementNotice, setPanelPlacementNotice] = useState<string | null>(null);
  const panelPlacementNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPanelPlacementNotice = (message: string) => {
    if (panelPlacementNoticeTimerRef.current) clearTimeout(panelPlacementNoticeTimerRef.current);
    setPanelPlacementNotice(message);
    panelPlacementNoticeTimerRef.current = setTimeout(() => setPanelPlacementNotice(null), 8000);
  };
  // Hard guardrail (Tommy): at most 2 Gable End walls, and once 1 is active,
  // the 2nd must be its geometric opposite (parallel, facing away) — the
  // roof-catcher beam needs exactly 2 walls forming a straight run between
  // them, so a 3rd or a non-opposite 2nd would leave that run undefined.
  /* ⚠ A SHED'S TALL WALL WANTS GABLE PANELS TOO, AND THIS GUARDRAIL FORBIDS
     IT. Tommy, 2026-10-26: *"Shed roof on small building should spawn with
     inclined Gable end panels all along the wall of the taller side too."*

     That is a third gable wall, and it is not opposite the other two — both
     of which the rule below refuses. The rule's stated reason is the
     roof-catcher beam needing exactly two walls to span between, and a SHED
     HAS NO CATCHER BEAM, so the reason does not apply to the case he is
     asking for. The fix is therefore to make the guardrail conditional on the
     roof form rather than to widen it generally.

     Not done here, because it also needs the tall wall's panels to carry an
     INCLINED TOP to receive the roof flush — which is his earlier open
     question about whether the main wall panels take the incline or a
     smaller stacked panel does (he leaned to the stacked one). Queued rather
     than half-built. */
  const gableEndToggleBlockReason = (wallId: string): string | null => {
    if (gableEndWallIds.has(wallId)) return null; // always allowed to turn back off
    /* ⚠ A RING HAS NO OPPOSITE PAIR to span a roof-catcher beam between — it
       has two closed rings and a hole. The reason lives in `ringRoof.ts`,
       beside the geometry that makes it true, rather than being written out
       again here. A courtyard roof follows the building all the way round and
       slopes OUTWARD, high at the courtyard (Tommy, 2026-10-22). */
    if (footprint) {
      const ringReason = ringRoofGableBlockReason(footprint);
      if (ringReason) return ringReason;
    }
    if (gableEndWallIds.size >= 2) {
      return "Only 2 Gable End walls are allowed — the roof-catcher beam spans between exactly 2. Turn one off first.";
    }
    if (gableEndWallIds.size === 1 && footprint) {
      const otherWallId = [...gableEndWallIds][0]!;
      const otherWall = footprint.walls.find((w) => w.id === otherWallId);
      const thisWall = footprint.walls.find((w) => w.id === wallId);
      if (otherWall && thisWall && !areWallsOppositePair(thisWall, otherWall, footprint)) {
        return `Must face opposite wall ${otherWallId} (parallel, facing away) to form a straight roof-catcher beam run.`;
      }
    }
    return null;
  };
  const handleToggleGableEnd = (wallId: string, enabled: boolean) => {
    if (enabled && gableEndToggleBlockReason(wallId)) return;
    setGableEndWallIds((was) => {
      const next = new Set(was);
      if (enabled) {
        next.add(wallId);
        // Auto-pair the geometric opposite wall (Tommy: "when the user
        // adds a gable end, the opposing wall also spawns one") — only
        // when this is the very first gable end on the footprint; adding
        // a 2nd already requires it to BE the opposite wall
        // (gableEndToggleBlockReason above), so there's nothing left to
        // auto-pair there.
        if (was.size === 0 && footprint) {
          const thisWall = footprint.walls.find((w) => w.id === wallId);
          const opposite = thisWall && footprint.walls.find((w) => w.id !== wallId && areWallsOppositePair(thisWall, w, footprint));
          if (opposite) next.add(opposite.id);
        }
      } else {
        next.delete(wallId);
      }
      return next;
    });
    if (!enabled) {
      setGableStructuralPanelWallIds((was) => {
        if (!was.has(wallId)) return was;
        const next = new Set(was);
        next.delete(wallId);
        return next;
      });
    }
  };
  // Only the genuinely shorter dimension's 2 walls ever show the
  // panels/beam toggle (Tommy: "this button only appears o[n] the two
  // shorter sides of the 4 elevations") — the wall's own length must be
  // the minimum among every wall on the footprint.
  const isShorterDimensionWall = (wallId: string): boolean => {
    if (!footprint || footprint.walls.length === 0) return false;
    const wall = footprint.walls.find((w) => w.id === wallId);
    if (!wall) return false;
    const minLengthFt = Math.min(...footprint.walls.map((w) => w.lengthFt));
    return wall.lengthFt <= minLengthFt + 1e-6;
  };
  // Tommy: "make the default that... when the user adds a gable end, the
  // opposing wall also spawns one, and they are symmetrical and parallel
  // to each other and move together" — default ON; a sidebar toggle lets
  // the user break the link back to independent per-wall editing.
  const [gableMirrorLinked, setGableMirrorLinked] = useState(true);

  // Gable end window panels (Tommy: "add an option to click-edit gable end
  // panels to become window gable end panels, similarly splitting into two
  // distinct panels") — click cycles plain <-> window, same "toggle, don't
  // drag out a new one" shape nextPanelCycleState's own click-through gives
  // every other slot type. `tileOrdinal` is "how many non-safety-gap gable
  // tiles precede this one" (WallElevationDiagram computes this per
  // rendered tile at click time, same anchor convention OpeningAnchor uses
  // for a real wall opening). `naturalWidthIn` seeds a brand-new
  // reservation's own default width — the tile's own current (unsplit)
  // width, capped at the 4ft gable-window ceiling (Tommy: "window sizing
  // options are similar to standard panels becoming window panel pairs
  // except only up to 4ft wide").
  const handleToggleGableWindow = (wallId: string, tileOrdinal: number, naturalWidthIn: number) => {
    setGableWindowAnchorsByWallId((prev) => {
      const existing = prev[wallId] ?? [];
      const alreadyWindow = existing.some((w) => w.beforeTileCount === tileOrdinal);
      const next = alreadyWindow
        ? existing.filter((w) => w.beforeTileCount !== tileOrdinal)
        : [...existing, { beforeTileCount: tileOrdinal, widthIn: Math.min(naturalWidthIn, panelWidthInRange.maxIn) }];
      return { ...prev, [wallId]: next };
    });
  };

  const handleSetGableWindowField = (
    wallId: string,
    tileOrdinal: number,
    field: "widthIn" | "heightIn" | "sillHeightIn",
    value: number,
  ) => {
    setGableWindowAnchorsByWallId((prev) => ({
      ...prev,
      [wallId]: (prev[wallId] ?? []).map((w) =>
        w.beforeTileCount === tileOrdinal
          ? { ...w, [field]: field === "widthIn" ? Math.min(Math.max(value, windowHeaderWidthInRange.minIn), panelWidthInRange.maxIn) : Math.max(0, value) }
          : w,
      ),
    }));
  };

  // boxBeamCoverageByWallId tracks which walls have a Box Beam (rather than
  // a Truss Plate) as their own 2nd-story roof-bearing member, AND exactly
  // which of that wall's own second-story slots it covers (Tommy: "options
  // for being a ring all the way around or just one section of the wall...
  // dragged shorter and snap to the edge of each panel, allowing the
  // previous panel to grow back up to the roofline height") — a wall with
  // no entry here (or an empty/inverted range) uses a Truss Plate along its
  // own full length. Slot-index based (not raw inches) so a covered range
  // is always a whole number of consecutive slots — see
  // computeRoofBearingSegments/isSlotBoxBeamCovered in the geometry
  // package, the shared source every consumer (fabrication grouping, 3D
  // render, 2D elevation row rendering, panel-instance heights) reads this
  // through. No opposite-pair/max-2 constraint like gableEndWallIds, since
  // a box beam doesn't need to form a straight run between exactly 2 walls.
  // Only meaningful once a 2nd story exists; boxBeamSizeId is one global
  // choice for the whole building (see BOX_BEAM_SIZE_OPTIONS).
  const [boxBeamCoverageByWallId, setBoxBeamCoverageByWallId] = useState<Record<string, BoxBeamCoverage>>({});
  const [boxBeamSizeId, setBoxBeamSizeId] = useState<BoxBeamSizeId>(BOX_BEAM_SIZE_DEFAULT);
  const handleChangeBoxBeamCoverage = (wallId: string, coverage: BoxBeamCoverage | null) => {
    setBoxBeamCoverageByWallId((was) => {
      const next = { ...was };
      if (coverage && coverage.endSlotIndex > coverage.startSlotIndex) next[wallId] = coverage;
      else delete next[wallId];
      return next;
    });
  };
  const handleToggleBoxBeam = (wallId: string, enabled: boolean) => {
    const slotCount = (secondStory?.wallSlots[wallId] ?? []).length;
    handleChangeBoxBeamCoverage(wallId, enabled ? { startSlotIndex: 0, endSlotIndex: slotCount } : null);
  };
  const handleSetBoxBeamRing = (enabled: boolean) => {
    if (!enabled || !footprint) {
      setBoxBeamCoverageByWallId({});
      return;
    }
    const next: Record<string, BoxBeamCoverage> = {};
    for (const wall of footprint.walls) {
      const slotCount = (secondStory?.wallSlots[wall.id] ?? []).length;
      next[wall.id] = { startSlotIndex: 0, endSlotIndex: slotCount };
    }
    setBoxBeamCoverageByWallId(next);
  };

  // Mid-Wall Bond Beam (Tommy: "cellulose box beam"... "same beam,
  // positionable at any height in the wall"... "row splits into two: below-
  // beam + above-beam") — the SAME box-beam catalog/assembly as the
  // roofline Box Beam above, but placeable at an arbitrary height within
  // EITHER story's own wall (not just the roofline, and not just the
  // second story). Stage 2: a wall can have MULTIPLE beams, stacked at
  // different heights, each with its OWN independent horizontal coverage
  // range (same BoxBeamCoverage shape the roofline Box Beam already uses)
  // and own size — story-keyed (unlike boxBeamCoverageByWallId, which is
  // inherently second-story-only) since a bond beam is a general straw-
  // bale technique usable on any story, mirroring the existing
  // `(story: "ground" | "second", ...)` convention already used by
  // onToggleOpening/onSetWindowSillHeight/etc. rather than duplicating
  // ground/second state pairs. Banding (how many stacked panels a given
  // slot splits into) is a per-slot computation now (different slots of
  // the same wall can see different beam subsets) — computed inside each
  // real consumer (panelInstances.ts, WallElevationDiagram.tsx,
  // Building3DView.tsx) via computeWallVerticalBandsForSlot, not
  // pre-resolved here.
  const [midWallBeamsByStoryAndWallId, setMidWallBeamsByStoryAndWallId] = useState<
    Record<"ground" | "second", Record<string, MidWallBeam[]>>
  >({ ground: {}, second: {} });
  // Smearforn Stage 2b's spanning ("triple") headers — one header panel over
  // a slot-index RANGE, per wall, per story. Structurally the same record a
  // Mid-Wall Bond Beam carries, which is the model Tommy confirmed
  // 2026-09-24 ("Yes, that's what it is"): E4A spans E4B (3'5½") + E4C (3'0")
  // = 6'5½", so A sits ON TOP of B and C rather than beside them. The span
  // adds no width to the wall's own run — it is derived from the panels
  // underneath.
  const [spanningHeadersByStoryAndWallId, setSpanningHeadersByStoryAndWallId] = useState<
    Record<"ground" | "second", Record<string, SpanningHeader[]>>
  >({ ground: {}, second: {} });
  // Smearforn Stage 3's per-wall unbuilt spans — the key lands now (Stage 0
  // owns the single v24->v25 bump for the whole project), and NOTHING reads
  // it yet: it round-trips through save/load so the file format settles once
  // this week instead of twice. See WallRunStop's own doc comment.
  const [wallRunStopsByWallId, setWallRunStopsByWallId] = useState<Record<string, WallRunStop>>({});
  // Smearforn Stage 3's run-stop opening memory (Tommy, 2026-09-29: **"Drop
  // them, and remember"**). An opening that falls inside a wall's unbuilt span
  // is NOT in that wall's slots — an unbuilt section of wall has no window in
  // it, so it is absent from the cut list, the fabrication groups and the shop
  // drawings for free — and it is NOT deleted: it lives here, per story per
  // wall, and reducing or clearing the stop hands it straight back to the
  // tiler. Nothing is ever lost by stopping a wall and changing your mind.
  //
  // ⚠ This and `baseWallSlots`/`stories[].wallSlots` are two halves of one
  // answer. Any handler that writes new slots out of
  // `retilePreservingOpenings` must write the memory it came back with too —
  // see that wrapper's own comment.
  /** TILE-ONCE STAGE 4d — the panels each run stop has set aside, per storey
   * and wall, so reducing a stop gives back exactly what it took. Succeeds
   * the anchor-based memory below, which Stage 6 retires. */
  const [stoppedSlotsByStoryAndWallId, setStoppedSlotsByStoryAndWallId] = useState<
    Record<"ground" | "second", Record<string, StoppedSlots>>
  >({ ground: {}, second: {} });
  const [unbuiltOpeningsByStoryAndWallId, setUnbuiltOpeningsByStoryAndWallId] =
    useState<OpeningMemoryByStoryAndWallId>({ ground: {}, second: {} });
  // Every beam-count/height/coverage change moves this wall's own band
  // boundaries — reconciled here so each slot's own zones[] survives the
  // change instead of falling back to effectiveZonesForSlot's dumb
  // "standard" padding (Tommy: "make sure we can edit both panels above
  // and below beams as their own independent ones"). oldBeams/newBeams are
  // this wall's own MidWallBeam list immediately before/after the specific
  // mutation being applied — resolved to real geometry the same way
  // midWallBeamGeometryByWallId already does. Called from inside the same
  // handler that also writes midWallBeamsByStoryAndWallId, mirroring
  // reconcileBracedPlacement's own "old vs. new, both in this handler's own
  // closure" precedent.
  /** This wall's FULL band-producing geometry for a given beam list — the
   * beams joined with whatever spanning headers the wall currently carries.
   * Every band computation must see both (see `wallBandGeometry`), and a
   * reconcile that saw only the beams would recompute zones against a wall
   * that does not exist. */
  const bandGeometryWithHeaders = (story: "ground" | "second", wallId: string, beams: MidWallBeam[]): MidWallBeamGeometry[] =>
    wallBandGeometry(midWallBeamsToGeometry(beams), spanningHeadersToGeometry(spanningHeadersByStoryAndWallId[story][wallId] ?? []));

  const reconcileWallZonesForBandChange = (
    story: "ground" | "second",
    wallId: string,
    /** The FULL band-producing geometry either side of the change — beams
     * AND spanning headers (Stage 2b), because both split a column and a
     * reconcile that saw only half of them would compare band counts against
     * a wall that does not exist. Built by the caller through
     * `wallBandGeometry`, the one place those two lists are joined. */
    oldGeom: MidWallBeamGeometry[],
    newGeom: MidWallBeamGeometry[],
  ) => {
    const storyHeightIn = (story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt)) * 12;
    setWallSlotsForStory(story, (prev) => {
      const slots = prev[wallId];
      if (!slots) return prev;
      const nextSlots = slots.map((slot, i) => {
        const oldBands = computeWallVerticalBandsForSlotWithMaxHeight(i, storyHeightIn, oldGeom, maxPanelHeightIn, panelHeightInRange.minIn);
        const oldZones = effectiveZonesForSlot(slot, oldBands.length);
        const newBands = computeWallVerticalBandsForSlotWithMaxHeight(i, storyHeightIn, newGeom, maxPanelHeightIn, panelHeightInRange.minIn);
        const newZones = reconcilePanelSlotZones(oldBands, oldZones, newBands);
        return applyZonesToSlot(slot, newZones);
      });
      return { ...prev, [wallId]: nextSlots };
    });
  };
  const handleAddMidWallBeam = (story: "ground" | "second", wallId: string, kind: MidWallBeamKind) => {
    const storyHeightFt = story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt);
    const slotCount = (story === "ground" ? overlayWallSlots : (secondStory?.wallSlots ?? {}))[wallId]?.length ?? 0;
    const newBeam: MidWallBeam = {
      id: crypto.randomUUID(),
      heightIn: (storyHeightFt * 12) / 2,
      kind,
      ...(kind === "box-beam"
        ? { sizeId: BOX_BEAM_SIZE_DEFAULT }
        : // Same visual starting height as the Box Beam default (10.5in), freely draggable afterward.
          { bigHeaderBeamHeightIn: computeBoxBeamAssemblyHeightIn(BOX_BEAM_SIZE_DEFAULT) }),
      startSlotIndex: 0,
      endSlotIndex: slotCount,
    };
    const oldBeams = midWallBeamsByStoryAndWallId[story][wallId] ?? [];
    const newBeams = [...oldBeams, newBeam];
    setMidWallBeamsByStoryAndWallId((was) => ({
      ...was,
      [story]: { ...was[story], [wallId]: newBeams },
    }));
    reconcileWallZonesForBandChange(
      story,
      wallId,
      bandGeometryWithHeaders(story, wallId, oldBeams),
      bandGeometryWithHeaders(story, wallId, newBeams),
    );
  };
  const handleRemoveMidWallBeam = (story: "ground" | "second", wallId: string, beamId: string) => {
    const oldBeams = midWallBeamsByStoryAndWallId[story][wallId] ?? [];
    const newBeams = oldBeams.filter((b) => b.id !== beamId);
    setMidWallBeamsByStoryAndWallId((was) => ({
      ...was,
      [story]: { ...was[story], [wallId]: newBeams },
    }));
    reconcileWallZonesForBandChange(
      story,
      wallId,
      bandGeometryWithHeaders(story, wallId, oldBeams),
      bandGeometryWithHeaders(story, wallId, newBeams),
    );
  };
  const updateMidWallBeam = (story: "ground" | "second", wallId: string, beamId: string, patch: Partial<MidWallBeam>) => {
    const oldBeams = midWallBeamsByStoryAndWallId[story][wallId] ?? [];
    const newBeams = oldBeams.map((b) => (b.id === beamId ? { ...b, ...patch } : b));
    setMidWallBeamsByStoryAndWallId((was) => ({
      ...was,
      [story]: { ...was[story], [wallId]: newBeams },
    }));
    reconcileWallZonesForBandChange(
      story,
      wallId,
      bandGeometryWithHeaders(story, wallId, oldBeams),
      bandGeometryWithHeaders(story, wallId, newBeams),
    );
  };
  const handleChangeMidWallBeamHeight = (story: "ground" | "second", wallId: string, beamId: string, heightIn: number) =>
    updateMidWallBeam(story, wallId, beamId, { heightIn });
  const handleChangeMidWallBeamSizeId = (story: "ground" | "second", wallId: string, beamId: string, sizeId: BoxBeamSizeId) =>
    updateMidWallBeam(story, wallId, beamId, { sizeId });
  const handleChangeMidWallBeamBigHeaderHeightIn = (story: "ground" | "second", wallId: string, beamId: string, bigHeaderBeamHeightIn: number) =>
    updateMidWallBeam(story, wallId, beamId, { bigHeaderBeamHeightIn });
  const handleChangeMidWallBeamCoverage = (story: "ground" | "second", wallId: string, beamId: string, coverage: BoxBeamCoverage) =>
    updateMidWallBeam(story, wallId, beamId, coverage);

  // ---------------------------------------------------------------------
  // Smearforn Stage 2b — spanning ("triple") headers.
  //
  // Every mutation below goes through the SAME two steps: validate with
  // `resolveSpanningHeaderPlacement` (which owns every refusal, in
  // packages/geometry, with no user-facing copy in it), then — only on
  // "ok" — write the record AND reconcile the wall's zones, because adding
  // or moving a header changes how many bands the covered columns split
  // into. A refusal writes nothing at all, the same all-or-nothing rule the
  // placement tool and the run-stop edit already follow.
  // ---------------------------------------------------------------------
  const spanningHeadersFor = (story: "ground" | "second", wallId: string): SpanningHeader[] =>
    spanningHeadersByStoryAndWallId[story][wallId] ?? [];
  const storyHeightInFor = (story: "ground" | "second") =>
    (story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt)) * 12;
  const slotsForStoryWall = (story: "ground" | "second", wallId: string): PanelSlot[] =>
    (story === "ground" ? overlayWallSlots : (secondStory?.wallSlots ?? {}))[wallId] ?? [];

  /** Writes a validated header list for one wall and reconciles that wall's
   * zones across the band change. `oldHeaders`/`newHeaders` are this wall's
   * own lists either side of the specific mutation, the same "old vs. new,
   * both in this handler's own closure" shape `reconcileBracedPlacement` and
   * the beam handlers already use. */
  const commitSpanningHeaders = (
    story: "ground" | "second",
    wallId: string,
    oldHeaders: SpanningHeader[],
    newHeaders: SpanningHeader[],
  ) => {
    const beamGeom = midWallBeamsToGeometry(midWallBeamsByStoryAndWallId[story][wallId] ?? []);
    setSpanningHeadersByStoryAndWallId((was) => ({ ...was, [story]: { ...was[story], [wallId]: newHeaders } }));
    reconcileWallZonesForBandChange(
      story,
      wallId,
      wallBandGeometry(beamGeom, spanningHeadersToGeometry(oldHeaders)),
      wallBandGeometry(beamGeom, spanningHeadersToGeometry(newHeaders)),
    );
  };

  /** Validate a candidate header against this wall as it is right now —
   * every OTHER header on the wall counts as existing coverage, so a header
   * being moved never collides with itself. */
  const checkSpanningHeader = (
    story: "ground" | "second",
    wallId: string,
    candidate: SpanningHeader,
    others: SpanningHeader[],
  ): SpanningHeaderPlacementResult =>
    resolveSpanningHeaderPlacement(
      slotsForStoryWall(story, wallId),
      { startSlotIndex: candidate.startSlotIndex, endSlotIndex: candidate.endSlotIndex },
      others.map((h) => ({ startSlotIndex: h.startSlotIndex, endSlotIndex: h.endSlotIndex })),
      SPANNING_HEADER_LIMITS_IN,
      {
        heightIn: candidate.heightIn,
        assemblyHeightIn: resolveSpanningHeaderHeightIn(candidate),
        storyHeightIn: storyHeightInFor(story),
      },
    );

  /** One validated mutation: build the candidate, check it, and either
   * commit or say — with the real number in it — why not. */
  const applySpanningHeaderChange = (
    story: "ground" | "second",
    wallId: string,
    headerId: string | null,
    candidate: SpanningHeader,
  ) => {
    const current = spanningHeadersFor(story, wallId);
    const others = current.filter((h) => h.id !== headerId);
    const result = checkSpanningHeader(story, wallId, candidate, others);
    if (result.outcome !== "ok") {
      showPanelPlacementNotice(spanningHeaderRefusalNotice(result, formatPlacementLength));
      return;
    }
    const next = headerId === null ? [...current, candidate] : current.map((h) => (h.id === headerId ? candidate : h));
    commitSpanningHeaders(story, wallId, current, next);
    return result;
  };

  /** Adds a header over a run of panels. Born hard against the top of the
   * story (`defaultSpanningHeaderBottomHeightIn`) at the catalog's own
   * default header height — which is `pending-BI-confirmation` and is
   * presented as nothing more than a starting point. */
  const handleAddSpanningHeader = (story: "ground" | "second", wallId: string, startSlotIndex: number, endSlotIndex: number) => {
    const assemblyHeightIn = bigHeaderDefaultHeightIn.value;
    const candidate: SpanningHeader = {
      id: crypto.randomUUID(),
      heightIn: defaultSpanningHeaderBottomHeightIn(storyHeightInFor(story), assemblyHeightIn),
      headerHeightIn: assemblyHeightIn,
      startSlotIndex,
      endSlotIndex,
    };
    const result = applySpanningHeaderChange(story, wallId, null, candidate);
    if (!result) return;
    // The commit notice names the header by the number it will have once
    // this render settles — computed from the SAME global walk every other
    // consumer uses, with the new header included, so the NAME in the
    // sentence and the name on the drawing cannot disagree.
    //
    // ⚠ That guarantee covers the header's own name and stops there, stated
    // narrowly on purpose. The PANEL names beside it come from
    // `panelInstanceNameForStory`, i.e. this render's `allInstances`, computed
    // before the header was committed. In the default configuration they are
    // the same names either way: a fresh header is born flush against the top
    // plate (`defaultSpanningHeaderBottomHeightIn`), so the column it shortens
    // still yields ONE band and therefore one instance per slot, and panel
    // numbering is positional. They can differ only where adding the header
    // changes a covered column's band COUNT — `maxPanelHeightIn` below the
    // header's own bottom face, which subdivides the band beneath it. The
    // notice is a transient toast and every durable surface (the sheets, the
    // cross-reference, the Review Log) recomputes from committed state, so
    // this is left alone rather than plumbed — but it is not claimed to be
    // impossible, because it is not.
    const nextHeadersByWall = {
      ...spanningHeadersByStoryAndWallId,
      [story]: {
        ...spanningHeadersByStoryAndWallId[story],
        [wallId]: [...spanningHeadersFor(story, wallId), candidate],
      },
    };
    const resolved = resolveSpanningHeaders(footprint, stories, nextHeadersByWall).find((r) => r.header.id === candidate.id);
    if (!resolved) return;
    showPanelPlacementNotice(
      spanningHeaderCommitNotice({
        name: resolved.name,
        location: spanningHeaderSheetLocation(resolved, spannedPanelNames(resolved, panelInstanceNameForStory(resolved.story))),
        spanWidthIn: resolved.spanWidthIn,
        formatLength: formatPlacementLength,
      }),
    );
  };

  const handleRemoveSpanningHeader = (story: "ground" | "second", wallId: string, headerId: string) => {
    const current = spanningHeadersFor(story, wallId);
    commitSpanningHeaders(
      story,
      wallId,
      current,
      current.filter((h) => h.id !== headerId),
    );
  };

  const updateSpanningHeader = (story: "ground" | "second", wallId: string, headerId: string, patch: Partial<SpanningHeader>) => {
    const target = spanningHeadersFor(story, wallId).find((h) => h.id === headerId);
    if (!target) return;
    applySpanningHeaderChange(story, wallId, headerId, { ...target, ...patch });
  };
  const handleChangeSpanningHeaderBottomHeight = (story: "ground" | "second", wallId: string, headerId: string, heightIn: number) =>
    updateSpanningHeader(story, wallId, headerId, { heightIn });
  const handleChangeSpanningHeaderHeight = (story: "ground" | "second", wallId: string, headerId: string, headerHeightIn: number) =>
    updateSpanningHeader(story, wallId, headerId, { headerHeightIn });
  const handleChangeSpanningHeaderCoverage = (
    story: "ground" | "second",
    wallId: string,
    headerId: string,
    coverage: { startSlotIndex: number; endSlotIndex: number },
  ) => updateSpanningHeader(story, wallId, headerId, coverage);
  // Ground floor's own beams, pre-resolved to geometry (sizeId ->
  // real assemblyHeightIn) — fed straight into allPanelInstances, which
  // computes each affected slot's own bands itself now (Stage 2).
  const midWallBeamGeometryByWallId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(midWallBeamsByStoryAndWallId.ground).map(([wallId, beams]) => [wallId, midWallBeamsToGeometry(beams)]),
      ),
    [midWallBeamsByStoryAndWallId.ground],
  );
  // Same derivation, second story — feeds secondStoryAllInstances below
  // (Elevation-view panel ID labels need named instances for both stories,
  // same as Building3DView's own groundInstancesBySlot/secondStoryInstancesBySlot).
  const secondStoryMidWallBeamGeometryByWallId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(midWallBeamsByStoryAndWallId.second).map(([wallId, beams]) => [wallId, midWallBeamsToGeometry(beams)]),
      ),
    [midWallBeamsByStoryAndWallId.second],
  );
  // Stage 2b: what every band computation actually has to see — a story's
  // beams JOINED with its spanning headers, since both split a column into
  // stacked bands. The beam-only memos above stay, because "the beams" is
  // still a real question elsewhere (their own fabrication pages, their own
  // covered-length total); these are the lists that feed allPanelInstances,
  // the elevation and the 3D view.
  const groundBandGeometryByWallId = useMemo(() => {
    const wallIds = new Set([
      ...Object.keys(midWallBeamGeometryByWallId),
      ...Object.keys(spanningHeadersByStoryAndWallId.ground),
    ]);
    return Object.fromEntries(
      [...wallIds].map((wallId) => [
        wallId,
        wallBandGeometry(
          midWallBeamGeometryByWallId[wallId] ?? [],
          spanningHeadersToGeometry(spanningHeadersByStoryAndWallId.ground[wallId] ?? []),
        ),
      ]),
    );
  }, [midWallBeamGeometryByWallId, spanningHeadersByStoryAndWallId.ground]);
  const secondStoryBandGeometryByWallId = useMemo(() => {
    const wallIds = new Set([
      ...Object.keys(secondStoryMidWallBeamGeometryByWallId),
      ...Object.keys(spanningHeadersByStoryAndWallId.second),
    ]);
    return Object.fromEntries(
      [...wallIds].map((wallId) => [
        wallId,
        wallBandGeometry(
          secondStoryMidWallBeamGeometryByWallId[wallId] ?? [],
          spanningHeadersToGeometry(spanningHeadersByStoryAndWallId.second[wallId] ?? []),
        ),
      ]),
    );
  }, [secondStoryMidWallBeamGeometryByWallId, spanningHeadersByStoryAndWallId.second]);
  // midWallBeamWallLengthTotalIn lives further down, right after `stories`
  // is declared — it needs to read `stories` inside a useMemo callback
  // that runs synchronously during THIS render, unlike the deferred
  // handlers above.

  // Gable End profile point positions (Tommy: "drag wall tool the peak of
  // this triangle... a sliding scale that you can also click and edit how
  // far away from each end it is"), generalized from a single peak to up to
  // 2 independently-placeable points (index-matched to roofProfileType's
  // own point count). Inches from the wall's start corner; a missing/null
  // entry means "not yet customized" (auto-centered) — see
  // computeGableTiledRow's own resolution + snap-to-shed logic.
  const [gableProfilePositionsInByWallId, setGableProfilePositionsInByWallId] = useState<Record<string, (number | null)[]>>({});
  /* ⚠ Shed or peak, read off the roofline rather than assumed.
     A shed is the same one-point profile with its point snapped to a wall's
     start edge; a peak leaves it centred, which `null` means. The 3D view had
     this hardcoded to "peaked", so a shed building was being given two planes
     AND a ridge beam — and Tommy was explicit on 2026-10-26: *"No catcher
     beam for the shed roof, all the load goes down the walls."* */
  const roofFormFromProfile: "shed" | "peaked" = [...gableEndWallIds].some((wallId) => {
    const positionIn = gableProfilePositionsInByWallId[wallId]?.[0];
    return positionIn !== null && positionIn !== undefined;
  })
    ? "shed"
    : "peaked";
  const handleChangeGableProfilePositionIn = useCallback(
    (wallId: string, pointIndex: number, positionIn: number | undefined) => {
      const wall = footprint?.walls.find((w) => w.id === wallId);
      const oldPositionIn = gableProfilePositionsInByWallId[wallId]?.[pointIndex] ?? null;
      const newPositionIn = positionIn === undefined || Number.isNaN(positionIn) ? null : positionIn;

      setGableProfilePositionsInByWallId((was) => {
        const next = { ...was };
        const arr = [...(next[wallId] ?? [])];
        arr[pointIndex] = newPositionIn;
        next[wallId] = arr;

        // Mirror onto the paired gable wall (Tommy: "they are symmetrical
        // and parallel to each other and move together") — reflected
        // since the opposite wall runs the opposite direction along its
        // own (same) length. Only when linked and both gable ends exist.
        if (gableMirrorLinked && wall && gableEndWallIds.size === 2 && gableEndWallIds.has(wallId)) {
          const otherWallId = [...gableEndWallIds].find((id) => id !== wallId);
          if (otherWallId) {
            const wallLengthIn = wall.lengthFt * 12;
            const mirroredPositionIn = newPositionIn === null ? null : wallLengthIn - newPositionIn;
            const otherArr = [...(next[otherWallId] ?? [])];
            otherArr[pointIndex] = mirroredPositionIn;
            next[otherWallId] = otherArr;
          }
        }
        return next;
      });

      // Tommy: "the roofline should snap to a new height whenever a gable
      // end shed roof is the case" — a drag (or typed position) that newly
      // lands within the shed-snap threshold auto-recomputes this point's
      // own height to a sensible 4/12 pitch (same formula "Shed Roof (auto
      // 4/12)" below already uses), rather than leaving whatever height
      // was set for the wall's previous (likely very different) run. Fires
      // only on the actual transition into shed-snapped — not on every
      // pixel of movement while already snapped — so it doesn't fight a
      // height the user deliberately types in afterward.
      if (wall) {
        const wallLengthIn = wall.lengthFt * 12;
        const isShedSnapped = (posIn: number | null) =>
          posIn !== null && (posIn < GABLE_SHED_SNAP_THRESHOLD_IN || posIn > wallLengthIn - GABLE_SHED_SNAP_THRESHOLD_IN);
        if (!isShedSnapped(oldPositionIn) && isShedSnapped(newPositionIn)) {
          // A pure rise now (see roofProfilePointHeightsFt's own doc
          // comment) — no eave/wallHeightFt term needed, unlike the old
          // absolute-height formula this replaces.
          handleChangeRoofProfilePointHeightFt(pointIndex, Math.round(wall.lengthFt * (4 / 12) * 12) / 12);
        }
      }
    },
    [footprint, gableProfilePositionsInByWallId, handleChangeRoofProfilePointHeightFt, gableMirrorLinked, gableEndWallIds],
  );
  // Elevation sidebar's Shed/Centered Peak pitch dropdowns (Tommy: pick a
  // standard pitch instead of typing a raw rise) — both snap the point's
  // own position first (start edge for a shed run across the wall's full
  // width; back to center for a centered peak, even if it had been dragged
  // off), then set the height for that pitch over the resulting run.
  // Shed applies to any profile point (generalizes the single fixed-4/12
  // shed shortcut this replaces, including a flat-top's own point 0);
  // Centered Peak only makes sense for a real single peak (pointIndex 0 of
  // a "peaked" 1-point profile) — a flat-top point isn't a peak.
  const handleSetShedPitch = (wall: Wall, pointIndex: number, pitchIn12: number) => {
    handleChangeGableProfilePositionIn(wall.id, pointIndex, 0);
    const wallWidthIn = wall.lengthFt * 12;
    const seat = resolveHeelSeat(wallWidthIn, standardWidthIn, heelHeightIn, 1, roofBearingAnchorMode, trussPlateInsetIn);
    handleChangeRoofProfilePointHeightFt(
      pointIndex,
      computeRiseFtForPitch(pitchIn12, wallWidthIn - seat.runOffsetIn, seat.heelOffsetIn),
    );
  };
  const handleSetCenteredPeakPitch = (wall: Wall, pitchIn12: number) => {
    handleChangeGableProfilePositionIn(wall.id, 0, undefined);
    const wallWidthIn = wall.lengthFt * 12;
    const seat = resolveHeelSeat(wallWidthIn, standardWidthIn, heelHeightIn, 2, roofBearingAnchorMode, trussPlateInsetIn);
    handleChangeRoofProfilePointHeightFt(
      0,
      computeRiseFtForPitch(pitchIn12, wallWidthIn / 2 - seat.runOffsetIn, seat.heelOffsetIn),
    );
  };

  // Second story (Tommy: "add a second level of panels") — a real,
  // independently-stored Story (own deep-copied wallSlots, not the ground
  // floor's own object by reference), stacked at the ground floor's own
  // top-plate height in the 3D Preview + whole-building OBJ export. There's
  // still no editing UI wired up for its own wallSlots yet (a fully
  // independent per-story footprint/opening editor — see the
  // gable-multistory-roof-strategy memory), so it starts as a mirror of the
  // ground floor at the moment it's added and stays that way until that
  // editor exists — but it's no longer a live shared reference underneath.
  // Footprint edits (bump-out, drag-wall, edit-length) don't resync it once
  // independent — only a brand-new footprint draw resets it (see
  // handleDraw) — a known, accepted limitation until per-story editing
  // lands. `stories` (below, derived after overlayWallSlots exists) is the
  // real array consumers should read; this is just the one new piece of
  // state.
  const [secondStory, setSecondStory] = useState<Story | null>(null);

  // Panelizer's own "keyhole" scope-of-work checkboxes (Tommy: "under
  // Panelizer lets add three check boxes - Floors, Walls, and Roof... I
  // want this tab to be the keyhole to getting down to what editor tools
  // are needed for this user's project") — gate which of the Wall/Floor/
  // Roof editor tabs are relevant (Foundation has no checkbox, always
  // relevant) and which of their own modality pickers/Detail Guide pages
  // show up. Walls defaults on (a footprint can't exist without it,
  // Tommy: "default is that walls are the only checked of these three
  // original branches"); Floors/Roof default off.
  const [wallsEnabled, setWallsEnabled] = useState(true);
  /* ⚠ Floors and roof are IN SCOPE by default as of 2026-10-26 ("Let's turn
     on roof and floor panels as default"). A building has a floor and a roof;
     starting with only walls checked meant a new project drew a ring of
     panels standing in mid-air, and meant the floor and roof decks — which
     now exist — were invisible until somebody found the Panelizer settings. */
  const [floorsEnabled, setFloorsEnabled] = useState(true);
  const [roofEnabled, setRoofEnabled] = useState(true);
  // Smearforn Stage 0 (Tommy: "I would like the turn off the floor and
  // foundation tools as default for now and primarily focus on panelizing
  // wall systems. This setting should still be visible") — Foundation used
  // to be pushed unconditionally below. New projects start with Walls only;
  // an existing saved file keeps its Foundation tab (the v24->v25 migration
  // defaults this key to `true`, never to this new-project default).
  const [foundationEnabled, setFoundationEnabled] = useState(false);

  const scopeOfWork: ScopeOfWork = { walls: wallsEnabled, foundation: foundationEnabled, floors: floorsEnabled, roof: roofEnabled };

  const enabledEditorTabs = useMemo(() => {
    const tabs: EditorTab[] = [];
    if (wallsEnabled) tabs.push("wall");
    if (foundationEnabled) tabs.push("foundation");
    if (floorsEnabled) tabs.push("floor");
    if (roofEnabled) tabs.push("roof");
    return tabs;
  }, [wallsEnabled, foundationEnabled, floorsEnabled, roofEnabled]);

  // If Panelizer's checkboxes rule out whichever editor tab is currently
  // active (e.g. unchecking Walls while the Wall tab is open), snap to the
  // first tab still in scope rather than stranding the user on a hidden tab.
  useEffect(() => {
    if (!enabledEditorTabs.includes(editorTab)) {
      setEditorTab(enabledEditorTabs[0] ?? "foundation");
    }
  }, [enabledEditorTabs, editorTab]);

  // Panelization type (Tommy: "categorize panelization types... three to
  // start with") — governs how plain wall infill (standard/braced/
  // safety-gap) is tiled; corners/columns/openings are unaffected in every
  // type, since they're structural/functional necessities regardless of
  // infill construction choice.
  // - loose-packed-braced: today's existing tiling/bracing system, unchanged.
  // - square-bale-panels: uniform 39in whole-bale panels (Tommy's existing
  //   squareBalePanel spec — "two 18in bales + two 1.5in studs" — a fully
  //   supported panelization type, fabricated the same as any other panel).
  // - timber-frame-curtain: uniform standard OR braced panels at a fixed,
  //   adjustable width (default 3ft) — no bracing-near-corners/safety-gap
  //   logic, since the actual timber frame (not modeled) carries the
  //   structural load in this system.
  const [panelizationType, setPanelizationType] = useState<PanelizationType>("loose-packed-braced");
  const [timberFrameCurtainPanelType, setTimberFrameCurtainPanelType] = useState<"standard" | "braced">("standard");
  const [timberFrameCurtainWidthIn, setTimberFrameCurtainWidthIn] = useState(36);

  /* ⚠ HOISTED 2026-10-11, and the reason is structural rather than tidiness.

     `stories` and the `overlayWallSlots` it is built from used to be declared
     around line 4800 while being READ from line ~1140 onward. That works at
     runtime — the readers are functions that only run later — but the React
     Compiler lint calls it correctly: "accessed before it is declared, which
     prevents the earlier access from updating when this value changes over
     time". A staleness risk, and a fair one.

     It had also started dictating the shape of the file. The undo machinery
     (2026-10-09) and the Repanelize handlers (2026-10-10) were both placed
     below line 4800 ONLY to dodge that warning, not because they belong
     there, and each carries a comment saying so. A third feature routed
     around a four-line memo would have been the file winning.

     They now sit immediately after the last state they read
     (`timberFrameCurtainWidthIn`), which is as early as they can legally go. */
  const overlayWallSlots = useMemo(() => {
    if (panelizationType === "loose-packed-braced") return baseWallSlots;
    const next: Record<string, PanelSlot[]> = {};
    for (const [wallId, slots] of Object.entries(baseWallSlots)) {
      const uniformType = panelizationType === "square-bale-panels" ? "standard" : timberFrameCurtainPanelType;
      const uniformWidthIn = panelizationType === "square-bale-panels" ? squareBalePanel.widthIn : timberFrameCurtainWidthIn;
      next[wallId] = applyUniformPanelization(slots, uniformType, uniformWidthIn);
    }
    return next;
  }, [baseWallSlots, panelizationType, timberFrameCurtainPanelType, timberFrameCurtainWidthIn]);

  // Real Story[] (Tommy: "how to do second story editing... maybe it sees
  // the ground level, and then can shift upward to the next ring of
  // panels") — stories[0] (ground floor) is a computed view over the
  // existing ground-floor primitives (zero change to baseWallSlots/retile/
  // handleToggleOpening/etc.); stories[1] (if present) is `secondStory`,
  // the one genuinely independent piece of state above.
  const stories: Story[] = useMemo(() => {
    const ground: Story = { id: "ground", label: "Ground Floor", wallHeightFt, wallSlots: overlayWallSlots };
    return secondStory ? [ground, secondStory] : [ground];
  }, [wallHeightFt, overlayWallSlots, secondStory]);
  const isSquareBalePanelization = panelizationType === "square-bale-panels";
  /** The panelization control's own refusal text (Square Bale's fixed 39in
   * corner — see `squareBaleCornerRefusal.ts`). Its own state rather than
   * `panelWidthNotice`, which only renders inside the Selected Panel note and
   * would be invisible to someone standing at the panelization buttons. Stays
   * up until the next panelization click rather than timing out: it is a
   * refusal to read, not a confirmation to glance at. */
  const [panelizationNotice, setPanelizationNotice] = useState<string | null>(null);
  // Tommy: "loose packed braced and square bale panels are two very
  // different panelization rules and 3d models... corners should also be
  // 39in panels for square bale panels" — the tiling's corner-slot width
  // isn't just a 3D-model detail, it's part of what makes these 2 styles
  // genuinely different layouts. Timber Frame Curtain is unaffected (Tommy:
  // still deciding how that style should behave) — it keeps the plain
  // 25.5in Column/Corner unit for now.
  const cornerWidthInForTiling = isSquareBalePanelization ? squareBalePanel.widthIn : cornerPanelWidthIn.value;
  /**
   * May the tiler WIDEN a corner panel past `cornerWidthInForTiling` to absorb
   * a middle too small to build (the corner-absorb rule — see `resolveCorners`
   * in packages/geometry's tiling.ts)?
   *
   * Yes for the plain corner panel: Tommy, asked directly whether one can be
   * built off its nominal 25.5in, since its construction is a 24in core plus
   * two 3/4in plywood faces — *"Yes — any width in the 24-48in band."*
   *
   * **No for Square Bale Panels.** That corner is a `squareBalePanel.widthIn`
   * whole-bale unit — a CONFIRMED 39in, two 18in bales plus two 1.5in studs —
   * and absorb at 39in moves the band to 78in-102.5in, where an ordinary 8ft wall
   * (`MIN_DIMENSION_FT`, the shortest side the rectangle tool will draw) would
   * emit two 48in "corner panels". Tommy, asked directly: **"No — refuse
   * instead."** Bales do not stretch, so widening a bale corner invents a
   * product that does not exist.
   *
   * With this false, a band wall tiles the way it did before absorb existed —
   * nominal corners plus a visible sub-minimum middle, which the Review Log's
   * existing below-minimum entry reports — and
   * `squareBalePanelizationRefusal` refuses the panelization by name at the
   * point of edit. The flag is what keeps the geometry honest on the paths the
   * refusal cannot see (drawing a band-length wall while Square Bale is
   * already selected never touches the panelization control).
   */
  const cornerMayWidenForTiling = !isSquareBalePanelization;

  const loadInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Where the design on screen came from (Stage 2B): the cloud project it
  // belongs to, if any, and `titleBlockSave` — the title block's "as of last
  // save" date. LAST SAVE WINS: Load Project, Save Project, Open from cloud and
  // Save to cloud each overwrite it, and nothing else does (see
  // cloud/documentSession.ts and titleBlockDate.ts). null = never saved or
  // loaded, so the title block shows today; a present value with an unusable
  // date shows "Date not recorded". Editing (including drawing a new
  // footprint) writes nothing — spec: edited-since-load keeps the old date.
  // One dispatch advances both rendered state and a synchronous mirror, so a
  // late cloud answer is checked against the latest dispatch, not last frame's.
  const { documentSession, dispatchDocumentSession, readDocumentSession } = useDocumentSession();

  // The editor is now permanently the full-viewport backdrop (Tommy: "the
  // editor section really is the whole screen"), so it no longer needs its
  // own "fullscreen vs. normal" CSS mode — `isOsFullscreen` just tracks the
  // real browser Fullscreen API (immersive mode, hides the browser's own
  // chrome), independent of anything else. `toolbarPortalRef` is where
  // FootprintCanvas's Pan/Zoom/Measure toolbar portals to.
  const pageRef = useRef<HTMLDivElement>(null);
  const [toolbarPortalNode, setToolbarPortalNode] = useState<HTMLDivElement | null>(null);
  const [toolbarSecondaryPortalNode, setToolbarSecondaryPortalNode] = useState<HTMLDivElement | null>(null);
  // Same portal mechanism, one each for FoundationCanvas's and
  // WallElevationDiagram's own Pan/Zoom/Reset row (Tommy: "include the
  // pan/zoom in/out/reset pieces found in the plan view editor in the
  // foundation and elevation editors").
  const [foundationToolbarPortalNode, setFoundationToolbarPortalNode] = useState<HTMLDivElement | null>(null);
  const [elevationToolbarPortalNode, setElevationToolbarPortalNode] = useState<HTMLDivElement | null>(null);
  const [isOsFullscreen, setIsOsFullscreen] = useState(false);

  // Static SE bird's-eye render for the Project Summary page (Tommy: "a
  // static 3d rendering image from a SE birdseye view") — captured by an
  // off-screen BuildingSummaryRender instance, re-captured whenever that
  // canvas renders a frame, which under its `frameloop="demand"` is
  // whenever the scene itself changes. ⚠ This comment used to claim the
  // re-capture was driven by "the callback identity below" changing — it is
  // NOT and never was: `handleCaptureRenderImage` is a `useCallback(..., [])`
  // and its identity is stable for the life of the page, so the capture
  // fired exactly once and the summary image went stale on the first edit.
  // Measured and fixed 2026-10-03; the mechanism now lives in
  // Building3DView's CaptureFrame, which is where the comment describing it
  // belongs.
  //
  // ⚠ **It is captured only while something is LOOKING at it (2026-10-06).**
  // Profiled on a production build, one wall-height edit on a 272-panel
  // building spent **2,526ms of ~4,920ms of real work inside `toDataURL`** —
  // 51% of the edit, for a PNG that is on screen only when the Project
  // Summary note is open. So `captureLive` is that note's open state, and
  // when it is closed the capture canvas marks a ref and does no readback.
  // Tommy's own framing, 2026-10-02: *"we can compute shops upon a user
  // initiated trigger"*.
  //
  // `captureRequestId` is the trigger for the one case that needs an image
  // without anybody watching: the PDF export, which opens its sections,
  // prints, and closes them again.
  const [renderImageDataUrl, setRenderImageDataUrl] = useState<string | null>(null);
  const handleCaptureRenderImage = useCallback((dataUrl: string) => setRenderImageDataUrl(dataUrl), []);
  const [captureRequestId, setCaptureRequestId] = useState(0);
  /** Runs once when the next requested capture is finished with. A ref, not
   * state, because the export has to read it from inside a callback that was
   * created before the capture was asked for. */
  const afterCaptureRef = useRef<(() => void) | null>(null);
  const handleCaptureDone = useCallback(() => {
    const fn = afterCaptureRef.current;
    afterCaptureRef.current = null;
    fn?.();
  }, []);
  /** Ask for one capture and run `then` when it has happened. ⚠ The timeout
   * is not belt-and-braces: with no footprint there is no capture canvas
   * mounted at all, so nothing would ever call `onCaptureDone` and the
   * export would hang with the user's notes forced open. */
  const requestCaptureThen = useCallback((then: () => void) => {
    afterCaptureRef.current = then;
    setCaptureRequestId((n) => n + 1);
    window.setTimeout(() => {
      if (afterCaptureRef.current === then) {
        afterCaptureRef.current = null;
        then();
      }
    }, 4000);
  }, []);

  // Compass widget (Tommy: "spiffy the screen adjustment tools into a
  // compass widget... always corresponding to the camera angle, even
  // rotating in 3D") — Building3DView writes to this ref's DOM node
  // directly every frame while orbiting (see CompassTracker there); reset
  // to 0deg (up = North) when back in 2D, which has no camera rotation.
  const compassNeedleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewMode === "plan" && compassNeedleRef.current) {
      compassNeedleRef.current.style.transform = "rotate(0deg)";
    }
  }, [viewMode]);

  useEffect(() => {
    const onFullscreenChange = () => setIsOsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleToggleOsFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void pageRef.current?.requestFullscreen();
    }
  };

  // Save/Load a project file (Tommy: "a saveable file that the user or
  // anyone could upload and look at the plans for") — every input above
  // that shapes the design, bundled into one downloadable JSON file and
  // restorable from one, so a design can be handed off or resumed later
  // without redrawing/re-selecting anything.
  // The design as one ProjectState. Save Project and Save to cloud both
  // serialize exactly this, so the cloud document is the local file's document.
  const buildProjectState = (): ProjectState => {
    // Stage 3's opening memory, with any wall id the footprint no longer has
    // dropped. Wall ids are reused, so a memory outliving its wall would
    // resurrect a window on an unrelated one — see the module's own doc
    // comment, which also records the one gap this does NOT close.
    const prunedOpeningMemory = pruneOpeningMemoryToLiveWalls(unbuiltOpeningsByStoryAndWallId, footprint);
    const state: ProjectState = {
      editorTab,
      viewMode,
      shapeTool,
      footprint,
      isBumpedOut,
      primaryCornerIds,
      offsetPx,
      baseWallSlots,
      leastAccessibleCorner,
      standardWidthIn,
      thicknessIn,
      densityLbFt3,
      wallHeightFt,
      maxPanelHeightIn,
      includeNailer,
      checkedInteriorIds,
      checkedExteriorIds,
      season,
      seismicZone,
      foundationTypeId,
      pierSpacingFt,
      zipCode,
      role,
      unitSystem,
      priceModifier,
      floorSystemId,
      perpendicular2x4Enabled,
      roofSystemTypeId,
      roofProfileType,
      roofProfilePointHeightsFt,
      gableProfilePositionsInByWallId,
      gableWindowAnchorsByWallId,
      maxGablePanelHeightIn,
      trussPlateInsetIn,
      heelHeightIn,
      roofBearingAnchorMode,
      boxBeamCoverageByWallId,
      boxBeamSizeId,
      midWallBeamsByStoryAndWallId,
      spanningHeadersByStoryAndWallId,
      roofCatcherBeamOffsetIn,
      roofCatcherBeamShape,
      octagonRingDiameterFt,
      roofTrussCategory,
      selectedClassicTrussId,
      highPerfTrussTypeId,
      highPerfTrussCavityDepthIn,
      highPerfTrussBearingShapeId,
      roofTrussSpacingIn,
      roofTrussDoublingStrategy,
      baleFoundationTopDepthIn,
      baleFoundationBottomDepthIn,
      baleFoundationGapIn,
      baleFoundationFieldSpacingIn,
      floorBottomSkinEnabled,
      gableEndWallIds,
      gableStructuralPanelWallIds,
      stories,
      panelizationType,
      timberFrameCurtainPanelType,
      timberFrameCurtainWidthIn,
      nailerOffsetIn,
      squareBaleStudConfig,
      bracingStyle,
      projectName,
      wallsEnabled,
      floorsEnabled,
      roofEnabled,
      foundationEnabled,
      wallRunStopsByWallId,
      unbuiltOpeningsByStoryAndWallId: prunedOpeningMemory,
      // Stage 4d: the panels each run stop set aside. Document state — a
      // project saved with a stop must still restore them when it is reduced.
      stoppedSlotsByStoryAndWallId,
      wallReviewNotes,
      tilingBasis,
    };
    return state;
  };

  const handleSaveProject = () => {
    const state = buildProjectState();
    // One timestamp for both: the downloaded file's savedAt IS what the title
    // block now shows, rather than a second `new Date()` a moment apart.
    const projectFile = serializeProject(state);
    // Known and accepted (Tommy, 2026-09-13): the browser does not report a
    // cancelled download, so a cancelled Save still moves the title-block
    // date to this save time even though no file was written.
    dispatchDocumentSession({ type: "local-save", savedAt: projectFile.savedAt });
    const blob = new Blob([JSON.stringify(projectFile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "building-integrity-project.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  // ONE apply for every action that replaces the whole design: Load Project
  // and Open from cloud (spec: "extract those setters into one shared apply
  // function rather than copying them"). The only difference between the two
  // callers is the viewer role — a cloud open ignores the document's `role`
  // and keeps the viewer's own toggle (Roles, decision 9), because opening a
  // colleague's project must not silently re-skin your session.
  /* UNDO / REDO. The history lives in a ref, not in state: it changes on
     every edit and nothing renders from it except two booleans, so holding
     it in state would re-render this whole file for a stack nobody looks at.
     See `undoHistory.ts` for why a whole ProjectState per entry is cheap. */
  const historyRef = useRef<UndoHistory>(emptyUndoHistory);
  const restoringRef = useRef(false);
  const coalesceTimerRef = useRef<number | null>(null);
  const [undoAvailability, setUndoAvailability] = useState({ undo: false, redo: false });
  const syncUndoAvailability = () => {
    const next = { undo: historyCanUndo(historyRef.current), redo: historyCanRedo(historyRef.current) };
    setUndoAvailability((prev) => (prev.undo === next.undo && prev.redo === next.redo ? prev : next));
  };

  /** How long a burst of changes is allowed to settle into ONE undo entry.
   * Tommy, asked about granularity: *"whatever is a good balance of user
   * friendly and computing power. 6 times a second?"* — and the recorded
   * recommendation splits that: ~6/sec is right for committing a live drag,
   * but the UNDO STACK gets one entry per gesture, because 6/sec would need
   * eighteen undos to take back a three-second drag. A trailing debounce is
   * how a continuous gesture becomes one entry here. */
  const UNDO_COALESCE_MS = 500;

  const applyProjectState = (
    s: ProjectState,
    {
      applyRole,
      /** UNDO: false leaves the user where they are standing. Restoring a
       * document must not yank them to another tab or re-arm a tool they
       * put down — that would be undoing something they did not do. Loading
       * a FILE still passes true, because then the whole point is to go
       * where that file was. */
      applyViewState = true,
    }: { applyRole: boolean; applyViewState?: boolean },
  ) => {
    if (applyViewState) {
      setEditorTab(s.editorTab);
      setViewMode(s.viewMode);
      setShapeTool(s.shapeTool);
    }
    setFootprint(s.footprint);
    setIsBumpedOut(s.isBumpedOut);
    setPrimaryCornerIds(s.primaryCornerIds);
    setOffsetPx(s.offsetPx);
    // Old saves (predating braced state becoming real stored data) have
    // zero "braced" slots in baseWallSlots — run the one-time seed pass
    // per wall so they come back looking exactly as they would have
    // rendered pre-change (the old derived-overlay system, using this
    // same file's own seismicZone/bracingStyle). Newer saves (already
    // carrying real per-slot braced state) pass through untouched — see
    // bracedStateSeeded's own doc comment in projectFile.ts.
    if (s.bracedStateSeeded) {
      setBaseWallSlots(s.baseWallSlots);
    } else {
      const { pattern: loadDefaultPattern, mirrored: loadDefaultMirrored } = bracingStyleToPatternMirror(s.bracingStyle);
      const loadSpacingIn = seismicBracedPanelSpacingFt[s.seismicZone] * 12;
      // The pins come out of the FILE, not out of live state: this runs
      // inside the same handler that is still setting that state, so the
      // live `slotIndexPinnedWallIds` memo is one render behind and would
      // report the PREVIOUS project's beams.
      const loadPinnedWallIds = pinnedSlotIndexWallIds({
        boxBeamCoverageByWallId: s.boxBeamCoverageByWallId,
        rangesByStoryAndWallId: [
          s.midWallBeamsByStoryAndWallId,
          { ground: s.spanningHeadersByStoryAndWallId?.ground ?? {}, second: s.spanningHeadersByStoryAndWallId?.second ?? {} },
        ],
      });
      const seeded: Record<string, PanelSlot[]> = {};
      for (const [wallId, slots] of Object.entries(s.baseWallSlots)) {
        seeded[wallId] = reconcileBracedPlacement(undefined, slots, loadSpacingIn, s.standardWidthIn, loadDefaultPattern, loadDefaultMirrored, loadPinnedWallIds.has(wallId));
      }
      setBaseWallSlots(seeded);
    }
    setLeastAccessibleCorner(s.leastAccessibleCorner);
    setStandardWidthIn(s.standardWidthIn);
    setThicknessIn(s.thicknessIn);
    setDensityLbFt3(s.densityLbFt3);
    setWallHeightFt(s.wallHeightFt);
    setMaxPanelHeightIn(s.maxPanelHeightIn ?? standardPanelHeightIn.value);
    setIncludeNailer(s.includeNailer);
    setCheckedInteriorIds(s.checkedInteriorIds);
    setCheckedExteriorIds(s.checkedExteriorIds);
    setSeason(s.season);
    setSeismicZone(s.seismicZone);
    setFoundationTypeId(s.foundationTypeId as typeof foundationTypeId);
    setPierSpacingFt(s.pierSpacingFt);
    setZipCode(s.zipCode);
    if (applyRole) setRole(s.role);
    if (applyViewState) setUnitSystem(s.unitSystem);
    setPriceModifier(s.priceModifier);
    setFloorSystemId(s.floorSystemId as typeof floorSystemId);
    setPerpendicular2x4Enabled(s.perpendicular2x4Enabled);
    setRoofProfileType(s.roofProfileType);
    setRoofProfilePointHeightsFt(s.roofProfilePointHeightsFt);
    setGableProfilePositionsInByWallId(s.gableProfilePositionsInByWallId);
    setGableWindowAnchorsByWallId(s.gableWindowAnchorsByWallId ?? {});
    setMaxGablePanelHeightIn(s.maxGablePanelHeightIn);
    setTrussPlateInsetIn(s.trussPlateInsetIn);
    setHeelHeightIn(s.heelHeightIn);
    setRoofBearingAnchorMode(s.roofBearingAnchorMode ?? "truss-heel");
    setBoxBeamCoverageByWallId(s.boxBeamCoverageByWallId);
    setBoxBeamSizeId(s.boxBeamSizeId);
    setMidWallBeamsByStoryAndWallId(s.midWallBeamsByStoryAndWallId);
    // Stage 2b's optional key — a file saved before spanning headers existed
    // simply has none, which is today's behaviour exactly. Normalized here
    // (rather than in the parser, which must return what the file actually
    // says) so state always has both halves.
    setSpanningHeadersByStoryAndWallId({
      ground: s.spanningHeadersByStoryAndWallId?.ground ?? {},
      second: s.spanningHeadersByStoryAndWallId?.second ?? {},
    });
    setRoofCatcherBeamOffsetIn(s.roofCatcherBeamOffsetIn);
    setRoofCatcherBeamShape(s.roofCatcherBeamShape);
    setOctagonRingDiameterFt(s.octagonRingDiameterFt);
    setRoofTrussCategory(s.roofTrussCategory ?? "classic");
    setSelectedClassicTrussId(s.selectedClassicTrussId ?? "king-post");
    setHighPerfTrussTypeId(s.highPerfTrussTypeId ?? "energy-heel");
    setHighPerfTrussCavityDepthIn(s.highPerfTrussCavityDepthIn ?? 18);
    setHighPerfTrussBearingShapeId(s.highPerfTrussBearingShapeId ?? "built-up-3ply-2x12");
    setRoofTrussSpacingIn(s.roofTrussSpacingIn ?? ROOF_TRUSS_SPACING_DEFAULT_IN);
    setRoofTrussDoublingStrategy(s.roofTrussDoublingStrategy ?? "single");
    setBaleFoundationTopDepthIn(s.baleFoundationTopDepthIn ?? BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN);
    setBaleFoundationBottomDepthIn(s.baleFoundationBottomDepthIn ?? BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN);
    setBaleFoundationGapIn(s.baleFoundationGapIn ?? BALE_FOUNDATION_GAP_DEFAULT_IN);
    setBaleFoundationFieldSpacingIn(s.baleFoundationFieldSpacingIn ?? BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN);
    setFloorBottomSkinEnabled(s.floorBottomSkinEnabled ?? true);
    setGableEndWallIds(s.gableEndWallIds);
    setGableStructuralPanelWallIds(s.gableStructuralPanelWallIds ?? new Set());
    setSecondStory(s.stories[1] ?? null);
    setPanelizationType(s.panelizationType);
    setTimberFrameCurtainPanelType(s.timberFrameCurtainPanelType);
    setTimberFrameCurtainWidthIn(s.timberFrameCurtainWidthIn);
    setNailerOffsetIn(s.nailerOffsetIn);
    setSquareBaleStudConfig(s.squareBaleStudConfig);
    setBracingStyle(s.bracingStyle);
    setProjectName(s.projectName);
    setWallsEnabled(s.wallsEnabled);
    setFloorsEnabled(s.floorsEnabled);
    setRoofEnabled(s.roofEnabled);
    // parseProjectFile has already defaulted a v24 file's missing key to
    // `true` — see its own v24->v25 note. The `?? true` here is the same
    // answer for the one other caller (a state object built by hand).
    setFoundationEnabled(s.foundationEnabled ?? true);
    setWallRunStopsByWallId(s.wallRunStopsByWallId ?? {});
    // Stage 3's optional opening memory — a file saved before it existed
    // simply withheld nothing, which is today's behaviour exactly. Normalized
    // here (rather than in the parser, which must return what the file
    // actually says) so state always has both halves.
    setUnbuiltOpeningsByStoryAndWallId({
      ground: s.unbuiltOpeningsByStoryAndWallId?.ground ?? {},
      second: s.unbuiltOpeningsByStoryAndWallId?.second ?? {},
    });
    /* Stage 4d, normalized the same way and for the same reason: absent means
       nothing is stopped aside, which is every file saved before today. */
    setStoppedSlotsByStoryAndWallId({
      ground: s.stoppedSlotsByStoryAndWallId?.ground ?? {},
      second: s.stoppedSlotsByStoryAndWallId?.second ?? {},
    });
    setWallReviewNotes(s.wallReviewNotes ?? []);
    // Absent on every file saved before R0: the basis is UNKNOWN, which
    // claims nothing. See this key's own note in projectFile.ts for why it
    // is not defaulted to the file's live settings.
    setTilingBasis(s.tilingBasis ?? null);
  };

  const handleLoadFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same filename later
    if (!file) return;
    file.text().then((raw) => {
      const result = parseProjectFile(raw);
      if (!result.ok) {
        // A rejected Load writes nothing: the date and any cloud project stay.
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      // Also clears the cloud project: a local file is not a version of it,
      // and must never be appended into it by the next Save to cloud.
      dispatchDocumentSession({ type: "local-load", savedAt: result.savedAt });
      applyProjectState(result.state, { applyRole: true });
    });
  };

  // Stage 2B: Save to cloud, Open from cloud and folders (Project ▾ only —
  // nothing new on the bar). The document it saves is Save Project's, built the
  // same way; the design it opens is applied with the same setters as Load.
  const cloud = useCloudProjects({
    documentSession,
    readDocumentSession,
    dispatch: dispatchDocumentSession,
    editorProjectName: projectName,
    setEditorProjectName: setProjectName,
    buildProjectFile: () => serializeProject(buildProjectState()),
    applyCloudState: (state) => {
      // An open replaces the design exactly as a Load does, so a stale Load
      // error must not stay on screen over it.
      setLoadError(null);
      applyProjectState(state, { applyRole: false });
    },
    downloadProjectFile: () => handleSaveProject(),
  });

  const interior = mostRestrictiveLayer(interiorLayers, checkedInteriorIds, season) ?? UNRATED_SENTINEL;
  const exterior = mostRestrictiveLayer(exteriorLayers, checkedExteriorIds, season) ?? { ...UNRATED_SENTINEL, side: "exterior" as const };
  const foundationType = foundationTypes.find((f) => f.id === foundationTypeId)!;
  const foundationFasteners = foundationFastenerSchedule(foundationType, fastenerSpacingTable);

  const pierGrid = useMemo(
    () => (footprint && foundationType.usesPierGrid ? computePierGrid(footprint, pierSpacingFt) : []),
    [footprint, foundationType, pierSpacingFt],
  );

  // Floor panels tile the same bay grid the piers sit at the corners of —
  // Floor "intakes most of its prompts from the foundation editor"
  // (Tommy), so this shares pierSpacingFt rather than having its own control.
  const floorPanels = useMemo(
    () => (footprint && foundationType.usesPierGrid ? computeFloorPanelGrid(footprint, pierSpacingFt) : []),
    [footprint, foundationType, pierSpacingFt],
  );

  const elevationWall = footprint && elevationViewWallId ? (footprint.walls.find((w) => w.id === elevationViewWallId) ?? null) : null;

  // Every view stop, in Tommy's order (his words, from when this was a dial:
  // "cycle the wall view options... starting at the top and going clockwise,
  // and the wheel moves onto 3D views") — 2D Floor Plan, then one elevation
  // stop per wall in the same order the footprint already lists them (compass
  // order for the common rectangle/octagon cases), then the three 3D modes.
  //
  // THE TOP BAR'S Design AND View MENUS ARE THE ONLY PRESENTATION OF THIS LIST
  // (the sidebar dial was removed 2026-09-28). `viewerMenus.ts` splits it by
  // filtering this array, so the two menus together are exactly this list — and
  // a stop missing from here is a stop nobody can reach at all.
  /* ⚠ THE ELEVATION STOPS READ COMPASS LABELS, NOT WALL IDS — Tommy,
     2026-10-18: "Labeling walls Ab, BC etc. makes it difficult for me to
     conceptualize which elevation view I want to look at and which wall is
     which wall."

     The naming itself is not new — `wallCompassDirection` has produced
     N/NE/E/... since before he asked, and the shop has been reading it on
     panel names and sheet headers for weeks. The EDITOR was the last place
     still showing the internal id, so the app had two vocabularies and gave
     the shop the better one.

     ⚠ Not memoized, deliberately. `wallDisplayLabelsByWallId` walks at most
     eight walls, and a new `useMemo` in this file costs
     `react-hooks/preserve-manual-memoization` errors it does not need to — see
     AGENTS.md. It is computed where it is used instead. */
  const wallLabels = footprint ? wallDisplayLabelsByWallId(footprint) : {};
  // See viewerMenus.ts.
  const viewerStops = useMemo<ViewerStop[]>(
    () => [
      { kind: "plan" },
      ...(footprint?.walls.map((w) => ({
        kind: "elevation" as const,
        wallId: w.id,
        label: wallDisplayLabelsByWallId(footprint)[w.id] ?? w.id,
      })) ?? []),
      { kind: "3d-framed" },
      { kind: "3d-boxes" },
      { kind: "3d-wraps" },
    ],
    [footprint],
  );
  const currentViewerStop: ViewerStop = elevationViewWallId
    ? { kind: "elevation", wallId: elevationViewWallId, label: wallLabels[elevationViewWallId] ?? elevationViewWallId }
    : viewMode === "plan"
      ? { kind: "plan" }
      : showWraps
        ? { kind: "3d-wraps" }
        : simplified3D
          ? { kind: "3d-boxes" }
          : { kind: "3d-framed" };
  const handleViewerStopChange = (stop: ViewerStop) => {
    if (stop.kind === "elevation") {
      setElevationViewWallId(stop.wallId);
      return;
    }
    setElevationViewWallId(null);
    if (stop.kind === "plan") {
      setViewMode("plan");
      setShowWraps(false);
    } else {
      setViewMode("3d");
      setSimplified3D(stop.kind === "3d-boxes" || stop.kind === "3d-wraps");
      setShowWraps(stop.kind === "3d-wraps");
    }
  };

  const floorJoistTypeId = floorSystemId && floorSystemId !== "thermal-slab" && floorSystemId !== "bale-foundation" ? floorSystemId : null;
  const floorJoistType = floorJoistTypeId ? floorJoistTypes.find((t) => t.id === floorJoistTypeId)! : null;
  const isThermalSlabFloor = floorSystemId === "thermal-slab";
  const isBaleFoundationFloor = floorSystemId === "bale-foundation";
  // "Show all detail pages" (Tommy, fabricator/admin only) previews the
  // floor-system detail pages even before a floor type/option is actually
  // selected on the Floor tab — using a representative catalog default for
  // documentation purposes only. This never touches `floorJoistType`/
  // `isThermalSlabFloor`/`perpendicular2x4Enabled` themselves, so every
  // real calculation (joist layout, material totals, etc.) still reflects
  // only what the user actually selected.
  const canPreviewAllDetailPages = showAllDetailPages && role !== "public";
  const docFloorJoistType = floorJoistType ?? (canPreviewAllDetailPages ? floorJoistTypes[0]! : null);
  const docIsThermalSlabFloor = isThermalSlabFloor || canPreviewAllDetailPages;
  const docPerpendicular2x4Enabled = perpendicular2x4Enabled || canPreviewAllDetailPages;
  const joistLayout = useMemo(
    () => (footprint && floorJoistType ? computeJoistLayout(footprint, floorJoistType.spacingIn) : null),
    [footprint, floorJoistType],
  );
  const fieldJoistDepthIn = thicknessIn - FIELD_JOIST_DEPTH_REDUCTION_IN;

  // Bale Foundation rings — the two doubled rings BRACKET the wall (Tommy:
  // "these two large pieces (or LVL's if thats selected) are flush with the
  // exterior and interior of the panel wall"): Ring A's outboard face on the
  // wall's exterior face, Ring B's inboard face on its interior face. Every
  // inset comes from baleFoundationRingPlan — the SAME derivation
  // Building3DView's baleFoundationRenderData reads, so the 2D canvas and
  // the 3D preview cannot drift apart about where a ring is (they were two
  // independent copies of this arithmetic before, and had). Each ring is a
  // DOUBLED pair (2 stacks side by side, touching — see
  // buildDoubledStackPair's own doc comment on the 0-gap default), so its
  // "inner" sub-line is the same ring offset one board thickness further in,
  // reusing computeInsetPerimeterRing rather than new offset math. Single
  // field stacks fill the interior span inboard of the inner ring.
  const baleFoundationPlan = useMemo(() => baleFoundationRingPlan(thicknessIn), [thicknessIn]);
  const baleFoundationRings = useMemo(
    () =>
      footprint && isBaleFoundationFloor
        ? baleFoundationPlan.rings.map((ring) => ({
            name: ring.name,
            outer: computeInsetPerimeterRing(footprint, ring.insetIn, primaryCornerIds),
            inner: computeInsetPerimeterRing(footprint, ring.innerInsetIn, primaryCornerIds),
          }))
        : null,
    [footprint, isBaleFoundationFloor, baleFoundationPlan, primaryCornerIds],
  );
  // A collapsed plan (a wall too thin to hold two rings — see
  // baleFoundationRingPlan) carries ring "a" only, so a missing "b" is a
  // real state here, not a failure to compute one.
  const baleFoundationRingA = baleFoundationRings?.find((r) => r.name === "a") ?? null;
  const baleFoundationRingB = baleFoundationRings?.find((r) => r.name === "b") ?? null;
  const baleFoundationFieldLayout = useMemo(
    () =>
      footprint && isBaleFoundationFloor
        ? computeFieldFramingLayout(footprint, baleFoundationPlan.fieldInsetIn, baleFoundationFieldSpacingIn)
        : [],
    [footprint, isBaleFoundationFloor, baleFoundationPlan, baleFoundationFieldSpacingIn],
  );
  const baleFoundationStackHeightIn = baleFoundationTopDepthIn + baleFoundationGapIn + baleFoundationBottomDepthIn;
  // One stack's own cross-section: its top + bottom boards, each one board
  // thickness wide — read off the same plan the insets come from, never a
  // literal, so a material change moves the quantities and the geometry
  // together.
  const baleFoundationStackCrossSectionIn2 =
    (baleFoundationTopDepthIn + baleFoundationBottomDepthIn) * baleFoundationPlan.boardThicknessIn;
  // 4 boards per ring per cross-section (2 doubled stacks x 2 boards each
  // — Tommy: "my double double really means double double double"), over
  // however many rings the plan has, plus the single field stacks (2 boards
  // each) inboard of the inner ring.
  const baleFoundationBoardCount = baleFoundationRings
    ? baleFoundationRings.reduce((sum, ring) => sum + ring.outer.length * 4, 0) + baleFoundationFieldLayout.length * 2
    : 0;
  const baleFoundationLumberVolumeFt3 = baleFoundationRings
    ? (baleFoundationRings.reduce((sum, ring) => sum + ring.outer.reduce((s, seg) => s + seg.lengthFt, 0), 0) *
        2 *
        baleFoundationStackCrossSectionIn2 +
        baleFoundationFieldLayout.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0) *
          baleFoundationStackCrossSectionIn2) /
      144
    : 0;

  // Only concrete piers contribute embodied-carbon emissions here — the
  // helical-screw crawlspace is steel, not concrete, so it nets 0.
  const concretePierVolumeFt3 =
    foundationTypeId === "concrete-pier"
      ? computeConcretePierVolume(pierGrid.length, concretePierDimensions.diameterIn, concretePierDimensions.depthFt)
          .totalVolumeFt3
      : 0;

  const spacingIn = seismicBracedPanelSpacingFt[seismicZone] * 12;
  // The seismic-zone-driven spacing/corner rule now only SEEDS a brand-new
  // standard slot's initial suggestion (Tommy: "softly decouple [it] to be
  // an original suggestion for autopopulating panels, but then allows the
  // user to change each panel") — bracingStyle (the "Bracing style"
  // toolbar) supplies which pattern/mirror a fresh suggestion uses; it no
  // longer forces every braced panel project-wide (see reconcileBracedPlacement).
  const { pattern: defaultBracePattern, mirrored: defaultBracedMirrored } = bracingStyleToPatternMirror(bracingStyle);
  const bracedSeed = { spacingIn, defaultPattern: defaultBracePattern, defaultMirrored: defaultBracedMirrored };
  /** Walls whose slot INDICES are pinned by persisted per-slot state, so the
   * corner-brace combine is refused on them rather than allowed to remove a
   * panel from under a stored index — see `pinnedSlotIndexWalls.ts` for the
   * whole reasoning, and the `cornerBraceCombineRefusals` memo below for where
   * a user is told. Derived, never stored.
   *
   * A fresh `handleDraw` now clears all three records it reads, so a wall id
   * cannot stay pinned by a beam or a header belonging to a building that no
   * longer exists — see the reset in `handleDraw`, which is there for the
   * stale RANGES rather than for the pin. */
  const slotIndexPinnedWallIds = useMemo(
    () =>
      pinnedSlotIndexWallIds({
        boxBeamCoverageByWallId,
        rangesByStoryAndWallId: [midWallBeamsByStoryAndWallId, spanningHeadersByStoryAndWallId],
      }),
    [boxBeamCoverageByWallId, midWallBeamsByStoryAndWallId, spanningHeadersByStoryAndWallId],
  );

  // Closes an existing gap: only a Mid-Wall Bond Beam change actually
  // persisted zone reconciliation into state before this (see
  // reconcileWallZonesForBeamChange above) — a maxPanelHeightIn or
  // wall-height change only ever produced a fresh zone through
  // effectiveZonesForSlot's per-render fallback, never written back until
  // a user manually clicked it. `old*`/`new*` are the pre/post-change
  // values of whichever one input actually changed for THIS one wall —
  // `Number.POSITIVE_INFINITY` as `oldMaxHeightIn` forces a single
  // (un-split) old band always, letting a caller simulate "this wall had
  // no zone data yet" for a genuinely brand-new wall (see
  // `reconcileNewWallZones` below) without a separate code path.
  const reconcileOneWallZonesForHeightChange = (
    story: "ground" | "second",
    wallId: string,
    slots: PanelSlot[],
    oldMaxHeightIn: number,
    newMaxHeightIn: number,
    oldWallHeightFt: number,
    newWallHeightFt: number,
  ): PanelSlot[] => {
    const geom = midWallBeamsToGeometry(midWallBeamsByStoryAndWallId[story][wallId] ?? []);
    const oldStoryHeightIn = oldWallHeightFt * 12;
    const newStoryHeightIn = newWallHeightFt * 12;
    // Which columns just gained a genuinely NEW zone-1 (Tommy: "a shorter
    // than standard height additional row spawns") — the same "only seed
    // a position that wasn't already decided" precedent
    // reconcileBracedPlacement follows for zone 0.
    const newlyEligibleZone1Indices = new Set<number>();
    const perSlotZones = slots.map((slot, i) => {
      const oldBands = computeWallVerticalBandsForSlotWithMaxHeight(i, oldStoryHeightIn, geom, oldMaxHeightIn, panelHeightInRange.minIn);
      const oldZones = effectiveZonesForSlot(slot, oldBands.length);
      const newBands = computeWallVerticalBandsForSlotWithMaxHeight(i, newStoryHeightIn, geom, newMaxHeightIn, panelHeightInRange.minIn);
      const newZones = reconcilePanelSlotZones(oldBands, oldZones, newBands);
      if (oldBands.length < 2 && newBands.length >= 2) newlyEligibleZone1Indices.add(i);
      return { slot, newZones };
    });

    if (newlyEligibleZone1Indices.size > 0) {
      const parentSlotTypes = perSlotZones.map(({ slot }) => slot.type);
      const parentWidthsIn = perSlotZones.map(({ slot }) => slot.widthIn);
      let zone1: (PanelSlotZone | undefined)[] = perSlotZones.map(({ newZones }) => newZones[1]);

      // A wall that already has a ground-zone (Stride 1) window gets a 2nd
      // one in its own newly-appearing upper zone — one per zone (Tommy:
      // "one window on every row of slots... one more if greater than
      // 16ft wall") — picked before the bracing pass below runs, same
      // "window claims its spot first, bracing routes around it" order
      // Stride 1's own seedDefaultOpenings uses.
      const hasGroundWindow = perSlotZones.some(({ newZones }) => newZones[0]?.type === "window");
      if (hasGroundWindow) {
        const candidateIndices: number[] = [];
        zone1.forEach((z, i) => {
          if (!newlyEligibleZone1Indices.has(i)) return;
          if (parentSlotTypes[i] === "corner" || parentSlotTypes[i] === "safety-oct-corner") return;
          if ((z?.type ?? "standard") !== "standard") return;
          candidateIndices.push(i);
        });
        // Excludes the first/last 2 — mirrors the doubled near-corner
        // brace count this same zone level uses (see
        // applyAdditionalRowBracedPattern), same "never at a
        // corner-touching position" rule Stride 1 already follows.
        const windowCandidates = candidateIndices.slice(2, -2);
        if (windowCandidates.length > 0) {
          const pick = windowCandidates[Math.floor(Math.random() * windowCandidates.length)]!;
          zone1 = zone1.map((z, i) => (i === pick ? { type: "window" as const } : z));
        }
      }

      const bracedZone1 = applyAdditionalRowBracedPattern(
        zone1,
        parentSlotTypes,
        parentWidthsIn,
        spacingIn,
        defaultBracePattern,
        defaultBracedMirrored,
        newlyEligibleZone1Indices,
      );
      perSlotZones.forEach((entry, i) => {
        entry.newZones = entry.newZones.map((z, zi) => (zi === 1 ? bracedZone1[i]! : z));
      });
    }

    return perSlotZones.map(({ slot, newZones }) => applyZonesToSlot(slot, newZones));
  };

  // Loops every wall of `story` (unlike reconcileOneWallZonesForHeightChange,
  // which only ever touches one) — a height/max-height change moves every
  // wall's own band boundaries at once. Used by the 3 named setters below,
  // and by handleDraw (every wall there is genuinely brand-new, so
  // Infinity-as-old-max is correct for all of them at once — see that
  // call site).
  const reconcileWallZonesForHeightChange = (
    story: "ground" | "second",
    oldMaxHeightIn: number,
    newMaxHeightIn: number,
    oldWallHeightFt: number,
    newWallHeightFt: number,
  ) => {
    setWallSlotsForStory(story, (prev) => {
      const next: Record<string, PanelSlot[]> = {};
      for (const [wallId, slots] of Object.entries(prev)) {
        next[wallId] = reconcileOneWallZonesForHeightChange(story, wallId, slots, oldMaxHeightIn, newMaxHeightIn, oldWallHeightFt, newWallHeightFt);
      }
      return next;
    });
  };

  // A single genuinely brand-new wall (no prior slots at all — a
  // bump-out's own new jog wall) can itself already be tall enough for
  // 2+ zones. Deliberately per-wall, NOT the blanket
  // reconcileWallZonesForHeightChange above — most walls in a bump-out
  // DO have prior slots (preserved via retilePreservingOpenings), and
  // forcing Infinity-as-old-max on THEM would wrongly treat their real,
  // already-decided upper-zone data as brand new and re-seed over it.
  const reconcileNewWallZones = (story: "ground" | "second", wallId: string) => {
    const wallHeightFtForStory = story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt);
    setWallSlotsForStory(story, (prev) => {
      const slots = prev[wallId];
      if (!slots) return prev;
      const nextSlots = reconcileOneWallZonesForHeightChange(
        story,
        wallId,
        slots,
        Number.POSITIVE_INFINITY,
        maxPanelHeightIn,
        wallHeightFtForStory,
        wallHeightFtForStory,
      );
      return { ...prev, [wallId]: nextSlots };
    });
  };

  const handleSetWallHeightFt = (nextFt: number) => {
    const oldFt = wallHeightFt;
    setWallHeightFt(nextFt);
    reconcileWallZonesForHeightChange("ground", maxPanelHeightIn, maxPanelHeightIn, oldFt, nextFt);
  };
  const handleSetSecondStoryWallHeightFt = (nextFt: number) => {
    const oldFt = secondStory?.wallHeightFt ?? wallHeightFt;
    setSecondStory((prev) => (prev ? { ...prev, wallHeightFt: nextFt } : prev));
    reconcileWallZonesForHeightChange("second", maxPanelHeightIn, maxPanelHeightIn, oldFt, nextFt);
  };
  const handleSetMaxPanelHeightIn = (rawNextIn: number) => {
    const oldMaxHeightIn = maxPanelHeightIn;
    const nextMaxHeightIn = Math.min(Math.max(rawNextIn, panelHeightInRange.minIn), panelHeightInRange.maxIn);
    setMaxPanelHeightIn(nextMaxHeightIn);
    reconcileWallZonesForHeightChange("ground", oldMaxHeightIn, nextMaxHeightIn, wallHeightFt, wallHeightFt);
    if (secondStory) {
      reconcileWallZonesForHeightChange("second", oldMaxHeightIn, nextMaxHeightIn, secondStory.wallHeightFt, secondStory.wallHeightFt);
    }
  };

  // `cornerOwnership`/`retile`/`wallGeometryFor` (imported above) are pure
  // functions from the geometry package — corner-ownership rules,
  // safety/gap-panel placement, per-wall tiling (see
  // packages/geometry/src/retile.ts for the full rationale, including the
  // reflex-corner gap fix that was originally verified by direct pixel
  // measurement). They take this component's panel parameters as explicit
  // arguments rather than closing over them, so these names are
  // intentionally shadowed for the rest of this component with thin
  // partial applications supplying `thicknessIn`/`standardWidthIn`/
  // `cornerPanelWidthIn`/`bracedSeed` — every call site below already
  // expects the closure-capturing signature these provide.
  //
  // (A `cornerOwnership` wrapper used to sit here too. Its last caller was
  // `wallRenderOffsetIn`, which now reads `runStartOffsetIn` off
  // `wallGeometryFor` so that the inset, the reflex extension and the Stage 3
  // stop are folded in one place. Removed rather than left unused.)
  // `{}` (default randomFn = Math.random) — Tommy's own confirmed soft
  // default: every freshly-tiled wall gets 1 default window, plus 1
  // default door on an East/South/West-facing wall. See retile.ts's own
  // `seedDefaultOpenings` doc comment for why this only ever affects a
  // wall with no prior slots to preserve.
  const openingSeed: OpeningSeed = {};
  // Stage 3's run stops ride along on all three wrappers, defaulting to the
  // live `wallRunStopsByWallId`. The explicit override exists because React
  // state is not readable back in the same tick: the handful of paths that
  // rebuild or renumber wall ids have to hand the NEXT stop map to the
  // retile they run in that same handler, not the stale one in the closure.
  const retile = (
    fp: Footprint,
    leastAccessible: CornerId,
    primary: Set<string>,
    runStops: Record<string, WallRunStop> = wallRunStopsByWallId,
  ): Record<string, PanelSlot[]> =>
    retilePure(
      fp,
      leastAccessible,
      primary,
      standardWidthIn,
      cornerWidthInForTiling,
      thicknessIn,
      bracedSeed,
      openingSeed,
      runStops,
      cornerMayWidenForTiling,
      slotIndexPinnedWallIds,
    );
  // Same as `retile` above, but preserves each wall's existing openings —
  // see retile.ts's own doc comment. `oldSlotsByNewWallId` resolves the
  // old-to-new wall correlation; for an id-stable operation (dragWall,
  // editWallLength) callers just pass `baseWallSlots` straight through.
  //
  // **⚠ It returns TWO things now, and a caller must write back both.** Since
  // Stage 3's "drop them, and remember" decision, an opening inside a wall's
  // unbuilt span leaves the slots and is handed back in
  // `unbuiltOpeningsByWallId` instead. Writing the slots and dropping the
  // memory would be exactly the window-data loss that decision rules out, so
  // `applyRetiledStory` below does both at once and every caller goes through
  // it. `remembered` defaults to the live memory for that story — pass it
  // explicitly only where wall ids are being renumbered, since a memory keyed
  // by a stale id restores the wrong wall's window.
  const retilePreservingOpenings = (
    fp: Footprint,
    leastAccessible: CornerId,
    primary: Set<string>,
    oldSlotsByNewWallId: Record<string, PanelSlot[] | undefined>,
    runStops: Record<string, WallRunStop> = wallRunStopsByWallId,
    story: "ground" | "second" = "ground",
    remembered: Record<string, RunStopOpeningMemory> = unbuiltOpeningsByStoryAndWallId[story],
  ): RetileWithRunStopMemoryResult =>
    retilePreservingOpeningsPure(
      fp,
      leastAccessible,
      primary,
      standardWidthIn,
      cornerWidthInForTiling,
      thicknessIn,
      oldSlotsByNewWallId,
      bracedSeed,
      openingSeed,
      runStops,
      cornerMayWidenForTiling,
      remembered,
      slotIndexPinnedWallIds,
    );
  /** Both halves of a re-tile written back together — the slots that are
   * built, and the openings an unbuilt span set aside. See the wrapper above
   * for why they cannot be separated. */
  /* REPANELIZE R0. Exactly the values the wrapper above binds, plus the
     least-accessible corner that travels with them — a deliberately plain
     object rather than a memo, because every reader compares its VALUES
     and none depends on its identity. */
  const liveTilingBasis: TilingBasis = {
    standardWidthIn,
    thicknessIn,
    leastAccessibleCorner,
    cornerWidthIn: cornerWidthInForTiling,
    cornerMayWiden: cornerMayWidenForTiling,
    bracedSpacingIn: bracedSeed.spacingIn,
    bracedDefaultPattern: bracedSeed.defaultPattern,
    bracedDefaultMirrored: bracedSeed.defaultMirrored,
  };
  /* REPANELIZE R1 — which settings no longer match what this building was
     panelized with. Empty whenever the basis is unknown (every project
     saved before R0, and any project not yet tiled), which claims nothing
     rather than claiming everything. */
  const pendingTilingFields = tilingBasisDifferences(tilingBasis, liveTilingBasis);
  const pendingControls = pendingTilingControls(pendingTilingFields);
  const pendingTilingText = pendingTilingSummary(pendingTilingFields);

  /** Called at every site that re-tiles, so the basis always describes the
   * tiling that is actually on screen. ⚠ Takes the corner ACTUALLY USED
   * rather than reading state: `handleDraw` and
   * `handleSetLeastAccessibleCorner` both re-tile with a corner the state
   * has not caught up to yet, and recording the stale one would mark the
   * setting as pending the moment it was applied. */
  const recordTilingBasis = (leastAccessibleUsed: string) => {
    setTilingBasis({ ...liveTilingBasis, leastAccessibleCorner: leastAccessibleUsed });
  };

  /* REPANELIZE R3 — the tiler, run deliberately.
     Held as the WORKED-OUT RESULT, not just a count: the comparison and the
     application must be the same tiling pass, or the user approves one thing
     and gets another. It also means confirming costs no second pass. */
  const [repanelizePrompt, setRepanelizePrompt] = useState<{
    text: string;
    changedCount: number;
    /** The one wall this will rebuild, or null for the whole building. */
    wallId: string | null;
    ground: RetileWithRunStopMemoryResult;
    /** Null when the project has no second storey. */
    second: RetileWithRunStopMemoryResult | null;
  } | null>(null);

  /**
   * Take ONE wall's slots out of a whole-building re-tile and leave every
   * other wall exactly as it was.
   *
   * ⚠ **It does NOT record a tiling basis, and that is the point.** The
   * basis is one building-wide record meaning "everything on screen was
   * built from these settings". Recording it after rebuilding a single wall
   * would clear every pending-settings marker while most of the building was
   * still on the old settings — the same false all-clear the whole-building
   * handler's own comment warns about for the second storey. The markers
   * stay up until a full Repanelize, which is the truth.
   *
   * ⚠ Untouched walls keep their IDENTITY, not just their value: every other
   * entry is the same object it already was, so memos downstream do not
   * invalidate and a 232-panel building does not re-render because one wall
   * was rebuilt.
   */
  const applyRetiledWall = (wallId: string, story: "ground" | "second", result: RetileWithRunStopMemoryResult) => {
    const next = result.slotsByWallId[wallId];
    if (!next) return;
    setWallSlotsForStory(story, (prev) => ({ ...prev, [wallId]: next }));
    /* ⚠ A WALL WITH NO MEMORY GETS ITS KEY REMOVED, NOT SET TO SOMETHING EMPTY.
       The first version wrote `?? []` here, and an empty ARRAY is not an empty
       `RunStopOpeningMemory`: the tiler asks
       `unbuiltOpeningsByWallId?.[wall.id]?.unbuilt.length`, which optional-chains
       the wall but NOT `.unbuilt` — so `[].unbuilt.length` threw, and every
       later Repanelize on the whole building died on a click with nothing shown
       to the user. Found in the browser console, not by tsc.

       ⚠ **And tsc's silence has a specific, reproducible cause worth knowing.**
       The bad value sat in NESTED computed keys —
       `{ ...prev, [story]: { ...prev[story], [wallId]: wrong } }`. Checked
       against a minimal repro: a SINGLE computed key is caught
       (`Type '{ [x: string]: Memory | never[] }' is not assignable...`), but
       nest one computed-key literal inside another and the inner value stops
       being checked against the outer type. So writing this as an assignment
       through a typed local, as below, is not merely tidier — it is the version
       the compiler actually inspects.

       Omitting the key is also the honest encoding: "this wall has no unbuilt
       openings" and "this wall has an empty record of them" are the same fact,
       and only one of them can be malformed. */
    setUnbuiltOpeningsByStoryAndWallId((prev) => {
      const forStory = { ...prev[story] };
      const memory = result.unbuiltOpeningsByWallId[wallId];
      if (memory) forStory[wallId] = memory;
      else delete forStory[wallId];
      return { ...prev, [story]: forStory };
    });
  };

  const applyRetiledStory = (
    story: "ground" | "second",
    result: RetileWithRunStopMemoryResult,
    /** ⚠ REPANELIZE R0: the least-accessible corner this result was ACTUALLY
     * TILED WITH, which is not always the one in state — `handleAddBumpOut`
     * and `handleDragWall` both re-tile with a corner the state has not
     * caught up to. Required rather than defaulted so the compiler names
     * every re-tiling site instead of letting one quietly record a stale
     * basis, which would mark a setting as pending the instant it was
     * applied. */
    leastAccessibleUsed: string,
  ) => {
    if (story === "ground") setBaseWallSlots(result.slotsByWallId);
    else setWallSlotsForStory("second", () => result.slotsByWallId);
    setUnbuiltOpeningsByStoryAndWallId((prev) => ({ ...prev, [story]: result.unbuiltOpeningsByWallId }));
    recordTilingBasis(leastAccessibleUsed);
  };


  /** `runStops` is the WHOLE map, not one wall's record: since the
   * orphan-corner rule a stop on the neighbour changes this wall's own inset
   * (see `cornerOwnershipWithRunStops`). Callers exploring a CANDIDATE stop
   * pass a copy of the map with that one wall replaced, so the candidate is
   * evaluated with its cross-wall effects included. */
  const wallGeometryFor = (wallId: string, runStops: Record<string, WallRunStop> = wallRunStopsByWallId) =>
    footprint
      ? wallGeometryForPure(footprint, wallId, primaryCornerIds, leastAccessibleCorner, thicknessIn, runStops)
      : null;

  /**
   * TILE-ONCE STAGE 4 — a shape change that alters wall LENGTHS, applied by
   * manipulating each wall's existing panel array instead of re-tiling.
   *
   * Tommy, 2026-09-30: *"when a user drags the east side of a square building
   * making it bigger, it auto populates standard panels that enter and grow
   * with the drag. When that side is dragged back, each of those latest
   * panels shrinks and disappears."*
   *
   * ⚠ **Every wall is asked, and most answer "nothing changed".** Typing one
   * wall's length moves several walls at once — widening a rectangle changes
   * AB and CD, and carries BC and DA sideways without changing their length
   * at all. The ones that did not change keep their panel array BY IDENTITY,
   * not by value: a fresh-but-equal array would invalidate every memo
   * downstream and re-render a 232-panel building for nothing.
   *
   * ⚠ **The run length is what moves, not the wall's nominal length.** A
   * wall's panels fill its RUN — the nominal length less whatever a
   * neighbour's corner panel occupies at each end — so the delta is measured
   * between the old and new `wallGeometryFor(...).lengthIn`. Taking it from
   * `wall.lengthFt` instead would be wrong by an inset at either end, every
   * time corner ownership differs between the two shapes.
   *
   * ⚠ **A shortfall REFUSES.** If a wall cannot give up the width asked of
   * it, `resizeWallRun` says so rather than returning a short wall, and this
   * returns null so the caller leaves the footprint alone. A wall whose
   * panels do not sum to its own length is the one thing that may never
   * ship — see the dimensional-tightness rule.
   */
  const resizeSlotsForShapeChange = (
    oldFp: Footprint,
    newFp: Footprint,
    slotsByWallId: Record<string, PanelSlot[]>,
    primary: Set<string>,
    runStops: Record<string, WallRunStop>,
  ): {
    slotsByWallId: Record<string, PanelSlot[]>;
    collapsedOpenings: number;
    tidiedParts: number;
    cornersMoved: number;
    gapsAdded: number;
    gapsRemoved: number;
  } | null => {
    const cornerXY = (fp: Footprint) => new Map(fp.corners.map((c) => [c.id, { x: c.point.x, y: c.point.y }]));
    const oldCorners = cornerXY(oldFp);
    const newCorners = cornerXY(newFp);
    const next: Record<string, PanelSlot[]> = {};
    let collapsedOpenings = 0;
    let tidiedParts = 0;
    let cornersMoved = 0;
    let gapsAdded = 0;
    let gapsRemoved = 0;
    for (const wall of newFp.walls) {
      const slots = slotsByWallId[wall.id];
      if (!slots) continue; // a wall this shape did not have before
      const oldWall = oldFp.walls.find((w) => w.id === wall.id);
      if (!oldWall) {
        next[wall.id] = slots;
        continue;
      }
      const oldGeom = wallGeometryForPure(oldFp, wall.id, primary, leastAccessibleCorner, thicknessIn, runStops);
      const newGeom = wallGeometryForPure(newFp, wall.id, primary, leastAccessibleCorner, thicknessIn, runStops);
      if (!oldGeom || !newGeom) {
        // No geometry for this wall in one of the two shapes — leave its panels
        // exactly as they are rather than guessing at a delta.
        next[wall.id] = slots;
        continue;
      }
      /* ⚠ A WALL WHOSE OWN CORNERS DID NOT MOVE CAN STILL CHANGE LENGTH, and
         skipping it was a dimensional-tightness violation shipping in plain
         sight. Widening a 30x30 to 40x30 moves only B and C, so DA has no
         growth end — yet DA's run goes 344.5in -> 329in because AB now
         builds the corner at A. Bailing out on a null end left DA's panels
         summing 15.5in longer than the wall holding them. Found by
         measurement on 2026-10-18, after the audit that found the corner
         composition bug missed this one.

         No early bail at all now: a wall with nothing to do falls through to
         the zero-delta shortcut below and keeps its panel array by identity. */
      const end =
        wallGrowthEnd(oldCorners, newCorners, wall) ??
        runChangeEndFromInsets(
          newGeom.startInsetIn - oldGeom.startInsetIn,
          newGeom.endInsetIn - oldGeom.endInsetIn,
        ) ??
        /* Neither a corner nor an inset moved, so the run is the same length
           and the resize below is a no-op — but a rule-placed part may still
           have changed side, so the wall is NOT skipped. */
        "end";
      const deltaIn = newGeom.lengthIn - oldGeom.lengthIn;
      /* ⚠ THE RULE-PLACED PARTS MOVE FIRST, and skipping this is what made
         a length change build the wrong corners. Ownership reads wall LENGTH
         ("the longer wall runs through"), so widening a square flips it:
         measured, 30x30 -> 40x30 takes AB from one corner panel to two and BC
         from one to zero. Resizing standard panels alone left two corner
         panels at one corner with the wall TOTALS still correct, which is why
         nothing caught it. Same story for the safety gap, whose end is picked
         by distance from the least-accessible corner.

         Checked BEFORE the zero-delta shortcut below: a wall can flip
         ownership at both ends and come out the same length, and bailing on
         the delta would skip the very wall that needed fixing. */
      const ruled = applyRulePlacedParts(
        slots,
        { hasCornerStart: oldGeom.hasCornerStart, hasCornerEnd: oldGeom.hasCornerEnd, gapEnd: oldGeom.gapEnd },
        { hasCornerStart: newGeom.hasCornerStart, hasCornerEnd: newGeom.hasCornerEnd, gapEnd: newGeom.gapEnd },
        deltaIn,
        cornerWidthInForTiling,
      );
      if (ruled.cornerMoved) cornersMoved += 1;
      if (Math.round(ruled.remainingDeltaIn * 8) === 0 && !ruled.cornerMoved && !ruled.gapMoved) {
        next[wall.id] = slots;
        continue;
      }
      const out = resizeWallRun(ruled.slots, ruled.remainingDeltaIn, end, standardWidthIn);
      if (out.shortfallEighths > 0) return null;
      collapsedOpenings += out.collapsedOpenings;
      /* ⚠ THE RELEASE TIDY, and this IS the release. `onDragWall` fires on
         mouse-up only — there is a live preview during the drag and one
         commit at the end — and a typed length is a single committed change
         too, so both arrive here already 'let go of'.

         Tommy, 2026-10-17: tidy ONLY a panel the shop cannot build, never a
         legal one. A pass that normalised every release would be the tiler
         running behind his back again, just later. */
      /* ⚠ BRACING FOLLOWS A WALL THAT GREW — his answer of 2026-10-18.
         `reconcileBracedPlacement` seeds ONLY genuinely new standard-slot
         positions from the spacing rule and leaves every pattern the user
         chose exactly where it is, which is why it is the right tool rather
         than re-deriving the wall's bracing. Without it a wall grown from
         30ft to 50ft gained 20ft of unbraced framing. */
      /* ⚠ THE 24FT SAFETY GAP RULE — Tommy, 2026-10-18, and this is the
         half of it he asked for by name: "When a wall GROWS or when a very
         long wall is created." A wall taken from 20ft to 40ft gains a gap
         about 24ft from the one beside the corner; one cut back loses the
         gap it can no longer justify.

         ⚠ This is a rule-placed part being re-placed, NOT the tiler coming
         back: the gap lands on a joint the wall already has and takes its
         3/4in out of the panel beside it, so no panel the user sized is
         re-derived. Applied before the bracing so the braces see the joints
         the wall actually ends up with — the same order `retile` uses. */
      const gapSpaced = applySafetyGapSpacing(out.slots, newGeom.gapEnd, safetyGapWidthForRunIn(newGeom.lengthIn), TILER_MIN_PANEL_WIDTH_IN);
      gapsAdded += gapSpaced.added;
      gapsRemoved += gapSpaced.removed;
      const braced = reconcileBracedPlacement(
        /* ⚠ `ruled.slots`, NOT `slots` — the array `resizeWallRun` was
           actually given. The reconcile matches by standard-family ordinal
           and reads gap positions, so handing it a run from before the
           corner and gap moved would describe a wall that no longer exists. */
        ruled.slots,
        gapSpaced.slots,
        bracedSeed.spacingIn,
        standardWidthIn,
        bracedSeed.defaultPattern,
        bracedSeed.defaultMirrored,
        slotIndexPinnedWallIds.has(wall.id),
      );
      const tidied = tidyUnbuildableLeftovers(braced);
      tidiedParts += tidied.changedParts;
      /* ⚠ DIMENSIONAL TIGHTNESS, CHECKED RATHER THAN ASSUMED. Every step
         above conserves width by construction — the resize moves a budget
         in eighths, the tidy moves width between neighbours, and the
         corner-brace combine redistributes what it swallows. Four steps
         each conserving is not the same as the chain conserving, and a
         wall whose panels do not sum to its own length is the one thing
         that may never reach the shop. So it is measured, and a mismatch
         REFUSES the whole edit the same way a shortfall does. */
      const sumEighths = tidied.slots.reduce((n, sl) => n + Math.round(sl.widthIn * 8), 0);
      if (sumEighths !== Math.round(newGeom.lengthIn * 8)) return null;
      next[wall.id] = tidied.slots;
    }
    return { slotsByWallId: next, collapsedOpenings, tidiedParts, cornersMoved, gapsAdded, gapsRemoved };
  };

  /**
   * Commit a shape change by RESIZING each wall's panels — tile-once Stage 4's
   * replacement for re-tiling the whole building on a length edit.
   *
   * Returns false when the change is impossible, and then NOTHING is written:
   * no footprint, no panels. ⚠ That all-or-nothing matters because the
   * footprint and the panels are two pieces of state. Setting the shape and
   * then discovering a wall cannot shrink would leave a building whose walls
   * disagree with their own panels — the one condition the dimensional
   * tightness rule says may never exist. So the panels are computed FIRST and
   * the caller only sets the footprint once they are known good.
   */
  /**
   * Apply a run-stop change to one storey by resizing panels, keeping what
   * the stop removes so reducing it gives the same panels back.
   *
   * ⚠ The end to resize at is derived from WHICH INSET MOVED rather than from
   * which stop the user typed. A stop that reaches a corner takes that corner
   * panel with it, so the neighbouring wall's run changes too — and the
   * neighbour has no stop of its own to read. Asking the geometry which end
   * moved handles both walls with one rule; reading the stop record would
   * handle only the obvious one and leave the neighbour's panels wrong.
   */
  const computeRunStopStory = (
    story: "ground" | "second",
    oldStops: Record<string, WallRunStop>,
    nextStops: Record<string, WallRunStop>,
  ): { slotsByWallId: Record<string, PanelSlot[]>; heldByWallId: Record<string, StoppedSlots> } | null => {
    if (!footprint) return null;
    const slots = wallSlotsForStory(story);
    const held = stoppedSlotsByStoryAndWallId[story];
    const nextSlots: Record<string, PanelSlot[]> = {};
    const nextHeld: Record<string, StoppedSlots> = {};
    for (const wall of footprint.walls) {
      const wallSlots = slots[wall.id];
      if (!wallSlots) continue;
      const before = wallGeometryForPure(footprint, wall.id, primaryCornerIds, leastAccessibleCorner, thicknessIn, oldStops);
      const after = wallGeometryForPure(footprint, wall.id, primaryCornerIds, leastAccessibleCorner, thicknessIn, nextStops);
      const current = held[wall.id] ?? {};
      if (!before || !after) {
        nextSlots[wall.id] = wallSlots;
        if (current.start || current.end) nextHeld[wall.id] = current;
        continue;
      }
      const deltaIn = after.lengthIn - before.lengthIn;
      /* Which END moved: the inset that changed, or — when neither did, so
         this is the stopped wall itself — the stop value that changed. */
      const insetMoved: "start" | "end" | null =
        Math.round((after.startInsetIn - before.startInsetIn) * 8) !== 0
          ? "start"
          : Math.round((after.endInsetIn - before.endInsetIn) * 8) !== 0
            ? "end"
            : null;
      const oldStop = oldStops[wall.id] ?? NO_WALL_RUN_STOP;
      const newStop = nextStops[wall.id] ?? NO_WALL_RUN_STOP;
      const stopMoved: "start" | "end" | null =
        Math.round((newStop.startStopIn - oldStop.startStopIn) * 8) !== 0
          ? "start"
          : Math.round((newStop.endStopIn - oldStop.endStopIn) * 8) !== 0
            ? "end"
            : null;
      const end = stopMoved ?? insetMoved;
      if (!end || Math.round(deltaIn * 8) === 0) {
        nextSlots[wall.id] = wallSlots;
        if (current.start || current.end) nextHeld[wall.id] = current;
        continue;
      }
      const out = applyRunStopChange(wallSlots, deltaIn, end, standardWidthIn, current);
      /* The same release tidy a length change gets: a stop commits once, so
         what it leaves behind is already let go of, and only a panel the shop
         cannot build is moved. ⚠ Applied to the BUILT slots only — never to
         what the stop set aside, because those come back verbatim when the
         stop is reduced and tidying them would change panels while they are
         out of the wall. */
      nextSlots[wall.id] = tidyUnbuildableLeftovers(out.slots).slots;
      if (out.stopped.start || out.stopped.end) nextHeld[wall.id] = out.stopped;
    }
    return { slotsByWallId: nextSlots, heldByWallId: nextHeld };
  };

  /** Commit what `computeRunStopStory` worked out. ⚠ Split from it so the
   * legality probe can ask the SAME function what a candidate stop would do
   * — the probe and the commit cannot disagree about the answer, which is
   * the property the old code got by re-tiling twice with the same inputs. */
  const applyRunStopsToStory = (
    story: "ground" | "second",
    oldStops: Record<string, WallRunStop>,
    nextStops: Record<string, WallRunStop>,
  ) => {
    const out = computeRunStopStory(story, oldStops, nextStops);
    if (!out) return;
    setWallSlotsForStory(story, () => out.slotsByWallId);
    setStoppedSlotsByStoryAndWallId((prev) => ({ ...prev, [story]: out.heldByWallId }));
  };

  const applyShapeChange = (oldFp: Footprint, newFp: Footprint, primary: Set<string>): boolean => {
    const ground = resizeSlotsForShapeChange(oldFp, newFp, baseWallSlots, primary, wallRunStopsByWallId);
    if (!ground) return false;
    const second = secondStory
      ? resizeSlotsForShapeChange(oldFp, newFp, secondStory.wallSlots, primary, wallRunStopsByWallId)
      : null;
    if (secondStory && !second) return false;
    setBaseWallSlots(ground.slotsByWallId);
    if (second) setWallSlotsForStory("second", () => second.slotsByWallId);
    /* ⚠ No `recordTilingBasis` here, and that is deliberate. The basis means
       "this building was BUILT from these settings", and a length change does
       not apply any setting — it manipulates panels that were tiled under
       whatever basis was already recorded. Recording one here would clear the
       pending-settings markers and claim a Repanelize had happened. */
    /* ⚠ Only when a PART changed, which is his answer of 2026-10-17: a merged
       or split panel is a different thing to fabricate, but a notice on every
       ordinary drag becomes noise nobody reads. */
    /* ⚠ A corner panel changing walls is two walls' parts changing, and he
       did not directly ask for it — so it is said out loud (2026-10-18). */
    /* ⚠ A new safety gap is a new PART and a new joint in a real wall, so it
       is said out loud rather than appearing silently in the cut list. */
    const gapsIn = ground.gapsAdded + (second?.gapsAdded ?? 0);
    const gapsOut = ground.gapsRemoved + (second?.gapsRemoved ?? 0);
    if (gapsIn > 0 || gapsOut > 0) {
      const parts: string[] = [];
      if (gapsIn > 0) parts.push(`${gapsIn} safety ${gapsIn === 1 ? "gap" : "gaps"} added`);
      if (gapsOut > 0) parts.push(`${gapsOut} removed`);
      setPanelPlacementNotice(
        `${parts.join(", ")} — a safety gap sits about every 24ft along a wall, at the nearest panel joint.`,
      );
    }
    const corners = ground.cornersMoved + (second?.cornersMoved ?? 0);
    if (corners > 0) {
      setPanelPlacementNotice(
        "A corner panel moved to the other wall — the longer wall runs through a corner, and that changed with this edit.",
      );
    }
    const tidied = ground.tidiedParts + (second?.tidiedParts ?? 0);
    if (tidied > 0) {
      setPanelPlacementNotice(
        tidied === 1
          ? "One panel was too small for the shop to build, so it was merged with its neighbour."
          : `${tidied} panels were too small for the shop to build, so they were merged with their neighbours.`,
      );
    }
    const collapsed = ground.collapsedOpenings + (second?.collapsedOpenings ?? 0);
    if (collapsed > 0) {
      /* Said out loud: an opening that shrank under a foot is no longer an
         opening, which changes what gets fabricated. Tommy accepted the
         behaviour; he did not ask for it to be silent. */
      setPanelPlacementNotice(
        collapsed === 1
          ? "One window or door became a standard panel — it shrank below 1ft."
          : `${collapsed} windows or doors became standard panels — they shrank below 1ft.`,
      );
    }
    return true;
  };

  const handleDraw = (widthFt: number, depthFt: number, origin: { x: number; y: number }) => {
    const fp =
      shapeTool === "octagon" ? buildOctagonFootprint(widthFt, depthFt) : buildRectangleFootprint(widthFt, depthFt);
    // Corner ids aren't shared across shapes (rectangle uses "A".."D",
    // octagon "0".."7") — a fresh draw always resets which corner is
    // least-accessible, same as it already resets openings via retile.
    // Every corner of a freshly-drawn shape is "primary" (nothing's been
    // bumped out yet).
    const nextLeastAccessible = fp.corners[0]!.id;
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    setFootprint(fp);
    /* ⚠ Gable ends spawn with the building, on its two SHORT walls — his
       2026-10-24 rule, and `gableEndWallIdsFor` is the same function the roof
       planes are built from, so the two cannot disagree about which walls
       those are.
       ⚠ Set here in the draw handler rather than in an effect watching the
       footprint: this repo's lint gate holds `set-state-in-effect` at its
       current count and it may never rise. A ring has no opposite pair to
       span a beam between, so it gets none. */
    const autoGableWallIds = roofEnabled && ringRoofGableBlockReason(fp) === null ? gableEndWallIdsFor(fp) : [];
    setGableEndWallIds(new Set(autoGableWallIds));

    /* ⚠ THE DEFAULT ROOF IS 4:12, and its form is decided, not fixed.
       Tommy, 2026-10-26: *"Make it default 4/12 shed roof if smaller than 18'
       roof panels, otherwise gable peaks 4/12 with a center beam and posts."*

       This replaces a 16ft default RISE, which was never a pitch at all — it
       was chosen so the ridge *"always sits above the eave regardless of
       story count"*. Harmless while gable ends were off by default; the
       moment they spawned automatically, every new building got a roof at
       about 24:12. */
    const gableWall = fp.walls.find((w) => autoGableWallIds.includes(w.id));
    if (gableWall) {
      const a = fp.corners.find((c) => c.id === gableWall.startCorner)!.point;
      const b = fp.corners.find((c) => c.id === gableWall.endCorner)!.point;
      const acrossFt = Math.hypot(b.x - a.x, b.y - a.y);
      /* `decideRoofForm` is his rule exactly: a shed runs one set of panels
         clear across, a peak halves that, and 18ft of panel at 4:12 reaches
         about 17.1ft of ground. */
      const form = decideRoofForm({ buildingWidthIn: acrossFt * 12, pitchIn12: DEFAULT_ROOF_PITCH_IN12 });
      const runFt = form.kind === "shed" ? acrossFt : acrossFt / 2;
      setRoofProfileType("peaked");
      setRoofProfilePointHeightsFt([Math.round(runFt * (DEFAULT_ROOF_PITCH_IN12 / 12) * 12) / 12]);
      /* A shed is the same one-point profile with its point at the wall's
         start edge rather than centred; null means centred. */
      setGableProfilePositionsInByWallId(
        form.kind === "shed" ? Object.fromEntries(autoGableWallIds.map((id) => [id, [0]])) : {},
      );
    }
    setIsBumpedOut(false);
    setPrimaryCornerIds(nextPrimary);
    setOffsetPx(origin);
    setLeastAccessibleCorner(nextLeastAccessible);
    // A brand-new footprint's walls have no relationship to the old ones —
    // a run stop is a statement about a specific wall of a specific
    // building, so it goes with the building, exactly as this path already
    // discards openings and braced-panel decisions via `retile`.
    setWallRunStopsByWallId({});
    // ⚠ **And Stage 3's opening memory with it — the prune CANNOT cover this
    // one.** `pruneOpeningMemoryToLiveWalls` drops ids the footprint LACKS, and
    // a fresh rectangle's walls are "AB".."DA" all over again: the very ids the
    // old building's memory is keyed by. Left behind, it does not sit inert
    // either, because `hasStop` in the tiler is true whenever the memory holds
    // anything — so the next re-tile of ANY kind (wall-length edit, drag,
    // bump-out, stop) merges a window from a building that no longer exists
    // into this one as a real opening, with a cut list, a fabrication group, a
    // shop drawing and a price. Measured before this line existed: a fresh
    // 22x18 rectangle with a stale `AB` memory and no stop anywhere had 0
    // openings on AB after the draw and 1 after one re-tile. Pinned in
    // retile.test.ts, "a leftover memory puts a window on a wall nobody drew
    // one on".
    setUnbuiltOpeningsByStoryAndWallId({ ground: {}, second: {} });
    // Same statement, about the three records that are indexed by SLOT
    // POSITION: the roofline Box Beam's coverage, every Mid-Wall Bond Beam and
    // every spanning header. A fresh draw left all three standing, and a
    // `[startSlotIndex, endSlotIndex)` range that outlives its building is not
    // merely stale — wall ids are REUSED ("AB".."DA" for every rectangle,
    // "0".."7" for every octagon, see `buildRectangleFootprint`), so the range
    // reattaches to whatever wall takes the id and becomes a fabricated part
    // pointing at panels of a building that no longer exists. That is the same
    // class of bug `pruneOpeningMemoryToLiveWalls` fixed for the opening
    // memory, one record over.
    //
    // It also closes the `slotIndexPinnedWallIds` case named in that memo's
    // own comment: a stale wall id could keep a brand-new wall pinned, which
    // failed safe (a visible 3/4in gap and one more panel) but for no reason
    // anyone could see.
    setBoxBeamCoverageByWallId({});
    setMidWallBeamsByStoryAndWallId({ ground: {}, second: {} });
    setSpanningHeadersByStoryAndWallId({ ground: {}, second: {} });
    setBaseWallSlots(retile(fp, nextLeastAccessible, nextPrimary, {}));
    recordTilingBasis(nextLeastAccessible);
    setShapeTool("edit");
    // A brand-new footprint has no meaningful relationship to whatever
    // second-story data existed for the old one (see the `secondStory`
    // state's own doc comment on why incremental edits don't resync it).
    setSecondStory(null);
    // A wall can already be tall enough for 2+ zones on its very first
    // draw, not just after a later height/max-height edit — every wall
    // here is genuinely brand-new (a fresh footprint has no prior slots
    // at all), so the blanket Infinity-as-old-max form is correct for all
    // of them at once.
    reconcileWallZonesForHeightChange("ground", Number.POSITIVE_INFINITY, maxPanelHeightIn, wallHeightFt, wallHeightFt);
  };

  // Re-tiles the whole wall from scratch around its openings (Tommy: resizing
  // an opening was leaving the rest of the wall protruding past the drawn
  // box instead of auto-adjusting the standard count and gap/borrowed
  // panel sizing) — see `retileWithOpenings`.
  const isOpeningType = (type: PanelSlot["type"]) => type === "window" || type === "door" || type === "column" || type === "big-header";

  // Openings keep their left-to-right order through retileWithOpenings even
  // though slot *indices* can shift (filler standard/safety-gap panels
  // around them get re-derived) — so "the Nth opening slot" is a stable way
  // to relocate the panel a click just changed, in the freshly-retiled
  // array. Used by handleToggleOpening below to keep `selectedSlot` pointed
  // at the panel that was actually clicked, not whatever now sits at its
  // old index.
  const findNthOpeningIndex = (slots: PanelSlot[], ordinal: number): number => {
    let seen = 0;
    for (let i = 0; i < slots.length; i++) {
      if (isOpeningType(slots[i]!.type)) {
        if (seen === ordinal) return i;
        seen++;
      }
    }
    return -1;
  };

  // "How many standard-family (standard OR braced) slots precede this one"
  // — the same ordinal convention `getOpeningAnchors`'s `beforeStandardCount`
  // and `reconcileBracedPlacement`'s own marker-matching use — lets a
  // caller relocate a specific braced/standard panel after a retile
  // reshuffles indices, the same way `findNthOpeningIndex` does for
  // window/door/column.
  const findNthStandardFamilyIndex = (slots: PanelSlot[], ordinal: number): number => {
    let seen = 0;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]!.type === "standard" || slots[i]!.type === "braced") {
        if (seen === ordinal) return i;
        seen++;
      }
    }
    return -1;
  };

  // Reads/writes whichever story's own wallSlots record a caller is
  // targeting — ground floor is the pre-existing `baseWallSlots` state;
  // second story is `secondStory.wallSlots`, a genuinely independent copy
  // (see the Story type's own doc comment) that these same handlers now
  // also mutate, in place of a bespoke second copy of every handler.
  const wallSlotsForStory = (story: "ground" | "second"): Record<string, PanelSlot[]> =>
    story === "ground" ? baseWallSlots : (secondStory?.wallSlots ?? {});

  /* ⚠ THE REPANELIZE HANDLERS LIVE HERE, BELOW `wallSlotsForStory`, AND
     THAT IS NOT ARBITRARY. They read it for the second story. Placed
     earlier, the React Compiler lint reports "accessed before it is
     declared, which prevents the earlier access from updating when this
     value changes over time" — the same staleness warning the undo
     machinery had to be moved for on 2026-10-09. */
  /** Work out what Repanelize would do, and ask. ⚠ The comparison runs the
   * real tiler rather than guessing from the basis: a setting can differ
   * without changing a given wall's layout at all, and telling the user that
   * wall will be rebuilt when it will not is the same lie as warning about
   * hand edits that do not exist. */
  const handleRepanelizeRequest = (scopeWallId: string | null = null) => {
    if (!footprint) return;
    /* ⚠ Repanelize's own confirmation copy (`repanelizeConfirmation` /
       `repanelizeWallConfirmation` in ./repanelize) promises "Hand-set panel
       widths... will be replaced" — but `reconcileBracedPlacement`'s own
       `planLockedWidthReforce` step re-forces a `lockedWidthIn` pin on EVERY
       re-tile by design (that is the whole point of the field; see its own
       doc comment). From there, Repanelize's call looks exactly like an
       ordinary edit elsewhere on the wall that happens to retile this one
       too, so without this strip the pin survived and the promise was false
       on any wall carrying a hand-dragged width — silently, with no error
       and no visible sign that anything had been skipped. Repanelize is the
       one caller that must discard these before the old slots ever reach
       the tiler; every other `retilePreservingOpenings` call site keeps
       preserving them. See `discardLockedWidths`'s own doc comment for why
       the fix belongs here rather than in the geometry package. */
    const discardLockedWidthsByWallId = (slotsByWallId: Record<string, PanelSlot[]>): Record<string, PanelSlot[]> =>
      Object.fromEntries(Object.entries(slotsByWallId).map(([id, slots]) => [id, discardLockedWidths(slots)]));
    const ground = retilePreservingOpenings(
      footprint,
      leastAccessibleCorner,
      primaryCornerIds,
      discardLockedWidthsByWallId(baseWallSlots),
    );
    /* ⚠ The second story is re-tiled too, or Repanelize would quietly leave
       half a building on the old settings — and the caution markers would
       clear, stating that it had all been applied. */
    const second = secondStory
      ? retilePreservingOpenings(
          footprint,
          leastAccessibleCorner,
          primaryCornerIds,
          discardLockedWidthsByWallId(wallSlotsForStory("second")),
          wallRunStopsByWallId,
          "second",
        )
      : null;
    /* Counted as DISTINCT WALLS, not wall-stories: a wall that changes on
       either storey is one wall the user will see change, and "2 of 8" on a
       four-wall building reads as a different building. */
    const changed = new Set(wallsThatWouldChange(baseWallSlots, ground.slotsByWallId));
    if (second) for (const id of wallsThatWouldChange(wallSlotsForStory("second"), second.slotsByWallId)) changed.add(id);
    /* ⚠ PER-WALL STILL RUNS THE WHOLE TILER, and that is not waste. A wall's
       layout depends on corner OWNERSHIP, which is a building-wide decision
       (`primaryCornerIds`, `leastAccessibleCorner`) — tiling one wall in
       isolation would mean re-deriving that, and a second derivation is a
       second thing to disagree. Running the real tiler with the real inputs
       and then applying ONE wall's result gives a wall identical to what a
       full Repanelize would have produced there, which is the property the
       per-wall feature has to have. */
    setRepanelizePrompt({
      wallId: scopeWallId,
      text: scopeWallId
        ? repanelizeWallConfirmation(scopeWallId, changed.has(scopeWallId))
        : repanelizeConfirmation({ changedWallIds: [...changed], totalWalls: footprint.walls.length }),
      changedCount: scopeWallId ? (changed.has(scopeWallId) ? 1 : 0) : changed.size,
      ground,
      second,
    });
  };

  /** Apply the EXACT result the user was shown. */
  const handleRepanelizeConfirm = () => {
    const prompt = repanelizePrompt;
    if (!prompt) return;
    if (prompt.wallId) {
      applyRetiledWall(prompt.wallId, "ground", prompt.ground);
      if (prompt.second) applyRetiledWall(prompt.wallId, "second", prompt.second);
    } else {
      applyRetiledStory("ground", prompt.ground, leastAccessibleCorner);
      if (prompt.second) applyRetiledStory("second", prompt.second, leastAccessibleCorner);
    }
    setRepanelizePrompt(null);
  };
  const setWallSlotsForStory = (
    story: "ground" | "second",
    updater: (prev: Record<string, PanelSlot[]>) => Record<string, PanelSlot[]>,
  ) => {
    if (story === "ground") {
      setBaseWallSlots(updater);
    } else {
      setSecondStory((prev) => (prev ? { ...prev, wallSlots: updater(prev.wallSlots) } : prev));
    }
  };

  /* ⚠ MOVED DOWN 2026-10-11, with the `stories` hoist above. This handler
     read `stories` earlier than even the hoisted position, and was already
     reaching forward for `setWallSlotsForStory`, `spacingIn`,
     `cornerWidthInForTiling`, `slotIndexPinnedWallIds` and the brace
     defaults — all declared below where it used to sit. Placing it after the
     last of them resolves every one of those at once, not just the one the
     linter happened to name. Its only call site is in the elevation controls
     far below, so nothing else moves. */
  const handleToggleGableStructuralPanel = (wallId: string, enabled: boolean) => {
    setGableStructuralPanelWallIds((was) => {
      const next = new Set(was);
      if (enabled) next.add(wallId);
      else next.delete(wallId);
      return next;
    });
    // Only makes sense under a single real peak — a flat-topped profile has
    // no one point for either column to center under (same gate
    // computeGableTiledRow's own columnReservationWidthIn uses).
    if (!enabled || roofProfileType !== "peaked") return;
    const wall = footprint?.walls.find((w) => w.id === wallId);
    if (!wall) return;
    // Auto-place a centered main-level Column Panel (Tommy: "1 panel on
    // the main level centered with edges flush to the one above it") — its
    // top edge lands flush with the gable column's own bottom edge with no
    // extra alignment math, since a normal full-height panel already
    // reaches the eave, exactly where the gable column begins. Targets
    // whichever story sits directly under the roofline (the top-most real
    // story). Excludes the first/last standard-family ordinal — mirrors
    // Stride 1's own default-window seeding, never at a corner-adjacent
    // brace position; skipped entirely if there's no safe non-corner
    // candidate (a wall with fewer than 3 standard-family slots).
    const topStory: "ground" | "second" = stories.length > 1 ? "second" : "ground";
    const currentSlots = wallSlotsForStory(topStory)[wallId] ?? [];
    const standardFamilyIndices = currentSlots
      .map((_, i) => i)
      .filter((i) => currentSlots[i]!.type === "standard" || currentSlots[i]!.type === "braced");
    if (standardFamilyIndices.length < 3) return;
    const geometry = wallGeometryFor(wallId);
    if (!geometry) return;
    // Picks whichever candidate ordinal's ACTUAL post-retile center lands
    // nearest the wall's real peak X — not a pre-retile estimate.
    // retileWithOpenings rebuilds every standard-family slot's own width
    // fresh around whatever the full anchor set (this wall's existing
    // openings plus the new column) leaves in budget, so a width computed
    // from the slots as they stood BEFORE inserting this reservation can't
    // reliably predict where the column actually ends up — this tries
    // every viable ordinal for real and keeps whichever result is
    // genuinely closest, which is what actually makes it land "flush with"
    // the gable column above it (itself always centered on this same real
    // peak position — see computeGableTiledRow's own
    // columnReservationWidthIn). Measured from the wall's own TRUE
    // starting corner (x=0, computeGableTiledRow's own origin) — this
    // story's own slots only start there when this wall owns its start
    // corner and nothing is stopped off it; otherwise they start
    // `runStartOffsetIn` in (the neighbor's own corner panel fills that
    // initial sliver, and/or a Stage 3 run stop withholds more of it — see
    // WallElevationDiagram's own startOffsetIn, which this mirrors).
    const wallLengthIn = wall.lengthFt * 12;
    const { resolvedPointXsIn } = resolveGableProfilePoints(roofProfilePointHeightsFt, gableProfilePositionsInByWallId[wallId] ?? [], wallLengthIn);
    const peakXIn = resolvedPointXsIn[0] ?? wallLengthIn / 2;
    const startOffsetIn = geometry.runStartOffsetIn;
    const existingAnchors = getOpeningAnchors(currentSlots);
    const candidateOrdinals: number[] = [];
    for (let ordinal = 1; ordinal < standardFamilyIndices.length - 1; ordinal++) candidateOrdinals.push(ordinal);
    if (candidateOrdinals.length === 0) return;

    let bestSlots: PanelSlot[] | null = null;
    let bestDistanceIn = Infinity;
    for (const ordinal of candidateOrdinals) {
      const anchors = [...existingAnchors, { beforeStandardCount: ordinal, type: "column" as const, widthIn: COLUMN_TOTAL_WIDTH_IN }];
      const trialSlots = retileWithOpenings(
        geometry.lengthIn,
        standardWidthIn,
        cornerWidthInForTiling,
        geometry.gapEnd,
        geometry.hasCornerStart,
        geometry.hasCornerEnd,
        anchors,
        geometry.allowBorrow,
        cornerMayWidenForTiling,
      ).slots;
      let cursorIn = startOffsetIn;
      let distanceIn = Infinity;
      for (const s of trialSlots) {
        if (s.type === "column" && Math.abs(s.widthIn - COLUMN_TOTAL_WIDTH_IN) < 0.01) {
          distanceIn = Math.min(distanceIn, Math.abs(cursorIn + s.widthIn / 2 - peakXIn));
        }
        cursorIn += s.widthIn;
      }
      if (distanceIn < bestDistanceIn) {
        bestDistanceIn = distanceIn;
        bestSlots = trialSlots;
      }
    }
    if (!bestSlots) return;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(bestSlots, geometry.gapEnd) : bestSlots;
    const finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored, slotIndexPinnedWallIds.has(wallId));
    setWallSlotsForStory(topStory, (prev) => ({ ...prev, [wallId]: finalSlots }));
  };

  // Panel drag-resize commit (Tommy: "when you click and drag a panel, it
  // moves... shrinks one panel and adds it to another") — a direct two-
  // slot patch, called continuously during the drag (see
  // WallElevationDiagram's own drag effect), NOT a retile: both slots get
  // their new widthIn AND lockedWidthIn set together, so the width sticks
  // through a later unrelated retile (see reconcileBracedPlacement, which
  // is what re-applies a locked width after any such retile).
  /**
   * TILE-ONCE STAGE 3 — move a panel along its wall.
   *
   * ⚠ **No re-tile, and that is the entire point.** `movePanelWithinWall`
   * returns a PERMUTATION of the slot array, so the multiset of widths and
   * therefore the wall's exact length are conserved by the nature of the
   * operation. Nothing to settle onto the eighth grid, nothing to
   * reconcile, nothing for the invariant to catch — because there is no
   * arithmetic in it. This is what tile-once is FOR.
   *
   * Null means the move was refused or was a no-op (picking up a corner,
   * or dropping a panel where it already is), and the state is left alone
   * rather than replaced with an equal copy — an equal copy would re-render
   * the wall and, at 232 panels, that is not free.
   */
  const handleMovePanel = (story: "ground" | "second", wallId: string, fromIndex: number, toIndex: number) => {
    setWallSlotsForStory(story, (prev) => {
      const slots = prev[wallId];
      if (!slots) return prev;
      const next = movePanelWithinWall(slots, fromIndex, toIndex);
      return next ? { ...prev, [wallId]: next } : prev;
    });
  };

  const handleDragResizePanels = (story: "ground" | "second", wallId: string, leftSlotIndex: number, leftWidthIn: number, rightWidthIn: number) => {
    setWallSlotsForStory(story, (prev) => {
      const slots = prev[wallId];
      const left = slots?.[leftSlotIndex];
      const right = slots?.[leftSlotIndex + 1];
      if (!slots || !left || !right) return prev;
      const nextSlots = slots.map((s, i) =>
        i === leftSlotIndex
          ? { ...s, widthIn: leftWidthIn, lockedWidthIn: leftWidthIn }
          : i === leftSlotIndex + 1
            ? { ...s, widthIn: rightWidthIn, lockedWidthIn: rightWidthIn }
            : s,
      );
      return { ...prev, [wallId]: nextSlots };
    });
  };

  // Real per-instance header height for a window/door slot on a given
  // story — same formula the real rendering pipeline uses
  // (membersForPanelTypeId's own header branch), for the common (unsplit)
  // case: this story's own full wall height. Doesn't account for a max-
  // panel-height zone split (a Mid-Wall Bond Beam covering this same
  // column) — a known gap, since correctly resolving that needs the same
  // zone-banding pipeline Building3DView/allPanelInstances already run at
  // render time, not something worth re-deriving for a quick per-edit
  // check.
  const resolveHeaderHeightIn = (story: "ground" | "second", slot: PanelSlot): number => {
    const storyWallHeightIn = (story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt)) * 12;
    if (slot.type === "door") {
      const roHeightIn = computeDoorRoughOpeningHeightIn(doorRoughOpeningSelectedHeightIn.value, toeUpHeightIn.value);
      return computeHeaderHeightIn(storyWallHeightIn, roHeightIn);
    }
    const windowSillHeightIn = slot.sillHeightIn ?? sillDefaultHeightIn.value;
    const windowRoHeightIn = slot.heightIn ?? standardWindowHeightDefaultIn.value;
    return computeHeaderHeightIn(storyWallHeightIn, windowSillHeightIn + windowRoHeightIn);
  };

  // Applied after every width/height-affecting window/door mutation (see
  // callers below) — a no-op unless that specific slot's own single-peak
  // angle now falls outside range. Same width carries over; heightIn is
  // reset to the Big Header default (a window/door's own heightIn means
  // its Rough Opening height, a completely different quantity from a Big
  // Header's own total assembly height — carrying the old value over would
  // be meaningless, possibly even outside bigHeaderHeightInRange).
  const applyBigHeaderAutoUpgrade = (story: "ground" | "second", slots: PanelSlot[], index: number): PanelSlot[] => {
    const slot = slots[index];
    if (!slot || (slot.type !== "window" && slot.type !== "door")) return slots;
    if (!shouldAutoUpgradeToBigHeader(slot.widthIn, resolveHeaderHeightIn(story, slot))) return slots;
    return slots.map((s, i) =>
      i === index ? { ...s, type: "big-header" as const, heightIn: bigHeaderDefaultHeightIn.value, includeSillOnBigHeader: false } : s,
    );
  };

  const handleToggleOpening = (story: "ground" | "second", wallId: Wall["id"], slotIndex: number, zoneIndex?: number) => {
    const currentSlots = wallSlotsForStory(story)[wallId] ?? [];
    const currentSlot = currentSlots[slotIndex];
    const geometry = wallGeometryFor(wallId);
    if (!currentSlot || !geometry) return;

    // A non-bottom zone (zoneIndex >= 1) is purely a vertical-stacking
    // concept (see PanelSlotZone) — it never affects this column's own
    // shared widthIn (only the bottom zone, mirrored onto the slot's own
    // top-level fields, does that — see applyZonesToSlot's own doc
    // comment), so cycling it is always a direct in-place `zones[]`
    // mutation, never the width-affecting retileWithOpenings dance below.
    if (zoneIndex !== undefined && zoneIndex > 0) {
      const zones = effectiveZonesForSlot(currentSlot, zoneIndex + 1);
      const next = nextPanelCycleState(zones[zoneIndex]!);
      if (!next) {
        setSelectedSlot({ wallId, slotIndex, story, zoneIndex });
        return;
      }
      const nextZones = zones.map((z, i) =>
        i === zoneIndex ? { ...z, type: next.type, bracedPattern: next.bracedPattern, bracedMirrored: next.bracedMirrored } : z,
      );
      setWallSlotsForStory(story, (prev) => {
        const slots = prev[wallId];
        if (!slots || !slots[slotIndex]) return prev;
        const nextSlots = slots.slice();
        nextSlots[slotIndex] = applyZonesToSlot(nextSlots[slotIndex]!, nextZones);
        return { ...prev, [wallId]: nextSlots };
      });
      setSelectedSlot(next.type === "standard" ? null : { wallId, slotIndex, story, zoneIndex });
      return;
    }

    const next = nextPanelCycleState(currentSlot);
    if (!next) {
      // corner/safety-gap: not cyclable, but still selectable for read-only
      // details in the Selected Panel note.
      setSelectedSlot({ wallId, slotIndex, story });
      return;
    }

    // Transitions into/out of window/door/column change that slot's own
    // reserved width, so they still need the full retileWithOpenings
    // anchor dance. Every other transition — cycling among the 4 braced
    // styles, entering the braced block from "column", or leaving it back
    // to "standard" — never changes widthIn at all (a braced panel's width
    // always tracks the normal standard-panel tiling math, not a
    // reservation), so it's a pure in-place field mutation instead.
    if (!isOpeningType(currentSlot.type) && !isOpeningType(next.type)) {
      setWallSlotsForStory(story, (prev) => {
        const slots = prev[wallId];
        if (!slots || !slots[slotIndex]) return prev;
        const nextSlots = slots.slice();
        const targetSlot = nextSlots[slotIndex]!;
        // A multi-zone slot's own zone-0 entry must stay mirrored onto
        // these same top-level fields (applyZonesToSlot's own invariant) —
        // a plain top-level spread here would silently desync them,
        // leaving the bottom zone's stored type stale.
        const nextZone0: PanelSlotZone = {
          ...(targetSlot.zones?.[0] ?? zoneFromSlot(targetSlot)),
          type: next.type,
          bracedPattern: next.bracedPattern,
          bracedMirrored: next.bracedMirrored,
        };
        nextSlots[slotIndex] = targetSlot.zones
          ? applyZonesToSlot(targetSlot, [nextZone0, ...targetSlot.zones.slice(1)])
          : { ...targetSlot, type: next.type, bracedPattern: next.bracedPattern, bracedMirrored: next.bracedMirrored };
        return { ...prev, [wallId]: nextSlots };
      });
      if (next.type === "standard") setSelectedSlot(null);
      return;
    }

    // A Column Panel is always fabricated exactly `COLUMN_TOTAL_WIDTH_IN`
    // wide (Tommy: "column panels are a fixed width that's almost never
    // going to be the standard panel width") — reserving anything else here
    // leaves the fixed-width member floating in an oversized/undersized
    // tiled slot, showing up as unrendered blank wall space in the 3D view
    // (Building3DView always builds the column at its true fixed width,
    // ignoring the slot's own widthIn). Applying this to every column
    // anchor on the wall (not just the one just toggled) also self-heals
    // any other column on this wall that was created before this fix
    // existed, the next time anything on the wall is touched.
    //
    // The toggled slot itself counts toward `standardsSeen` here whenever
    // its NEXT type is "braced" too (not just "standard") — a braced
    // panel's width comes from the same normal tiling math as a plain
    // standard one, so it needs to be excluded from `anchors` exactly like
    // "standard" already is.
    const anchors: {
      beforeStandardCount: number;
      offsetIn?: number;
      type: "window" | "door" | "column" | "big-header";
      widthIn: number;
      heightIn?: number;
      sillHeightIn?: number;
      zones?: PanelSlotZone[];
      includeSillOnBigHeader?: boolean;
    }[] = [];
    let standardsSeen = 0;
    /* REPANELIZE R2 — how far along the wall each slot starts, so an opening
       the user creates RIGHT NOW records where they put it. See
       `PanelSlot.anchorOffsetIn`: the surviving anchor has always been a
       COUNT of preceding standards, and a count is not a position, so an
       opening drifts whenever those standards change width. ⚠ This is the
       only place that measures an offset — everywhere downstream copies it.
       An existing opening keeps the intent it already had and is never
       re-measured here, which is precisely what broke the first attempt at
       this on 2026-10-07. */
    let offsetSoFarIn = 0;
    currentSlots.forEach((slot, i) => {
      const type = i === slotIndex ? next.type : slot.type;
      if (type === "window" || type === "door" || type === "column" || type === "big-header") {
        anchors.push({
          beforeStandardCount: standardsSeen,
          // The slot being toggled INTO an opening is the user placing it, so
          // its current position is the intent. Every other opening carries
          // the intent it already has — including `undefined`, which means
          // "never recorded" and leaves placement on the count.
          offsetIn: i === slotIndex ? offsetSoFarIn : slot.anchorOffsetIn,
          type,
          // Column and Big Header are both fixed/default-width reservations
          // when freshly toggled in (Big Header's own width isn't fixed
          // like Column's, but a plain standard/braced slot's own current
          // widthIn is almost always below bigHeaderWidthInRange's own
          // 48in floor, so it needs its own sane default too, not whatever
          // narrow width the slot it's replacing happened to have).
          widthIn:
            type === "column"
              ? COLUMN_TOTAL_WIDTH_IN
              : type === "big-header" && i === slotIndex
                ? bigHeaderDefaultWidthIn.value
                : slot.widthIn,
          heightIn: type === "big-header" && i === slotIndex ? bigHeaderDefaultHeightIn.value : undefined,
          // The toggled slot itself (i === slotIndex) is transitioning INTO
          // this type fresh — no prior window/column data of its own to
          // carry. Every OTHER opening on this wall keeps its own
          // heightIn/sillHeightIn/zones through this whole-wall retile
          // (see getOpeningAnchors' own doc comment on this same gap).
          ...(i !== slotIndex && {
            heightIn: slot.heightIn,
            sillHeightIn: slot.sillHeightIn,
            zones: slot.zones,
            includeSillOnBigHeader: slot.includeSillOnBigHeader,
          }),
        });
      } else if (type === "standard" || type === "braced") {
        standardsSeen++;
      }
      offsetSoFarIn += slot.widthIn;
    });
    // Where the toggled slot itself will land among standard-family slots
    // post-retile — only meaningful when it's headed into the braced block
    // (computed against the *pre*-retile array, same convention
    // `reconcileBracedPlacement` uses).
    const precedingStandardFamilyCount = currentSlots.slice(0, slotIndex).filter((s) => s.type === "standard" || s.type === "braced").length;

    // Openings keep their relative order, so "how many opening-type slots
    // sit before this one" (computed against the *pre*-retile array, same
    // ordinal handleSetWindowWidth's precedingOpenings uses) still uniquely
    // identifies this exact panel after retiling reshuffles indices.
    const openingOrdinal = isOpeningType(next.type) ? currentSlots.slice(0, slotIndex).filter((s) => isOpeningType(s.type)).length : null;

    const slots = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerWidthInForTiling,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      anchors,
      geometry.allowBorrow,
      cornerMayWidenForTiling,
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;
    // Preserves every OTHER braced panel already decided on this wall
    // (this single-slot retile would otherwise silently wipe them, since
    // retileWithOpenings itself only knows about window/door/column
    // anchors) and seeds any genuinely new standard-slot position via the
    // seismic rule — see reconcileBracedPlacement's own doc comment.
    let finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored, slotIndexPinnedWallIds.has(wallId));

    if (next.type === "braced") {
      // The user's own explicit click always wins over whatever the
      // generic seed pass just decided for this specific position.
      const targetIdx = findNthStandardFamilyIndex(finalSlots, precedingStandardFamilyCount);
      if (targetIdx !== -1) {
        finalSlots = finalSlots.map((s, i) =>
          i === targetIdx ? { ...s, type: "braced" as const, bracedPattern: next.bracedPattern, bracedMirrored: next.bracedMirrored } : s,
        );
      }
    }

    if (openingOrdinal !== null) {
      const newIndex = findNthOpeningIndex(finalSlots, openingOrdinal);
      setSelectedSlot(newIndex === -1 ? null : { wallId, slotIndex: newIndex, story });
      // Freshly toggling into "window"/"door" can itself already exceed the
      // single-peak angle allowance (e.g. clicking a standard panel wide
      // enough that even a fresh default-height window header can't stay
      // in range) — check right away, not just on a later resize.
      if (newIndex !== -1 && (next.type === "window" || next.type === "door")) {
        finalSlots = applyBigHeaderAutoUpgrade(story, finalSlots, newIndex);
      }
    } else if (next.type === "braced") {
      const newIndex = findNthStandardFamilyIndex(finalSlots, precedingStandardFamilyCount);
      setSelectedSlot(newIndex === -1 ? null : { wallId, slotIndex: newIndex, story });
    } else {
      setSelectedSlot(null);
    }

    setWallSlotsForStory(story, (prev) => ({
      ...prev,
      [wallId]: finalSlots,
    }));
  };

  // --- Smearforn Stage 3: a wall that simply ends -------------------------
  //
  // Tommy: "We need an addition tool setting or stop wall tool so that it is
  // possible to make incomplete walls" — and, on what that means for the
  // ADU: "For new construction the bare walls meet the other bare walls...
  // just a simple end to our wall, no need to have the rest of the plan
  // drawn." So there is no reference wall, no junction detail and no
  // FOR-REFERENCE print treatment here. There is only a length of this
  // wall's run that is not built.
  //
  // The arithmetic lives in packages/geometry's `wallRunStop.ts`; what is
  // here is the re-tile, the refusal, and keeping the stop out of the stored
  // record entirely when it is zero (absent = today's behaviour,
  // byte-identical, which is every project ever saved).
  //
  // **⚠ A stop re-tiles EVERY wall, not just its own, and that is new in
  // this stage.** Since Tommy's orphan-corner decision, a wall that stops at
  // a corner it owns takes that corner with it, and the neighbour which was
  // butting against it stops insetting into air and runs out to its own true
  // end. So a stop on one wall genuinely changes another wall's tiling. A
  // whole-footprint `retilePreservingOpenings` is the honest way to express
  // that: it is the house's own lossless-retile path (openings preserved by
  // anchor, braced decisions and hand-set widths preserved by
  // `reconcileBracedPlacement`), and hand-picking "just the neighbours"
  // would be a second, subtly different copy of `cornerOwnership`'s
  // adjacency rules.

  /* ⚠ `retileAllForRunStops` WAS DELETED HERE — tile-once Stage 4d, and it was
     the last re-tile the model set out to remove. It re-tiled the whole
     footprint against a candidate stop map, and both the legality probe and the
     commit called it.

     Both now go through `computeRunStopStory`, which resizes panels and sets
     aside what a stop removes. The probe asks it about a CANDIDATE stop and the
     commit asks it about the real one, so the two share a single implementation
     and can no longer disagree about whether a stop is legal — the old pair got
     that property only by running the same expensive thing twice.

     Its doc comment said the slots and the withheld openings "are one answer",
     which was true of the anchor memory. Under tile-once the answer is better:
     what a stop sets aside is the PANELS, so a hand-set width or a braced
     pattern inside the stopped span comes back too. */

  /** The stop map as it would be with one end of one wall changed. Returned
   * as a MAP rather than a single record because every consumer now needs
   * the cross-wall view. */
  const candidateWallRunStops = (wallId: string, end: WallEnd, nextIn: number): Record<string, WallRunStop> => {
    const current = wallRunStopsByWallId[wallId] ?? NO_WALL_RUN_STOP;
    const next = end === "start" ? { ...current, startStopIn: nextIn } : { ...current, endStopIn: nextIn };
    return { ...wallRunStopsByWallId, [wallId]: next };
  };

  /**
   * **A REFUSAL, not a clamp** — the same shape Stage 1's sub-minimum panel
   * width uses, and for the same reason: a run the shop cannot panelize is
   * not a thing to negotiate at the keyboard.
   *
   * Two things are legal that might look like they should not be. A stop of
   * exactly ZERO is "build the whole wall". A stop covering the WHOLE wall
   * is "this edge has no wall of ours on it at all" — the plan's own
   * one-concept model, not a separate mode.
   *
   * What is refused is the band in between: a remainder too short to tile
   * legally. Rather than re-deriving what "legal" means (corners, the
   * safety-gap threshold, absorb) this tiles the candidate run for real and
   * asks `findSubMinimumPanelWidths` — the same function the Review Log
   * uses — whether the result contains a panel the shop cannot build. A
   * stored file is NOT checked this way: limits are enforced at the point of
   * EDIT, never at LOAD, and a project must never become unopenable because
   * a rule tightened.
   */
  /**
   * **The one length a stop on this wall is measured and clamped against:**
   * this wall's tiling length with every OTHER wall's stops applied but none
   * of its own.
   *
   * It has to be exactly this, and getting it wrong was a real defect. The
   * refusal used to validate against the orphan-ADJUSTED length while the
   * commit normalized against the UNADJUSTED one. Since the orphan rule only
   * ever lengthens, those diverge by exactly one wall thickness on any wall
   * whose neighbour is stopped at their shared corner — and at precisely the
   * adjusted length, a stop the refusal accepted as "build nothing" was
   * stored short, leaving a 15½in braced panel (below the confirmed 24in
   * fabrication minimum) on a wall the app had just said carries no panels.
   *
   * Removing only this wall's own stop is safe and not circular: the orphan
   * rule lets a wall's stop change its NEIGHBOUR's inset, never its own, so
   * this wall's inset does not depend on this wall's stop.
   */
  const wallRunStopBasisIn = (wallId: string, stops: Record<string, WallRunStop>): number | null => {
    const withoutOwnStop = { ...stops };
    delete withoutOwnStop[wallId];
    return wallGeometryFor(wallId, withoutOwnStop)?.lengthIn ?? null;
  };

  const wallRunStopRefusalMessage = (wallId: string, end: WallEnd, nextIn: number): string | null => {
    if (nextIn < 0) return "A stop is measured in from the end of the wall, so it cannot be negative.";
    const candidateStops = candidateWallRunStops(wallId, end, nextIn);
    // The SAME basis `applyWallRunStopChange` normalizes against — see
    // `wallRunStopBasisIn`. Every user-facing length below quotes it, so the
    // app's own advice ("stop all of it") lands outside the refused band
    // rather than back inside it.
    const basisIn = wallRunStopBasisIn(wallId, candidateStops);
    if (basisIn === null) return null;
    const geometry = wallGeometryFor(wallId, candidateStops);
    if (!geometry) return null;
    if (geometry.stopClamped) {
      return `This wall's run is only ${formatLengthIn(basisIn, unitSystem)} long; the two stops together ask for more than that.`;
    }
    // The band the whole refusal exists for, checked directly rather than
    // inferred from whatever the tiler happens to emit: build nothing, or
    // leave a run the shop can actually panelize. Stated up front so the
    // message says what is wrong instead of reporting a downstream symptom
    // (with openings anchored on a 10in run, the sum-invariant backstop
    // below fires first and says something far less useful).
    if (
      !geometry.fullyStopped &&
      toEighths(geometry.lengthIn) > 0 &&
      toEighths(geometry.lengthIn) < toEighths(fabricationMinPanelWidthIn.value)
    ) {
      return `That leaves only ${formatLengthIn(geometry.lengthIn, unitSystem)} of this wall built, under the ${formatLengthIn(fabricationMinPanelWidthIn.value, unitSystem)} minimum panel the shop can build. Stop less of the wall, or stop all ${formatFeetInches(basisIn / 12)} of it.`;
    }
    // A stop that lands INSIDE a gable window is refused by name. Tommy's
    // rule is that a gable window stays put on the building, so a stop
    // either leaves one fully built or does not build it at all; cutting one
    // in half would fabricate a part that does not exist.
    const cutWindows = gableWindowsCutByStop(
      wallId,
      geometry.startStopIn > 0 ? geometry.runStartOffsetIn : 0,
      geometry.endStopIn > 0 ? (footprint?.walls.find((w) => w.id === wallId)?.lengthFt ?? 0) * 12 - geometry.runEndOffsetIn : Infinity,
    );
    if (cutWindows.length > 0) {
      const w = cutWindows[0]!;
      return `That stop cuts through a gable window (it runs from ${formatLengthIn(w.xStartIn, unitSystem)} to ${formatLengthIn(w.xEndIn, unitSystem)} along this wall). Stop clear of it on either side — a gable window is either built or not built, never half built.`;
    }
    // BOTH stories, not just the ground one (the commit re-tiles both, and a
    // second story whose openings differ can tile the same run into a
    // sub-minimum panel the ground story does not), and EVERY wall, not just
    // this one — since the orphan-corner rule, this stop lengthens whichever
    // neighbour was butting into the corner it removes.
    const storiesToCheck: ("ground" | "second")[] = stories.length > 1 ? ["ground", "second"] : ["ground"];
    for (const story of storiesToCheck) {
      /* ⚠ The same function the commit uses, asked about a CANDIDATE. It
         replaces a re-tile here, which is the last one tile-once had to
         remove — and it is strictly better than what it replaces: the probe
         and the commit now share one implementation, so a stop can no longer
         be judged legal by one rule and applied by another. */
      const candidate = computeRunStopStory(story, wallRunStopsByWallId, candidateStops);
      if (!candidate) continue;
      const retiled = candidate.slotsByWallId;
      const storyLabel = story === "second" ? " on the second story" : "";
      for (const wall of footprint?.walls ?? []) {
        const wallGeometry = wallGeometryFor(wall.id, candidateStops);
        if (!wallGeometry) continue;
        const slots = retiled[wall.id] ?? [];
        const totalIn = slots.reduce((sum, s) => sum + s.widthIn, 0);
        const onWall = wall.id === wallId ? "" : ` on wall ${wall.id}`;
        // **The real constraint, named, BEFORE the sum-invariant symptom and
        // before the generic sub-minimum-panel message.**
        //
        // This is the defect Tommy hit: *"whenever i stop wall over a certain
        // amount, for one wall this boundary was 174", it says that the panel
        // wall doesnt add up"*. The openings that survive the stop plus the
        // corner panels the run still builds are FIXED content; what is left
        // over has to be either nothing at all or a panel the shop can
        // actually build. When it is neither, the honest sentence names the
        // windows and the corners and quotes their real total — the 174in
        // Tommy was seeing is exactly `Σ openings + Σ corner panels` on that
        // wall, and the old message reported the arithmetic consequence
        // instead of the cause.
        //
        // Only for a run this stop actually shortens, and only where there
        // ARE openings: everything else keeps the messages it already had.
        const fit = runStopOpeningFit(slots, wallGeometry.lengthIn, fabricationMinPanelWidthIn.value);
        const stopTouchesThisWall = wallGeometry.startStopIn > 0 || wallGeometry.endStopIn > 0;
        if (stopTouchesThisWall && !wallGeometry.fullyStopped && fit.refuses) {
          // Composed in `runStopNotices.ts`, where it has its own tests — this
          // sentence is the whole user-visible point of the fix and was only
          // covered indirectly from here.
          return runStopFitRefusalSentence(
            {
              builtLengthIn: wallGeometry.lengthIn,
              openingCount: fit.openingCount,
              cornerCount: fit.cornerCount,
              requiredIn: fit.requiredIn,
              minPanelWidthIn: fabricationMinPanelWidthIn.value,
              basisIn,
              onWall,
              storyLabel,
            },
            (valueIn) => formatLengthIn(valueIn, unitSystem),
            formatFeetInches,
          );
        }
        // Against this wall's OWN tiled length under the candidate, not
        // against its unstopped length plus the stops. Those two differ by a
        // wall thickness on any neighbour the orphan-corner rule just made
        // longer — so the older form refused every legitimate stop that
        // reached a corner, which is the main case this feature exists for.
        if (toEighths(totalIn) !== toEighths(wallGeometry.lengthIn)) {
          // The sum invariant outranks the edit. Refused whole rather than
          // partly applied — same guard Stage 1's width edit carries. Since
          // the opening-memory fix this is a genuine backstop rather than the
          // message a user normally meets.
          return `That stop does not leave a run${onWall}${storyLabel} whose panels add back up to that wall. Nothing was changed.`;
        }
        const subMinimum = findSubMinimumPanelWidths({ [wall.id]: slots }, fabricationMinPanelWidthIn.value);
        if (subMinimum.length > 0) {
          return `That leaves a ${formatLengthIn(wallGeometry.lengthIn, unitSystem)} run${onWall}${storyLabel}, which cannot be panelized without a panel under the ${formatLengthIn(fabricationMinPanelWidthIn.value, unitSystem)} minimum the shop can build. Stop less of the wall, or stop all ${formatFeetInches(basisIn / 12)} of it.`;
        }
        // ⚠ Stage 2b x Stage 3. A stop RE-TILES the wall wholesale — the run
        // is re-derived, not shifted — so a spanning header's slot range
        // would come out pointing at different panels, or at panels of
        // different widths. Its own fabricated width IS the sum of the
        // panels it spans, so that is a header silently re-cut: a real part,
        // already on a shop sheet, changing length because a different wall
        // got shorter. Refused by name, which is the same answer Stage 3
        // already gives a gable window a stop would cut in half.
        //
        // Note this fires for a NEIGHBOUR's headers too: since the
        // orphan-corner rule, stopping one wall lengthens whichever wall was
        // butting into the corner it removes, and that wall re-tiles as well.
        const wallHeaders = spanningHeadersByStoryAndWallId[story][wall.id] ?? [];
        if (wallHeaders.length > 0) {
          const currentSlots = (stories.find((s) => s.id === story)?.wallSlots ?? {})[wall.id] ?? [];
          const disturbed = wallHeaders.filter(
            (header) =>
              spanningHeaderCoveredSlotCount(slots, header) !== spanningHeaderCoveredSlotCount(currentSlots, header) ||
              toEighths(spanningHeaderSpanWidthIn(slots, header)) !== toEighths(spanningHeaderSpanWidthIn(currentSlots, header)),
          );
          if (disturbed.length > 0) {
            const names = resolvedSpanningHeaders
              .filter((r) => r.story === story && r.wallId === wall.id && disturbed.some((h) => h.id === r.header.id))
              .map((r) => r.name);
            return spanningHeaderRunStopRefusal(names);
          }
        }
      }
    }
    return null;
  };

  /**
   * **Square Bale Panels is REFUSED for a building whose corners it cannot
   * build** — both cases, not one:
   *
   * 1. a wall in the moved **78in-102.5in band**, where absorb would widen the
   *    bale corners (Tommy: *"No — refuse instead."*), and
   * 2. a two-corner wall **under 78in whose one merged slot is over the confirmed
   *    48in `panelWidthInRange.maxIn`** (Tommy, asked whether the same answer
   *    extends to the merged corner: *"Yes — refuse both cases too."*, then asked
   *    directly how wide to draw that net and told the broad reading was the
   *    technically safer one: **"only refuse over 48 inches."**).
   *
   * **A merged bale corner at or under 48in is therefore PERMITTED — and still
   * REPORTED**, by `squareBaleMergedCornerReviewEntries` below, which is
   * deliberately not narrowed to match this refusal. That is what makes the
   * permitted case announced rather than silent.
   *
   * See `squareBaleCornerRefusal.ts` for the whole rationale and for the measured
   * exposure the narrowing opens (octagons from 8ft to about 9.64ft across). The
   * arithmetic for both is the tiler's own — `cornerBandMiddleIn` and
   * `mergedCornerWidthIn` — so the refusal and the geometry cannot drift.
   *
   * Reads the SAME run length and corner ownership the tiler would use, with
   * the live run stops, not the drawn wall length — a bump-out return or a
   * stopped run is exactly where a band-length wall comes from. Corner
   * ownership and run length belong to the footprint rather than to a story, so
   * one pass covers a two-story building.
   *
   * **⚠ At `squareBalePanel.thicknessIn`, NOT at the project's current
   * thickness** — this was a live defect, fixed 2026-09-26. The local
   * `wallGeometryFor` closes over today's `thicknessIn` (15.5in by default),
   * but the button that runs this refusal then calls
   * `setThicknessIn(squareBalePanel.thicknessIn)` = 14in, and a reflex corner
   * adds `extraLengthIn = thicknessIn` to a wall's run. Validating on one basis
   * and applying on another produced 12 measured false refusals and 12 measured
   * misses on one bump-out sweep alone; see `squareBaleRefusalWallFacts`, which
   * takes the thickness as an argument and carries the measurements. It is the
   * same house convention `applyWallRunStopChange` states below — the SAME basis
   * the refusal validated against.
   *
   * Like every other limit in this app it is enforced at the point of EDIT and
   * never at load: a project saved under Square Bale with a band wall still
   * opens, shows its panels, and reports the sub-minimum panel in the Review
   * Log — and one with a merged bale corner opens and reports
   * `squareBaleMergedCornerReviewEntries` below. Returns null when the choice is
   * legal.
   */
  const squareBalePanelizationRefusal = (): string | null => {
    if (!footprint) return null;
    const facts = squareBaleRefusalWallFacts(
      footprint,
      primaryCornerIds,
      leastAccessibleCorner,
      squareBalePanel.thicknessIn,
      wallRunStopsByWallId,
    );
    return squareBalePanelizationRefusalMessage(
      findSquareBaleBandWalls(facts, squareBalePanel.widthIn),
      // The ceiling is an ARGUMENT to the detector, not just to the message:
      // Tommy narrowed this refusal to merged corners over 48in only, so the
      // limit decides which walls are found at all. See
      // `findSquareBaleMergedCornerWalls`.
      findSquareBaleMergedCornerWalls(facts, squareBalePanel.widthIn, panelWidthInRange.maxIn),
      squareBalePanel.widthIn,
      fabricationMinPanelWidthIn.value,
      panelWidthInRange.maxIn,
      (valueIn) => formatLengthIn(valueIn, unitSystem),
    );
  };

  const applyWallRunStopChange = (wallId: string, candidate: WallRunStop) => {
    if (!footprint) return;
    // The SAME basis the refusal validated against. Using the unadjusted
    // length here while the refusal used the adjusted one is what let an
    // accepted "build nothing" be stored a wall-thickness short.
    const basisIn = wallRunStopBasisIn(wallId, { ...wallRunStopsByWallId, [wallId]: candidate });
    if (basisIn === null) return;
    const normalized = normalizeWallRunStop(candidate, basisIn);
    const next: WallRunStop = { startStopIn: normalized.startStopIn, endStopIn: normalized.endStopIn };
    // A zero stop is REMOVED from the record rather than stored as {0, 0}:
    // "absent entry = fully panelized, byte-identical" is a property of the
    // saved file, not only of the reader.
    const nextStops: Record<string, WallRunStop> = { ...wallRunStopsByWallId };
    if (hasWallRunStop(next)) nextStops[wallId] = next;
    else delete nextStops[wallId];
    setWallRunStopsByWallId(nextStops);
    // Every wall, both stories — see the orphan-corner note above. Each story
    // writes back BOTH halves: the slots that are built, and the openings this
    // stop set aside so a later un-stop can bring them back (Tommy: "Drop
    // them, and remember").
    /* TILE-ONCE STAGE 4d — a stop changes how much of a wall is BUILT, which
       is a length change, so the panels are manipulated rather than re-tiled.
       What the stop removes is SET ASIDE and comes back when the stop is
       reduced (Tommy: "Drop them, and remember") — see `applyRunStopChange`.

       ⚠ EVERY wall is asked, not just the stopped one. A stop at a corner
       takes that corner panel with it, which changes the NEIGHBOUR's inset
       and therefore the neighbour's run — the orphan-corner rule. The end to
       resize at is derived from which inset moved, so a neighbour is handled
       by the same code as the wall the user actually stopped. */
    applyRunStopsToStory("ground", wallRunStopsByWallId, nextStops);
    if (stories.length > 1) applyRunStopsToStory("second", wallRunStopsByWallId, nextStops);
    // The selection almost certainly points at a slot index that no longer
    // means what it did — same reset `handleToggleOpening` does.
    setSelectedSlot(null);
  };

  const handleSetWallRunStop = (wallId: string, end: WallEnd, nextIn: number) => {
    const current = wallRunStopsByWallId[wallId] ?? NO_WALL_RUN_STOP;
    applyWallRunStopChange(
      wallId,
      end === "start" ? { ...current, startStopIn: nextIn } : { ...current, endStopIn: nextIn },
    );
  };

  /** Both ends at once. Deliberately one call rather than two `handleSet`
   * calls in a row — React state is not readable back in the same tick, so
   * the second would rebuild its candidate from the pre-clear record and
   * put the first stop straight back. */
  const handleClearWallRunStop = (wallId: string) => applyWallRunStopChange(wallId, NO_WALL_RUN_STOP);

  /**
   * ⚠ **DEFERRED, 2026-10-10 — this used to re-tile the whole building and
   * now changes nothing but the setting.** Tommy: *"Deferred setting,
   * activates when retiled."*
   *
   * It only decides which END of each run the safety gap sits at, which is a
   * permutation of a wall and not a different wall. Re-tiling for it was
   * wasteful AND wrong: measured 2026-10-07, re-tiling on this change
   * **moved windows along the wall** by -0.75in on a 240in wall, +5.875in at
   * 300in and **+19in** on a 360in wall with a 48in window. A setting about
   * which end a sheet of plywood goes was relocating rough openings by over
   * a foot, and nothing reported it.
   *
   * Now the change is shown as pending (R1's caution marker, which already
   * maps this setting) and applied by Repanelize. ⚠ It was NOT deferred when
   * that was decided, because deferring a setting before Repanelize existed
   * would have left it permanently unapplied.
   */
  const handleSetLeastAccessibleCorner = (cornerId: CornerId) => {
    setLeastAccessibleCorner(cornerId);
  };

  // --- Smearforn Stage 1: hand-set panel widths ---------------------------
  //
  // Tommy: "We need a way to manipulate the widths of individual panels...
  // click the numerical value of width of one panel... so you can type in a
  // new value." The arithmetic (quantize, refuse below the shop minimum,
  // clamp the maximum, refuse when the free run has no room) lives in
  // packages/geometry's `resolvePanelWidthEdit`; what is here is the wall
  // re-tile, the notices, and keeping the selection pointed at the same
  // panel afterwards.
  const panelWidthLimitsIn = { minIn: fabricationMinPanelWidthIn.value, maxIn: panelWidthInRange.maxIn };

  const resolvePanelWidthEditFor = (story: "ground" | "second", wallId: string, slotIndex: number, requestedWidthIn: number) =>
    resolvePanelWidthEdit(wallSlotsForStory(story)[wallId] ?? [], slotIndex, requestedWidthIn, panelWidthLimitsIn);

  /**
   * The width field's own refusal message, or null to let the entry commit.
   *
   * A REFUSAL, not a clamp: the field keeps what was typed, marks itself
   * invalid and states the limit, and nothing is written. The 24in floor is
   * a manufacturing limit — a panel the shop cannot build is not something
   * to negotiate at the keyboard — and "no room left" is refused for the
   * same reason a partial application would be wrong: the wall's total
   * length is not a thing a panel width edit may change.
   */
  const panelWidthRefusalMessage = (
    story: "ground" | "second",
    wallId: string,
    slotIndex: number,
    requestedWidthIn: number,
  ): string | null => {
    const result = resolvePanelWidthEditFor(story, wallId, slotIndex, requestedWidthIn);
    if (result.outcome === "refuse-below-minimum") {
      return `Refused: Building Integrity can't fabricate a panel narrower than ${formatLengthIn(result.minIn, unitSystem)} left to right in elevation. Nothing was changed.`;
    }
    if (result.outcome === "refuse-no-room") {
      return `Refused: no room on this wall. The widest this panel can be right now is ${formatLengthIn(result.maxAvailableIn, unitSystem)} — every other panel here is hand-set, an opening or a corner. Reset one of them, or change the wall's length.`;
    }
    if (result.outcome === "refuse-not-a-panel") {
      return "Refused: only standard and braced panels have an adjustable width here.";
    }
    return null;
  };

  /**
   * Re-tiles ONE wall around whatever pins its slots now carry, and writes
   * the result only if the wall still adds up.
   *
   * Same path `handleSetWindowWidth` uses — anchors for the openings, the
   * plain tiler for the rest, `reconcileBracedPlacement` to carry every
   * braced style, zone and pin through — plus two guards that make a failed
   * edit a no-op rather than a half-applied one: the re-tiled wall must sum
   * to exactly this wall's own tiling length, and the pinned slot must have
   * come back at exactly its pinned width. If either fails, nothing is
   * written and the caller says so. Never partially apply.
   */
  const retileWallAroundPins = (
    story: "ground" | "second",
    wallId: string,
    /** The wall as it stands BEFORE this edit — the array whose widths sum
     * to the wall's own length, and the fallback path's target total. */
    beforeSlots: PanelSlot[],
    nextSlots: PanelSlot[],
    keepOrdinal: number,
    expectWidthIn: number | null,
    /** Index in `nextSlots` of the slot being edited, and whether the
     * fallback should re-tile a free run that already adds up — see
     * `redistributeFreeRun`'s `rebalance`. */
    editIndex: number,
    rebalance: boolean,
  ):
    | { ok: true; slots: PanelSlot[]; index: number }
    /** `lockedWidthRefusal` is set when the pin came back at a DIFFERENT width
     * because `planLockedWidthReforce` refused to re-force it — the wall could
     * only have paid by pushing a neighbour outside the shop's range. It carries
     * the numbers so the caller can say which widths this wall would take; the
     * generic "that moved the wall's length" sentence is not true of it. */
    | { ok: false; refusal: PanelPlacementResult | null; lockedWidthRefusal?: LockedWidthRefusal } => {
    const geometry = wallGeometryFor(wallId);
    if (!geometry) return { ok: false, refusal: null };
    const anchors = getOpeningAnchors(nextSlots).map((a) => (a.type === "column" ? { ...a, widthIn: COLUMN_TOTAL_WIDTH_IN } : a));
    const tiled = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerWidthInForTiling,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      anchors,
      geometry.allowBorrow,
      cornerMayWidenForTiling,
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(tiled, geometry.gapEnd) : tiled;
    const finalSlots = reconcileBracedPlacement(nextSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored, slotIndexPinnedWallIds.has(wallId));

    // ⚠ Smearforn Stage 2 rider, and the one case this function cannot
    // answer with the tiler. The tiler derives the free run's COUNT from the
    // budget alone, so it hands back the same number of panels every time it
    // is asked — which is right for a wall the tiler laid out, and WRONG for
    // one the user has since hand-placed a panel onto: the extra panel would
    // be silently re-tiled away by the next width edit on that wall, with
    // the wall still adding up, so neither guard below would notice. That is
    // exactly the silent revert the Smearforn plan forbids.
    //
    // So: when the tiler's answer disagrees with the wall about how many
    // standard-family slots it has — in EITHER direction, see
    // `tilerWouldChangeThePanelCount` — the edit is applied by
    // `redistributeFreeRun` instead, the same count-preserving mechanism
    // insert/replace/delete use, and the tiler's answer is discarded. A wall
    // that has never been hand-placed on gives the same count both ways and
    // takes the tiler path, exactly as it did before Stage 2.
    const totalIs = (slots: PanelSlot[]) => slots.reduce((sum, s) => sum + toEighths(s.widthIn), 0);
    if (tilerWouldChangeThePanelCount(nextSlots, finalSlots)) {
      const fallback = redistributeFreeRun(beforeSlots, nextSlots, editIndex, panelWidthLimitsIn, { rebalance });
      // The refusal travels back with its NUMBERS in it — this is the path a
      // width edit on a hand-edited wall actually takes, and "that didn't
      // work" with no figure is exactly what the Stage 1 refusals do not do.
      if (fallback.outcome !== "commit") return { ok: false, refusal: fallback };
      // The SAME wall-length guard the tiler path below gets. The fallback
      // conserves `beforeSlots`' own total, which is the wall's length only
      // as long as the wall it was read from was itself in order — this is
      // what makes the doc comment's promise ("the re-tiled wall must sum to
      // exactly this wall's own tiling length") true of both paths rather
      // than one. It stops being theoretical the moment Stage 3 lands, which
      // changes what a wall's tiling length IS.
      if (totalIs(fallback.slots) !== toEighths(geometry.lengthIn)) return { ok: false, refusal: null };
      const fallbackIndex = findNthStandardFamilyIndex(fallback.slots, keepOrdinal);
      if (fallbackIndex === -1) return { ok: false, refusal: null };
      if (expectWidthIn !== null && toEighths(fallback.slots[fallbackIndex]!.widthIn) !== toEighths(expectWidthIn)) return { ok: false, refusal: null };
      return { ok: true, slots: fallback.slots, index: fallbackIndex };
    }

    if (totalIs(finalSlots) !== toEighths(geometry.lengthIn)) return { ok: false, refusal: null };
    const index = findNthStandardFamilyIndex(finalSlots, keepOrdinal);
    if (index === -1) return { ok: false, refusal: null };
    if (expectWidthIn !== null && toEighths(finalSlots[index]!.widthIn) !== toEighths(expectWidthIn)) {
      // ⚠ The pin did not come back at its own width, and since 2026-09-30 there
      // is exactly one reason that happens on a wall whose total is fine: the
      // re-force was REFUSED because no legal way to pay for it existed. Ask the
      // planner for the figures rather than guessing — it is a fixpoint, so
      // re-planning the committed run reports the same refusal the reconcile made.
      return {
        ok: false,
        refusal: null,
        lockedWidthRefusal: planLockedWidthReforce(finalSlots).refusals.find((r) => r.slotIndex === index),
      };
    }
    return { ok: true, slots: finalSlots, index };
  };

  /** How many standard/braced slots precede this one — the ordinal the
   * selection is restored by after a re-tile reshuffles raw indices. */
  const standardFamilyOrdinalAt = (slots: PanelSlot[], slotIndex: number): number =>
    slots.slice(0, slotIndex).filter((s) => s.type === "standard" || s.type === "braced").length;

  const handleSetPanelWidth = (story: "ground" | "second", wallId: string, slotIndex: number, requestedWidthIn: number) => {
    const currentSlots = wallSlotsForStory(story)[wallId] ?? [];
    const result = resolvePanelWidthEditFor(story, wallId, slotIndex, requestedWidthIn);
    // Every refusal already reached the user through the field's own
    // `validate`, which is why this commits nothing and says nothing extra.
    if (result.outcome !== "commit") return;

    // Width AND lock together, exactly as the panel-boundary drag does — the
    // lock is what survives the next unrelated re-tile of this wall.
    const pinned = currentSlots.map((s, i) =>
      i === slotIndex ? { ...s, widthIn: result.widthIn, lockedWidthIn: result.widthIn } : s,
    );
    const ordinal = standardFamilyOrdinalAt(currentSlots, slotIndex);
    const retiled = retileWallAroundPins(story, wallId, currentSlots, pinned, ordinal, result.widthIn, slotIndex, false);
    if (!retiled.ok) {
      // ⚠ QUOTE THE NUMBER. This path is not rare on a hand-edited wall:
      // delete a panel from a 16-28ft wall and its automatic panels sit at
      // 46¾-47⅜in, where the narrowest pin the wall will take is 44½in —
      // which refuses every width on the Rogers-Sehorn schedule (43in and
      // down). "That couldn't be applied" leaves somebody guessing at
      // numbers on a wall that has an exact answer, which is precisely what
      // the Stage 1 minimum refusal exists not to do.
      //
      // ⚠ Only when the refusal is ABOUT width feasibility. The other way
      // this can fail — the wall-length or ordinal guard — is refusing for a
      // reason that has nothing to do with which widths fit, and quoting a
      // feasible width there would be a number attached to a refusal it does
      // not describe.
      if (!retiled.refusal) {
        // The specific case first: a width the wall could only honour by pushing
        // another panel out of the shop's range. It has numbers; the fallback
        // below does not, and until 2026-09-30 this edit silently committed an
        // unbuildable neighbour instead of refusing at all.
        if (retiled.lockedWidthRefusal) {
          showPanelWidthNotice(
            lockedWidthEditRefusalSentence(retiled.lockedWidthRefusal, panelWidthLimitsIn, (valueIn) =>
              formatLengthIn(valueIn, unitSystem),
            ),
          );
          return;
        }
        showPanelWidthNotice("That width couldn't be applied without moving this wall's own total length, so nothing was changed.");
        return;
      }
      const narrowestIn = narrowestAcceptablePinWidthIn(currentSlots, slotIndex, panelWidthLimitsIn);
      const alsoTakes =
        narrowestIn === null
          ? " No width between the shop's minimum and maximum fits this wall as it stands — reset a panel to automatic, or change the wall's length, first."
          : ` The narrowest hand-set width this wall will take right now is ${formatLengthIn(narrowestIn, unitSystem)}.`;
      showPanelWidthNotice(`${placementRefusalSentence(retiled.refusal, formatPlacementLength)}${alsoTakes}`);
      return;
    }
    if (result.clampedFromIn !== null) {
      showPanelWidthNotice(
        `Width clamped to ${formatLengthIn(result.widthIn, unitSystem)} — ${formatLengthIn(panelWidthInRange.maxIn, unitSystem)} is the widest panel in the catalog range.`,
      );
    }
    setSelectedSlot({ wallId, slotIndex: retiled.index, story, zoneIndex: selectedSlot?.zoneIndex });
    setWallSlotsForStory(story, (prev) => ({ ...prev, [wallId]: retiled.slots }));
  };

  /** Back to automatic, one panel at a time: clears this slot's own pin and
   * re-tiles the wall, which hands its width back to the tiler. Every other
   * pin on the wall is untouched. */
  const handleResetPanelWidth = (story: "ground" | "second", wallId: string, slotIndex: number) => {
    const currentSlots = wallSlotsForStory(story)[wallId] ?? [];
    const slot = currentSlots[slotIndex];
    if (!slot || slot.lockedWidthIn === undefined) return;
    const cleared = currentSlots.map((s, i) => {
      if (i !== slotIndex) return s;
      const { lockedWidthIn: _released, ...rest } = s;
      return rest;
    });
    const ordinal = standardFamilyOrdinalAt(currentSlots, slotIndex);
    const retiled = retileWallAroundPins(story, wallId, currentSlots, cleared, ordinal, null, slotIndex, true);
    if (!retiled.ok) {
      // Same rule as the typed width above: if the arithmetic produced a
      // number, say the number.
      showPanelWidthNotice(
        retiled.refusal
          ? `${placementRefusalSentence(retiled.refusal, formatPlacementLength)} This panel is still hand-set at ${formatLengthIn(slot.lockedWidthIn, unitSystem)}.`
          : "That panel couldn't be returned to automatic without moving the wall's total length, so nothing was changed.",
      );
      return;
    }
    setSelectedSlot({ wallId, slotIndex: retiled.index, story, zoneIndex: selectedSlot?.zoneIndex });
    setWallSlotsForStory(story, (prev) => ({ ...prev, [wallId]: retiled.slots }));
  };

  // --- Smearforn Stage 2: insert, replace and delete a panel --------------
  //
  // The arithmetic is `packages/geometry`'s `panelPlacement` module; what is
  // here is the tool's own widths (which are catalog values and belong on
  // this side of the package boundary), the notices, and the selection.

  /** What a freshly-placed panel of each type is born as. A Column is always
   * its own fixed fabrication width and a Big Header its own catalog
   * default; everything else is born at the project's Standard width, which
   * is itself already clamped to [24in, 48in] (Smearforn 1r). */
  const placementPanelForInsert = (tool: { type: PlaceablePanelType; bracedPattern?: BracePattern; bracedMirrored?: boolean }): PlacementPanel => {
    switch (tool.type) {
      case "column":
        return { type: "column", widthIn: COLUMN_TOTAL_WIDTH_IN };
      case "big-header":
        return {
          type: "big-header",
          widthIn: bigHeaderDefaultWidthIn.value,
          heightIn: bigHeaderDefaultHeightIn.value,
          includeSillOnBigHeader: false,
        };
      case "braced":
        return { type: "braced", widthIn: standardWidthIn, bracedPattern: tool.bracedPattern, bracedMirrored: tool.bracedMirrored };
      default:
        return { type: tool.type, widthIn: standardWidthIn };
    }
  };

  /** A REPLACEMENT keeps the width already reserved at that position unless
   * the new type has a width of its own — the same rule the click-cycle
   * already follows (`handleToggleOpening`: Column is fixed, a Big Header
   * gets its default because a standard panel is almost always under the
   * 48in floor of `bigHeaderWidthInRange`). */
  const placementPanelForReplace = (tool: {
    type: PlaceablePanelType;
    bracedPattern?: BracePattern;
    bracedMirrored?: boolean;
  }): PlacementPanel => {
    switch (tool.type) {
      case "column":
        return { type: "column", widthIn: COLUMN_TOTAL_WIDTH_IN };
      case "big-header":
        return {
          type: "big-header",
          widthIn: bigHeaderDefaultWidthIn.value,
          heightIn: bigHeaderDefaultHeightIn.value,
          includeSillOnBigHeader: false,
        };
      case "braced":
        return { type: "braced", bracedPattern: tool.bracedPattern, bracedMirrored: tool.bracedMirrored };
      default:
        return { type: tool.type };
    }
  };

  /**
   * Writes a placement result, or says why it was refused.
   *
   * Every refusal states a real number — how much room there actually is,
   * what the panel would have become — for the same reason the width field
   * refuses with the limit rather than a shrug. Nothing is ever partially
   * applied: a refusal writes nothing at all.
   */
  /**
   * Moves this wall's slot-index records across an insert/delete so they
   * still cover the panels they covered before — a Mid-Wall Bond Beam's own
   * coverage on either story, and (second story only) the roofline Box
   * Beam's. Returns how many records the edit emptied, so the notice can say
   * so instead of a beam just disappearing.
   *
   * Every OTHER slot-count change in the app comes from a re-tile, where
   * coverage is a rough position at best. An insert/delete is one named
   * panel at one known index, so the exact answer is available and a beam
   * silently covering different panels would be a wrong drawing.
   *
   * **`moves` is EVERY index change the edit made, in order, not the net
   * one.** An insert whose width the automatic run could only pay for by
   * giving up a panel is two moves — a +1 at the insertion point and a -1
   * where the absorbed panel was — and they do not cancel unless both sit
   * on the same side of the covered range. Netting them was this function's
   * first version and it left records pointing at the wrong panels, or past
   * the end of the array entirely, on exactly the case the tool's own
   * notice already calls out.
   *
   * **⚠ Moving a range correctly is not the same as leaving the part
   * unchanged.** A spanning header's width is DERIVED from the panels it
   * spans, so a shift that keeps it over the same two panels can still change
   * what the shop cuts — measured by this branch's own harness at 80in →
   * 85¾in on a delete to the LEFT of a header. ⚠ The second number is an
   * artifact of the run, not a constant: the same script on the same checkout
   * produced 82⅜in, 84¾in, 85¾in and 84¾in again on the same 549in wall (see
   * `placementNotice.ts`). So `spanningHeaderWidthChanges`
   * reports every header whose fabricated width moved, with both numbers, and
   * flags one that has landed outside the span range a PLACEMENT would have
   * refused. Reported and not refused, which is this app's standing rule on a
   * re-tile path: a visible flag beats an edit the user cannot complete.
   */
  const shiftSlotCoverageRecords = (
    story: "ground" | "second",
    wallId: string,
    moves: { at: number; delta: 1 | -1 }[],
    /** This wall's slots AFTER the edit — the only place the new derived span
     * width can be read from, since state has not been written yet. */
    nextSlots: PanelSlot[],
    /** Counted SEPARATELY, because they are different components with
     * different names and a notice that calls the roofline Box Beam a
     * "mid-wall beam" is simply wrong about what it just removed. */
  ): {
    midWallBeams: number;
    boxBeam: boolean;
    spanningHeaders: number;
    spanningHeaderWidthChanges: SpanningHeaderWidthChange[];
  } => {
    if (moves.length === 0) return { midWallBeams: 0, boxBeam: false, spanningHeaders: 0, spanningHeaderWidthChanges: [] };
    let emptied = 0;
    let boxBeamEmptied = false;
    let spanningHeadersEmptied = 0;
    const spanningHeaderWidthChanges: SpanningHeaderWidthChange[] = [];
    const applyAll = <T extends { startSlotIndex: number; endSlotIndex: number }>(range: T): T | null =>
      moves.reduce<T | null>((acc, move) => (acc === null ? null : shiftSlotCoverage(acc, move.at, move.delta)), range);
    // Read from this render's own state and write plain values — the count
    // has to come back to the caller for the notice, and a state updater
    // runs too late to tell it anything.
    const beams = midWallBeamsByStoryAndWallId[story][wallId] ?? [];
    if (beams.length > 0) {
      const nextBeams = beams.map(applyAll).filter((b): b is MidWallBeam => b !== null);
      emptied += beams.length - nextBeams.length;
      setMidWallBeamsByStoryAndWallId((was) => ({ ...was, [story]: { ...was[story], [wallId]: nextBeams } }));
    }
    const coverage = story === "second" ? boxBeamCoverageByWallId[wallId] : undefined;
    if (coverage) {
      const nextCoverage = applyAll(coverage);
      if (nextCoverage === null) boxBeamEmptied = true;
      setBoxBeamCoverageByWallId((was) => {
        if (nextCoverage === null) {
          const { [wallId]: _dropped, ...rest } = was;
          return rest;
        }
        return { ...was, [wallId]: nextCoverage };
      });
    }
    // Stage 2b rides the SAME machinery, deliberately — a spanning header's
    // coverage is the same half-open slot range, and writing a second copy
    // of this walk is how the two would drift. A header left covering fewer
    // than two panels has stopped being a spanning header at all (its own
    // arithmetic would re-cut it to a width nobody chose), so it goes, and
    // the notice says so.
    const headers = spanningHeadersByStoryAndWallId[story][wallId] ?? [];
    if (headers.length > 0) {
      // ⚠ **Both widths are measured off the BASE slots, and that is a named
      // choice.** Everything else in Stage 2b — the placement refusals, the
      // Review Log flag, the fabrication sheets, the 3D anchor and the price —
      // measures from `overlayWallSlots`. Under `square-bale-panels` or
      // `timber-frame-curtain` those two arrays differ in both widths and
      // COUNT, because `applyUniformPanelization` re-tiles every infill run,
      // so this notice can print a width the shop sheet does not.
      //
      // It still reads the base slots, because the alternative is worse rather
      // than better: a header's stored range is a BASE slot-index range
      // (`resolvePanelInsert`/`resolvePanelDelete` and this shift all operate
      // on `wallSlotsForStory`), so measuring it against a re-counted overlay
      // array would sum whichever panels happened to land at those indices —
      // a confident wrong number instead of a self-consistent one. Prior and
      // next are both base arrays here, so "did the panels under this range
      // change width" is answered correctly on its own terms.
      //
      // The disagreement underneath this is PRE-EXISTING and larger than the
      // notice: the elevation renders `overlayWallSlots` while
      // `handleInsertPanel`/`handleDeletePanel` index into `baseWallSlots`,
      // nothing gates the placement tool on panelization type, and the
      // Mid-Wall Bond Beam's own coverage range has had the same base-vs-
      // overlay split since long before this stage. Fixing that is its own
      // change with its own Review Log line; it is not smuggled in here.
      const priorSlots = wallSlotsForStory(story)[wallId] ?? [];
      const nextHeaders = headers
        .map((header) => {
          const shifted = applyAll(header);
          // ⚠ The re-cut check, and the reason it reads WIDTHS rather than
          // indices: a range that moved by one over two panels of different
          // widths is the same header on the same panels at a new cut size.
          // `resolveSpanningHeaderPlacement` is deliberately NOT called here —
          // it refuses, and this path cannot: the panel edit has already been
          // decided, and unwinding it would leave the user unable to delete a
          // panel because of a header three panels away.
          if (shifted !== null && shifted.endSlotIndex - shifted.startSlotIndex >= 2) {
            const fromIn = spanningHeaderSpanWidthIn(priorSlots, header);
            const toIn = spanningHeaderSpanWidthIn(nextSlots, shifted);
            if (toEighths(fromIn) !== toEighths(toIn)) {
              const outside = spanningHeaderSpanOutOfRange(nextSlots, shifted, SPANNING_HEADER_LIMITS_IN);
              spanningHeaderWidthChanges.push({
                name: spanningHeaderNameById.get(header.id) ?? "a spanning header",
                fromIn,
                toIn,
                outsideRangeIn: outside ? { minIn: outside.minIn, maxIn: outside.maxIn } : null,
              });
            }
          }
          return shifted;
        })
        .filter((h): h is SpanningHeader => h !== null && h.endSlotIndex - h.startSlotIndex >= 2);
      spanningHeadersEmptied = headers.length - nextHeaders.length;
      if (spanningHeadersEmptied > 0 || nextHeaders.some((h, i) => h !== headers[i])) {
        setSpanningHeadersByStoryAndWallId((was) => ({ ...was, [story]: { ...was[story], [wallId]: nextHeaders } }));
      }
    }
    return { midWallBeams: emptied, boxBeam: boxBeamEmptied, spanningHeaders: spanningHeadersEmptied, spanningHeaderWidthChanges };
  };

  /** Every notice sentence this tool prints is composed in
   * `placementNotice.ts`, where the wording is DERIVED from the operation
   * rather than read back to decide anything — see that module's own header
   * for the defect that shape removes. This is just the unit-system binding. */
  const formatPlacementLength = (valueIn: number) => formatLengthIn(valueIn, unitSystem);

  const applyPlacementResult = (
    story: "ground" | "second",
    wallId: string,
    /** WHICH operation was asked for. Every branch below reads this; nothing
     * reads the notice text. The verb the user sees is derived from it by
     * `PLACEMENT_VERBS`, so a copy edit to the wording cannot silently change
     * which clauses appear — the trap the previous `verb: string` parameter
     * set, and the same shape as the label-parsing bug the hyphen drop hit. */
    op: PlacementOp,
    result: PanelPlacementResult,
    /** The index change the USER asked for — an insert's boundary (+1) or a
     * delete's slot (-1). Null for a replace, which asks for none. Any
     * FURTHER moves the free run had to make to pay for it come off the
     * result's own `droppedIndices`; see the move list below. */
    coverageShift: { at: number; delta: 1 | -1 } | null,
  ) => {
    if (result.outcome !== "commit") {
      showPanelPlacementNotice(placementRefusalNotice(op, result, formatPlacementLength));
      return;
    }
    setWallSlotsForStory(story, (prev) => ({ ...prev, [wallId]: result.slots }));
    setSelectedSlot(result.selectedIndex === -1 ? null : { wallId, slotIndex: result.selectedIndex, story });
    // EVERY index change this edit made, in the order it made them: the one
    // the user asked for (an insert/delete — a replace asks for none), then
    // each automatic panel the run had to give up to pay for it, highest
    // index first so the earlier ones stay valid as they are applied.
    // `droppedIndices` are in the array AFTER the user's own change, which
    // is exactly the coordinate space the first move lands in.
    const moves: { at: number; delta: 1 | -1 }[] = [
      ...(coverageShift ? [coverageShift] : []),
      ...[...result.droppedIndices].sort((a, b) => b - a).map((at) => ({ at, delta: -1 as const })),
    ];
    const emptied = shiftSlotCoverageRecords(story, wallId, moves, result.slots);
    showPanelPlacementNotice(
      placementCommitNotice(op, wallId, result, emptied, emptied.spanningHeaderWidthChanges, formatPlacementLength),
    );
  };

  const handleReplacePanel = (story: "ground" | "second", wallId: string, slotIndex: number) => {
    if (!panelPlacementTool || panelPlacementTool.mode !== "place") return;
    const slots = wallSlotsForStory(story)[wallId] ?? [];
    applyPlacementResult(
      story,
      wallId,
      "replace",
      resolvePanelReplace(slots, slotIndex, placementPanelForReplace(panelPlacementTool), panelWidthLimitsIn),
      null,
    );
  };

  const handleInsertPanel = (story: "ground" | "second", wallId: string, boundaryIndex: number) => {
    if (!panelPlacementTool || panelPlacementTool.mode !== "place") return;
    const slots = wallSlotsForStory(story)[wallId] ?? [];
    applyPlacementResult(
      story,
      wallId,
      "insert",
      resolvePanelInsert(slots, boundaryIndex, placementPanelForInsert(panelPlacementTool), panelWidthLimitsIn),
      { at: boundaryIndex, delta: 1 },
    );
  };

  const handleDeletePanel = (story: "ground" | "second", wallId: string, slotIndex: number) => {
    const slots = wallSlotsForStory(story)[wallId] ?? [];
    applyPlacementResult(story, wallId, "delete", resolvePanelDelete(slots, slotIndex, panelWidthLimitsIn), {
      at: slotIndex,
      delta: -1,
    });
  };

  const handleSetWindowWidth = (story: "ground" | "second", wallId: string, slotIndex: number, requestedWidthIn: number) => {
    const currentSlots = wallSlotsForStory(story)[wallId] ?? [];
    const geometry = wallGeometryFor(wallId);
    if (!geometry) return;
    const widthIn = Math.min(Math.max(requestedWidthIn, windowHeaderWidthInRange.minIn), windowHeaderWidthInRange.maxIn);
    if (Math.abs(widthIn - requestedWidthIn) > 0.05) {
      if (windowWidthClampNoticeTimerRef.current) clearTimeout(windowWidthClampNoticeTimerRef.current);
      setWindowWidthClampNotice(
        `Width clamped to ${widthIn.toFixed(1)}in — allowed range is ${windowHeaderWidthInRange.minIn}"-${windowHeaderWidthInRange.maxIn}" for a window header.`,
      );
      windowWidthClampNoticeTimerRef.current = setTimeout(() => setWindowWidthClampNotice(null), 4000);
    }
    const precedingOpenings = currentSlots
      .slice(0, slotIndex)
      .filter((s) => s.type === "window" || s.type === "door").length;
    // Same fixed-width self-heal as handleToggleOpening — a Column anchor
    // read straight off an existing slot could still carry a stale width
    // from before that fix existed.
    const anchors = getOpeningAnchors(currentSlots).map((a) =>
      a.type === "column" ? { ...a, widthIn: COLUMN_TOTAL_WIDTH_IN } : a,
    );
    if (!anchors[precedingOpenings]) return;
    anchors[precedingOpenings] = { ...anchors[precedingOpenings]!, widthIn };

    const slots = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerWidthInForTiling,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      anchors,
      geometry.allowBorrow,
      cornerMayWidenForTiling,
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;
    // Preserves every braced panel already decided on this wall — a window
    // width change re-tiles the WHOLE wall, which would otherwise silently
    // wipe every one of them back to plain "standard" (see
    // reconcileBracedPlacement's own doc comment; same fix already applied
    // to handleToggleOpening's own retile branch).
    const finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored, slotIndexPinnedWallIds.has(wallId));
    // Same relocation handleToggleOpening's own retile branch already does —
    // without it, selectedSlot keeps pointing at its old raw index, which a
    // width-driven retile can reassign to a totally different panel/type,
    // making the Selected Panel note look like it "cycled" to another type
    // on its own (Tommy: "when i try to edit ro/header width, it changes
    // through the cycle instead").
    const newIndex = findNthOpeningIndex(finalSlots, precedingOpenings);
    setSelectedSlot(newIndex === -1 ? null : { wallId, slotIndex: newIndex, story });
    setWallSlotsForStory(story, (prev) => ({
      ...prev,
      [wallId]: newIndex === -1 ? finalSlots : applyBigHeaderAutoUpgrade(story, finalSlots, newIndex),
    }));
  };

  // Writes one field-set onto a specific zone of a slot (zoneIndex
  // undefined/0 = the bottom zone, mirrored onto the slot's own top-level
  // fields per applyZonesToSlot's own invariant) — the shared "direct
  // per-slot field, no re-tiling" pattern every vertical-only edit
  // (height/sill/braced-style) below uses, now zone-aware so a beam-free
  // multi-zone slot's panels above/below stay independently editable.
  // Skips the zones dance entirely for the overwhelmingly common case (an
  // unsplit slot, edited at its own bottom/only zone) — same plain
  // top-level spread as before this feature existed.
  const updateSlotZoneField = (slot: PanelSlot, zoneIndex: number | undefined, patch: Partial<PanelSlotZone>): PanelSlot => {
    if ((zoneIndex === undefined || zoneIndex === 0) && !slot.zones) {
      return { ...slot, ...patch };
    }
    const idx = zoneIndex ?? 0;
    const zones = effectiveZonesForSlot(slot, idx + 1);
    const nextZones = zones.map((z, i) => (i === idx ? { ...z, ...patch } : z));
    return applyZonesToSlot(slot, nextZones);
  };

  // Unlike width, a window's height doesn't affect wall tiling at all
  // (Tommy: "i want each window individually adjustable") — just a direct
  // per-slot field update, no re-tiling needed.
  const handleSetWindowHeight = (story: "ground" | "second", wallId: string, slotIndex: number, heightIn: number, zoneIndex?: number) => {
    setWallSlotsForStory(story, (prev) => {
      const slots = prev[wallId];
      if (!slots || !slots[slotIndex]) return prev;
      const nextSlots = slots.slice();
      nextSlots[slotIndex] = updateSlotZoneField(nextSlots[slotIndex]!, zoneIndex, { heightIn });
      // Only the bottom/only zone (zoneIndex undefined or 0) carries the
      // slot's own top-level type the auto-upgrade acts on — a non-bottom
      // zone's own type lives in its own zones[] entry, a separate concept
      // the click-cycle already handles independently.
      if (zoneIndex === undefined || zoneIndex === 0) {
        return { ...prev, [wallId]: applyBigHeaderAutoUpgrade(story, nextSlots, slotIndex) };
      }
      return { ...prev, [wallId]: nextSlots };
    });
  };

  // Same shape as handleSetWindowWidth — a Big Header's own width IS a
  // reserved-width change, so it needs the full retileWithOpenings dance
  // too, just clamped to bigHeaderWidthInRange instead. Uses isOpeningType
  // (window|door|column|big-header) for the ordinal, matching
  // getOpeningAnchors' own anchor order exactly.
  const handleSetBigHeaderWidth = (story: "ground" | "second", wallId: string, slotIndex: number, requestedWidthIn: number) => {
    const currentSlots = wallSlotsForStory(story)[wallId] ?? [];
    const geometry = wallGeometryFor(wallId);
    if (!geometry) return;
    const widthIn = Math.min(Math.max(requestedWidthIn, bigHeaderWidthInRange.minIn), bigHeaderWidthInRange.maxIn);
    const precedingOpenings = currentSlots.slice(0, slotIndex).filter((s) => isOpeningType(s.type)).length;
    const anchors = getOpeningAnchors(currentSlots).map((a) => (a.type === "column" ? { ...a, widthIn: COLUMN_TOTAL_WIDTH_IN } : a));
    if (!anchors[precedingOpenings]) return;
    anchors[precedingOpenings] = { ...anchors[precedingOpenings]!, widthIn };

    const slots = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerWidthInForTiling,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      anchors,
      geometry.allowBorrow,
      cornerMayWidenForTiling,
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;
    const finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored, slotIndexPinnedWallIds.has(wallId));
    const newIndex = findNthOpeningIndex(finalSlots, precedingOpenings);
    setSelectedSlot(newIndex === -1 ? null : { wallId, slotIndex: newIndex, story });
    setWallSlotsForStory(story, (prev) => ({
      ...prev,
      [wallId]: finalSlots,
    }));
  };

  // Unlike width, a Big Header's height doesn't affect wall tiling at all —
  // same direct per-slot field update as handleSetWindowHeight, clamped to
  // bigHeaderHeightInRange.
  const handleSetBigHeaderHeight = (story: "ground" | "second", wallId: string, slotIndex: number, requestedHeightIn: number) => {
    const heightIn = Math.min(Math.max(requestedHeightIn, bigHeaderHeightInRange.minIn), bigHeaderHeightInRange.maxIn);
    setWallSlotsForStory(story, (prev) => {
      const slots = prev[wallId];
      if (!slots || !slots[slotIndex]) return prev;
      const nextSlots = slots.slice();
      nextSlots[slotIndex] = { ...nextSlots[slotIndex]!, heightIn };
      return { ...prev, [wallId]: nextSlots };
    });
  };

  // Tommy: "2 with the option to have a sill under it as an option in the
  // left bar but default not" — a pure per-slot boolean, no re-tiling
  // (same shape as handleSetBigHeaderHeight).
  const handleSetIncludeSillOnBigHeader = (story: "ground" | "second", wallId: string, slotIndex: number, includeSillOnBigHeader: boolean) => {
    setWallSlotsForStory(story, (prev) => {
      const slots = prev[wallId];
      if (!slots || !slots[slotIndex]) return prev;
      const nextSlots = slots.slice();
      nextSlots[slotIndex] = { ...nextSlots[slotIndex]!, includeSillOnBigHeader };
      return { ...prev, [wallId]: nextSlots };
    });
  };

  // Dedicated left-bar spawn button (Tommy: "i like how the mid-wall bond
  // beam can be spawned in with the bottons on the left so lets keep
  // that") — reserves a new "big-header" PanelSlot centered among this
  // wall's own standard-family ordinals, at the catalog default width/
  // height, via the same retileWithOpenings mechanism every opening uses.
  // Not tied to any external reference point (unlike the gable Column
  // Panel's own peak-aligned placement), so a plain middle-ordinal pick is
  // enough — no "try every candidate" search needed here.
  const handleAddBigHeaderPanel = (story: "ground" | "second", wallId: string) => {
    const currentSlots = wallSlotsForStory(story)[wallId] ?? [];
    const geometry = wallGeometryFor(wallId);
    if (!geometry) return;
    const standardFamilyCount = currentSlots.filter((s) => s.type === "standard" || s.type === "braced").length;
    if (standardFamilyCount === 0) return;
    const ordinal = Math.floor(standardFamilyCount / 2);
    const existingAnchors = getOpeningAnchors(currentSlots).map((a) => (a.type === "column" ? { ...a, widthIn: COLUMN_TOTAL_WIDTH_IN } : a));
    const anchors = [
      ...existingAnchors,
      {
        beforeStandardCount: ordinal,
        type: "big-header" as const,
        widthIn: bigHeaderDefaultWidthIn.value,
        heightIn: bigHeaderDefaultHeightIn.value,
      },
    ];
    const slots = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerWidthInForTiling,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      anchors,
      geometry.allowBorrow,
      cornerMayWidenForTiling,
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;
    const finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored, slotIndexPinnedWallIds.has(wallId));
    setWallSlotsForStory(story, (prev) => ({ ...prev, [wallId]: finalSlots }));
  };

  // Same "direct per-slot field, no re-tiling" pattern as
  // handleSetWindowHeight — a braced panel's own pattern/mirror is purely
  // a style choice, never a width change (see handleToggleOpening's own
  // braced-block transitions), so this is the quick-pick dropdown's own
  // fast path alongside the full click-through cycle (Tommy: "include each
  // panel style for braced panels in the click-through cycle... allows the
  // user to change each panel").
  const handleSetBracedStyle = (
    story: "ground" | "second",
    wallId: string,
    slotIndex: number,
    pattern: BracePattern,
    mirrored: boolean,
    zoneIndex?: number,
  ) => {
    setWallSlotsForStory(story, (prev) => {
      const slots = prev[wallId];
      const slot = slots?.[slotIndex];
      if (!slots || !slot) return prev;
      const zone = zoneIndex !== undefined && zoneIndex > 0 ? effectiveZonesForSlot(slot, zoneIndex + 1)[zoneIndex] : zoneFromSlot(slot);
      if (zone?.type !== "braced") return prev;
      const nextSlots = slots.slice();
      nextSlots[slotIndex] = updateSlotZoneField(slot, zoneIndex, { bracedPattern: pattern, bracedMirrored: mirrored });
      return { ...prev, [wallId]: nextSlots };
    });
  };

  // Same "direct per-slot field, no re-tiling" pattern as
  // handleSetWindowHeight — a window's sill height (Tommy: "manipulate
  // sill and header height with the drag tool") is purely a vertical/Z-axis
  // concern, orthogonal to the horizontal wall-tiling system. Clamped to
  // the mfr spec sheet's sill/lintel-height range, and further clamped so
  // the sill can't push the RO's top past the wall's own height.
  const handleSetWindowSillHeight = (
    story: "ground" | "second",
    wallId: string,
    slotIndex: number,
    requestedSillHeightIn: number,
    zoneIndex?: number,
  ) => {
    const slots = wallSlotsForStory(story)[wallId];
    const slot = slots?.[slotIndex];
    if (!slots || !slot) return;
    const zone = zoneIndex !== undefined && zoneIndex > 0 ? effectiveZonesForSlot(slot, zoneIndex + 1)[zoneIndex]! : zoneFromSlot(slot);
    const windowHeightIn = zone.heightIn ?? standardWindowHeightDefaultIn.value;
    const effectiveWallHeightFt = story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt);
    const maxSillHeightIn = effectiveWallHeightFt * 12 - windowHeightIn;
    const clampMaxIn = Math.min(sillHeaderHeightInRange.maxIn, maxSillHeightIn);
    const clampedSillHeightIn = Math.min(Math.max(requestedSillHeightIn, sillHeaderHeightInRange.minIn), clampMaxIn);

    if (Math.abs(clampedSillHeightIn - requestedSillHeightIn) > 0.05) {
      if (sillClampNoticeTimerRef.current) clearTimeout(sillClampNoticeTimerRef.current);
      setSillClampNotice(
        `Sill height clamped to ${clampedSillHeightIn.toFixed(1)}in — allowed range is ${sillHeaderHeightInRange.minIn}"-${clampMaxIn.toFixed(1)}" for this window (mfr sill/header limit, and the header can't exceed the wall's own height).`,
      );
      sillClampNoticeTimerRef.current = setTimeout(() => setSillClampNotice(null), 4000);
    }

    const nextSlots = slots.slice();
    nextSlots[slotIndex] = updateSlotZoneField(nextSlots[slotIndex]!, zoneIndex, { sillHeightIn: clampedSillHeightIn });
    setWallSlotsForStory(story, (prev) => ({ ...prev, [wallId]: nextSlots }));
  };


  /** The `W x D` box behind the drawn octagon, or null when this is not an
   * octagon. Not memoized: it reads three wall lengths, and a new `useMemo`
   * in this file costs `preserve-manual-memoization` errors for nothing. */
  const octagonBox = footprint ? octagonBoxOf(footprint) : null;

  /**
   * Commit a new octagon box from the size panel.
   *
   * ⚠ Goes through `applyShapeChange` like every other shape edit, so the
   * panels are RESIZED rather than re-tiled — resizing an octagon must not
   * throw away the windows, doors and hand-set widths already on its walls.
   * `buildOctagonFootprint` always emits the same `"0".."7"` ids, so every
   * wall keeps its own panel array by key.
   */
  const handleResizeOctagon = (next: { widthFt: number; depthFt: number }) => {
    if (!footprint) return;
    const fp = buildOctagonFootprint(next.widthFt, next.depthFt);
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    if (!applyShapeChange(footprint, fp, nextPrimary)) return;
    setFootprint(fp);
    setPrimaryCornerIds(nextPrimary);
  };

  // Editing one wall's length resizes the whole shape so the parallel wall
  // changes to match. Rectangle: AB/CD share the width, BC/DA share the
  // depth (opposite walls are always equal). Octagon: "01"/"45" are the
  // width-driven straight walls, "23"/"67" are depth-driven — same idea,
  // regenerating the whole octagon so both walls in a pair move together.
  // The 4 mitered diagonal walls aren't independently editable yet.
  const handleEditWallLength = (wallId: Wall["id"], newLengthFt: number) => {
    if (!footprint) return;
    if (isBumpedOut) {
      // A bump-out'd shape has too many free parameters for the "regenerate
      // from 2 numbers" shortcut below — fall back to the general per-wall
      // editor, which only ever moves the wall's own end corner and the
      // next wall's end corner (see editWallLength's own docs).
      const fp = editWallLength(footprint, wallId, newLengthFt);
      // editWallLength never renumbers ids, so baseWallSlots' old keys are
      // still valid — every wall keeps its own panels, resized at whichever
      // end actually moved.
      if (!applyShapeChange(footprint, fp, primaryCornerIds)) return;
      setFootprint(fp);
      return;
    }
    if (footprint.corners.length === 4) {
      const isWidthWall = wallId === "AB" || wallId === "CD";
      const currentWidthFt = footprint.walls.find((w) => w.id === "AB")!.lengthFt;
      const currentDepthFt = footprint.walls.find((w) => w.id === "BC")!.lengthFt;
      const fp = buildRectangleFootprint(
        isWidthWall ? newLengthFt : currentWidthFt,
        isWidthWall ? currentDepthFt : newLengthFt,
      );
      const nextPrimary = new Set(fp.corners.map((c) => c.id));
      // buildRectangleFootprint always uses the same fixed "AB"/"BC"/"CD"/
      // "DA" wall ids regardless of dimensions, so baseWallSlots' keys stay
      // valid here too.
      if (!applyShapeChange(footprint, fp, nextPrimary)) return;
      setFootprint(fp);
      setPrimaryCornerIds(nextPrimary);
      return;
    }

    const isWidthWall = wallId === "01" || wallId === "45";
    const isDepthWall = wallId === "23" || wallId === "67";
    if (!isWidthWall && !isDepthWall) return; // diagonal walls: not editable yet
    /* ⚠ SOLVED, NOT APPROXIMATED — this line used to read
       `newLengthFt + 2 * clipFt` with `clipFt` taken off the OLD shape,
       while `buildOctagonFootprint` recomputes `clip` from `min(W, D)` of
       the NEW box. Editing the longer axis left `min` alone and worked;
       editing the SHORTER axis moved `clip` under the arithmetic, so the
       number typed was not the number you got and the opposite wall
       quietly resized. Measured on 2026-10-20: typing 16 into a 40x24
       octagon's side wall returned 12.458 and moved the untouched wall
       from 25.938 to 22.396. Tommy, same day: "they start to get really
       weird numbers and splitting the difference between panels that
       shoundnt be changing values."

       `setStraightWall` solves for the box in both branches, so a typed
       length lands within an eighth either side of the crossover. The
       coupling itself is REAL and remains — one shape, two degrees of
       freedom — and `OctagonSizePanel` is where it is said out loud. */
    const box = octagonBoxOf(footprint);
    if (!box) return;
    const resized = setStraightWall(box, isWidthWall ? "straightWidth" : "straightDepth", newLengthFt);
    const fp = buildOctagonFootprint(resized.box.widthFt, resized.box.depthFt);
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    // buildOctagonFootprint always uses the same fixed "0".."7" wall ids too.
    if (!applyShapeChange(footprint, fp, nextPrimary)) return;
    setFootprint(fp);
    setPrimaryCornerIds(nextPrimary);
  };

  const isWallLengthEditable = (wallId: string): boolean => {
    if (!footprint) return false;
    // Bump-outs only ever introduce right-angle (never mitered) corners —
    // every wall on a bumped-out shape is editable via editWallLength.
    if (isBumpedOut) return true;
    if (footprint.corners.length === 4) return true;
    return wallId === "01" || wallId === "45" || wallId === "23" || wallId === "67";
  };

  // Corner ids get renumbered "0".."n-1" by insertBumpOut (same convention
  // as buildOctagonFootprint for a non-lettered shape), so the previous
  // least-accessible-corner id may no longer exist — reset it to the first
  // remaining *primary* corner, same spirit as a fresh draw (never one of
  // the 4 new corners, which never get a least-accessible dot — see
  // FootprintCanvas's corner-marker rendering). The result stays a
  // butt-joint (all right angles), so it keeps using the least-accessible-
  // corner marker, not the octagon's per-wall safety-corner rule.
  /* ⚠ DRAW WALL state is EPHEMERAL and deliberately not in `ProjectState`.
     A half-picked corner and an undecided split are mid-gesture, not part of
     the building: saving them would reload someone into a question they have
     long forgotten, and undo would step through them. */
  /** A pick is a CORNER the building already has, or a JOINT between two
   * panels on a wall. The second kind is the one that needs a corner
   * inserted before the building can be cut. */
  type DrawWallPick = { kind: "corner"; cornerId: string } | { kind: "joint"; wallId: string; offsetFt: number };
  const [drawWallFirstPick, setDrawWallFirstPick] = useState<DrawWallPick | null>(null);
  /** The split, plus the panels for any wall the cut divided — see
   * `beginSplit` for why they cannot be read from `baseWallSlots`. */
  const [pendingSplit, setPendingSplit] = useState<{
    split: SplitResult;
    slotsByHostWallId: Record<string, PanelSlot[]>;
  } | null>(null);


  const cancelDrawWall = () => {
    setDrawWallFirstPick(null);
    setPendingSplit(null);
  };

  /**
   * First click arms the wall, second click cuts.
   *
   * ⚠ A refused chord does NOT clear the first pick. Every refusal is
   * something a pointer can do by accident — the same corner twice, the
   * neighbour that already has a wall to it, a line that would leave the
   * building through a bump-out's notch — so a refused second click is
   * treated as a miss and he can just pick a different second corner.
   * Clearing it would make every misclick cost two.
   */
  /**
   * Turn two picks into a split.
   *
   * ⚠ A JOINT PICK NEEDS A CORNER INSERTED FIRST, and the host wall's
   * panels have to be divided at the same time. `insertCornerAtWallOffset`
   * replaces the host wall with two, so `baseWallSlots` no longer has an
   * entry for either of them — the panels are carried here instead, split at
   * the joint with `splitSlotsAtJoint`, which cuts NO panel: the slots before
   * the joint go to one half and those after it to the other, exactly as they
   * are.
   *
   * ⚠ Both picks are inserted BEFORE the chord is taken, so the second
   * insert sees the first one's footprint. Inserting into the original twice
   * would silently discard the first corner.
   */
  const beginSplit = (a: DrawWallPick, b: DrawWallPick) => {
    if (!footprint) return;
    let working = footprint;
    const slotsByHostWallId: Record<string, PanelSlot[]> = {};
    const cornerIdOf = (pick: DrawWallPick): string | null => {
      if (pick.kind === "corner") return pick.cornerId;
      const slots = baseWallSlots[pick.wallId] ?? [];
      const joints = wallPanelJointsFor(working, pick.wallId, slots);
      const joint = joints.find((j) => Math.abs(j.offsetFt - pick.offsetFt) < 1e-6);
      if (!joint) return null;
      const inserted = insertCornerAtWallOffset(working, pick.wallId, pick.offsetFt);
      if (!inserted) return null;
      const halves = splitSlotsAtJoint(slots, joint.slotIndex);
      slotsByHostWallId[inserted.beforeWallId] = halves.before;
      slotsByHostWallId[inserted.afterWallId] = halves.after;
      working = inserted.footprint;
      return inserted.cornerId;
    };
    const idA = cornerIdOf(a);
    const idB = cornerIdOf(b);
    if (!idA || !idB) {
      setPanelPlacementNotice("That point is no longer on the building — try picking it again.");
      return;
    }
    const result = splitFootprintByChord(working, idA, idB);
    if (isSplitRefusal(result)) {
      setPanelPlacementNotice(splitRefusalMessage(result));
      return;
    }
    setPendingSplit({ split: result, slotsByHostWallId });
  };

  const samePick = (a: DrawWallPick, b: DrawWallPick) =>
    a.kind === "corner" && b.kind === "corner"
      ? a.cornerId === b.cornerId
      : a.kind === "joint" && b.kind === "joint"
        ? a.wallId === b.wallId && Math.abs(a.offsetFt - b.offsetFt) < 1e-6
        : false;

  const pickDrawWallPoint = (pick: DrawWallPick) => {
    if (!footprint) return;
    if (drawWallFirstPick === null) {
      setDrawWallFirstPick(pick);
      setPendingSplit(null);
      return;
    }
    if (samePick(drawWallFirstPick, pick)) {
      setDrawWallFirstPick(null); // clicking the armed point disarms it
      return;
    }
    beginSplit(drawWallFirstPick, pick);
  };

  const handlePickDrawWallCorner = (cornerId: string) => pickDrawWallPoint({ kind: "corner", cornerId });
  const handlePickDrawWallJoint = (wallId: string, offsetFt: number) =>
    pickDrawWallPoint({ kind: "joint", wallId, offsetFt });

  /**
   * Keep one side of the cut — Tommy's split-and-choose, 2026-10-21.
   *
   * ⚠ Modelled on `handleAddBumpOut`, and for the same reason: a split
   * RENUMBERS every corner, so panels, run stops and the run-stop opening
   * memory are all keyed by ids that no longer exist. The bump-out recovers
   * the correlation by matching start/end POINTS; a split does not have to,
   * because `splitFootprintByChord` already returns `wallIdMap` — new id to
   * the old id it came from, with `null` for the chord. Same mechanism, a
   * better source for it.
   *
   * ⚠ This re-tiles, and that is correct rather than a tile-once regression.
   * The SHAPE changed: walls at the cut have different runs, and the chord is
   * a wall that did not exist a moment ago and has no panels to preserve.
   * That is the same line `handleAddBumpOut` sits on. See
   * `retileCallSites.test.ts`, where it is classified.
   */
  const handleKeepSplitRegion = (regionIndex: 0 | 1) => {
    if (!footprint || !pendingSplit) return;
    const region = pendingSplit.split.regions[regionIndex]!;
    const fp = region.footprint;
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    const nextLeastAccessible = [...nextPrimary][0] ?? fp.corners[0]!.id;

    const oldSlotsByNewWallId: Record<string, PanelSlot[] | undefined> = {};
    const nextRunStops: Record<string, WallRunStop> = {};
    const nextRemembered: Record<string, RunStopOpeningMemory> = {};
    const nextRememberedSecond: Record<string, RunStopOpeningMemory> = {};
    for (const [newWallId, oldWallId] of Object.entries(region.wallIdMap)) {
      if (oldWallId === null) continue; // the chord: new wall, nothing to carry
      /* ⚠ A wall the cut DIVIDED has its panels here rather than in
         `baseWallSlots`, which only knows the wall before it was split. */
      oldSlotsByNewWallId[newWallId] = pendingSplit.slotsByHostWallId[oldWallId] ?? baseWallSlots[oldWallId];
      if (wallRunStopsByWallId[oldWallId]) nextRunStops[newWallId] = wallRunStopsByWallId[oldWallId]!;
      const remembered = unbuiltOpeningsByStoryAndWallId.ground[oldWallId];
      if (remembered) nextRemembered[newWallId] = remembered;
      const rememberedSecond = unbuiltOpeningsByStoryAndWallId.second[oldWallId];
      if (rememberedSecond) nextRememberedSecond[newWallId] = rememberedSecond;
    }

    setFootprint(fp);
    /* ⚠ Not a bump-out, but the same thing this flag actually gates: the
       shape is no longer a pristine rectangle or octagon, so wall lengths are
       edited by the general per-wall editor rather than regenerated from two
       numbers. The name is older than its job. */
    setIsBumpedOut(true);
    setPrimaryCornerIds(nextPrimary);
    setLeastAccessibleCorner(nextLeastAccessible);
    setWallRunStopsByWallId(nextRunStops);
    applyRetiledStory(
      "ground",
      retilePreservingOpenings(fp, nextLeastAccessible, nextPrimary, oldSlotsByNewWallId, nextRunStops, "ground", nextRemembered),
      nextLeastAccessible,
    );
    setUnbuiltOpeningsByStoryAndWallId((prev) => ({ ...prev, second: nextRememberedSecond }));
    for (const w of fp.walls) {
      if (oldSlotsByNewWallId[w.id] === undefined) reconcileNewWallZones("ground", w.id);
    }
    cancelDrawWall();
    setShapeTool("edit");
    setPanelPlacementNotice(
      "The new wall is in and the other side was discarded. Every wall that stayed kept its openings; the new wall was tiled fresh.",
    );
  };

  /** The candidate outlines the canvas draws, in footprint feet. */
  const drawWallRegions = pendingSplit
    ? pendingSplit.split.regions.map((r) => ({ points: r.footprint.corners.map((c) => c.point) }))
    : null;


  /**
   * Add or remove a courtyard — the second loop.
   *
   * ⚠ A SHAPE CHANGE, so it re-tiles, for the same reason a bump-out does:
   * the inner ring's walls did not exist a moment ago and have no panels to
   * preserve. The OUTER ring's walls keep their ids, so their openings,
   * bracing and hand-set widths ride across on the correlation map — which
   * is just identity here, because `addCourtyard` renames nothing.
   *
   * ⚠ Nothing in the tiler needed changing for this. Measured on a 60x40
   * ring with a 10ft-wide building: all eight walls on both loops come out
   * with panels summing exactly to their own runs, and the courtyard's
   * reflex corners are handled by the rule already written for a bump-out's
   * inside corners.
   */
  const commitFootprintShapeChange = (fp: Footprint) => {
    if (!footprint) return;
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    const nextLeastAccessible = leastAccessibleCorner && nextPrimary.has(leastAccessibleCorner)
      ? leastAccessibleCorner
      : ([...nextPrimary][0] ?? fp.corners[0]!.id);
    const oldSlotsByNewWallId: Record<string, PanelSlot[] | undefined> = {};
    for (const wall of fp.walls) oldSlotsByNewWallId[wall.id] = baseWallSlots[wall.id];
    setFootprint(fp);
    setPrimaryCornerIds(nextPrimary);
    setLeastAccessibleCorner(nextLeastAccessible);
    applyRetiledStory(
      "ground",
      retilePreservingOpenings(
        fp,
        nextLeastAccessible,
        nextPrimary,
        oldSlotsByNewWallId,
        wallRunStopsByWallId,
        "ground",
        unbuiltOpeningsByStoryAndWallId.ground,
      ),
      nextLeastAccessible,
    );
    for (const wall of fp.walls) {
      if (oldSlotsByNewWallId[wall.id] === undefined) reconcileNewWallZones("ground", wall.id);
    }
  };

  const handleAddCourtyard = (fp: Footprint) => {
    commitFootprintShapeChange(fp);
    setPanelPlacementNotice(
      "Courtyard added. The inner walls’ weather side faces into it, so their compass labels are the opposite of the outer ring’s.",
    );
  };

  const handleRemoveCourtyard = () => {
    if (!footprint) return;
    commitFootprintShapeChange(removeCourtyards(footprint));
    setPanelPlacementNotice("Courtyard removed. The inner ring’s panels went with it.");
  };

  const handleAddBumpOut = (wallId: string, spanStartFt: number, spanEndFt: number, depthFt: number) => {
    if (!footprint) return;
    const { footprint: fp, primaryCornerIds: nextPrimary } = insertBumpOut(
      footprint,
      wallId,
      spanStartFt,
      spanEndFt,
      depthFt,
      primaryCornerIds,
    );
    const nextLeastAccessible = [...nextPrimary][0] ?? fp.corners[0]!.id;

    // insertBumpOut renumbers every corner/wall id from scratch, even for
    // walls it didn't touch — but an untouched wall keeps the EXACT same
    // start/end points (see insertBumpOut's own code), so its real
    // identity survives as a point-pair match even though its id doesn't.
    // The wall actually being bumped out is excluded even if some partial
    // match existed — its own openings have nowhere valid to go once
    // split into a jog (Tommy: make bump-out reliable, not "produce
    // panels that adhere to the primary floor layout" — the OTHER walls
    // are what must survive intact, not necessarily this one).
    const pointKey = (p: { x: number; y: number }) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
    const oldCornersById = new Map(footprint.corners.map((c) => [c.id, c.point]));
    const oldWallIdByPointPair = new Map<string, string>();
    for (const w of footprint.walls) {
      if (w.id === wallId) continue;
      const start = oldCornersById.get(w.startCorner)!;
      const end = oldCornersById.get(w.endCorner)!;
      oldWallIdByPointPair.set(`${pointKey(start)}|${pointKey(end)}`, w.id);
    }
    const newCornersById = new Map(fp.corners.map((c) => [c.id, c.point]));
    const oldSlotsByNewWallId: Record<string, PanelSlot[] | undefined> = {};
    const nextRunStops: Record<string, WallRunStop> = {};
    const nextRemembered: Record<string, RunStopOpeningMemory> = {};
    const nextRememberedSecond: Record<string, RunStopOpeningMemory> = {};
    for (const w of fp.walls) {
      const start = newCornersById.get(w.startCorner)!;
      const end = newCornersById.get(w.endCorner)!;
      const oldWallId = oldWallIdByPointPair.get(`${pointKey(start)}|${pointKey(end)}`);
      if (oldWallId) oldSlotsByNewWallId[w.id] = baseWallSlots[oldWallId];
      // A run stop is keyed by wall id, so it has to ride the SAME
      // point-pair correlation the slots do — left un-remapped it would
      // silently stop a different wall than the one the user stopped.
      // Deliberately nothing is carried onto the bumped-out wall itself
      // (excluded from the map above), for the same reason its openings
      // aren't: its old run no longer exists as a run.
      if (oldWallId && wallRunStopsByWallId[oldWallId]) nextRunStops[w.id] = wallRunStopsByWallId[oldWallId]!;
      // And so does Stage 3's opening memory, for exactly the same reason: a
      // remembered window keyed by a stale id would come back on the wrong
      // wall.
      const remembered = oldWallId ? unbuiltOpeningsByStoryAndWallId.ground[oldWallId] : undefined;
      if (remembered) nextRemembered[w.id] = remembered;
      // **The SECOND story's memory rides the same correlation.** This gesture
      // renumbers ids for both stories at once — the footprint is shared — so a
      // second-story memory left on its old key is a remembered window waiting
      // to come back on the wrong wall, exactly as on the ground. Lower stakes
      // only because the second story's own slots are already left stale by this
      // gesture; a stale key here is stale DESIGN data, which is the argument
      // `pruneOpeningMemoryToLiveWalls` is built on.
      const rememberedSecond = oldWallId ? unbuiltOpeningsByStoryAndWallId.second[oldWallId] : undefined;
      if (rememberedSecond) nextRememberedSecond[w.id] = rememberedSecond;
    }

    setFootprint(fp);
    setIsBumpedOut(true);
    setPrimaryCornerIds(nextPrimary);
    setLeastAccessibleCorner(nextLeastAccessible);
    setWallRunStopsByWallId(nextRunStops);
    applyRetiledStory(
      "ground",
      retilePreservingOpenings(fp, nextLeastAccessible, nextPrimary, oldSlotsByNewWallId, nextRunStops, "ground", nextRemembered),
      nextLeastAccessible,
    );
    // `applyRetiledStory` writes the GROUND half; the second story is not
    // re-tiled here (see this handler's own note on second-story data), so its
    // memory is re-keyed rather than re-derived.
    setUnbuiltOpeningsByStoryAndWallId((prev) => ({ ...prev, second: nextRememberedSecond }));
    setShapeTool("edit");
    // Only the bump-out's own new jog wall(s) (no old counterpart at all)
    // can be freshly seeded here — every OTHER wall keeps its real,
    // possibly already-decided upper-zone data via retilePreservingOpenings
    // above, so reconcileNewWallZones (per-wall, not the blanket
    // reconcileWallZonesForHeightChange) is what's safe to call per wall.
    for (const w of fp.walls) {
      if (oldSlotsByNewWallId[w.id] === undefined) reconcileNewWallZones("ground", w.id);
    }
  };

  // Drags one wall perpendicular to itself — its 2 neighbor walls absorb
  // the change, everything else (including the "opposite" wall on a plain
  // rectangle) stays fixed. Deliberately different from the typed-length
  // editor above, which mirrors the opposite wall on a plain rectangle —
  // this uniform "neighbors absorb" rule is used for every rectilinear
  // shape (plain rectangle or bump-out'd) since there's no well-defined
  // "opposite wall" once a shape's been bumped out.
  const handleDragWall = (wallId: string, offsetFt: number) => {
    if (!footprint) return;
    if (footprintIsAllRightAngles(footprint)) {
      // dragWallBounded itself never renumbers ids (same reuse as
      // editWallLength), but a follow-up collapse (Tommy: "walls can snap
      // back into each other and reform a straight one") can — it removes
      // a near-zero wall's corner and renumbers every survivor "0".."n-1",
      // which can shift EVERY wall's id, not just the ones next to the
      // drag. dragWallBounded (not plain dragWall) guards against a large
      // drag sliding a corner past an unrelated wall (Tommy: "it flips the
      // opposing wall to the other side of the floor layout line").
      const dragged = dragWallBounded(footprint, wallId, offsetFt);
      const { footprint: fp, primaryCornerIds: nextPrimary } = collapseNearZeroWalls(dragged, primaryCornerIds);

      if (fp === dragged) {
        /* TILE-ONCE STAGE 4 — no collapse fired, so every wall id survives and
           this is a pure LENGTH change: the ordinary drag, and the one that
           happens many times a second while the mouse is down. Panels are
           resized at whichever end moved rather than the building being
           re-tiled, which is Tommy's *"live during the drag, not a recompute
           on release"*.

           ⚠ Nothing is written unless the resize succeeds — including the
           footprint, which is why `setFootprint` moved INSIDE the branch. A
           drag that cannot be absorbed must leave the building exactly as it
           was, not shaped one way with panels for another. */
        if (!applyShapeChange(footprint, fp, nextPrimary)) return;
        setFootprint(fp);
        setPrimaryCornerIds(nextPrimary);
      } else {
        /* ⚠ A COLLAPSE FIRED, AND THIS BRANCH KEEPS RE-DERIVING ON PURPOSE.
           Tommy: *"walls can snap back into each other and reform a straight
           one"* — a wall is REMOVED and every survivor is renumbered. That is
           a shape change, not a length change, and the spec is explicit that
           shape changes stay re-derived: the merged wall has no single prior
           panel array to manipulate, so there is nothing for tile-once to
           preserve. Re-tiling here is the correct answer, not a leftover. */
        setFootprint(fp);
        setPrimaryCornerIds(nextPrimary);
        // A collapse fired — correlate by exact point-pair (a collapse never
        // moves a surviving corner's point, only removes one and relabels
        // the rest), same technique handleAddBumpOut uses for insertBumpOut's
        // renumbering.
        const pointKey = (p: { x: number; y: number }) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
        const draggedCornersById = new Map(dragged.corners.map((c) => [c.id, c.point]));
        const draggedWallIdByPointPair = new Map<string, string>();
        for (const w of dragged.walls) {
          const start = draggedCornersById.get(w.startCorner)!;
          const end = draggedCornersById.get(w.endCorner)!;
          draggedWallIdByPointPair.set(`${pointKey(start)}|${pointKey(end)}`, w.id);
        }
        const newCornersById = new Map(fp.corners.map((c) => [c.id, c.point]));
        const oldSlotsByNewWallId: Record<string, PanelSlot[] | undefined> = {};
        const nextRunStops: Record<string, WallRunStop> = {};
        const nextRemembered: Record<string, RunStopOpeningMemory> = {};
        const nextRememberedSecond: Record<string, RunStopOpeningMemory> = {};
        for (const w of fp.walls) {
          const start = newCornersById.get(w.startCorner)!;
          const end = newCornersById.get(w.endCorner)!;
          const draggedWallId = draggedWallIdByPointPair.get(`${pointKey(start)}|${pointKey(end)}`);
          if (draggedWallId) oldSlotsByNewWallId[w.id] = baseWallSlots[draggedWallId];
          // Same reason as the bump-out path: a collapse renumbers ids, and
          // a run stop keyed by a stale id stops the wrong wall.
          if (draggedWallId && wallRunStopsByWallId[draggedWallId]) {
            nextRunStops[w.id] = wallRunStopsByWallId[draggedWallId]!;
          }
          // And Stage 3's opening memory rides the same correlation, or a
          // remembered window comes back on the wrong wall — on BOTH stories,
          // since a collapse renumbers the ids both of them are keyed by. See
          // the same pair in `handleAddBumpOut`.
          const remembered = draggedWallId ? unbuiltOpeningsByStoryAndWallId.ground[draggedWallId] : undefined;
          if (remembered) nextRemembered[w.id] = remembered;
          const rememberedSecond = draggedWallId ? unbuiltOpeningsByStoryAndWallId.second[draggedWallId] : undefined;
          if (rememberedSecond) nextRememberedSecond[w.id] = rememberedSecond;
        }
        setWallRunStopsByWallId(nextRunStops);

        // leastAccessibleCorner is a site-wide marker corner id — if the
        // collapse renumbered ids, the old value may no longer point at any
        // corner (computeGapEnd asserts it exists, and would crash
        // otherwise). Carry it forward by point match; if the collapse
        // removed that exact corner, fall back to the same
        // "first surviving primary corner, else first corner" rule
        // handleAddBumpOut already uses for the same situation.
        const oldLeastAccessiblePoint = draggedCornersById.get(leastAccessibleCorner)!;
        const matchedCorner = fp.corners.find((c) => pointKey(c.point) === pointKey(oldLeastAccessiblePoint));
        const nextLeastAccessible: CornerId = matchedCorner
          ? matchedCorner.id
          : ([...nextPrimary][0] ?? fp.corners[0]!.id);
        setLeastAccessibleCorner(nextLeastAccessible);

        applyRetiledStory(
          "ground",
          retilePreservingOpenings(
            fp,
            nextLeastAccessible,
            nextPrimary,
            oldSlotsByNewWallId,
            nextRunStops,
            "ground",
            nextRemembered,
          ),
          nextLeastAccessible,
        );
        // Re-keyed, not re-derived: this branch does not re-tile the second
        // story. Same as the bump-out path.
        setUnbuiltOpeningsByStoryAndWallId((prev) => ({ ...prev, second: nextRememberedSecond }));
      }
      return;
    }

    // Octagon: only the 4 straight walls are draggable (isWallLengthEditable
    // enforces this at pick time); a straight wall's neighbors are 45deg
    // diagonals, not perpendicular to it, so the "neighbors absorb" rule
    // above doesn't apply — instead, map the drag straight to a width/depth
    // change and regenerate the whole octagon symmetrically, same as the
    // typed-length editor's octagon branch. A single wall's perpendicular
    // move is half of the whole shape's width/depth delta, since
    // buildOctagonFootprint grows/shrinks symmetrically about the center.
    const isWidthWall = wallId === "01" || wallId === "45";
    const isDepthWall = wallId === "23" || wallId === "67";
    if (!isWidthWall && !isDepthWall) return; // diagonal walls: not draggable
    /* The same reader the typed editor and the size panel use. A drag has
       no typed number to honour, so applying an OFFSET to the box is correct
       here — but the coupling still shows: dragging the shorter axis moves
       `clip`, and the perpendicular walls with it. That is the shape, not a
       bug, and `OctagonSizePanel` is where it is explained. */
    const dragBox = octagonBoxOf(footprint);
    if (!dragBox) return;
    const { widthFt, depthFt } = dragBox;
    const fp = buildOctagonFootprint(
      isWidthWall ? widthFt + 2 * offsetFt : widthFt,
      isDepthWall ? depthFt + 2 * offsetFt : depthFt,
    );
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    // Same treatment as the typed-length editor's octagon branch: the shape
    // regenerates symmetrically, every wall id survives, and each wall's
    // panels are resized at the end that moved.
    if (!applyShapeChange(footprint, fp, nextPrimary)) return;
    setFootprint(fp);
    setPrimaryCornerIds(nextPrimary);
  };

  // For rendering: butting walls' content starts inset from the actual
  // corner point by the perpendicular wall's thickness, since they don't
  // own a corner panel there and instead butt against the other wall's
  // face. A reflex-corner winner's start needs the opposite treatment —
  // its content starts *before* its own nominal corner (a negative offset)
  // so it extends the extra `extraLengthIn` back into the losing wall's
  // territory; the length side of that extension is handled by `retile`/
  // `wallGeometryFor` adding `extraLengthIn` to the tiled length, which
  // naturally overshoots the wall's *end* corner if the extension is there
  // instead, with no separate offset needed.
  const wallRenderOffsetIn = useMemo(() => {
    if (!footprint) return {};
    const offsets: Record<string, number> = {};
    for (const wall of footprint.walls) {
      // `runStartOffsetIn` folds the butt-joint inset, the reflex extension
      // and (Stage 3) any start stop into one number. Every plan-view
      // consumer — the printable PlanViewDiagram, the live FootprintCanvas
      // and the panel snap lines — reads this one map, so they cannot
      // disagree about where a wall's content starts.
      offsets[wall.id] = wallGeometryFor(wall.id)?.runStartOffsetIn ?? 0;
    }
    return offsets;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wallGeometryFor is a per-render partial application; its inputs are listed
  }, [footprint, thicknessIn, primaryCornerIds, leastAccessibleCorner, wallRunStopsByWallId]);

  /* ⚠ BOTH OF THESE READ `wallRenderOffsetIn`, so they live AFTER it. They
     were written next to the rest of the draw-wall code and tsc caught the
     block-scope error immediately — a joint measured from an offset that is
     not yet assigned would be a target that does not sit where it looks. */

  /** Every panel joint a new wall may land on. Not memoized: it walks the
   * walls once and only while the tool is open, and a new `useMemo` in this
   * file costs `preserve-manual-memoization` errors for nothing. */
  const drawWallJoints =
    footprint && shapeTool === "draw-wall" ? allWallPanelJoints(footprint, baseWallSlots, wallRenderOffsetIn) : [];

  /** The joints of one wall on an arbitrary footprint — `beginSplit` needs
   * this against its own WORKING footprint, which already has the first
   * pick's corner in it, not against the one on screen. */
  const wallPanelJointsFor = (fp: Footprint, wallId: string, slots: PanelSlot[]) =>
    allWallPanelJoints(fp, { [wallId]: slots }, wallRenderOffsetIn).filter((j) => j.wallId === wallId);

  /**
   * Stage 3 — where each wall's unbuilt span(s) actually sit, as inches
   * along that wall from its own TRUE start corner. Derived once here (the
   * only place that has both corner ownership and the stops) and handed to
   * every plan-view renderer, so the printable sheet and the live canvas
   * cannot draw the boundary in two different places.
   *
   * Note the span starts where this wall's run WOULD have started, not at
   * the corner point: where the neighbour owns the corner, its panel really
   * is in that first wall-thickness of this wall's line, and a dashed
   * "nothing here" line drawn across it would be a lie.
   */
  const wallRunSpanData = useMemo(() => {
    const unbuilt: Record<string, { fromIn: number; toIn: number }[]> = {};
    /** The complement: where this wall's run actually STARTS and ENDS, in
     * the same corner-origin coordinates. The gable row reads this — it is a
     * panel generator, not a total, so it has to stop where the wall does. */
    const built: Record<string, { builtStartIn: number; builtEndIn: number }> = {};
    if (!footprint) return { unbuilt, built };
    for (const wall of footprint.walls) {
      const geometry = wallGeometryFor(wall.id);
      if (!geometry || (geometry.startStopIn <= 0 && geometry.endStopIn <= 0)) continue;
      const wallLengthIn = wall.lengthFt * 12;
      const forWall: { fromIn: number; toIn: number }[] = [];
      if (geometry.startStopIn > 0) {
        forWall.push({ fromIn: geometry.runStartOffsetIn - geometry.startStopIn, toIn: geometry.runStartOffsetIn });
      }
      if (geometry.endStopIn > 0) {
        forWall.push({
          fromIn: wallLengthIn - geometry.runEndOffsetIn,
          toIn: wallLengthIn - geometry.runEndOffsetIn + geometry.endStopIn,
        });
      }
      unbuilt[wall.id] = forWall;
      // Measured to where the PANELS actually start, not to the bare stop:
      // on a wall that butts a neighbour the run already begins a
      // wall-thickness in, and clamping the gable to the bare stop would
      // leave a gable panel hanging over that much unbuilt wall.
      built[wall.id] = {
        builtStartIn: geometry.startStopIn > 0 ? geometry.runStartOffsetIn : 0,
        builtEndIn: geometry.endStopIn > 0 ? wallLengthIn - geometry.runEndOffsetIn : wallLengthIn,
      };
    }
    return { unbuilt, built };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wallGeometryFor is a per-render partial application; its inputs are listed
  }, [footprint, thicknessIn, primaryCornerIds, leastAccessibleCorner, wallRunStopsByWallId]);
  const wallUnbuiltSpansIn = wallRunSpanData.unbuilt;
  const gableRunStopByWallId = wallRunSpanData.built;

  // Under "loose-packed-braced" (today's default system), braced-panel
  // placement is now real stored state directly in `baseWallSlots` (Tommy:
  // "softly decouple [seismic auto-population] to be an original
  // suggestion... allows the user to change each panel") — seeded/
  // preserved by `reconcileBracedPlacement` inside `retile`/
  // `retilePreservingOpenings` whenever a wall's slots are recomputed, not
  // re-derived fresh here every render. The other 2 panelization types are
  // still a derived overlay (uniform by explicit choice, not the
  // automatic corner-proximity rule), recomputed fresh from the base slots
  // every render — never stored, so switching panelization type just
  // falls out of recomputation instead of needing to be undone.


  /* ⚠ THE UNDO MACHINERY LIVES HERE, BELOW `stories`, AND THAT IS NOT
     ARBITRARY. The capture effect calls `buildProjectState`, which reads
     `stories` — declared just above. Placed earlier in the file, the React
     Compiler lint reports "accessed before it is declared, which prevents
     the earlier access from updating when this value changes over time":
     a staleness warning, and a fair one.

     The out-of-order read is pre-existing — `buildProjectState` sits at the
     top of the file and `stories` near the middle — but Save and Load only
     ever called it from EVENT HANDLERS, which the compiler does not analyse
     for staleness. An effect is a reactive scope, so putting one on that
     path surfaced the ordering for the first time. Moving the effect below
     the declaration is the honest fix available without hoisting a useMemo
     2,800 lines; hoisting `stories` itself is the real one, and is not
     being attempted in the same change as undo. */
  /* UNDO: capture.

     Watching the DOCUMENT rather than instrumenting every handler. page.tsx
     has dozens of mutating handlers and a `pushUndo()` added to each would
     be a list nobody can prove complete — the one that got missed would
     simply not be undoable, and nothing would say so. Comparing the built
     state against the top of the stack covers every edit there is, present
     and future, because an edit is BY DEFINITION a change to that state.

     The comparison is ~69 reference checks (`sameDocument`), and building
     the state is an object literal plus one prune, so this is affordable
     after every render. */
  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    const current = buildProjectState();
    const history = historyRef.current;
    if (history.index < 0) {
      // The baseline. Without it the first edit would have nothing to go
      // back TO, and undo would look broken exactly once.
      historyRef.current = pushUndoEntry(history, current);
      syncUndoAvailability();
      return;
    }
    if (sameDocument(current, history.entries[history.index]!)) return;
    if (coalesceTimerRef.current !== null) window.clearTimeout(coalesceTimerRef.current);
    coalesceTimerRef.current = window.setTimeout(() => {
      coalesceTimerRef.current = null;
      historyRef.current = pushUndoEntry(historyRef.current, buildProjectState());
      syncUndoAvailability();
    }, UNDO_COALESCE_MS);
  });

  /** ⚠ Commit a change that is still inside its coalescing window.
   * Without this, editing and immediately hitting undo would step back past
   * the edit that was never recorded — the user would lose the thing they
   * just did AND the thing before it, from one press. */
  const flushPendingUndoEntry = () => {
    if (coalesceTimerRef.current === null) return;
    window.clearTimeout(coalesceTimerRef.current);
    coalesceTimerRef.current = null;
    historyRef.current = pushUndoEntry(historyRef.current, buildProjectState());
  };

  const stepHistory = (step: typeof undoTo) => {
    flushPendingUndoEntry();
    const next = step(historyRef.current);
    if (!next) return;
    historyRef.current = next.history;
    restoringRef.current = true;
    // `applyViewState: false` — see applyProjectState. The restored state is
    // now identical to entries[index] by construction, so the capture effect
    // above finds no change and records nothing even if the flag is missed.
    applyProjectState(next.state, { applyRole: false, applyViewState: false });
    syncUndoAvailability();
  };
  const handleUndo = () => stepHistory(undoTo);
  const handleRedo = () => stepHistory(redoTo);

  /* Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (plus Ctrl+Y, which Windows users reach
     for). ⚠ Ignored while the user is typing in a field, where the browser's
     own undo is what they mean — taking it over would make a mis-typed wall
     length un-fixable by the shortcut everyone has in their fingers. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });


  // Sum of every beam's own COVERED length (not the whole wall's run) —
  // Stage 1 could get away with the wall's full run since coverage was
  // always 100%; Stage 2 beams can cover just part of a wall.
  const midWallBeamWallLengthTotalIn = useMemo(() => {
    if (!footprint) return 0;
    let totalIn = 0;
    for (const story of stories) {
      const beams = midWallBeamsByStoryAndWallId[story.id];
      for (const wall of footprint.walls) {
        const wallBeams = beams[wall.id];
        if (!wallBeams || wallBeams.length === 0) continue;
        const offsetsIn = (story.wallSlots[wall.id] ?? []).reduce<number[]>(
          (acc, s) => [...acc, acc[acc.length - 1]! + s.widthIn],
          [0],
        );
        for (const beam of wallBeams) {
          totalIn += Math.max(0, (offsetsIn[beam.endSlotIndex] ?? 0) - (offsetsIn[beam.startSlotIndex] ?? 0));
        }
      }
    }
    return totalIn;
  }, [footprint, stories, midWallBeamsByStoryAndWallId]);

  // Plan View "height-slice lens" (Tommy: "the 2d viewer is basically a lens
  // of which height slice you are at... maybe it sees the ground level, and
  // then can shift upward to the next ring of panels") — which story the 2D
  // Plan View currently shows/edits. `effectiveViewedStoryId` (not the raw
  // state) is what every consumer reads, so removing the second story (or
  // drawing a brand-new footprint, which already resets `secondStory` to
  // null) automatically falls back to the ground floor with no extra reset
  // logic needed.
  const [viewedStoryId, setViewedStoryId] = useState<"ground" | "second">("ground");
  const effectiveViewedStoryId = stories.length > 1 ? viewedStoryId : "ground";

  // Shared by both entry points to this action — the 2D toolbar's "Add
  // Second Story" button and the elevation view's "Add Layer" button (Tommy:
  // "the add lay[er] button should be next to add gable end button").
  // Toggling on deep-copies the ground floor's current wallSlots (genuinely
  // independent storage, not a shared reference); toggling off drops it
  // entirely — re-adding always builds a fresh mirror, same "no memory"
  // behavior wallSlots itself has today.
  const handleToggleSecondStory = useCallback(() => {
    setSecondStory((prev) =>
      prev ? null : { id: "second", label: "Second Story", wallHeightFt: 10, wallSlots: structuredClone(overlayWallSlots) },
    );
  }, [overlayWallSlots]);

  // Every real wall panel across EVERY story (not just the ground floor) —
  // used for the panel COUNT and other height-independent totals. Safety/Gap
  // is a real wall panel (counted here) but, since it's just a plywood sheet
  // now (Tommy), has no straw-filled cavity at all — strawSlots below
  // excludes it so straw weight isn't overcounted.
  const allSlots = useMemo(() => stories.flatMap((s) => Object.values(s.wallSlots).flat()), [stories]);
  const allWallPanelSlots = allSlots.filter((s) => WALL_PANEL_SLOT_TYPES.has(s.type));
  const strawSlots = allWallPanelSlots.filter((s) => s.type !== "safety-gap");
  const woodEligibleCount = allSlots.filter((s) => s.type === "standard" || s.type === "braced").length;
  const openingCounts = useMemo(
    () => ({
      windows: allSlots.filter((s) => s.type === "window").length,
      doors: allSlots.filter((s) => s.type === "door").length,
    }),
    [allSlots],
  );

  // Straw is height-dependent, so (unlike the counts above) it can't just
  // sum widths across a flattened all-stories slot list against one flat
  // wallHeightFt — each story contributes its own width x its OWN height,
  // summed across stories (a 2-story building's second story can have a
  // different wallHeightFt than the ground floor).
  const strawWeight = useMemo(() => {
    return stories.reduce(
      (acc, story) => {
        const storyStrawSlots = Object.values(story.wallSlots)
          .flat()
          .filter((s) => WALL_PANEL_SLOT_TYPES.has(s.type) && s.type !== "safety-gap");
        const widthIn = storyStrawSlots.reduce((sum, s) => sum + s.widthIn, 0);
        const w = computeStrawWeight(widthIn, thicknessIn, story.wallHeightFt * 12, densityLbFt3 * LB_FT3_TO_KG_M3);
        return { weightKg: acc.weightKg + w.weightKg, weightLb: acc.weightLb + w.weightLb };
      },
      { weightKg: 0, weightLb: 0 },
    );
  }, [stories, thicknessIn, densityLbFt3]);

  // Summed from each real instance's own member geometry (not a flat
  // per-panel constant multiplied by count) — the only way a braced
  // panel's diagonal braces/connector (real trapezoid-cut length, per
  // bracingStyle) actually count toward the project's wood weight total
  // (Tommy: "make sure trapezoid pieces... have wood weight... that fill
  // into project totals"). Same per-story summing as strawWeight above,
  // since wood weight is height-dependent too.
  const totalWoodWeightKg = useMemo(() => {
    return stories.reduce((sum, story) => {
      const heightIn = story.wallHeightFt * 12;
      return (
        sum +
        Object.values(story.wallSlots)
          .flat()
          .filter((s) => s.type === "standard" || s.type === "braced")
          .reduce((acc, s) => {
            let members: PanelMember[];
            if (s.type === "braced") {
              const style = resolveBracedStyle(s, defaultBracePattern, defaultBracedMirrored);
              members = buildBracedPanelMembers(s.widthIn, thicknessIn, heightIn, includeNailer, style.pattern, style.mirrored);
            } else {
              members = buildStandardPanelMembers(s.widthIn, thicknessIn, heightIn, includeNailer);
            }
            return acc + computeMemberSetWoodWeight(members).weightKg;
          }, 0)
      );
    }, 0);
  }, [stories, thicknessIn, includeNailer, defaultBracePattern, defaultBracedMirrored]);
  // The project's own total weight is assembled further down, right after
  // the spanning-header fabrication groups it now also has to include — see
  // `totalWeightKg` there.

  const hasClayPlaster = checkedInteriorIds.has("clay-plaster");
  const hasLimePlaster = checkedExteriorIds.has("lime-plaster");

  // Column/Corner panels are always COLUMN_TOTAL_WIDTH_IN (25.5in) wide —
  // a fixed unit, independent of standardWidthIn — so there's no size
  // grouping to do, just one 3D model each.
  const columnPanelMembers = useMemo(
    () => buildColumnPanelMembers(thicknessIn, wallHeightFt * 12, includeNailer),
    [thicknessIn, wallHeightFt, includeNailer],
  );
  // Square Bale corner panels are their own construction (Tommy: "corner
  // panels for square bale panel style are a standard square bale panel
  // with a double 2x6 stud pack in the primary corner") — a 39in-wide
  // Square Bale Panel body, not the 25.5in Column/Corner unit the other 2
  // panelization styles share.
  const cornerPanelMembers3D = useMemo(
    () =>
      isSquareBalePanelization
        ? buildSquareBaleCornerPanelMembers(thicknessIn, wallHeightFt * 12, includeNailer, nailerOffsetIn)
        : buildCornerPanelMembers(thicknessIn, wallHeightFt * 12, includeNailer),
    [isSquareBalePanelization, thicknessIn, wallHeightFt, includeNailer, nailerOffsetIn],
  );

  // Gable End Panel: the low edge is the roofline's own base — the top of
  // whichever story is tallest (ground-only, or ground+second when a
  // second story exists — same roofBaseHeightIn concept WallElevationDiagram
  // already computes for its own SVG, kept in sync here); the high edge is
  // the Roof tab's own profile point height(s). Clamped so a height typed
  // below the eave doesn't throw. These two heights are also
  // membersForPanelTypeId's own fallback for any gable call site without a
  // specific real instance's own edge heights (e.g. none today — every
  // gable panel shown anywhere is now a real per-tile instance — but kept
  // as a safe default rather than a required override).
  const roofBaseHeightIn = stories.reduce((sum, s) => sum + s.wallHeightFt, 0) * 12;
  // The true "eave" reference gable panels tile up FROM — a real truss's
  // own bottom chord bears on TOP of the roof-bearing member (truss plate/
  // box beam), which itself sits flush on the wall's own top plate, not
  // bare wall-top-plate height directly (Tommy: "the beginning of where the
  // shape of the inclined/gable end panels are derrived from must start...
  // flush with the top of the top plate/panels below it" — i.e. flush with
  // the top of THAT roof-bearing assembly, matching how a real last truss
  // "rest[s] on the eve sides... flush" with the gable panels sitting
  // directly under it). Falls back to bare roofBaseHeightIn when no roof
  // system is even enabled (no roof-bearing member exists to sit atop).
  const gableEaveHeightIn = roofBaseHeightIn + (roofEnabled ? computeSharedRooflineBearingHeightIn() : 0);
  const gablePreviewLowEdgeHeightIn = gableEaveHeightIn;
  const gablePreviewHighEdgeHeightIn = Math.max(...roofProfilePointHeightsFt.map((h) => gableEaveHeightIn + h * 12), gablePreviewLowEdgeHeightIn);
  // Real per-wall gable tiles (Tommy: fix "gable end always spawns to the
  // top" by making each tile a real PanelInstance, not one hardcoded
  // full-ridge-height preview) — same computeGableTiledRow call shape
  // WallElevationDiagram.tsx already uses for its own SVG, so the two stay
  // consistent. Feeds allInstances below.
  /** This wall's roof-profile anchor points, in `computeGableTiledRow`'s own
   * absolute coordinate space. Extracted so the gable row and the run-stop
   * refusal below cannot build them differently. */
  const gableProfilePointsFor = (wall: Wall): RoofProfilePoint[] => {
    const wallLengthIn = wall.lengthFt * 12;
    const storedPositions = gableProfilePositionsInByWallId[wall.id] ?? [];
    return roofProfilePointHeightsFt.map((heightFt, i) => {
      const defaultXIn = roofProfilePointHeightsFt.length === 1 ? wallLengthIn / 2 : ((i + 1) * wallLengthIn) / 3;
      const storedXIn = storedPositions[i];
      return {
        xIn: storedXIn ?? defaultXIn,
        heightIn: gableEaveHeightIn + heightFt * 12,
        isExplicitPosition: storedXIn != null,
      };
    });
  };

  /**
   * Gable windows a candidate stop would CUT THROUGH on this wall.
   *
   * Tommy's rule is that a gable window stays put on the building, so a stop
   * either leaves a window fully built or does not build it at all. The one
   * case neither of those covers is a stop landing inside a window, and that
   * is refused rather than resolved: half a window is a fabricated part that
   * does not exist, and silently swallowing a whole one is worse.
   */
  const gableWindowsCutByStop = (wallId: string, builtStartIn: number, builtEndIn: number) => {
    const wall = footprint?.walls.find((w) => w.id === wallId);
    if (!wall || !gableEndWallIds.has(wallId)) return [];
    return classifyGableWindowsAgainstRunStop(
      wall.lengthFt * 12,
      gableEaveHeightIn,
      gableProfilePointsFor(wall),
      standardWidthIn,
      trussPlateInsetIn,
      true,
      heelHeightIn,
      roofBearingAnchorMode,
      gableWindowAnchorsByWallId[wallId] ?? [],
      gableStructuralPanelWallIds.has(wallId) ? COLUMN_TOTAL_WIDTH_IN : undefined,
      builtStartIn,
      builtEndIn,
    ).straddling;
  };

  const gableTilesByWallId = useMemo(() => {
    if (!footprint) return {};
    const result: Record<
      string,
      {
        widthIn: number;
        xStartIn: number;
        leftEdgeHeightIn: number;
        rightEdgeHeightIn: number;
        verticalGapIn?: { leftIn: number; rightIn: number };
        isSafetyGap?: boolean;
        isWindow?: boolean;
        windowHeightIn?: number;
        windowSillHeightIn?: number;
        isColumn?: boolean;
      }[]
    > = {};
    for (const wall of footprint.walls) {
      if (!gableEndWallIds.has(wall.id)) continue;
      const wallLengthIn = wall.lengthFt * 12;
      // Default position: the single midpoint for a peaked (1-point) profile,
      // or a symmetric flat run spanning the middle third for a flat-top
      // (2-point) profile — same "auto-centered, never snaps" convention the
      // old single-peak default already had. `heightFt` is a RISE above the
      // eave, not an absolute height (see roofProfilePointHeightsFt's own doc
      // comment); `gableProfilePointsFor` converts it, so that
      // `computeGableTiledRow`'s still-absolute contract is unchanged.
      const points: RoofProfilePoint[] = gableProfilePointsFor(wall);
      const tiles = computeGableTiledRow(
        wallLengthIn,
        gableEaveHeightIn,
        points,
        standardWidthIn,
        trussPlateInsetIn,
        true,
        heelHeightIn,
        roofBearingAnchorMode,
        gableWindowAnchorsByWallId[wall.id] ?? [],
        gableStructuralPanelWallIds.has(wall.id) ? COLUMN_TOTAL_WIDTH_IN : undefined,
        // Stage 3: gable panels are generated only above the part of this
        // wall that is actually built. The ridge and roof profile still span
        // the full wall — only the panel row clamps. Tommy's decision.
        gableRunStopByWallId[wall.id]?.builtStartIn ?? 0,
        gableRunStopByWallId[wall.id]?.builtEndIn ?? wallLengthIn,
      );
      // The real high edge is capped to maxGablePanelHeightIn's own
      // fabrication ceiling (Tommy: "gable panels...can be up to 8' tall")
      // so a real Gable End Panel is never built taller than
      // buildGablePanelMembers itself allows — the remainder (if any) is
      // absorbed by a real vertical safety-gap filler instead of silently
      // clipping the panel short. capGableTileHeights guarantees every
      // tile is either fully true-sloped or fully flat — never a mixed
      // quadrilateral with one edge capped and the other still sloped
      // (Tommy: gable panels should only ever be "parrelel with the slope,
      // or being horizontal") — shared with WallElevationDiagram's own
      // preview so the 2 can never disagree.
      const capHeightIn = gableEaveHeightIn + maxGablePanelHeightIn;
      result[wall.id] = tiles.map((t) => {
        const capped = capGableTileHeights(t.leftHeightIn, t.rightHeightIn, capHeightIn);
        return {
          widthIn: t.widthIn,
          xStartIn: t.xStartIn,
          leftEdgeHeightIn: capped.leftEdgeHeightIn,
          rightEdgeHeightIn: capped.rightEdgeHeightIn,
          ...(capped.verticalGapIn ? { verticalGapIn: capped.verticalGapIn } : {}),
          ...(t.isSafetyGap ? { isSafetyGap: true } : {}),
          ...(t.isWindow ? { isWindow: true, windowHeightIn: t.windowHeightIn, windowSillHeightIn: t.windowSillHeightIn } : {}),
          ...(t.isColumn ? { isColumn: true } : {}),
        };
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gableProfilePointsFor is a per-render partial application; its own inputs are listed
  }, [
    footprint,
    gableEndWallIds,
    gableProfilePositionsInByWallId,
    gableEaveHeightIn,
    gableWindowAnchorsByWallId,
    roofProfilePointHeightsFt,
    maxGablePanelHeightIn,
    standardWidthIn,
    trussPlateInsetIn,
    heelHeightIn,
    roofBearingAnchorMode,
    // ⚠ Read at line ~3650 to clamp the row to the built run. Missing, the
    // gable row held its PREVIOUS clamp when a stop was set or cleared —
    // and this memo feeds `allInstances`, so the output was gable panels
    // fabricated, priced, weighed, BOM'd and cut-listed above a span the
    // wall declares carries none. Exactly what Tommy's clamp exists to
    // prevent, arrived at by staleness instead of by design, and visibly
    // inconsistent with the elevation (which reads the same map through a
    // memo that DOES depend on it).
    gableRunStopByWallId,
    gableStructuralPanelWallIds,
  ]);

  // Real span/pitch/run for the Roof tab's own truss layout editor (Tommy:
  // "i want to see the full 'panelized' layout... paired with... the
  // elevation views of gable end walls") — reads off the SAME real tiled
  // geometry (gableTilesByWallId) and ridge-run math (computeRidgeLine)
  // already used elsewhere, so a paired truss preview can never disagree
  // with what that wall's own elevation view / roof-catcher-beam run
  // already show. Only resolvable for a real "peaked" profile with exactly
  // 2 (opposite) Gable End walls — a flat-topped roofline has no single
  // peak/pitch for any of the 8 truss builders to model (see the plan's
  // flat-top deferral), so this stays null there, and the Roof tab shows an
  // instructional note instead of a canvas. The FIRST of the 2 gable walls
  // is always the "primary" one — a real opposite pair shares the same
  // length, and computeGableTiledRow/resolveGableProfilePoints already
  // treat each wall's own roofline symmetrically, so either wall would
  // resolve to the same span/pitch.
  const roofTrussLayoutContext = useMemo(() => {
    if (!footprint || roofProfileType !== "peaked" || gableEndWallIds.size !== 2) return null;
    const gableWallIdsArr = [...gableEndWallIds];
    const primaryGableWallId = gableWallIdsArr[0]!;
    const primaryGableWall = footprint.walls.find((w) => w.id === primaryGableWallId);
    const tiles = gableTilesByWallId[primaryGableWallId];
    if (!primaryGableWall || !tiles || tiles.length === 0) return null;

    const wallWidthIn = primaryGableWall.lengthFt * 12;
    const { resolvedPointXsIn } = resolveGableProfilePoints(
      roofProfilePointHeightsFt,
      gableProfilePositionsInByWallId[primaryGableWallId] ?? [],
      wallWidthIn,
    );
    const peakXIn = resolvedPointXsIn[0]!;
    const peakHeightIn = gableEaveHeightIn + (roofProfilePointHeightsFt[0] ?? 0) * 12;
    const firstTile = tiles[0]!;
    const lastTile = tiles[tiles.length - 1]!;
    // Real per-side rise/run, read off the outermost real tile's own
    // anchor — same convention WallElevationDiagram's own per-side pitch
    // labels use (see its own doc comment), so this can never disagree
    // with what that wall's elevation view already shows. A side with
    // (near) zero run means the peak sits right at that corner (a shed) —
    // filtered out rather than divided by near-zero.
    const sides = [
      { runIn: peakXIn - firstTile.xStartIn, riseIn: peakHeightIn - firstTile.leftEdgeHeightIn },
      { runIn: lastTile.xStartIn + lastTile.widthIn - peakXIn, riseIn: peakHeightIn - lastTile.rightEdgeHeightIn },
    ].filter((s) => s.runIn > 1);
    if (sides.length === 0) return null;

    // Asymmetric peak (dragged off-center): a real prefab truss is a single
    // symmetric unit, so this picks the steeper side's real pitch (a
    // conservative choice — ensures adequate rise) rather than averaging or
    // picking arbitrarily, and flags it so the editor can show a caveat.
    const steepestSide = sides.reduce((a, b) => (b.riseIn / b.runIn > a.riseIn / a.runIn ? b : a));
    const pitchIn12 = (steepestSide.riseIn * 12) / steepestSide.runIn;
    const asymmetricNote =
      sides.length === 2 && Math.abs(sides[0]!.riseIn / sides[0]!.runIn - sides[1]!.riseIn / sides[1]!.runIn) > 0.01
        ? "This wall's roofline peak isn't centered — showing the steeper side's real pitch."
        : null;

    const peakPositionInByWallId: Record<string, number> = {};
    for (const [wallId, positions] of Object.entries(gableProfilePositionsInByWallId)) {
      const posIn = positions[0];
      if (posIn != null) peakPositionInByWallId[wallId] = posIn;
    }
    const ridge = computeRidgeLine(footprint, gableWallIdsArr[0]!, gableWallIdsArr[1]!, peakPositionInByWallId);
    if (!ridge || ridge.runIn <= 0) return null;

    return { spanIn: wallWidthIn, runIn: ridge.runIn, pitchIn12, asymmetricNote };
  }, [footprint, roofProfileType, gableEndWallIds, gableTilesByWallId, roofProfilePointHeightsFt, gableProfilePositionsInByWallId, gableEaveHeightIn]);

  // Which gable-enabled walls have at least one tile whose real roofline
  // rise exceeds maxGablePanelHeightIn (i.e. got a real vertical
  // safety-gap filler tile above the capped Gable End Panel) — surfaced in
  // the Elevation sidebar's own controls as an informational note, not an error.
  const gableEndClampedWallIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [wallId, tiles] of Object.entries(gableTilesByWallId)) {
      if (tiles.some((t) => t.verticalGapIn !== undefined)) ids.add(wallId);
    }
    return ids;
  }, [gableTilesByWallId]);

  // Computed once, across every nameable panel type together, so a panel's
  // number always reflects its true position in the along-wall sequence —
  // Shop Drawing pages then just filter this same list, rather than each
  // recomputing its own independent (and previously mismatched) counter.
  const allInstances = useMemo(
    () =>
      footprint
        ? allPanelInstances(
            footprint,
            overlayWallSlots,
            standardWidthIn,
            jackStudConfig,
            gableTilesByWallId,
            undefined,
            wallHeightFt * 12,
            // Beams AND spanning headers — a header shortens the panels
            // beneath it here exactly as it does in the elevation and the
            // 3D view, because all three read the same joined list.
            groundBandGeometryByWallId,
            maxPanelHeightIn,
            gableEaveHeightIn,
          )
        : [],
    [
      footprint,
      overlayWallSlots,
      standardWidthIn,
      jackStudConfig,
      gableTilesByWallId,
      wallHeightFt,
      groundBandGeometryByWallId,
      maxPanelHeightIn,
      gableEaveHeightIn,
    ],
  );

  // Second story's own named instances (Elevation-view panel ID labels) —
  // gable tiles/box-beam coverage omitted, same as Building3DView's own
  // secondStoryInstancesBySlot (Building3DView.tsx:1416-1435): gable tiles
  // live only on the ground-facing roofline, and box-beam coverage doesn't
  // affect a panel's own compass name.
  const secondStoryAllInstances = useMemo(
    () =>
      footprint && secondStory
        ? allPanelInstances(
            footprint,
            secondStory.wallSlots,
            standardWidthIn,
            jackStudConfig,
            undefined,
            undefined,
            secondStory.wallHeightFt * 12,
            secondStoryBandGeometryByWallId,
          )
        : [],
    [footprint, secondStory, standardWidthIn, jackStudConfig, secondStoryBandGeometryByWallId],
  );

  /** A panel's own name at a given wall+slot, per story — the lookup both
   * halves of the spanning-header cross-reference go through. A slot can
   * carry several instances (a window's header and its sills); the FIRST is
   * the one the canvas labels that column with, so it is the one a header's
   * sheet names. */
  const panelInstanceNameForStory =
    (story: "ground" | "second") =>
    (wallId: string, slotIndex: number): string | undefined =>
      (story === "ground" ? allInstances : secondStoryAllInstances).find(
        (inst) => inst.wallId === wallId && inst.slotIndexInWall === slotIndex,
      )?.name;

  /** Every spanning header in the building, named `H1`, `H2`, ... from the
   * single global series. One walk, shared by the elevation labels, the
   * fabrication sheets, the Review Log, the price and the 3D view, so no two
   * of them can disagree about which header is which. */
  const resolvedSpanningHeaders = useMemo(
    () => resolveSpanningHeaders(footprint, stories, spanningHeadersByStoryAndWallId),
    [footprint, stories, spanningHeadersByStoryAndWallId],
  );

  /** The cross-reference the direction-free name makes mandatory, both ways:
   * `H1 -> "East wall — spans E4, E5"` and `E4 -> "H1"`. A shop reading one
   * sheet cannot see the other, which is exactly the situation the naming
   * decision creates. */
  const spanningHeaderCrossReference = useMemo(() => {
    const locationByHeaderName = new Map<string, string>();
    const spannedNamesByHeaderName = new Map<string, string[]>();
    const headerAboveByPanel = new Map<string, string>();
    // The lookup is written out here rather than taken from
    // `panelInstanceNameForStory` on purpose: that helper is re-created every
    // render, so depending on it would defeat this memo, and silencing the
    // dependency rule to hide that is the shape that let a stale memo ship in
    // Stage 3. Reading the two instance lists directly means the dep array is
    // complete and honest.
    for (const resolved of resolvedSpanningHeaders) {
      const instances = resolved.story === "ground" ? allInstances : secondStoryAllInstances;
      const names = spannedPanelNames(
        resolved,
        (wallId, slotIndex) => instances.find((inst) => inst.wallId === wallId && inst.slotIndexInWall === slotIndex)?.name,
      );
      locationByHeaderName.set(resolved.name, spanningHeaderSheetLocation(resolved, names));
      spannedNamesByHeaderName.set(resolved.name, names);
      for (const panelName of names) headerAboveByPanel.set(panelName, resolved.name);
    }
    return { locationByHeaderName, spannedNamesByHeaderName, headerAboveByPanel };
  }, [resolvedSpanningHeaders, allInstances, secondStoryAllInstances]);

  /** Header names by wall+story, for the elevation to label its own band
   * with. Keyed by the header's own id, so nothing has to re-derive the
   * numbering (or, worse, parse `H1`). */
  const spanningHeaderNameById = useMemo(
    () => new Map(resolvedSpanningHeaders.map((r) => [r.header.id, r.name])),
    [resolvedSpanningHeaders],
  );

  // Door Rough Opening height (Tommy: "RO height for doors is almost
  // always 80.5in — the actual number is derived from door RO selected
  // (default 82.5) − toe up height (usually 1.5in)") — a real formula.
  // Moved above the header block since the door header now derives its
  // own real height from it (a door has no sill — its jack studs span
  // this full RO height instead, floor to header-bottom).
  const doorRoughOpeningHeightIn = computeDoorRoughOpeningHeightIn(doorRoughOpeningSelectedHeightIn.value, toeUpHeightIn.value);
  const doorJackStudMembers = useMemo(
    () => buildJackStudMembers(thicknessIn, doorRoughOpeningHeightIn, jackStudConfig),
    [thicknessIn, doorRoughOpeningHeightIn, jackStudConfig],
  );
  const doorJackStudFastenerResult = useMemo(
    () => computeJackStudFastenerWeight(doorRoughOpeningHeightIn),
    [doorRoughOpeningHeightIn],
  );

  // Sill Panel: "short standard panel" (Tommy) at sillDefaultHeightIn
  // (32in). Width uses the first real sill instance's own (already RO-
  // aware, already-split-if-wide) width if one exists, otherwise a
  // representative default. Moved above the header block since the
  // window header now derives its own real height from the sill height +
  // the selected window height.
  const SILL_DEFAULT_WIDTH_IN = 36;
  const sillHeightIn = sillDefaultHeightIn.value;
  const sillWidthIn = allInstances.find((inst) => inst.panelType === "sill")?.widthIn ?? SILL_DEFAULT_WIDTH_IN;
  const sillMembers = useMemo(
    () => buildSillPanelMembers(sillWidthIn, thicknessIn, sillHeightIn, includeNailer),
    [sillWidthIn, thicknessIn, sillHeightIn, includeNailer],
  );

  // Door/Window Header (Tommy: "headers should be sized from the RO to
  // the top of the wall panel standard height") — real height now, per
  // opening type: wall height minus the RO's own top elevation (a door's
  // RO starts at the floor; a window's starts on top of the sill — see
  // computeHeaderHeightIn). Width still uses the first real header
  // instance of that opening type if one's been drawn, otherwise a
  // representative default (Tommy: "there are long headers and door
  // headers... door headers just have one upside down V as a brace" —
  // the window default is picked wide enough to actually show the "long
  // header" multi-peak truss).
  const DOOR_HEADER_DEFAULT_WIDTH_IN = 36;
  const WINDOW_HEADER_DEFAULT_WIDTH_IN = 60;
  const doorHeaderWidthIn =
    allInstances.find((inst) => inst.panelType === "header" && inst.sourceSlotType === "door")?.widthIn ?? DOOR_HEADER_DEFAULT_WIDTH_IN;
  const windowHeaderWidthIn =
    allInstances.find((inst) => inst.panelType === "header" && inst.sourceSlotType === "window")?.widthIn ?? WINDOW_HEADER_DEFAULT_WIDTH_IN;
  // Preview-only height (Tommy: "i want each window individually
  // adjustable" — each window's real height lives on its own slot, see
  // handleSetWindowHeight; this is only for the standalone Header/Jack
  // Stud/RO preview pages, which aren't tied to one specific instance) —
  // the first real window instance's own height if one's been drawn,
  // otherwise the project default.
  const windowHeightIn =
    allInstances.find((inst) => inst.panelType === "header" && inst.sourceSlotType === "window")?.windowHeightIn ??
    standardWindowHeightDefaultIn.value;
  const doorHeaderHeightIn = computeHeaderHeightIn(wallHeightFt * 12, doorRoughOpeningHeightIn);
  const windowHeaderHeightIn = computeHeaderHeightIn(wallHeightFt * 12, sillHeightIn + windowHeightIn);
  const doorHeaderMembers = useMemo(
    () => buildDoorHeaderMembers(doorHeaderWidthIn, thicknessIn, doorHeaderHeightIn),
    [doorHeaderWidthIn, thicknessIn, doorHeaderHeightIn],
  );
  const windowHeaderMembers = useMemo(
    () => buildWindowHeaderMembers(windowHeaderWidthIn, thicknessIn, windowHeaderHeightIn),
    [windowHeaderWidthIn, thicknessIn, windowHeaderHeightIn],
  );

  // Plywood Jack Stud (window): spans sill-top to header-bottom (Tommy:
  // jack studs "go from the sill to the header") — IS the window's own
  // real Rough Opening height directly (the preview windowHeightIn
  // above), not a "leftover" wall-height-minus-header approximation.
  const jackStudPreviewHeightIn = windowHeightIn;
  const jackStudMembers = useMemo(
    () => buildJackStudMembers(thicknessIn, jackStudPreviewHeightIn, jackStudConfig),
    [thicknessIn, jackStudPreviewHeightIn, jackStudConfig],
  );
  const jackStudFastenerResult = useMemo(
    () => computeJackStudFastenerWeight(jackStudPreviewHeightIn),
    [jackStudPreviewHeightIn],
  );

  // Rough Opening widths (Tommy: "RO's take into account these jack
  // studs... make sure... the window slot... represents the entire
  // primary space which the headers, RO, and sills are") — the door/
  // window slot's own width is the whole assembly; the RO itself is
  // narrower by one jack stud thickness on each side.
  const doorRoughOpeningWidthIn = computeRoughOpeningWidthIn(doorHeaderWidthIn, jackStudConfig);
  const windowRoughOpeningWidthIn = computeRoughOpeningWidthIn(windowHeaderWidthIn, jackStudConfig);
  const windowSillRunWidthsIn = computeSillRunWidths(windowRoughOpeningWidthIn, standardWidthIn);

  // ⚠ **`safetyGapMembers3D` is gone (2026-10-01).** It memoized ONE
  // safety-gap member list on the premise that the sheet was a fixed 3/4in
  // whatever the slot reserved, so one model covered every instance. There are
  // now two sheets — 3/4in 5-ply CDX on a run over 144in, 1/2in 3-ply CDX at or
  // under it (`safetyGapWidthForRunIn`) — so every instance is built from its
  // OWN slot's reserved width through `safetyGapSheetThicknessIn`, at the two
  // places that build members. A shared memo there would have quietly reported
  // 3/4in plywood for every 1/2in gap in the building.

  // Truss Plate (single-story roof bearing) / Box Beam (two-story roof
  // bearing) — Tommy: whichever the building is, it needs one of these on
  // top of the wall panels. 3D preview uses a small illustrative length
  // (10ft); the insulation quantity below uses the footprint's actual
  // BUILT wall perimeter, so it's a real whole-building material total,
  // not just an illustrative snippet.
  const ASSEMBLY_PREVIEW_LENGTH_IN = 120;
  /**
   * **Stage 3's acceptance criterion, and the trap it names.** No panels
   * means no panel instances, so everything derived FROM instances — price,
   * weight, carbon, BOM, cut list, shipping — is already right on a wall
   * that stops short. Everything derived from `wall.lengthFt` is not, and
   * over-counts SILENTLY: a plausible plaster total for a wall that was
   * never built.
   *
   * So: one derivation of how much of each wall is actually BUILT, and
   * every per-wall-length total that describes the WALL ASSEMBLY reads it.
   * Measured off `lengthFt * 12` rather than off the tiling length on
   * purpose — corner insets are ownership bookkeeping that nets out around
   * a closed ring, and today's perimeter total is exactly the raw sum, so
   * subtracting only the stops keeps an unstopped project byte-identical.
   *
   * **What deliberately does NOT read this:** the floor, the foundation and
   * the roof. They still extend to the line where the wall stops — that is
   * the whole reason the footprint polygon stays closed. Those three read
   * the footprint polygon (`computeFootprintAreaSqFt`, `perimeterRing`,
   * `pierGrid`, `computeRoofBearingSegments`, the gable/ridge geometry),
   * never a wall's panel run, and they were each checked rather than
   * assumed — see the Stage 3 as-built audit.
   *
   * There is deliberately no second "raw perimeter" total left in this
   * component. Every consumer the old one had describes the wall assembly,
   * so two near-identical perimeter numbers one line apart would only ever
   * be a way to pick the wrong one.
   */
  /** Each wall's UNSTOPPED tiling length — the same base `applyWallRunStop`
   * clamps a stop against. Fed to `builtWallLengthsIn` so a clamped stop
   * cannot make the tiler build nothing while the totals still count the
   * butt-joint inset as built wall. */
  const wallTilingLengthInByWallId = useMemo(() => {
    const lengths: Record<string, number> = {};
    if (!footprint) return lengths;
    for (const wall of footprint.walls) {
      // `{}` explicitly, NOT the live-stops default. `unstoppedLengthIn` is
      // derived from BASE corner ownership and so is genuinely independent
      // of every stop in the building — which is what makes omitting
      // `wallRunStopsByWallId` from the deps below correct rather than the
      // fourth instance of this stage's recurring stale-memo bug. Passing
      // `{}` makes that independence visible at the call site instead of
      // leaving it as a fact about a default argument.
      const geometry = wallGeometryFor(wall.id, {});
      if (geometry) lengths[wall.id] = geometry.unstoppedLengthIn;
    }
    return lengths;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wallGeometryFor is a per-render partial application; its inputs are listed
  }, [footprint, thicknessIn, primaryCornerIds, leastAccessibleCorner]);
  const builtWallLengthInByWallId = useMemo(
    () => (footprint ? builtWallLengthsIn(footprint, wallRunStopsByWallId, wallTilingLengthInByWallId) : {}),
    [footprint, wallRunStopsByWallId, wallTilingLengthInByWallId],
  );
  const totalBuiltWallPerimeterIn = useMemo(
    () => totalBuiltWallPerimeterInPure(footprint, wallRunStopsByWallId, wallTilingLengthInByWallId),
    [footprint, wallRunStopsByWallId, wallTilingLengthInByWallId],
  );
  // Box beam is now a per-wall (or per-section-of-a-wall) choice (Tommy:
  // "options for being a ring all the way around or just one section of
  // the wall"), not automatic once stories.length > 1 — so the truss-
  // plate/box-beam material totals below sum the real per-wall/per-segment
  // coverage (computeRoofBearingSegments) instead of always treating a
  // whole wall (let alone the whole building) as one or the other. A
  // 2-story building can now genuinely need both fills at once, even on
  // the very same wall.
  const boxBeamWallLengthTotalIn = useMemo(() => {
    if (!footprint || stories.length <= 1) return 0;
    let totalIn = 0;
    for (const wall of footprint.walls) {
      const slots = secondStory?.wallSlots[wall.id] ?? [];
      for (const seg of computeRoofBearingSegments(slots, boxBeamCoverageByWallId[wall.id])) {
        if (seg.kind === "box-beam") totalIn += seg.lengthIn;
      }
    }
    return totalIn;
  }, [footprint, stories.length, secondStory, boxBeamCoverageByWallId]);
  const trussPlateWallLengthTotalIn = useMemo(() => {
    if (!footprint) return 0;
    // A truss plate bears on TOP of this wall's panels — where no panels are
    // built there is no plate, so the single-story total is the BUILT
    // perimeter. (The multi-story branch below sums real per-wall segments
    // off the second story's own slots, so it already shrinks for free.)
    if (stories.length <= 1) return totalBuiltWallPerimeterIn;
    let totalIn = 0;
    for (const wall of footprint.walls) {
      const slots = secondStory?.wallSlots[wall.id] ?? [];
      for (const seg of computeRoofBearingSegments(slots, boxBeamCoverageByWallId[wall.id])) {
        if (seg.kind === "truss-plate") totalIn += seg.lengthIn;
      }
    }
    return totalIn;
  }, [footprint, stories.length, secondStory, boxBeamCoverageByWallId, totalBuiltWallPerimeterIn]);
  const trussPlatePreviewMembers = useMemo(
    () => buildTrussPlateMembers(ASSEMBLY_PREVIEW_LENGTH_IN, thicknessIn, trussPlateInsetIn),
    [thicknessIn, trussPlateInsetIn],
  );
  const timberHpTotal = useMemo(
    () => computeTimberHpVolume(trussPlateWallLengthTotalIn, thicknessIn, trussPlateInsetIn),
    [trussPlateWallLengthTotalIn, thicknessIn, trussPlateInsetIn],
  );
  const timberHpWeight = useMemo(
    () => computeInsulationWeight(timberHpTotal.volumeFt3, timberHpDensityLbFt3.value),
    [timberHpTotal],
  );
  const boxBeamPreviewMembers = useMemo(
    () => buildBoxBeamMembers(ASSEMBLY_PREVIEW_LENGTH_IN, thicknessIn, boxBeamSizeId),
    [thicknessIn, boxBeamSizeId],
  );
  const denseCelluloseTotal = useMemo(
    () => computeDensePackCelluloseVolume(boxBeamWallLengthTotalIn, thicknessIn, boxBeamSizeId),
    [boxBeamWallLengthTotalIn, thicknessIn, boxBeamSizeId],
  );
  const denseCelluloseWeight = useMemo(
    () => computeInsulationWeight(denseCelluloseTotal.volumeFt3, densePackCelluloseDensityLbFt3.value),
    [denseCelluloseTotal],
  );

  // Material Totals (Tommy: "take note of this for 3/4in plywood material
  // totals... build out material totals detail page") — 3/4in plywood
  // across every real panel instance (skins/side-plies/safety-gap sheets)
  // plus the roof-bearing assembly's own plywood cap(s), using the real
  // total wall perimeter (not an illustrative preview length). 1/2in
  // plywood (girt webs) is tallied too, for a complete picture.
  const heightIn = wallHeightFt * 12;
  // Every real panel instance's own member geometry, flattened once —
  // shared by both the plywood-area tally and the board-feet tally below
  // so the (fairly involved) per-instance member-selection logic isn't
  // duplicated.
  const allRealMembers = useMemo(() => {
    const members: PanelMember[] = [];
    for (const inst of allInstances) {
      const instMembers =
        inst.panelType === "standard"
          ? isSquareBalePanelization
            ? buildSquareBalePanelMembers(inst.widthIn, thicknessIn, heightIn, includeNailer, squareBaleStudConfig, nailerOffsetIn)
            : buildStandardPanelMembers(inst.widthIn, thicknessIn, heightIn, includeNailer)
          : inst.panelType === "braced"
            ? (({ pattern, mirrored }) => buildBracedPanelMembers(inst.widthIn, thicknessIn, heightIn, includeNailer, pattern, mirrored))(
                resolveBracedStyle(inst, defaultBracePattern, defaultBracedMirrored),
              )
            : inst.panelType === "column"
              ? columnPanelMembers
              : inst.panelType === "corner" || inst.panelType === "safety-oct-corner"
                ? // This instance's real width, like every other type here: the
                  // plywood-area and board-feet tallies below are material
                  // quantities, and a 36in corner panel from the 51in-75.5in band
                  // really does use more of both than a 25.5in one. Square
                  // Bale's corner is a fixed 39in unit and keeps its own build.
                  isSquareBalePanelization
                  ? cornerPanelMembers3D
                  : buildCornerPanelMembers(thicknessIn, heightIn, includeNailer, inst.widthIn)
                : inst.panelType === "safety-gap"
                  ? // This instance's own sheet, picked off the width the tiler
                    // reserved — a 1/2in gap must contribute 1/2in plywood to
                    // Material Totals, not 3/4in.
                    buildSafetyGapMembers(thicknessIn, heightIn, safetyGapSheetThicknessIn(inst.widthIn))
                  : inst.panelType === "sill"
                    ? buildSillPanelMembers(inst.widthIn, thicknessIn, inst.sillHeightIn ?? sillDefaultHeightIn.value, includeNailer)
                    : inst.panelType === "header"
                      ? inst.sourceSlotType === "door"
                        ? buildDoorHeaderMembers(inst.widthIn, thicknessIn, doorHeaderHeightIn)
                        : buildWindowHeaderMembers(
                            inst.widthIn,
                            thicknessIn,
                            computeHeaderHeightIn(
                              heightIn,
                              (inst.sillHeightIn ?? sillDefaultHeightIn.value) + (inst.windowHeightIn ?? standardWindowHeightDefaultIn.value),
                            ),
                          )
                      : inst.panelType === "gable"
                        ? inst.isSafetyGap
                          ? buildSafetyGapMembers(
                              thicknessIn,
                              Math.max(inst.leftEdgeHeightIn!, inst.rightEdgeHeightIn!) - gableEaveHeightIn,
                            )
                          : buildGablePanelMembers(
                              inst.widthIn,
                              thicknessIn,
                              inst.leftEdgeHeightIn! - gableEaveHeightIn,
                              inst.rightEdgeHeightIn! - gableEaveHeightIn,
                              includeNailer,
                            )
                        : null;
      if (instMembers) members.push(...instMembers);
      // A vertical safety-gap filler (Tommy: "an ability to put a safety
      // gap inbetween the truss bottom and the gable end top") stacks on
      // top of whichever gable geometry this tile got — additive, not a
      // replacement, since both the real gable/gap piece AND its own real
      // roofline overflow get fabricated.
      if (inst.panelType === "gable" && inst.gableVerticalGapIn) {
        // The panel below is always flat when a gap exists (capGableTileHeights's
        // own guarantee), so leftEdgeHeightIn/rightEdgeHeightIn are equal —
        // either works as the flat top's own local Z-offset.
        const localFlatTopIn = (inst.leftEdgeHeightIn ?? gableEaveHeightIn) - gableEaveHeightIn;
        members.push(
          ...buildVerticalGapFillerMembers(
            inst.widthIn,
            thicknessIn,
            inst.gableVerticalGapIn.leftIn,
            inst.gableVerticalGapIn.rightIn,
          ).map((m) => ({
            ...m,
            position: { ...m.position, zIn: m.position.zIn + localFlatTopIn },
          })),
        );
      }
    }
    return members;
  }, [
    allInstances,
    thicknessIn,
    heightIn,
    includeNailer,
    columnPanelMembers,
    cornerPanelMembers3D,
    isSquareBalePanelization,
    squareBaleStudConfig,
    defaultBracePattern,
    defaultBracedMirrored,
    nailerOffsetIn,
    doorHeaderHeightIn,
    sillHeightIn,
  ]);

  const plywoodAreaSqFt = useMemo(() => {
    let threeQuarterSqFt = computePlywoodAreaSqFt(allRealMembers, 0.75);
    const halfSqFt = computePlywoodAreaSqFt(allRealMembers, 0.5);
    // Roof-bearing assembly's own plywood cap(s) — box beam has both a top
    // and bottom cap, truss plate just one — over the real BUILT wall
    // perimeter. The panel-member half of this tally already comes from
    // `allRealMembers` (i.e. from panel instances), so it is correct for
    // free; only this wall-length-derived half needed the stops.
    threeQuarterSqFt += stories.length > 1
      ? (2 * totalBuiltWallPerimeterIn * thicknessIn) / 144
      : (totalBuiltWallPerimeterIn * thicknessIn) / 144;
    return { threeQuarterSqFt, halfSqFt };
  }, [allRealMembers, stories, totalBuiltWallPerimeterIn, thicknessIn]);

  const plywoodThreeQuarterSheetCount = Math.ceil(plywoodAreaSqFt.threeQuarterSqFt / PLYWOOD_SHEET_AREA_SQFT);
  const plywoodHalfSheetCount = Math.ceil(plywoodAreaSqFt.halfSqFt / PLYWOOD_SHEET_AREA_SQFT);

  // Board feet (Tommy: "wood weight totals should be able to be
  // calculated... how many boardfeet of 2x4's (and any other dimensional
  // lumber) are in a panel, and that total should be put onto the
  // materials total and divided by the panel height to count 2x4's") —
  // grouped by nominal size, converted to a "how many standard 10ft-stock
  // sticks to buy" purchase count using the standard panel height as the
  // stock length.
  const boardFeetByNominalSize = useMemo(
    () => computeBoardFeetByNominalSize(allRealMembers, standardPanelHeightIn.value / 12),
    [allRealMembers],
  );

  // Shipping (Tommy: "how many trucks will be needed to transport this
  // project, how should they be stacked, and how should those stacks be
  // put into the truck") — the whole loading sequence (main panels AND
  // header/sill panels together) follows the same "point of least
  // accessibility" concept the safety/gap panel placement already uses
  // (computePanelLoadOrder rotates the wall ring to start there — Tommy:
  // "If the PLA is on the top left (NW) then that panel on the corner is
  // the top of the first stack"). A header/sill only splits into its own
  // stack when it can't safely support (or be supported by) its neighbor
  // in the sequence (Tommy: "we cannot stack panels that are like 10% or
  // more bigger than the top panel") — see chunkIntoStacksSmart in
  // truckLoads.ts — so it still ships as close as possible to where it's
  // actually needed, instead of being batched into one separate
  // biggest-to-smallest pile at the end of the shipment.
  // Loose jack-stud lumber (Tommy: "jack studs can be piled up together and
  // stacked 90 degrees hot dog rotation") — not a flat wall panel, so each
  // window/door opening's own jack studs ship as their own small, thin
  // items (2 plywood sheets, or 4 real 2x4 sticks — ext + int wythe on each
  // side) rather than being left out of the truck-loadout calc entirely.
  const shippingJackStudRefs = useMemo(() => {
    const studsPerOpening = jackStudConfig === "plywood" ? 2 : 4;
    const crossSectionWidthIn = jackStudConfig === "plywood" ? thicknessIn : PLATE_2X4_WIDTH_IN;
    const refs: { id: string; widthIn: number; heightIn: number }[] = [];
    for (const inst of allInstances) {
      // A gable window's own reduced-height "gable" cap plays the same
      // "spans the opening, has jack studs below it" role a real header
      // does (Tommy: "dont forget jack studs") — sourceSlotType==="window"
      // is only ever set on a header OR a gable-window cap (see
      // panelInstances.ts), so this one check covers both without needing
      // a separate pass.
      const isGableWindowCap = inst.panelType === "gable" && inst.sourceSlotType === "window";
      if (inst.panelType !== "header" && !isGableWindowCap) continue;
      const spanIn = inst.sourceSlotType === "door" ? doorRoughOpeningHeightIn : (inst.windowHeightIn ?? standardWindowHeightDefaultIn.value);
      for (let i = 0; i < studsPerOpening; i++) {
        refs.push({ id: `${inst.name}-JS${i + 1}`, widthIn: crossSectionWidthIn, heightIn: spanIn });
      }
    }
    return refs;
  }, [allInstances, jackStudConfig, thicknessIn, doorRoughOpeningHeightIn]);

  const shippingPanelTypeById = useMemo(() => {
    const map = new Map<string, NamedPanelType>();
    for (const inst of allInstances) map.set(inst.name, inst.panelType);
    for (const ref of shippingJackStudRefs) map.set(ref.id, "jack-stud");
    return map;
  }, [allInstances, shippingJackStudRefs]);

  // Each instance's own real width/height (Tommy: "windows and column
  // panels are not loading correctly... they are mostly loading as big
  // blocks") — a header/sill is far shorter than a full wall panel, so the
  // 3D truck view needs each panel's own true dimensions instead of a
  // shared stack/uniform-height assumption. Same formula fastenerWeightKgFor
  // and the Shop Drawing weight breakdown already use per instance.
  const shippingPanelHeightById = useMemo(() => {
    const map = new Map<string, number>();
    const mainHeightIn = wallHeightFt * 12;
    for (const inst of allInstances) {
      if (inst.panelType === "sill") {
        map.set(inst.name, inst.sillHeightIn ?? sillDefaultHeightIn.value);
      } else if (inst.panelType === "header") {
        map.set(
          inst.name,
          inst.sourceSlotType === "door"
            ? doorHeaderHeightIn
            : computeHeaderHeightIn(mainHeightIn, (inst.sillHeightIn ?? sillDefaultHeightIn.value) + (inst.windowHeightIn ?? standardWindowHeightDefaultIn.value)),
        );
      } else if (inst.panelType === "gable") {
        // A gable tile's own real built height is its rise above the eave
        // (Tommy: "windows and column panels are not loading correctly...
        // loading as big blocks" — same bug, unaddressed for gable until
        // now: it was falling into the `mainHeightIn` catch-all below,
        // the full flat wall height, instead of its own real short rise).
        // Same formula panelFabricationGroups' own panelHeightInFor
        // already uses for gable (line ~3460), so board-footage/pricing
        // and shipping packing can never disagree.
        map.set(inst.name, Math.max(inst.leftEdgeHeightIn ?? gableEaveHeightIn, inst.rightEdgeHeightIn ?? gableEaveHeightIn) - gableEaveHeightIn);
      } else {
        map.set(inst.name, mainHeightIn);
      }
    }
    for (const ref of shippingJackStudRefs) map.set(ref.id, ref.heightIn);
    return map;
  }, [allInstances, wallHeightFt, doorHeaderHeightIn, gableEaveHeightIn, shippingJackStudRefs]);

  // Gable panels' own real sloped edges (Tommy: "gable end panels are still
  // showing up as boxes... their trapezoidal shape should be carried to the
  // 3d box and shipping truck logistics engine") — same local-rise formula
  // shippingPanelHeightById's own "gable" branch above already uses, kept
  // per-edge (not maxed together) so TruckLoad3DView can render the real
  // slope instead of a flat-topped box.
  const shippingGableEdgeHeightsById = useMemo(() => {
    const map = new Map<string, { leftIn: number; rightIn: number }>();
    for (const inst of allInstances) {
      if (inst.panelType !== "gable") continue;
      map.set(inst.name, {
        leftIn: Math.max(0, (inst.leftEdgeHeightIn ?? gableEaveHeightIn) - gableEaveHeightIn),
        rightIn: Math.max(0, (inst.rightEdgeHeightIn ?? gableEaveHeightIn) - gableEaveHeightIn),
      });
    }
    return map;
  }, [allInstances, gableEaveHeightIn]);

  const shippingPanelWidthById = useMemo(() => {
    const map = new Map<string, number>();
    for (const inst of allInstances) map.set(inst.name, inst.widthIn);
    for (const ref of shippingJackStudRefs) map.set(ref.id, ref.widthIn);
    return map;
  }, [allInstances, shippingJackStudRefs]);

  const shippingLoadOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    if (!footprint) return map;
    computePanelLoadOrder(footprint, overlayWallSlots, leastAccessibleCorner).forEach((entry, i) =>
      map.set(`${entry.wallId}:${entry.slotIndex}`, i),
    );
    return map;
  }, [footprint, overlayWallSlots, leastAccessibleCorner]);

  // Every non-jack-stud instance (main panels AND header/sill together —
  // jack studs aren't part of `allInstances`, they're built separately
  // above), sorted purely by load order — chunkIntoStacksSmart (via
  // useCompatibilityStacking below) is what decides whether a header/sill
  // gets diverted into its own stack, not this sort. Each ref's own `kind`
  // (header/sill/other) is what lets truckLoads.ts apply the relaxed
  // header/sill support rule and the never-bottom rule (see
  // partitionLongHeaders/chunkIntoStacksSmart's own doc comments).
  const shippingCombinedPanelRefs = useMemo(
    () =>
      allInstances
        .slice()
        .sort(
          (a, b) =>
            (shippingLoadOrderIndex.get(`${a.wallId}:${a.slotIndexInWall}`) ?? 0) -
            (shippingLoadOrderIndex.get(`${b.wallId}:${b.slotIndexInWall}`) ?? 0),
        )
        .map((inst) => ({
          id: inst.name,
          widthIn: inst.widthIn,
          heightIn: shippingPanelHeightById.get(inst.name),
          kind: inst.panelType === "header" ? ("header" as const) : inst.panelType === "sill" ? ("sill" as const) : ("other" as const),
        })),
    [allInstances, shippingLoadOrderIndex, shippingPanelHeightById],
  );

  // Longer headers (Tommy: "longer headers should probably be stacked
  // separately") never merge into the main run at all — see
  // partitionLongHeaders's own doc comment for the footprint-bloat problem
  // this also fixes.
  const { mainRun: shippingMainRunRefs, longHeaders: shippingLongHeaderRefs } = useMemo(
    () => partitionLongHeaders(shippingCombinedPanelRefs, standardWidthIn),
    [shippingCombinedPanelRefs, standardWidthIn],
  );

  const selectedTruck = truckBedTypes.value.find((t) => t.id === selectedTruckBedId) ?? truckBedTypes.value[0]!;
  const shippingTruckDims: TruckDims = {
    lengthIn: selectedTruck.interiorLengthIn,
    widthIn: selectedTruck.interiorWidthIn,
    heightIn: selectedTruck.interiorHeightIn,
  };
  const shippingGroups: PanelGroup[] = [
    { panels: shippingMainRunRefs, thicknessIn, defaultHeightIn: wallHeightFt * 12, useCompatibilityStacking: true },
    { panels: shippingLongHeaderRefs, thicknessIn, defaultHeightIn: wallHeightFt * 12, useCompatibilityStacking: true },
    { panels: shippingJackStudRefs, thicknessIn: jackStudThicknessIn(jackStudConfig), defaultHeightIn: wallHeightFt * 12 },
  ];
  const truckLoads = computeTruckLoads(shippingGroups, shippingTruckDims, shippingStackBufferIn.value, {
    dunnageGapIn: headerSillDunnageGapIn.value,
  });
  const shippingTruckCount = truckLoads.length;
  const shippingCost = shippingTruckCount * shippingMiles * shippingRatePerMile;
  const shippingPanelsPerStack = computePanelsPerStack(shippingTruckDims.heightIn, thicknessIn, shippingStackBufferIn.value);

  // Plaster Master (Tommy: "total materials and total price for plaster
  // options... link whether this turns on or off to the exterior or
  // interior finish options") — net plastered area auto-derives from the
  // drawn footprint (BUILT wall perimeter x wall height, doubled if Second
  // Story is on, since it mirrors story 1's own footprint) minus each window/
  // door's own clear Rough Opening area (you don't plaster over the
  // opening itself). Same area/RO-count applies to both faces of the same
  // wall, so it's computed once and shared by whichever side(s) are active.
  const plasterOpeningsAreaSqFtPerFloor = allInstances
    .filter((inst) => inst.panelType === "header")
    .reduce((sum, inst) => {
      const roWidthIn = computeRoughOpeningWidthIn(inst.widthIn, jackStudConfig);
      const roHeightIn = inst.sourceSlotType === "door" ? doorRoughOpeningHeightIn : (inst.windowHeightIn ?? standardWindowHeightDefaultIn.value);
      return sum + (roWidthIn * roHeightIn) / 144;
    }, 0);
  const plasterFloorCount = stories.length;
  // BUILT perimeter, not raw: you do not plaster a wall that was never
  // built. This is the first total the plan names as a suspect and it was
  // over-counting by the full unbuilt span times the wall height on every
  // story.
  const plasterGrossWallAreaSqFt = stories.reduce(
    (sum, s) => sum + (totalBuiltWallPerimeterIn / 12) * s.wallHeightFt,
    0,
  );
  const plasterNetAreaSqFt = Math.max(0, plasterGrossWallAreaSqFt - plasterOpeningsAreaSqFtPerFloor * plasterFloorCount);
  const plasterRoughOpeningCount = allInstances.filter((inst) => inst.panelType === "header").length * plasterFloorCount;

  // Auto-computed purchase quantities for whichever wall-assembly products
  // are checked (Tommy: "when checked on a product, i want to autofill the
  // most efficient way to use that product in the house") — same
  // per-floor doubling convention as the plaster block above.
  const extoSealOpeningWidths = useMemo(() => {
    const perFloor = allInstances
      .filter((inst) => inst.panelType === "header")
      .map((inst) => ({ widthIn: computeRoughOpeningWidthIn(inst.widthIn, jackStudConfig) }));
    return stories.length > 1 ? [...perFloor, ...perFloor] : perFloor;
  }, [allInstances, jackStudConfig, stories]);
  const extoSealLengthFt = useMemo(() => computeSillTapeLengthFt(extoSealOpeningWidths), [extoSealOpeningWidths]);

  const intelloWallRuns = useMemo(() => {
    if (!footprint) return [];
    // Per-wall BUILT length, not raw — an unbuilt span gets no air-tightness
    // membrane, and `computeMembraneCoverage` also counts vertical strips
    // per run, so a raw length inflates the seam tape figure too. A wall
    // built to zero drops out of the run list entirely rather than
    // contributing a zero-length strip.
    return stories.flatMap((story) =>
      footprint.walls
        .map((w) => ({ lengthFt: (builtWallLengthInByWallId[w.id] ?? w.lengthFt * 12) / 12, heightFt: story.wallHeightFt }))
        .filter((run) => run.lengthFt > 0),
    );
  }, [footprint, stories, builtWallLengthInByWallId]);
  // Flat plan-view placeholder — see computeFootprintAreaSqFt's own doc
  // comment on why real sloped roof area isn't computable yet.
  const intelloRoofAreaSqFt = useMemo(() => (footprint ? computeFootprintAreaSqFt(footprint) : 0), [footprint]);
  const intelloLayer = wallAssemblyLayers.find((l) => l.id === "intello-plus")!;
  const intelloRollWidthFt = (intelloLayer.rollWidthIn ?? 0) / 12;
  const intelloCoverage = useMemo(
    () => computeMembraneCoverage(intelloWallRuns, intelloRollWidthFt, intelloRoofAreaSqFt),
    [intelloWallRuns, intelloRollWidthFt, intelloRoofAreaSqFt],
  );

  const plasterPrices = {
    sandPricePerCuYd: plasterSandPricePerCuYd,
    clayPricePerBag: plasterClayPricePerBag,
    limePricePerBag: plasterLimePricePerBag,
    strawPricePerCuFt: plasterStrawPricePerCuFt,
  };
  // Bale Foundation's own rodent/air-sealed steel + clay bottom skin
  // (Tommy: "default option to add to the bottom of the lowest floor
  // framing member... basically just a skin for the bottom with a plaster
  // master calculator") — reuses the exact same computePlasterCoatResult
  // math as interior/exterior, just fed the footprint's own plan-view area
  // (the floor's underside area) instead of a wall-perimeter area.
  const hasSteelClaySkin = isBaleFoundationFloor && floorBottomSkinEnabled;
  const plasterFloorBottomAreaSqFt = footprint ? computeFootprintAreaSqFt(footprint) : 0;
  const steelMeshCost = hasSteelClaySkin ? plasterFloorBottomAreaSqFt * steelMeshPricePerSqFt : 0;
  const plasterSideResults = {
    interior: hasClayPlaster
      ? {
          base: computePlasterCoatResult(plasterInputs.interior.base, plasterNetAreaSqFt, plasterPrices),
          finish: computePlasterCoatResult(plasterInputs.interior.finish, plasterNetAreaSqFt, plasterPrices),
        }
      : null,
    exterior: hasLimePlaster
      ? {
          base: computePlasterCoatResult(plasterInputs.exterior.base, plasterNetAreaSqFt, plasterPrices),
          finish: computePlasterCoatResult(plasterInputs.exterior.finish, plasterNetAreaSqFt, plasterPrices),
        }
      : null,
    floorBottom: hasSteelClaySkin
      ? {
          base: computePlasterCoatResult(plasterInputs.floorBottom.base, plasterFloorBottomAreaSqFt, plasterPrices),
          finish: computePlasterCoatResult(plasterInputs.floorBottom.finish, plasterFloorBottomAreaSqFt, plasterPrices),
        }
      : null,
  };
  const plasterActiveSideCount = (hasClayPlaster ? 1 : 0) + (hasLimePlaster ? 1 : 0);
  const plasterLaborHoursPerSide = computePlasterLaborHours(
    plasterNetAreaSqFt,
    plasterRoughOpeningCount,
    plasterLaborRatesRef.roughOpeningEdgeAllowanceSqFt.value,
    plasterLaborRatesRef.fieldHrsPerSqFt.value,
    plasterLaborRatesRef.edgeHrsPerSqFt.value,
  );
  // No rough openings in a floor's own underside — field rate only, no
  // edge allowance, same computePlasterLaborHours formula with 0 openings.
  const plasterFloorBottomLaborHours = computePlasterLaborHours(
    plasterFloorBottomAreaSqFt,
    0,
    plasterLaborRatesRef.roughOpeningEdgeAllowanceSqFt.value,
    plasterLaborRatesRef.fieldHrsPerSqFt.value,
    plasterLaborRatesRef.edgeHrsPerSqFt.value,
  );
  const plasterTotalLaborHrs =
    plasterLaborHoursPerSide.totalHrs * plasterActiveSideCount +
    (hasSteelClaySkin ? plasterFloorBottomLaborHours.totalHrs : 0) +
    plasterFussyHoursExtra;
  const plasterTotalLaborCost = computePlasterLaborCost(plasterTotalLaborHrs, plasterLaborRatePerHour);
  const plasterTotalMaterialCost =
    (plasterSideResults.interior ? plasterSideResults.interior.base.materialCost + plasterSideResults.interior.finish.materialCost : 0) +
    (plasterSideResults.exterior ? plasterSideResults.exterior.base.materialCost + plasterSideResults.exterior.finish.materialCost : 0) +
    (plasterSideResults.floorBottom ? plasterSideResults.floorBottom.base.materialCost + plasterSideResults.floorBottom.finish.materialCost + steelMeshCost : 0);
  const plasterGrandTotalCost = plasterTotalMaterialCost + plasterTotalLaborCost;

  // Square Bale Panels: each "standard"-typed slot under this panelization
  // type is a bale-pair unit (Tommy: "two 18in bales" per panel) — counted
  // as discrete purchase units, not a density x volume estimate, since
  // real bales aren't infinitely resizable the way loose-pack straw is.
  const strawBaleCount =
    panelizationType === "square-bale-panels" ? allInstances.filter((inst) => inst.panelType === "standard").length * 2 : 0;
  const strawBaleWeightLb = strawBaleCount * STRAW_BALE_WEIGHT_LB;

  // Real member geometry, built per-instance at that instance's own width
  // (column/corner ignore it, always fixed at COLUMN_TOTAL_WIDTH_IN), for
  // any panel type that has one — shared by fastenerWeightKgFor and
  // woodWeightKgFor below so both read from the exact same member list
  // (e.g. a braced panel's real diagonal braces/connector, trapezoid length
  // included, not a flat per-type scalar).
  const membersForPanelTypeId = (
    panelTypeId: string,
    widthIn: number,
    sourceSlotType?: PanelInstance["sourceSlotType"],
    windowHeightInOverride?: number,
    sillHeightInOverride?: number,
    bracedPatternOverride?: BracePattern,
    bracedMirroredOverride?: boolean,
    leftEdgeHeightInOverride?: number,
    rightEdgeHeightInOverride?: number,
    isSafetyGapOverride?: boolean,
    verticalGapOverride?: { leftIn: number; rightIn: number },
    heightInOverride?: number,
  ) => {
    const heightIn = heightInOverride ?? wallHeightFt * 12;
    const resolvedSillHeightIn = sillHeightInOverride ?? sillDefaultHeightIn.value;
    const gableLeftLocalIn = (leftEdgeHeightInOverride ?? gablePreviewLowEdgeHeightIn) - gableEaveHeightIn;
    const gableRightLocalIn = (rightEdgeHeightInOverride ?? gablePreviewHighEdgeHeightIn) - gableEaveHeightIn;
    const base = panelTypeId === "standard"
      ? buildStandardPanelMembers(widthIn, thicknessIn, heightIn, includeNailer)
      : panelTypeId === "braced"
        ? buildBracedPanelMembers(
            widthIn,
            thicknessIn,
            heightIn,
            includeNailer,
            bracedPatternOverride ?? defaultBracePattern,
            bracedMirroredOverride ?? defaultBracedMirrored,
          )
        : panelTypeId === "column"
          ? columnPanelMembers
          : panelTypeId === "corner"
            ? // ⚠ Built at this instance's REAL width (and real height), not at
              // the memoized nominal 25.5in panel. This is what the
              // per-unique-panel Shop Fabrication page draws and describes, and
              // those pages are already GROUPED by `inst.widthIn` — so before
              // this, a 36in corner panel from the 51in-75.5in band (or from any
              // octagon 10.5ft-15ft across) got its own page that then
              // described a 25.5in part. A shop sheet describing the wrong
              // width is a part cut wrong. It also feeds wood/fastener weight,
              // which should follow the real part, as pricing already does.
              //
              // Square Bale's corner keeps the fixed 39in whole-bale body: that
              // one really is a single unit, and the tiler never widens it.
              isSquareBalePanelization
              ? cornerPanelMembers3D
              : buildCornerPanelMembers(thicknessIn, heightIn, includeNailer, widthIn)
            : panelTypeId === "gable"
              ? isSafetyGapOverride
                ? buildSafetyGapMembers(thicknessIn, Math.max(gableLeftLocalIn, gableRightLocalIn))
                : buildGablePanelMembers(widthIn, thicknessIn, gableLeftLocalIn, gableRightLocalIn, includeNailer)
              : panelTypeId === "header"
                ? sourceSlotType === "door"
                  ? buildDoorHeaderMembers(widthIn, thicknessIn, doorHeaderHeightIn)
                  : buildWindowHeaderMembers(
                      widthIn,
                      thicknessIn,
                      computeHeaderHeightIn(heightIn, resolvedSillHeightIn + (windowHeightInOverride ?? standardWindowHeightDefaultIn.value)),
                    )
                : panelTypeId === "sill"
                  ? buildSillPanelMembers(widthIn, thicknessIn, resolvedSillHeightIn, includeNailer)
                  : panelTypeId === "safety-gap"
                    ? // Two-tier sheet, off this slot's own reserved width —
                      // see `safetyGapSheetThicknessIn`.
                      buildSafetyGapMembers(thicknessIn, heightIn, safetyGapSheetThicknessIn(widthIn))
                    : null;
    if (!base) return base;
    // A vertical safety-gap filler (Tommy: "an ability to put a safety gap
    // inbetween the truss bottom and the gable end top") stacks ON TOP of
    // whichever gable geometry this tile got (a real Gable End Panel, or
    // its own row's horizontal safety-gap sliver) — additive, not a
    // replacement, since both a real filled/framed piece AND its own real
    // overflow filler get fabricated.
    if (panelTypeId === "gable" && verticalGapOverride) {
      // The panel below is always flat when a gap exists, so
      // gableLeftLocalIn/gableRightLocalIn are equal — either works as the
      // flat top's own local Z-offset.
      const filler = buildVerticalGapFillerMembers(widthIn, thicknessIn, verticalGapOverride.leftIn, verticalGapOverride.rightIn).map((m) => ({
        ...m,
        position: { ...m.position, zIn: m.position.zIn + gableLeftLocalIn },
      }));
      return [...base, ...filler];
    }
    return base;
  };

  // Fastener counts/weight are only modeled for panel types with real
  // member geometry (standard/braced/column/corner).
  const fastenerWeightKgFor = (
    panelTypeId: string,
    widthIn: number,
    sourceSlotType?: PanelInstance["sourceSlotType"],
    windowHeightInOverride?: number,
    sillHeightInOverride?: number,
    bracedPatternOverride?: BracePattern,
    bracedMirroredOverride?: boolean,
    leftEdgeHeightInOverride?: number,
    rightEdgeHeightInOverride?: number,
    isSafetyGapOverride?: boolean,
    verticalGapOverride?: { leftIn: number; rightIn: number },
    heightInOverride?: number,
  ): number | null => {
    const members = membersForPanelTypeId(
      panelTypeId,
      widthIn,
      sourceSlotType,
      windowHeightInOverride,
      sillHeightInOverride,
      bracedPatternOverride,
      bracedMirroredOverride,
      leftEdgeHeightInOverride,
      rightEdgeHeightInOverride,
      isSafetyGapOverride,
      verticalGapOverride,
      heightInOverride,
    );
    return members ? computeFastenerWeight(members).totalWeightKg : null;
  };

  // Wood weight is modeled for any panel type with real member geometry
  // (membersForPanelTypeId returns non-null) — geometry-aware via the same
  // real member list fastenerWeightKgFor uses, so e.g. a braced panel's
  // diagonal braces (real trapezoid length) actually count, unlike the old
  // flat computeStandardPanelWoodWeight scalar that assumed every braced
  // panel shares the plain standard panel's BOM. Only jack-stud (no
  // membersForPanelTypeId branch) falls through to "not modeled".
  const woodWeightKgFor = (
    panelTypeId: string,
    widthIn: number,
    sourceSlotType?: PanelInstance["sourceSlotType"],
    windowHeightInOverride?: number,
    sillHeightInOverride?: number,
    bracedPatternOverride?: BracePattern,
    bracedMirroredOverride?: boolean,
    leftEdgeHeightInOverride?: number,
    rightEdgeHeightInOverride?: number,
    isSafetyGapOverride?: boolean,
    verticalGapOverride?: { leftIn: number; rightIn: number },
    heightInOverride?: number,
  ): number | null => {
    const members = membersForPanelTypeId(
      panelTypeId,
      widthIn,
      sourceSlotType,
      windowHeightInOverride,
      sillHeightInOverride,
      bracedPatternOverride,
      bracedMirroredOverride,
      leftEdgeHeightInOverride,
      rightEdgeHeightInOverride,
      isSafetyGapOverride,
      verticalGapOverride,
      heightInOverride,
    );
    return members ? computeMemberSetWoodWeight(members).weightKg : null;
  };

  // Straw for a Header isn't a flat width x thickness x height box — its
  // cavity is bounded by the truss chords/web bracing/end caps, so the
  // weight-checker table needs the same real member list fastenerWeightKgFor
  // and woodWeightKgFor already use, run through computeStandardPanelStraw
  // Volume (envelope minus every member's own box volume) instead of the
  // flat computeStrawWeight formula every other panel type keeps using.
  // Every other panel type returns null here, so computePanelWeightBreakdown
  // falls back to its own flat estimate unchanged.
  const strawWeightKgFor = (
    panelTypeId: string,
    widthIn: number,
    sourceSlotType?: PanelInstance["sourceSlotType"],
    windowHeightInOverride?: number,
    sillHeightInOverride?: number,
    bracedPatternOverride?: BracePattern,
    bracedMirroredOverride?: boolean,
    heightInOverride?: number,
  ): number | null => {
    if (panelTypeId !== "header") return null;
    const members = membersForPanelTypeId(
      panelTypeId,
      widthIn,
      sourceSlotType,
      windowHeightInOverride,
      sillHeightInOverride,
      bracedPatternOverride,
      bracedMirroredOverride,
      undefined,
      undefined,
      undefined,
      undefined,
      heightInOverride,
    );
    if (!members) return null;
    const heightIn =
      sourceSlotType === "door"
        ? doorHeaderHeightIn
        : computeHeaderHeightIn(
            heightInOverride ?? wallHeightFt * 12,
            (sillHeightInOverride ?? sillDefaultHeightIn.value) + (windowHeightInOverride ?? standardWindowHeightDefaultIn.value),
          );
    const straw = computeStandardPanelStrawVolume(members, { heightIn, widthIn, depthIn: thicknessIn });
    const volumeM3 = straw.strawVolumeFt3 * FT3_TO_M3;
    return volumeM3 * densityLbFt3 * LB_FT3_TO_KG_M3;
  };

  const shopDrawings = useMemo(
    () =>
      SHOP_DRAWING_PANEL_TYPES.map(({ namedTypes, panelTypeId }) => {
        const panelType = panelTypes.find((p) => p.id === panelTypeId)!;
        const instances = allInstances
          .filter((inst) => namedTypes.includes(inst.panelType))
          .map((inst) => ({
            ...inst,
            weightBreakdown: computePanelWeightBreakdown({
              // Safety/Gap is a solid wood truss/sheet filling the wall's
              // cavity there, no straw at all — widthIn: 0 forces the flat
              // straw formula to a correct 0 without touching inst.widthIn
              // itself (still shown as-is in the table's own Width column).
              // Header also zeroes the flat formula here, but its real straw
              // weight comes from strawWeightKgOverride below (a member-
              // aware volume — a header's own cavity is bounded by its truss
              // chords/web/end caps, not a plain box), so this 0 is just a
              // moot fallback for that panel type, not the real answer.
              widthIn: panelTypeId === "safety-gap" || panelTypeId === "header" ? 0 : inst.widthIn,
              strawWeightKgOverride: strawWeightKgFor(
                panelTypeId,
                inst.widthIn,
                inst.sourceSlotType,
                inst.windowHeightIn,
                inst.sillHeightIn,
                inst.bracedPattern,
                inst.bracedMirrored,
                inst.heightOverrideIn,
              ),
              thicknessIn,
              // A sill is a much shorter panel (Tommy: "sills are almost
              // always 32in tall") than the full wall height every other
              // panel type here uses; a gable tile's own tallest point
              // (whichever edge that is) stands in for the flat-box
              // approximation every non-header panel type uses. A Mid-Wall
              // Bond Beam band overrides the flat wallHeightFt*12 fallback
              // with that band's own real (shorter) height.
              heightIn:
                panelTypeId === "sill"
                  ? (inst.sillHeightIn ?? sillDefaultHeightIn.value)
                  : panelTypeId === "gable"
                    ? Math.max(inst.leftEdgeHeightIn ?? gableEaveHeightIn, inst.rightEdgeHeightIn ?? gableEaveHeightIn) - gableEaveHeightIn
                    : (inst.heightOverrideIn ?? wallHeightFt * 12),
              densityKgM3: densityLbFt3 * LB_FT3_TO_KG_M3,
              woodWeightKg: woodWeightKgFor(
                panelTypeId,
                inst.widthIn,
                inst.sourceSlotType,
                inst.windowHeightIn,
                inst.sillHeightIn,
                inst.bracedPattern,
                inst.bracedMirrored,
                inst.leftEdgeHeightIn,
                inst.rightEdgeHeightIn,
                inst.isSafetyGap,
                inst.gableVerticalGapIn,
                inst.heightOverrideIn,
              ),
              fastenerWeightKg: fastenerWeightKgFor(
                panelTypeId,
                inst.widthIn,
                inst.sourceSlotType,
                inst.windowHeightIn,
                inst.sillHeightIn,
                inst.bracedPattern,
                inst.bracedMirrored,
                inst.leftEdgeHeightIn,
                inst.rightEdgeHeightIn,
                inst.isSafetyGap,
                inst.gableVerticalGapIn,
                inst.heightOverrideIn,
              ),
              hasClayPlaster,
              hasLimePlaster,
            }),
          }));
        return { panelType, instances };
      }),
    [
      allInstances,
      thicknessIn,
      wallHeightFt,
      densityLbFt3,
      includeNailer,
      defaultBracePattern,
      defaultBracedMirrored,
      hasClayPlaster,
      hasLimePlaster,
      doorHeaderHeightIn,
      sillHeightIn,
    ],
  );

  // Per-fastener-type project totals (Tommy: "do a full check on what
  // might not be on this but should be" / "flesh out the fasteners section
  // to include the amount of 2in sheathing nails, #9 T25 screws,
  // 4in 5/16in GRK's, and 6in 5/16in GRK's") — fasteners are computed
  // per-instance via computePanelWeightBreakdown elsewhere, but only as a
  // single collapsed weight; this re-runs
  // computeFastenerWeight/computeJackStudFastenerWeight per real instance
  // and keeps their own `items` breakdown (count + weight per type),
  // accumulated by label across the whole project. shippingJackStudRefs is
  // already the real per-project jack-stud list (one entry per real jack
  // stud, ext+int wythe both counted, each with its own real RO-height-
  // derived heightIn) — the same source shipping/truck-loadout already
  // uses, so this doesn't re-derive opening counts from scratch.
  const fastenerItemTotals = useMemo(() => {
    const byLabel = new Map<string, { count: number; totalWeightLb: number }>();
    const unmodeledLabels = new Set<string>();
    const accumulate = (items: { label: string; count: number; totalWeightLb: number }[]) => {
      for (const item of items) {
        const existing = byLabel.get(item.label);
        if (existing) {
          existing.count += item.count;
          existing.totalWeightLb += item.totalWeightLb;
        } else {
          byLabel.set(item.label, { count: item.count, totalWeightLb: item.totalWeightLb });
        }
      }
    };
    for (const { panelType, instances } of shopDrawings) {
      for (const inst of instances) {
        const members = membersForPanelTypeId(
          panelType.id,
          inst.widthIn,
          inst.sourceSlotType,
          inst.windowHeightIn,
          inst.sillHeightIn,
          inst.bracedPattern,
          inst.bracedMirrored,
          inst.leftEdgeHeightIn,
          inst.rightEdgeHeightIn,
          inst.isSafetyGap,
          inst.gableVerticalGapIn,
          inst.heightOverrideIn,
        );
        if (members) accumulate(computeFastenerWeight(members).items);
        else unmodeledLabels.add(panelType.label);
      }
    }
    for (const ref of shippingJackStudRefs) {
      accumulate(computeJackStudFastenerWeight(ref.heightIn).items);
    }
    const items = [...byLabel.entries()].map(([label, v]) => ({ label, count: v.count, totalWeightLb: v.totalWeightLb }));
    const totalWeightLb = items.reduce((sum, i) => sum + i.totalWeightLb, 0);
    return { items, totalWeightLb, unmodeledLabels: [...unmodeledLabels] };
  }, [shopDrawings, shippingJackStudRefs]);

  // Estimated bearing/shear numbers (Tommy: "let's take a stab at making
  // some estimated engineering numbers") — bearing applies to any panel
  // type with real stud geometry (standard/braced/column/corner all share
  // the same 2x4 studs); shear is specific to the Braced Panel's diagonal
  // brace, computed from its own actual member geometry at the currently-
  // selected width/height rather than a flat constant.
  const estimatedStudPackBearingLb = useMemo(() => computeStudPackBearingCapacityLb(), []);
  const estimatedBracedShearLb = useMemo(
    () =>
      computeBracedPanelShearCapacityLb(
        buildBracedPanelMembers(standardWidthIn, thicknessIn, wallHeightFt * 12, includeNailer, defaultBracePattern, defaultBracedMirrored),
      ),
    [standardWidthIn, thicknessIn, wallHeightFt, includeNailer, defaultBracePattern, defaultBracedMirrored],
  );
  // Column/Corner panels get a MUCH higher estimate than the plain stud
  // pack (Tommy: "they have those two sheets of plywood running up the
  // sides... calculate the load bearing strength of basically a truss
  // plate turned up") — the full built-up section (plywood sides + corner
  // studs), not just a lone stud, see computeBuiltUpColumnBearingCapacityLb.
  const estimatedColumnBuiltUpBearingLb = useMemo(
    () => computeBuiltUpColumnBearingCapacityLb(columnPanelMembers, wallHeightFt * 12),
    [columnPanelMembers, wallHeightFt],
  );
  // ⚠ DELIBERATELY the NOMINAL-width corner panel, even though corner members
  // are now built at each slot's real width everywhere else (2026-09-26). This
  // capacity is derived from the members' real positions, so a widened corner
  // reports MORE bearing — the two side plywood faces sit further apart, which
  // raises I and r. Nobody has confirmed that a widened corner's cladding
  // braces the built-up section the same way, and a structural figure is not
  // somewhere to find out by inference: the nominal section is the conservative
  // answer. Recorded in the spec's `## Open Items` — "Does a WIDER corner panel
  // carry more axial load?" — as Tommy's/his engineer's call. (It was cited as
  // "the spec's Open Items" while sitting only in a narrative section and in
  // neither Open Items list; the item was added 2026-09-26 rather than the
  // pointer softened.)
  //
  // ⚠ A pre-existing divergence, recorded here and NOT fixed: this site reads
  // `cornerPanelMembers3D`, which under Square Bale is the BALE corner body,
  // while `structuralByKey` in FootprintCanvas.tsx always builds the plywood
  // corner at nominal. So "bearing is consistent at both sites" holds for Loose
  // Packed Braced and Timber Frame Curtain and NOT for Square Bale. Not
  // introduced by the corner work; see the same note in FootprintCanvas.tsx.
  const estimatedCornerBuiltUpBearingLb = useMemo(
    () => computeBuiltUpColumnBearingCapacityLb(cornerPanelMembers3D, wallHeightFt * 12),
    [cornerPanelMembers3D, wallHeightFt],
  );

  // Shared bearing/shear reduction over an arbitrary instance subset —
  // factored out so the exact same math powers both the whole-project
  // totals below AND the Engineer role's own per-wall structural summary
  // card (see elevationControls) without duplicating the formula. Bearing
  // is a flat per-panel figure (computeStudPackBearingCapacityLb takes no
  // width), summed across every instance with real stud-pack geometry;
  // shear is summed per actual braced instance at ITS OWN tiled width
  // (braced panels aren't all the same size — computePanelSizeShares can
  // give them different widths), not the globally-selected standardWidthIn.
  const summarizeBearingAndShear = (instances: PanelInstance[]) => {
    const perTypeBearingLb: Partial<Record<string, number>> = {
      standard: estimatedStudPackBearingLb,
      braced: estimatedStudPackBearingLb,
      column: estimatedColumnBuiltUpBearingLb,
      corner: estimatedCornerBuiltUpBearingLb,
      "safety-oct-corner": estimatedCornerBuiltUpBearingLb,
    };
    const bearingLb = instances.reduce((sum, inst) => sum + (perTypeBearingLb[inst.panelType] ?? 0), 0);
    const eligiblePanelCount = instances.filter((inst) => BEARING_ELIGIBLE_TYPES.has(inst.panelType)).length;
    const bracedInstances = instances.filter((inst) => inst.panelType === "braced");
    const shearLb = bracedInstances.reduce((sum, inst) => {
      const style = resolveBracedStyle(inst, defaultBracePattern, defaultBracedMirrored);
      return (
        sum +
        computeBracedPanelShearCapacityLb(
          buildBracedPanelMembers(inst.widthIn, thicknessIn, wallHeightFt * 12, includeNailer, style.pattern, style.mirrored),
        )
      );
    }, 0);
    return { bearingLb, eligiblePanelCount, shearLb, bracedPanelCount: bracedInstances.length };
  };

  // Whole-project estimated totals (Tommy: replace the Review Log's flat
  // "shear/load capacity: not yet modeled" line with these).
  const estimatedTotalBearingLb = useMemo(
    () => summarizeBearingAndShear(allInstances).bearingLb,
    [allInstances, estimatedStudPackBearingLb, estimatedColumnBuiltUpBearingLb, estimatedCornerBuiltUpBearingLb],
  );
  const estimatedTotalShearLb = useMemo(
    () => summarizeBearingAndShear(allInstances).shearLb,
    [allInstances, thicknessIn, wallHeightFt, includeNailer, defaultBracePattern, defaultBracedMirrored],
  );

  // Engineer role's own per-wall structural summary (see elevationControls'
  // own "engineer" section below) — same summarizeBearingAndShear reduction,
  // scoped to just the currently-viewed wall's own instances instead of the
  // whole footprint. Only computed when actually needed (engineer role +
  // a wall selected in Elevation view) to avoid extra work for every other
  // role/view.
  const elevationWallBearingAndShear = useMemo(() => {
    if (role !== "engineer" || !elevationWall) return null;
    return summarizeBearingAndShear(allInstances.filter((inst) => inst.wallId === elevationWall.id));
  }, [role, elevationWall, allInstances, thicknessIn, wallHeightFt, includeNailer, defaultBracePattern, defaultBracedMirrored, estimatedStudPackBearingLb, estimatedColumnBuiltUpBearingLb, estimatedCornerBuiltUpBearingLb]);

  // Per-unique-panel Shop Fabrication pages (Tommy: "if there's exact
  // copies of panels we can group those up" — same principle already used
  // for shipping/truck-loading). Covers every panel type WITH real placed
  // instances — everything shopDrawings has except Gable/Jack-Stud, which
  // have no PanelInstance identity at all (no roof/ridge placement system,
  // no rough-opening height tracking yet) and stay on their existing
  // preview-only ShopDrawingPage. Safety/Gap is a special case: its real
  // member geometry (buildSafetyGapMembers) does not use the slot's widthIn as
  // a width at all — the sheet is an edge-on plywood board whose THICKNESS is
  // what the run reserved — so its instances are grouped by that thickness
  // rather than by the reserved width, which lands a combined
  // corner-brace slot (standard width + buffer) on the same page as a plain
  // 3/4in gap, as it always has.
  //
  // ⚠ **Grouping by thickness, not by a single constant, is load-bearing since
  // 2026-10-01.** With two sheets in play (3/4in 5-ply CDX / 1/2in 3-ply CDX),
  // the old `return panelTypeId` key merged them onto one Shop Fabrication page
  // titled with one thickness — a sheet ordered and cut wrong. They are
  // genuinely different fabricated parts, the same reason two braced panels of
  // one width but different patterns do not merge.
  const panelFabricationGroups = useMemo(() => {
    const resolvedSillHeightInFor = (inst: PanelInstance) => inst.sillHeightIn ?? sillDefaultHeightIn.value;
    const resolvedWindowHeightInFor = (inst: PanelInstance) => inst.windowHeightIn ?? standardWindowHeightDefaultIn.value;
    const panelHeightInFor = (panelTypeId: string, inst: PanelInstance): number => {
      if (panelTypeId === "sill") return resolvedSillHeightInFor(inst);
      if (panelTypeId === "header") {
        return inst.sourceSlotType === "door"
          ? doorHeaderHeightIn
          : computeHeaderHeightIn(
              inst.heightOverrideIn ?? wallHeightFt * 12,
              resolvedSillHeightInFor(inst) + resolvedWindowHeightInFor(inst),
            );
      }
      if (panelTypeId === "gable") {
        return Math.max(inst.leftEdgeHeightIn ?? gableEaveHeightIn, inst.rightEdgeHeightIn ?? gableEaveHeightIn) - gableEaveHeightIn;
      }
      return inst.heightOverrideIn ?? wallHeightFt * 12;
    };
    const panelWidthInFor = (panelTypeId: string, inst: PanelInstance): number =>
      panelTypeId === "safety-gap" ? safetyGapSheetThicknessIn(inst.widthIn) : inst.widthIn;
    const groupKeyFor = (panelTypeId: string, inst: PanelInstance): string => {
      if (panelTypeId === "safety-gap") return `${panelTypeId}:${safetyGapSheetThicknessIn(inst.widthIn).toFixed(3)}`;
      // heightOverrideIn folded in so a Mid-Wall Bond Beam's below-band
      // piece, above-band piece, and an unrelated full-height copy of the
      // same width never merge onto one Shop Fab page.
      const parts = [panelTypeId, inst.widthIn.toFixed(3), (inst.heightOverrideIn ?? -1).toFixed(3)];
      if (panelTypeId === "header" || panelTypeId === "sill") {
        parts.push(inst.sourceSlotType ?? "", resolvedWindowHeightInFor(inst).toFixed(3), resolvedSillHeightInFor(inst).toFixed(3));
      }
      // Two braced panels of the same width but a different pattern/mirror
      // are physically different fabricated parts now (Tommy: "include
      // each panel style for braced panels") — must not merge onto one
      // Shop Fabrication page.
      if (panelTypeId === "braced") {
        const style = resolveBracedStyle(inst, defaultBracePattern, defaultBracedMirrored);
        parts.push(style.pattern, String(style.mirrored));
      }
      // Same idea for gable tiles — two tiles of the same width but
      // different edge heights (different position along the roofline)
      // are physically different fabricated parts.
      if (panelTypeId === "gable") {
        parts.push(
          (inst.leftEdgeHeightIn ?? 0).toFixed(3),
          (inst.rightEdgeHeightIn ?? 0).toFixed(3),
          String(!!inst.isSafetyGap),
          (inst.gableVerticalGapIn?.leftIn ?? 0).toFixed(3),
          (inst.gableVerticalGapIn?.rightIn ?? 0).toFixed(3),
        );
      }
      return parts.join("|");
    };

    return shopDrawings
      .filter(({ panelType }) => panelType.id !== "jack-stud")
      .flatMap(({ panelType, instances }) => {
        const groups = new Map<string, typeof instances>();
        for (const inst of instances) {
          const key = groupKeyFor(panelType.id, inst);
          const existing = groups.get(key);
          if (existing) existing.push(inst);
          else groups.set(key, [inst]);
        }
        return [...groups.entries()].map(([key, groupInstances]) => {
          const first = groupInstances[0]!;
          const bracedStyle = panelType.id === "braced" ? resolveBracedStyle(first, defaultBracePattern, defaultBracedMirrored) : null;
          const members =
            membersForPanelTypeId(
              panelType.id,
              first.widthIn,
              first.sourceSlotType,
              first.windowHeightIn,
              first.sillHeightIn,
              bracedStyle?.pattern,
              bracedStyle?.mirrored,
              first.leftEdgeHeightIn,
              first.rightEdgeHeightIn,
              first.isSafetyGap,
              first.gableVerticalGapIn,
              first.heightOverrideIn,
            ) ?? [];
          return {
            uniqueKey: `${panelType.id}-${key}`,
            panelType,
            widthIn: panelWidthInFor(panelType.id, first),
            heightIn: panelHeightInFor(panelType.id, first),
            members,
            weightBreakdown: first.weightBreakdown,
            bracedPattern: bracedStyle?.pattern,
            bracedMirrored: bracedStyle?.mirrored,
            instances: groupInstances.map((inst) => {
              // Stage 2b's reciprocal cross-reference. A panel under a
              // spanning header says so on its own sheet, because the header's
              // name carries no direction and a shop reading this sheet cannot
              // see that one.
              const headerAbove = spanningHeaderCrossReference.headerAboveByPanel.get(inst.name);
              return {
                name: inst.name,
                isSafetyOctCorner: inst.panelType === "safety-oct-corner",
                ...(headerAbove ? { note: `Header above: ${headerAbove}.` } : {}),
              };
            }),
          };
        });
      });
    // `spanningHeaderCrossReference` is listed because a panel's sheet now
    // carries the header above it — without it, adding a header would leave
    // every panel sheet claiming there is none. The stale-memo defect Stage
    // 3's review found was exactly this shape, one dependency short.
  }, [
    shopDrawings,
    thicknessIn,
    wallHeightFt,
    includeNailer,
    defaultBracePattern,
    defaultBracedMirrored,
    doorHeaderHeightIn,
    sillHeightIn,
    spanningHeaderCrossReference,
  ]);

  // Real per-wall (or per-section-of-a-wall) roof-bearing (truss plate /
  // box beam) Shop Fabrication pages — same treatment gable-end panels
  // got: one real segment per wall (or, with partial Box Beam coverage,
  // per covered/uncovered stretch of a wall — see
  // computeRoofBearingSegments), grouped into exact-copy fabrication
  // pages, replacing the single fixed-10ft illustrative preview the "Roof:
  // Truss Plate/Box Beam" Detail Guide page still shows (that page stays
  // as general reference documentation, same role as Door/Window RO).
  // Truss plate/box beam have no straw at all — a Timber HP or dense-pack-
  // cellulose fill stands in its place, so the weightBreakdown below is
  // hand-built rather than routed through computePanelWeightBreakdown
  // (which hardcodes a "Straw" component label).
  const roofBearingFabricationGroups = useMemo(() => {
    if (!footprint) return [];

    // Box beam is a per-wall (or per-section) choice now
    // (boxBeamCoverageByWallId), not automatic once stories.length > 1 —
    // each wall's own top can split into up to 3 real segments, so a
    // single building (or even a single wall) can produce both Truss Plate
    // and Box Beam fabrication pages at once (grouped by kind + length,
    // same "exact copies together" rule gable/standard panels already use).
    const groups = new Map<string, { kind: "truss-plate" | "box-beam"; lengthIn: number; walls: { id: string; direction: string }[] }>();
    for (const wall of footprint.walls) {
      const direction = wallCompassDirection(wall, footprint);
      const slots = stories.length > 1 ? (secondStory?.wallSlots[wall.id] ?? []) : [];
      // The single-story plate spans this wall's BUILT run, not its raw
      // length — a plate bears on top of panels, and a stopped wall has
      // none there to bear on. This one drives a real FABRICATION sheet, so
      // an over-long plate here is a part cut wrong, not just a total.
      // (The multi-story branch reads the second story's own slots and so
      // already shrinks for free.)
      const builtLengthIn = builtWallLengthInByWallId[wall.id] ?? wall.lengthFt * 12;
      const segments =
        stories.length > 1
          ? computeRoofBearingSegments(slots, boxBeamCoverageByWallId[wall.id])
          : // A wall built to zero emits NO plate. Without this guard it
            // produced a `truss-plate-0.000` fabrication group — a real shop
            // sheet for a 0in part, complete with a Timber HP volume and
            // weight line. `intelloWallRuns` already filters its zero-length
            // runs out for the same reason; so does
            // `computeRoofBearingSegments`, which returns [] on an empty run.
            builtLengthIn > 0
            ? [{ kind: "truss-plate" as const, startXIn: 0, lengthIn: builtLengthIn }]
            : [];
      for (const seg of segments) {
        const key = `${seg.kind}-${seg.lengthIn.toFixed(3)}`;
        const existing = groups.get(key);
        if (existing) existing.walls.push({ id: wall.id, direction });
        else groups.set(key, { kind: seg.kind, lengthIn: seg.lengthIn, walls: [{ id: wall.id, direction }] });
      }
    }

    return [...groups.entries()].map(([groupKey, { kind, lengthIn, walls }]) => {
      const kindLabel = kind === "truss-plate" ? "Truss Plate" : "Box Beam";
      const heightIn = kind === "truss-plate" ? computeRoofBearingAssemblyHeightIn(false) : computeBoxBeamAssemblyHeightIn(boxBeamSizeId);
      const members =
        kind === "truss-plate" ? buildTrussPlateMembers(lengthIn, thicknessIn, trussPlateInsetIn) : buildBoxBeamMembers(lengthIn, thicknessIn, boxBeamSizeId);
      const woodWeightKg = computeMemberSetWoodWeight(members).weightKg;
      const fill =
        kind === "truss-plate"
          ? (() => {
              const vol = computeTimberHpVolume(lengthIn, thicknessIn, trussPlateInsetIn);
              const weight = computeInsulationWeight(vol.volumeFt3, timberHpDensityLbFt3.value);
              return { label: "Timber HP insulation fill", weightKg: weight.weightKg, weightLb: weight.weightLb };
            })()
          : (() => {
              const vol = computeDensePackCelluloseVolume(lengthIn, thicknessIn, boxBeamSizeId);
              const weight = computeInsulationWeight(vol.volumeFt3, densePackCelluloseDensityLbFt3.value);
              return { label: "Dense-pack cellulose fill", weightKg: weight.weightKg, weightLb: weight.weightLb };
            })();
      const woodComponent = {
        label: kind === "truss-plate" ? "Wood (2x4/2x6 + plywood cap)" : "Wood (webs + plywood caps)",
        weightKg: woodWeightKg,
        weightLb: woodWeightKg * KG_TO_LB,
      };
      const weightBreakdown: PanelWeightBreakdown = {
        strawOnlyWeightKg: 0,
        strawOnlyWeightLb: 0,
        components: [woodComponent, fill],
        totalModeledWeightKg: woodComponent.weightKg + fill.weightKg,
        totalModeledWeightLb: woodComponent.weightLb + fill.weightLb,
      };

      return {
        uniqueKey: `roof-${groupKey}`,
        kind,
        kindLabel,
        lengthIn,
        heightIn,
        members,
        weightBreakdown,
        instances: walls.map((w) => ({ name: `Wall ${w.id} (${w.direction})` })),
      };
    });
  }, [footprint, stories.length, secondStory, boxBeamCoverageByWallId, boxBeamSizeId, thicknessIn, trussPlateInsetIn, builtWallLengthInByWallId]);

  /* Floor and roof PANELS' own Shop Fabrication pages.

     Same "walk the building directly, bypass allInstances" shape as
     roofBearingFabricationGroups above, because a floor panel is not a wall
     slot and never passes through the tiler. The span/run split comes from
     `footprintSpanAndRun`, the same rule the joist layout uses, so a
     building's joists and its floor panels can never be shown running at
     right angles to each other.

     ⚠ The run is the footprint's OUTER dimension, because the walls bear on
     the floor rather than sitting beside it. */
  const floorRoofPanelFabricationGroups = useMemo(() => {
    if (!footprint) return [];
    const { spanFt, runFt } = footprintSpanAndRun(footprint);
    const spanIn = spanFt * 12;
    const runIn = runFt * 12;
    const densityKgM3 = densityLbFt3 * LB_FT3_TO_KG_M3;

    return (["floor", "roof"] as const).flatMap((kind) => {
      const plan = planFloorRoofPanelRun({
        kind,
        runLengthIn: runIn,
        spanIn,
        depthIn: thicknessIn,
        /* No pitch means no caps, and the schema says so in its own notes
           rather than inventing an angle. */
        pitchIn12: kind === "roof" ? roofTrussLayoutContext?.pitchIn12 : undefined,
      });
      return plan.groups.map((group) => {
        const straw = computeStandardPanelStrawVolume(group.members, {
          heightIn: spanIn,
          widthIn: group.widthIn,
          depthIn: thicknessIn,
        });
        const woodWeightKg = computeMemberSetWoodWeight(group.members).weightKg;
        const weightBreakdown = computePanelWeightBreakdown({
          /* The flat width x thickness x height estimate is moot here — a
             floor panel's cavity is carved up by four 2x6 joists, girts and
             blocking, so the real member-aware volume goes in as the
             override and this is just its fallback. */
          widthIn: 0,
          strawWeightKgOverride: straw.strawVolumeFt3 * FT3_TO_M3 * densityKgM3,
          thicknessIn,
          heightIn: spanIn,
          densityKgM3,
          woodWeightKg,
          /* ⚠ Honestly null, not 0: the schema carries `fasteners: []` and
             nobody has given a nailing schedule for a floor or roof panel.
             Reporting 0 would read as "no fasteners" for a panel that is
             nailed together throughout. */
          fastenerWeightKg: null,
          /* Neither straw face is exposed — both lids are plywood-skinned
             and structural, so no plaster coat lands on this panel. */
          hasClayPlaster: false,
          hasLimePlaster: false,
        });
        return { ...group, kind, plan, spanIn, runIn, weightBreakdown };
      });
    });
  }, [footprint, thicknessIn, densityLbFt3, roofTrussLayoutContext]);

  // Mid-Wall Bond Beam's own Shop Fabrication pages — same "walk
  // walls/stories directly, bypass allInstances" shape as
  // roofBearingFabricationGroups above (each beam's own member is a real
  // per-beam piece, grouped by size + its own COVERED length across the
  // whole project the same "exact copies together" rule every other
  // fabricated part uses — two different beams, even on different walls/
  // stories, sharing size+covered-length still correctly group together,
  // since a shop cuts by size+length, not installed height), NOT the
  // ground-floor-only allInstances/panelFabricationGroups pipeline — so a
  // beam's own piece gets a correct Shop Fab page on EITHER story, even
  // though that wall's own below/above-band wall panels only flow through
  // Shop Fab on the ground floor today (see midWallBeamGeometryByWallId's
  // own doc comment).
  const midWallBondBeamFabricationGroups = useMemo(() => {
    if (!footprint) return [];
    const groups = new Map<
      string,
      { kind: MidWallBeamKind; sizeId?: BoxBeamSizeId; bigHeaderBeamHeightIn?: number; lengthIn: number; instances: { name: string }[] }
    >();
    for (const story of stories) {
      const beams = midWallBeamsByStoryAndWallId[story.id];
      for (const wall of footprint.walls) {
        const wallBeams = beams[wall.id];
        if (!wallBeams || wallBeams.length === 0) continue;
        const direction = wallCompassDirection(wall, footprint);
        const offsetsIn = (story.wallSlots[wall.id] ?? []).reduce<number[]>(
          (acc, s) => [...acc, acc[acc.length - 1]! + s.widthIn],
          [0],
        );
        for (const beam of wallBeams) {
          const lengthIn = Math.max(0, (offsetsIn[beam.endSlotIndex] ?? 0) - (offsetsIn[beam.startSlotIndex] ?? 0));
          if (lengthIn <= 0) continue;
          // Big Header heights are continuous (not a discrete catalog id),
          // so two different beams will naturally group together far less
          // often than two box beams sharing the same catalog size —
          // expected, matches this app's general "a shop cuts by real
          // dimensions" grouping convention.
          const key =
            beam.kind === "box-beam"
              ? `box-beam-${beam.sizeId}-${lengthIn.toFixed(3)}`
              : `big-header-beam-${beam.bigHeaderBeamHeightIn!.toFixed(2)}-${lengthIn.toFixed(3)}`;
          const name = `Wall ${wall.id} (${direction}, ${story.label}, ${beam.heightIn.toFixed(1)}in)`;
          const existing = groups.get(key);
          if (existing) existing.instances.push({ name });
          else groups.set(key, { kind: beam.kind, sizeId: beam.sizeId, bigHeaderBeamHeightIn: beam.bigHeaderBeamHeightIn, lengthIn, instances: [{ name }] });
        }
      }
    }

    return [...groups.entries()].map(([groupKey, { kind, sizeId, bigHeaderBeamHeightIn, lengthIn, instances }]) => {
      const heightIn = kind === "box-beam" ? computeBoxBeamAssemblyHeightIn(sizeId) : (bigHeaderBeamHeightIn ?? BIG_HEADER_BEAM_MIN_HEIGHT_IN);
      const members = kind === "box-beam" ? buildBoxBeamMembers(lengthIn, thicknessIn, sizeId) : buildBigHeaderBeamMembers(lengthIn, thicknessIn, heightIn);
      const woodWeightKg = computeMemberSetWoodWeight(members).weightKg;
      const weightBreakdown: PanelWeightBreakdown =
        kind === "box-beam"
          ? (() => {
              const vol = computeDensePackCelluloseVolume(lengthIn, thicknessIn, sizeId);
              const fillWeight = computeInsulationWeight(vol.volumeFt3, densePackCelluloseDensityLbFt3.value);
              return {
                strawOnlyWeightKg: 0,
                strawOnlyWeightLb: 0,
                components: [
                  { label: "Wood (webs + plywood caps)", weightKg: woodWeightKg, weightLb: woodWeightKg * KG_TO_LB },
                  { label: "Dense-pack cellulose fill", weightKg: fillWeight.weightKg, weightLb: fillWeight.weightLb },
                ],
                totalModeledWeightKg: woodWeightKg + fillWeight.weightKg,
                totalModeledWeightLb: woodWeightKg * KG_TO_LB + fillWeight.weightLb,
              };
            })()
          : {
              // No fill component — a Big Header is a solid framed + braced
              // panel (like a window header), not an insulated cavity
              // assembly the way a Box Beam is.
              strawOnlyWeightKg: 0,
              strawOnlyWeightLb: 0,
              components: [{ label: "Wood (chords + W-braces + plywood caps)", weightKg: woodWeightKg, weightLb: woodWeightKg * KG_TO_LB }],
              totalModeledWeightKg: woodWeightKg,
              totalModeledWeightLb: woodWeightKg * KG_TO_LB,
            };
      return {
        uniqueKey: `midwallbeam-${groupKey}`,
        kind,
        sizeId,
        bigHeaderBeamHeightIn,
        lengthIn,
        heightIn,
        members,
        weightBreakdown,
        instances,
      };
    });
  }, [footprint, stories, midWallBeamsByStoryAndWallId, thicknessIn]);

  /**
   * Smearforn Stage 2b — a spanning header's own Shop Fabrication pages.
   *
   * Same "walk the real records directly, bypass allInstances" shape
   * `midWallBondBeamFabricationGroups` above already uses, and for the same
   * reason: a spanning header is a wall-level record, not a slot, so it has
   * no `PanelSlot` for the instance pipeline to walk. What it IS is a real
   * **header panel** — so its members are `buildBigHeaderMembers`, exactly
   * the geometry the Big Header panel type already has (chords, repeating
   * W-truss webs on both wythes, two jack studs), at its own derived span.
   * No new member geometry is invented here.
   *
   * Grouped by span + height, the "exact copies together" rule every other
   * fabricated part uses — two headers of the same size on different walls
   * are the same part to a shop. Each instance carries its OWN location note,
   * because the name does not: `H1` says nothing about where it goes.
   */
  const spanningHeaderFabricationGroups = useMemo(() => {
    const groups = new Map<
      string,
      { widthIn: number; heightIn: number; instances: { name: string; note: string }[] }
    >();
    for (const resolved of resolvedSpanningHeaders) {
      if (resolved.spanWidthIn <= 0) continue;
      const key = `${resolved.spanWidthIn.toFixed(3)}-${resolved.heightIn.toFixed(3)}`;
      const note = spanningHeaderCrossReference.locationByHeaderName.get(resolved.name) ?? "";
      const existing = groups.get(key);
      if (existing) existing.instances.push({ name: resolved.name, note });
      else groups.set(key, { widthIn: resolved.spanWidthIn, heightIn: resolved.heightIn, instances: [{ name: resolved.name, note }] });
    }
    return [...groups.entries()].map(([groupKey, { widthIn, heightIn, instances }]) => {
      const members = buildBigHeaderMembers(widthIn, thicknessIn, heightIn, false, jackStudConfig);
      const woodWeightKg = computeMemberSetWoodWeight(members).weightKg;
      const fastenerWeightKg = computeFastenerWeight(members).totalWeightLb / KG_TO_LB;
      const weightBreakdown: PanelWeightBreakdown = {
        // A header is a solid framed + braced assembly, not a straw-filled
        // cavity — the same call `midWallBondBeamFabricationGroups` makes for
        // its own Big Header kind, rather than a flat width x height x
        // density box that would invent straw this panel does not contain.
        strawOnlyWeightKg: 0,
        strawOnlyWeightLb: 0,
        components: [
          { label: "Wood (chords + W-braces + jack studs + plywood)", weightKg: woodWeightKg, weightLb: woodWeightKg * KG_TO_LB },
          { label: "Fasteners", weightKg: fastenerWeightKg, weightLb: fastenerWeightKg * KG_TO_LB },
        ],
        totalModeledWeightKg: woodWeightKg + fastenerWeightKg,
        totalModeledWeightLb: (woodWeightKg + fastenerWeightKg) * KG_TO_LB,
      };
      return { uniqueKey: `spanning-header-${groupKey}`, widthIn, heightIn, members, weightBreakdown, instances };
    });
  }, [resolvedSpanningHeaders, spanningHeaderCrossReference, thicknessIn, jackStudConfig]);

  /**
   * Spanning headers' own wood weight, added to the project total.
   *
   * A spanning header is a real fabricated panel with real members, so it
   * has to weigh something in the project's own total — a panel on a cut
   * list weighing zero is worse than one weighing approximately. Additive:
   * with no headers this is 0 and every existing project's total stays
   * byte-identical.
   *
   * **⚠ Two gaps it does NOT close, both in `totalWoodWeightKg` and both
   * pre-existing.** Named here because this line is the one a reader will take
   * as evidence that project wood weight is now right, and it is not:
   *
   * 1. **Mid-Wall Bond Beams are absent from it entirely** — it walks
   *    standard/braced SLOTS, and a beam is a wall-level record with no slot.
   * 2. **Every standard/braced slot is charged at FULL STORY HEIGHT**, so a
   *    panel shortened under a header (or under a beam, or by a max-panel
   *    height split) still contributes full-height wood, and this header's own
   *    weight is then added on top of it. A small OVER-count in the project
   *    total, in the opposite direction to (1).
   *
   * DOCUMENTED RATHER THAN FIXED, deliberately. The fabrication sheets are
   * already right — they build members at `heightOverrideIn`, the real band
   * height — so nothing that reaches a shop is wrong. Correcting the total
   * means running the band pipeline inside this sum, which changes the
   * displayed weight of every existing project that has a beam in it; that is
   * its own change with its own Review Log line, not a side effect of adding a
   * header. Same call this branch made about the Mid-Wall Bond Beam's 3D
   * anchor drift.
   */
  const spanningHeaderWoodWeightKg = useMemo(
    () =>
      spanningHeaderFabricationGroups.reduce(
        (sum, group) => sum + group.instances.length * computeMemberSetWoodWeight(group.members).weightKg,
        0,
      ),
    [spanningHeaderFabricationGroups],
  );
  const totalWeightKg = strawWeight.weightKg + totalWoodWeightKg + spanningHeaderWoodWeightKg;
  const totalWeightLb = totalWeightKg * KG_TO_LB;

  // Only surface pages that actually apply to what's currently selected/
  // drawn — a foundation detail page only if one exists for this type, a
  // panel type's Shop Drawing only if the current design actually has any
  // panels of that type (Tommy: "easily view the detail pages that are
  // relevant to the options currently selected").
  const relevantDetailPages = useMemo(() => {
    const pages: { id: string; label: string }[] = [];
    if (foundationEnabled && foundationType.loadPath.length > 0) {
      pages.push({ id: "detail-foundation", label: `Foundation: ${foundationType.label}` });
    }
    if (floorsEnabled && docFloorJoistType) {
      pages.push({ id: "detail-floor", label: `Floor: ${docFloorJoistType.label}` });
      pages.push({ id: "detail-floor-assembly", label: "Floor: Full Assembly" });
      pages.push({ id: "detail-floor-corner", label: "Floor: Corner & Perimeter Sequencing" });
      if (docPerpendicular2x4Enabled) {
        pages.push({ id: "detail-floor-addon", label: "Floor: Perpendicular 2x4 Add-On Layer" });
      }
    }
    if (floorsEnabled && isBaleFoundationFloor) {
      pages.push({ id: "detail-bale-foundation", label: "Floor: Bale Foundation" });
    }
    if (floorsEnabled && docIsThermalSlabFloor) {
      pages.push({ id: "detail-floor-thermal-slab", label: "Floor: Thermally Broken Slab" });
    }
    if (roofEnabled) {
      // Box beam is a per-wall choice now — a 2-story building with mixed
      // coverage genuinely needs both Detail Guide pages at once, not
      // strictly one or the other.
      if (stories.length === 1 || trussPlateWallLengthTotalIn > 0) {
        pages.push({ id: "detail-truss-plate", label: stories.length === 1 ? "Roof: Truss Plate (Single-Story)" : "Roof: Truss Plate" });
      }
      pages.push({ id: "detail-roof-truss-layout", label: "Roof: Truss Layout" });
      // Real per-wall roof-bearing Shop Fabrication pages — fabricator/
      // detailer documents, not public-facing (same gate panelFabricationGroups uses).
      if (role !== "public") {
        for (const group of roofBearingFabricationGroups) {
          pages.push({
            id: `shop-fab-${group.uniqueKey}`,
            label: `Panel Fabrication: ${group.kindLabel} ${group.lengthIn.toFixed(1)}in (${group.instances.length} walls)`,
          });
        }
      }
    }
    // Mid-Wall Bond Beam Shop Fabrication pages — independent of
    // roofEnabled (a beam can exist on either story regardless of the roof
    // system), placed here so every non-panel fabricator page (roof-
    // bearing + mid-wall) clusters together, ahead of the per-panel-type
    // entries further down (Tommy: "the other fabricator pages, lets make
    // these non-panel fabricator pages appear at the top of the fabricator
    // list").
    if (wallsEnabled && role !== "public") {
      for (const group of midWallBondBeamFabricationGroups) {
        const kindLabel = group.kind === "box-beam" ? "Box Beam" : "Big Header (Mid-Wall Beam)";
        pages.push({
          id: `shop-fab-${group.uniqueKey}`,
          label: `Panel Fabrication: ${kindLabel} ${group.lengthIn.toFixed(1)}in (${group.instances.length} walls)`,
        });
      }
      // Spanning headers (Stage 2b), beside the other wall-level fabricated
      // records. Counted in headers, not walls — one sheet can cover copies
      // on several walls, which is exactly why each carries its own location
      // line on the sheet itself.
      for (const group of spanningHeaderFabricationGroups) {
        pages.push({
          id: `shop-fab-${group.uniqueKey}`,
          label: `Panel Fabrication: Spanning Header ${group.widthIn.toFixed(1)}in (${group.instances.length})`,
        });
      }
      /* Floor and roof panels. Registered here rather than under the floor
         or roof gates above because they are panels: a building has them
         whether or not a joisted floor system or a truss roof is selected,
         and leaving them out of this list is what keeps a sheet out of both
         the tray and Export PDF — it renders, and nobody can reach it. */
      for (const group of floorRoofPanelFabricationGroups) {
        pages.push({
          id: `shop-fab-${group.key}`,
          label: `Panel Fabrication: ${group.kind === "floor" ? "Floor" : "Roof"} Panel ${group.widthIn.toFixed(2)}in (${group.instances.length})`,
        });
      }
    }
    // Box Beam's own Detail Guide page — the same assembly whether it's a
    // roofline roof-bearing member (2-story only, roof concern) or a
    // Mid-Wall Bond Beam (either story, wall concern) — so it's gated on
    // EITHER use existing, independent of roofEnabled/wallsEnabled.
    if ((roofEnabled && stories.length > 1 && boxBeamWallLengthTotalIn > 0) || midWallBeamWallLengthTotalIn > 0) {
      pages.push({ id: "detail-box-beam", label: "Box Beam" });
    }
    if (wallsEnabled) {
      if (footprint) {
        pages.push({ id: "detail-plan-view", label: "Plan View" });
      }
      pages.push({ id: "detail-material-totals", label: "Material Totals" });
      if (footprint && allInstances.length > 0) {
        pages.push({ id: "detail-shipping", label: "Shipping" });
      }
      // Engineer role's own reference card — real vapor-openness/permeance
      // (already computed for Project Totals below) plus the real
      // confirmed straw target moisture, consolidated in one place. No
      // R-value/fire-resistance row: no such spec data exists anywhere in
      // the catalog yet, so none is shown (see Engineer Lens plan).
      if (role === "engineer") {
        pages.push({ id: "detail-assembly-performance", label: "Assembly Performance" });
      }
      if (hasClayPlaster || hasLimePlaster || hasSteelClaySkin) {
        pages.push({ id: "detail-plaster-master", label: "Plaster Master" });
      }
      // Rough Opening Detail pages (Tommy: "We are going to make a Rough
      // Opening Detail page, so we can keep track of window and door
      // needs... lets do them on two separate rough opening pages") — like
      // Foundation/Floor, general reference content, not fabricator-only.
      if (allInstances.some((i) => i.sourceSlotType === "door") || canPreviewAllDetailPages) {
        pages.push({ id: "detail-door-ro", label: "Door Rough Opening" });
      }
      if (allInstances.some((i) => i.sourceSlotType === "window") || canPreviewAllDetailPages) {
        pages.push({ id: "detail-window-ro", label: "Window Rough Opening" });
      }
      // Shop Drawings are a fabricator/detailer document, not a public-facing one (Tommy).
      if (role !== "public") {
        // Jack-Stud: no real placed instances yet (a real rough-opening
        // height isn't tracked) — keep the single preview-only page. Gable
        // now has real per-tile instances (see allPanelInstances'
        // gableTilesByWallId) and flows through panelFabricationGroups
        // like every other type, below.
        for (const { panelType, instances } of shopDrawings) {
          if (panelType.id !== "jack-stud") continue;
          if (instances.length > 0 || canPreviewAllDetailPages) {
            pages.push({ id: `shop-${panelType.id}`, label: `Shop Drawing: ${panelType.label} (${instances.length})` });
          }
        }
        // Every other type: one page per unique panel (exact copies grouped together).
        for (const group of panelFabricationGroups) {
          const label =
            group.panelType.id === "braced" && group.bracedPattern !== undefined && group.bracedMirrored !== undefined
              ? bracedPanelDisplayLabel(group.bracedPattern, group.bracedMirrored)
              : group.panelType.label;
          pages.push({
            id: `shop-fab-${group.uniqueKey}`,
            label: `Panel Fabrication: ${label} ${group.widthIn}in (${group.instances.length} copies)`,
          });
        }
      }
    }
    return pages;
  }, [
    foundationType,
    docFloorJoistType,
    docIsThermalSlabFloor,
    docPerpendicular2x4Enabled,
    stories,
    trussPlateWallLengthTotalIn,
    boxBeamWallLengthTotalIn,
    boxBeamSizeId,
    midWallBeamWallLengthTotalIn,
    midWallBondBeamFabricationGroups,
    spanningHeaderFabricationGroups,
    floorRoofPanelFabricationGroups,
    shopDrawings,
    panelFabricationGroups,
    roofBearingFabricationGroups,
    role,
    canPreviewAllDetailPages,
    allInstances,
    footprint,
    hasClayPlaster,
    hasLimePlaster,
    hasSteelClaySkin,
    floorsEnabled,
    roofEnabled,
    wallsEnabled,
    foundationEnabled,
    bracingStyle,
  ]);

  // Tommy: "are there any features or text that i may be missing?" — a
  // short per-tab pointer, mainly toward controls that live outside this
  // sidebar (Foundation/Floor/Roof keep almost all of their real inputs in
  // the "<Tab> Tools" section further down the page, not in this sidebar at
  // all) — see PageFeaturesButton's own doc comment.
  const pageFeatures: Record<EditorTab, string[]> = {
    wall: [
      "Draw: Rectangle or Octagon, then click-drag on the canvas. Add Second Story / Add Bump-out for more complex shapes. Drawing a shape (or adding a bump-out) switches to Edit mode automatically.",
      "Edit mode (plan view): click a panel to cycle its type (standard → window → door → column → standard). See the legend to the left for what each panel color means — a panel hashed orange over purple is a safety/gap panel combined with a corner brace (both roles, one panel). Panel labels are named by compass direction (N/NE/E/SE/S/SW/W/NW — up is treated as North).",
      "On an all-right-angle footprint, click a corner marker to mark it least-accessible — safety/gap panels re-place to the far end of each wall (this also clears any openings you've placed, since re-tiling re-derives all slots). On a mitered footprint, every wall owns its own mitered corner panels — the left-most corner of each run is automatically the safety-oct-corner, no marker to set.",
      "Click a wall's own length label to type an exact value (editing one wall resizes the whole rectangle, since opposite walls stay equal — on a mitered shape only the straight walls are editable this way), or switch to Drag Wall and drag a wall directly instead of typing a length.",
      "Bump-out tool: drag along a wall to pick the span it attaches to, then drag outward (an addition) or inward (a notch) to set the depth. Drag Wall tool: drag a wall to move it — its 2 neighbor walls stretch or shrink to absorb the change, everything else stays fixed.",
      "Switch to 3D (top toggle) for Orbit / Edit / Sill & Header tools — every wall panel, including window/door openings (header, jack studs, and sill), shows its real member geometry at its actual position and width. No roof surface yet.",
      "Use the view arrows (top-left) to open a wall's own elevation view — toggle \"Add Gable End\" or \"Add Layer\" (second story) per wall from there.",
      "Wall Assembly, Project Summary, Project Totals, Review Log, and every Detail Guide/Shop Drawing page live in the toggleable sections further down — not just this sidebar.",
    ],
    foundation: [
      "Foundation TYPE itself is set from the top bar's \"Zip code / seismic zone / foundation type\" button, not this tab.",
      "Pier spacing (when the foundation type uses a pier grid) is the only input here.",
      "Full load-path detail, fastener schedule, and pier count live in \"Foundation Tools\" / the Detail Guide pages further down the page.",
    ],
    floor: [
      "No direct inputs here — floor panels/joists are derived automatically from the foundation's own pier grid and spacing (set on the Foundation tab).",
      "Full rim-joist/thermal-break detail lives in \"Floor Tools\" / the Detail Guide pages further down the page.",
    ],
    roof: [
      "Roofline profile: Peaked (1 point) or Flat-top (2 points), ridge height (typed or picked by slope) — each point is independently draggable per wall, from that wall's own elevation view.",
      "Max Gable End Panel height, Heel height (energy-heel truss seat), and the truss/beam bottom-edge inset are all set here.",
      "\"Add Gable End\" itself is toggled per-wall from that wall's own elevation view (Wall tab), not here.",
    ],
  };

  // Sticky-note sections (Tommy: "the other sections... appear as its own
  // sticky note on the screen... make sure we aren't hiding any options") —
  // every section that used to be its own always-visible StrawSection in
  // the scrolling document is now an entry here, opened/closed via the
  // bottom SectionCarousel. `formalDocumentNoteIds` is the subset "Print
  // Packet" covers (the actual printable sheets — Project Summary + every
  // Detail Guide/Shop Drawing page — not the live editing panels like
  // Project Totals/Review Log). "Windows" used to be one of these too, but
  // its per-window controls moved into the click-driven "Selected Panel"
  // note (see selectedSlot/handleToggleOpening) — not part of this
  // carousel list at all, since its visibility is driven by selection
  // state rather than being manually toggled open/closed. The old "Wall
  // Tools" note (relabeling itself per editor tab) is gone too — its
  // Foundation/Floor/Roof branches were already dead once their own
  // content moved into each tab's own left sidebar (see
  // foundationControls/floorToolsControls/roofToolsControls), and its
  // remaining Wall-tab content (Tommy: "Wall Tools info page content
  // should be worked into the question mark") now lives in the "?"
  // button's own pageFeatures.wall instead. "Wall Assembly" is gone from
  // here too — its content moved into wallAssemblyControls, the Wall tab's
  // own left sidebar while viewing the Membranes (3D Wraps) stop (Tommy:
  // "work the contents of the Wall Assembly into the editor tab on the
  // left when working on 3D Wraps").
  /* U4.2 — WHERE EVERY SECTION RENDERS, answered in one place.

     Declared after `formalDocumentNoteIds` below via a function that reads
     it, not before: `hostSurfaceForSection` is a pure function of (id,
     surface, formal ids), so the provider can be built from live values
     without any of the three being copied. */
  const allNoteSections = useMemo(
    () => [
      { id: "detail-summary", label: "Project Summary" },
      { id: "project-totals", label: "Project Totals" },
      { id: "review-log", label: "Review Log" },
      ...relevantDetailPages,
    ],
    [relevantDetailPages],
  );
  const formalDocumentNoteIds = useMemo(
    () => new Set(["detail-summary", ...relevantDetailPages.map((p) => p.id)]),
    [relevantDetailPages],
  );
  const [openNoteIds, setOpenNoteIds] = useState<Set<string>>(new Set());
  const [noteOpenOrder, setNoteOpenOrder] = useState<string[]>([]);
  /** Every section that is open RIGHT NOW, for whatever reason — the tray
   * opened it, or the page it belongs to is showing.
   *
   * ⚠ **THIS EXISTS BECAUSE U4.2 BROKE TWO THINGS AND THE HARNESS CAUGHT
   * THEM.** Opening a section via the page was a SECOND channel that
   * `openNoteIds` knew nothing about, and two behaviours were keyed on
   * `openNoteIds`:
   *
   *   1. `captureLive` — the 3D render the Project Summary sheet shows. The
   *      Summary page came up with **no rendering on it at all**, because
   *      the capture was still waiting for a note the tray had never
   *      opened. `summary-capture` went 3/4 and said exactly that.
   *   2. `openDetailPageIds`, which is `effectiveExportIds`' default —
   *      *"whatever is currently open"*. So **Export PDF on the Print page
   *      would have offered the sheets the TRAY had open**, which on a
   *      fresh visit is none.
   *
   * So "is this section open" gets ONE answer, derived from the same
   * `hostSurfaceForSection` that decides the rendering. They cannot drift
   * because there is nothing to drift from.
   *
   * ⚠ Returns `openNoteIds` ITSELF on the drawing surface, not a copy. A
   * fresh Set every render changes identity for every memo downstream — the
   * same bug that once made one draw take two undos. */
  const effectivelyOpenNoteIds = useMemo(() => {
    if (editorSurface === "drawing") return openNoteIds;
    const next = new Set(openNoteIds);
    for (const section of allNoteSections) {
      if (hostSurfaceForSection(section.id, editorSurface, formalDocumentNoteIds) !== null) next.add(section.id);
    }
    return next;
  }, [openNoteIds, editorSurface, allNoteSections, formalDocumentNoteIds]);

  /** The provider `StickyNote` reads. One object, two questions, and the
   * partition itself lives in `sectionSurfaces.ts` with its tests. */
  const sectionSurface: SectionSurfaceValue = useMemo(
    () => ({
      hostFor: (sectionId) => {
        const owner = hostSurfaceForSection(sectionId, editorSurface, formalDocumentNoteIds);
        if (owner === "summary") return summaryHostEl;
        if (owner === "print") return printHostEl;
        return null;
      },
      // The same set the capture and the export default read, so a section
      // cannot be visibly open while those two believe it is closed.
      opensOnItsPage: (sectionId) => effectivelyOpenNoteIds.has(sectionId),
    }),
    [editorSurface, formalDocumentNoteIds, summaryHostEl, printHostEl, effectivelyOpenNoteIds],
  );
  /** ⚠ TOMMY'S CONDITION FOR DELETING THE TRAY, 2026-10-11: *"As long as
   * everything is included in the tabs above, let's delete it."* Computed
   * against the LIVE derived list rather than checked by eye, because
   * `relevantDetailPages` differs per building and the section that only
   * exists on some buildings is exactly the one an eye would miss. U5.2 is
   * not allowed to remove the tray while this is non-empty. */
  const sectionsNoPageCanReach = useMemo(
    () => unreachableSections(allNoteSections.map((s) => s.id), formalDocumentNoteIds),
    [allNoteSections, formalDocumentNoteIds],
  );
  const [fullscreenNoteId, setFullscreenNoteId] = useState<string | null>(null);

  // A link from elsewhere (Tommy: "review logs button... at the bottom of
  // the report bug page") can deep-link straight to one note via
  // ?openNote=<id> — read directly off window.location instead of
  // useSearchParams so this stays a plain client-side effect with no
  // Suspense-boundary requirement. Runs once on mount only.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("openNote");
    if (!id) return;
    setOpenNoteIds((was) => new Set(was).add(id));
    setNoteOpenOrder((order) => (order.includes(id) ? order : [...order, id]));
  }, []);

  const handleToggleNote = (id: string) => {
    setOpenNoteIds((was) => {
      const next = new Set(was);
      if (next.has(id)) {
        next.delete(id);
        setNoteOpenOrder((order) => order.filter((o) => o !== id));
        if (fullscreenNoteId === id) setFullscreenNoteId(null);
      } else {
        next.add(id);
        setNoteOpenOrder((order) => [...order, id]);
      }
      return next;
    });
  };

  const handleToggleNoteFullscreen = (id: string) => {
    setFullscreenNoteId((was) => (was === id ? null : id));
  };

  const handlePrintNote = (id: string) => {
    const go = () => {
      document.body.setAttribute("data-print-mode", "page");
      document.getElementById(id)?.setAttribute("data-print-target", "true");
      window.print();
    };
    // The Summary's image is captured on a 300ms settle while its note is
    // open, so printing straight after an edit could put the previous
    // design on paper. Take one fresh capture first — a printed drawing is
    // the last place a stale picture should be allowed to reach.
    if (id === "detail-summary") requestCaptureThen(go);
    else go();
  };

  // Tommy: "at the top of the right bar, lets make an export pdf button for
  // all of the highlighted/opened detail pages" — later expanded ("Let me
  // pick which sections to export") to a checklist the user can override.
  // `exportableSections` is every page "Choose sections" can offer;
  // `manualExportIds` is null until the user checks/unchecks anything in
  // the picker (defaulting to "whatever's currently open", the original
  // behavior) — once touched, it's an explicit set that no longer tracks
  // openNoteIds automatically.
  const openDetailPageIds = useMemo(
    // ⚠ `effectivelyOpenNoteIds`: this feeds `effectiveExportIds`, whose
    // default is *"whatever is currently open"*. Read off the tray alone, the
    // Print page's own Export PDF would have offered nothing.
    () => [...effectivelyOpenNoteIds].filter((id) => formalDocumentNoteIds.has(id)),
    [effectivelyOpenNoteIds, formalDocumentNoteIds],
  );
  const exportableSections = useMemo(
    () => [{ id: "detail-summary", label: "Project Summary" }, ...relevantDetailPages],
    [relevantDetailPages],
  );
  const [manualExportIds, setManualExportIds] = useState<Set<string> | null>(null);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const effectiveExportIds = manualExportIds ?? new Set(openDetailPageIds);

  // Revives/generalizes the old handlePrintPacket's "silently open whatever
  // isn't already mounted, print, restore the prior open state" pattern —
  // now driven by the checked set instead of unconditionally every formal
  // document.
  const handleExportSelectedPdf = () => {
    const ids = effectiveExportIds;
    if (ids.size === 0) return;
    const wasOpen = new Set(openNoteIds);
    const needsOpening = [...ids].some((id) => !openNoteIds.has(id));
    const doExport = () => {
      for (const id of ids) document.getElementById(id)?.setAttribute("data-print-target", "true");
      // Mark the LAST target in document order, so the packet's "no page
      // break after the final section" print rule (globals.css) has an
      // explicit element to match. That rule used to try to find it in CSS
      // with `:last-of-type`, which matches the last element of its element
      // *type* among its siblings -- not the last element matching the rest
      // of the selector. Sticky notes are `div`s among many other sibling
      // `div`s emitted from several separate `.map()` groups, so it never
      // matched and every packet export ended with a trailing blank page.
      // querySelectorAll returns document order.
      const printTargets = document.querySelectorAll("[data-print-target]");
      printTargets[printTargets.length - 1]?.setAttribute("data-print-last", "true");
      document.body.setAttribute("data-print-mode", "packet");
      window.print();
      if (needsOpening) setOpenNoteIds(wasOpen);
    };
    // ⚠ The Summary's capture is dormant while its note is closed, and this
    // is the one path that needs the image without anybody looking at it —
    // it opens the sections, prints, and closes them again. Ask for a
    // capture and print when it lands, or the packet gets whatever PNG
    // happened to be left over from the last time the note was open.
    const run = () => {
      if (ids.has("detail-summary")) requestCaptureThen(doExport);
      else doExport();
    };
    if (needsOpening) {
      setOpenNoteIds((was) => new Set([...was, ...ids]));
      requestAnimationFrame(run);
    } else {
      run();
    }
  };

  // In-app Letter/Tabloid choice (Tommy: "in-app page size choice") — the
  // named @page rules (globals.css) key off this body attribute, since a
  // named page can only be assigned via the standard `page` CSS property on
  // an ordinary selector, not by conditionally selecting @page itself.
  const [printPageSizeId, setPrintPageSizeId] = useState<"letter" | "tabloid">("letter");
  useEffect(() => {
    document.body.setAttribute("data-print-page-size", printPageSizeId);
  }, [printPageSizeId]);

  useEffect(() => {
    const onAfterPrint = () => {
      document.body.removeAttribute("data-print-mode");
      for (const section of document.querySelectorAll("[data-print-target]")) {
        section.removeAttribute("data-print-target");
      }
      for (const section of document.querySelectorAll("[data-print-last]")) {
        section.removeAttribute("data-print-last");
      }
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  // The markup only applies for fabricator/admin — public viewers always
  // see the base material cost (Tommy).
  //
  // STAGE 4B: `—` WHATEVER THE VIEWER ROLE. `role === "public" ? 1 : …` would
  // otherwise show a browsing viewer in the public role a real base price on
  // someone else's sheet, which reads as "their price". Decision 21 lets them
  // compute it themselves from published rates; the app does not present it as
  // the owner's number. So while browsing this is NaN, and it is NaN rather
  // than 0 or 1 on purpose: every price display is gated on `costsRedacted`
  // below, and if a gate is ever missed the screen reads `$NaN` — obviously
  // broken — instead of a confident figure built from a defaulted markup.
  const costsRedacted = documentSession.browseContext !== null;
  const effectivePriceModifier = costsRedacted ? Number.NaN : role === "public" ? 1 : priceModifier;

  const price = useMemo(() => {
    // Height-dependent (area = width x height), so — like strawWeight/
    // totalWoodWeightKg above — this sums each story's own contribution
    // against that story's own wallHeightFt, not one flat height applied to
    // every story's slots.
    const areaSqFtFor = (type: PanelSlot["type"]) =>
      stories.reduce((sum, story) => {
        const widthIn = Object.values(story.wallSlots)
          .flat()
          .filter((s) => s.type === type)
          .reduce((s2, s) => s2 + s.widthIn, 0);
        return sum + (widthIn / 12) * story.wallHeightFt;
      }, 0);
    // Corner panels wrap the building's outside corner — besides their own
    // "bigger" flat face (widthIn x height, counted above), each one also
    // closes the corner with a return leg the panel's own thickness deep.
    // That return leg's face (thicknessIn x height) is real priced area too
    // (Tommy: "we also include one side of the panelwidth in the price
    // calculation"), counted once per corner panel — every corner panel
    // sits at a true wall-run end by construction, so no separate
    // end-detection is needed.
    const cornerEdgeAreaSqFtFor = (type: PanelSlot["type"]) =>
      stories.reduce((sum, story) => {
        const count = Object.values(story.wallSlots)
          .flat()
          .filter((s) => s.type === type).length;
        return sum + count * (thicknessIn / 12) * story.wallHeightFt;
      }, 0);

    // Gable End Panels weren't priced at all before — trapezoid face area
    // (width x average local height above the eave), the same local-height
    // basis buildGablePanelMembers itself uses. A tile's own isSafetyGap
    // flag means it built via buildSafetyGapMembers instead — the exact
    // same member a wall-level safety-gap panel uses — so it's priced at
    // the standard rate, matching that existing precedent, using the same
    // taller-edge height basis buildSafetyGapMembers itself is called with.
    // Any vertical-gap overflow filler (a real gable's rise exceeding the
    // 8ft panel cap) stacks additively on whichever tile it belongs to, so
    // it's priced at that same tile's own rate. Clamped at 0 as a pure
    // defensive floor now that roofProfilePointHeightsFt is itself
    // eave-relative (see its own doc comment) — a panel physically can't
    // have negative height, so this only bites a degenerate/negative
    // manually-typed rise, not the normal case.
    let gableRoofAreaSqFt = 0;
    let gableStandardAreaSqFt = 0;
    for (const tiles of Object.values(gableTilesByWallId)) {
      for (const t of tiles) {
        const localLeftIn = Math.max(0, t.leftEdgeHeightIn - gableEaveHeightIn);
        const localRightIn = Math.max(0, t.rightEdgeHeightIn - gableEaveHeightIn);
        // Trapezoid average of each edge's own real gap (either can be 0 —
        // the common straddling-the-cap case, a triangular filler, not a
        // uniform rectangle) — mirrors the base tile's own area formula
        // just below, more accurate than the old single-flat-height guess
        // now that the 2 edges can legitimately differ.
        const overflowAreaSqFt =
          (t.widthIn / 12) * (((t.verticalGapIn?.leftIn ?? 0) + (t.verticalGapIn?.rightIn ?? 0)) / 2 / 12);
        if (t.isSafetyGap) {
          gableStandardAreaSqFt += (t.widthIn / 12) * (Math.max(localLeftIn, localRightIn) / 12) + overflowAreaSqFt;
        } else {
          gableRoofAreaSqFt += (t.widthIn / 12) * ((localLeftIn + localRightIn) / 2 / 12) + overflowAreaSqFt;
        }
      }
    }

    // Box Beam/Truss Plate (roofline bearing) and Mid-Wall Bond Beams are
    // linear members, not flat wall panels, so there's no natural
    // "width x wall height" face — priced instead by each group's own
    // elevation face (its real covered length x its own assembly's
    // cross-sectional height), the same width-x-height sqft convention
    // every panel above uses, just with the beam's own dimensions.
    const roofBearingAreaSqFt = roofBearingFabricationGroups.reduce((sum, g) => sum + (g.lengthIn / 12) * (g.heightIn / 12), 0);
    const midWallBeamAreaSqFt = midWallBondBeamFabricationGroups.reduce((sum, g) => sum + (g.lengthIn / 12) * (g.heightIn / 12), 0);
    // A spanning header is a real fabricated panel, so it is priced —
    // otherwise a wall that gained one would show no change in cost at all.
    // Its own elevation face (derived span x its own height), the same
    // width-x-height convention every entry here uses.
    //
    // **Priced at the header/sill ("opening") rate — TOMMY'S DECISION,
    // 2026-09-25**, asked directly what rate a spanning header carries. It
    // stopped being this code's assumption on that date.
    //
    // ⚠ What he settled is WHICH EXISTING RATE APPLIES. It does not promote
    // any catalog value's status: the header/sill rate is exactly as
    // confirmed (or not) as it was before, and nothing in
    // `packages/panel-catalog` moves because of this line.
    //
    // ⚠ And it is deliberately NOT consistent with its nearest neighbour: the
    // mid-wall Big Header BEAM is priced at the `roof` rate two lines down.
    // Two spanning things, two different rates, by decision rather than by
    // oversight — which is why the Review Log entry says so in words, since
    // that is what reaches the engineer.
    const spanningHeaderAreaSqFt = spanningHeaderFabricationGroups.reduce(
      (sum, g) => sum + g.instances.length * (g.widthIn / 12) * (g.heightIn / 12),
      0,
    );

    return computePrice(
      [
        // No distinct rate given for safety/gap panels — priced at the standard rate (assumption, see Review Log).
        { type: "standard", areaSqFt: areaSqFtFor("standard") + areaSqFtFor("safety-gap") + gableStandardAreaSqFt },
        // safety-oct-corner is a fabrication-ID variant of the same corner panel, priced identically.
        {
          type: "corner",
          areaSqFt:
            areaSqFtFor("corner") +
            areaSqFtFor("safety-oct-corner") +
            cornerEdgeAreaSqFtFor("corner") +
            cornerEdgeAreaSqFtFor("safety-oct-corner"),
        },
        { type: "braced", areaSqFt: areaSqFtFor("braced") },
        { type: "opening", areaSqFt: areaSqFtFor("window") + areaSqFtFor("door") + spanningHeaderAreaSqFt },
        { type: "column", areaSqFt: areaSqFtFor("column") },
        { type: "roof", areaSqFt: gableRoofAreaSqFt + roofBearingAreaSqFt + midWallBeamAreaSqFt },
      ],
      effectivePriceModifier,
    );
  }, [
    stories,
    effectivePriceModifier,
    thicknessIn,
    gableTilesByWallId,
    gableEaveHeightIn,
    roofBearingFabricationGroups,
    midWallBondBeamFabricationGroups,
    spanningHeaderFabricationGroups,
  ]);

  const carbonRange = useMemo(
    () =>
      computeCarbonRange(strawWeight.weightKg, strawMoistureContent, carbonFractionOfDryMass.value),
    [strawWeight.weightKg],
  );

  // Net CO2e running total: straw's sequestered carbon is a credit
  // (positive), concrete's embodied emissions are a debit (negative) —
  // only concrete-pier foundations contribute a debit today (Tommy).
  const embodiedCarbon = useMemo(
    () =>
      computeNetEmbodiedCarbonCO2e(
        carbonRange.atStandardMoisture.carbonKg,
        concretePierVolumeFt3,
        concreteEmbodiedCarbonKgPerFt3.value,
      ),
    [carbonRange.atStandardMoisture.carbonKg, concretePierVolumeFt3],
  );

  // Carbon Sequestered section (Tommy: "the equasion and output for total
  // weight of straw at 15% moisture content converted into lbs of CO2e and
  // its respective conversions") — straw-only (not netted against
  // concrete, unlike embodiedCarbon above), EPA equivalency conversions of
  // that same straw CO2e credit.
  const co2eEquivalencies = useMemo(() => computeCO2eEquivalencies(embodiedCarbon.strawCO2eKg), [embodiedCarbon.strawCO2eKg]);

  const permResult = useMemo(() => computeAssemblyPerm(interior, exterior, season), [interior, exterior, season]);
  const vaporCheck = useMemo(
    () => validateVaporOpenness(interior, exterior, season),
    [interior, exterior, season],
  );

  // Reported, never refused, and never at load: a stored design containing a
  // panel narrower than the shop minimum opens and prints exactly as before,
  // and shows up here instead. Both stories, since a second-story wall is
  // fabricated by the same shop.
  const subMinimumPanels = useMemo(
    () => [
      ...findSubMinimumPanelWidths(baseWallSlots, fabricationMinPanelWidthIn.value).map((p) => ({ ...p, story: "ground" as const })),
      ...findSubMinimumPanelWidths(secondStory?.wallSlots ?? {}, fabricationMinPanelWidthIn.value).map((p) => ({
        ...p,
        story: "second" as const,
      })),
    ],
    [baseWallSlots, secondStory],
  );

  // Walls in the 51in-75.5in two-corner band, whose corner PAIR absorbed a
  // middle too small to hold a legal panel (see `resolveCorners`). The wall
  // is legal — that is the whole point of the fix — but its corner panels are
  // off their nominal 25.5in width, and `cornerPanelWidthIn` is a confirmed
  // catalog value describing a specific piece of construction. Tommy
  // confirmed the corner-geometry ROUTE for this band, not the individual
  // widths it produces, so the engineer reading the Review Log sees them.
  const absorbedCornerWalls = useMemo(
    () => [
      ...findAbsorbedCornerWalls(baseWallSlots, cornerWidthInForTiling).map((w) => ({ ...w, story: "ground" as const })),
      ...findAbsorbedCornerWalls(secondStory?.wallSlots ?? {}, cornerWidthInForTiling).map((w) => ({
        ...w,
        story: "second" as const,
      })),
    ],
    [baseWallSlots, secondStory, cornerWidthInForTiling],
  );

  // Corner ends whose CORNER-BRACE COMBINE was refused — the same situation as
  // `absorbedCornerWalls` above and the same answer. The combine now refuses
  // rather than break the wall's own length (2026-09-29, Tommy: "this app needs
  // to be perfectly tight with dimensions and wall lengths"), which is right;
  // but the refusal moves a STRUCTURAL placement derived from two
  // `pending-BI-confirmation` values, and on some walls it leaves one braced
  // panel serving both corners where Tommy's rule asks for one per corner. The
  // wall is legal. That is exactly why nobody would otherwise see it.
  const cornerBraceCombineRefusals = useMemo(
    () => [
      ...findCornerBraceCombineRefusals(baseWallSlots).map((r) => ({ ...r, story: "ground" as const })),
      ...findCornerBraceCombineRefusals(secondStory?.wallSlots ?? {}).map((r) => ({ ...r, story: "second" as const })),
    ],
    [baseWallSlots, secondStory],
  );

  // Hand-set panel widths (`lockedWidthIn`) their own wall can no longer pay
  // for. Since 2026-09-30 the re-force is REFUSED rather than applied — Tommy's
  // decision, and the wall's own length is exact because of it — but the panel is
  // then fabricated at the tiler's width and not the one somebody typed or
  // dragged, which is a difference nobody can see from the drawing. Same
  // situation and same answer as `cornerBraceCombineRefusals` directly above:
  // the wall is legal, which is exactly why this needs the Review Log.
  const unhonouredLockedWidths = useMemo(
    () => [
      ...findUnhonouredLockedWidths(baseWallSlots).map((r) => ({ ...r, story: "ground" as const })),
      ...findUnhonouredLockedWidths(secondStory?.wallSlots ?? {}).map((r) => ({ ...r, story: "second" as const })),
    ],
    [baseWallSlots, secondStory],
  );

  /**
   * **⚠ One entry per Square Bale wall whose ONLY panel is a corner slot off the
   * confirmed 39in bale width** — the part Tommy said cannot be built. Usually
   * that is a two-corner wall whose corners the tiler merged; a wall owning ONE
   * corner, shorter than a single bale corner, produces the same single-slot
   * shape by clamping, and this walk cannot tell the two apart. See
   * `findSquareBaleMergedCorners`, whose note is worded for both.
   *
   * **Why this exists alongside the refusal, and not instead of it.** The
   * panelization control refuses the band, and refuses a merged corner **over
   * 48in** (*"Yes — refuse both cases too."*, narrowed by Tommy to *"only refuse
   * over 48 inches."*). But this app refuses at the point of EDIT and never at
   * load, and one path never touches that control: someone already in Square
   * Bale who *draws* a small octagon, or shortens a wall under 78in. The band
   * case at least leaves a visible sub-minimum middle that
   * `findSubMinimumPanelWidths` reports; a merged corner is over the maximum,
   * and **this app has no over-maximum panel reporter at all**, so that path was
   * completely silent. Adding the refusal without this walk would have made the
   * app quieter than before on exactly the path the refusal cannot see.
   *
   * **⚠ This walk is NOT narrowed to 48in the way the refusal is**, and that is
   * deliberate: a merged bale corner inside the ceiling is still not a whole-bale
   * unit, so the narrowing makes it *permitted and reported* rather than
   * permitted. Narrowing this too would turn his decision about refusing into a
   * decision about telling anyone, which he was not asked.
   *
   * Gated on Square Bale. The plywood merged corner is its own open question —
   * see the spec's `## Open Items`, **"The PLYWOOD merged corner between 48in and
   * 51in is over the 48in ceiling and nothing reports it"** — and starting to
   * report it here would be a behaviour change nobody asked for.
   *
   * Reads `cornerWidthInForTiling` — the width the stored slots were actually
   * tiled at — rather than `squareBalePanel.widthIn` directly, so it describes
   * what is on screen rather than what a fresh retile would produce.
   */
  const squareBaleMergedCornerReviewEntries = useMemo(() => {
    if (!isSquareBalePanelization) return [];
    const format = (valueIn: number) => formatLengthIn(valueIn, unitSystem);
    return [
      ...findSquareBaleMergedCorners(baseWallSlots, cornerWidthInForTiling).map((w) => ({ report: w, story: "ground" as const })),
      ...findSquareBaleMergedCorners(secondStory?.wallSlots ?? {}, cornerWidthInForTiling).map((w) => ({
        report: w,
        story: "second" as const,
      })),
    ].map(({ report, story }) => ({
      // "one corner panel", not "one MERGED corner": the clamped one-corner wall
      // reaches this same shape without anything being merged. The label must be
      // true of both shapes for the same reason the note is.
      label: `⚠ Square Bale corner panel the shop cannot build: wall ${report.wallId}${story === "second" ? " (second story)" : ""} — the whole wall is one corner panel ${format(report.mergedWidthIn)} wide`,
      status: "pending-BI-confirmation" as const,
      note: squareBaleMergedCornerNote(report, cornerWidthInForTiling, panelWidthInRange.maxIn, format),
    }));
  }, [isSquareBalePanelization, baseWallSlots, secondStory, cornerWidthInForTiling, unitSystem]);

  /**
   * One Review Log entry per wall carrying an unbuilt span.
   *
   * **A wall that stops short is by definition an incomplete design**, and
   * the engineer reading the Review Log is exactly the person who must not
   * find that out from the drawing alone. `pending-BI-confirmation` is the
   * only non-confirmed status the log has, and it is the honest one here:
   * the entry is not claiming a value needs sourcing, it is claiming this
   * design is not finished — the same way the sub-minimum-panel entries
   * above use it for a condition rather than for a number.
   *
   * A stop that had to be CLAMPED (stored inches that no longer fit the
   * wall, most likely because the wall was shortened afterwards) says so in
   * its own sentence rather than being quietly absorbed.
   */
  const wallRunStopReviewEntries = useMemo(() => {
    if (!footprint) return [];
    const entries: { label: string; status: "pending-BI-confirmation"; note: string }[] = [];
    for (const wall of footprint.walls) {
      if (!hasWallRunStop(wallRunStopsByWallId[wall.id])) continue;
      const geometry = wallGeometryFor(wall.id);
      if (!geometry) continue;
      const direction = wallCompassDirection(wall, footprint);
      const spans: string[] = [];
      if (geometry.startStopIn > 0) spans.push(`${formatLengthIn(geometry.startStopIn, unitSystem)} at the start end`);
      if (geometry.endStopIn > 0) spans.push(`${formatLengthIn(geometry.endStopIn, unitSystem)} at the far end`);
      const totalIn = geometry.startStopIn + geometry.endStopIn;
      // **An opening the unbuilt span swallowed is named here, on every
      // story it happened on.** A reviewer reading a drawing of a stopped
      // wall cannot tell a window that was never drawn from one that was
      // drawn and then set aside, and the difference is the whole point of
      // Tommy's "drop them, and remember": it is coming back the moment the
      // stop does. Silence here would make a non-destructive decision look
      // like a deletion.
      //
      // ⚠ The sentence is composed in `runStopNotices.ts`, and whether
      // it may say "exactly as drawn" comes from `runStopRestoreFidelity` —
      // the geometry's own answer, read off this story's CURRENT openings.
      // Promising exactness where the merge cannot deliver it is the defect
      // that module exists to stop; see runStopOpenings.ts.
      /* ⚠ Reads the STOPPED SLOTS, not the old anchor memory. Stage 4d moved
         run stops off the re-tile, so nothing writes that memory for a stop
         any more — and `runStopRestoreFidelity` answers "nothing-withheld"
         for an absent one, so this entry silently reported ZERO withheld
         openings on a wall whose stop had swallowed a window. */
      const withheldByStory: WithheldOpeningsOnStory[] = stories.map((s) => {
        const held = stoppedSlotsByStoryAndWallId[s.id]?.[wall.id];
        return {
          story: s.id,
          count: withheldOpeningCount(held),
          fidelity: stoppedSlotsRestoreFidelity(held),
        };
      });
      const withheldSentence = withheldOpeningsReviewNote(withheldByStory);
      entries.push({
        label: geometry.fullyStopped
          ? `Wall ${direction} is not built at all (${wall.id})`
          : `Wall ${direction} stops short — ${formatLengthIn(totalIn, unitSystem)} unbuilt (${wall.id})`,
        status: "pending-BI-confirmation" as const,
        note:
          (geometry.fullyStopped
            ? `The whole ${formatFeetInches(wall.lengthFt)} of this edge carries no panels — it is an edge of the building with no wall of ours on it. The footprint polygon still closes through it, so the floor, foundation and roof all still reach this line; only the panel run is absent. Nothing is drawn here in 3D, and no panel, price, weight or cut-list line comes from it.${geometry.stopClamped ? " The stored stop was longer than the wall and was reduced to fit — check it against the drawing." : ""}`
            : `${spans.join(" and ")} of this ${formatFeetInches(wall.lengthFt)} wall is deliberately not panelized${geometry.hasCornerStart && geometry.hasCornerEnd ? "" : ", and the corner panel at a stopped end is not built either"}. The remaining ${formatLengthIn(geometry.lengthIn, unitSystem)} is panelized normally. The footprint stays closed, so floor, foundation and roof still reach the full wall line — this is an incomplete PANEL RUN, not an incomplete shape, and it needs a reviewer's eye for that reason.${geometry.stopClamped ? " The stored stop no longer fits this wall and was reduced to fit — check it against the drawing." : ""}`) +
          withheldSentence,
      });
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wallGeometryFor is a per-render partial application; its inputs are listed
  }, [
    footprint,
    wallRunStopsByWallId,
    unbuiltOpeningsByStoryAndWallId,
    stories,
    primaryCornerIds,
    leastAccessibleCorner,
    thicknessIn,
    unitSystem,
  ]);

  /**
   * One Review Log entry per spanning header — Smearforn Stage 2b.
   *
   * Two provisional things reach a reviewer through it, and neither should
   * be discoverable only from the drawing:
   *
   * - **The span range it is being measured against is not confirmed.**
   *   `bigHeaderWidthInRange` (48-144in) is Tommy's own stated range, not
   *   manufacturer-sourced, and the app refuses rather than widening it. A
   *   header sitting legally inside an unconfirmed range still deserves to
   *   be named.
   * - **What it is priced as was Tommy's decision, not the app's guess.**
   *   Asked directly on 2026-09-25 what rate a spanning header should carry,
   *   he answered: the header/sill rate. What he settled is WHICH EXISTING
   *   RATE APPLIES — it does not make that rate a confirmed number, and no
   *   catalog status moves because of it. The entry also says out loud that
   *   the mid-wall Big Header beam is priced at the roof rate instead, since
   *   two spanning things now carry deliberately different rates and silence
   *   would read as consistency.
   *
   * **Two conditions the refusals CANNOT catch, flagged here instead:**
   *
   * - **A derived span that is no longer a width the shop builds.** The width
   *   follows the panels, so it can leave the range without anybody editing
   *   the header: an insert/delete shift, or any path that re-tiles the wall
   *   (a length edit, a panelization switch, a corner-band change that
   *   replaces one middle panel with two corner panels). The flag is computed
   *   from `resolved.spanWidthIn` — the CURRENT slots — so it does not care
   *   which route caused it, including routes not written yet.
   * - **An opening that no longer fits under the header.** Tommy allowed a
   *   header to span a window or door ("allow both", 2026-09-25 — he answered
   *   this and the pricing question in one exchange, so the two quotes in this
   *   entry carry the same date), and the vertical
   *   refusal only checks the header against the story, so a header placed
   *   low leaves a window whose rough opening reaches the top of its own
   *   shortened panel. Reported, because he permitted the combination.
   *
   * The entry also carries the cross-reference in words, because a header's
   * own name carries no direction.
   */
  const spanningHeaderReviewEntries = useMemo(() => {
    return resolvedSpanningHeaders.map((resolved) => {
      // ⚠ A header standing on fewer than two panels means the wall changed
      // under it through a path that RE-TILES rather than shifts (a wall
      // length edit, a panelization switch — see `shiftSlotCoverage`'s own
      // doc comment on why re-tiles are deliberately not shifted). The
      // insert/delete path removes such a header outright and says so; these
      // other paths cannot, so the reviewer is told instead of a sheet being
      // printed for a part nobody chose.
      const stranded = resolved.coveredSlotIndices.length < 2;
      const slots = (resolved.story === "ground" ? overlayWallSlots : (secondStory?.wallSlots ?? {}))[resolved.wallId] ?? [];
      // Measured off the CURRENT slots and the stored range, never off the
      // edit — which is what makes one flag cover the shift path, every
      // re-tile path, and a file written under different limits.
      const outOfRange = stranded ? null : spanningHeaderSpanOutOfRange(slots, resolved.header, SPANNING_HEADER_LIMITS_IN);
      // The FULL band-producing geometry of this wall — beams joined with
      // every header on it, this one included — so the check sees the same
      // stacked panels the elevation and the cut list do. A header does not
      // necessarily cap the BOTTOM band of a column: a beam (or
      // maxPanelHeightIn) may have split it already, and the band the header
      // shortens is then an upper one. Reading only the slot's top-level
      // fields missed exactly that case.
      const openingConflicts = spanningHeaderOpeningConflicts(
        slots,
        resolved.header,
        {
          storyHeightIn: (resolved.story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt)) * 12,
          bandGeometry: (resolved.story === "ground" ? groundBandGeometryByWallId : secondStoryBandGeometryByWallId)[resolved.wallId] ?? [],
          maxPanelHeightIn,
          minRemainderHeightIn: panelHeightInRange.minIn,
        },
        {
          windowSillHeightIn: sillDefaultHeightIn.value,
          windowHeightIn: standardWindowHeightDefaultIn.value,
          doorRoughOpeningHeightIn,
        },
      );
      const openingNames = openingConflicts
        .map((conflict) => {
          const instances = resolved.story === "ground" ? allInstances : secondStoryAllInstances;
          const inSlot = instances.filter((inst) => inst.wallId === resolved.wallId && inst.slotIndexInWall === conflict.slotIndex);
          // A split column has several stacked instances at the same slot
          // index; `midWallBandIndex` is the same bottom-up index the conflict
          // carries, so the named panel is the one that actually has the
          // problem rather than whichever of the stack came first.
          const name = (inSlot.find((inst) => inst.midWallBandIndex === conflict.zoneIndex) ?? inSlot[0])?.name;
          return `${name ?? `the panel at position ${conflict.slotIndex + 1}`} (its ${conflict.openingType} reaches ${formatLengthIn(conflict.openingTopIn, unitSystem)} in a ${formatLengthIn(conflict.bandHeightIn, unitSystem)} panel)`;
        })
        .join(", ");
      return {
        label: stranded
          ? `Spanning header ${resolved.name} — no longer sits on two panels`
          : outOfRange
            ? `Spanning header ${resolved.name} — ${formatLengthIn(resolved.spanWidthIn, unitSystem)} span, outside the buildable range`
            : `Spanning header ${resolved.name} — ${formatLengthIn(resolved.spanWidthIn, unitSystem)} span`,
        status: "pending-BI-confirmation" as const,
        note: `${spanningHeaderCrossReference.locationByHeaderName.get(resolved.name) ?? ""}. One header panel carried on the panels beneath it, ${formatLengthIn(resolved.heightIn, unitSystem)} tall, its width derived from those panels rather than typed. Building Integrity's stated header span range (${bigHeaderWidthInRange.minIn}in-${bigHeaderWidthInRange.maxIn}in) and header height range (${bigHeaderHeightInRange.minIn}in-${bigHeaderHeightInRange.maxIn}in) are BOTH still pending their confirmation — a span outside them is refused at PLACEMENT, and one that drifts outside them afterwards (the panels beneath it changed) is flagged here rather than accommodated. Priced at the header/sill rate — Tommy's decision, 2026-09-25, when asked what rate this panel carries. That settles which existing rate applies, not that the rate itself is confirmed. ⚠ Note the deliberate disagreement: a spanning header is priced as an opening, while the mid-wall Big Header BEAM is priced at the roof rate. Two spanning things, two different rates, on purpose.${
          stranded
            ? ` **This header now covers ${resolved.coveredSlotIndices.length} panel(s).** Its wall was re-tiled by an edit that re-derives the whole run, so its range no longer describes a real pair of panels — re-place or remove it before this sheet is issued.`
            : ""
        }${
          outOfRange
            ? ` **Its span is now ${formatLengthIn(outOfRange.spanWidthIn, unitSystem)}, outside the ${bigHeaderWidthInRange.minIn}in-${bigHeaderWidthInRange.maxIn}in the app will place a header at.** The panels beneath it changed after it was placed — a shift, or a re-tile that re-derived the run — so this width was never accepted by the placement check that quotes that range. The range is NOT widened to fit it: re-place or remove this header before its sheet is issued.`
            : ""
        }${
          openingConflicts.length > 0
            ? ` **It spans an opening that no longer fits beneath it: ${openingNames}.** A header shortens the panels under it, but a window keeps the sill height it already had, so that opening now runs to the top of its own panel and its own window header collapses to nothing. Spanning an opening is allowed (Tommy, 2026-09-25: "allow both" — the same exchange that settled this panel's rate), so this is reported rather than refused — lower the opening, or raise this header, before these sheets are issued.`
            : ""
        }`,
      };
    });
  }, [
    resolvedSpanningHeaders,
    spanningHeaderCrossReference,
    overlayWallSlots,
    secondStory,
    allInstances,
    secondStoryAllInstances,
    doorRoughOpeningHeightIn,
    unitSystem,
    // The opening-clearance check reproduces this wall's real band split, so
    // it reads the band geometry, the story height and the max-panel-height
    // rule — all four named here rather than closed over silently.
    groundBandGeometryByWallId,
    secondStoryBandGeometryByWallId,
    wallHeightFt,
    maxPanelHeightIn,
  ]);

  /**
   * **⚠ A building with NO braced panels at all, flagged loudly** — Tommy's
   * decision (2026-09-26), asked what should happen: *"Flag it loudly in the
   * Review Log."* An engineer must be told that the building has no modelled
   * shear resistance.
   *
   * How an ordinary building gets here: corner absorb. A 60in wall used to tile
   * `corner | braced 9in | corner` and now tiles `corner 30 | corner 30`, so a
   * **12ft octagon is 16 corner slots and not one braced panel** — measured,
   * `estimatedTotalShearLb` is 0 and the shear entry reads "~0 lb across 0
   * braced panels", which is easy to read as a rounding artefact rather than as
   * "nothing in this building resists racking". It matters more now than it did:
   * Tommy is planning octagon ring buildings.
   *
   * **No shear figure is invented for a corner panel here.** He was offered
   * "a corner panel should count as bracing" and did not choose it, and that
   * option was explicitly labelled as needing a real number from him or his
   * engineer. This entry reports the absence; it does not fill it.
   *
   * First in the list rather than buried among the material assumptions, and it
   * fires only on a building that has panels at all, so an empty project does
   * not shout.
   */
  const zeroBracingReviewEntries = useMemo(() => {
    // ⚠ `panelType === "braced"` ONLY, and a COMBINED safety-gap+brace slot
    // (`secondaryType === "braced"`, which bracedPlacement.ts itself calls "a
    // real brace, not just a safety panel") is therefore not counted here.
    // Deliberate, and the reason is not "it is consistent with the line below" —
    // it is that `PanelInstance` does not carry `secondaryType` at all
    // (panelInstances.ts pushes `zone.type`, so a combined slot arrives as a
    // plain "safety-gap" with no bracedPattern either). So
    // `summarizeBearingAndShear` already gives a combined slot ZERO shear, and
    // `estimatedTotalShearLb` really is 0 for a building whose only braces are
    // combined ones. This entry is then a TRUE statement about what the app
    // models, not a false alarm — the model is what is wrong, not the count.
    //
    // ⚠ Counting `secondaryType` here without fixing the model would be worse:
    // the entry would go quiet while the displayed shear stayed 0 lb. Fixing it
    // properly means carrying the flag onto the instance and RAISING a displayed
    // structural total, which is not something to do by inference — it is in the
    // spec's `## Open Items` as **"Does a COMBINED safety-gap+brace slot count as
    // bracing, and should `PanelInstance` carry `secondaryType`?"**, Tommy's/his
    // engineer's call. (Added there 2026-09-27: this comment previously cited
    // `## Open Items` for an item that was in neither Open Items list, only in
    // the band narrative — the same defect class the pass before it was sent to
    // fix. Fixed by adding the item and naming it, not by softening the pointer.)
    // `FootprintCanvas`'s per-panel tooltip does count `secondaryType`, so the
    // two genuinely disagree today; that divergence is recorded there too.
    const bracedCount = allInstances.filter((i) => i.panelType === "braced").length;
    if (allInstances.length === 0 || bracedCount > 0) return [];
    const cornerCount = allInstances.filter((i) => i.panelType === "corner" || i.panelType === "safety-oct-corner").length;
    // Derived, not typed: the shortest two-corner wall that can still hold a
    // legal middle is two nominal corners plus the fabrication minimum (75in at
    // today's catalog values). Written this way so it tracks the catalog instead
    // of going stale in a sentence.
    const firstLegalTwoCornerWallIn = 2 * cornerPanelWidthIn.value + fabricationMinPanelWidthIn.value;
    // Two of the three panelization types never place a braced slot at all, so
    // the zero is expected there rather than surprising — but it still means the
    // app is modelling no lateral resistance, which is the part that must be
    // said either way.
    const panelizationClause =
      panelizationType === "square-bale-panels"
        ? `Square Bale Panels never places a braced slot, so this is expected for this panelization — and it still means no lateral resistance is modelled anywhere in this building. `
        : panelizationType === "timber-frame-curtain"
          ? `Timber Frame Curtain is carried by its actual timber frame, which this app does not model at all, so a zero here is expected — and it is not evidence that the frame is adequate. Set the curtain's panel type to Braced if the panels are meant to do this work. `
          : `Under Loose Packed Braced this is NOT expected, and the usual cause is corner panels taking up every wall run: a wall under ${formatLengthIn(firstLegalTwoCornerWallIn, unitSystem)} owning a corner at both ends has its short middle absorbed by the pair, which removes the braced slot that middle used to be. A 12ft octagon ends up entirely corners${cornerCount > 0 ? ` — ${cornerCount} of them here` : ""}. `;
    return [
      {
        label: "⚠ NO BRACED PANELS IN THIS BUILDING — no modelled shear resistance",
        status: "pending-BI-confirmation" as const,
        note:
          `Not one of this building's ${allInstances.length} panels is a braced panel, so its estimated total shear capacity is 0 lb — not a small number, none. ` +
          `The app models racking resistance only from a braced panel's own diagonal braces, and there are no braces to model. ` +
          panelizationClause +
          `Whether a corner panel should COUNT as bracing is an open question that needs a real number from Building Integrity or its engineer — nothing here assumes one, in either direction. ` +
          `No panel was changed to produce this entry, and none should be changed to silence it.`,
      },
    ];
  }, [allInstances, panelizationType, unitSystem]);

  const reviewLog = useMemo(() => {
    // Walls still carrying the panel run the OLD corner-ownership rule gave
    // them — see `preChangeTilingNotice.ts` for why this is a notice and not a
    // migration (a re-tile would silently discard every pinned width and
    // locked-width plan in the file, because a pinned set that summed to the old
    // run cannot sum to the new one).
    //
    // ⚠ **`wallGeometryForPure` is called here with the LIVE run stops**, not
    // with `{}`. A stopped wall's slots sum to its STOPPED run, so measuring
    // against the unstopped run would report every stopped wall in the building
    // as stale. Note this is deliberately a stricter test than
    // `repairStateToEighths`' own, which passes no stops at all — the load-time
    // guard is allowed to be conservative about what it re-sizes; a Review Log
    // entry is not allowed to be wrong.
    //
    // Derived inline rather than in its own memo on purpose: it reads only plain
    // `useState` values and the module-level pure `wallGeometryForPure`, so no
    // MEMO joins this array. It is not free even so — see the attribution on
    // `secondStory` in the dependency list below.
    const storedWallRuns: StoredWallRun[] = [];
    if (footprint) {
      const slotsByStory: [StoredWallRun["story"], Record<string, PanelSlot[]>][] = [
        ["ground", baseWallSlots],
        ["second", secondStory?.wallSlots ?? {}],
      ];
      for (const [story, slotsByWallId] of slotsByStory) {
        for (const [wallId, slots] of Object.entries(slotsByWallId)) {
          const geometry = wallGeometryForPure(
            footprint,
            wallId,
            primaryCornerIds,
            leastAccessibleCorner,
            thicknessIn,
            wallRunStopsByWallId,
          );
          if (!geometry) continue;
          storedWallRuns.push({
            wallId,
            story,
            storedTotalIn: slots.reduce((sum, slot) => sum + Math.max(0, slot.widthIn), 0),
            currentRunIn: geometry.lengthIn,
            slotCount: slots.length,
          });
        }
      }
    }
    const preChangeTilingNote = preChangeTilingReviewNote(storedWallRuns, (inches) =>
      formatLengthIn(inches, unitSystem),
    );

    const entries = toReviewLog([
      ...zeroBracingReviewEntries,
      // Second, right behind zero bracing: an unbuildable part outranks every
      // material assumption below it, and unlike the band case nothing else in
      // the log would say a word about it.
      ...squareBaleMergedCornerReviewEntries,
      ...wallRunStopReviewEntries,
      ...spanningHeaderReviewEntries,
      // One line, above the material assumptions because it is about THIS file
      // rather than about the catalog, and below the unbuildable-part reports
      // because nothing here is unbuildable.
      ...(preChangeTilingNote
        ? [
            {
              label: "Walls still tiled by the pre-2026-10-01 corner rule",
              status: "pending-BI-confirmation" as const,
              note: preChangeTilingNote,
            },
          ]
        : []),
      { label: "Target density", ...targetDensityKgM3 },
      { label: "Default panel thickness", ...looseDensePackDefaultThicknessIn },
      { ...interior, label: "Interior finish: " + interior.label },
      { ...exterior, label: "Exterior finish: " + exterior.label },
      { label: "Fastener spacing table", ...fastenerTableStatus },
      {
        label: "Estimated total bearing capacity",
        status: "pending-BI-confirmation" as const,
        note: `~${Math.round(estimatedTotalBearingLb).toLocaleString()} lb across ${allInstances.filter((i) => BEARING_ELIGIBLE_TYPES.has(i.panelType)).length} bearing-eligible panels — Building Integrity's own first-pass NDS estimate (double stud pack), not a licensed engineer's calculation.`,
      },
      {
        label: "Estimated total shear capacity",
        status: "pending-BI-confirmation" as const,
        note: `~${Math.round(estimatedTotalShearLb).toLocaleString()} lb across ${allInstances.filter((i) => i.panelType === "braced").length} braced panels — Building Integrity's own first-pass NDS estimate (diagonal brace), not a licensed engineer's calculation.`,
      },
      { label: "Carbon fraction of dry mass", ...carbonFractionOfDryMass },
      { label: "Framing lumber density", ...referenceDensities.framingLumberLbFt3 },
      { label: "Standard window widths", ...standardWindowWidthsIn },
      { label: "Foundation type: " + foundationType.label, status: foundationType.status, note: foundationType.vaporNote },
      ...(foundationType.loadCapacity
        ? [
            {
              label: "Pier load-bearing capacity: " + foundationType.label,
              status: foundationType.loadCapacity.status,
              note: `${foundationType.loadCapacity.value} ${foundationType.loadCapacity.unit}. ${foundationType.loadCapacity.note}`,
            },
          ]
        : []),
      ...(standardWidthIn !== standardPanelBomReferenceWidthIn
        ? [{ label: "Wood-weight BOM vs. selected panel width", ...bomWidthMismatchWarning }]
        : []),
      // ⚠ The project wood-weight figure is wrong in two known, pre-existing
      // ways, and until this entry existed the only place that was written
      // down was a code comment (see `spanningHeaderWoodWeightKg`). The
      // summary's own note reads "Wood (N standard/braced panels)", which
      // hints at gap 1 to a careful reader and says nothing at all about gap
      // 2. Both are DOCUMENTED rather than fixed on purpose — the fabrication
      // sheets build at `heightOverrideIn`, the real band height, so nothing
      // reaching a shop is wrong, and correcting the sum means running the
      // band pipeline inside it, which changes the displayed weight of every
      // existing project that has a beam in it. That is its own change with
      // its own line. What is NOT acceptable is the wrong number being on
      // screen with nothing beside it, so it is flagged here now.
      {
        label: "Project wood weight is approximate in two known ways",
        status: "pending-BI-confirmation" as const,
        note: `The wood figure in the summary walks standard/braced PANEL SLOTS, which leaves two gaps, both of them older than the spanning header. (1) **Mid-Wall Bond Beams are not counted at all** — a beam is a wall-level record with no panel slot for the walk to find, so its wood is missing from the total. (2) **Every slot is charged at the full story height**, so a panel shortened to make room for a Mid-Wall Bond Beam, a spanning header, or a max-panel-height split still contributes full-height wood — and the header's or beam's own weight is then added on top of it, so that part is counted twice. The two errors point in opposite directions and do not cancel. **Nothing that reaches the shop is affected:** every fabrication sheet builds its members at the real band height, so the cut lists, member lengths and per-panel weights are right; it is the project-level total that is approximate. Correcting it means recomputing the band heights inside that sum, which would change the displayed weight of every saved project containing a beam — its own change, not a side effect of another one.`,
      },
      // Every panel below Building Integrity's own fabrication minimum,
      // however it got there — typed, dragged, stored in an older file, or
      // produced by the tiler's own arithmetic.
      //
      // That last case USED to be routine (computePlainSizing's two-way split
      // landed between 20in and 40in at the 40in standard width) and is now
      // rare: Tommy's ABSORB rule landed 2026-09-24 and the tiler emits one
      // wider panel instead of two narrow ones.
      //
      // **The 51in-75.5in two-corner band is no longer one of the residuals**
      // (corner absorb, 2026-09-25 — the corner-geometry route Tommy chose).
      // Those walls are legal now and report through
      // `absorbedCornerWalls` below instead, which says what the corners did
      // rather than that a panel cannot be built. What is left here is the
      // paths absorb still cannot reach, each with nothing to absorb into and
      // each deliberately reported rather than corrected: a wall owning ONE
      // corner and between 25.5in and 49.5in long, openings eating all but a
      // sliver of a long wall's middle, and a clamped corner on a sub-25.5in
      // wall. See the spec's Open Items.
      ...subMinimumPanels.map((panel) => ({
        label: `Panel narrower than the ${fabricationMinPanelWidthIn.value}in fabrication minimum: wall ${panel.wallId}, slot ${panel.slotIndex}${panel.story === "second" ? " (second story)" : ""}`,
        status: "pending-BI-confirmation" as const,
        note: `${PANEL_TYPE_LABELS[panel.type]} panel ${formatLengthIn(panel.widthIn, unitSystem)} wide, under the ${formatLengthIn(fabricationMinPanelWidthIn.value, unitSystem)} minimum Building Integrity's shop can build (Tommy: "I can't make any panels that are left to right elevation view shorter than 2'"). It opens, draws, prices and prints as stored — nothing was rewritten — but it cannot be fabricated as drawn.`,
      })),
      // A wall too short for two corner panels PLUS a legal middle. The wall
      // is buildable — this is not a defect report — but its corner panels
      // are not the nominal ones, and that is a fabrication fact an engineer
      // has to see before the cut list reaches the shop.
      //
      // ⚠ The final clause is about DROPPED OPENINGS, and it is not decoration.
      // On the absorb path where the reservations no longer fit the nominal
      // middle, every window, door and column on the wall is deleted
      // (`dropsReservations` in `resolveCorners`) — so shortening a 90in wall
      // carrying a 30in window into the band silently loses the window, and
      // this entry, naming only the corner widths and the absorbed inches, was
      // the only notice anywhere. The drop itself is right (over 4,110 measured
      // cases the pre-absorb slot sum was already wrong on every one of them,
      // so it is not a regression), but it must not be silent. Unconditional
      // wording on purpose: the record describes the wall as it is NOW and
      // cannot know what the wall used to carry, and a clause that appears only
      // when we can prove a loss would be absent in exactly the case that
      // matters.
      ...absorbedCornerWalls.map((wall) => ({
        label: `Corner panels widened to absorb a short middle: wall ${wall.wallId}${wall.story === "second" ? " (second story)" : ""}`,
        status: "pending-BI-confirmation" as const,
        note: `This wall owns a corner at both ends and is too short to fit them plus a panel over the ${formatLengthIn(fabricationMinPanelWidthIn.value, unitSystem)} fabrication minimum, so its two corner panels share the whole wall: ${formatLengthIn(wall.cornerWidthsIn[0], unitSystem)} and ${formatLengthIn(wall.cornerWidthsIn[1], unitSystem)} instead of ${formatLengthIn(wall.nominalCornerWidthIn, unitSystem)} each, absorbing ${formatLengthIn(wall.absorbedIn, unitSystem)} that could not become a panel. This is the corner-geometry rule Tommy chose for this case over refusing the wall length ("I like the corner geometry rule"); the individual widths it produces are not separately confirmed. Each panel is still one corner panel with one return face, butt joined to its partner at mid-wall. ⚠ CHECK THIS WALL'S OPENINGS: a wall shortened into this case keeps only a window, door or column that still fits between the nominal corners — anything that no longer fit was REMOVED when the corner pair took the whole wall, and nothing else reports that.`,
      })),
      // One entry per corner end whose corner-brace combine was refused. See
      // `findCornerBraceCombineRefusals` for the whole rationale and for the
      // 3/4in step it deliberately drops.
      //
      // ⚠ The status is `pending-BI-confirmation` for a real reason, not by
      // default: brace placement derives from `seismicBracedPanelSpacingFt`
      // AND `bracedWallLineSpacingFt`, both pending, and "Braced Panel
      // geometry" sits in the spec's own "Provisional beyond the flags" list.
      // The note carries that forward rather than presenting the new placement
      // as settled.
      ...cornerBraceCombineRefusals.map((refusal) => ({
        label: `Corner brace is not against the corner: wall ${refusal.wallId}, ${refusal.end === "start" ? "start" : "end"} corner${refusal.story === "second" ? " (second story)" : ""}`,
        status: "pending-BI-confirmation" as const,
        // ⚠ **The wall id, the end and the story are repeated INSIDE the note,
        // and that is not redundancy with the label — it is what keeps this
        // entry off the dedupe's floor.** `deduped` below compares `note` and
        // nothing else, so two entries whose notes match collapse into one
        // however different their labels are. Everything else this note
        // interpolates (`braceSlotIndex`, `braceOffsetFromCornerIn`,
        // `gapWidthIn`, `bracedPanelCountOnWall`, the seismic spacing) is a
        // function of the wall's TILING, and on a plain rectangle the north and
        // south walls tile identically — so without the wall id in the note,
        // one of the two walls simply never reached the engineer's list, and
        // the same collision could drop one of a single wall's two ends. A
        // symmetric building is the common case, not the rare one.
        note: `Wall ${refusal.wallId}, ${refusal.end === "start" ? "start" : "end"} corner, ${refusal.story === "second" ? "second" : "ground"} story. ${
          refusal.braceSlotIndex === null
            ? `This corner has NO braced panel on its wall at all — the wall carries ${refusal.bracedPanelCountOnWall} of them.`
            : refusal.braceSharedWithOtherCorner
              ? `The one braced panel on this wall (slot ${refusal.braceSlotIndex}) is serving BOTH corners, and it sits ${formatLengthIn(refusal.braceOffsetFromCornerIn ?? 0, unitSystem)} in from this one. Tommy's rule is one per corner: "each wall must have two braced panels on it, touching each side of each corner panel."`
              : `This corner's braced panel is slot ${refusal.braceSlotIndex}, ${formatLengthIn(refusal.braceOffsetFromCornerIn ?? 0, unitSystem)} in from the corner panel's inner face rather than against it — there is an opening in between, not just the spacer.`
        } The wall's ${formatLengthIn(refusal.gapWidthIn, unitSystem)} Safety/Gap panel stayed a separate spacer instead of merging into the corner's brace, because that merge removes a panel from the run and this run could not pay for it legally${
          slotIndexPinnedWallIds.has(refusal.wallId)
            ? " — or, on this wall, because a Mid-Wall Bond Beam, Box Beam coverage or a spanning header is stored against these slot positions and the merge would slide it one panel"
            : ""
        }. **Refusing is deliberate and the wall's own length is exact because of it** (Tommy, 2026-09-29: "this app needs to be perfectly tight with dimensions and wall lengths") — the alternative, in force until then, made this wall longer than itself. What needs an engineer is the placement, not the arithmetic: braced-panel spacing comes from ${seismicBracedPanelSpacingFt[seismicZone]}ft seismic spacing and the braced-wall-line figure, neither of which Building Integrity has confirmed, and "legal, with one brace where the rule asks for two" is not a call this app can make for you.`,
      })),
      // One entry per hand-set panel width its wall cannot honour. The wall is
      // legal and its length is exact; what is not visible anywhere else is that
      // the panel is FABRICATED at the tiler's width rather than the hand-set
      // one. See `unhonouredLockedWidthReviewNote` for the wording and
      // `planLockedWidthReforce` for the refusal itself.
      //
      // ⚠ The status is `pending-BI-confirmation` because the vocabulary has
      // exactly two values and `confirmed` would be a lie: nobody has confirmed
      // WHICH width was meant, which is the whole question this entry raises. It
      // is not a provisional building value like the entries around it.
      ...unhonouredLockedWidths.map((refusal) => ({
        label: `Hand-set panel width is not in force: wall ${footprint ? wallDisplayLabelWithId(footprint, refusal.wallId) : refusal.wallId}, slot ${refusal.slotIndex}${refusal.story === "second" ? " (second story)" : ""}`,
        status: "pending-BI-confirmation" as const,
        // ⚠ The limits are built from the catalog values INLINE rather than from
        // the `panelWidthLimitsIn` object above: that object is rebuilt every
        // render, so naming it as a dependency here raises a
        // `react-hooks/exhaustive-deps` warning, and that rule may never rise.
        // `fabricationMinPanelWidthIn` and `panelWidthInRange` are module
        // constants, exactly as the `absorbedCornerWalls` entry above already
        // reads `fabricationMinPanelWidthIn.value` straight out of the catalog.
        note: unhonouredLockedWidthReviewNote(
          refusal,
          { minIn: fabricationMinPanelWidthIn.value, maxIn: panelWidthInRange.maxIn },
          (valueIn) => formatLengthIn(valueIn, unitSystem),
          // Compass name plus the id. `footprint` is ALREADY a dependency of
          // this memo (see its array below), so this costs no new dependency
          // and no lint delta — which is the whole reason the label is
          // derived here rather than in a memo of its own.
          footprint ? wallDisplayLabelWithId(footprint, refusal.wallId) : undefined,
        ),
      })),
      ...(foundationTypeId === "concrete-pier"
        ? [
            { label: "Concrete pier dimensions", ...concretePierDimensions },
            { label: "Concrete embodied carbon factor", ...concreteEmbodiedCarbonKgPerFt3 },
          ]
        : []),
      ...(foundationTypeId === "slab" ? [{ label: "Slab foundation dimensions", ...slabFoundationDimensions }] : []),
      ...PHASE2_ASSUMPTIONS,
    ]);
    // ⚠ **This keys on `note` ALONE, and deliberately so** — it exists to
    // collapse the many catalog values that share one note (every panel's
    // `shearValue`/`loadBearingCapacity` carries the identical
    // `STRUCTURAL_PENDING_NOTE` under a different label, 21 times over), and
    // keying it on `label + note` instead would put every one of those back on
    // the list. The cost is that any per-wall entry whose note does not NAME
    // its wall is invisible the moment a second wall produces the same note,
    // which on a symmetric building is immediately. The corner-brace refusal
    // entry above names its wall, its end and its story inside the note for
    // exactly that reason. ⚠ `absorbedCornerWalls` does NOT — its note is a
    // function of the two corner widths and the absorbed length, so two
    // identically-short walls still collapse to one entry. That is
    // pre-existing, it is the same defect, and it is not fixed here because it
    // is a different entry with its own wording to get right.
    const deduped = entries.filter((e, i) => entries.findIndex((o) => o.note === e.note) === i);
    // Appended AFTER toReviewLog, not passed through it: these entries are
    // `confirmed` and the filter drops confirmed values by design. See
    // CATALOG_SUPERSESSIONS for why they surface here anyway.
    return [...CATALOG_SUPERSESSIONS, ...deduped];
  }, [
    interior,
    exterior,
    foundationType,
    foundationTypeId,
    standardWidthIn,
    allInstances,
    estimatedTotalBearingLb,
    estimatedTotalShearLb,
    subMinimumPanels,
    // `cornerWidthInForTiling` is deliberately NOT a dependency here: each
    // entry carries its own `nominalCornerWidthIn`, so this memo renders the
    // whole note from the record. Fewer deps, and the number in the note is
    // guaranteed to be the one the wall was actually tiled against.
    absorbedCornerWalls,
    cornerBraceCombineRefusals,
    unhonouredLockedWidths,
    slotIndexPinnedWallIds,
    seismicZone,
    unitSystem,
    wallRunStopReviewEntries,
    spanningHeaderReviewEntries,
    zeroBracingReviewEntries,
    squareBaleMergedCornerReviewEntries,
    // The pre-2026-10-01 tiling notice's inputs. All seven are plain `useState`
    // values, and the notice is derived inline rather than in its own memo
    // precisely so that no MEMO joins this array.
    //
    // ⚠ It still costs exactly one `react-hooks/preserve-manual-memoization`
    // error, and the honest attribution is `secondStory` — "this dependency may
    // be mutated later". That is the FIFTH instance of a pattern this file
    // already carries four times: `subMinimumPanels`, `absorbedCornerWalls`,
    // `cornerBraceCombineRefusals` and `unhonouredLockedWidths` are each flagged
    // on the identical `secondStory` dependency with the identical message. No
    // correctness rule moved (`exhaustive-deps` 12, `refs` 29,
    // `set-state-in-effect` 12, `purity` 1, `immutability` 1, all unchanged).
    footprint,
    baseWallSlots,
    secondStory,
    primaryCornerIds,
    leastAccessibleCorner,
    thicknessIn,
    wallRunStopsByWallId,
  ]);

  // Site Properties dropdown content (Tommy: "middle of the left side of
  // the menu bar, i want site properties drop down box") — identical
  // fields/logic to the old standalone "Site" section, just rendered
  // inside TopBar's popover instead of the main scrolling column.
  const siteContent = (
    <>
      <h2>Site Properties</h2>
      <label>
        Project name{" "}
        <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
      </label>
      <label>
        Zip code{" "}
        <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
      </label>
      <label>
        Seismic zone{" "}
        {pendingControls.has("seismic-zone") && (
          <PendingRetileMark what={TILING_BASIS_CONTROL_LABELS["seismic-zone"]} />
        )}
        <select value={seismicZone} onChange={(e) => setSeismicZone(e.target.value as SeismicZone)}>
          <option value="high">High ({seismicBracedPanelSpacingFt.high}ft braced PANEL spacing)</option>
          <option value="moderate">Moderate ({seismicBracedPanelSpacingFt.moderate}ft braced PANEL spacing)</option>
          <option value="low">Low ({seismicBracedPanelSpacingFt.low}ft braced PANEL spacing)</option>
        </select>
      </label>
      <p className={styles.note}>
        Braced wall PANEL spacing (above, drives how often a braced panel is placed along one wall run) is a
        different limit than braced wall LINE spacing (how far apart two parallel bracing-required wall lines can
        be) — this design&apos;s longest unbraced run between parallel wall lines should stay under{" "}
        {bracedWallLineSpacingFt[seismicZone]}ft. {bracedWallLineSpacingStatus.note}
      </p>
      <label>
        Foundation type{" "}
        <select
          value={foundationTypeId}
          onChange={(e) => {
            const nextId = e.target.value as typeof foundationTypeId;
            setFoundationTypeId(nextId);
            // A monolithic slab floor can't coexist with a pier/crawlspace
            // foundation — see the Thermally Broken Slab button's own
            // disabled/title logic below for the other half of this guardrail.
            if (foundationTypes.find((f) => f.id === nextId)!.usesPierGrid && floorSystemId === "thermal-slab") {
              setFloorSystemId(null);
            }
          }}
        >
          {foundationTypes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      {foundationType.usesPierGrid && (
        <label>
          Pier spacing{" "}
          <select value={pierSpacingFt} onChange={(e) => setPierSpacingFt(Number(e.target.value))}>
            {pierSpacingOptionsFt.map((ft) => (
              <option key={ft} value={ft}>
                {ft} ft o.c.
              </option>
            ))}
          </select>
        </label>
      )}
      {foundationTypeId === "ground-screw" && (
        <>
          <div role="group" aria-label="Ground screw product" className={styles.toolbar}>
            {groundScrewProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                title={`${p.manufacturer} ${p.model} — ${formatLengthIn(p.diameterMm / MM_PER_IN, unitSystem)} diameter, ${p.representativeCapacityKN}kN`}
                aria-pressed={selectedGroundScrewProductId === p.id}
                className={selectedGroundScrewProductId === p.id ? styles.toolActive : styles.tool}
                onClick={() => setSelectedGroundScrewProductId(p.id)}
              >
                {p.manufacturer} {p.model}
              </button>
            ))}
          </div>
          {(() => {
            const p = groundScrewProducts.find((gp) => gp.id === selectedGroundScrewProductId)!;
            return (
              <p className={styles.note}>
                {formatLengthIn(p.diameterMm / MM_PER_IN, unitSystem)} diameter, length {p.lengthMmRange},{" "}
                ~{p.representativeCapacityKN}kN ({p.capacityBasis}). Origin: {p.originCountry}.{" "}
                {p.availabilityNote} {p.note}
              </p>
            );
          })()}
          <p className={styles.pending}>{groundScrewProductsStatus.note}</p>
        </>
      )}
      <p className={foundationType.status === "pending-BI-confirmation" ? styles.pending : styles.note}>
        {foundationType.vaporNote}
      </p>
    </>
  );

  // Panelizer dropdown content (Tommy: "middle right of the menu bar, i
  // want Panel Standards, which includes panel parameters section as well
  // as panel styles" — later renamed to "Panelizer" and positioned as "the
  // keyhole to getting down to what editor tools are needed for this
  // user's project") — the old standalone "Panel parameters" section plus
  // the panelization-type controls that used to live inside the Wall tab
  // (moving them here means they're now editable regardless of which
  // editor tab is active, which is a genuine improvement — the underlying
  // state never depended on the Wall tab specifically).
  const panelizerContent = (
    <>
      <h2>Panelizer</h2>
      <p className={styles.note}>
        The keyhole for this project&apos;s scope of work — check off Floors/Walls/Roof/Foundation to bring their
        editor tabs, modality pickers, and Detail Guide/Shop Drawing pages into scope. Unchecking a branch hides its
        tab entirely rather than just disabling it.
      </p>
      <div role="group" aria-label="Scope of work" className={styles.toolbar}>
        <label title={isLastEnabledScopeBranch(scopeOfWork, "floors") ? LAST_SCOPE_BRANCH_TITLE : undefined}>
          <input
            type="checkbox"
            checked={floorsEnabled}
            disabled={isLastEnabledScopeBranch(scopeOfWork, "floors")}
            onChange={(e) => setFloorsEnabled(e.target.checked)}
          />{" "}
          Floors
        </label>
        <label title={isLastEnabledScopeBranch(scopeOfWork, "walls") ? LAST_SCOPE_BRANCH_TITLE : undefined}>
          <input
            type="checkbox"
            checked={wallsEnabled}
            disabled={isLastEnabledScopeBranch(scopeOfWork, "walls")}
            onChange={(e) => setWallsEnabled(e.target.checked)}
          />{" "}
          Walls
        </label>
        <label title={isLastEnabledScopeBranch(scopeOfWork, "roof") ? LAST_SCOPE_BRANCH_TITLE : undefined}>
          <input
            type="checkbox"
            checked={roofEnabled}
            disabled={isLastEnabledScopeBranch(scopeOfWork, "roof")}
            onChange={(e) => setRoofEnabled(e.target.checked)}
          />{" "}
          Roof
        </label>
        {/* Smearforn Stage 0: the fourth branch, in the same group rather
            than in the gear menu — Tommy's "perhaps it's somewhere in
            settings" is satisfied by Panelizer, which is already the
            keyhole for scope of work, and splitting one decision across two
            menus is worse than either menu. */}
        <label title={isLastEnabledScopeBranch(scopeOfWork, "foundation") ? LAST_SCOPE_BRANCH_TITLE : undefined}>
          <input
            type="checkbox"
            checked={foundationEnabled}
            disabled={isLastEnabledScopeBranch(scopeOfWork, "foundation")}
            onChange={(e) => setFoundationEnabled(e.target.checked)}
          />{" "}
          Foundation
        </label>
      </div>
      <p className={styles.note}>
        Unchecking a branch hides its tab and its pages; it never deletes anything — foundation type, pier grid, floor
        system and their geometry all stay exactly as they are, and re-checking brings them back untouched.
      </p>

      {floorsEnabled && (
        <div role="group" aria-label="Floor type" className={styles.toolbar}>
          <button
            type="button"
            aria-pressed={isBaleFoundationFloor}
            className={isBaleFoundationFloor ? styles.toolActive : styles.tool}
            onClick={() => setFloorSystemId((was) => (was === "bale-foundation" ? null : "bale-foundation"))}
            disabled={!footprint}
          >
            Bale Foundation
          </button>
          {floorJoistTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={floorSystemId === t.id}
              className={floorSystemId === t.id ? styles.toolActive : styles.tool}
              onClick={() => setFloorSystemId((was) => (was === t.id ? null : t.id))}
              disabled={!footprint}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={isThermalSlabFloor}
            className={isThermalSlabFloor ? styles.toolActive : styles.tool}
            onClick={() => setFloorSystemId((was) => (was === "thermal-slab" ? null : "thermal-slab"))}
            disabled={!footprint || foundationType.usesPierGrid}
            title={
              foundationType.usesPierGrid
                ? "A monolithic slab floor isn't compatible with a pier/crawlspace foundation — pick a joist floor type instead, or switch to a slab-compatible foundation type on the Site Properties panel."
                : undefined
            }
          >
            Thermally Broken Slab
          </button>
          <label>
            <input
              type="checkbox"
              checked={perpendicular2x4Enabled}
              onChange={(e) => setPerpendicular2x4Enabled(e.target.checked)}
              disabled={!floorJoistTypeId}
            />{" "}
            Perpendicular 2x4 addition
          </label>
        </div>
      )}

      {roofEnabled && (
        <div role="group" aria-label="Roof system type" className={styles.toolbar}>
          {roofSystemTypes.map((t) => (
            <label key={t.id} title={t.description}>
              <input type="checkbox" checked={roofSystemTypeId === t.id} disabled readOnly />{" "}
              {t.label}
            </label>
          ))}
        </div>
      )}
      {roofEnabled && (
        <p className={styles.note}>
          Now determined by each Gable End wall&apos;s own "Panels/beam" toggle in that wall&apos;s Elevation view sidebar (Tommy: gable
          config is "the determining factor" for roof options) — structural-panel as soon as any gable wall is in panels/beam mode,
          truss otherwise.
        </p>
      )}

      {wallsEnabled && (
        <>
      <label>
        Standard width (in){" "}
        {pendingControls.has("standard-width") && (
          <PendingRetileMark what={TILING_BASIS_CONTROL_LABELS["standard-width"]} />
        )}
        {/* Was a bare type="number" with no `step` and no parse-on-commit,
            so it happily stored an off-grid width like 40.3 — the tiler is
            safe against that now, but the stored setting still needs to be
            on the 1/8in grid.

            CLAMPED to the fabrication minimum since Smearforn 1r, and the
            title no longer advertises the manufacturer's 15¾in floor. This
            setting is the width of EVERY plain panel on every wall: set to
            20in it makes the whole building unbuildable, and no amount of
            absorbing in the tiler fixes a cap set below the floor (see
            tiling.test.ts's "ABSORB CANNOT SAVE A SUB-24in STANDARD WIDTH").
            A clamp rather than the typed-panel field's refusal: this is a
            project default with an obvious right answer at the boundary, and
            LengthInput redisplays the committed value, so the clamp is
            visible in the field the instant it happens. */}
        <LengthInput
          value={standardWidthIn}
          domain="in"
          ariaLabel="Standard width in inches"
          title={`Standard panel width: ${formatLengthIn(fabricationMinPanelWidthIn.value, unitSystem)}-${formatLengthIn(panelWidthInRange.maxIn, unitSystem)}. The ${formatLengthIn(fabricationMinPanelWidthIn.value, unitSystem)} floor is what Building Integrity's shop can build, not the manufacturer's ${formatLengthIn(panelWidthInRange.minIn, unitSystem)}.`}
          onCommit={(next) =>
            setStandardWidthIn(Math.min(Math.max(next, fabricationMinPanelWidthIn.value), panelWidthInRange.maxIn))
          }
        />
      </label>
      <label>
        Thickness{" "}
        {pendingControls.has("thickness") && <PendingRetileMark what={TILING_BASIS_CONTROL_LABELS.thickness} />}
        <select
          value={thicknessIn}
          disabled={isSquareBalePanelization}
          title={isSquareBalePanelization ? `Locked to ${formatLengthIn(squareBalePanel.thicknessIn, unitSystem)} while Square Bale Panels is selected.` : undefined}
          onChange={(e) => setThicknessIn(Number(e.target.value))}
        >
          {looseDensePackThicknessOptionsIn.map((t) => (
            <option key={t} value={t}>
              {formatLengthIn(t, unitSystem)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Target density (lb/ft3){" "}
        <input
          type="number"
          value={densityLbFt3}
          onChange={(e) => setDensityLbFt3(Number(e.target.value))}
        />
      </label>
      <label>
        Wall height{" "}
        {/* The one FEET-domain field in this group, so it reads back as
            `10'-0"` and the "(ft)" in the label would now be redundant.
            A bare `10 5/8` typed here is 10ft + ⅝in — the live hint spells
            that out before it commits. */}
        <LengthInput
          value={wallHeightFt}
          domain="ft"
          ariaLabel="Wall height"
          title={`Possible panel height: ${formatLengthIn(panelHeightInRange.minIn, unitSystem)}-${formatLengthIn(panelHeightInRange.maxIn, unitSystem)}`}
          onCommit={handleSetWallHeightFt}
        />
      </label>
      <p className={styles.note}>
        Default 10ft (120in) is Panel Set 1&apos;s confirmed standard panel height.
      </p>
      <label>
        Max panel height (in){" "}
        <LengthInput
          value={maxPanelHeightIn}
          domain="in"
          ariaLabel="Max panel height in inches"
          onCommit={handleSetMaxPanelHeightIn}
        />
      </label>
      <p className={styles.note}>
        A wall column taller than this auto-splits into stacked panels (e.g. a 16ft wall at a 10ft max spawns a 10ft
        panel + a 6ft panel), independent of any Mid-Wall Bond Beam — each stacked panel is independently editable.
      </p>
      <label>
        <input
          type="checkbox"
          checked={includeNailer}
          onChange={(e) => setIncludeNailer(e.target.checked)}
        />{" "}
        Include exterior nailer (optional, per standard panel BOM)
      </label>

      <div role="group" aria-label="Jack stud construction" className={styles.toolbar}>
        <button
          type="button"
          title="3/4in plywood sheet, panel-depth wide"
          aria-pressed={jackStudConfig === "plywood"}
          className={jackStudConfig === "plywood" ? styles.toolActive : styles.tool}
          onClick={() => setJackStudConfig("plywood")}
        >
          Plywood Jack Studs
        </button>
        <button
          type="button"
          title="Vertical 2x4 stud pair (ext + int wythe), flush with the adjacent wall's own studs"
          aria-pressed={jackStudConfig === "2x4-stud"}
          className={jackStudConfig === "2x4-stud" ? styles.toolActive : styles.tool}
          onClick={() => setJackStudConfig("2x4-stud")}
        >
          2x4 Stud Jack Studs
        </button>
      </div>
      <p className={styles.note}>
        Rough Opening jack studs (each side of a window/door) — plywood is the original &quot;jack sheet&quot;;
        2x4 studs sit right at the slot&apos;s perimeter, next to the adjacent panel&apos;s own studs. Either way,
        jack studs narrow the actual clear Rough Opening below the full window/door slot width — see the Door/
        Window Rough Opening Detail pages.
      </p>
      <p className={styles.note}>
        Each window has its own Rough Opening height, set per-window by clicking it on the canvas and using the
        Selected Panel note's size diagram (Tommy: "i want each window individually adjustable") — headers are sized
        from each window's own RO top up to the wall's standard height; see the Window Rough Opening Detail page.{" "}
        {standardWindowHeightsIn.note}
      </p>

      {footprint && (
        <div data-repanelize="" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={styles.tool}
            /* ⚠ Wrapped, not passed bare. `handleRepanelizeRequest` now takes a
               wall id, and React hands a click handler the MouseEvent — so the
               bare reference made every building-wide Repanelize scope itself to
               a wall named [object MouseEvent], which matches nothing and would
               have silently rebuilt nothing at all. tsc caught it. */
            onClick={() => handleRepanelizeRequest(null)}
            title="Rebuild every wall's panels from the current settings"
          >
            Repanelize…
          </button>
          {/* ⚠ `wallId === null` — the building-wide dialog, not just any
              prompt. Both scopes share one piece of state, so without this
              guard, asking to repanelize ONE wall also opened the whole-building
              dialog over in Wall Assembly, offering a confirm button that would
              have rebuilt everything. */}
          {repanelizePrompt && repanelizePrompt.wallId === null && (
            <div role="alertdialog" aria-label="Confirm repanelize" className={styles.note} data-repanelize-prompt="">
              <p>{repanelizePrompt.text}</p>
              {/* ⚠ Repanelize is one undo entry, so this IS reversible — said
                  out loud, because a user who does not know that will not
                  risk the click, and the whole point of the feature is that
                  they can try it. */}
              <p>This can be undone.</p>
              <button type="button" className={styles.tool} onClick={handleRepanelizeConfirm}>
                {repanelizePrompt.changedCount === 0 ? "Repanelize anyway" : "Yes, repanelize"}
              </button>{" "}
              <button type="button" className={styles.tool} onClick={() => setRepanelizePrompt(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {pendingTilingText && (
        <p className={styles.note} data-pending-retile="true">
          ⚠ Changed since this building was panelized: <strong>{pendingTilingText}</strong>. Existing panels keep the old
          values until the building is panelized again.
        </p>
      )}
      <div role="group" aria-label="Panelization type" className={styles.toolbar}>
        {pendingControls.has("panelization-type") && (
          <PendingRetileMark what={TILING_BASIS_CONTROL_LABELS["panelization-type"]} />
        )}
        <button
          type="button"
          aria-pressed={panelizationType === "loose-packed-braced"}
          className={panelizationType === "loose-packed-braced" ? styles.toolActive : styles.tool}
          onClick={() => {
            setPanelizationNotice(null);
            setPanelizationType("loose-packed-braced");
          }}
        >
          Loose Packed Braced
        </button>
        <button
          type="button"
          aria-pressed={panelizationType === "square-bale-panels"}
          className={panelizationType === "square-bale-panels" ? styles.toolActive : styles.tool}
          title={`Locks Thickness to ${squareBalePanel.thicknessIn}in — a whole-bale unit's width/thickness are physically fixed, not adjustable.`}
          onClick={() => {
            // ⚠ REFUSED, not clamped and not absorbed, when a wall on this
            // building has no legal Square Bale tiling — Tommy: "No — refuse
            // instead." Nothing is changed, including the thickness below.
            const refusal = squareBalePanelizationRefusal();
            if (refusal) {
              setPanelizationNotice(refusal);
              return;
            }
            setPanelizationNotice(null);
            setPanelizationType("square-bale-panels");
            // Square bale panels are a fixed real-world bale size (Tommy: "always
            // 14in") — not an independently adjustable wall thickness like every
            // other panelization type.
            setThicknessIn(squareBalePanel.thicknessIn);
          }}
        >
          Square Bale Panels
        </button>
        <button
          type="button"
          aria-pressed={panelizationType === "timber-frame-curtain"}
          className={panelizationType === "timber-frame-curtain" ? styles.toolActive : styles.tool}
          onClick={() => {
            setPanelizationNotice(null);
            setPanelizationType("timber-frame-curtain");
          }}
        >
          Timber Frame Curtain
        </button>
      </div>
      {panelizationNotice && (
        <p className={styles.note} style={{ color: "#a67c00" }} role="alert">
          {panelizationNotice}
        </p>
      )}
      <div role="group" aria-label="Default bracing style" className={styles.toolbar}>
        {pendingControls.has("bracing-style") && (
          <PendingRetileMark what={TILING_BASIS_CONTROL_LABELS["bracing-style"]} />
        )}
        <button
          type="button"
          aria-pressed={defaultBracePattern === "chevron"}
          className={defaultBracePattern === "chevron" ? styles.toolActive : styles.tool}
          onClick={() => setBracingStyle(patternMirrorToBracingStyle("chevron", defaultBracedMirrored))}
        >
          Chevron
        </button>
        <button
          type="button"
          aria-pressed={defaultBracePattern === "hatch"}
          className={defaultBracePattern === "hatch" ? styles.toolActive : styles.tool}
          onClick={() => setBracingStyle(patternMirrorToBracingStyle("hatch", defaultBracedMirrored))}
        >
          Hatch
        </button>
        <button
          type="button"
          aria-pressed={defaultBracedMirrored}
          className={defaultBracedMirrored ? styles.toolActive : styles.tool}
          onClick={() => setBracingStyle(patternMirrorToBracingStyle(defaultBracePattern, !defaultBracedMirrored))}
        >
          Mirrored
        </button>
      </div>
      <p className={styles.note}>
        The default pattern/mirror a brand-new braced panel gets auto-suggested with (Tommy: &quot;softly decouple
        [seismic auto-population] to be an original suggestion... allows the user to change each panel&quot;) —
        Chevron is the original &quot;&lt;&quot; shape (both braces meet at the same stud, or &quot;&gt;&quot;
        mirrored); Hatch continues one single diagonal slope instead (&quot;/&quot; unmirrored, &quot;\&quot;
        mirrored), split at the middle girt row with each brace's inner end at the opposite stud from the other. No
        longer forces every braced panel project-wide — an existing braced panel keeps whatever style it was already
        given (click it on the canvas, or use its own Selected Panel note, to change it individually). Still applies
        wherever a NEW &quot;braced&quot; panel gets auto-placed (corner-proximity/seismic spacing under Loose
        Packed Braced, or &quot;All Braced&quot; under Timber Frame Curtain) — has no effect under Square Bale
        Panels, which never places a braced slot.
      </p>
      {panelizationType === "loose-packed-braced" && (
        <p className={styles.note}>
          Today&apos;s system: standard panels tiled at the width above, with corner-proximity bracing and
          safety/gap dimensional-tolerance absorption.
        </p>
      )}
      {panelizationType === "square-bale-panels" && (
        <>
          <p className={styles.note}>
            Every wall infill span (in place of standard/braced/safety-gap) is tiled at a fixed{" "}
            {formatLengthIn(squareBalePanel.widthIn, unitSystem)} x {formatLengthIn(squareBalePanel.thicknessIn, unitSystem)}{" "}
            whole-bale unit ({squareBalePanel.note}). Corner panels are also a{" "}
            {formatLengthIn(squareBalePanel.widthIn, unitSystem)} Square Bale Panel body, with a double 2x6 stud
            pack at the primary corner instead of the plain {formatLengthIn(cornerPanelWidthIn.value, unitSystem)}{" "}
            Column/Corner unit — see the Corner Shop Drawing page. Columns and openings are unaffected.
          </p>
          <div role="group" aria-label="Square bale stud configuration" className={styles.toolbar}>
            <button
              type="button"
              aria-pressed={squareBaleStudConfig === "single-2x4"}
              className={squareBaleStudConfig === "single-2x4" ? styles.toolActive : styles.tool}
              onClick={() => setSquareBaleStudConfig("single-2x4")}
            >
              Single 2x4 Studs
            </button>
            <button
              type="button"
              aria-pressed={squareBaleStudConfig === "double-2x4"}
              className={squareBaleStudConfig === "double-2x4" ? styles.toolActive : styles.tool}
              onClick={() => setSquareBaleStudConfig("double-2x4")}
            >
              Double 2x4 Studs
            </button>
            <button
              type="button"
              aria-pressed={squareBaleStudConfig === "double-2x6"}
              className={squareBaleStudConfig === "double-2x6" ? styles.toolActive : styles.tool}
              onClick={() => setSquareBaleStudConfig("double-2x6")}
            >
              Double 2x6 Studs
            </button>
          </div>
          {squareBaleStudConfig !== "single-2x4" && (
            <p className={styles.note}>
              Each corner becomes 2 studs standing close together with a 1.5&quot; gap — the gap is filled
              with a timber fiber board piece (shown in the 3D view) instead of straw, since it&apos;s too
              narrow for loose infill. Corner-stud footprint and blocking-girt fit both widen accordingly;
              top/bottom plates widen to match the stud&apos;s own width (3.5&quot; for 2x4, 5.5&quot; for
              2x6).
            </p>
          )}
          {includeNailer && (
            <label>
              Nailer slide offset from center (in){" "}
              <LengthInput
                value={nailerOffsetIn}
                domain="in"
                ariaLabel="Nailer slide offset from center, in inches"
                onCommit={setNailerOffsetIn}
              />
            </label>
          )}
        </>
      )}
      {panelizationType === "timber-frame-curtain" && (
        <>
          <div role="group" aria-label="Timber frame curtain panel type" className={styles.toolbar}>
            <button
              type="button"
              aria-pressed={timberFrameCurtainPanelType === "standard"}
              className={timberFrameCurtainPanelType === "standard" ? styles.toolActive : styles.tool}
              onClick={() => setTimberFrameCurtainPanelType("standard")}
            >
              All Standard
            </button>
            <button
              type="button"
              aria-pressed={timberFrameCurtainPanelType === "braced"}
              className={timberFrameCurtainPanelType === "braced" ? styles.toolActive : styles.tool}
              onClick={() => setTimberFrameCurtainPanelType("braced")}
            >
              All Braced
            </button>
            <label>
              Panel width (in){" "}
              <LengthInput
                value={timberFrameCurtainWidthIn}
                domain="in"
                ariaLabel="Timber frame curtain panel width in inches"
                title="At least 1in — advisory, nothing clamps this"
                onCommit={setTimberFrameCurtainWidthIn}
              />
            </label>
          </div>
          <p className={styles.note}>
            Every wall infill span (in place of standard/braced/safety-gap) is tiled uniformly at{" "}
            {timberFrameCurtainWidthIn}&quot;, all {timberFrameCurtainPanelType} panels — no corner-proximity
            bracing or safety/gap absorption, since the (not-yet-modeled) timber frame itself carries the
            structural load in this system. Corners, columns, and openings are unaffected.
          </p>
        </>
      )}
        </>
      )}
    </>
  );

  const documentSiteLabel = zipCode.trim() ? `Zip ${zipCode.trim()}` : "Site not set";
  // Saved date, not print date (spec: Backend > Project name / site / date).
  // Stage 2 adds `cloudVersionCreatedAt` here; `now` only wins when nothing
  // has been saved or loaded.
  const documentDate = titleBlockDateLabel(resolveTitleBlockDate({ lastSave: documentSession.titleBlockSave, now: new Date() }));

  // Project Summary page content (Tommy: "the first page is the project
  // summary page with all the totals for cost, all materials... do a full
  // check on what might not be on this but should be") — the genuinely
  // missing rollups, each honestly omitted (not a fabricated 0) when not
  // applicable to the current design.
  const foundationConcreteNote =
    foundationTypeId === "concrete-pier"
      ? `${concretePierVolumeFt3.toFixed(1)} ft3 (${pierGrid.length} piers @ ${concretePierDimensions.diameterIn}in dia. x ${concretePierDimensions.depthFt}ft deep) → ${embodiedCarbon.concreteCO2eKg.toFixed(1)} kg CO2e embodied`
      : null;
  const floorJoistNote = floorJoistType
    ? `${joistLayout?.joists.length ?? 0} joists (${floorJoistType.label})`
    : null;
  // Box beam is a per-wall choice now, so a 2-story building can genuinely
  // need both fills at once (mixed Truss Plate / Box Beam coverage).
  const roofMaterialNote = [
    trussPlateWallLengthTotalIn > 0
      ? `Timber HP: ${timberHpTotal.volumeFt3.toFixed(2)} ft3, ~${timberHpWeight.weightLb.toFixed(1)} lb (truss plate)`
      : null,
    boxBeamWallLengthTotalIn > 0
      ? `Dense-pack cellulose: ${denseCelluloseTotal.volumeFt3.toFixed(2)} ft3, ~${denseCelluloseWeight.weightLb.toFixed(1)} lb (box beam)`
      : null,
  ]
    .filter((s): s is string => s !== null)
    .join("; ");
  const strawBaleSummaryNote =
    panelizationType === "square-bale-panels" ? `${strawBaleCount} bales to purchase (${strawBaleWeightLb.toFixed(1)} lb total, ${STRAW_BALE_WEIGHT_LB} lb/bale)` : null;
  const plasterFinishes = [hasClayPlaster ? "Clay plaster" : null, hasLimePlaster ? "Lime plaster" : null].filter(
    (v): v is string => v !== null,
  );
  const plasterNote = plasterFinishes.length > 0 ? `${plasterFinishes.join(", ")} selected — weight not yet modeled` : null;

  // Elevation view's own sidebar controls (Tommy: a UI visibility issue on
  // the elevation view — every control used to render inline in the main
  // canvas area, unlike Plan/3D, which already portal their own tools into
  // the sidebar). WallElevationDiagram now owns only the SVG + its own
  // drag-interaction state; every discrete control (add/remove beam,
  // toggle gable end, per-point position inputs, help text) lives here
  // instead, calling the exact same handlers the diagram's own drag
  // handles call. Rendered into sidebar Region 3 (see the elevationWall
  // branch below) whenever this wall's Elevation stop is the active view.
  const renderMidWallBeamSection = (wallId: string, story: "ground" | "second", beams: MidWallBeam[], storyHeightIn: number) => (
    <div className={elevationStyles.beamSection}>
      <div className={elevationStyles.sectionHeader}>
        <span className={elevationStyles.sectionLabel}>Mid-Wall Bond Beams ({story === "ground" ? "ground" : "2nd story"})</span>
        <div className={elevationStyles.buttonRow}>
          <button type="button" className={elevationStyles.actionButton} onClick={() => handleAddMidWallBeam(story, wallId, "box-beam")}>
            + Add Box Beam
          </button>
          <button
            type="button"
            className={elevationStyles.actionButton}
            onClick={() => handleAddMidWallBeam(story, wallId, "big-header-beam")}
          >
            + Add Big Header (Mid-Wall)
          </button>
        </div>
        {story === "ground" && (
          <p className={elevationStyles.helpText}>
            Splits the row into stacked bands; drag the brown handle to reposition, the green handles to resize its
            own coverage. Dragging a beam&apos;s bottom edge within {MID_WALL_BEAM_HEADER_SNAP_THRESHOLD_IN}in of a
            covered window&apos;s own header bottom snaps flush with it — its header then shrinks to fit above the
            beam automatically. Dragging it (or, for a Big Header, its own top edge — the blue handle) within{" "}
            {MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN}in of the roofline instead snaps flush with THAT: a Big Header
            grows to close the gap, a box beam slides up.
          </p>
        )}
      </div>
      {beams.map((beam) => (
        <div key={beam.id} className={elevationStyles.beamRow}>
          <label className={elevationStyles.fieldRow}>
            Height
            {/* The removed max={storyHeightIn} was advisory only — a number
                input's max never blocked a typed value, and there is no form
                and no :invalid styling here — so the bound moves into the
                tooltip rather than quietly becoming enforcement it never
                was. */}
            <LengthInput
              value={beam.heightIn}
              domain="in"
              ariaLabel="Mid-wall beam height in inches"
              title={`Height above this story's floor — the story itself is ${formatFeetInches(storyHeightIn / 12)} tall`}
              style={{ width: 60, flex: "0 0 auto" }}
              onCommit={(next) => handleChangeMidWallBeamHeight(story, wallId, beam.id, next)}
            />
            in
          </label>
          {beam.kind === "box-beam" ? (
            <select
              className={elevationStyles.fieldRow}
              value={beam.sizeId}
              onChange={(e) => handleChangeMidWallBeamSizeId(story, wallId, beam.id, e.target.value as BoxBeamSizeId)}
            >
              {BOX_BEAM_SIZE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <label className={elevationStyles.fieldRow}>
              Big Header tall
              <LengthInput
                value={beam.bigHeaderBeamHeightIn ?? BIG_HEADER_BEAM_MIN_HEIGHT_IN}
                domain="in"
                ariaLabel="Big Header beam height in inches"
                style={{ width: 60, flex: "0 0 auto" }}
                onCommit={(next) =>
                  handleChangeMidWallBeamBigHeaderHeightIn(
                    story,
                    wallId,
                    beam.id,
                    Math.max(BIG_HEADER_BEAM_MIN_HEIGHT_IN, next),
                  )
                }
              />
              in
            </label>
          )}
          <div className={elevationStyles.beamRowFooter}>
            <span className={elevationStyles.slotsText}>
              slots {beam.startSlotIndex}–{beam.endSlotIndex}
            </span>
            <button type="button" className={elevationStyles.actionButton} onClick={() => handleRemoveMidWallBeam(story, wallId, beam.id)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  /**
   * Smearforn Stage 2b — the spanning ("triple") header controls.
   *
   * Deliberately typed numbers rather than drag handles: a header's span is
   * a set of WHOLE panels (slot indices, so its ends always land on a panel
   * edge by construction), and its width is derived from those panels rather
   * than positioned freely. The span shown here is the number that reaches a
   * cut list, so it is read out rather than entered.
   *
   * Every control routes through the validating handlers — a refusal writes
   * nothing and says why, with the number in it.
   */
  const renderSpanningHeaderSection = (wallId: string, story: "ground" | "second", headers: SpanningHeader[]) => {
    const slots = (story === "ground" ? overlayWallSlots : (secondStory?.wallSlots ?? {}))[wallId] ?? [];
    // The default new header sits on the selected panel and its right-hand
    // neighbour — the two-panel case the ADU's own E4A is — or on the first
    // two panels of the wall when nothing is selected.
    const anchorIndex =
      selectedSlot && selectedSlot.wallId === wallId && selectedSlot.story === story ? selectedSlot.slotIndex : 0;
    const defaultStart = Math.max(0, Math.min(anchorIndex, Math.max(0, slots.length - 2)));
    return (
      <div className={elevationStyles.beamSection}>
        <div className={elevationStyles.sectionHeader}>
          <span className={elevationStyles.sectionLabel}>
            Spanning Headers ({story === "ground" ? "ground" : "2nd story"})
          </span>
          <div className={elevationStyles.buttonRow}>
            <button
              type="button"
              className={elevationStyles.actionButton}
              disabled={slots.length < 2}
              onClick={() => handleAddSpanningHeader(story, wallId, defaultStart, defaultStart + 2)}
            >
              + Add Spanning Header
            </button>
          </div>
          {story === "ground" && (
            <p className={elevationStyles.helpText}>
              One header panel sitting ON TOP of two or more panels — the panels beneath are shortened to make room
              for it, and its own fabricated width is their combined width. It is named from a single building-wide
              series (H1, H2, H3) with no direction letter, so its sheet states the wall in words and the panels it
              spans; each of those panels&apos; sheets names the header above it.
            </p>
          )}
        </div>
        {headers.map((header) => {
          const name = spanningHeaderNameById.get(header.id) ?? "H?";
          const spanWidthIn = spanningHeaderSpanWidthIn(slots, header);
          return (
            <div key={header.id} className={elevationStyles.beamRow}>
              <div className={elevationStyles.structuralRowHead}>
                <strong>{name}</strong>
                <span className={elevationStyles.structuralValue}>{formatLengthIn(spanWidthIn, unitSystem)}</span>
              </div>
              <label className={elevationStyles.fieldRow}>
                Bottom at
                <LengthInput
                  value={header.heightIn}
                  domain="in"
                  ariaLabel={`Spanning header ${name} bottom height in inches`}
                  title="Height of this header's own bottom face above this story's floor — the panels beneath are built exactly this tall"
                  style={{ width: 60, flex: "0 0 auto" }}
                  onCommit={(next) => handleChangeSpanningHeaderBottomHeight(story, wallId, header.id, next)}
                />
                in
              </label>
              <label className={elevationStyles.fieldRow}>
                Header tall
                <LengthInput
                  value={resolveSpanningHeaderHeightIn(header)}
                  domain="in"
                  ariaLabel={`Spanning header ${name} height in inches`}
                  title={`This header's own assembly height. Building Integrity's stated range is ${bigHeaderHeightInRange.minIn}in-${bigHeaderHeightInRange.maxIn}in, which is still pending their confirmation.`}
                  style={{ width: 60, flex: "0 0 auto" }}
                  onCommit={(next) => handleChangeSpanningHeaderHeight(story, wallId, header.id, next)}
                />
                in
              </label>
              <div className={elevationStyles.beamRowFooter}>
                {/* Committed on blur/Enter, not per keystroke — see
                    SlotIndexInput. As raw number inputs these committed every
                    intermediate state: clearing a field sent `Number("") === 0`
                    and moved the header to the first panel on the wall (a legal
                    index, so nothing refused it), and re-aiming a range could
                    dead-end on an inverted or over-long intermediate. */}
                <label className={elevationStyles.fieldRow}>
                  Spans panels
                  <SlotIndexInput
                    value={header.startSlotIndex}
                    ariaLabel={`Spanning header ${name} first panel`}
                    title="The first panel this header sits on, counting from 0 at the start of the wall. Committed when you leave the field or press Enter."
                    style={{ width: 50 }}
                    onCommit={(next) =>
                      handleChangeSpanningHeaderCoverage(story, wallId, header.id, {
                        startSlotIndex: next,
                        endSlotIndex: header.endSlotIndex,
                      })
                    }
                  />
                  to
                  <SlotIndexInput
                    value={header.endSlotIndex}
                    ariaLabel={`Spanning header ${name} last panel, exclusive`}
                    title="One PAST the last panel this header sits on — 1 to 3 means it sits on panels 1 and 2. Committed when you leave the field or press Enter."
                    style={{ width: 50 }}
                    onCommit={(next) =>
                      handleChangeSpanningHeaderCoverage(story, wallId, header.id, {
                        startSlotIndex: header.startSlotIndex,
                        endSlotIndex: next,
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className={elevationStyles.actionButton}
                  onClick={() => handleRemoveSpanningHeader(story, wallId, header.id)}
                >
                  Remove
                </button>
              </div>
              <p className={elevationStyles.helpText}>
                {spanningHeaderCrossReference.locationByHeaderName.get(name) ?? ""}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  const elevationControls = elevationWall ? (
    <div className={elevationStyles.panel}>
      <div className={elevationStyles.headerRow}>
        <strong>Wall {elevationWall.id} elevation</strong>
        <button type="button" className={elevationStyles.actionButton} onClick={() => setElevationViewWallId(null)}>
          Close
        </button>
      </div>
      <div ref={setElevationToolbarPortalNode} className={styles.toolbarPortalInline} />
      {role === "engineer" && elevationWallBearingAndShear && (
        <div className={elevationStyles.structuralSection}>
          <span className={elevationStyles.sectionLabel}>Estimated Structural Capacity — Wall {elevationWall.id}</span>
          <div className={elevationStyles.structuralRow}>
            <div className={elevationStyles.structuralRowHead}>
              <span>Bearing</span>
              <span className={elevationStyles.structuralValue}>
                {Math.round(elevationWallBearingAndShear.bearingLb).toLocaleString()} lb
              </span>
            </div>
            <p className={elevationStyles.helpText}>
              Across {elevationWallBearingAndShear.eligiblePanelCount} bearing-eligible panel
              {elevationWallBearingAndShear.eligiblePanelCount === 1 ? "" : "s"} on this wall — Building
              Integrity&apos;s own first-pass NDS estimate (double stud pack), not a licensed engineer&apos;s
              calculation.
            </p>
            <span className={elevationStyles.pendingPill}>Pending BI Confirmation</span>
          </div>
          <div className={elevationStyles.structuralRow}>
            <div className={elevationStyles.structuralRowHead}>
              <span>Shear (racking)</span>
              <span className={elevationStyles.structuralValue}>
                {elevationWallBearingAndShear.bracedPanelCount === 0
                  ? "No braced panels on this wall"
                  : `${Math.round(elevationWallBearingAndShear.shearLb).toLocaleString()} lb`}
              </span>
            </div>
            {elevationWallBearingAndShear.bracedPanelCount > 0 && (
              <>
                <p className={elevationStyles.helpText}>
                  Across {elevationWallBearingAndShear.bracedPanelCount} braced panel
                  {elevationWallBearingAndShear.bracedPanelCount === 1 ? "" : "s"} on this wall — Building
                  Integrity&apos;s own first-pass NDS estimate (diagonal brace), not a licensed engineer&apos;s
                  calculation.
                </p>
                <span className={elevationStyles.pendingPill}>Pending BI Confirmation</span>
              </>
            )}
          </div>
        </div>
      )}
      {role === "engineer" && (
        <div className={elevationStyles.structuralSection}>
          <span className={elevationStyles.sectionLabel}>Review Notes — Wall {elevationWall.id}</span>
          {wallReviewNotes.filter((n) => n.wallId === elevationWall.id).length === 0 ? (
            <p className={elevationStyles.helpText}>No notes yet on this wall.</p>
          ) : (
            wallReviewNotes
              .filter((n) => n.wallId === elevationWall.id)
              .map((n) => (
                <div key={n.id} className={elevationStyles.reviewNote}>
                  <p className={elevationStyles.reviewNoteText}>&quot;{n.note}&quot;</p>
                  <div className={elevationStyles.reviewNoteFooter}>
                    <span className={elevationStyles.reviewNoteAuthor}>- {n.author}</span>
                    <button type="button" className={elevationStyles.actionButton} onClick={() => handleRemoveWallReviewNote(n.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
          )}
          <label className={elevationStyles.fieldRow}>
            Author
            <input
              type="text"
              value={draftNoteAuthor}
              onChange={(e) => setDraftNoteAuthor(e.target.value)}
              placeholder="e.g. Eng. Smith"
            />
          </label>
          <textarea
            className={elevationStyles.noteTextarea}
            value={draftNoteText}
            onChange={(e) => setDraftNoteText(e.target.value)}
            placeholder="Add a note for this wall..."
            rows={3}
          />
          <button
            type="button"
            className={elevationStyles.actionButton}
            onClick={() => handleAddWallReviewNote(elevationWall.id)}
            disabled={!draftNoteText.trim()}
          >
            Add Note
          </button>
        </div>
      )}
      <div className={elevationStyles.toggleRow}>
        <label
          className={elevationStyles.checkboxLabel}
          title={!gableEndWallIds.has(elevationWall.id) && gableEndToggleBlockReason(elevationWall.id) ? gableEndToggleBlockReason(elevationWall.id)! : undefined}
        >
          <input
            type="checkbox"
            checked={gableEndWallIds.has(elevationWall.id)}
            disabled={!gableEndWallIds.has(elevationWall.id) && !!gableEndToggleBlockReason(elevationWall.id)}
            onChange={(e) => handleToggleGableEnd(elevationWall.id, e.target.checked)}
          />
          Add Gable End (tiles Gable End Panels up to the Roof tab&apos;s own profile height)
        </label>
        {stories.length > 1 && (
          <label className={elevationStyles.checkboxLabel}>
            <input
              type="checkbox"
              checked={!!boxBeamCoverageByWallId[elevationWall.id]}
              onChange={(e) => handleToggleBoxBeam(elevationWall.id, e.target.checked)}
            />
            Box Beam (replaces this wall&apos;s Truss Plate above the 2nd story row — that row is built shorter to
            still reach the same roofline; drag the green handles below to cover just part of the run)
          </label>
        )}
        <button
          type="button"
          className={elevationStyles.actionButton}
          onClick={handleToggleSecondStory}
          aria-pressed={stories.length > 1}
          title="Stacks a second full pass of wall panels at this wall's own top-plate height (same action as the 2D toolbar's Add Second Story button)."
        >
          {stories.length > 1 ? "Remove Layer" : "Add Layer"}
        </button>
      </div>
      {/* PER-WALL REPANELIZE. Lives here, in the same note every other
          wall-level decision already lives in, because it IS one: it rebuilds
          the wall you are looking at and nothing else.

          ⚠ It deliberately does not clear the pending-settings markers. Those
          mean "the building was not built from these settings", which stays
          true after one wall is rebuilt — see `applyRetiledWall`. */}
      <div className={elevationStyles.beamSection} data-repanelize-wall="">
        <span className={elevationStyles.sectionLabel}>Repanelize — Wall {elevationWall.id}</span>
        <p className={elevationStyles.helpText}>
          Rebuild just this wall&apos;s panels from the current settings, leaving every other wall&apos;s hand edits
          alone. The building-wide <strong>Repanelize</strong> in Wall Assembly does all of them at once.
        </p>
        <button
          type="button"
          className={elevationStyles.actionButton}
          onClick={() => handleRepanelizeRequest(elevationWall.id)}
          title={`Rebuild wall ${elevationWall.id} from the current settings, and no other wall`}
        >
          Repanelize Wall {elevationWall.id}…
        </button>
        {repanelizePrompt?.wallId === elevationWall.id && (
          <div role="alertdialog" aria-label="Confirm repanelize wall" data-repanelize-wall-prompt="">
            <p className={elevationStyles.helpText}>{repanelizePrompt.text}</p>
            {/* Said out loud for the same reason the building-wide prompt says
                it: a user who does not know this is one undo entry will not
                risk the click, and being able to try it is the whole point. */}
            <p className={elevationStyles.helpText}>One undo press puts it back.</p>
            <button type="button" className={elevationStyles.actionButton} onClick={handleRepanelizeConfirm}>
              {repanelizePrompt.changedCount === 0 ? "Repanelize anyway" : `Repanelize wall ${elevationWall.id}`}
            </button>
            <button type="button" className={elevationStyles.actionButton} onClick={() => setRepanelizePrompt(null)}>
              Cancel
            </button>
          </div>
        )}
      </div>
      {/* Stage 3 — stop this wall short. Two fields, one per end, in the
          same note every other wall-level decision already lives in. Not a
          checkbox and not a mode: a stop is a LENGTH, and zero is the
          normal state, so the field's own value says everything there is to
          say about whether the wall is complete. */}
      <div className={elevationStyles.beamSection}>
        <span className={elevationStyles.sectionLabel}>Stop Wall — Wall {elevationWall.id}</span>
        <p className={elevationStyles.helpText}>
          How much of this wall is deliberately NOT built (Tommy: &ldquo;a stop wall tool so that it is possible to make
          incomplete walls&rdquo;). The building&apos;s shape does not change — the floor, foundation and roof still reach
          the full wall line, and the span draws as a dashed boundary with its own <strong>NO PANELS</strong> dimension.
          A stop that reaches a corner takes that corner panel with it.
        </p>
        <label style={{ display: "block", marginTop: 6 }}>
          Unbuilt at the start end{" "}
          <LengthInput
            id={`wall-run-stop-start-${elevationWall.id}`}
            title="Inches in from this wall's start corner that carry no panels. 0 builds the whole end."
            // The value actually IN EFFECT (grid-snapped, and clamped if the
            // wall has since been shortened under it), never the raw stored
            // number — showing one number while using another is the exact
            // failure `LengthInput` exists to remove.
            value={wallGeometryFor(elevationWall.id)?.startStopIn ?? 0}
            domain="in"
            ariaLabel="Unbuilt span at the wall's start end, in inches"
            style={{ width: 72 }}
            validate={(next) => wallRunStopRefusalMessage(elevationWall.id, "start", next)}
            onCommit={(next) => handleSetWallRunStop(elevationWall.id, "start", next)}
          />
        </label>
        <label style={{ display: "block", marginTop: 6 }}>
          Unbuilt at the far end{" "}
          <LengthInput
            id={`wall-run-stop-end-${elevationWall.id}`}
            title="Inches in from this wall's far corner that carry no panels. 0 builds the whole end."
            value={wallGeometryFor(elevationWall.id)?.endStopIn ?? 0}
            domain="in"
            ariaLabel="Unbuilt span at the wall's far end, in inches"
            style={{ width: 72 }}
            validate={(next) => wallRunStopRefusalMessage(elevationWall.id, "end", next)}
            onCommit={(next) => handleSetWallRunStop(elevationWall.id, "end", next)}
          />
        </label>
        {hasWallRunStop(wallRunStopsByWallId[elevationWall.id]) && (
          <p className={elevationStyles.helpText}>
            {formatLengthIn(
              (wallGeometryFor(elevationWall.id)?.startStopIn ?? 0) + (wallGeometryFor(elevationWall.id)?.endStopIn ?? 0),
              unitSystem,
            )}{" "}
            of this{" "}
            {formatFeetInches(elevationWall.lengthFt)} wall carries no panels
            {wallGeometryFor(elevationWall.id)?.fullyStopped
              ? " — this edge has no wall of ours on it at all."
              : `; the remaining ${formatLengthIn(wallGeometryFor(elevationWall.id)?.lengthIn ?? 0, unitSystem)} is panelized normally.`}{" "}
            This wall is listed in the Review Log as an incomplete design.{" "}
            {(() => {
              // Tommy, 2026-09-29: an opening inside the unbuilt span is not
              // built and IS remembered. Saying so here is the difference
              // between a non-destructive decision and one that looks like it
              // ate a window.
              //
              // ⚠ **"back exactly as drawn" is conditional**, and this notice
              // and the Review Log entry read the same answer for it — see
              // `runStopNotices.ts`. It used to promise exactness
              // unconditionally, which a delete or an insert on the wall while
              // it was stopped makes false.
              // Same correction as the Review Log entry above — see its note.
              const byStory: WithheldOpeningsOnStory[] = stories.map((s) => {
                const held = stoppedSlotsByStoryAndWallId[s.id]?.[elevationWall.id];
                return {
                  story: s.id,
                  count: withheldOpeningCount(held),
                  fidelity: stoppedSlotsRestoreFidelity(held),
                };
              });
              const withheld = withheldOpeningTotal(byStory);
              if (withheld === 0) return null;
              return (
                <>
                  <strong>
                    {withheld} {withheld === 1 ? "opening" : "openings"}
                  </strong>{" "}
                  {withheldOpeningsElevationClause(byStory)}{" "}
                </>
              );
            })()}
            <button
              type="button"
              className={elevationStyles.actionButton}
              onClick={() => handleClearWallRunStop(elevationWall.id)}
            >
              Build the whole wall
            </button>
          </p>
        )}
      </div>
      {renderMidWallBeamSection(elevationWall.id, "ground", midWallBeamsByStoryAndWallId.ground[elevationWall.id] ?? [], wallHeightFt * 12)}
      {stories.length > 1 &&
        renderMidWallBeamSection(
          elevationWall.id,
          "second",
          midWallBeamsByStoryAndWallId.second[elevationWall.id] ?? [],
          (secondStory?.wallHeightFt ?? wallHeightFt) * 12,
        )}
      {renderSpanningHeaderSection(elevationWall.id, "ground", spanningHeadersByStoryAndWallId.ground[elevationWall.id] ?? [])}
      {stories.length > 1 &&
        renderSpanningHeaderSection(elevationWall.id, "second", spanningHeadersByStoryAndWallId.second[elevationWall.id] ?? [])}
      {/* Smearforn Stage 2 (Tommy: "select which type of panel you want to
          add, and then click where to put it. This would either replace a
          panel or add one between"). Corner and Safety Gap are deliberately
          absent from this roster — see PLACEABLE_PANEL_TYPES. */}
      <div className={elevationStyles.beamSection}>
        <div className={elevationStyles.sectionHeader}>
          <span className={elevationStyles.sectionLabel}>Place a panel</span>
          {/* Wraps: ten buttons do not fit across a 240px sidebar in one
              row, and `.toolbar` itself is used by rows of two or three
              elsewhere, so the wrap belongs here rather than on the class. */}
          <div role="group" aria-label="Panel placement tool" className={styles.toolbar} style={{ flexWrap: "wrap", gap: 6 }}>
            {PANEL_PLACEMENT_TOOL_OPTIONS.map((option) => {
              const active =
                panelPlacementTool?.mode === "place" &&
                panelPlacementTool.type === option.type &&
                panelPlacementTool.bracedPattern === option.bracedPattern &&
                panelPlacementTool.bracedMirrored === option.bracedMirrored;
              return (
                <button
                  key={option.key}
                  type="button"
                  title={option.title}
                  aria-pressed={active}
                  className={active ? styles.toolActive : styles.tool}
                  onClick={() =>
                    setPanelPlacementTool(
                      active
                        ? null
                        : {
                            mode: "place",
                            type: option.type,
                            bracedPattern: option.bracedPattern,
                            bracedMirrored: option.bracedMirrored,
                          },
                    )
                  }
                >
                  {option.label}
                </button>
              );
            })}
            <button
              type="button"
              title="Click a panel to delete it. Its width goes back to the automatic panels on this wall and the run re-tiles; the wall's own length never moves."
              aria-pressed={panelPlacementTool?.mode === "delete"}
              className={panelPlacementTool?.mode === "delete" ? styles.toolActive : styles.tool}
              onClick={() => setPanelPlacementTool((prev) => (prev?.mode === "delete" ? null : { mode: "delete" }))}
            >
              Delete
            </button>
          </div>
          <p className={elevationStyles.helpText}>
            {panelPlacementTool === null
              ? "Pick a type, then click a panel on the drawing below to replace it, or a dashed boundary to insert between. Click the same button again to put the tool away."
              : panelPlacementTool.mode === "delete"
                ? "Click a panel below to delete it. Corner and safety-gap panels are placed by rule and can't be deleted."
                : "Click a panel below to replace it, or a dashed boundary to insert between. A new panel is born hand-set at the project's Standard width (a Column and a Big Header at their own); that width comes out of the automatic panels on this wall, and if they can't cover it the insert is refused. The panel-boundary drag is off while this tool is armed."}
          </p>
          {panelPlacementNotice && <p className={elevationStyles.clampedText}>{panelPlacementNotice}</p>}
        </div>
      </div>
      <div className={elevationStyles.toggleRow}>
        <button type="button" className={elevationStyles.actionButton} onClick={() => handleAddBigHeaderPanel("ground", elevationWall.id)}>
          + Add Big Header
        </button>
        {stories.length > 1 && (
          <button type="button" className={elevationStyles.actionButton} onClick={() => handleAddBigHeaderPanel("second", elevationWall.id)}>
            + Add Big Header (2nd story)
          </button>
        )}
        <p className={elevationStyles.helpText}>
          A standalone header + 2 jack studs unit (no rough opening below it needed) — {bigHeaderHeightInRange.minIn / 12}
          -{bigHeaderHeightInRange.maxIn / 12}ft tall, {bigHeaderWidthInRange.minIn / 12}-{bigHeaderWidthInRange.maxIn / 12}
          ft wide, no sill by default. Also reachable by clicking through a standard/braced panel&apos;s own type cycle,
          or automatically when a window/door header&apos;s single brace angle falls out of range.
        </p>
      </div>
      {!gableEndWallIds.has(elevationWall.id) && gableEndToggleBlockReason(elevationWall.id) && (
        <p className={elevationStyles.warningText}>{gableEndToggleBlockReason(elevationWall.id)}</p>
      )}
      {gableEndWallIds.has(elevationWall.id) && gableEndClampedWallIds.has(elevationWall.id) && (
        <p className={elevationStyles.clampedText}>
          This wall&apos;s roofline rises higher than the {maxGablePanelHeightIn}in max a single Gable End Panel can
          be built at — the real remainder is filled by a vertical safety-gap tile (shown below), not clipped.
        </p>
      )}
      {gableEndWallIds.has(elevationWall.id) && (
        <>
          <button
            type="button"
            className={elevationStyles.actionButton}
            aria-pressed={adjustingGableMaxHeight}
            onClick={() => setAdjustingGableMaxHeight((v) => !v)}
            title="Drag the highlighted line below to set the max Gable End Panel height (in) — it snaps to whichever height makes the panel under it perfectly flat (its own shorter true edge), applies to every gable-enabled wall project-wide."
          >
            {adjustingGableMaxHeight ? "Done Adjusting Max Height" : "Adjust Max Height"}
          </button>
          {adjustingGableMaxHeight && (
            <p className={elevationStyles.note}>
              Drag the highlighted line on the diagram below — it snaps to the height that makes the panel under it
              flat, one wall run at a time.
            </p>
          )}
        </>
      )}
      {gableEndWallIds.has(elevationWall.id) && isShorterDimensionWall(elevationWall.id) && (
        <div className={elevationStyles.toggleRow}>
          <label className={elevationStyles.checkboxLabel}>
            <input
              type="checkbox"
              checked={gableStructuralPanelWallIds.has(elevationWall.id)}
              onChange={(e) => handleToggleGableStructuralPanel(elevationWall.id, e.target.checked)}
            />
            Panels/beam (spawns a real Column Panel centered under the peak, on both the gable tile and the main wall
            level below it, instead of open truss framing)
          </label>
        </div>
      )}
      {gableEndWallIds.size === 2 && (
        <div className={elevationStyles.toggleRow}>
          <label className={elevationStyles.checkboxLabel}>
            <input type="checkbox" checked={gableMirrorLinked} onChange={(e) => setGableMirrorLinked(e.target.checked)} />
            Mirror gable ends together (roofline edits on this wall also move the opposite gable wall's own — turn off
            to edit each independently)
          </label>
        </div>
      )}
      <div role="group" aria-label="Roofline anchor" className={styles.toolbar}>
        <span style={{ fontSize: 13, marginRight: 4 }}>Roofline starts at:</span>
        <button
          type="button"
          aria-pressed={roofBearingAnchorMode === "truss-heel"}
          className={roofBearingAnchorMode === "truss-heel" ? styles.toolActive : styles.tool}
          onClick={() => setRoofBearingAnchorMode("truss-heel")}
          title="The roofline runs flat for one full panel width from each unclaimed corner, then rises Heel height above the eave — gable panels meet flush with the top of the trusses."
        >
          Truss heel height
        </button>
        <button
          type="button"
          aria-pressed={roofBearingAnchorMode === "panel-depth"}
          className={roofBearingAnchorMode === "panel-depth" ? styles.toolActive : styles.tool}
          onClick={() => setRoofBearingAnchorMode("panel-depth")}
          title="The roofline rises flush at the plain eave height, starting right at the truss seat depth set below (no raised heel) — gable panels meet flush with the trusses' own inside edge."
        >
          Truss seat depth
        </button>
      </div>
      {gableEndWallIds.has(elevationWall.id) &&
        (() => {
          const wallWidthIn = elevationWall.lengthFt * 12;
          const { pointCount, resolvedPointXsIn, pointIsSnapped, isShedRoof } = resolveGableProfilePoints(
            roofProfilePointHeightsFt,
            gableProfilePositionsInByWallId[elevationWall.id] ?? [],
            wallWidthIn,
          );
          const singlePeakHeightIn = gableEaveHeightIn + (roofProfilePointHeightsFt[0] ?? 0) * 12;
          const showColumnPanel = roofProfileType === "peaked" && !isShedRoof && gableStructuralPanelWallIds.has(elevationWall.id);
          const columnHeightIn = singlePeakHeightIn - GABLE_COLUMN_FLAT_TOP_DROP_IN;
          const tileCount = (gableTilesByWallId[elevationWall.id] ?? []).length;
          const ridgeHeightIn = gableEaveHeightIn + (roofProfilePointHeightsFt[0] ?? 0) * 12;
          return (
            <>
              {roofProfilePointHeightsFt.map((_, i) => (
                <div key={i} className={elevationStyles.pointRow}>
                  <span className={elevationStyles.pointLabel}>{pointCount === 1 ? "Peak" : `Point ${i + 1}`}</span>
                  <label className={elevationStyles.fieldRow}>
                    Position
                    <input
                      type="range"
                      className={elevationStyles.rangeInput}
                      min={0}
                      max={wallWidthIn}
                      step={1}
                      value={resolvedPointXsIn[i]}
                      onChange={(e) => handleChangeGableProfilePositionIn(elevationWall.id, i, Number(e.target.value))}
                    />
                  </label>
                  <label className={elevationStyles.fieldRow}>
                    From left end
                    <LengthInput
                      value={resolvedPointXsIn[i]!}
                      domain="in"
                      ariaLabel={`Gable profile point ${i + 1} distance from the left end, in inches`}
                      title={`0 to ${formatLengthIn(wallWidthIn, unitSystem)} along the wall — advisory, nothing clamps this`}
                      style={{ width: 60, flex: "0 0 auto" }}
                      onCommit={(next) => handleChangeGableProfilePositionIn(elevationWall.id, i, next)}
                    />
                    in
                  </label>
                  <label className={elevationStyles.fieldRow}>
                    From right end
                    <LengthInput
                      value={wallWidthIn - resolvedPointXsIn[i]!}
                      domain="in"
                      ariaLabel={`Gable profile point ${i + 1} distance from the right end, in inches`}
                      title={`0 to ${formatLengthIn(wallWidthIn, unitSystem)} along the wall — advisory, nothing clamps this`}
                      style={{ width: 60, flex: "0 0 auto" }}
                      onCommit={(next) => handleChangeGableProfilePositionIn(elevationWall.id, i, wallWidthIn - next)}
                    />
                    in
                  </label>
                  {pointCount === 1 ? (
                    <label className={elevationStyles.fieldRow}>
                      Centered Peak
                      <select
                        className={elevationStyles.pitchSelect}
                        value=""
                        onChange={(e) => {
                          const pitchIn12 = Number(e.target.value);
                          if (pitchIn12) handleSetCenteredPeakPitch(elevationWall, pitchIn12);
                        }}
                        title="Re-centers this peak, then sets its own height so both sides share this pitch over half the wall's width"
                      >
                        <option value="">Pick a pitch…</option>
                        {ROOF_PITCH_OPTIONS_IN12.map((p) => (
                          <option key={p} value={p}>
                            {p}/12
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <button
                      type="button"
                      className={elevationStyles.actionButton}
                      onClick={() => handleChangeGableProfilePositionIn(elevationWall.id, i, undefined)}
                    >
                      Center
                    </button>
                  )}
                  {i === 0 && (
                    <label className={elevationStyles.fieldRow}>
                      Shed
                      <select
                        className={elevationStyles.pitchSelect}
                        value=""
                        onChange={(e) => {
                          const pitchIn12 = Number(e.target.value);
                          if (pitchIn12) handleSetShedPitch(elevationWall, i, pitchIn12);
                        }}
                        title="Snaps this point to the wall's start edge, then sets its own height for this pitch across the wall's full width"
                      >
                        <option value="">Pick a pitch…</option>
                        {ROOF_PITCH_OPTIONS_IN12.map((p) => (
                          <option key={p} value={p}>
                            {p}/12
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {pointIsSnapped[i] && <span className={elevationStyles.warningText}>Snapped to a shed (single slope) on this side</span>}
                </div>
              ))}
              <p className={elevationStyles.trailingNote}>
                {`${tileCount} Gable End Panel${tileCount === 1 ? "" : "s"} (incl. any safety-gap tiles) tiled at ~${standardWidthIn}in each, ` +
                  `rising from the ${gableEaveHeightIn}in eave to ${pointCount === 1 ? `the ${ridgeHeightIn}in ridge` : "the flat-topped roofline above"}` +
                  (isShedRoof ? " (at least one side snapped to a single-slope shed)." : ".") +
                  " Each panel's rip angle/length is labeled above it. Drag a red marker, use its own slider, " +
                  "or type an exact distance from either end — dragging one within " +
                  `${GABLE_SHED_SNAP_THRESHOLD_IN}in of its own nearest end (shaded above) snaps that side to a shed roof. Use the Roof tab to change ` +
                  "profile heights/type, or the panel-width setting above to change the tiling." +
                  (showColumnPanel
                    ? ` A ${columnHeightIn.toFixed(1)}in Column Panel is centered under the peak, ${GABLE_COLUMN_FLAT_TOP_DROP_IN}in ` +
                      "shorter than the ridge so its top can catch the roof-catcher beam — a matching Column Panel is also on the main wall " +
                      "level below, flush with its own bottom edge."
                    : roofProfileType === "flat-top"
                      ? " No Column Panel for a flat-topped roofline (no single peak for a beam to reference)."
                      : isShedRoof
                        ? " No Column Panel for a shed roof (single slope, no peak to bear a beam under)."
                        : " No Column Panel — this wall's own \"Panels/beam\" toggle above is off (open truss framing instead).")}
              </p>
            </>
          );
        })()}
      {gableEndWallIds.has(elevationWall.id) && (gableWindowAnchorsByWallId[elevationWall.id]?.length ?? 0) > 0 && (
        <div className={elevationStyles.beamSection}>
          <strong>Gable Windows</strong>
          <p className={elevationStyles.note}>
            Click a Gable End Panel tile below to turn it into a window (or click a window tile again to turn it back
            into a plain panel). Width is capped at {panelWidthInRange.maxIn}in (4ft).
          </p>
          {gableWindowAnchorsByWallId[elevationWall.id]!.map((w) => (
            <div key={w.beforeTileCount} className={elevationStyles.beamRow}>
              <label className={elevationStyles.fieldRow}>
                Width
                <LengthInput
                  value={w.widthIn}
                  domain="in"
                  ariaLabel="Gable window width in inches"
                  style={{ width: 60, flex: "0 0 auto" }}
                  onCommit={(next) => handleSetGableWindowField(elevationWall.id, w.beforeTileCount, "widthIn", next)}
                />
                in
              </label>
              <label className={elevationStyles.fieldRow}>
                Height (RO)
                <LengthInput
                  value={w.heightIn ?? standardWindowHeightDefaultIn.value}
                  domain="in"
                  ariaLabel="Gable window rough-opening height in inches"
                  title="At least 12in — advisory; the handler only enforces a floor of 0"
                  style={{ width: 60, flex: "0 0 auto" }}
                  onCommit={(next) => handleSetGableWindowField(elevationWall.id, w.beforeTileCount, "heightIn", next)}
                />
                in
              </label>
              <label className={elevationStyles.fieldRow}>
                Sill height
                <LengthInput
                  value={w.sillHeightIn ?? sillDefaultHeightIn.value}
                  domain="in"
                  ariaLabel="Gable window sill height in inches"
                  style={{ width: 60, flex: "0 0 auto" }}
                  onCommit={(next) => handleSetGableWindowField(elevationWall.id, w.beforeTileCount, "sillHeightIn", next)}
                />
                in
              </label>
              <button
                type="button"
                className={elevationStyles.actionButton}
                onClick={() => handleToggleGableWindow(elevationWall.id, w.beforeTileCount, w.widthIn)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {!gableEndWallIds.has(elevationWall.id) && (
        <p className={elevationStyles.trailingNote}>
          Ground-floor run shown for reference (cycle panel types in the Wall tab, not here). Toggle &quot;Add Gable
          End&quot; above to preview a tiled row of Gable End Panels rising to the Roof tab&apos;s own profile
          height.
        </p>
      )}
    </div>
  ) : null;

  // One representative truss's own member geometry + peak height, at the
  // real resolved span/pitch (roofTrussLayoutContext) — shared by the Roof
  // tab's own live canvas and its PDF-exportable page below, so both always
  // show the exact same truss. peakHeightInAt (classic) / overallDimensions
  // .heightIn (high-perf schema builders) already encode each style's own
  // ridge-height formula — not re-derived here.
  const roofTrussBuiltMembers = useMemo(() => {
    if (!roofTrussLayoutContext) return null;
    const { spanIn, pitchIn12 } = roofTrussLayoutContext;
    if (roofTrussCategory === "classic") {
      return { members: selectedClassicTruss.build(spanIn, pitchIn12), peakHeightIn: selectedClassicTruss.peakHeightInAt(spanIn, pitchIn12) };
    }
    const schema =
      highPerfTrussTypeId === "energy-heel"
        ? buildEnergyHeelTrussSchema(spanIn, pitchIn12, highPerfTrussCavityDepthIn, highPerfTrussBearingShapeId)
        : buildParallelChordTrussSchema(spanIn, pitchIn12, highPerfTrussCavityDepthIn, highPerfTrussBearingShapeId);
    return { members: schema.members, peakHeightIn: schema.overallDimensions.heightIn };
  }, [roofTrussLayoutContext, roofTrussCategory, selectedClassicTruss, highPerfTrussTypeId, highPerfTrussCavityDepthIn, highPerfTrussBearingShapeId]);

  // Roof tab's own truss layout sidebar section (Tommy: "all the options on
  // the left bar") — mirrors elevationControls' own persistent-sidebar
  // pattern just above. A single flat button group covers all 8 styles (6
  // classic + 2 high-performance); picking one sets both roofTrussCategory
  // and that category's own id together.
  const roofTrussControls =
    editorTab === "roof" && roofSystemTypeId === "truss" ? (
      <div className={elevationStyles.panel}>
        <strong>Truss layout</strong>
        <div role="group" aria-label="Truss style" className={styles.toolbar}>
          {CLASSIC_TRUSS_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={roofTrussCategory === "classic" && selectedClassicTrussId === t.id}
              className={roofTrussCategory === "classic" && selectedClassicTrussId === t.id ? styles.toolActive : styles.tool}
              onClick={() => {
                setRoofTrussCategory("classic");
                setSelectedClassicTrussId(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={roofTrussCategory === "high-perf" && highPerfTrussTypeId === "energy-heel"}
            className={roofTrussCategory === "high-perf" && highPerfTrussTypeId === "energy-heel" ? styles.toolActive : styles.tool}
            onClick={() => {
              setRoofTrussCategory("high-perf");
              setHighPerfTrussTypeId("energy-heel");
            }}
          >
            Energy-Heel (Gable)
          </button>
          <button
            type="button"
            aria-pressed={roofTrussCategory === "high-perf" && highPerfTrussTypeId === "parallel-chord"}
            className={roofTrussCategory === "high-perf" && highPerfTrussTypeId === "parallel-chord" ? styles.toolActive : styles.tool}
            onClick={() => {
              setRoofTrussCategory("high-perf");
              setHighPerfTrussTypeId("parallel-chord");
            }}
          >
            Parallel Chord (Shed)
          </button>
        </div>
        <p className={styles.note}>{roofTrussCategory === "classic" ? selectedClassicTruss.description : CLASSIC_TRUSS_DISCLAIMER}</p>

        {roofTrussCategory === "high-perf" && (
          <>
            <div role="group" aria-label="Insulation cavity depth" className={styles.toolbar}>
              {HIGH_PERF_TRUSS_CAVITY_DEPTH_OPTIONS_IN.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={highPerfTrussCavityDepthIn === d}
                  className={highPerfTrussCavityDepthIn === d ? styles.toolActive : styles.tool}
                  onClick={() => setHighPerfTrussCavityDepthIn(d)}
                >
                  {d}in cavity
                </button>
              ))}
            </div>
            <div role="group" aria-label="Truss bearing member" className={styles.toolbar}>
              {HIGH_PERF_TRUSS_BEARING_SHAPES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={highPerfTrussBearingShapeId === b.id}
                  className={highPerfTrussBearingShapeId === b.id ? styles.toolActive : styles.tool}
                  onClick={() => setHighPerfTrussBearingShapeId(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div role="group" aria-label="Truss spacing" className={styles.toolbar}>
          <span style={{ fontSize: 13, marginRight: 4 }}>Spacing:</span>
          {ROOF_TRUSS_SPACING_OPTIONS_IN.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={roofTrussSpacingIn === s}
              className={roofTrussSpacingIn === s ? styles.toolActive : styles.tool}
              onClick={() => setRoofTrussSpacingIn(s)}
            >
              {s}in o.c.
            </button>
          ))}
        </div>

        <div role="group" aria-label="Truss doubling" className={styles.toolbar}>
          <span style={{ fontSize: 13, marginRight: 4 }}>Doubling:</span>
          <button
            type="button"
            aria-pressed={roofTrussDoublingStrategy === "single"}
            className={roofTrussDoublingStrategy === "single" ? styles.toolActive : styles.tool}
            onClick={() => setRoofTrussDoublingStrategy("single")}
          >
            Single
          </button>
          <button
            type="button"
            aria-pressed={roofTrussDoublingStrategy === "doubled-ends"}
            className={roofTrussDoublingStrategy === "doubled-ends" ? styles.toolActive : styles.tool}
            onClick={() => setRoofTrussDoublingStrategy("doubled-ends")}
          >
            Doubled at Ends
          </button>
          <button
            type="button"
            aria-pressed={roofTrussDoublingStrategy === "doubled-all"}
            className={roofTrussDoublingStrategy === "doubled-all" ? styles.toolActive : styles.tool}
            onClick={() => setRoofTrussDoublingStrategy("doubled-all")}
          >
            Every Truss Doubled
          </button>
        </div>

        {!roofTrussLayoutContext && (
          <p className={styles.note}>
            Select two opposite gable end walls from their Elevation views (Wall tab), with a Peaked roofline profile, to enable the truss layout
            preview.
          </p>
        )}
      </div>
    ) : null;

  // Floor tab's own Bale Foundation sidebar section (Tommy: "the top
  // framing member, bottom framing member, and gap to be ui changable...
  // single framing members span the rest of the space on a left bar
  // selectable 16" or 24" spacing") — mirrors roofTrussControls' own
  // persistent-sidebar pattern just above.
  const baleFoundationControls =
    editorTab === "floor" && isBaleFoundationFloor ? (
      <div className={elevationStyles.panel}>
        <strong>Bale foundation framing</strong>
        <label>
          Top framing member depth (in){" "}
          <LengthInput
            value={baleFoundationTopDepthIn}
            domain="in"
            ariaLabel="Bale foundation top framing member depth in inches"
            title="At least 1.5in — advisory; the handler only enforces a floor of 0"
            onCommit={(next) => setBaleFoundationTopDepthIn(Math.max(0, next))}
          />
        </label>
        <label>
          Bottom framing member depth (in){" "}
          <LengthInput
            value={baleFoundationBottomDepthIn}
            domain="in"
            ariaLabel="Bale foundation bottom framing member depth in inches"
            title="At least 1.5in — advisory; the handler only enforces a floor of 0"
            onCommit={(next) => setBaleFoundationBottomDepthIn(Math.max(0, next))}
          />
        </label>
        <label>
          Gap (in){" "}
          <LengthInput
            value={baleFoundationGapIn}
            domain="in"
            ariaLabel="Bale foundation framing stack gap in inches"
            onCommit={(next) => setBaleFoundationGapIn(Math.max(0, next))}
          />
        </label>
        <p className={styles.note}>
          One framing stack = top board + this gap (with blocking every {BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN}in) + bottom board, standing on
          edge — {baleFoundationStackHeightIn.toFixed(2)}in tall total. The top board&apos;s own top face sits at the wall&apos;s toe-up bottom
          minus the subfloor depth ({SUBFLOOR_DEPTH_DEFAULT_IN}in) — see the cross-section below.
        </p>
        <div role="group" aria-label="Field framing spacing" className={styles.toolbar}>
          <span style={{ fontSize: 13, marginRight: 4 }}>Field spacing:</span>
          {BALE_FOUNDATION_FIELD_SPACING_OPTIONS_IN.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={baleFoundationFieldSpacingIn === s}
              className={baleFoundationFieldSpacingIn === s ? styles.toolActive : styles.tool}
              onClick={() => setBaleFoundationFieldSpacingIn(s)}
            >
              {s}in o.c.
            </button>
          ))}
        </div>
        <p className={styles.note}>
          2 concentric doubled rings bracket the wall, one under each wythe — the outer flush with the wall&apos;s exterior face, the inner
          flush with its interior face, leaving a {(thicknessIn - baleFoundationPlan.ringWidthIn).toFixed(1)}in clear span between them at the
          current {thicknessIn}in panel depth. Single field stacks fill the interior span inboard of the inner ring, at the spacing above.
        </p>
        {footprint ? (
          <p className={styles.note}>
            {baleFoundationBoardCount} boards ({baleFoundationLumberVolumeFt3.toFixed(1)} ft3 total).
          </p>
        ) : (
          <p className={styles.note}>Draw a footprint to see the real board count.</p>
        )}
        <label className={elevationStyles.checkboxLabel}>
          <input type="checkbox" checked={floorBottomSkinEnabled} onChange={(e) => setFloorBottomSkinEnabled(e.target.checked)} />
          Rodent &amp; air-sealed steel + clay bottom skin
        </label>
        <p className={styles.note}>
          Galvanized welded wire mesh stapled to the underside of the lowest framing member, with a clay coat over it — real
          quantities/cost via the same Plaster Master calculator the wall finishes use. See the Plaster Master Detail Guide page.
        </p>
      </div>
    ) : null;

  // Wall Assembly — moved here from the floating "Wall Assembly" note
  // (Tommy: "work the contents of the Wall Assembly into the editor tab on
  // the left when working on 3D Wraps"), same persistent-sidebar pattern as
  // foundationControls/floorToolsControls. Only rendered while the Wall
  // tab's own viewer is on the Membranes (formerly "3D Wraps") stop —
  // `showWraps` — since that's the one place these checkboxes' own visual
  // effect (wrapSkins in Building3DView) is actually visible; every other
  // stop leaves this same state untouched but out of the way.
  /* 3D layer visibility. Only offered for decks that are in the scope of
     work — an unchecked Floors box means there is no floor to show, so a
     toggle for one would be a dead control. */
  const deckLayerControls =
    floorsEnabled || roofEnabled ? (
      <div className={elevationStyles.panel}>
        <strong>3D Layers</strong>
        <p className={styles.note}>
          What the viewer draws besides the walls. Turn a deck off to see inside the building — a floor or roof
          deck is solid and will hide everything under it.
        </p>
        {floorsEnabled && (
          <label style={{ display: "block" }}>
            <input type="checkbox" checked={showFloorDeck3D} onChange={(e) => setShowFloorDeck3D(e.target.checked)} />{" "}
            Floor panels
          </label>
        )}
        {roofEnabled && (
          <label style={{ display: "block" }}>
            <input type="checkbox" checked={showRoofDeck3D} onChange={(e) => setShowRoofDeck3D(e.target.checked)} />{" "}
            Roof panels
          </label>
        )}
        {roofEnabled && showRoofDeck3D && (
          <label style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={showRoofDeck3DSolid}
              onChange={(e) => setShowRoofDeck3DSolid(e.target.checked)}
            />{" "}
            Solid roof (off = see through one half)
          </label>
        )}
        {roofEnabled && showRoofDeck3D && roofTrussLayoutContext === null && (
          <p className={styles.disclaimer}>
            ⚠ Not drawn on this building. Roof panels are laid on the roof&apos;s own planes now, which needs a
            resolvable pitch — today that means two opposite Gable End walls and a Peaked roofline profile. Add
            those and the deck appears, on the slope.
          </p>
        )}
        {roofEnabled && showRoofDeck3D && roofTrussLayoutContext !== null && (
          <p className={styles.note}>
            Laid on the roof&apos;s two planes at {roofTrussLayoutContext.pitchIn12.toFixed(1)}/12, panels spanning
            up the slope from each eave to the ridge.
          </p>
        )}
      </div>
    ) : null;

  const wallAssemblyControls = (
    <div className={elevationStyles.panel}>
      <strong>Wall Assembly</strong>
      <p className={styles.note}>
        Check every finish/product this wall assembly actually uses — when several are checked on one side, the
        perm-rating check below uses whichever is most vapor-restrictive as that side&apos;s effective layer.
        Checking a product with a known coverage rule (Intello, Exto Seal, Tescon Vana) auto-computes how much of
        it this building needs.
      </p>
      <fieldset>
        <legend>Interior</legend>
        {interiorLayers.map((l) => (
          <label key={l.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={checkedInteriorIds.has(l.id)}
              onChange={(e) =>
                setCheckedInteriorIds((was) => {
                  const next = new Set(was);
                  if (e.target.checked) next.add(l.id);
                  else next.delete(l.id);
                  return next;
                })
              }
            />{" "}
            {l.label}
            {l.id === "exto-seal" && checkedInteriorIds.has("exto-seal") && (
              <span className={styles.note}> — {extoSealLengthFt.toFixed(1)}ft needed (sill perimeter + 1ft/opening)</span>
            )}
            {l.id === "intello-plus" && checkedInteriorIds.has("intello-plus") && (
              <span className={styles.note}>
                {" "}
                — {intelloCoverage.areaSqFt.toFixed(0)} sqft ({(intelloCoverage.areaSqFt - intelloRoofAreaSqFt).toFixed(0)} wall +{" "}
                {intelloRoofAreaSqFt.toFixed(0)} roof, flat plan-view placeholder — not modeled roof slope)
              </span>
            )}
            {l.id === "tescon-vana" && checkedInteriorIds.has("tescon-vana") && (
              <span className={styles.note}>
                {" "}
                —{" "}
                {checkedInteriorIds.has("intello-plus")
                  ? `${intelloCoverage.seamLengthFt.toFixed(1)}ft of seams (fewest-seams layout)`
                  : "Intello isn't checked, so no seams to tape yet"}
              </span>
            )}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Exterior</legend>
        {exteriorLayers.map((l) => (
          <label key={l.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={checkedExteriorIds.has(l.id)}
              onChange={(e) =>
                setCheckedExteriorIds((was) => {
                  const next = new Set(was);
                  if (e.target.checked) next.add(l.id);
                  else next.delete(l.id);
                  return next;
                })
              }
            />{" "}
            {l.label}
            {l.id === "exto-seal" && checkedExteriorIds.has("exto-seal") && (
              <span className={styles.note}> — {extoSealLengthFt.toFixed(1)}ft needed (sill perimeter + 1ft/opening)</span>
            )}
          </label>
        ))}
      </fieldset>
      <label>
        Season{" "}
        <select value={season} onChange={(e) => setSeason(e.target.value as Season)}>
          <option value="winter">Winter</option>
          <option value="summer">Summer</option>
        </select>
      </label>
    </div>
  );

  // Foundation Tools — moved here from the floating "editor-tools" note
  // (Tommy: "lets move foundation tools right bar note into the foundation
  // editors left bar"), same persistent-sidebar pattern as elevationControls.
  const foundationControls =
    editorTab === "foundation" ? (
      <div className={elevationStyles.panel}>
        <strong>Foundation Tools</strong>
        <div ref={setFoundationToolbarPortalNode} className={styles.toolbarPortalInline} />
        {foundationType.usesPierGrid ? (
          <>
            <div role="group" aria-label="Foundation tool" className={styles.toolbar}>
              <label>
                Pier spacing{" "}
                <select value={pierSpacingFt} onChange={(e) => setPierSpacingFt(Number(e.target.value))}>
                  {pierSpacingOptionsFt.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft} ft o.c.
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className={styles.note}>
              {pierGrid.length} piers derived from the footprint above at max {pierSpacingFt}ft spacing ({foundationType.label}). See
              Detail Guide Pages below for the full load path.
            </p>
          </>
        ) : foundationType.loadPath.length > 0 ? (
          <p className={styles.note}>{foundationType.label} doesn&apos;t use a pier grid — see the Detail Guide Pages section below for its construction detail.</p>
        ) : (
          <p className={styles.pending}>
            {foundationType.label} doesn&apos;t use a pier grid, and its construction isn&apos;t modeled yet — {foundationType.vaporNote}
          </p>
        )}
        {foundationType.loadPath.length > 0 && (
          <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-foundation")}>
            Open Foundation: {foundationType.label}
          </button>
        )}
      </div>
    ) : null;

  // Floor Tools — moved here from the floating "editor-tools" note, plus
  // buttons to open the floor-related Detail Guide pages (Tommy: "put those
  // buttons to open the notes in the left bar... after the editor tool
  // content"). Rendered regardless of which floor system is selected,
  // unlike baleFoundationControls above (Bale Foundation-only editing
  // controls) — this is general floor info + note-opening buttons.
  const floorToolsControls =
    editorTab === "floor" ? (
      <div className={elevationStyles.panel}>
        <strong>Floor Tools</strong>
        <label className={elevationStyles.checkboxLabel} title={isLastEnabledScopeBranch(scopeOfWork, "floors") ? LAST_SCOPE_BRANCH_TITLE : undefined}>
          <input
            type="checkbox"
            checked={floorsEnabled}
            disabled={isLastEnabledScopeBranch(scopeOfWork, "floors")}
            onChange={(e) => setFloorsEnabled(e.target.checked)}
          />
          Floors
        </label>
        {foundationType.usesPierGrid ? (
          <>
            <p className={styles.note}>
              {floorPanels.length} floor panels tiled pier-to-pier at max {pierSpacingFt}ft spacing — same spacing as the Foundation tab
              (change it there, not here).
            </p>
            {joistLayout && (
              <p className={styles.note}>
                {joistLayout.joists.length} {floorJoistType!.label} joists running perpendicular to the longest walls (perimeter-to-perimeter,
                or perimeter-to-beam over the piers). See the Detail Guide Pages below for the rim/thermal-break detail.
              </p>
            )}
          </>
        ) : isThermalSlabFloor ? (
          <p className={styles.note}>
            Thermally Broken Slab floor selected — the slab is both the foundation and the floor system, so there&apos;s no separate floor
            panel/joist layout to draw. See the Detail Guide Pages below for the full thermal-break detail.
          </p>
        ) : foundationType.loadPath.length > 0 ? (
          <p className={styles.note}>
            {foundationType.label} doesn&apos;t use a pier grid, so there&apos;s no pier-to-pier floor panel bay to derive yet — see the
            Detail Guide Pages below for its construction detail.
          </p>
        ) : (
          <p className={styles.pending}>
            {foundationType.label} doesn&apos;t use a pier grid, so there&apos;s no pier-to-pier floor panel bay to derive yet, and its
            construction isn&apos;t modeled yet — {foundationType.vaporNote}
          </p>
        )}
        <div role="group" aria-label="Floor Detail Guide pages" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {docFloorJoistType && (
            <>
              <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-floor")}>
                Open Floor: {docFloorJoistType.label}
              </button>
              <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-floor-assembly")}>
                Open Floor: Full Assembly
              </button>
              <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-floor-corner")}>
                Open Floor: Corner &amp; Perimeter Sequencing
              </button>
              {docPerpendicular2x4Enabled && (
                <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-floor-addon")}>
                  Open Floor: Perpendicular 2x4 Add-On Layer
                </button>
              )}
            </>
          )}
          {isBaleFoundationFloor && (
            <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-bale-foundation")}>
              Open Floor: Bale Foundation
            </button>
          )}
          {docIsThermalSlabFloor && (
            <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-floor-thermal-slab")}>
              Open Floor: Thermally Broken Slab
            </button>
          )}
        </div>
      </div>
    ) : null;

  // Roof Tools — moved here from the floating "editor-tools" note (Tommy:
  // "roof options under the roof truss plate and other similar options as
  // well as the roof truss layout and similar pages into the left side bar
  // of the roof editor at the bottom"), rendered after roofTrussControls.
  const roofToolsControls =
    editorTab === "roof" ? (
      <div className={elevationStyles.panel}>
        <strong>Roof Tools</strong>
        <label className={elevationStyles.checkboxLabel} title={isLastEnabledScopeBranch(scopeOfWork, "roof") ? LAST_SCOPE_BRANCH_TITLE : undefined}>
          <input
            type="checkbox"
            checked={roofEnabled}
            disabled={isLastEnabledScopeBranch(scopeOfWork, "roof")}
            onChange={(e) => setRoofEnabled(e.target.checked)}
          />
          Roof
        </label>
        <p className={styles.note}>{roofSystemTypes.find((t) => t.id === roofSystemTypeId)!.description}</p>

        <div role="group" aria-label="Roofline profile" className={styles.toolbar}>
          <span style={{ fontSize: 13, marginRight: 4 }}>Roofline profile:</span>
          <button
            type="button"
            aria-pressed={roofProfileType === "peaked"}
            className={roofProfileType === "peaked" ? styles.toolActive : styles.tool}
            onClick={() => handleChangeRoofProfileType("peaked")}
          >
            Peaked (1 point)
          </button>
          <button
            type="button"
            aria-pressed={roofProfileType === "flat-top"}
            className={roofProfileType === "flat-top" ? styles.toolActive : styles.tool}
            onClick={() => handleChangeRoofProfileType("flat-top")}
          >
            Flat-top (2 points)
          </button>
        </div>
        <p className={styles.note}>
          {roofProfileType === "peaked"
            ? "A single ridge — a Gable End Panel's high edge rises to meet one top point."
            : "Two independently-placeable top points (each with its own height and along-wall position, set per-wall in that wall's elevation view) — a triangle with the top chopped off."}
        </p>

        {roofProfilePointHeightsFt.map((heightFt, i) => (
          <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Feet domain, so the value now reads back carrying its own
                units and the "(ft)" this label used to end with would be
                contradicting it. */}
            {roofProfilePointHeightsFt.length === 1 ? "Ridge rise above eave" : `Point ${i + 1} rise above eave`}
            <LengthInput
              value={heightFt}
              domain="ft"
              ariaLabel={roofProfilePointHeightsFt.length === 1 ? "Ridge rise above eave" : `Point ${i + 1} rise above eave`}
              onCommit={(next) => handleChangeRoofProfilePointHeightFt(i, next)}
              style={{ width: 80 }}
            />
          </label>
        ))}
        <p className={styles.note}>
          For a real wall, pick a standard pitch (2/12-12/12) instead in that wall&apos;s own Elevation view — it computes the rise from
          that wall&apos;s own real width. The rise field here stays freely editable either way.
        </p>

        <label>
          Max Gable End Panel height (in){" "}
          <LengthInput
            value={maxGablePanelHeightIn}
            domain="in"
            ariaLabel="Max Gable End Panel height in inches"
            title={`At least 12in (advisory); the ${GABLE_PANEL_MAX_HEIGHT_IN}in fabrication ceiling above is enforced`}
            onCommit={(next) => setMaxGablePanelHeightIn(Math.min(next, GABLE_PANEL_MAX_HEIGHT_IN))}
          />
        </label>
        <p className={styles.note}>
          Any real roofline rise above this (up to a hard fabrication ceiling of {GABLE_PANEL_MAX_HEIGHT_IN}in per panel) is filled by a
          real vertical safety-gap tile instead of clamped — see that wall&apos;s elevation view.
        </p>

        <label>
          Heel height (in){" "}
          <LengthInput
            value={heelHeightIn}
            domain="in"
            ariaLabel="Truss heel height in inches"
            title="Up to 15in — advisory; the handler only enforces a floor of 0"
            onCommit={(next) => setHeelHeightIn(Math.max(0, next))}
          />
        </label>
        <p className={styles.note}>
          Energy-heel (raised-heel) truss seat: at each end that isn&apos;t snapped to a shed, the roofline runs flat for one full panel
          width from the corner, then starts the incline this much above the eave — {gableHeelHeightDefaultIn.note} Set to 0 to disable.
        </p>

        <p className={styles.note}>
          Where an unclaimed (non-shed) end&apos;s roofline slope actually starts lifting off (Tommy: &quot;flush with the top of the
          trusses or flush with the inside edge of them&quot;) is a single project-wide setting, now controlled from any Gable End
          wall&apos;s own Elevation view sidebar (&quot;Roofline starts at&quot;) instead of here — Truss heel height uses the Heel
          height setting above; Truss seat depth uses the truss bottom&apos;s own inset below instead, with no raised heel.
        </p>

        <div role="group" aria-label="Truss seat depth" className={styles.toolbar}>
          <span style={{ fontSize: 13, marginRight: 4 }}>Truss seat depth:</span>
          {bearingEdgeReferenceOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={trussPlateInsetIn === opt.insetIn}
              className={trussPlateInsetIn === opt.insetIn ? styles.toolActive : styles.tool}
              onClick={() => setTrussPlateInsetIn(opt.insetIn)}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={trussPlateInsetIn === thicknessIn}
            className={trussPlateInsetIn === thicknessIn ? styles.toolActive : styles.tool}
            onClick={() => setTrussPlateInsetIn(thicknessIn)}
            title="Sets the truss seat as deep as the wall panel's own real thickness, whatever that currently is."
          >
            Panel depth ({thicknessIn}in)
          </button>
        </div>
        <p className={styles.note}>
          How far the truss bottom / roof-catcher beam — and, following it, the Gable End Panel material itself — sits inset from the
          adjacent wall&apos;s primary (exterior/floor-plan-line) edge. {trussPlateInsetDefaultIn.note}
        </p>

        <p className={styles.pending}>{roofBearingMemberNote}</p>

        {stories.length > 1 && (
          <>
            <label>
              Box beam size{" "}
              <select value={boxBeamSizeId} onChange={(e) => setBoxBeamSizeId(e.target.value as BoxBeamSizeId)}>
                {BOX_BEAM_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div role="group" aria-label="Box beam coverage" className={styles.toolbar}>
              <span style={{ fontSize: 13, marginRight: 4 }}>Box beam coverage:</span>
              <button type="button" onClick={() => handleSetBoxBeamRing(true)}>
                Add to Every Wall (Ring)
              </button>
              <button type="button" onClick={() => handleSetBoxBeamRing(false)}>
                Remove from Every Wall
              </button>
            </div>
            <p className={styles.note}>
              Toggle Box Beam per wall from that wall&apos;s own elevation view (Wall tab), or use the Ring buttons above for every wall at
              once. A wall with Box Beam gets its own 2nd-story row of panels built shorter — by{" "}
              {computeBoxBeamHeightDeltaIn(boxBeamSizeId).toFixed(2)}in for the selected size — so it still reaches the same roofline as a
              wall using the shorter Truss Plate.
            </p>
          </>
        )}

        {roofSystemTypeId === "structural-panel" && (
          <>
            <label>
              Roof-catcher-beam depth offset (in){" "}
              <LengthInput
                value={roofCatcherBeamOffsetIn}
                domain="in"
                ariaLabel="Roof-catcher-beam depth offset in inches"
                title="0 or more — advisory, nothing clamps this"
                onCommit={setRoofCatcherBeamOffsetIn}
              />
            </label>
            <label>
              Roof-catcher-beam shape{" "}
              <select value={roofCatcherBeamShape} onChange={(e) => setRoofCatcherBeamShape(e.target.value as RoofCatcherBeamShape)}>
                {roofCatcherBeamShapeOptions.map((shape) => (
                  <option key={shape} value={shape}>
                    {shape}
                  </option>
                ))}
              </select>
            </label>
            {roofProfileType === "peaked" ? (
              <p className={styles.note}>
                A gable wall with its own "Panels/beam" toggle on (Elevation view sidebar) gets a real Column Panel centered under the
                peak, {GABLE_COLUMN_FLAT_TOP_DROP_IN}in shorter than the ridge so its top can catch the roof-catcher beam — see the Column
                Panel Shop Drawing page below.
              </p>
            ) : (
              <p className={styles.note}>
                No Column Panel or roof-catcher beam for a flat-topped roofline — those need a single real peak to bear on. Switch the
                roofline profile above to Peaked to use them.
              </p>
            )}

            {roofProfileType === "peaked" &&
              (() => {
                const gableWallIds = [...gableEndWallIds];
                const peakPositionInByWallId: Record<string, number> = {};
                for (const [wallId, positions] of Object.entries(gableProfilePositionsInByWallId)) {
                  const posIn = positions[0];
                  if (posIn != null) peakPositionInByWallId[wallId] = posIn;
                }
                const ridge =
                  footprint && gableWallIds.length === 2
                    ? computeRidgeLine(footprint, gableWallIds[0]!, gableWallIds[1]!, peakPositionInByWallId)
                    : null;
                if (!ridge) {
                  return (
                    <p className={styles.note}>
                      Add Gable End to exactly 2 (opposite) walls — see that wall&apos;s elevation view (Wall tab&apos;s view-mode dial) —
                      to compute a real roof-catcher-beam run from the footprint.
                    </p>
                  );
                }
                const segments = computeRoofCatcherBeamSegments(ridge.runIn);
                const postPositionsIn = computeRoofCatcherBeamPostPositions(ridge.runIn);
                const piers = footprint ? computePierGrid(footprint, pierSpacingFt) : [];
                const postPoints = postPositionsIn.map((posIn) => pointAlongRidgeLine(ridge, posIn));
                return (
                  <p className={styles.note}>
                    Run: {(ridge.runIn / 12).toFixed(1)}ft between {gableWallIds[0]} and {gableWallIds[1]}&apos;s Column Panels —{" "}
                    {segments.length} built-up 3-ply 2x12 beam segment{segments.length === 1 ? "" : "s"} (
                    {segments[0]!.spanIn.toFixed(1)}in each, max 144in/12ft).{" "}
                    {postPoints.length === 0
                      ? "No intermediate posts needed at this run."
                      : `${postPoints.length} intermediate post${postPoints.length === 1 ? "" : "s"} at real ` +
                        "footprint position " +
                        postPoints
                          .map((pt) => {
                            const onPier = isPointNearPier(pt, piers);
                            return `(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})${onPier ? "" : " — no pier here yet"}`;
                          })
                          .join(", ") +
                        ` — cross-checked against the real pier grid (${pierSpacingFt}ft o.c.). Ideal scenario ` +
                        "(Tommy): piers every 6ft, a post on every other one (12ft) — a post lands off-pier " +
                        "whenever the run isn't a whole multiple of 2x the pier spacing, since segments are " +
                        "evenly re-split rather than forced onto exact pier positions."}{" "}
                    Post construction (size/material) isn&apos;t specified yet — only positions are modeled.
                  </p>
                );
              })()}
          </>
        )}

        {footprint && footprint.corners.length === 8 && (
          <>
            <div role="group" aria-label="Octagon ring outside diameter" className={styles.toolbar}>
              <span style={{ fontSize: 13, marginRight: 4 }}>Octagon ring outside diameter:</span>
              {OCTAGON_RING_DIAMETER_OPTIONS_FT.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  aria-pressed={octagonRingDiameterFt === ft}
                  className={octagonRingDiameterFt === ft ? styles.toolActive : styles.tool}
                  onClick={() => setOctagonRingDiameterFt(ft)}
                >
                  {ft}ft
                </button>
              ))}
            </div>
            <OctagonRingPreview outsideDiameterFt={octagonRingDiameterFt} />
            <p className={styles.note}>
              8 mitered 1-3/4in x 14in LVL segments (on edge), one per compass direction, forming a closed ring — a compression ring near
              the roof&apos;s apex for an octagon roof, sized independently of the building&apos;s own (much larger) footprint.
              &quot;Outside diameter&quot; is the flat-to-flat distance across the ring (the standard way octagonal hardware/rings are
              sized), not point-to-point across the corners. Miters (22.5deg at each of the 8 corners) are simplified to straight boxes
              here, not true beveled geometry.
            </p>
          </>
        )}

        <div role="group" aria-label="Roof Detail Guide pages" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(stories.length === 1 || trussPlateWallLengthTotalIn > 0) && (
            <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-truss-plate")}>
              Open Roof: Truss Plate
            </button>
          )}
          <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-roof-truss-layout")}>
            Open Roof: Truss Layout
          </button>
          {stories.length > 1 && boxBeamWallLengthTotalIn > 0 && (
            <button type="button" className={elevationStyles.actionButton} onClick={() => handleToggleNote("detail-box-beam")}>
              Open Box Beam
            </button>
          )}
        </div>
      </div>
    ) : null;

  /* U5.1 — THE PRINT PAGE'S CONTROLS: exactly the three that were the
     right-hand tray's header, lifted out as ONE definition so the page and
     the tray cannot disagree while both exist.

     ⚠ Exactly today's controls and nothing more — `Export PDF (n)`, `Choose
     sections ▾`, `Page size`. The 2026-09-26 plan §14 is explicit that the
     printing customization editor is U6 and deliberately deferred, because
     the honest print blocker is pagination rather than the picker: Shipping,
     Plaster Master and Project Summary each run 1–2.5 pages over on any page
     size, and a customization editor built on unverified pagination would let
     a user arrange sheets that do not paginate. */
  const printPageControls = (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center", position: "relative" }}>
                <button
                  type="button"
                  title="Export the checked sections as one PDF (opening any that aren't already, then restoring what was open)"
                  disabled={effectiveExportIds.size === 0}
                  onClick={handleExportSelectedPdf}
                >
                  Export PDF{effectiveExportIds.size > 0 ? ` (${effectiveExportIds.size})` : ""}
                </button>
                <button
                  type="button"
                  aria-expanded={exportPickerOpen}
                  onClick={() => setExportPickerOpen((was) => !was)}
                  style={{ fontSize: 12 }}
                >
                  Choose sections {exportPickerOpen ? "▴" : "▾"}
                </button>
                {exportPickerOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      zIndex: 100,
                      marginTop: 4,
                      background: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: 6,
                      padding: 8,
                      minWidth: 240,
                      maxHeight: 260,
                      overflowY: "auto",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    {exportableSections.map((s) => (
                      <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "3px 0" }}>
                        <input
                          type="checkbox"
                          checked={effectiveExportIds.has(s.id)}
                          onChange={(e) => {
                            const next = new Set(effectiveExportIds);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            setManualExportIds(next);
                          }}
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                Page size{" "}
                <select
                  value={printPageSizeId}
                  onChange={(e) => setPrintPageSizeId(e.target.value as "letter" | "tabloid")}
                >
                  <option value="letter">Letter (11x8.5in)</option>
                  <option value="tabloid">Tabloid (17x11in)</option>
                </select>
              </label>
            </div>
  );

  return (
    <DocumentMetaProvider value={{ projectName, siteLabel: documentSiteLabel, date: documentDate }}>
    {/* Stage 4B: wraps the whole editor, so the two OBJ buttons — on the
        building preview and on every single-panel viewer, wherever they are
        rendered from — go while another company's design is on screen. */}
    <BrowseModeProvider browsing={costsRedacted}>
    {/* U4.2 — one provider, and every StickyNote below reads it. See
        SectionSurfaceContext.tsx for why this is not 27 props. */}
    <SectionSurfaceProvider value={sectionSurface}>
    <div className={styles.page} ref={pageRef}>
      <div className="print-hidden-chrome">
        <TopBar
          cloud={cloud.menuModel}
          role={role}
          onRoleChange={setRole}
          showAllDetailPages={showAllDetailPages}
          onShowAllDetailPagesChange={setShowAllDetailPages}
          unitSystem={unitSystem}
          onUnitSystemChange={setUnitSystem}
          onSaveProject={handleSaveProject}
          onLoadProjectClick={() => loadInputRef.current?.click()}
          siteContent={siteContent}
          panelizerContent={panelizerContent}
          editorTab={editorTab}
          onEditorTabChange={handleEditorTabChange}
          editorSurface={editorSurface}
          onEditorSurfaceChange={setEditorSurface}
          enabledTabs={enabledEditorTabs}
          // The Design and View menus — since 2026-09-28 the ONLY view control
          // in the app, the sidebar dial having been removed at Tommy's
          // instruction. `handleViewerStopChange` stays the only writer of
          // viewMode / simplified3D / showWraps / elevationViewWallId — the
          // bar calls it, it does not reach past it. `footprint` is passed
          // rather than a ready-made "is it live" boolean so TopBar calls
          // `isViewStopLive` itself and cannot be handed a different answer
          // than this file's own readers get.
          viewerStops={viewerStops}
          currentViewerStop={currentViewerStop}
          onViewerStopChange={handleViewerStopChange}
          footprint={footprint}
        />
      </div>
      <input
        ref={loadInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleLoadFileSelected}
        style={{ display: "none" }}
      />
      {/* Stage 2B's notes: save dialog, Open from cloud, and the save notice.
          Chrome, so never printed. */}
      <div className="print-hidden-chrome">{cloud.notes}</div>
      <main className={styles.main}>
        <div
          className={`${styles.editorSection} print-hidden-chrome`}
          /* ⚠ TOMMY'S CONDITION, OBSERVABLE AT RUNTIME. 2026-10-11: *"As long
             as everything is included in the tabs above, let's delete it."*
             `sectionsNoPageCanReach` is that "as long as", computed against the
             LIVE derived section list for the building actually on screen —
             `relevantDetailPages` differs per building, so the section that
             exists only on some of them is exactly the one a unit test's
             fixture or a human eye would miss.

             Published here so the browser harness can assert it is empty on a
             real building rather than trusting the fixtures. Empty string when
             all is well, so it costs nothing and reads as nothing. */
          data-sections-unreachable={sectionsNoPageCanReach.join(",")}
        >
          <div className={styles.editorSidebar}>
            {loadError && <p className={styles.disclaimer}>Couldn&apos;t load that file — {loadError}</p>}
            {/* Region 1 (always first, fixed): Tommy's "having the viewer
                selection on top, then the floor/wall/roof layer, then all the
                editor relevant tools below". It previously shared this row with
                the pan/zoom portal div below, whose presence/absence (wall+plan
                only) changed the row's own height and shifted everything below
                it every time the tab/view changed; it has had a fixed height
                ever since, and still does.

                ⚠ THE VIEW CONTROL IS NO LONGER HERE. `ViewerDial` sat in this
                row and was REMOVED on 2026-09-28 — Tommy: "I would like to not
                have the dial after these updates. All of the viewers and
                editors that you can reach through the dial should be accessible
                on the top bar." The top bar's Design and View menus are the
                whole of the view control now, at every width. Deleted with it,
                on his own decisions and recorded so neither reads later as an
                oversight: SCROLL-WHEEL CYCLING (nothing replaces it; an open
                question) and `useRustleSound()` ("The rustle sound is no big
                deal"). The Wall/Foundation/Floor/Roof tab dial that used to sit
                below this row went the next day on a SEPARATE decision of his —
                see Region 2's note. What is left in this row is the fullscreen
                toggle. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
              <button
                type="button"
                title={isOsFullscreen ? "Exit fullscreen" : "Enter fullscreen editor"}
                onClick={handleToggleOsFullscreen}
                style={{
                  fontSize: 15,
                  lineHeight: 1,
                  padding: "6px 9px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {isOsFullscreen ? "⤡" : "⤢"}
              </button>
            </div>
            {/* ⚠ REGION 2 IS GONE — it held `EditorToolbar`, whose only content
                was `EditorTabDial`, the Wall/Foundation/Floor/Roof scroll dial.
                Removed 2026-09-29 on Tommy's decision: "Remove it — Design is
                the only door." The subjects are groups inside the top bar's
                Design menu now, at every width, so this was the second door to
                the same state rather than the narrow-width form of anything.

                The state did not move: `editorTab` is still one `useState` in
                this file and `setEditorTab` is still its one writer — the
                Design menu calls it through `onEditorTabChange`, exactly as
                this dial did.

                ⚠ WHAT THAT COSTS, because it is a real trade and he took it
                knowingly: with Region 2 gone, nothing in the chrome NAMES the
                current subject. The Design button reads "Design" whichever
                subject you are on; only opening the menu shows which entry is
                marked, and only Region 3's own headings ("Roof Tools", and so
                on) name it on screen. That is the argument the review made for
                keeping the dial, and it is recorded here rather than lost. */}
            {/* Region 3 (variable, always last): everything else — its own
                presence/height still varies by tab/view, but nothing below
                it depends on that anymore.

                WHY THIS WRAPPER EXISTS, since it renders nothing: it is
                `display: contents`, so every child below is still a direct
                flex child of .editorSidebar and the layout is byte-for-byte
                what it was without it (.toolbarPortalInline next door uses
                the same trick for the same reason). What it adds is a NAME.
                The acceptance is "Region 3 renders identically for every stop
                before and after the change" — the direct test that
                `handleViewerStopChange` stayed the only writer of
                viewMode/simplified3D/showWraps/elevationViewWallId, because
                Region 3's content keys off exactly those four flags. That test
                needs to address Region 3 without addressing Regions 1, 2 and 4
                (Region 1 legitimately differs across the change: the view dial
                used to live there and no longer exists). Selecting it by
                sibling position would be a locator keyed to an incidental
                fact — the shape this repo's harnesses have already been burned
                by — so it gets a real hook instead.

                ⚠ WITH THE DIAL GONE, ONE HALF OF THAT PROOF HAD TO BE
                REPLACED. U1 compared the dial against the menus within a
                single run, byte for byte. There is no second control to
                compare against any more, so the harness instead (a) still
                compares against `region3-baseline.json`, which was recorded
                off the DIAL before any of this, and (b) reaches each stop
                twice by different routes in one run and requires Region 3 to
                be byte-identical both times — which is what would catch
                `showWraps` left true on a plan view arrived at from 3D. */}
            <div data-sidebar-region-3="" className={styles.sidebarRegion3}>
            {/* UNDO / REDO. Here rather than on the top bar because U1 bought
                that bar's width by deleting controls, and here rather than
                inside DrawingToolPen because that only renders on the plan
                view — undo has to be reachable from an elevation, the Floor
                tab and the Roof tab too, which is exactly where a mis-drag is
                hardest to put back by hand.

                ⚠ Region 3 carries a "same stop reached two ways is
                byte-identical" test. Navigation is classified transient in
                undoHistory.ts, so a detour through 3D and back creates no
                entry and leaves these two buttons in the same state — which
                is what keeps that test honest rather than merely passing. */}
            <div role="group" aria-label="History" className={styles.toolbar} data-history-controls="">
              <button
                type="button"
                className={styles.tool}
                onClick={handleUndo}
                disabled={!undoAvailability.undo}
                title="Undo the last edit (Ctrl+Z)"
              >
                ↶ Undo
              </button>
              <button
                type="button"
                className={styles.tool}
                onClick={handleRedo}
                disabled={!undoAvailability.redo}
                title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
              >
                ↷ Redo
              </button>
            </div>
            {editorTab === "wall" && elevationWall && elevationControls}
            {viewMode === "3d" && deckLayerControls}
            {editorTab === "wall" && !elevationWall && viewMode === "3d" && showWraps && wallAssemblyControls}
            {editorTab === "foundation" && foundationControls}
            {editorTab === "floor" && baleFoundationControls}
            {editorTab === "floor" && floorToolsControls}
            {editorTab === "roof" && roofTrussControls}
            {editorTab === "roof" && roofToolsControls}
            {editorTab === "wall" && !elevationWall && viewMode === "plan" && (
              <>
                <div ref={setToolbarPortalNode} className={styles.toolbarPortalInline} />
                <DrawingToolPen
                  value={shapeTool}
                  onChange={setShapeTool}
                  bumpOutDisabled={!footprint || effectiveViewedStoryId !== "ground"}
                  dragWallDisabled={!footprint || effectiveViewedStoryId !== "ground"}
                  drawWallDisabled={!footprint || effectiveViewedStoryId !== "ground"}
                  editDisabled={!footprint}
                  secondStoryEnabled={stories.length > 1}
                  onToggleSecondStory={handleToggleSecondStory}
                  secondStoryDisabled={!footprint}
                  secondStoryWallHeightFt={stories[1]?.wallHeightFt ?? 10}
                  onSecondStoryWallHeightChange={handleSetSecondStoryWallHeightFt}
                  stories={stories}
                  viewedStoryId={effectiveViewedStoryId}
                  onChangeViewedStoryId={setViewedStoryId}
                />
                {/* ⚠ OCTAGON SIZING LIVES WITH THE SHAPE TOOLS, and only
                    appears when there is an octagon to size — Tommy,
                    2026-10-20: "Can we add a left sidebar button when an
                    octagon is drawn to edit the diameter (point to point and
                    flat to flat) and also size of each wall that shares the
                    same size."

                    Gated on `octagonBox`, which is null for a rectangle and
                    for a bumped-out shape — a bump-out gives the footprint
                    more free parameters than a `W x D` box can describe, so
                    sizing it from two numbers would silently throw the
                    bump-out away. */}
                {octagonBox && !isBumpedOut && footprint && !isCourtyardFootprint(footprint) && (
                  <OctagonSizePanel box={octagonBox} onChange={handleResizeOctagon} />
                )}
                {/* ⚠ Offered on ANY shape, not just an octagon — Tommy,
                    2026-10-21: "This should also be compatible with
                    concentric Square/ rectangle buildings." */}
                {footprint && (
                  <CourtyardPanel
                    footprint={footprint}
                    onAddCourtyard={handleAddCourtyard}
                    onRemoveCourtyard={handleRemoveCourtyard}
                  />
                )}
                {pendingSplit && (
                  <DrawWallChooser split={pendingSplit.split} onKeep={handleKeepSplitRegion} onCancel={cancelDrawWall} />
                )}
                {shapeTool === "draw-wall" && !pendingSplit && (
                  <span style={{ fontSize: 11, color: "#555", lineHeight: 1.35 }}>
                    {drawWallFirstPick === null
                      ? "Click a corner or a panel joint to start the new wall. Corners are round, joints are square."
                      : "Now click the corner or joint it runs to — or the same point again to start over."}
                  </span>
                )}
                <div ref={setToolbarSecondaryPortalNode} className={styles.toolbarPortalInline} />
                <PanelLegend />
              </>
            )}
            {editorTab === "wall" && !elevationWall && viewMode === "3d" && (
              <div role="group" aria-label="3D tool" className={styles.toolbar}>
                <button
                  type="button"
                  title="Orbit/pan/zoom the camera — panels aren't clickable"
                  aria-pressed={tool3D === "orbit"}
                  className={tool3D === "orbit" ? styles.toolActive : styles.tool}
                  onClick={() => setTool3D("orbit")}
                >
                  Orbit
                </button>
                <button
                  type="button"
                  title="Click a panel to cycle it: standard → window → door → column → standard (same as the 2D Edit tool)"
                  aria-pressed={tool3D === "edit"}
                  disabled={!footprint}
                  className={tool3D === "edit" ? styles.toolActive : styles.tool}
                  onClick={() => setTool3D("edit")}
                >
                  Edit
                </button>
                <button
                  type="button"
                  title="Click a window, then drag its top/bottom handles to set header and sill height"
                  aria-pressed={tool3D === "sill-header"}
                  disabled={!footprint}
                  className={tool3D === "sill-header" ? styles.toolActive : styles.tool}
                  onClick={() => setTool3D("sill-header")}
                >
                  Sill &amp; Header
                </button>
              </div>
            )}
            </div>
            {/* Region 4 (bottom-pinned, Tommy: "when you click on a panel
                or other 2d or 3d element, the [popup]... appears at the
                bottom of the left bar above the question mark") — this
                whole group (the Selected Panel note, when one is picked,
                plus the "?" features button) is pushed to the very bottom
                of the sidebar's own flex column via marginTop: "auto",
                with the note docked directly above the button. */}
            <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedSlot &&
                (() => {
                  const selectedWallSlots = (selectedSlot.story === "ground" ? baseWallSlots : (secondStory?.wallSlots ?? {}))[
                    selectedSlot.wallId
                  ];
                  const slot = selectedWallSlots?.[selectedSlot.slotIndex];
                  if (!slot) return null;
                  const { wallId, slotIndex, story, zoneIndex } = selectedSlot;
                  const effectiveWallHeightFt = story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt);
                  // zoneIndex >= 1 targets a real independently-typed zone
                  // above this slot's own bottom (see PanelSlotZone) — zone
                  // 0/undefined is always exactly zoneFromSlot(slot), since
                  // applyZonesToSlot keeps that zone mirrored onto the
                  // slot's own top-level fields.
                  const zone: PanelSlotZone =
                    zoneIndex !== undefined && zoneIndex > 0 ? effectiveZonesForSlot(slot, zoneIndex + 1)[zoneIndex]! : zoneFromSlot(slot);
                  const bracedStyle = zone.type === "braced" ? resolveBracedStyle(zone, defaultBracePattern, defaultBracedMirrored) : null;
                  // Material Specs — only for panel types that actually build
                  // real dimensional-lumber stud framing around a straw
                  // cavity (same real criterion BEARING_ELIGIBLE_TYPES
                  // already uses — a corner panel is built identically to a
                  // column panel, see cornerPanelMembers.ts). Deliberately
                  // excludes safety-gap: buildSafetyGapMembers shows it's
                  // "no studs, plates, or girts at all — just one 3/4in
                  // plywood sheet," so neither value would be real there.
                  const densityLbFt3Confirmed = Math.round((targetDensityKgM3.value / LB_FT3_TO_KG_M3) * 10) / 10;
                  const framingSizeLabel = isSquareBalePanelization
                    ? (
                        {
                          "single-2x4": "Single 2x4 Studs",
                          "double-2x4": "Double 2x4 Studs",
                          "double-2x6": "Double 2x6 Studs",
                        } satisfies Record<StudConfig, string>
                      )[squareBaleStudConfig]
                    : `2x4 Nominal (${PLATE_2X4_THICKNESS_IN}in x ${PLATE_2X4_WIDTH_IN}in actual)`;
                  // Smearforn Stage 1: the width field standard/braced panels
                  // never had (windows have had one all along). It edits the
                  // SLOT's width, which every zone stacked in this column
                  // shares, so it is offered on the slot's own type rather
                  // than on the selected zone's.
                  // ⚠ Until 2026-09-30 the note below said a hand-set width
                  // "survives a re-tile of this wall" unconditionally, and on a
                  // wall that cannot pay for the pin that was simply untrue —
                  // the re-force is refused and the panel is built at the tiler's
                  // width instead. Asking the planner is what keeps the sentence
                  // and the behaviour the same claim: it is the very function
                  // `reconcileBracedPlacement` refuses with. One wall's slots,
                  // integer arithmetic, no allocation unless something is pinned.
                  const lockedWidthRefusal =
                    slot.lockedWidthIn === undefined
                      ? undefined
                      : planLockedWidthReforce(selectedWallSlots ?? []).refusals.find((r) => r.slotIndex === slotIndex);
                  const panelWidthSection =
                    slot.type === "standard" || slot.type === "braced" ? (
                      <>
                        <label style={{ display: "block", marginTop: 6 }}>
                          Width{" "}
                          <LengthInput
                            id={`panel-width-${wallId}-${slotIndex}`}
                            title={`This panel's own width, left to right in elevation — ${formatLengthIn(fabricationMinPanelWidthIn.value, unitSystem)} to ${formatLengthIn(panelWidthInRange.maxIn, unitSystem)}. The wall's total length never moves: the panels that are still automatic re-tile into what is left.`}
                            value={slot.widthIn}
                            domain="in"
                            ariaLabel="Panel width in inches"
                            style={{ width: 64 }}
                            validate={(next) => panelWidthRefusalMessage(story, wallId, slotIndex, next)}
                            onCommit={(next) => handleSetPanelWidth(story, wallId, slotIndex, next)}
                          />
                        </label>
                        {slot.lockedWidthIn === undefined ? (
                          <p className={styles.note}>
                            Automatic — this width is whatever the tiler computes for this wall. Type one to hand-set it.
                          </p>
                        ) : (
                          <p className={styles.note} style={lockedWidthRefusal ? { color: "#a67c00" } : undefined}>
                            {lockedWidthRefusal
                              ? unhonouredLockedWidthSentence(lockedWidthRefusal, panelWidthLimitsIn, (valueIn) =>
                                  formatLengthIn(valueIn, unitSystem),
                                )
                              : `Hand-set at ${formatLengthIn(slot.lockedWidthIn, unitSystem)}; it survives a re-tile of this wall.`}{" "}
                            <button
                              type="button"
                              className={styles.tool}
                              onClick={() => handleResetPanelWidth(story, wallId, slotIndex)}
                              title="Clear this panel's hand-set width and let the tiler size it again. Only this panel is affected."
                            >
                              Reset to automatic
                            </button>
                          </p>
                        )}
                        {panelWidthNotice && (
                          <p className={styles.note} style={{ color: "#a67c00" }}>
                            {panelWidthNotice}
                          </p>
                        )}
                      </>
                    ) : null;
                  const materialSpecsSection = BEARING_ELIGIBLE_TYPES.has(zone.type) ? (
                    <div className={elevationStyles.structuralSection}>
                      <span className={elevationStyles.sectionLabel}>Material Specs</span>
                      <div className={elevationStyles.structuralRow}>
                        <div className={elevationStyles.structuralRowHead}>
                          <span>Straw Density</span>
                          <span className={elevationStyles.structuralValue}>{densityLbFt3Confirmed} lb/ft&sup3;</span>
                        </div>
                        <span className={elevationStyles.confirmedPill}>Confirmed</span>
                      </div>
                      <div className={elevationStyles.structuralRow}>
                        <div className={elevationStyles.structuralRowHead}>
                          <span>Framing Size</span>
                          <span className={elevationStyles.structuralValue}>{framingSizeLabel}</span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                  return (
                    <StickyNote
                      id="selected-panel"
                      label={`Panel: ${wallId} #${slotIndex}${zoneIndex ? ` (zone ${zoneIndex})` : ""} — ${PANEL_TYPE_LABELS[zone.type]}`}
                      isOpen
                      isFullscreen={fullscreenNoteId === "selected-panel"}
                      cascadeIndex={0}
                      docked
                      onClose={() => setSelectedSlot(null)}
                      onToggleFullscreen={() => handleToggleNoteFullscreen("selected-panel")}
                    >
                      {zone.type === "window" ? (
                        <>
                          <WindowSizeDiagram
                            wallHeightFt={effectiveWallHeightFt}
                            windowWidthIn={slot.widthIn}
                            sillHeightIn={zone.sillHeightIn ?? sillDefaultHeightIn.value}
                            windowHeightIn={zone.heightIn ?? standardWindowHeightDefaultIn.value}
                            thicknessIn={thicknessIn}
                            jackStudConfig={jackStudConfig}
                            includeNailer={includeNailer}
                            standardWidthIn={standardWidthIn}
                            onSetSillHeight={(v) => handleSetWindowSillHeight(story, wallId, slotIndex, v, zoneIndex)}
                            onSetWindowHeight={(v) => handleSetWindowHeight(story, wallId, slotIndex, v, zoneIndex)}
                          />
                          {sillClampNotice && (
                            <p className={styles.note} style={{ color: "#a67c00" }}>
                              {sillClampNotice}
                            </p>
                          )}
                          <label style={{ display: "block", marginTop: 6 }}>
                            Width{" "}
                            <LengthInput
                              id={`window-size-${wallId}-${slotIndex}`}
                              title="However wide, up to 10ft — the header's own truss web bracing angle adds/removes peaks in pairs to stay within its 30-45deg range as width changes"
                              value={slot.widthIn}
                              domain="in"
                              ariaLabel="Window width in inches"
                              style={{ width: 64 }}
                              onCommit={(next) => handleSetWindowWidth(story, wallId, slotIndex, next)}
                            />
                            &quot;
                          </label>
                          {windowWidthClampNotice && (
                            <p className={styles.note} style={{ color: "#a67c00" }}>
                              {windowWidthClampNotice}
                            </p>
                          )}
                          <p className={styles.note}>
                            Changing width can shift neighboring panels on this wall (the wall re-tiles around it) —
                            and, since width is shared by every zone stacked in this same column, every one of them;
                            height and sill (above) never do — they&apos;re a purely vertical/Z-axis change, per zone.
                          </p>
                          <label style={{ display: "block" }}>
                            Height (preset){" "}
                            <select
                              id={`window-height-${wallId}-${slotIndex}`}
                              title="This window's own Rough Opening height (sill-top to header-bottom) — also draggable above"
                              value={zone.heightIn ?? standardWindowHeightsIn.value[0]}
                              onChange={(e) => handleSetWindowHeight(story, wallId, slotIndex, Number(e.target.value), zoneIndex)}
                            >
                              {standardWindowHeightsIn.value.map((h) => (
                                <option key={h} value={h}>
                                  {formatLengthIn(h, unitSystem)} tall
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ display: "block" }}>
                            Sill height{" "}
                            <LengthInput
                              id={`window-sill-height-${wallId}-${slotIndex}`}
                              title="This window's own sill height (floor to Rough Opening bottom) — also draggable above and in the 3D Sill & Header tool"
                              value={zone.sillHeightIn ?? sillHeaderHeightInRange.minIn}
                              domain="in"
                              ariaLabel="Window sill height in inches"
                              style={{ width: 64 }}
                              onCommit={(next) => handleSetWindowSillHeight(story, wallId, slotIndex, next, zoneIndex)}
                            />
                          </label>
                        </>
                      ) : zone.type === "braced" && bracedStyle ? (
                        <>
                          <p className={styles.note}>
                            {bracedPanelDisplayLabel(bracedStyle.pattern, bracedStyle.mirrored)}, {slot.widthIn.toFixed(1)}in wide. Click
                            it again on the canvas to cycle through every style (then back to Standard), or pick one
                            directly below.
                          </p>
                          <label style={{ display: "block" }}>
                            Pattern{" "}
                            <select
                              id={`braced-pattern-${wallId}-${slotIndex}`}
                              value={bracedStyle.pattern}
                              onChange={(e) =>
                                handleSetBracedStyle(story, wallId, slotIndex, e.target.value as BracePattern, bracedStyle.mirrored, zoneIndex)
                              }
                            >
                              <option value="chevron">Chevron (&quot;&lt;&quot;)</option>
                              <option value="hatch">Hatch (&quot;/&quot;)</option>
                            </select>
                          </label>
                          <label style={{ display: "block" }}>
                            <input
                              type="checkbox"
                              id={`braced-mirrored-${wallId}-${slotIndex}`}
                              checked={bracedStyle.mirrored}
                              onChange={(e) =>
                                handleSetBracedStyle(story, wallId, slotIndex, bracedStyle.pattern, e.target.checked, zoneIndex)
                              }
                            />{" "}
                            Mirrored ({bracedStyle.pattern === "chevron" ? '">"' : '"\\"'})
                          </label>
                          {panelWidthSection}
                          {materialSpecsSection}
                        </>
                      ) : zone.type === "big-header" ? (
                        <>
                          <p className={styles.note}>
                            A standalone header + 2 jack studs unit, not tied to any opening below it — usable for
                            double doors, large openings, or conditioned garages. Its chords are rotated 90deg from a
                            standard panel&apos;s own stud orientation (3.5in face shows in elevation, not 1.5in), with
                            the same multi-peak W-truss bracing a wide window header used to use. No sill by default.
                          </p>
                          <label style={{ display: "block", marginTop: 6 }}>
                            Width{" "}
                            <LengthInput
                              id={`big-header-width-${wallId}-${slotIndex}`}
                              value={slot.widthIn}
                              domain="in"
                              ariaLabel="Big Header width in inches"
                              style={{ width: 64 }}
                              onCommit={(next) => handleSetBigHeaderWidth(story, wallId, slotIndex, next)}
                            />
                            &quot; ({bigHeaderWidthInRange.minIn / 12}-{bigHeaderWidthInRange.maxIn / 12}ft)
                          </label>
                          <label style={{ display: "block" }}>
                            Height{" "}
                            <LengthInput
                              id={`big-header-height-${wallId}-${slotIndex}`}
                              value={slot.heightIn ?? bigHeaderDefaultHeightIn.value}
                              domain="in"
                              ariaLabel="Big Header height in inches"
                              style={{ width: 64 }}
                              onCommit={(next) => handleSetBigHeaderHeight(story, wallId, slotIndex, next)}
                            />
                            &quot; ({bigHeaderHeightInRange.minIn / 12}-{bigHeaderHeightInRange.maxIn / 12}ft)
                          </label>
                          <label style={{ display: "block" }}>
                            <input
                              type="checkbox"
                              id={`big-header-sill-${wallId}-${slotIndex}`}
                              checked={slot.includeSillOnBigHeader ?? false}
                              onChange={(e) => handleSetIncludeSillOnBigHeader(story, wallId, slotIndex, e.target.checked)}
                            />{" "}
                            Include a sill underneath
                          </label>
                        </>
                      ) : (
                        <>
                          <p className={styles.note}>
                            {PANEL_TYPE_LABELS[zone.type]} panel, {slot.widthIn.toFixed(1)}in wide.
                            {zone.type === "column" ? " Column Panels are always fabricated at a fixed width, not adjustable here." : ""}
                            {zone.type === "standard" || zone.type === "door" ? " Click it again on the canvas to cycle its type." : ""}
                          </p>
                          {panelWidthSection}
                          {materialSpecsSection}
                        </>
                      )}
                    </StickyNote>
                  );
                })()}
              {/* U0 of the navigation reorganisation: the `?` gains three
                  neighbours. The Review Log's icon is the one with real value
                  — it is where every pending-BI-confirmation value and every
                  sub-minimum panel width surfaces for a human reviewer, and
                  until now the only way in was scrolling the right-hand tray.
                  Read Me and Report Bug open as notes rather than navigating
                  to their routes: there is no localStorage anywhere in this
                  app, so leaving the editor loses an unsaved design, and this
                  cluster makes those links far easier to hit than the tray
                  footer did. The routes are untouched. */}
              <SidebarIconCluster>
                <PageFeaturesButton features={pageFeatures[editorTab]} />
                <SidebarIconButton
                  label="Review Log — Items for Engineer/Contractor Review"
                  active={openNoteIds.has("review-log")}
                  wide
                  onClick={() => handleToggleNote("review-log")}
                >
                  <ReviewLogIcon />
                </SidebarIconButton>
                <SidebarIconButton
                  label="Report Bug / Request Feature"
                  active={openNoteIds.has("report-bug")}
                  onClick={() => handleToggleNote("report-bug")}
                >
                  <BugIcon />
                </SidebarIconButton>
                <SidebarIconButton
                  label="Read Me"
                  active={openNoteIds.has("read-me")}
                  onClick={() => handleToggleNote("read-me")}
                >
                  <ReadMeIcon />
                </SidebarIconButton>
              </SidebarIconCluster>
            </div>
          </div>

          <div
            className={
              editorSurface === "drawing"
                ? styles.editorCanvasLayer
                : `${styles.editorCanvasLayer} ${styles.editorCanvasLayerHidden}`
            }
            /* Hidden from assistive technology too, not just from sight — a
               `display: none` subtree is already out of the accessibility
               tree, so this is belt-and-braces documentation of intent
               rather than a behaviour change. */
            aria-hidden={editorSurface === "drawing" ? undefined : "true"}
          >
            {editorTab === "wall" && (
              <div className={styles.compassDock}>
                <CompassWidget ref={compassNeedleRef} />
              </div>
            )}
            {editorTab === "wall" && elevationWall && (
              <div className={styles.legendDock}>
                <PanelLegend variant="overlay" />
              </div>
            )}
            {editorTab === "wall" &&
              (elevationWall ? (
                <WallElevationDiagram
                  wall={elevationWall}
                  wallLabel={wallLabels[elevationWall.id]}
                  slots={overlayWallSlots[elevationWall.id] ?? []}
                  wallHeightFt={wallHeightFt}
                  allInstances={allInstances}
                  secondStoryAllInstances={secondStoryAllInstances}
                  // The ADJUSTED insets, deliberately not raw ownership: where
                  // the neighbour owns this corner AND is building it, its
                  // panel really is in this end of the line and the "adjacent
                  // wall" filler sliver belongs on the drawing. Where the
                  // neighbour stops short, the corner does not exist, this wall
                  // runs out to its own true end, and nothing is drawn there.
                  startInsetIn={wallGeometryFor(elevationWall.id)?.startInsetIn ?? 0}
                  endInsetIn={wallGeometryFor(elevationWall.id)?.endInsetIn ?? 0}
                  startStopIn={wallGeometryFor(elevationWall.id)?.startStopIn ?? 0}
                  endStopIn={wallGeometryFor(elevationWall.id)?.endStopIn ?? 0}
                  gableBuiltStartIn={gableRunStopByWallId[elevationWall.id]?.builtStartIn}
                  gableBuiltEndIn={gableRunStopByWallId[elevationWall.id]?.builtEndIn}
                  secondStorySlots={secondStory?.wallSlots[elevationWall.id]}
                  secondStoryWallHeightFt={secondStory?.wallHeightFt}
                  onToggleOpening={handleToggleOpening}
                  // Clicking a panel's width label selects it without cycling
                  // its type — the only way a STANDARD panel can become the
                  // selected panel, and therefore the only way to reach its
                  // width field (see WallElevationDiagram's onSelectSlot).
                  onSelectSlot={(story, wallId, slotIndex, zoneIndex) => setSelectedSlot({ wallId, slotIndex, story, zoneIndex })}
                  // Smearforn Stage 2 — while a type (or Delete) is picked in
                  // the left bar, a click on a panel replaces/deletes it and
                  // the boundaries between panels become insert targets.
                  panelToolMode={panelPlacementTool?.mode ?? null}
                  onReplacePanel={handleReplacePanel}
                  onInsertPanel={handleInsertPanel}
                  onDeletePanel={handleDeletePanel}
                  maxPanelHeightIn={maxPanelHeightIn}
                  hasGableEnd={gableEndWallIds.has(elevationWall.id)}
                  roofProfileType={roofProfileType}
                  roofProfilePointHeightsFt={roofProfilePointHeightsFt}
                  roofBearingAssemblyHeightIn={roofEnabled ? computeSharedRooflineBearingHeightIn() : 0}
                  maxGablePanelHeightIn={maxGablePanelHeightIn}
                  isAdjustingMaxGablePanelHeight={adjustingGableMaxHeight}
                  onChangeMaxGablePanelHeightIn={setMaxGablePanelHeightIn}
                  targetPanelWidthIn={standardWidthIn}
                  thicknessIn={thicknessIn}
                  jackStudConfig={jackStudConfig}
                  includeNailer={includeNailer}
                  hasStructuralColumnPanel={gableStructuralPanelWallIds.has(elevationWall.id)}
                  gableProfilePositionsIn={gableProfilePositionsInByWallId[elevationWall.id] ?? []}
                  onChangeGableProfilePositionIn={(pointIndex, positionIn) =>
                    handleChangeGableProfilePositionIn(elevationWall.id, pointIndex, positionIn)
                  }
                  insetIn={trussPlateInsetIn}
                  heelHeightIn={heelHeightIn}
                  roofBearingAnchorMode={roofBearingAnchorMode}
                  gableWindowReservations={gableWindowAnchorsByWallId[elevationWall.id] ?? []}
                  onToggleGableWindow={(tileOrdinal, naturalWidthIn) => handleToggleGableWindow(elevationWall.id, tileOrdinal, naturalWidthIn)}
                  boxBeamCoverage={boxBeamCoverageByWallId[elevationWall.id]}
                  onChangeBoxBeamCoverage={(coverage) => handleChangeBoxBeamCoverage(elevationWall.id, coverage)}
                  boxBeamSizeId={boxBeamSizeId}
                  midWallBeams={midWallBeamsByStoryAndWallId.ground[elevationWall.id] ?? []}
                  secondStoryMidWallBeams={midWallBeamsByStoryAndWallId.second[elevationWall.id] ?? []}
                  spanningHeaders={spanningHeadersByStoryAndWallId.ground[elevationWall.id] ?? []}
                  secondStorySpanningHeaders={spanningHeadersByStoryAndWallId.second[elevationWall.id] ?? []}
                  spanningHeaderNameById={spanningHeaderNameById}
                  onChangeMidWallBeamHeight={(story, beamId, heightIn) =>
                    handleChangeMidWallBeamHeight(story, elevationWall.id, beamId, heightIn)
                  }
                  onChangeMidWallBeamBigHeaderHeightIn={(story, beamId, bigHeaderBeamHeightIn) =>
                    handleChangeMidWallBeamBigHeaderHeightIn(story, elevationWall.id, beamId, bigHeaderBeamHeightIn)
                  }
                  onChangeMidWallBeamCoverage={(story, beamId, coverage) =>
                    handleChangeMidWallBeamCoverage(story, elevationWall.id, beamId, coverage)
                  }
                  onDragResizePanels={handleDragResizePanels}
                  onMovePanel={handleMovePanel}
                  toolbarPortalTarget={elevationToolbarPortalNode}
                />
              ) : viewMode === "plan" ? (
                <FootprintCanvas
                  footprint={footprint}
                  shapeTool={shapeTool}
              drawWallFirstCornerId={drawWallFirstPick?.kind === "corner" ? drawWallFirstPick.cornerId : null}
              onPickDrawWallCorner={handlePickDrawWallCorner}
              onPickDrawWallJoint={handlePickDrawWallJoint}
              drawWallJoints={drawWallJoints}
              drawWallFirstJoint={drawWallFirstPick?.kind === "joint" ? drawWallFirstPick : null}
              drawWallRegions={drawWallRegions}
                  offsetPx={offsetPx}
                  wallSlots={effectiveViewedStoryId === "ground" ? overlayWallSlots : (secondStory?.wallSlots ?? {})}
                  wallStartOffsetIn={wallRenderOffsetIn}
                  wallUnbuiltSpansIn={wallUnbuiltSpansIn}
                  wallThicknessIn={thicknessIn}
                  wallHeightFt={effectiveViewedStoryId === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt)}
                  includeNailer={includeNailer}
                  bracingStyle={bracingStyle}
                  standardWidthIn={standardWidthIn}
                  jackStudConfig={jackStudConfig}
                  leastAccessibleCorner={leastAccessibleCorner}
                  primaryCornerIds={primaryCornerIds}
                  isWallLengthEditable={(wallId) => effectiveViewedStoryId === "ground" && isWallLengthEditable(wallId)}
                  onDraw={handleDraw}
                  onToggleOpening={(wallId, slotIndex) => handleToggleOpening(effectiveViewedStoryId, wallId, slotIndex)}
                  onSetLeastAccessibleCorner={(cornerId) => {
                    if (effectiveViewedStoryId === "ground") handleSetLeastAccessibleCorner(cornerId);
                  }}
                  onEditWallLength={(wallId, newLengthFt) => {
                    if (effectiveViewedStoryId === "ground") handleEditWallLength(wallId, newLengthFt);
                  }}
                  onAddBumpOut={(wallId, spanStartFt, spanEndFt, depthFt) => {
                    if (effectiveViewedStoryId === "ground") handleAddBumpOut(wallId, spanStartFt, spanEndFt, depthFt);
                  }}
                  onDragWall={(wallId, offsetFt) => {
                    if (effectiveViewedStoryId === "ground") handleDragWall(wallId, offsetFt);
                  }}
                  toolbarPortalTarget={toolbarPortalNode}
                  secondaryToolbarPortalTarget={toolbarSecondaryPortalNode}
                />
              ) : (
                <Building3DView
                  footprint={footprint}
                  wallSlots={overlayWallSlots}
                  wallHeightFt={wallHeightFt}
                  maxPanelHeightIn={maxPanelHeightIn}
                  thicknessIn={thicknessIn}
                  includeNailer={includeNailer}
                  primaryCornerIds={primaryCornerIds}
                  wallRunStopsByWallId={wallRunStopsByWallId}
                  wallTilingLengthInByWallId={wallTilingLengthInByWallId}
                  secondStory={stories[1] ?? null}
                  isSquareBalePanelization={panelizationType === "square-bale-panels"}
                  squareBaleStudConfig={squareBaleStudConfig}
                  bracingStyle={bracingStyle}
                  nailerOffsetIn={nailerOffsetIn}
                  jackStudConfig={jackStudConfig}
                  standardWidthIn={standardWidthIn}
                  isBaleFoundationFloor={isBaleFoundationFloor}
                  baleFoundationTopDepthIn={baleFoundationTopDepthIn}
                  baleFoundationBottomDepthIn={baleFoundationBottomDepthIn}
                  baleFoundationGapIn={baleFoundationGapIn}
                  baleFoundationFieldSpacingIn={baleFoundationFieldSpacingIn}
                  floorBottomSkinEnabled={hasSteelClaySkin}
                  leastAccessibleCorner={leastAccessibleCorner}
                  compassRef={compassNeedleRef}
                  simplified={simplified3D}
                  showWraps={showWraps}
                  showFloorPanels={floorsEnabled && showFloorDeck3D}
                  showRoofPanels={roofEnabled && showRoofDeck3D}
                  roofPitchIn12={roofTrussLayoutContext?.pitchIn12}
                  roofEaveHeightFt={gableEaveHeightIn / 12}
                  roofForm={roofFormFromProfile}
                  roofDeckSolid={showRoofDeck3DSolid}
                  checkedInteriorIds={checkedInteriorIds}
                  checkedExteriorIds={checkedExteriorIds}
                  tool3D={tool3D}
                  onToggleOpening={handleToggleOpening}
                  onSetWindowSillHeight={handleSetWindowSillHeight}
                  onSetWindowHeight={handleSetWindowHeight}
                  gableTilesByWallId={gableTilesByWallId}
                  roofEnabled={roofEnabled}
                  trussPlateInsetIn={trussPlateInsetIn}
                  boxBeamCoverageByWallId={boxBeamCoverageByWallId}
                  boxBeamSizeId={boxBeamSizeId}
                  midWallBeamsByWallId={midWallBeamsByStoryAndWallId.ground}
                  secondStoryMidWallBeamsByWallId={midWallBeamsByStoryAndWallId.second}
                  spanningHeadersByWallId={spanningHeadersByStoryAndWallId.ground}
                  secondStorySpanningHeadersByWallId={spanningHeadersByStoryAndWallId.second}
                  spanningHeaderNameById={spanningHeaderNameById}
                />
              ))}
            {editorTab === "foundation" && foundationType.usesPierGrid && (
              <FoundationCanvas footprint={footprint} offsetPx={offsetPx} piers={pierGrid} toolbarPortalTarget={foundationToolbarPortalNode} />
            )}
            {editorTab === "floor" && foundationType.usesPierGrid && (
              <FloorCanvas
                footprint={footprint}
                offsetPx={offsetPx}
                floorPanels={floorPanels}
                piers={pierGrid}
                joistLayout={joistLayout}
                baleFoundationRingA={baleFoundationRingA?.outer ?? null}
                baleFoundationRingB={baleFoundationRingB?.outer ?? null}
                baleFoundationRingAInner={baleFoundationRingA?.inner ?? null}
                baleFoundationRingBInner={baleFoundationRingB?.inner ?? null}
                baleFoundationFieldLayout={baleFoundationFieldLayout}
              />
            )}
            {editorTab === "roof" &&
              (roofSystemTypeId !== "truss" ? (
                <p className={styles.note}>Switch Roof System to Truss (Roof Tools, right sidebar) to use the truss layout editor.</p>
              ) : roofTrussLayoutContext && roofTrussBuiltMembers ? (
                <RoofTrussLayoutView
                  trussMembers={roofTrussBuiltMembers.members}
                  spanIn={roofTrussLayoutContext.spanIn}
                  peakHeightIn={roofTrussBuiltMembers.peakHeightIn}
                  runIn={roofTrussLayoutContext.runIn}
                  spacingIn={roofTrussSpacingIn}
                  doubling={roofTrussDoublingStrategy}
                  roofBaseHeightIn={gableEaveHeightIn}
                  note={roofTrussLayoutContext.asymmetricNote ?? undefined}
                />
              ) : (
                <p className={styles.note}>
                  Select two opposite gable end walls from their Elevation views (Wall tab), with a Peaked roofline profile, to see the truss
                  layout here.
                </p>
              ))}
          </div>

          {footprint && (
            <BuildingSummaryRender
              footprint={footprint}
              wallSlots={overlayWallSlots}
              wallHeightFt={wallHeightFt}
              maxPanelHeightIn={maxPanelHeightIn}
              thicknessIn={thicknessIn}
              includeNailer={includeNailer}
              primaryCornerIds={primaryCornerIds}
              wallRunStopsByWallId={wallRunStopsByWallId}
              wallTilingLengthInByWallId={wallTilingLengthInByWallId}
              secondStory={stories[1] ?? null}
              isSquareBalePanelization={panelizationType === "square-bale-panels"}
              squareBaleStudConfig={squareBaleStudConfig}
              bracingStyle={bracingStyle}
              nailerOffsetIn={nailerOffsetIn}
              jackStudConfig={jackStudConfig}
              standardWidthIn={standardWidthIn}
              gableTilesByWallId={gableTilesByWallId}
              roofEnabled={roofEnabled}
              trussPlateInsetIn={trussPlateInsetIn}
              boxBeamCoverageByWallId={boxBeamCoverageByWallId}
              boxBeamSizeId={boxBeamSizeId}
              midWallBeamsByWallId={midWallBeamsByStoryAndWallId.ground}
              secondStoryMidWallBeamsByWallId={midWallBeamsByStoryAndWallId.second}
              spanningHeadersByWallId={spanningHeadersByStoryAndWallId.ground}
              secondStorySpanningHeadersByWallId={spanningHeadersByStoryAndWallId.second}
              spanningHeaderNameById={spanningHeaderNameById}
              onCapture={handleCaptureRenderImage}
              onCaptureDone={handleCaptureDone}
              /* ⚠ `effectivelyOpenNoteIds`, not `openNoteIds` — the Summary
                 page opens this section without the tray, and keying the
                 capture on the tray alone showed the Project Summary with no
                 rendering on it. See that memo's comment. */
              captureLive={effectivelyOpenNoteIds.has("detail-summary")}
              captureRequestId={captureRequestId}
            />
          )}

          {/* U4 — THE SUMMARY PAGE. Takes the canvas column's flex slot while
              it owns the surface; the left sidebar beside it is untouched, so
              U0's Review Log / Read Me / Bug / `?` front doors stay reachable
              from here.

              ⚠ The tray is STILL BELOW, and that is the staging on purpose:
              every section remains reachable the old way until U5.2 deletes
              it, so no intermediate stage can make anything unreachable. */}
          {editorSurface === "summary" && (
            <div className={styles.editorPageLayer} data-editor-surface="summary">
              <div ref={setSummaryHostEl} data-summary-page-host="" />
            </div>
          )}

          {/* U5.1 — PRINT. Holds exactly today's controls and every formal
              document (Tommy: Print holds *"all the shop drawings"*). ⚠ NOT a
              printing customization editor: that is U6, and it is deliberately
              deferred because the honest print blocker is pagination, not the
              picker — Shipping, Plaster Master and Project Summary each run
              1–2.5 pages over on any page size, and a customization editor
              built on unverified pagination would let a user arrange sheets
              that do not paginate. */}
          {editorSurface === "print" && (
            <div className={styles.editorPageLayer} data-editor-surface="print">
              <div className={styles.editorPageControls}>{printPageControls}</div>
              <div ref={setPrintHostEl} data-print-page-host="" />
            </div>
          )}

        </div>

        <StickyNote
          id="detail-summary"
          label="Project Summary"
          /* ⚠ No `portalTo` and no page-aware `isOpen` here, deliberately.
             U4.1 wired this one section by hand; U4.2 replaced that with
             `SectionSurfaceContext`, which answers for all ~27 at once. Two
             mechanisms for one behaviour is how they drift. */
          isOpen={openNoteIds.has("detail-summary")}
          isFullscreen={fullscreenNoteId === "detail-summary"}
          cascadeIndex={noteOpenOrder.indexOf("detail-summary")}
          onClose={() => handleToggleNote("detail-summary")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-summary")}
          onPrint={() => handlePrintNote("detail-summary")}
        >
        <ProjectSummaryPage
          role={role}
          renderImageDataUrl={renderImageDataUrl}
          panelsTotal={allWallPanelSlots.length + openingCounts.windows * 2 + openingCounts.doors}
          panelsNote={`${allWallPanelSlots.length} wall panels + ${openingCounts.windows} window header/sill pair${openingCounts.windows === 1 ? "" : "s"} + ${openingCounts.doors} door header${openingCounts.doors === 1 ? "" : "s"}.`}
          openingsNote={`${openingCounts.windows} window${openingCounts.windows === 1 ? "" : "s"}, ${openingCounts.doors} door${openingCounts.doors === 1 ? "" : "s"}`}
          totalWeightLb={totalWeightLb}
          totalWeightKg={totalWeightKg}
          weightNote={`Straw: ${strawWeight.weightLb.toFixed(1)} lb. Wood (${woodEligibleCount} standard/braced panels): ${(totalWoodWeightKg * KG_TO_LB).toFixed(1)} lb.`}
          price={price}
          priceNote="Priced per panel type (standard/corner/braced/opening/roof rates), see Review Log."
          costsRedacted={costsRedacted}
          priceRedactedGap={PRICE_GAP}
          priceRedactedNote={PRICE_REDACTED_NOTE}
          carbonSequesteredLb={carbonRange.atStandardMoisture.carbonLb}
          carbonSequesteredKg={carbonRange.atStandardMoisture.carbonKg}
          netCO2eKg={embodiedCarbon.netCO2eKg}
          netCO2eNote={`Straw sequestered: +${embodiedCarbon.strawCO2eKg.toFixed(1)} kg CO2e. Concrete embodied: −${embodiedCarbon.concreteCO2eKg.toFixed(1)} kg CO2e.`}
          strawMoistWeightLb={strawWeight.weightLb}
          strawMoistureContentPct={strawMoistureContent.standard * 100}
          strawDryWeightLb={carbonRange.atStandardMoisture.dryWeightKg * KG_TO_LB}
          strawCarbonFractionPct={carbonFractionOfDryMass.value * 100}
          strawCarbonLb={carbonRange.atStandardMoisture.carbonLb}
          strawCO2eLb={embodiedCarbon.strawCO2eKg * KG_TO_LB}
          strawCO2eKg={embodiedCarbon.strawCO2eKg}
          co2eEquivalentMilesDriven={co2eEquivalencies.milesDriven}
          co2eEquivalentLbCoalBurned={co2eEquivalencies.lbCoalBurned}
          co2eEquivalentSmartphonesCharged={co2eEquivalencies.smartphonesCharged}
          estimatedBearingLb={estimatedTotalBearingLb}
          estimatedShearLb={estimatedTotalShearLb}
          permeanceLabel={
            permResult.computable
              ? `${permResult.permTotal!.toFixed(2)} perm (${season})`
              : "not computable — one or both finishes lack a numeric perm rating"
          }
          vaporCheckLabel={
            vaporCheck.computable
              ? vaporCheck.passes
                ? "PASS — exterior is more vapor-open than interior"
                : "FAIL — exterior is not more vapor-open than interior"
              : "not computable"
          }
          vaporCheckPasses={vaporCheck.computable ? vaporCheck.passes : null}
          foundationConcreteNote={foundationConcreteNote}
          floorJoistNote={floorJoistNote}
          roofMaterialNote={roofMaterialNote}
          plywoodThreeQuarterSheetCount={plywoodThreeQuarterSheetCount}
          plywoodHalfSheetCount={plywoodHalfSheetCount}
          strawBaleNote={strawBaleSummaryNote}
          fastenerItems={fastenerItemTotals.items}
          fastenerTotalWeightLb={fastenerItemTotals.totalWeightLb}
          fastenerUnmodeledLabels={fastenerItemTotals.unmodeledLabels}
          plasterNote={plasterNote}
        />
        </StickyNote>

        <StickyNote
          id="project-totals"
          label="Project Totals"
          isOpen={openNoteIds.has("project-totals")}
          isFullscreen={fullscreenNoteId === "project-totals"}
          cascadeIndex={noteOpenOrder.indexOf("project-totals")}
          onClose={() => handleToggleNote("project-totals")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("project-totals")}
          onPrint={() => handlePrintNote("project-totals")}
        >
          <table className={styles.results}>
            <tbody>
              <tr>
                <td>Panels</td>
                <td>
                  {allWallPanelSlots.length + openingCounts.windows * 2 + openingCounts.doors}
                  <br />
                  <span className={styles.note}>
                    {allWallPanelSlots.length} wall panels + {openingCounts.windows} window header/sill pair
                    {openingCounts.windows === 1 ? "" : "s"} + {openingCounts.doors} door header
                    {openingCounts.doors === 1 ? "" : "s"} — a window is a header + sill panel, a door is a header
                    panel only (no sill), each counted individually.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Openings</td>
                <td>
                  {openingCounts.windows} window{openingCounts.windows === 1 ? "" : "s"}, {openingCounts.doors} door
                  {openingCounts.doors === 1 ? "" : "s"}
                </td>
              </tr>
              <tr>
                <td>Total weight</td>
                <td>
                  {totalWeightLb.toFixed(1)} lb ({totalWeightKg.toFixed(1)} kg)
                  <br />
                  <span className={styles.note}>
                    Straw: {strawWeight.weightLb.toFixed(1)} lb. Wood ({woodEligibleCount} standard/braced
                    panels{includeNailer ? ", with nailer" : ""}): {(totalWoodWeightKg * KG_TO_LB).toFixed(1)} lb.
                    Corner and safety-gap panels&apos; wood not modeled (no BOM yet). Fasteners not modeled.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Price</td>
                <td>
                  {/* Stage 4B: the gap, and why. An em dash and a named reason
                      — never `$0.00`, never a number built from a defaulted
                      markup. The Markup box is not rendered at all: there is
                      nothing of the owner's for it to modify. */}
                  {costsRedacted ? (
                    <span data-price-redacted="">
                      {PRICE_GAP}
                      <span className={styles.note}> — {PRICE_REDACTED_NOTE}</span>
                    </span>
                  ) : (
                    <>
                      ${price.toFixed(2)}
                      <span className={styles.note}>
                        {" "}
                        — priced per panel type (standard/corner/braced/opening/roof rates), see Review Log
                      </span>
                    </>
                  )}
                  {role !== "public" && !costsRedacted && (
                    <div>
                      <label>
                        Markup{" "}
                        <input
                          type="number"
                          step="0.05"
                          min="1"
                          value={priceModifier}
                          onChange={(e) => setPriceModifier(Number(e.target.value))}
                          style={{ width: 64 }}
                        />
                        x
                      </label>
                      <p className={styles.note}>
                        Fabricator/admin-only markup, already included in the price above (default{" "}
                        {priceRates.totalModifier}x). Public viewers never see this markup applied — their price is
                        the base material cost only (as if this were 1x).
                      </p>
                    </div>
                  )}
                </td>
              </tr>
              <tr>
                <td>Carbon sequestered</td>
                <td>
                  {carbonRange.atStandardMoisture.carbonLb.toFixed(1)} lb (
                  {carbonRange.atStandardMoisture.carbonKg.toFixed(1)} kg) @{" "}
                  {(strawMoistureContent.standard * 100).toFixed(0)}% moisture (standard)
                  <br />
                  <span className={styles.note}>
                    Range {(strawMoistureContent.min * 100).toFixed(0)}%–
                    {(strawMoistureContent.max * 100).toFixed(0)}% moisture:{" "}
                    {carbonRange.atMaxMoisture.carbonLb.toFixed(1)}–
                    {carbonRange.atMinMoisture.carbonLb.toFixed(1)} lb. Straw only — wood carbon not included.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Net embodied carbon (CO2e)</td>
                <td>
                  {embodiedCarbon.netCO2eKg >= 0 ? "+" : ""}
                  {embodiedCarbon.netCO2eKg.toFixed(1)} kg CO2e
                  <br />
                  <span className={styles.note}>
                    Straw sequestered: +{embodiedCarbon.strawCO2eKg.toFixed(1)} kg CO2e. Concrete embodied: −
                    {embodiedCarbon.concreteCO2eKg.toFixed(1)} kg CO2e
                    {foundationTypeId === "concrete-pier"
                      ? ` (${pierGrid.length} piers @ ${concretePierDimensions.diameterIn}in dia. x ${concretePierDimensions.depthFt}ft deep, see Review Log)`
                      : " (none for this foundation type)"}
                    . Wood carbon not included.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Estimated total bearing capacity</td>
                <td>
                  ~{Math.round(estimatedTotalBearingLb).toLocaleString()} lb
                  <br />
                  <span className={styles.note}>
                    Across {allInstances.filter((i) => BEARING_ELIGIBLE_TYPES.has(i.panelType)).length}{" "}
                    bearing-eligible panels (double stud pack). Building Integrity&apos;s own first-pass NDS
                    estimate — not a licensed engineer&apos;s calculation, real load-bearing capacity isn&apos;t
                    modeled yet.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Estimated total shear capacity</td>
                <td>
                  ~{Math.round(estimatedTotalShearLb).toLocaleString()} lb
                  <br />
                  <span className={styles.note}>
                    Across {allInstances.filter((i) => i.panelType === "braced").length}{" "}
                    braced panels (diagonal brace). Building Integrity&apos;s own first-pass NDS estimate — not a
                    licensed engineer&apos;s calculation, real shear value isn&apos;t modeled yet.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Assembly permeance ({season})</td>
                <td>
                  {permResult.computable
                    ? `${permResult.permTotal!.toFixed(2)} perm`
                    : "not computable — one or both finishes lack a numeric perm rating"}
                </td>
              </tr>
              <tr>
                <td>Vapor-openness rule</td>
                <td className={vaporCheck.passes === false ? styles.fail : undefined}>
                  {vaporCheck.computable
                    ? vaporCheck.passes
                      ? "PASS — exterior is more vapor-open than interior"
                      : "FAIL — exterior is not more vapor-open than interior"
                    : "not computable — one or both finishes lack a numeric perm rating"}
                </td>
              </tr>
            </tbody>
          </table>
        </StickyNote>

        <StickyNote
          id="review-log"
          label="Review Log — Items for Engineer/Contractor Review"
          isOpen={openNoteIds.has("review-log")}
          isFullscreen={fullscreenNoteId === "review-log"}
          cascadeIndex={noteOpenOrder.indexOf("review-log")}
          onClose={() => handleToggleNote("review-log")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("review-log")}
          onPrint={() => handlePrintNote("review-log")}
        >
          {reviewLog.length === 0 ? (
            <p>No pending values used in this calculation.</p>
          ) : (
            <ul>
              {reviewLog.map((entry, i) => (
                <li key={i}>
                  <strong>{entry.label}:</strong> {entry.note}
                </li>
              ))}
            </ul>
          )}
        </StickyNote>

        {/* Report Bug / Request Feature, and Read Me — the two left-bar icons
            whose content already existed as real routes (/report-bug,
            /read-me). Both render the routes' own components, so the wording,
            the mailto: address, the liability statement and the Venmo QR are
            the same ones, by reference and not by copy.

            NEITHER IS IN `allNoteSections` OR `formalDocumentNoteIds` on
            purpose: they are chrome, not sections of the document. They do not
            appear in the tray's card list, "Choose sections" cannot offer them,
            and the PDF packet cannot pick them up. They do share the ordinary
            note machinery (open order, cascade, fullscreen, ?openNote=), which
            is what lets Read Me's QR be blown up to scan.

            ⚠ THAT ALSO MAKES THEM INVISIBLE TO ANY COUNT OVER THOSE TWO
            COLLECTIONS, which U4 and U5 both walk and which the reachability
            harness counts as `relevantDetailPages.length + 3`. The category
            now has a name — `CHROME_NOTE_IDS` in `chromeNotes.ts` — so a
            later exhaustive walk can subtract a named set instead of
            rediscovering two orphans. Nothing reads it at runtime; the ids
            below are still the literals they always were. */}
        <StickyNote
          id="report-bug"
          label="Report Bug / Request Feature"
          isOpen={openNoteIds.has("report-bug")}
          isFullscreen={fullscreenNoteId === "report-bug"}
          cascadeIndex={noteOpenOrder.indexOf("report-bug")}
          onClose={() => handleToggleNote("report-bug")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("report-bug")}
        >
          <ReportBugContent
            variant="note"
            // One line, naming one screen, as the app itself labels it — and
            // nothing else. No version string, no user agent, no viewport
            // figures, no project state, and nothing is sent anywhere: the
            // user writes the email. A backend for this is a decided
            // deferral, not a gap to fill here.
            currentViewName={currentViewLabel({
              editorTab,
              viewerStop: currentViewerStop,
              viewerActive: isViewStopLive({ editorTab, footprint }),
            })}
            // OPENS it; never closes it. `handleToggleNote` stays the only
            // writer, but a link that shuts the thing it points at when that
            // thing is already open is not a link.
            onOpenReviewLog={() => {
              if (!openNoteIds.has("review-log")) handleToggleNote("review-log");
            }}
          />
        </StickyNote>

        <StickyNote
          id="read-me"
          label="Read Me"
          isOpen={openNoteIds.has("read-me")}
          isFullscreen={fullscreenNoteId === "read-me"}
          cascadeIndex={noteOpenOrder.indexOf("read-me")}
          onClose={() => handleToggleNote("read-me")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("read-me")}
        >
          <ReadMeContent variant="note" />
        </StickyNote>

        {role === "engineer" && (
          <StickyNote
            id="detail-assembly-performance"
            label="Assembly Performance"
            isOpen={openNoteIds.has("detail-assembly-performance")}
            isFullscreen={fullscreenNoteId === "detail-assembly-performance"}
            cascadeIndex={noteOpenOrder.indexOf("detail-assembly-performance")}
            onClose={() => handleToggleNote("detail-assembly-performance")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-assembly-performance")}
            onPrint={() => handlePrintNote("detail-assembly-performance")}
          >
            <table className={styles.results}>
              <tbody>
                <tr>
                  <td>Assembly permeance ({season})</td>
                  <td>
                    {permResult.computable
                      ? `${permResult.permTotal!.toFixed(2)} perm`
                      : "not computable — one or both finishes lack a numeric perm rating"}
                  </td>
                </tr>
                <tr>
                  <td>Vapor-openness rule</td>
                  <td className={vaporCheck.passes === false ? styles.fail : undefined}>
                    {vaporCheck.computable
                      ? vaporCheck.passes
                        ? "PASS — exterior is more vapor-open than interior"
                        : "FAIL — exterior is not more vapor-open than interior"
                      : "not computable — one or both finishes lack a numeric perm rating"}
                  </td>
                </tr>
                <tr>
                  <td>Target moisture content (install)</td>
                  <td>
                    {(strawMoistureContent.standard * 100).toFixed(0)}% (standard)
                    <br />
                    <span className={styles.note}>
                      Sensitivity range {(strawMoistureContent.min * 100).toFixed(0)}%–
                      {(strawMoistureContent.max * 100).toFixed(0)}%. {strawMoistureContent.note}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className={styles.note}>
              Fire-resistance rating and R-value aren&apos;t shown — no test/spec data exists in the catalog yet
              for either.
            </p>
          </StickyNote>
        )}

        <StickyNote
          id="detail-foundation"
          label="Detail Guide: Foundation"
          isOpen={openNoteIds.has("detail-foundation")}
          isFullscreen={fullscreenNoteId === "detail-foundation"}
          cascadeIndex={noteOpenOrder.indexOf("detail-foundation")}
          onClose={() => handleToggleNote("detail-foundation")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-foundation")}
          onPrint={() => handlePrintNote("detail-foundation")}
        >
          {foundationType.usesPierGrid ? (
            <DetailGuidePage
              title={`Toe-up & Foundation Anchoring — ${foundationType.label}`}
              triggerCondition={`Every ${foundationType.label.toLowerCase()} design — the full pier-to-wall-plate load path, including the toe-up's thermal-break detail.`}
              diagram={<PierFoundationDiagram foundationId={foundationTypeId as "crawlspace" | "concrete-pier" | "ground-screw" | "cinderblock-pier"} />}
              fastenerSchedule={foundationFasteners}
              fastenerScheduleNote={fastenerTableStatus.note}
              notes={[
                foundationType.vaporNote,
                `Pier grid: ${pierGrid.length} piers (perimeter + interior infill), max ${pierSpacingFt}ft o.c. (${pierSpacingStatus.note})`,
                ...(foundationType.loadCapacity
                  ? [
                      `Load-bearing capacity: ${foundationType.loadCapacity.value} ${foundationType.loadCapacity.unit} per pier. ${foundationType.loadCapacity.note}`,
                    ]
                  : []),
                "Beam and pier sizing depend on site soil report and span — not modeled here.",
                ...(foundationTypeId === "concrete-pier"
                  ? [
                      `Embodied carbon: ${concretePierVolumeFt3.toFixed(1)} ft3 concrete → ${embodiedCarbon.concreteCO2eKg.toFixed(1)} kg CO2e emitted (debit). Running net for the whole build: ${embodiedCarbon.netCO2eKg >= 0 ? "+" : ""}${embodiedCarbon.netCO2eKg.toFixed(1)} kg CO2e. ${concreteEmbodiedCarbonKgPerFt3.note}`,
                    ]
                  : []),
              ]}
              role={role}
            />
          ) : foundationType.id === "slab" ? (
            <DetailGuidePage
              title={`Thermally Broken Slab Foundation — ${foundationType.label}`}
              triggerCondition="Every thermally-broken-slab design — the footer/stem-wall/lip/foam/slab thermal-break detail."
              diagram={<SlabFoundationDiagram />}
              fastenerSchedule={[]}
              notes={[foundationType.vaporNote, slabFoundationDimensions.note]}
              role={role}
            />
          ) : foundationType.id === "rubble-trench-beam" ? (
            <DetailGuidePage
              title={`Rubble Trench Foundation — ${foundationType.label}`}
              triggerCondition="Every rubble-trench-w/-beam design — the trench/grade-beam-to-wall-plate load path, including the toe-up's thermal-break detail."
              diagram={<RubbleTrenchDiagram />}
              fastenerSchedule={foundationFasteners}
              fastenerScheduleNote={fastenerTableStatus.note}
              notes={[foundationType.vaporNote, "Trench depth/width and grade beam sizing depend on site soil report and frost depth — not modeled here."]}
              role={role}
            />
          ) : foundationType.id === "concrete-block-stem-wall" ? (
            <DetailGuidePage
              title={`Concrete Block Stem Wall Foundation — ${foundationType.label}`}
              triggerCondition="Every CMU stem-wall design — the footer/stem-wall/sill-to-wall-plate load path, including the toe-up's thermal-break detail."
              diagram={<ConcreteBlockStemWallDiagram />}
              fastenerSchedule={foundationFasteners}
              fastenerScheduleNote={fastenerTableStatus.note}
              notes={[foundationType.vaporNote, "Footer and stem-wall sizing depend on site soil report and frost depth — not modeled here."]}
              role={role}
            />
          ) : (
            <p className={styles.pending}>
              No Detail Guide page yet for {foundationType.label} — {foundationType.vaporNote}
            </p>
          )}
        </StickyNote>

        {isBaleFoundationFloor && (
          <StickyNote
            id="detail-bale-foundation"
            label="Floor: Bale Foundation"
            isOpen={openNoteIds.has("detail-bale-foundation")}
            isFullscreen={fullscreenNoteId === "detail-bale-foundation"}
            cascadeIndex={noteOpenOrder.indexOf("detail-bale-foundation")}
            onClose={() => handleToggleNote("detail-bale-foundation")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-bale-foundation")}
            onPrint={() => handlePrintNote("detail-bale-foundation")}
          >
            <DetailGuidePage
              title="Bale Foundation — Rim & Field Framing"
              triggerCondition="Every design using the Bale Foundation floor system — the Floor tab's own default floor type."
              diagram={
                <BaleFoundationCrossSectionDiagram
                  topDepthIn={baleFoundationTopDepthIn}
                  bottomDepthIn={baleFoundationBottomDepthIn}
                  gapIn={baleFoundationGapIn}
                />
              }
              fastenerSchedule={[]}
              notes={[
                "2 concentric doubled rings (2 framing stacks side by side each) bracket the wall, one under each wythe — the outer ring's outboard face flush with the wall's exterior face, the inner ring's inboard face flush with its interior face. Single (non-doubled) stacks fill the interior span inboard of the inner ring.",
                `${baleFoundationBoardCount} boards total (${baleFoundationLumberVolumeFt3.toFixed(1)} ft3) at the current footprint/spacing.`,
                "Gap fill material between the top and bottom boards isn't modeled yet — an open void in both 2D and 3D, to be flushed out later.",
                "Wall panels still render at their existing floor line (Z=0) — this assembly is additive, extending downward from there; wall placement doesn't shift onto this new assembly's own top surface yet.",
              ]}
              role={role}
            />
          </StickyNote>
        )}

        {docFloorJoistType && (
          <StickyNote
            id="detail-floor"
            label={`Floor: ${docFloorJoistType.label}`}
            isOpen={openNoteIds.has("detail-floor")}
            isFullscreen={fullscreenNoteId === "detail-floor"}
            cascadeIndex={noteOpenOrder.indexOf("detail-floor")}
            onClose={() => handleToggleNote("detail-floor")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-floor")}
            onPrint={() => handlePrintNote("detail-floor")}
          >
            <DetailGuidePage
              title={`Suspended Floor Joists — ${docFloorJoistType.label}`}
              triggerCondition={`Every suspended-floor design using ${docFloorJoistType.label} — the thermally-broken rim detail at each short end, plus long-side blocking.`}
              diagram={<FloorJoistDiagram floorJoistTypeId={docFloorJoistType.id} />}
              fastenerSchedule={[]}
              notes={[
                docFloorJoistType.note,
                joistLayout
                  ? `${joistLayout.joists.length} joists at ${docFloorJoistType.spacingIn}in o.c. (max), running perpendicular to the longest walls, landing on the perimeter (or a beam over the piers). Field joist depth: panel thickness (${thicknessIn}in) − ${FIELD_JOIST_DEPTH_REDUCTION_IN}in = ${fieldJoistDepthIn}in.`
                  : "Draw a footprint to see the generated joist count.",
                floorRimJoistDetail.note,
                floorLongSideBlockingNote.note,
                ...(docPerpendicular2x4Enabled ? [perpendicular2x4Addition.note] : []),
              ]}
              role={role}
            />
          </StickyNote>
        )}

        {docFloorJoistType && (
          <StickyNote
            id="detail-floor-assembly"
            label="Floor: Full Assembly"
            isOpen={openNoteIds.has("detail-floor-assembly")}
            isFullscreen={fullscreenNoteId === "detail-floor-assembly"}
            cascadeIndex={noteOpenOrder.indexOf("detail-floor-assembly")}
            onClose={() => handleToggleNote("detail-floor-assembly")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-floor-assembly")}
            onPrint={() => handlePrintNote("detail-floor-assembly")}
          >
            <DetailGuidePage
              title="Floor Structure — Full Assembly"
              triggerCondition="Every suspended-floor design — the full bottom-to-top layer build-up inside and over the joist bays."
              diagram={<FloorAssemblyDiagram />}
              fastenerSchedule={[]}
              notes={floorAssemblyLayers.map((layer) => `${layer.label}: ${layer.description}`)}
              role={role}
            />
          </StickyNote>
        )}

        {docFloorJoistType && (
          <StickyNote
            id="detail-floor-corner"
            label="Floor: Corner & Perimeter Sequencing"
            isOpen={openNoteIds.has("detail-floor-corner")}
            isFullscreen={fullscreenNoteId === "detail-floor-corner"}
            cascadeIndex={noteOpenOrder.indexOf("detail-floor-corner")}
            onClose={() => handleToggleNote("detail-floor-corner")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-floor-corner")}
            onPrint={() => handlePrintNote("detail-floor-corner")}
          >
            <DetailGuidePage
              title="Floor Insulation Sequencing — Corner & Perimeter Detail"
              triggerCondition="Every suspended-floor design — the corner cavity fill and the bay-before-decking sequencing rule."
              diagram={<FloorCornerDetailDiagram />}
              fastenerSchedule={[]}
              notes={[
                floorInsulationSequencingRule.note,
                floorCornerCavityDetail.note,
                floorFieldBayDetail.note,
              ]}
              role={role}
            />
          </StickyNote>
        )}

        {docFloorJoistType && docPerpendicular2x4Enabled && (
          <StickyNote
            id="detail-floor-addon"
            label="Floor: Perpendicular 2x4 Add-On Layer"
            isOpen={openNoteIds.has("detail-floor-addon")}
            isFullscreen={fullscreenNoteId === "detail-floor-addon"}
            cascadeIndex={noteOpenOrder.indexOf("detail-floor-addon")}
            onClose={() => handleToggleNote("detail-floor-addon")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-floor-addon")}
            onPrint={() => handlePrintNote("detail-floor-addon")}
          >
            <DetailGuidePage
              title="Perpendicular 2x4 Add-On Layer — Thermal Break Detail"
              triggerCondition="Suspended-floor designs with the Perpendicular 2x4 addition enabled — the add-on layer's own build-up, sitting atop the primary joists directly under the wall base plate."
              diagram={<FloorAddOnLayerDiagram />}
              fastenerSchedule={[]}
              notes={[
                perpendicular2x4Addition.note,
                ...floorAddOnLayerLayers.map((layer) => `${layer.label}: ${layer.description}`),
              ]}
              role={role}
            />
          </StickyNote>
        )}

        {docIsThermalSlabFloor && (
          <StickyNote
            id="detail-floor-thermal-slab"
            label="Floor: Thermally Broken Slab"
            isOpen={openNoteIds.has("detail-floor-thermal-slab")}
            isFullscreen={fullscreenNoteId === "detail-floor-thermal-slab"}
            cascadeIndex={noteOpenOrder.indexOf("detail-floor-thermal-slab")}
            onClose={() => handleToggleNote("detail-floor-thermal-slab")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-floor-thermal-slab")}
            onPrint={() => handlePrintNote("detail-floor-thermal-slab")}
          >
            <DetailGuidePage
              title="Floor: Thermally Broken Slab"
              triggerCondition="Every design using Thermally Broken Slab as its floor system — the slab is the foundation and the floor in one, so this reuses the foundation's own footer/stem-wall/lip/foam/slab detail."
              diagram={<SlabFoundationDiagram />}
              fastenerSchedule={[]}
              notes={[
                "The slab is both the foundation and the floor system — there's no separate suspended floor build-up (no joists, no corner/rim detail, no add-on layer) when this option is selected.",
                slabFoundationDimensions.note,
              ]}
              role={role}
            />
          </StickyNote>
        )}

        {(stories.length === 1 || trussPlateWallLengthTotalIn > 0) && (
          <StickyNote
            id="detail-truss-plate"
            label={stories.length === 1 ? "Roof: Truss Plate (Single-Story)" : "Roof: Truss Plate"}
            isOpen={openNoteIds.has("detail-truss-plate")}
            isFullscreen={fullscreenNoteId === "detail-truss-plate"}
            cascadeIndex={noteOpenOrder.indexOf("detail-truss-plate")}
            onClose={() => handleToggleNote("detail-truss-plate")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-truss-plate")}
            onPrint={() => handlePrintNote("detail-truss-plate")}
          >
            <DetailGuidePage
              title="Truss Plate — Roof Bearing"
              triggerCondition="Any wall whose own roof-bearing member isn't a Box Beam — every wall on a single-story building, or a two-story wall left off the Box Beam ring/selection (see the Roof tab)."
              diagram={
                <StandardPanel3DView
                  members={trussPlatePreviewMembers}
                  overallDimensions={{ heightIn: computeRoofBearingAssemblyHeightIn(false), widthIn: ASSEMBLY_PREVIEW_LENGTH_IN, depthIn: thicknessIn }}
                  displayName="Truss Plate"
                />
              }
              fastenerSchedule={[]}
              notes={[
                "3D model above is an illustrative 10ft segment, not full building length. 2x4 along the interior wythe, 2x6 along the exterior wythe (its own 5.5in width doubles as the Roof tab's truss plate inset), both capped by one continuous 3/4in plywood top skin.",
                `Timber HP fills the open cavity under the plywood cap, between the 2x4 and 2x6 (${timberHpTotal.gapWidthIn.toFixed(2)}in wide x 1.5in tall) — across every Truss Plate wall's own real length (${(trussPlateWallLengthTotalIn / 12).toFixed(1)}ft total): ${timberHpTotal.volumeFt3.toFixed(2)} ft3, ~${timberHpWeight.weightLb.toFixed(1)} lb (${timberHpWeight.weightKg.toFixed(1)} kg) at ${timberHpDensityLbFt3.value} lb/ft3.`,
                timberHpDensityLbFt3.note,
                "Real per-wall segments, sized to each wall's own actual length, are on their own \"Panel Fabrication: Truss Plate\" pages below (grouped by unique length) — with a real cut list and weight checker per segment.",
              ]}
              role={role}
            />
          </StickyNote>
        )}

        {((stories.length > 1 && boxBeamWallLengthTotalIn > 0) || midWallBeamWallLengthTotalIn > 0) && (
          <StickyNote
            id="detail-box-beam"
            label="Box Beam"
            isOpen={openNoteIds.has("detail-box-beam")}
            isFullscreen={fullscreenNoteId === "detail-box-beam"}
            cascadeIndex={noteOpenOrder.indexOf("detail-box-beam")}
            onClose={() => handleToggleNote("detail-box-beam")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-box-beam")}
            onPrint={() => handlePrintNote("detail-box-beam")}
          >
            <DetailGuidePage
              title="Box Beam"
              triggerCondition="Used either as this building's roofline roof-bearing member (2-story only — replaces that wall's own Truss Plate above the second story's row of panels, Roof tab) or as a Mid-Wall Bond Beam splitting a wall's own row at any height, on either story (Wall Elevation view) — same catalog of 5 web sizes (2 LVL, 3 dimensional-lumber) either way."
              diagram={
                <StandardPanel3DView
                  members={boxBeamPreviewMembers}
                  overallDimensions={{ heightIn: computeBoxBeamAssemblyHeightIn(boxBeamSizeId), widthIn: ASSEMBLY_PREVIEW_LENGTH_IN, depthIn: thicknessIn }}
                  displayName="Box Beam"
                />
              }
              fastenerSchedule={[]}
              notes={[
                `3D model above is an illustrative 10ft segment at the currently-selected roofline size (${BOX_BEAM_SIZE_OPTIONS.find((s) => s.id === boxBeamSizeId)!.label}), not full building length or every beam's own size. Two webs (exterior + interior wythe edges) capped top and bottom by 3/4in plywood — a hollow box, blown in with dense-pack cellulose.`,
                `Across every roofline Box Beam wall's own real length (${(boxBeamWallLengthTotalIn / 12).toFixed(1)}ft total): ${denseCelluloseTotal.volumeFt3.toFixed(2)} ft3, ~${denseCelluloseWeight.weightLb.toFixed(1)} lb (${denseCelluloseWeight.weightKg.toFixed(1)} kg) at ${densePackCelluloseDensityLbFt3.value} lb/ft3.`,
                densePackCelluloseDensityLbFt3.note,
                "Real per-wall/per-beam segments, sized to each one's own actual length and selected size, are on their own \"Panel Fabrication: Box Beam\" pages below (grouped by size + unique length) — with a real cut list and weight checker per segment.",
              ]}
              role={role}
            />
          </StickyNote>
        )}

        <StickyNote
          id="detail-door-ro"
          label="Door Rough Opening"
          isOpen={openNoteIds.has("detail-door-ro")}
          isFullscreen={fullscreenNoteId === "detail-door-ro"}
          cascadeIndex={noteOpenOrder.indexOf("detail-door-ro")}
          onClose={() => handleToggleNote("detail-door-ro")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-door-ro")}
          onPrint={() => handlePrintNote("detail-door-ro")}
        >
          <DetailGuidePage
            title="Door Rough Opening"
            triggerCondition="Every door opening — header, jack studs, and the resulting clear Rough Opening width. No sill (floor-level)."
            diagram={
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 0%", minWidth: 200 }}>
                  <StandardPanel3DView
                    members={doorHeaderMembers}
                    overallDimensions={{ heightIn: doorHeaderHeightIn, widthIn: doorHeaderWidthIn, depthIn: thicknessIn }}
                    displayName="Door Header"
                  />
                </div>
                <div style={{ flex: "1 1 0%", minWidth: 200 }}>
                  <StandardPanel3DView
                    members={doorJackStudMembers}
                    overallDimensions={{ heightIn: doorRoughOpeningHeightIn, widthIn: jackStudThicknessIn(jackStudConfig), depthIn: thicknessIn }}
                    displayName="Jack Stud"
                  />
                </div>
                <table className={styles.results} style={{ width: "100%" }}>
                  <tbody>
                    <tr>
                      <td>Door slot width (whole assembly)</td>
                      <td>{doorHeaderWidthIn.toFixed(1)}&quot;</td>
                    </tr>
                    <tr>
                      <td>Jack stud construction</td>
                      <td>{jackStudConfig === "plywood" ? "3/4in plywood sheet" : "2x4 stud pair (ext + int wythe)"}</td>
                    </tr>
                    <tr>
                      <td>Clear Rough Opening width</td>
                      <td>
                        {doorHeaderWidthIn.toFixed(1)}&quot; − 2 x {jackStudThicknessIn(jackStudConfig).toFixed(2)}&quot; = {doorRoughOpeningWidthIn.toFixed(1)}&quot;
                      </td>
                    </tr>
                    <tr>
                      <td>Selected door RO height (unit spec)</td>
                      <td>{doorRoughOpeningSelectedHeightIn.value}&quot;</td>
                    </tr>
                    <tr>
                      <td>Toe-up height</td>
                      <td>{toeUpHeightIn.value}&quot;</td>
                    </tr>
                    <tr>
                      <td>Real built Rough Opening height (= jack stud height)</td>
                      <td>
                        {doorRoughOpeningSelectedHeightIn.value}&quot; − {toeUpHeightIn.value}&quot; = {doorRoughOpeningHeightIn.toFixed(1)}&quot;
                      </td>
                    </tr>
                    <tr>
                      <td>Header height (RO top to wall standard height)</td>
                      <td>
                        {(wallHeightFt * 12).toFixed(1)}&quot; − {doorRoughOpeningHeightIn.toFixed(1)}&quot; = {doorHeaderHeightIn.toFixed(1)}&quot;
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            }
            fastenerSchedule={[]}
            notes={[
              "The header spans the full slot width, resting on top of both jack studs — the clear Rough Opening (where the door unit itself installs) is narrower, inside the jack studs.",
              "A door header is always a single upside-down-V truss web, on both interior and exterior wythes — see the Header Shop Drawing page.",
              `Rough Opening height = selected door RO (${doorRoughOpeningSelectedHeightIn.value}in) minus the toe-up height (${toeUpHeightIn.value}in) — a real formula, not illustrative. The door's jack studs span this full height (floor to header-bottom), since a door has no sill.`,
              `Header height = wall standard height (${(wallHeightFt * 12).toFixed(1)}in) minus the RO height (${doorRoughOpeningHeightIn.toFixed(1)}in) — the header fills everything above the RO up to the top plate.`,
              jackStudConfig === "2x4-stud"
                ? "2x4 stud jack studs selected — fastener count/weight not modeled for this config yet (plywood jack sheet fastening is modeled)."
                : `Plywood jack studs selected — screwed to the adjacent wall panel, 2x 4in T25 #9 screws every 6in (${doorJackStudFastenerResult.items[0]!.count} screws, ${doorJackStudFastenerResult.totalWeightLb.toFixed(2)} lb, for this one sheet at the real RO height).`,
            ]}
            role={role}
          />
        </StickyNote>

        <StickyNote
          id="detail-window-ro"
          label="Window Rough Opening"
          isOpen={openNoteIds.has("detail-window-ro")}
          isFullscreen={fullscreenNoteId === "detail-window-ro"}
          cascadeIndex={noteOpenOrder.indexOf("detail-window-ro")}
          onClose={() => handleToggleNote("detail-window-ro")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-window-ro")}
          onPrint={() => handlePrintNote("detail-window-ro")}
        >
          <DetailGuidePage
            title="Window Rough Opening"
            triggerCondition="Every window opening — header, jack studs, sill, and the resulting clear Rough Opening width."
            diagram={
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 0%", minWidth: 200 }}>
                  <StandardPanel3DView
                    members={windowHeaderMembers}
                    overallDimensions={{ heightIn: windowHeaderHeightIn, widthIn: windowHeaderWidthIn, depthIn: thicknessIn }}
                    displayName="Window Header (Long Header)"
                  />
                </div>
                <div style={{ flex: "1 1 0%", minWidth: 200 }}>
                  <StandardPanel3DView
                    members={jackStudMembers}
                    overallDimensions={{ heightIn: jackStudPreviewHeightIn, widthIn: jackStudThicknessIn(jackStudConfig), depthIn: thicknessIn }}
                    displayName="Jack Stud"
                  />
                </div>
                <div style={{ flex: "1 1 0%", minWidth: 200 }}>
                  <StandardPanel3DView
                    members={sillMembers}
                    overallDimensions={{ heightIn: sillHeightIn, widthIn: sillWidthIn, depthIn: thicknessIn }}
                    displayName="Sill Panel"
                  />
                </div>
                <table className={styles.results} style={{ width: "100%" }}>
                  <tbody>
                    <tr>
                      <td>Window slot width (whole assembly)</td>
                      <td>{windowHeaderWidthIn.toFixed(1)}&quot;</td>
                    </tr>
                    <tr>
                      <td>Jack stud construction</td>
                      <td>{jackStudConfig === "plywood" ? "3/4in plywood sheet" : "2x4 stud pair (ext + int wythe)"}</td>
                    </tr>
                    <tr>
                      <td>Clear Rough Opening width</td>
                      <td>
                        {windowHeaderWidthIn.toFixed(1)}&quot; − 2 x {jackStudThicknessIn(jackStudConfig).toFixed(2)}&quot; = {windowRoughOpeningWidthIn.toFixed(1)}&quot;
                      </td>
                    </tr>
                    <tr>
                      <td>Sill height</td>
                      <td>{sillHeightIn}&quot; default — customizable per window via the 3D Sill &amp; Header drag tool</td>
                    </tr>
                    <tr>
                      <td>Sill run</td>
                      <td>
                        {windowSillRunWidthsIn.length} sill panel{windowSillRunWidthsIn.length === 1 ? "" : "s"} @{" "}
                        {windowSillRunWidthsIn[0]?.toFixed(1) ?? "0.0"}&quot; each
                      </td>
                    </tr>
                    <tr>
                      <td>Selected window height (RO = sill-top to header-bottom)</td>
                      <td>{formatLengthIn(windowHeightIn, unitSystem)}</td>
                    </tr>
                    <tr>
                      <td>Jack stud height (sill-top to header-bottom)</td>
                      <td>{jackStudPreviewHeightIn.toFixed(1)}&quot;</td>
                    </tr>
                    <tr>
                      <td>Header height (RO top to wall standard height)</td>
                      <td>
                        {(wallHeightFt * 12).toFixed(1)}&quot; − ({sillHeightIn}&quot; + {jackStudPreviewHeightIn.toFixed(1)}&quot;) = {windowHeaderHeightIn.toFixed(1)}&quot;
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            }
            fastenerSchedule={[]}
            notes={[
              "The header spans the full slot width, resting on top of both jack studs — the clear Rough Opening (where the window unit itself installs) is narrower, inside the jack studs. The sill sits below, sized to that same clear RO width.",
              `A window ("long") header repeats as many peaks as needed to keep every truss web segment at or above a 30deg bracing angle — a door header is always exactly 1 peak. Both are on interior and exterior wythes.`,
              `A sill is a short Standard Panel (default ${sillHeightIn}in tall) — a window wider than one standard panel width (${standardWidthIn}in) gets multiple sill panels sharing the run instead of one oversized sill.`,
              `Window height (${windowHeightIn}in, selectable in Panelizer) is the window's own real Rough Opening height, sill-top to header-bottom — the jack studs span exactly this. Header height = wall standard height (${(wallHeightFt * 12).toFixed(1)}in) minus the RO's own top elevation (sill height + window height) — a real formula, not illustrative.`,
              jackStudConfig === "2x4-stud"
                ? "2x4 stud jack studs selected — fastener count/weight not modeled for this config yet (plywood jack sheet fastening is modeled)."
                : "Plywood jack studs selected — screwed to the adjacent wall panel, 2x 4in T25 #9 screws every 6in.",
            ]}
            role={role}
          />
        </StickyNote>

        {footprint && (
          <StickyNote
            id="detail-plan-view"
            label="Plan View"
            isOpen={openNoteIds.has("detail-plan-view")}
            isFullscreen={fullscreenNoteId === "detail-plan-view"}
            cascadeIndex={noteOpenOrder.indexOf("detail-plan-view")}
            onClose={() => handleToggleNote("detail-plan-view")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-plan-view")}
            onPrint={() => handlePrintNote("detail-plan-view")}
          >
            <PlanViewPage
              footprint={footprint}
              wallSlots={overlayWallSlots}
              wallStartOffsetIn={wallRenderOffsetIn}
              thicknessIn={thicknessIn}
              allInstances={allInstances}
              primaryCornerIds={primaryCornerIds}
              leastAccessibleCorner={leastAccessibleCorner}
              wallUnbuiltSpansIn={wallUnbuiltSpansIn}
              role={role}
            />
          </StickyNote>
        )}

        <StickyNote
          id="detail-material-totals"
          label="Material Totals"
          isOpen={openNoteIds.has("detail-material-totals")}
          isFullscreen={fullscreenNoteId === "detail-material-totals"}
          cascadeIndex={noteOpenOrder.indexOf("detail-material-totals")}
          onClose={() => handleToggleNote("detail-material-totals")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-material-totals")}
          onPrint={() => handlePrintNote("detail-material-totals")}
        >
          <DetailGuidePage
            title="Material Totals"
            triggerCondition="Every design — whole-project plywood sheet counts, plus straw bale purchase counts when Square Bale Panels is the selected panelization type."
            diagram={
              <table className={styles.results} style={{ width: "100%" }}>
                <tbody>
                  <tr>
                    <td>{PLYWOOD_THREE_QUARTER_ROW_LABEL}</td>
                    <td>
                      {plywoodAreaSqFt.threeQuarterSqFt.toFixed(1)} sqft → {plywoodThreeQuarterSheetCount} sheet
                      {plywoodThreeQuarterSheetCount === 1 ? "" : "s"} (4ft x 8ft, {PLYWOOD_SHEET_AREA_SQFT} sqft each)
                    </td>
                  </tr>
                  <tr>
                    <td>{PLYWOOD_HALF_ROW_LABEL}</td>
                    <td>
                      {plywoodAreaSqFt.halfSqFt.toFixed(1)} sqft → {plywoodHalfSheetCount} sheet
                      {plywoodHalfSheetCount === 1 ? "" : "s"} (4ft x 8ft, {PLYWOOD_SHEET_AREA_SQFT} sqft each)
                    </td>
                  </tr>
                  {panelizationType === "square-bale-panels" && (
                    <tr>
                      <td>Straw bales</td>
                      <td>
                        {strawBaleCount} bale{strawBaleCount === 1 ? "" : "s"} to purchase (
                        {strawBaleWeightLb.toLocaleString()} lb total, {STRAW_BALE_WEIGHT_LB} lb/bale)
                      </td>
                    </tr>
                  )}
                  {boardFeetByNominalSize.map((bf) => (
                    <tr key={bf.nominalSize}>
                      <td>{bf.nominalSize} dimensional lumber</td>
                      <td>
                        {bf.totalBoardFeet.toFixed(1)} bd ft → {bf.stickCount} stick{bf.stickCount === 1 ? "" : "s"} @{" "}
                        {bf.stockLengthFt}ft ({bf.boardFeetPerStick.toFixed(2)} bd ft/stick)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
            fastenerSchedule={[]}
            notes={[
              `${PLYWOOD_THREE_QUARTER_ROW_LABEL}: every Standard/Braced/Sill panel's 2 skins, every Column/Corner panel's 2 side plies, every Door/Window Header's top+bottom plate caps, plus the roof-bearing assembly's own plywood cap(s) — a box beam's top+bottom caps if Second Story is enabled, a truss plate's single cap otherwise — across the drawn footprint's real BUILT wall perimeter (a wall run stopped short of its corner carries no panels and no plate, so it is excluded), not an illustrative preview length. It also carries the Safety/Gap sheet of every wall run OVER 12ft (see the Safety/Gap redesign note on its own Shop Drawing page).`,
              `${PLYWOOD_HALF_ROW_LABEL}: the girt webs (girt bars themselves are dimensional lumber, tallied separately), plus the Safety/Gap sheet of every wall run of 12ft or LESS. Tommy, 2026-09-30: "Can we make it so that once below the threshold (of 12') the safety gap is 1/2in." Every run gets a safety gap; the 12ft line decides which of these two sheets it is, measured against the panel RUN rather than the wall (a wall that butts into a longer neighbour at both ends has a run two wall-thicknesses shorter than itself).`,
              "⚠ The two sheets are not just two thicknesses: 3/4in CDX is 5-ply and 1/2in CDX is 3-ply. Order against the row, not against the thickness alone.",
              ...(panelizationType === "square-bale-panels"
                ? [
                    "Straw bale count: 2 bales per Square Bale Panel instance (Tommy: \"two 18in bales\" per panel), counted as discrete purchase units rather than a density x volume estimate — real bales aren't infinitely resizable the way loose-pack straw is, even though the tiling math adjusts each panel's nominal width slightly to fit the wall run evenly.",
                  ]
                : ["Straw bale counts only apply when Square Bale Panels is the selected panelization type (Wall tab)."]),
              "Sheet counts round up from the summed real area (not per-instance), a reasonable purchasing estimate assuming offcuts get reused across panels.",
              `Board feet: every real panel instance's dimensional-lumber members (studs, plates, girts, braces, jack studs, headers), grouped by nominal size (2x4/2x6/etc — using NOMINAL, not actual, dimensions, per standard lumber-industry convention). Stick count assumes ${standardPanelHeightIn.value / 12}ft stock length (the standard panel height) and rounds up — doesn't account for cut-length waste/offcuts across pieces shorter than a full stick.`,
              "Roof-bearing assembly (Truss Plate/Box Beam) and the roof-catcher-beam Column preview aren't included in the board-feet total yet — only real, placed panel instances are (Gable End Panels now count too, via their own real per-tile instances).",
            ]}
            role={role}
          />
        </StickyNote>

        <StickyNote
          id="detail-shipping"
          label="Shipping"
          isOpen={openNoteIds.has("detail-shipping")}
          isFullscreen={fullscreenNoteId === "detail-shipping"}
          cascadeIndex={noteOpenOrder.indexOf("detail-shipping")}
          onClose={() => handleToggleNote("detail-shipping")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-shipping")}
          onPrint={() => handlePrintNote("detail-shipping")}
        >
          <DetailGuidePage
            title="Shipping"
            triggerCondition="Every design with at least 1 real panel instance — how many trucks this project needs, how each truck's own panels stack, and a rough shipping-cost estimate."
            diagram={
              <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                {/* Stage 4B, Open Item 6. The rate below is `useState` in this
                    editor and does NOT round-trip in a project file, so what a
                    browsing viewer sees here is their own default — not the
                    owner's rate, and not redacted either, because there was
                    never anything of the owner's here to redact. Said in one
                    line rather than left to be mistaken for the owner's
                    pricing. (The day these seven figures move into
                    ProjectState they become redaction targets, and
                    cloud/redaction.ts is what will force that.) */}
                {costsRedacted && (
                  <p className={styles.note} data-viewer-own-defaults="">
                    {VIEWER_OWN_DEFAULTS_NOTE}
                  </p>
                )}
                <div role="group" aria-label="Truck bed type" className={styles.toolbar}>
                  {truckBedTypes.value.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={selectedTruckBedId === t.id}
                      className={selectedTruckBedId === t.id ? styles.toolActive : styles.tool}
                      onClick={() => setSelectedTruckBedId(t.id)}
                      title={`${formatTrailerLengthIn(t.interiorLengthIn, unitSystem)} long x ${formatLengthIn(t.interiorWidthIn, unitSystem)} wide x ${formatLengthIn(t.interiorHeightIn, unitSystem)} tall (interior)`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <table className={styles.results} style={{ width: "100%", marginTop: 8 }}>
                  <tbody>
                    <tr>
                      <td>Selected trailer (interior)</td>
                      <td>
                        {formatTrailerLengthIn(selectedTruck.interiorLengthIn, unitSystem)} long x{" "}
                        {formatLengthIn(selectedTruck.interiorWidthIn, unitSystem)} wide x{" "}
                        {formatLengthIn(selectedTruck.interiorHeightIn, unitSystem)} tall
                      </td>
                    </tr>
                    <tr>
                      <td>Panels per stack (height-wise)</td>
                      <td>{shippingPanelsPerStack} panels tall, face to face, at {formatLengthIn(thicknessIn, unitSystem)} thick each</td>
                    </tr>
                    <tr>
                      <td>Trucks needed</td>
                      <td>{shippingTruckCount}</td>
                    </tr>
                    <tr>
                      <td>Miles (one-way)</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={shippingMiles}
                          onChange={(e) => setShippingMiles(Number(e.target.value))}
                          style={{ width: 80 }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>Rate</td>
                      <td>
                        ${" "}
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={shippingRatePerMile}
                          onChange={(e) => setShippingRatePerMile(Number(e.target.value))}
                          style={{ width: 64 }}
                        />
                        /mile, one-way
                      </td>
                    </tr>
                    <tr>
                      <td>Estimated shipping cost</td>
                      <td>
                        ${shippingCost.toFixed(2)}
                        <span className={styles.note}>
                          {" "}
                          — {shippingTruckCount} truck{shippingTruckCount === 1 ? "" : "s"} x {shippingMiles} mi x $
                          {shippingRatePerMile.toFixed(2)}/mi
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
                  {truckLoads.map((load, i) => (
                    <TruckLoad3DView
                      key={i}
                      load={load}
                      truck={shippingTruckDims}
                      panelHeightIn={wallHeightFt * 12}
                      bufferIn={shippingStackBufferIn.value}
                      panelTypeById={shippingPanelTypeById}
                      panelWidthById={shippingPanelWidthById}
                      panelHeightById={shippingPanelHeightById}
                      panelGableEdgeHeightsById={shippingGableEdgeHeightsById}
                      dunnageGapIn={headerSillDunnageGapIn.value}
                      displayName={`Truck ${i + 1} of ${shippingTruckCount}`}
                    />
                  ))}
                </div>
                {truckLoads.length === 0 && (
                  <p className={styles.note}>
                    No panels fit in this trailer type at this thickness/width — try a different truck bed.
                  </p>
                )}
              </div>
            }
            fastenerSchedule={[]}
            notes={[
              truckBedTypes.note ?? "",
              "Every panel lies flat, its own standard height (10ft) running along the trailer's length — every trailer's own cross-section is narrower than that, so a panel can only physically fit that way, with its width and thickness forming the stack's own cross-section.",
              `A ${shippingStackBufferIn.value}in buffer is kept clear on every side of every stack (Tommy) — shared between neighbors, so it's one gap between any two things (stack-to-stack or stack-to-wall), not doubled.`,
              'Loading order follows the point of least accessibility (Tommy: "the stack order must correlate to the point of least accessibility... that panel on the corner is the top of the first stack, and it\'s row stacked under it") — panels load starting at that corner, all the way around the footprint.',
              "A panel only stacks on top of another if it can safely support it — nothing gets loaded under something more than 10% bigger than itself, in width or height (Tommy: \"we cannot stack panels that are like 10% or more bigger than the top panel\"; a smaller panel can always sit on a bigger one, never the reverse). A header or sill that doesn't fit its neighbor splits into its own small stack right where it's needed in the load sequence — not batched separately at the end — and consecutive same-size ones (like 2 sills in a row) share one stack together.",
              `Headers and sills within 10% of the panelization standard width (${standardWidthIn}in) of each other can share a stack with a ${headerSillDunnageGapIn.value}in gap between them (Tommy: "stacked together with a small gap") — full-sized panels stay flush, with no gap. A header/sill is never left as a stack's own bottom if it can be avoided (Tommy: "should not be the bottom of a stack") — it holds until a full panel arrives to cap it, and full panels can sit above or below one this way. Longer headers outside that 10% band ship in their own separate stacks instead of merging into the main run.`,
              "Stacks pack row by row across the trailer's own width using each stack's own real width (Tommy: \"its very very handy to be able to have 2 rows of panels\") — 2 or more narrower stacks share a row whenever they both fit, rather than every stack being forced into one lane sized to the single widest stack anywhere. Within a row, a shallower stack's own leftover depth gets backfilled with another compatible stack instead of left empty, so a row of short header/sill stacks doesn't waste the trailer's own length.",
              "Jack studs ship as their own loose-lumber bundle (Tommy: \"jack studs can be piled up together and stacked 90 degrees hot dog rotation\") — thin sheets or 2x4 sticks piled face-to-face using their own real thickness, not the wall's own much thicker cross-section, so far more of them stack in the same trailer height.",
              shippingRatePerMileDefault.note ?? "",
              headerSillDunnageGapIn.note ?? "",
              "3D views always render simplified flat-colored boxes (one per panel, colored by its panel type) rather than full member geometry — matches the \"Viewer: 3D Boxes\" state available in the main wall 3D view.",
            ].filter(Boolean)}
            role={role}
          />
        </StickyNote>

        <StickyNote
          id="detail-plaster-master"
          label="Plaster Master"
          isOpen={openNoteIds.has("detail-plaster-master")}
          isFullscreen={fullscreenNoteId === "detail-plaster-master"}
          cascadeIndex={noteOpenOrder.indexOf("detail-plaster-master")}
          onClose={() => handleToggleNote("detail-plaster-master")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-plaster-master")}
          onPrint={() => handlePrintNote("detail-plaster-master")}
        >
          <DetailGuidePage
            title="Plaster Master"
            triggerCondition="Interior finish = Clay plaster and/or exterior finish = Lime plaster (Panelizer > Wall Assembly), and/or the Bale Foundation floor's own rodent/air-sealed steel + clay bottom skin (Floor tab) — total plaster materials, purchase units, and price."
            diagram={
              <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                {/* Stage 4B, Open Item 6 — the same line, for the same reason
                    as the Shipping card: these four material prices, the steel
                    mesh price and the labor rate are all `useState` here and
                    are in no project file, so they are the viewer's own. */}
                {costsRedacted && (
                  <p className={styles.note} data-viewer-own-defaults="">
                    {VIEWER_OWN_DEFAULTS_NOTE}
                  </p>
                )}
                <table className={styles.results} style={{ width: "100%", marginBottom: 8 }}>
                  <tbody>
                    <tr>
                      <td>Net plastered area (per side)</td>
                      <td>
                        {plasterNetAreaSqFt.toFixed(1)} sqft
                        <span className={styles.note}>
                          {" "}
                          — {plasterGrossWallAreaSqFt.toFixed(1)} sqft gross wall{stories.length > 1 ? " (both stories)" : ""} minus{" "}
                          {(plasterOpeningsAreaSqFtPerFloor * plasterFloorCount).toFixed(1)} sqft of window/door rough openings
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Sand price</td>
                      <td>
                        $ <input type="number" min="0" step="1" value={plasterSandPricePerCuYd} onChange={(e) => setPlasterSandPricePerCuYd(Number(e.target.value))} style={{ width: 56 }} /> /cu yd
                      </td>
                    </tr>
                    <tr>
                      <td>Clay price</td>
                      <td>
                        $ <input type="number" min="0" step="0.5" value={plasterClayPricePerBag} onChange={(e) => setPlasterClayPricePerBag(Number(e.target.value))} style={{ width: 56 }} /> /bag (50lb)
                      </td>
                    </tr>
                    <tr>
                      <td>Lime price</td>
                      <td>
                        $ <input type="number" min="0" step="0.5" value={plasterLimePricePerBag} onChange={(e) => setPlasterLimePricePerBag(Number(e.target.value))} style={{ width: 56 }} /> /bag (50lb)
                      </td>
                    </tr>
                    <tr>
                      <td>Chopped straw price</td>
                      <td>
                        $ <input type="number" min="0" step="0.05" value={plasterStrawPricePerCuFt} onChange={(e) => setPlasterStrawPricePerCuFt(Number(e.target.value))} style={{ width: 56 }} /> /cu ft
                      </td>
                    </tr>
                    {plasterSideResults.floorBottom && (
                      <tr>
                        <td>Steel mesh price</td>
                        <td>
                          $ <input type="number" min="0" step="0.05" value={steelMeshPricePerSqFt} onChange={(e) => setSteelMeshPricePerSqFt(Number(e.target.value))} style={{ width: 56 }} /> /sqft
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td>Labor rate</td>
                      <td>
                        $ <input type="number" min="0" step="1" value={plasterLaborRatePerHour} onChange={(e) => setPlasterLaborRatePerHour(Number(e.target.value))} style={{ width: 56 }} /> /hr
                      </td>
                    </tr>
                    <tr>
                      <td>Extra fussy hours</td>
                      <td>
                        <input type="number" min="0" step="0.5" value={plasterFussyHoursExtra} onChange={(e) => setPlasterFussyHoursExtra(Number(e.target.value))} style={{ width: 56 }} />
                        <span className={styles.note}> — manual add-on for extra detail work not captured by the field/edge estimate below</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {plasterSideResults.interior && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontWeight: 700, margin: "0 0 4px" }}>Interior — Clay Plaster</p>
                    <PlasterCoatEditor
                      title="Base Coat"
                      coat={plasterInputs.interior.base}
                      onThicknessChange={(v) => updatePlasterCoatThickness("interior", "base", v)}
                      onPartChange={(part, v) => updatePlasterCoatPart("interior", "base", part, v)}
                      result={plasterSideResults.interior.base}
                    />
                    <PlasterCoatEditor
                      title="Finish Coat"
                      coat={plasterInputs.interior.finish}
                      onThicknessChange={(v) => updatePlasterCoatThickness("interior", "finish", v)}
                      onPartChange={(part, v) => updatePlasterCoatPart("interior", "finish", part, v)}
                      result={plasterSideResults.interior.finish}
                    />
                    <p style={{ fontSize: 13, margin: 0 }}>
                      Interior material subtotal: <strong>${(plasterSideResults.interior.base.materialCost + plasterSideResults.interior.finish.materialCost).toFixed(2)}</strong>
                    </p>
                  </div>
                )}

                {plasterSideResults.exterior && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontWeight: 700, margin: "0 0 4px" }}>Exterior — Lime Plaster</p>
                    <PlasterCoatEditor
                      title="Base Coat"
                      coat={plasterInputs.exterior.base}
                      onThicknessChange={(v) => updatePlasterCoatThickness("exterior", "base", v)}
                      onPartChange={(part, v) => updatePlasterCoatPart("exterior", "base", part, v)}
                      result={plasterSideResults.exterior.base}
                    />
                    <PlasterCoatEditor
                      title="Finish Coat"
                      coat={plasterInputs.exterior.finish}
                      onThicknessChange={(v) => updatePlasterCoatThickness("exterior", "finish", v)}
                      onPartChange={(part, v) => updatePlasterCoatPart("exterior", "finish", part, v)}
                      result={plasterSideResults.exterior.finish}
                    />
                    <p style={{ fontSize: 13, margin: 0 }}>
                      Exterior material subtotal: <strong>${(plasterSideResults.exterior.base.materialCost + plasterSideResults.exterior.finish.materialCost).toFixed(2)}</strong>
                    </p>
                  </div>
                )}

                {plasterSideResults.floorBottom && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontWeight: 700, margin: "0 0 4px" }}>Floor Bottom — Rodent/Air-Sealed Steel + Clay Skin</p>
                    <p style={{ fontSize: 13, margin: "0 0 4px" }}>
                      {plasterFloorBottomAreaSqFt.toFixed(1)} sqft (the footprint's own plan-view area — the floor's underside) — steel mesh:{" "}
                      ${steelMeshCost.toFixed(2)}
                    </p>
                    <PlasterCoatEditor
                      title="Base Coat"
                      coat={plasterInputs.floorBottom.base}
                      onThicknessChange={(v) => updatePlasterCoatThickness("floorBottom", "base", v)}
                      onPartChange={(part, v) => updatePlasterCoatPart("floorBottom", "base", part, v)}
                      result={plasterSideResults.floorBottom.base}
                    />
                    <PlasterCoatEditor
                      title="Finish Coat"
                      coat={plasterInputs.floorBottom.finish}
                      onThicknessChange={(v) => updatePlasterCoatThickness("floorBottom", "finish", v)}
                      onPartChange={(part, v) => updatePlasterCoatPart("floorBottom", "finish", part, v)}
                      result={plasterSideResults.floorBottom.finish}
                    />
                    <p style={{ fontSize: 13, margin: 0 }}>
                      Floor bottom material subtotal:{" "}
                      <strong>
                        ${(plasterSideResults.floorBottom.base.materialCost + plasterSideResults.floorBottom.finish.materialCost + steelMeshCost).toFixed(2)}
                      </strong>
                    </p>
                  </div>
                )}

                <table className={styles.results} style={{ width: "100%" }}>
                  <tbody>
                    <tr>
                      <td>Labor hours</td>
                      <td>
                        {plasterTotalLaborHrs.toFixed(1)} hrs
                        <span className={styles.note}>
                          {" "}
                          — {(plasterLaborHoursPerSide.fieldHrs * plasterActiveSideCount).toFixed(1)} field +{" "}
                          {(plasterLaborHoursPerSide.edgeHrs * plasterActiveSideCount).toFixed(1)} edge (near {plasterRoughOpeningCount} rough opening
                          {plasterRoughOpeningCount === 1 ? "" : "s"}){plasterFussyHoursExtra > 0 ? ` + ${plasterFussyHoursExtra} fussy` : ""}, across {plasterActiveSideCount} active side
                          {plasterActiveSideCount === 1 ? "" : "s"}
                          {hasSteelClaySkin ? ` + ${plasterFloorBottomLaborHours.totalHrs.toFixed(1)} floor bottom (field only, no rough openings)` : ""}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Labor cost</td>
                      <td>${plasterTotalLaborCost.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>Total material cost</td>
                      <td>${plasterTotalMaterialCost.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>Grand total price</td>
                      <td>
                        <strong>${plasterGrandTotalCost.toFixed(2)}</strong>
                        <span className={styles.note}> — material + labor</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            }
            fastenerSchedule={[]}
            notes={[
              "Every formula here (Cu Ft, Parts ratios, buckets/bags/cu-yd/110-gal-tub conversions, and the field/edge labor-hours split) mirrors Tommy's own \"Faster Plaster Calculator\" spreadsheet.",
              "Net plastered area auto-derives from the drawn footprint (BUILT wall perimeter x wall height, doubled if Second Story is on — a wall run stopped short is not plastered over the span it does not occupy) minus each window/door's own clear Rough Opening area — the spreadsheet's own workflow instead had you type in a sqft figure by hand.",
              "Base Coat mix defaults (Sand 3.5 : Clay 1 : Lime 0.25 : Chopped Straw 1) match the spreadsheet's own \"Key\" — used for both interior and exterior, since the spreadsheet only gives one Base Coat recipe (straight onto the straw either side).",
              "Finish Coat: exterior (lime-plaster) defaults to the spreadsheet's own Sand 3 : Lime 1 recipe. Interior (clay-plaster) defaults to Sand 3 : Clay 1 — this app's own adaptation (same structure, clay in place of lime), since the spreadsheet never gave a clay-finish recipe. Every ratio is editable.",
              "\"Base 2\" (a distinct second base-coat layer in the source spreadsheet) isn't modeled separately — each side's own single Base Coat here covers that side's own straight-onto-the-straw layer.",
              "Labor hours: each rough opening gets a 15 sqft \"edge\" (trim/cutting-in) allowance carved out of the total area, billed at 0.04 hr/sqft (2x the 0.02 hr/sqft open \"field\" rate) — straight from the spreadsheet's own \"Time\" table, collapsed from a per-room breakdown into one whole-project estimate.",
              "The source spreadsheet has no pricing at all (materials/quantities only) — every $ default here (sand, clay, lime, straw, labor rate) is this app's own researched industry-typical placeholder, not a Building-Integrity-confirmed figure. All editable.",
              "Sand priced by the cu yd, clay/lime by the 50lb bag, chopped straw by the cu ft directly (the spreadsheet never gives chopped straw its own bag/bale purchase unit).",
              ...(hasSteelClaySkin
                ? [
                    "Floor Bottom uses the footprint's own plan-view area (the floor's underside), not a wall-perimeter area — same base/finish coat math, just a different area source. The steel mesh backing it (real 3D member, rodent/pest barrier, 10mm max opening) is priced separately by the sqft; the clay coat over it isn't modeled as a 3D member, same as every other plaster coating in this app.",
                  ]
                : []),
            ]}
            role={role}
          />
        </StickyNote>

        <StickyNote
          id="detail-roof-truss-layout"
          label="Roof: Truss Layout"
          isOpen={openNoteIds.has("detail-roof-truss-layout")}
          isFullscreen={fullscreenNoteId === "detail-roof-truss-layout"}
          cascadeIndex={noteOpenOrder.indexOf("detail-roof-truss-layout")}
          onClose={() => handleToggleNote("detail-roof-truss-layout")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-roof-truss-layout")}
          onPrint={() => handlePrintNote("detail-roof-truss-layout")}
        >
          <DetailGuidePage
            title={`Roof Truss Layout — ${roofTrussCategory === "classic" ? selectedClassicTruss.label : highPerfTrussTypeId === "energy-heel" ? "Energy-Heel (Gable)" : "Parallel Chord (Shed)"}`}
            triggerCondition="Shown once this roof has exactly 2 opposite Gable End walls (Wall tab elevation views) and a Peaked roofline profile — style, spacing, and doubling are set in the Roof tab's own sidebar."
            diagram={
              roofTrussLayoutContext && roofTrussBuiltMembers ? (
                <RoofTrussLayoutView
                  trussMembers={roofTrussBuiltMembers.members}
                  spanIn={roofTrussLayoutContext.spanIn}
                  peakHeightIn={roofTrussBuiltMembers.peakHeightIn}
                  runIn={roofTrussLayoutContext.runIn}
                  spacingIn={roofTrussSpacingIn}
                  doubling={roofTrussDoublingStrategy}
                  roofBaseHeightIn={gableEaveHeightIn}
                  note={roofTrussLayoutContext.asymmetricNote ?? undefined}
                />
              ) : (
                <p className={styles.note}>Not yet resolvable — see the trigger condition above.</p>
              )
            }
            fastenerSchedule={[]}
            notes={[
              CLASSIC_TRUSS_DISCLAIMER,
              roofTrussCategory === "classic"
                ? selectedClassicTruss.description
                : "Energy/raised-heel truss for a deep, uncompressed insulation cavity out to the wall line (see cavity depth/bearing controls in the Roof tab).",
              roofTrussLayoutContext
                ? `Real span/pitch for this roof: ${(roofTrussLayoutContext.spanIn / 12).toFixed(1)}ft span at ${roofTrussLayoutContext.pitchIn12.toFixed(1)}/12 pitch, ${(roofTrussLayoutContext.runIn / 12).toFixed(1)}ft ridge run.`
                : "Real span/pitch/run aren't resolvable yet for this roof.",
              "Chords are 2x6, web/post members are 2x4, all a single ~1.5in-thick flat truss unit (no metal plate connectors modeled). Every chord/web angle-cut end is simplified to a straight tilted box, not true beveled geometry.",
            ]}
            role={role}
          />
        </StickyNote>

        {role !== "public" && (
          <>
            {shopDrawings
              .filter(({ panelType }) => panelType.id === "jack-stud")
              .map(({ panelType, instances }) => (
              <StickyNote
                key={panelType.id}
                id={`shop-${panelType.id}`}
                label={`Shop Drawing: ${panelType.label}`}
                isOpen={openNoteIds.has(`shop-${panelType.id}`)}
                isFullscreen={fullscreenNoteId === `shop-${panelType.id}`}
                cascadeIndex={noteOpenOrder.indexOf(`shop-${panelType.id}`)}
                onClose={() => handleToggleNote(`shop-${panelType.id}`)}
                onToggleFullscreen={() => handleToggleNoteFullscreen(`shop-${panelType.id}`)}
                onPrint={() => handlePrintNote(`shop-${panelType.id}`)}
              >
                <p className={styles.note}>
                  Preview-only reference — {panelType.label} isn&apos;t placeable in the current layout system yet
                  (see the note below), so this shows an illustrative 3D model at default dimensions rather than
                  real placed instances.
                </p>
                <ShopDrawingPage
                  title={`Shop Drawing — ${panelType.label}`}
                  panelDescription={panelType.description}
                  standardWidthIn={standardWidthIn}
                  thicknessIn={thicknessIn}
                  heightIn={wallHeightFt * 12}
                  loadBearingCapacity={panelType.loadBearingCapacity}
                  shearValue={panelType.shearValue}
                  diagram3D={
                    <StandardPanel3DView
                      members={jackStudMembers}
                      overallDimensions={{ heightIn: jackStudPreviewHeightIn, widthIn: jackStudThicknessIn(jackStudConfig), depthIn: thicknessIn }}
                      displayName={panelType.label}
                      compact
                    />
                  }
                  diagramNote={
                    <p className={styles.note}>
                      Preview only, at an illustrative default height (sill-top to header-bottom, {jackStudPreviewHeightIn.toFixed(1)}
                      &quot;) — real rough-opening height isn&apos;t tracked yet.{" "}
                      {jackStudConfig === "plywood" ? (
                        <>
                          Fasteners: {jackStudFastenerResult.items[0]!.count} x 4in T25 #9 screws (
                          {jackStudFastenerResult.totalWeightLb.toFixed(2)} lb) for this one sheet — a full opening
                          gets 2 (one each side).
                        </>
                      ) : (
                        "2x4 stud config selected (Panelizer) — fastener count/weight not modeled for this config yet."
                      )}
                    </p>
                  }
                  instances={instances}
                  role={role}
                />
                <p className={styles.note}>
                  Preview-only (3D model + illustrative default dimensions) — not placed anywhere in the current
                  layout system yet: jack studs need a real rough-opening height, which headers/sills don&apos;t
                  track yet either. Floor and roof panels now DO exist as modeled panels with their own
                  fabrication sheets further down this tab — still not placed on the canvas, but no longer
                  deferred.
                </p>
              </StickyNote>
              ))}

            {panelFabricationGroups.map((group) => {
              // Hatch Forward/Back panels are still "braced"-typed slots
              // under the hood (no new PanelSlotType), but Tommy wants
              // them to literally read as "Hatch Forward Panel"/"Hatch
              // Back Panel" wherever a user actually sees the name — the
              // shared catalog label stays generically "Braced Panel" so
              // structural notes stay correct for the whole family.
              const displayLabel =
                group.panelType.id === "braced" && group.bracedPattern !== undefined && group.bracedMirrored !== undefined
                  ? bracedPanelDisplayLabel(group.bracedPattern, group.bracedMirrored)
                  : group.panelType.label;
              const noteId = `shop-fab-${group.uniqueKey}`;
              return (
                <StickyNote
                  key={group.uniqueKey}
                  id={noteId}
                  label={`Panel Fabrication: ${displayLabel} ${group.widthIn}in (${group.instances.length})`}
                  isOpen={openNoteIds.has(noteId)}
                  isFullscreen={fullscreenNoteId === noteId}
                  cascadeIndex={noteOpenOrder.indexOf(noteId)}
                  onClose={() => handleToggleNote(noteId)}
                  onToggleFullscreen={() => handleToggleNoteFullscreen(noteId)}
                  onPrint={() => handlePrintNote(noteId)}
                >
                  {/* Screen-only orientation text: on paper it just pushes the framed
                      sheet down the page. Opt-in `print-hidden-chrome` rather
                      than blanket-hiding styles.note -- several of its other
                      uses are honest caveats that SHOULD print (spec open item:
                      "Print audit of the other sections' styles.note
                      paragraphs"). */}
                  <p className={`${styles.note} print-hidden-chrome`}>
                    Fabricator/detailer document — one sheet per unique panel (exact copies grouped together), with
                    a to-scale lettered elevation, a materials cut list, which placed panels are copies of this one,
                    and a weight checker with a blank line for the shop&apos;s own measured weight.
                  </p>
                  <PanelFabricationPage
                    title={`Panel Fabrication — ${displayLabel}${displayLabel.toLowerCase().includes("panel") ? "" : " Panel"}`}
                    panelDescription={group.panelType.description}
                    widthIn={group.widthIn}
                    heightIn={group.heightIn}
                    members={group.members}
                    instances={group.instances}
                    weightBreakdown={group.weightBreakdown}
                    loadBearingCapacity={group.panelType.loadBearingCapacity}
                    shearValue={group.panelType.shearValue}
                    estimatedBearingLb={
                      group.panelType.id === "column"
                        ? estimatedColumnBuiltUpBearingLb
                        : group.panelType.id === "corner"
                          ? estimatedCornerBuiltUpBearingLb
                          : group.panelType.id === "standard" || group.panelType.id === "braced"
                            ? estimatedStudPackBearingLb
                            : undefined
                    }
                    estimatedShearLb={group.panelType.id === "braced" ? estimatedBracedShearLb : undefined}
                    estimatedBearingMethodLabel={
                      group.panelType.id === "column" || group.panelType.id === "corner" ? "built-up plywood section" : undefined
                    }
                    role={role}
                  />
                </StickyNote>
              );
            })}

            {spanningHeaderFabricationGroups.map((group) => {
              const noteId = `shop-fab-${group.uniqueKey}`;
              return (
                <StickyNote
                  key={group.uniqueKey}
                  id={noteId}
                  label={`Panel Fabrication: Spanning Header ${group.widthIn.toFixed(1)}in (${group.instances.length})`}
                  isOpen={openNoteIds.has(noteId)}
                  isFullscreen={fullscreenNoteId === noteId}
                  cascadeIndex={noteOpenOrder.indexOf(noteId)}
                  onClose={() => handleToggleNote(noteId)}
                  onToggleFullscreen={() => handleToggleNoteFullscreen(noteId)}
                  onPrint={() => handlePrintNote(noteId)}
                >
                  <p className={`${styles.note} print-hidden-chrome`}>
                    Fabricator/detailer document — one sheet per unique spanning header (exact copies grouped
                    together). Its name comes from a single building-wide H series carrying no direction, so the wall
                    and the panels it spans are stated in words below; each of those panels&apos; own sheets names
                    this header in return.
                  </p>
                  <PanelFabricationPage
                    title="Panel Fabrication — Spanning Header"
                    panelDescription={`One header panel sitting on top of the panels it spans — flat chords with a repeating W-truss web on both wythes plus two jack studs, the same construction a Big Header uses, built to the combined width of the panels beneath it. Its width is ${formatLengthIn(group.widthIn, unitSystem)} because that is what those panels add up to; it adds nothing to the wall's own length. Building Integrity's stated span range for a header is ${bigHeaderWidthInRange.minIn}in-${bigHeaderWidthInRange.maxIn}in, still pending their confirmation.`}
                    widthIn={group.widthIn}
                    heightIn={group.heightIn}
                    members={group.members}
                    instances={group.instances}
                    weightBreakdown={group.weightBreakdown}
                    loadBearingCapacity={ROOF_BEARING_STRUCTURAL_STATUS}
                    shearValue={ROOF_BEARING_STRUCTURAL_STATUS}
                    role={role}
                  />
                </StickyNote>
              );
            })}

            {roofBearingFabricationGroups.map((group) => {
              const noteId = `shop-fab-${group.uniqueKey}`;
              const panelDescription =
                group.kind === "truss-plate"
                  ? "2x4 along the interior wythe edge, 2x6 along the exterior wythe edge, both capped by one continuous 3/4in plywood top skin — sized to this wall's own real length, not an illustrative segment."
                  : `Two ${BOX_BEAM_SIZE_OPTIONS.find((s) => s.id === boxBeamSizeId)!.label} webs (exterior + interior wythe edges) capped top and bottom by 3/4in plywood — sized to this wall's own real length, not an illustrative segment.`;
              return (
                <StickyNote
                  key={group.uniqueKey}
                  id={noteId}
                  label={`Panel Fabrication: ${group.kindLabel} ${group.lengthIn.toFixed(1)}in (${group.instances.length})`}
                  isOpen={openNoteIds.has(noteId)}
                  isFullscreen={fullscreenNoteId === noteId}
                  cascadeIndex={noteOpenOrder.indexOf(noteId)}
                  onClose={() => handleToggleNote(noteId)}
                  onToggleFullscreen={() => handleToggleNoteFullscreen(noteId)}
                  onPrint={() => handlePrintNote(noteId)}
                >
                  {/* Screen-only orientation text: on paper it just pushes the framed
                      sheet down the page. Opt-in `print-hidden-chrome` rather
                      than blanket-hiding styles.note -- several of its other
                      uses are honest caveats that SHOULD print (spec open item:
                      "Print audit of the other sections' styles.note
                      paragraphs"). */}
                  <p className={`${styles.note} print-hidden-chrome`}>
                    Fabricator/detailer document — one sheet per unique wall length (walls sharing a length grouped
                    together), with a to-scale lettered elevation, a materials cut list, which walls this segment is
                    used on, and a weight checker with a blank line for the shop&apos;s own measured weight.
                  </p>
                  <PanelFabricationPage
                    title={`Panel Fabrication — ${group.kindLabel}`}
                    panelDescription={panelDescription}
                    widthIn={group.lengthIn}
                    heightIn={group.heightIn}
                    members={group.members}
                    instances={group.instances}
                    weightBreakdown={group.weightBreakdown}
                    loadBearingCapacity={ROOF_BEARING_STRUCTURAL_STATUS}
                    shearValue={ROOF_BEARING_STRUCTURAL_STATUS}
                    role={role}
                  />
                </StickyNote>
              );
            })}

            {midWallBondBeamFabricationGroups.map((group) => {
              const noteId = `shop-fab-${group.uniqueKey}`;
              const kindLabel = group.kind === "box-beam" ? "Box Beam" : "Big Header (Mid-Wall Beam)";
              const sizeLabel = group.kind === "box-beam" ? BOX_BEAM_SIZE_OPTIONS.find((s) => s.id === group.sizeId)!.label : `${group.heightIn.toFixed(1)}in tall`;
              const panelDescription =
                group.kind === "box-beam"
                  ? `Two ${sizeLabel} webs (exterior + interior wythe edges) capped top and bottom by 3/4in plywood — a Mid-Wall Bond Beam, sized to this wall's own real length, not an illustrative segment.`
                  : `A Big Header (${sizeLabel}) — the same flat-chord + repeating W-truss web construction a window header uses, on both wythes — a Mid-Wall Bond Beam, sized to this wall's own real length, not an illustrative segment.`;
              return (
                <StickyNote
                  key={group.uniqueKey}
                  id={noteId}
                  label={`Panel Fabrication: ${kindLabel} ${group.lengthIn.toFixed(1)}in (${group.instances.length})`}
                  isOpen={openNoteIds.has(noteId)}
                  isFullscreen={fullscreenNoteId === noteId}
                  cascadeIndex={noteOpenOrder.indexOf(noteId)}
                  onClose={() => handleToggleNote(noteId)}
                  onToggleFullscreen={() => handleToggleNoteFullscreen(noteId)}
                  onPrint={() => handlePrintNote(noteId)}
                >
                  {/* Screen-only orientation text: on paper it just pushes the framed
                      sheet down the page. Opt-in `print-hidden-chrome` rather
                      than blanket-hiding styles.note -- several of its other
                      uses are honest caveats that SHOULD print (spec open item:
                      "Print audit of the other sections' styles.note
                      paragraphs"). */}
                  <p className={`${styles.note} print-hidden-chrome`}>
                    Fabricator/detailer document — one sheet per unique size + wall length (walls/stories sharing
                    both grouped together), with a to-scale lettered elevation, a materials cut list, which
                    walls this segment is used on, and a weight checker with a blank line for the shop&apos;s own
                    measured weight.
                  </p>
                  <PanelFabricationPage
                    title={`Panel Fabrication — ${kindLabel} (${sizeLabel})`}
                    panelDescription={panelDescription}
                    widthIn={group.lengthIn}
                    heightIn={group.heightIn}
                    members={group.members}
                    instances={group.instances}
                    weightBreakdown={group.weightBreakdown}
                    loadBearingCapacity={ROOF_BEARING_STRUCTURAL_STATUS}
                    shearValue={ROOF_BEARING_STRUCTURAL_STATUS}
                    role={role}
                  />
                </StickyNote>
              );
            })}

            {floorRoofPanelFabricationGroups.map((group) => {
              const kindLabel = group.kind === "floor" ? "Floor" : "Roof";
              const roleLabel =
                group.role === "edge"
                  ? "Edge"
                  : group.role === "field"
                    ? "Field"
                    : group.role === "closer"
                      ? "8ft Closer"
                      : "Remainder";
              const noteId = `shop-fab-${group.key}`;
              const impossible = group.plan.impossiblePanels.some((i) =>
                group.instances.some((g) => g.name === i.name),
              );
              return (
                <StickyNote
                  key={group.key}
                  id={noteId}
                  label={`Panel Fabrication: ${kindLabel} Panel ${formatLengthIn(group.widthIn, unitSystem)} (${group.instances.length})`}
                  isOpen={openNoteIds.has(noteId)}
                  isFullscreen={fullscreenNoteId === noteId}
                  cascadeIndex={noteOpenOrder.indexOf(noteId)}
                  onClose={() => handleToggleNote(noteId)}
                  onToggleFullscreen={() => handleToggleNoteFullscreen(noteId)}
                  onPrint={() => handlePrintNote(noteId)}
                >
                  <p className={`${styles.note} print-hidden-chrome`}>
                    Fabricator/detailer document — one sheet per unique {group.kind}{" "}panel, with the same to-scale
                    lettered view and cut list every other panel gets. Draft: these panels are built from the
                    fabrication spec Tommy gave verbally and are not placed in the layout system yet, so the run
                    below is derived from this building&apos;s own outer dimensions rather than laid out panel by
                    panel on the canvas.
                  </p>
                  <PanelFabricationPage
                    title={`Panel Fabrication — ${kindLabel} Panel (${roleLabel})`}
                    panelDescription={
                      <>
                        A standard panel on its side, with 2x6 joists in place of 2x4 studs — each joist a{" "}
                        <strong>pair</strong> of 2x6s, top and bottom, so every seam between two installed panels
                        carries four of them. Straw goes in loose and is compressed in the table, one joist laid in
                        each side. Both lids are structural: a plywood skin faced with 2x4s laid edge to edge across
                        the whole lid, the last ripped to fit. {group.kind === "floor"
                          ? `This one spans ${formatLengthIn(group.spanIn, unitSystem)} and carries a structural girt at each end, where a wall lands on it.`
                          : `This one spans ${formatLengthIn(group.spanIn, unitSystem)} and carries no structural girt — a roof panel bears on both wythes of the inclined wall panel below it.`}{" "}
                        It is panel {group.instances.map((i) => i.name).join(", ")} of{" "}
                        {group.plan.instances.length} across a {formatLengthIn(group.runIn, unitSystem)} run.{" "}
                        {group.plan.lastTrueSheetSeamIn !== null && (
                          <>
                            Sheathing above: cut the first sheet to{" "}
                            <strong>{formatLengthIn(group.plan.firstSheetWidthIn ?? 0, unitSystem)}</strong> and every
                            full sheet after it lands on a panel seam as far as{" "}
                            <strong>{formatLengthIn(group.plan.lastTrueSheetSeamIn, unitSystem)}</strong> along the run
                            ({group.plan.sheetCount} sheets). Past that the panels were re-divided to keep every one of
                            them at or above the {FLOOR_ROOF_MIN_PANEL_WIDTH_IN}in minimum, so the last sheet or so
                            gets cut the same way the first one does.
                          </>
                        )}
                      </>
                    }
                    widthIn={group.widthIn}
                    heightIn={group.spanIn}
                    members={group.members}
                    instances={group.instances.map((i) => ({
                      name: i.name,
                      note: `${formatLengthIn(i.atIn, unitSystem)} from the start of the run`,
                    }))}
                    weightBreakdown={group.weightBreakdown}
                    loadBearingCapacity={{
                      status: "pending-BI-confirmation",
                      note: `No load-bearing figure exists for a ${group.kind} panel. Nothing has been engineered for this panel type — it is modeled from a verbal fabrication spec, and a span table is exactly the kind of number that cannot be guessed at.`,
                    }}
                    shearValue={{
                      status: "pending-BI-confirmation",
                      note: "No shear figure either. A floor or roof panel's diaphragm value would come from its plywood lids and their nailing, and no nailing schedule has been given.",
                    }}
                    role={role}
                  />
                  {impossible && (
                    <p className={styles.disclaimer}>
                      ⚠ {group.plan.impossibleWarning}
                    </p>
                  )}
                  <p className={styles.note}>
                    Draft — floor and roof panels are modeled from Tommy&apos;s verbal fabrication spec and have
                    not been confirmed back to him or to Building Integrity. Open items on this sheet: no fastener
                    schedule exists for these panels, so the weight checker shows fasteners as not modeled rather
                    than zero; the eave/ridge cap&apos;s flat leg is modeled bearing the full {thicknessIn}in wall
                    depth, which is a reading of &quot;the L plate sits flat on the top plate&quot; and not a
                    dimension he gave; and on that same cap the web, seat and stiffeners are still stacked at the
                    panel&apos;s end rather than placed as a true L, which is the next thing to fix once that
                    bearing width is settled. Panel widths themselves are settled: a {FLOOR_ROOF_MIN_PANEL_WIDTH_IN}in
                    minimum, redistributed into the neighbouring panels when a run would otherwise close with a
                    sliver.
                  </p>
                </StickyNote>
              );
            })}
          </>
        )}

        {/* ⚠ THE RIGHT-HAND TRAY WAS DELETED HERE — U5.2, 2026-10-11.

            `SectionCarousel` lived here from the editor's beginning: a 170px
            fixed strip listing every section, with `Export PDF`, `Choose
            sections` and `Page size` in its header and the Read Me / Report
            Bug links in its footer. It was the safety net for every stage of
            the UI reorganisation — nothing could become unreachable while it
            was open — which is exactly why it went last.

            Tommy's condition, 2026-10-11: *"As long as everything is included
            in the tabs above, let's delete it."* Where everything went:
              · the three header controls → the Print page (`printPageControls`)
              · every formal document → the Print page
              · Project Summary, Project Totals, Material Totals → Summary
              · the Review Log → its own left-sidebar icon (U0)
              · Read Me and Report Bug → their own left-sidebar icons (U0)

            And the condition is CHECKED rather than asserted: see
            `sectionsNoPageCanReach`, computed from the live derived section
            list, published as `data-sections-unreachable` on the editor, and
            read by the ui-reorg-u4 harness on a real building. If a future
            section belongs to no page it shows up there by name.

            The canvas gains the 170px back — see `.editorRightSpacer`'s
            removal below. */}
      </main>
      {/* Screen chrome only, like the TopBar wrapper above: printed sheets
          carry the role disclaimer in their own SheetTitleBlock. Last in the
          DOM so keyboard order reaches the editor before the footer. */}
      <div className="print-hidden-chrome">
        <AppFooter role={role} />
      </div>
    </div>
    </SectionSurfaceProvider>
    </BrowseModeProvider>
    </DocumentMetaProvider>
  );
}
