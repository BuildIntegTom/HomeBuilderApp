"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAdditionalRowBracedPattern,
  applyUniformPanelization,
  applyZonesToSlot,
  areWallsOppositePair,
  buildOctagonFootprint,
  buildRectangleFootprint,
  collapseNearZeroWalls,
  computeFieldFramingLayout,
  computeFloorPanelGrid,
  computeFootprintAreaSqFt,
  computeGableTiledRow,
  computeInsetPerimeterRing,
  computeJoistLayout,
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
  cornerOwnership as cornerOwnershipPure,
  dragWallBounded,
  editWallLength,
  footprintIsAllRightAngles,
  gapEndFor,
  getOpeningAnchors,
  insertBumpOut,
  isMiteredShape,
  isPointNearPier,
  markSafetyCorner,
  nextPanelCycleState,
  pointAlongRidgeLine,
  reconcileBracedPlacement,
  reconcilePanelSlotZones,
  retile as retilePure,
  retilePreservingOpenings as retilePreservingOpeningsPure,
  retileWithOpenings,
  wallCompassDirection,
  wallGeometryFor as wallGeometryForPure,
  isSlotBoxBeamCovered,
  zoneFromSlot,
  type BoxBeamCoverage,
  type CornerId,
  type Footprint,
  type PanelGroup,
  type PanelSlot,
  type PanelSlotZone,
  type GableWindowReservation,
  type OpeningSeed,
  type RoofBearingAnchorMode,
  type RoofProfilePoint,
  type Story,
  type TruckDims,
  type TrussDoublingStrategy,
  type Wall,
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
  baleFoundationTopFaceZIn,
  buildDoubledStackPair,
  buildFloorBottomSkinMembers,
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
  SAFETY_GAP_THICKNESS_IN,
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
  type RoofCatcherBeamShape,
  type RoofSystemType,
  type RoofTrussSpacingIn,
  type SeismicZone,
  type StudConfig,
  type WallAssemblyLayer,
} from "@building-integrity/panel-catalog";
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
import RubbleTrenchDiagram from "./RubbleTrenchDiagram";
import ShopDrawingPage from "./ShopDrawingPage";
import PlanViewPage from "./PlanViewPage";
import PanelFabricationPage from "./PanelFabricationPage";
import BuildingSummaryRender from "./BuildingSummaryRender";
import CompassWidget from "./CompassWidget";
import PageFeaturesButton from "./PageFeaturesButton";
import { DocumentMetaProvider } from "./DocumentMetaContext";
import DrawingToolPen from "./DrawingToolPen";
import EditorToolbar from "./EditorToolbar";
import OctagonRingPreview from "./OctagonRingPreview";
import RoofTrussLayoutView from "./RoofTrussLayoutView";
import PanelLegend from "./PanelLegend";
import { PANEL_TYPE_LABELS } from "./panelColors";
import ProjectSummaryPage from "./ProjectSummaryPage";
import SectionCarousel from "./SectionCarousel";
import SlabFoundationDiagram from "./SlabFoundationDiagram";
import StickyNote from "./StickyNote";
import TopBar from "./TopBar";
import ViewerDial, { type ViewerStop } from "./ViewerDial";
import WindowSizeDiagram from "./WindowSizeDiagram";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import WallElevationDiagram from "./WallElevationDiagram";
import styles from "./page.module.css";
import elevationStyles from "./ElevationControls.module.css";

const FootprintCanvas = dynamic(() => import("./FootprintCanvas"), { ssr: false });
const Building3DView = dynamic(() => import("./Building3DView"), { ssr: false });
const StandardPanel3DView = dynamic(() => import("./StandardPanel3DView"), { ssr: false });
const TruckLoad3DView = dynamic(() => import("./TruckLoad3DView"), { ssr: false });

const BEARING_ELIGIBLE_TYPES = new Set(["standard", "corner", "safety-oct-corner", "braced", "column"]);
// Every real wall panel type, straw-filled or not (Safety/Gap included —
// it's a real plywood wall panel, just with no straw cavity, see
// strawSlots' own exclusion of it below).
const WALL_PANEL_SLOT_TYPES = new Set(["corner", "safety-oct-corner", "standard", "safety-gap", "braced", "column"]);
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

/** A trailer's own length runs tens of feet — too long for the imperial
 * 1/8in-fraction convention (formatLengthIn) to read naturally, so imperial
 * shows whole feet instead; metric still always shows mm (Tommy: "for
 * metric, make to the nearest mm"). */
function formatTrailerLengthIn(valueIn: number, unitSystem: "imperial" | "metric"): string {
  return unitSystem === "metric" ? formatLengthIn(valueIn, unitSystem) : `${(valueIn / 12).toFixed(1)}ft`;
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

type ShapeTool = "rectangle" | "octagon" | "bump-out" | "edit" | "drag-wall";
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

type EditorTab = "wall" | "foundation" | "floor" | "roof";

export default function LayoutEditor() {
  // Which building system is being laid out — wall/foundation/floor/roof
  // are all views onto the same shared footprint/panel state below, so
  // switching tabs never resets anything (Tommy). Floor intakes most of
  // its prompts from Foundation (same footprint + pier spacing, no
  // independent control of its own). Roof has no editor yet (future work).
  const [editorTab, setEditorTab] = useState<EditorTab>("wall");
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
  // Hard guardrail (Tommy): at most 2 Gable End walls, and once 1 is active,
  // the 2nd must be its geometric opposite (parallel, facing away) — the
  // roof-catcher beam needs exactly 2 walls forming a straight run between
  // them, so a 3rd or a non-opposite 2nd would leave that run undefined.
  const gableEndToggleBlockReason = (wallId: string): string | null => {
    if (gableEndWallIds.has(wallId)) return null; // always allowed to turn back off
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
    // corner; otherwise they start `thicknessIn` in (the neighbor's own
    // corner panel fills that initial sliver instead — see
    // WallElevationDiagram's own startOffsetIn, which this mirrors).
    const wallLengthIn = wall.lengthFt * 12;
    const { resolvedPointXsIn } = resolveGableProfilePoints(roofProfilePointHeightsFt, gableProfilePositionsInByWallId[wallId] ?? [], wallLengthIn);
    const peakXIn = resolvedPointXsIn[0] ?? wallLengthIn / 2;
    const startOffsetIn = geometry.hasCornerStart ? 0 : thicknessIn;
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
    const finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored);
    setWallSlotsForStory(topStory, (prev) => ({ ...prev, [wallId]: finalSlots }));
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
  const reconcileWallZonesForBeamChange = (story: "ground" | "second", wallId: string, oldBeams: MidWallBeam[], newBeams: MidWallBeam[]) => {
    const storyHeightIn = (story === "ground" ? wallHeightFt : (secondStory?.wallHeightFt ?? wallHeightFt)) * 12;
    const oldGeom = midWallBeamsToGeometry(oldBeams);
    const newGeom = midWallBeamsToGeometry(newBeams);
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
    reconcileWallZonesForBeamChange(story, wallId, oldBeams, newBeams);
  };
  const handleRemoveMidWallBeam = (story: "ground" | "second", wallId: string, beamId: string) => {
    const oldBeams = midWallBeamsByStoryAndWallId[story][wallId] ?? [];
    const newBeams = oldBeams.filter((b) => b.id !== beamId);
    setMidWallBeamsByStoryAndWallId((was) => ({
      ...was,
      [story]: { ...was[story], [wallId]: newBeams },
    }));
    reconcileWallZonesForBeamChange(story, wallId, oldBeams, newBeams);
  };
  const updateMidWallBeam = (story: "ground" | "second", wallId: string, beamId: string, patch: Partial<MidWallBeam>) => {
    const oldBeams = midWallBeamsByStoryAndWallId[story][wallId] ?? [];
    const newBeams = oldBeams.map((b) => (b.id === beamId ? { ...b, ...patch } : b));
    setMidWallBeamsByStoryAndWallId((was) => ({
      ...was,
      [story]: { ...was[story], [wallId]: newBeams },
    }));
    reconcileWallZonesForBeamChange(story, wallId, oldBeams, newBeams);
  };
  const handleChangeMidWallBeamHeight = (story: "ground" | "second", wallId: string, beamId: string, heightIn: number) =>
    updateMidWallBeam(story, wallId, beamId, { heightIn });
  const handleChangeMidWallBeamSizeId = (story: "ground" | "second", wallId: string, beamId: string, sizeId: BoxBeamSizeId) =>
    updateMidWallBeam(story, wallId, beamId, { sizeId });
  const handleChangeMidWallBeamBigHeaderHeightIn = (story: "ground" | "second", wallId: string, beamId: string, bigHeaderBeamHeightIn: number) =>
    updateMidWallBeam(story, wallId, beamId, { bigHeaderBeamHeightIn });
  const handleChangeMidWallBeamCoverage = (story: "ground" | "second", wallId: string, beamId: string, coverage: BoxBeamCoverage) =>
    updateMidWallBeam(story, wallId, beamId, coverage);
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
  const [floorsEnabled, setFloorsEnabled] = useState(false);
  const [roofEnabled, setRoofEnabled] = useState(false);

  const enabledEditorTabs = useMemo(() => {
    const tabs: EditorTab[] = [];
    if (wallsEnabled) tabs.push("wall");
    tabs.push("foundation");
    if (floorsEnabled) tabs.push("floor");
    if (roofEnabled) tabs.push("roof");
    return tabs;
  }, [wallsEnabled, floorsEnabled, roofEnabled]);

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
  const isSquareBalePanelization = panelizationType === "square-bale-panels";
  // Tommy: "loose packed braced and square bale panels are two very
  // different panelization rules and 3d models... corners should also be
  // 39in panels for square bale panels" — the tiling's corner-slot width
  // isn't just a 3D-model detail, it's part of what makes these 2 styles
  // genuinely different layouts. Timber Frame Curtain is unaffected (Tommy:
  // still deciding how that style should behave) — it keeps the plain
  // 25.5in Column/Corner unit for now.
  const cornerWidthInForTiling = isSquareBalePanelization ? squareBalePanel.widthIn : cornerPanelWidthIn.value;

  const loadInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
  // off-screen BuildingSummaryRender instance, re-captured whenever the
  // callback identity below changes (i.e. whenever the scene inputs do).
  const [renderImageDataUrl, setRenderImageDataUrl] = useState<string | null>(null);
  const handleCaptureRenderImage = useCallback((dataUrl: string) => setRenderImageDataUrl(dataUrl), []);

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
  const handleSaveProject = () => {
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
      wallReviewNotes,
    };
    const blob = new Blob([JSON.stringify(serializeProject(state), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "building-integrity-project.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same filename later
    if (!file) return;
    file.text().then((raw) => {
      const result = parseProjectFile(raw);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      const s = result.state;
      setEditorTab(s.editorTab);
      setViewMode(s.viewMode);
      setShapeTool(s.shapeTool);
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
        const seeded: Record<string, PanelSlot[]> = {};
        for (const [wallId, slots] of Object.entries(s.baseWallSlots)) {
          seeded[wallId] = reconcileBracedPlacement(undefined, slots, loadSpacingIn, s.standardWidthIn, loadDefaultPattern, loadDefaultMirrored);
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
      setRole(s.role);
      setUnitSystem(s.unitSystem);
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
      setWallReviewNotes(s.wallReviewNotes ?? []);
    });
  };

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

  // The view-mode dial's cycle (Tommy: "cycle the wall view options...
  // starting at the top and going clockwise, and the wheel moves onto 3D
  // views") — 2D Floor Plan, then one elevation stop per wall in the same
  // order the footprint already lists them (compass order for the common
  // rectangle/octagon cases), then the 2 existing 3D modes. See
  // ViewerDial.tsx.
  const viewerStops = useMemo<ViewerStop[]>(
    () => [
      { kind: "plan" },
      ...(footprint?.walls.map((w) => ({ kind: "elevation" as const, wallId: w.id, label: w.id })) ?? []),
      { kind: "3d-framed" },
      { kind: "3d-boxes" },
      { kind: "3d-wraps" },
    ],
    [footprint],
  );
  const currentViewerStop: ViewerStop = elevationViewWallId
    ? { kind: "elevation", wallId: elevationViewWallId, label: elevationViewWallId }
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

  // Bale Foundation rings (Tommy: "two of these framing members inside the
  // primary footprint of the building, and then another two framing
  // members insideof the width of the panel-width selected") — Ring A
  // flush with the inside of the primary footprint (inset by thicknessIn),
  // Ring B one panel-width further inward. Field stacks (single, not
  // doubled) fill the rest of the interior span beyond Ring B.
  const baleFoundationRingAInsetIn = thicknessIn;
  const baleFoundationRingBInsetIn = thicknessIn + standardWidthIn;
  const baleFoundationRingA = useMemo(
    () => (footprint && isBaleFoundationFloor ? computeInsetPerimeterRing(footprint, baleFoundationRingAInsetIn, primaryCornerIds) : null),
    [footprint, isBaleFoundationFloor, baleFoundationRingAInsetIn, primaryCornerIds],
  );
  const baleFoundationRingB = useMemo(
    () => (footprint && isBaleFoundationFloor ? computeInsetPerimeterRing(footprint, baleFoundationRingBInsetIn, primaryCornerIds) : null),
    [footprint, isBaleFoundationFloor, baleFoundationRingBInsetIn, primaryCornerIds],
  );
  // Each ring is a DOUBLED pair (2 stacks side by side, touching — see
  // buildDoubledStackPair's own doc comment on the 0-gap default) — the
  // "inner" sub-line is the same ring offset one board thickness further
  // in, reusing computeInsetPerimeterRing rather than new offset math.
  const baleFoundationRingAInner = useMemo(
    () =>
      footprint && isBaleFoundationFloor
        ? computeInsetPerimeterRing(footprint, baleFoundationRingAInsetIn + PLATE_2X4_THICKNESS_IN, primaryCornerIds)
        : null,
    [footprint, isBaleFoundationFloor, baleFoundationRingAInsetIn, primaryCornerIds],
  );
  const baleFoundationRingBInner = useMemo(
    () =>
      footprint && isBaleFoundationFloor
        ? computeInsetPerimeterRing(footprint, baleFoundationRingBInsetIn + PLATE_2X4_THICKNESS_IN, primaryCornerIds)
        : null,
    [footprint, isBaleFoundationFloor, baleFoundationRingBInsetIn, primaryCornerIds],
  );
  const baleFoundationFieldLayout = useMemo(
    () =>
      footprint && isBaleFoundationFloor
        ? computeFieldFramingLayout(footprint, baleFoundationRingBInsetIn, baleFoundationFieldSpacingIn)
        : [],
    [footprint, isBaleFoundationFloor, baleFoundationRingBInsetIn, baleFoundationFieldSpacingIn],
  );
  const baleFoundationStackHeightIn = baleFoundationTopDepthIn + baleFoundationGapIn + baleFoundationBottomDepthIn;
  // 8 boards per cross-section (2 rings x 2 doubled stacks x 2 boards each
  // — Tommy: "my double double really means double double double") plus
  // the single field stacks (2 boards each) beyond Ring B.
  const baleFoundationBoardCount = baleFoundationRingA && baleFoundationRingB
    ? baleFoundationRingA.length * 4 + baleFoundationRingB.length * 4 + baleFoundationFieldLayout.length * 2
    : 0;
  const baleFoundationLumberVolumeFt3 = baleFoundationRingA && baleFoundationRingB
    ? (baleFoundationRingA.reduce((sum, seg) => sum + seg.lengthFt, 0) * 2 * (baleFoundationTopDepthIn + baleFoundationBottomDepthIn) * 1.5 +
        baleFoundationRingB.reduce((sum, seg) => sum + seg.lengthFt, 0) * 2 * (baleFoundationTopDepthIn + baleFoundationBottomDepthIn) * 1.5 +
        baleFoundationFieldLayout.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0) *
          (baleFoundationTopDepthIn + baleFoundationBottomDepthIn) *
          1.5) /
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
  // arguments rather than closing over them, so these 3 names are
  // intentionally shadowed for the rest of this component with thin
  // partial applications supplying `thicknessIn`/`standardWidthIn`/
  // `cornerPanelWidthIn`/`bracedSeed` — every call site below already
  // expects the closure-capturing signature these provide.
  const cornerOwnership = (fp: Footprint, primary: Set<string>) => cornerOwnershipPure(fp, primary, thicknessIn);
  // `{}` (default randomFn = Math.random) — Tommy's own confirmed soft
  // default: every freshly-tiled wall gets 1 default window, plus 1
  // default door on an East/South/West-facing wall. See retile.ts's own
  // `seedDefaultOpenings` doc comment for why this only ever affects a
  // wall with no prior slots to preserve.
  const openingSeed: OpeningSeed = {};
  const retile = (fp: Footprint, leastAccessible: CornerId, primary: Set<string>): Record<string, PanelSlot[]> =>
    retilePure(fp, leastAccessible, primary, standardWidthIn, cornerWidthInForTiling, thicknessIn, bracedSeed, openingSeed);
  // Same as `retile` above, but preserves each wall's existing openings —
  // see retile.ts's own doc comment. `oldSlotsByNewWallId` resolves the
  // old-to-new wall correlation; for an id-stable operation (dragWall,
  // editWallLength) callers just pass `baseWallSlots` straight through.
  const retilePreservingOpenings = (
    fp: Footprint,
    leastAccessible: CornerId,
    primary: Set<string>,
    oldSlotsByNewWallId: Record<string, PanelSlot[] | undefined>,
  ): Record<string, PanelSlot[]> =>
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
    );
  const wallGeometryFor = (wallId: string) =>
    footprint ? wallGeometryForPure(footprint, wallId, primaryCornerIds, leastAccessibleCorner, thicknessIn) : null;

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
    setIsBumpedOut(false);
    setPrimaryCornerIds(nextPrimary);
    setOffsetPx(origin);
    setLeastAccessibleCorner(nextLeastAccessible);
    setBaseWallSlots(retile(fp, nextLeastAccessible, nextPrimary));
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

  // Panel drag-resize commit (Tommy: "when you click and drag a panel, it
  // moves... shrinks one panel and adds it to another") — a direct two-
  // slot patch, called continuously during the drag (see
  // WallElevationDiagram's own drag effect), NOT a retile: both slots get
  // their new widthIn AND lockedWidthIn set together, so the width sticks
  // through a later unrelated retile (see reconcileBracedPlacement, which
  // is what re-applies a locked width after any such retile).
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
      type: "window" | "door" | "column" | "big-header";
      widthIn: number;
      heightIn?: number;
      sillHeightIn?: number;
      zones?: PanelSlotZone[];
      includeSillOnBigHeader?: boolean;
    }[] = [];
    let standardsSeen = 0;
    currentSlots.forEach((slot, i) => {
      const type = i === slotIndex ? next.type : slot.type;
      if (type === "window" || type === "door" || type === "column" || type === "big-header") {
        anchors.push({
          beforeStandardCount: standardsSeen,
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
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;
    // Preserves every OTHER braced panel already decided on this wall
    // (this single-slot retile would otherwise silently wipe them, since
    // retileWithOpenings itself only knows about window/door/column
    // anchors) and seeds any genuinely new standard-slot position via the
    // seismic rule — see reconcileBracedPlacement's own doc comment.
    let finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored);

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

  const handleSetLeastAccessibleCorner = (cornerId: CornerId) => {
    setLeastAccessibleCorner(cornerId);
    if (footprint) {
      setBaseWallSlots(retile(footprint, cornerId, primaryCornerIds));
    }
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
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;
    // Preserves every braced panel already decided on this wall — a window
    // width change re-tiles the WHOLE wall, which would otherwise silently
    // wipe every one of them back to plain "standard" (see
    // reconcileBracedPlacement's own doc comment; same fix already applied
    // to handleToggleOpening's own retile branch).
    const finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored);
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
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;
    const finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored);
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
    ).slots;
    const markedSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;
    const finalSlots = reconcileBracedPlacement(currentSlots, markedSlots, spacingIn, standardWidthIn, defaultBracePattern, defaultBracedMirrored);
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

  // An octagon is still just 2 numbers (widthFt/depthFt) under the hood —
  // recover them from whatever's currently drawn by reading the clip size
  // straight off one of the mitered diagonal walls (length = clip*sqrt2)
  // and adding it back onto a straight wall's length.
  const currentOctagonDims = (fp: Footprint) => {
    const clipFt = fp.walls.find((w) => w.id === "70")!.lengthFt / Math.SQRT2;
    const widthFt = fp.walls.find((w) => w.id === "01")!.lengthFt + 2 * clipFt;
    const depthFt = fp.walls.find((w) => w.id === "23")!.lengthFt + 2 * clipFt;
    return { widthFt, depthFt, clipFt };
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
      setFootprint(fp);
      // editWallLength never renumbers ids, so baseWallSlots' old keys are
      // still valid — every wall's own openings survive, re-tiled at its
      // (possibly new) length.
      setBaseWallSlots(retilePreservingOpenings(fp, leastAccessibleCorner, primaryCornerIds, baseWallSlots));
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
      setFootprint(fp);
      setPrimaryCornerIds(nextPrimary);
      // buildRectangleFootprint always uses the same fixed "AB"/"BC"/"CD"/
      // "DA" wall ids regardless of dimensions, so baseWallSlots' keys stay
      // valid here too.
      setBaseWallSlots(retilePreservingOpenings(fp, leastAccessibleCorner, nextPrimary, baseWallSlots));
      return;
    }

    const isWidthWall = wallId === "01" || wallId === "45";
    const isDepthWall = wallId === "23" || wallId === "67";
    if (!isWidthWall && !isDepthWall) return; // diagonal walls: not editable yet
    const { widthFt, depthFt, clipFt } = currentOctagonDims(footprint);
    const fp = buildOctagonFootprint(
      isWidthWall ? newLengthFt + 2 * clipFt : widthFt,
      isDepthWall ? newLengthFt + 2 * clipFt : depthFt,
    );
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    setFootprint(fp);
    setPrimaryCornerIds(nextPrimary);
    // buildOctagonFootprint always uses the same fixed "0".."7" wall ids too.
    setBaseWallSlots(retilePreservingOpenings(fp, leastAccessibleCorner, nextPrimary, baseWallSlots));
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
    for (const w of fp.walls) {
      const start = newCornersById.get(w.startCorner)!;
      const end = newCornersById.get(w.endCorner)!;
      const oldWallId = oldWallIdByPointPair.get(`${pointKey(start)}|${pointKey(end)}`);
      if (oldWallId) oldSlotsByNewWallId[w.id] = baseWallSlots[oldWallId];
    }

    setFootprint(fp);
    setIsBumpedOut(true);
    setPrimaryCornerIds(nextPrimary);
    setLeastAccessibleCorner(nextLeastAccessible);
    setBaseWallSlots(retilePreservingOpenings(fp, nextLeastAccessible, nextPrimary, oldSlotsByNewWallId));
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
      setFootprint(fp);
      setPrimaryCornerIds(nextPrimary);

      if (fp === dragged) {
        // No collapse fired — ids are unchanged, reuse baseWallSlots directly.
        setBaseWallSlots(retilePreservingOpenings(fp, leastAccessibleCorner, nextPrimary, baseWallSlots));
      } else {
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
        for (const w of fp.walls) {
          const start = newCornersById.get(w.startCorner)!;
          const end = newCornersById.get(w.endCorner)!;
          const draggedWallId = draggedWallIdByPointPair.get(`${pointKey(start)}|${pointKey(end)}`);
          if (draggedWallId) oldSlotsByNewWallId[w.id] = baseWallSlots[draggedWallId];
        }

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

        setBaseWallSlots(retilePreservingOpenings(fp, nextLeastAccessible, nextPrimary, oldSlotsByNewWallId));
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
    const { widthFt, depthFt } = currentOctagonDims(footprint);
    const fp = buildOctagonFootprint(
      isWidthWall ? widthFt + 2 * offsetFt : widthFt,
      isDepthWall ? depthFt + 2 * offsetFt : depthFt,
    );
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    setFootprint(fp);
    setPrimaryCornerIds(nextPrimary);
    setBaseWallSlots(retilePreservingOpenings(fp, leastAccessibleCorner, nextPrimary, baseWallSlots));
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
    const ownership = cornerOwnership(footprint, primaryCornerIds);
    const offsets: Record<string, number> = {};
    for (const wall of footprint.walls) {
      const { start } = ownership[wall.id]!;
      offsets[wall.id] = start.extraLengthIn > 0 ? -start.extraLengthIn : start.insetAmount;
    }
    return offsets;
  }, [footprint, thicknessIn, primaryCornerIds]);

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
  const totalWeightKg = strawWeight.weightKg + totalWoodWeightKg;
  const totalWeightLb = totalWeightKg * KG_TO_LB;

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
      const storedPositions = gableProfilePositionsInByWallId[wall.id] ?? [];
      const points: RoofProfilePoint[] = roofProfilePointHeightsFt.map((heightFt, i) => {
        // Default position: the single midpoint for a peaked (1-point)
        // profile, or a symmetric flat run spanning the middle third for a
        // flat-top (2-point) profile — same "auto-centered, never snaps"
        // convention the old single-peak default already had.
        const defaultXIn = roofProfilePointHeightsFt.length === 1 ? wallLengthIn / 2 : ((i + 1) * wallLengthIn) / 3;
        const storedXIn = storedPositions[i];
        return {
          xIn: storedXIn ?? defaultXIn,
          // heightFt is a RISE above the eave, not an absolute height (see
          // roofProfilePointHeightsFt's own doc comment) — computeGableTiledRow
          // still expects an absolute anchor in the same coordinate space
          // as gableEaveHeightIn, so convert here at the call site rather
          // than changing that function's own (still-absolute) contract.
          heightIn: gableEaveHeightIn + heightFt * 12,
          isExplicitPosition: storedXIn != null,
        };
      });
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
            midWallBeamGeometryByWallId,
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
      midWallBeamGeometryByWallId,
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
            secondStoryMidWallBeamGeometryByWallId,
          )
        : [],
    [footprint, secondStory, standardWidthIn, jackStudConfig, secondStoryMidWallBeamGeometryByWallId],
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

  // Safety/Gap panel: fixed-size (doesn't scale with the slot's own
  // widthIn) — one model covers every instance.
  const safetyGapMembers3D = useMemo(
    () => buildSafetyGapMembers(thicknessIn, wallHeightFt * 12),
    [thicknessIn, wallHeightFt],
  );

  // Truss Plate (single-story roof bearing) / Box Beam (two-story roof
  // bearing) — Tommy: whichever the building is, it needs one of these on
  // top of the wall panels. 3D preview uses a small illustrative length
  // (10ft); the insulation quantity below uses the footprint's actual
  // total wall perimeter, so it's a real whole-building material total,
  // not just an illustrative snippet.
  const ASSEMBLY_PREVIEW_LENGTH_IN = 120;
  const totalWallPerimeterIn = useMemo(
    () => (footprint ? footprint.walls.reduce((sum, w) => sum + w.lengthFt * 12, 0) : 0),
    [footprint],
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
    if (stories.length <= 1) return totalWallPerimeterIn;
    let totalIn = 0;
    for (const wall of footprint.walls) {
      const slots = secondStory?.wallSlots[wall.id] ?? [];
      for (const seg of computeRoofBearingSegments(slots, boxBeamCoverageByWallId[wall.id])) {
        if (seg.kind === "truss-plate") totalIn += seg.lengthIn;
      }
    }
    return totalIn;
  }, [footprint, stories.length, secondStory, boxBeamCoverageByWallId, totalWallPerimeterIn]);
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
                ? cornerPanelMembers3D
                : inst.panelType === "safety-gap"
                  ? safetyGapMembers3D
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
    safetyGapMembers3D,
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
    // and bottom cap, truss plate just one — over the real wall perimeter.
    threeQuarterSqFt += stories.length > 1
      ? (2 * totalWallPerimeterIn * thicknessIn) / 144
      : (totalWallPerimeterIn * thicknessIn) / 144;
    return { threeQuarterSqFt, halfSqFt };
  }, [allRealMembers, stories, totalWallPerimeterIn, thicknessIn]);

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
  // drawn footprint (wall perimeter x wall height, doubled if Second Story
  // is on, since it mirrors story 1's own footprint) minus each window/
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
  const plasterGrossWallAreaSqFt = stories.reduce((sum, s) => sum + (totalWallPerimeterIn / 12) * s.wallHeightFt, 0);
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
    return stories.flatMap((story) => footprint.walls.map((w) => ({ lengthFt: w.lengthFt, heightFt: story.wallHeightFt })));
  }, [footprint, stories]);
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
            ? cornerPanelMembers3D
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
                    ? buildSafetyGapMembers(thicknessIn, heightIn)
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
  // member geometry (buildSafetyGapMembers) ignores widthIn entirely — the
  // sheet is a fixed-size edge-on plywood panel regardless of how wide a
  // gap it's filling — so its instances are grouped as ONE page, not split
  // by the (physically irrelevant) reserved wall-run width.
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
      panelTypeId === "safety-gap" ? SAFETY_GAP_THICKNESS_IN : inst.widthIn;
    const groupKeyFor = (panelTypeId: string, inst: PanelInstance): string => {
      if (panelTypeId === "safety-gap") return panelTypeId;
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
            instances: groupInstances.map((inst) => ({
              name: inst.name,
              isSafetyOctCorner: inst.panelType === "safety-oct-corner",
            })),
          };
        });
      });
  }, [shopDrawings, thicknessIn, wallHeightFt, includeNailer, defaultBracePattern, defaultBracedMirrored, doorHeaderHeightIn, sillHeightIn]);

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
      const segments =
        stories.length > 1
          ? computeRoofBearingSegments(slots, boxBeamCoverageByWallId[wall.id])
          : [{ kind: "truss-plate" as const, startXIn: 0, lengthIn: wall.lengthFt * 12 }];
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
  }, [footprint, stories.length, secondStory, boxBeamCoverageByWallId, boxBeamSizeId, thicknessIn, trussPlateInsetIn]);

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

  // Only surface pages that actually apply to what's currently selected/
  // drawn — a foundation detail page only if one exists for this type, a
  // panel type's Shop Drawing only if the current design actually has any
  // panels of that type (Tommy: "easily view the detail pages that are
  // relevant to the options currently selected").
  const relevantDetailPages = useMemo(() => {
    const pages: { id: string; label: string }[] = [];
    if (foundationType.loadPath.length > 0) {
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
    document.body.setAttribute("data-print-mode", "page");
    document.getElementById(id)?.setAttribute("data-print-target", "true");
    window.print();
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
    () => [...openNoteIds].filter((id) => formalDocumentNoteIds.has(id)),
    [openNoteIds, formalDocumentNoteIds],
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
      document.body.setAttribute("data-print-mode", "packet");
      window.print();
      if (needsOpening) setOpenNoteIds(wasOpen);
    };
    if (needsOpening) {
      setOpenNoteIds((was) => new Set([...was, ...ids]));
      requestAnimationFrame(doExport);
    } else {
      doExport();
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
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  // The markup only applies for fabricator/admin — public viewers always
  // see the base material cost (Tommy).
  const effectivePriceModifier = role === "public" ? 1 : priceModifier;

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
        { type: "opening", areaSqFt: areaSqFtFor("window") + areaSqFtFor("door") },
        { type: "column", areaSqFt: areaSqFtFor("column") },
        { type: "roof", areaSqFt: gableRoofAreaSqFt + roofBearingAreaSqFt + midWallBeamAreaSqFt },
      ],
      effectivePriceModifier,
    );
  }, [stories, effectivePriceModifier, thicknessIn, gableTilesByWallId, gableEaveHeightIn, roofBearingFabricationGroups, midWallBondBeamFabricationGroups]);

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

  const reviewLog = useMemo(() => {
    const entries = toReviewLog([
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
      ...(foundationTypeId === "concrete-pier"
        ? [
            { label: "Concrete pier dimensions", ...concretePierDimensions },
            { label: "Concrete embodied carbon factor", ...concreteEmbodiedCarbonKgPerFt3 },
          ]
        : []),
      ...(foundationTypeId === "slab" ? [{ label: "Slab foundation dimensions", ...slabFoundationDimensions }] : []),
      ...PHASE2_ASSUMPTIONS,
    ]);
    return entries.filter((e, i) => entries.findIndex((o) => o.note === e.note) === i);
  }, [interior, exterior, foundationType, foundationTypeId, standardWidthIn, allInstances, estimatedTotalBearingLb, estimatedTotalShearLb]);

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
        The keyhole for this project&apos;s scope of work — check off Floors/Walls/Roof to bring their editor tabs,
        modality pickers, and Detail Guide/Shop Drawing pages into scope. Unchecking a branch hides its tab entirely
        rather than just disabling it.
      </p>
      <div role="group" aria-label="Scope of work" className={styles.toolbar}>
        <label>
          <input type="checkbox" checked={floorsEnabled} onChange={(e) => setFloorsEnabled(e.target.checked)} />{" "}
          Floors
        </label>
        <label>
          <input type="checkbox" checked={wallsEnabled} onChange={(e) => setWallsEnabled(e.target.checked)} />{" "}
          Walls
        </label>
        <label>
          <input type="checkbox" checked={roofEnabled} onChange={(e) => setRoofEnabled(e.target.checked)} />{" "}
          Roof
        </label>
      </div>

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
        <input
          type="number"
          value={standardWidthIn}
          min={panelWidthInRange.minIn}
          max={panelWidthInRange.maxIn}
          title={`Possible panel width: ${formatLengthIn(panelWidthInRange.minIn, unitSystem)}-${formatLengthIn(panelWidthInRange.maxIn, unitSystem)}`}
          onChange={(e) => setStandardWidthIn(Number(e.target.value))}
        />
      </label>
      <label>
        Thickness{" "}
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
        Wall height (ft){" "}
        <input
          type="number"
          value={wallHeightFt}
          min={panelHeightInRange.minIn / 12}
          max={panelHeightInRange.maxIn / 12}
          title={`Possible panel height: ${formatLengthIn(panelHeightInRange.minIn, unitSystem)}-${formatLengthIn(panelHeightInRange.maxIn, unitSystem)}`}
          onChange={(e) => handleSetWallHeightFt(Number(e.target.value))}
        />
      </label>
      <p className={styles.note}>
        Default 10ft (120in) is Panel Set 1&apos;s confirmed standard panel height.
      </p>
      <label>
        Max panel height (in){" "}
        <input
          type="number"
          value={maxPanelHeightIn}
          min={panelHeightInRange.minIn}
          max={panelHeightInRange.maxIn}
          onChange={(e) => handleSetMaxPanelHeightIn(Number(e.target.value))}
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

      <div role="group" aria-label="Panelization type" className={styles.toolbar}>
        <button
          type="button"
          aria-pressed={panelizationType === "loose-packed-braced"}
          className={panelizationType === "loose-packed-braced" ? styles.toolActive : styles.tool}
          onClick={() => setPanelizationType("loose-packed-braced")}
        >
          Loose Packed Braced
        </button>
        <button
          type="button"
          aria-pressed={panelizationType === "square-bale-panels"}
          className={panelizationType === "square-bale-panels" ? styles.toolActive : styles.tool}
          title={`Locks Thickness to ${squareBalePanel.thicknessIn}in — a whole-bale unit's width/thickness are physically fixed, not adjustable.`}
          onClick={() => {
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
          onClick={() => setPanelizationType("timber-frame-curtain")}
        >
          Timber Frame Curtain
        </button>
      </div>
      <div role="group" aria-label="Default bracing style" className={styles.toolbar}>
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
              <input
                type="number"
                value={nailerOffsetIn}
                onChange={(e) => setNailerOffsetIn(Number(e.target.value))}
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
              <input
                type="number"
                value={timberFrameCurtainWidthIn}
                min={1}
                step={1}
                onChange={(e) => setTimberFrameCurtainWidthIn(Number(e.target.value))}
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
  const documentDate = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

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
            <input
              type="number"
              min={0}
              max={Math.round(storyHeightIn)}
              value={Math.round(beam.heightIn)}
              onChange={(e) => handleChangeMidWallBeamHeight(story, wallId, beam.id, Number(e.target.value))}
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
              <input
                type="number"
                min={BIG_HEADER_BEAM_MIN_HEIGHT_IN}
                value={Math.round(beam.bigHeaderBeamHeightIn ?? BIG_HEADER_BEAM_MIN_HEIGHT_IN)}
                onChange={(e) =>
                  handleChangeMidWallBeamBigHeaderHeightIn(
                    story,
                    wallId,
                    beam.id,
                    Math.max(BIG_HEADER_BEAM_MIN_HEIGHT_IN, Number(e.target.value)),
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

  const elevationControls = elevationWall ? (
    <div className={elevationStyles.panel}>
      <div className={elevationStyles.headerRow}>
        <strong>Wall {elevationWall.id} elevation</strong>
        <button type="button" className={elevationStyles.actionButton} onClick={() => setElevationViewWallId(null)}>
          Close
        </button>
      </div>
      <div ref={setElevationToolbarPortalNode} className={styles.toolbarPortalInline} />
      <PanelLegend />
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
      {renderMidWallBeamSection(elevationWall.id, "ground", midWallBeamsByStoryAndWallId.ground[elevationWall.id] ?? [], wallHeightFt * 12)}
      {stories.length > 1 &&
        renderMidWallBeamSection(
          elevationWall.id,
          "second",
          midWallBeamsByStoryAndWallId.second[elevationWall.id] ?? [],
          (secondStory?.wallHeightFt ?? wallHeightFt) * 12,
        )}
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
                    <input
                      type="number"
                      min={0}
                      max={wallWidthIn}
                      value={Math.round(resolvedPointXsIn[i]!)}
                      onChange={(e) => handleChangeGableProfilePositionIn(elevationWall.id, i, Number(e.target.value))}
                    />
                    in
                  </label>
                  <label className={elevationStyles.fieldRow}>
                    From right end
                    <input
                      type="number"
                      min={0}
                      max={wallWidthIn}
                      value={Math.round(wallWidthIn - resolvedPointXsIn[i]!)}
                      onChange={(e) => handleChangeGableProfilePositionIn(elevationWall.id, i, wallWidthIn - Number(e.target.value))}
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
                <input
                  type="number"
                  min={windowHeaderWidthInRange.minIn}
                  max={panelWidthInRange.maxIn}
                  value={Math.round(w.widthIn)}
                  onChange={(e) => handleSetGableWindowField(elevationWall.id, w.beforeTileCount, "widthIn", Number(e.target.value))}
                />
                in
              </label>
              <label className={elevationStyles.fieldRow}>
                Height (RO)
                <input
                  type="number"
                  min={12}
                  value={Math.round(w.heightIn ?? standardWindowHeightDefaultIn.value)}
                  onChange={(e) => handleSetGableWindowField(elevationWall.id, w.beforeTileCount, "heightIn", Number(e.target.value))}
                />
                in
              </label>
              <label className={elevationStyles.fieldRow}>
                Sill height
                <input
                  type="number"
                  min={0}
                  value={Math.round(w.sillHeightIn ?? sillDefaultHeightIn.value)}
                  onChange={(e) => handleSetGableWindowField(elevationWall.id, w.beforeTileCount, "sillHeightIn", Number(e.target.value))}
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
          <input
            type="number"
            value={baleFoundationTopDepthIn}
            min={1.5}
            step={0.25}
            onChange={(e) => setBaleFoundationTopDepthIn(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label>
          Bottom framing member depth (in){" "}
          <input
            type="number"
            value={baleFoundationBottomDepthIn}
            min={1.5}
            step={0.25}
            onChange={(e) => setBaleFoundationBottomDepthIn(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label>
          Gap (in){" "}
          <input
            type="number"
            value={baleFoundationGapIn}
            min={0}
            step={0.25}
            onChange={(e) => setBaleFoundationGapIn(Math.max(0, Number(e.target.value)))}
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
          2 concentric doubled rings — one flush with the inside of the footprint, one a further panel-width ({standardWidthIn}in) inward — carry
          the wall&apos;s own exterior/interior wythe loads. Single field stacks fill the rest of the interior span at the spacing above.
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
        <label className={elevationStyles.checkboxLabel}>
          <input type="checkbox" checked={floorsEnabled} onChange={(e) => setFloorsEnabled(e.target.checked)} />
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
        <label className={elevationStyles.checkboxLabel}>
          <input type="checkbox" checked={roofEnabled} onChange={(e) => setRoofEnabled(e.target.checked)} />
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
            {roofProfilePointHeightsFt.length === 1 ? "Ridge rise above eave (ft)" : `Point ${i + 1} rise above eave (ft)`}
            <input
              type="number"
              value={heightFt}
              step={0.5}
              onChange={(e) => handleChangeRoofProfilePointHeightFt(i, Number(e.target.value))}
              style={{ width: 70 }}
            />
          </label>
        ))}
        <p className={styles.note}>
          For a real wall, pick a standard pitch (2/12-12/12) instead in that wall&apos;s own Elevation view — it computes the rise from
          that wall&apos;s own real width. The rise field here stays freely editable either way.
        </p>

        <label>
          Max Gable End Panel height (in){" "}
          <input
            type="number"
            value={maxGablePanelHeightIn}
            min={12}
            max={GABLE_PANEL_MAX_HEIGHT_IN}
            step={1}
            onChange={(e) => setMaxGablePanelHeightIn(Math.min(Number(e.target.value), GABLE_PANEL_MAX_HEIGHT_IN))}
          />
        </label>
        <p className={styles.note}>
          Any real roofline rise above this (up to a hard fabrication ceiling of {GABLE_PANEL_MAX_HEIGHT_IN}in per panel) is filled by a
          real vertical safety-gap tile instead of clamped — see that wall&apos;s elevation view.
        </p>

        <label>
          Heel height (in){" "}
          <input
            type="number"
            value={heelHeightIn}
            min={0}
            max={15}
            step={0.5}
            onChange={(e) => setHeelHeightIn(Math.max(0, Number(e.target.value)))}
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
              <input
                type="number"
                value={roofCatcherBeamOffsetIn}
                min={0}
                step={0.25}
                onChange={(e) => setRoofCatcherBeamOffsetIn(Number(e.target.value))}
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

  return (
    <DocumentMetaProvider value={{ projectName, siteLabel: documentSiteLabel, date: documentDate }}>
    <div className={styles.page} ref={pageRef}>
      <div className="print-hidden-chrome">
        <TopBar
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
        />
      </div>
      <input
        ref={loadInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleLoadFileSelected}
        style={{ display: "none" }}
      />
      <main className={styles.main}>
        <div className={`${styles.editorSection} print-hidden-chrome`}>
          <div className={styles.editorSidebar}>
            {loadError && <p className={styles.disclaimer}>Couldn&apos;t load that file — {loadError}</p>}
            {/* Region 1 (always first, fixed): viewer selection. Tommy:
                "having the viewer selection on top, then the floor/wall/
                roof layer, then all the editor relevant tools below" —
                previously shared this row with the pan/zoom portal div
                below, whose presence/absence (wall+plan only) changed the
                row's own height and shifted everything below it every time
                the tab/view changed. Kept to just ViewerDial + fullscreen
                now, so this row's height never varies. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
              <ViewerDial
                stops={viewerStops}
                value={currentViewerStop}
                onChange={handleViewerStopChange}
                disabled={editorTab !== "wall" || !footprint}
              />
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
            {/* Region 2 (always second, fixed): floor/wall/roof layer tabs
                — now guaranteed to sit right below Region 1 every time,
                since Region 1 no longer varies in height. */}
            <EditorToolbar editorTab={editorTab} onEditorTabChange={setEditorTab} enabledTabs={enabledEditorTabs} />
            {/* Region 3 (variable, always last): everything else — its own
                presence/height still varies by tab/view, but nothing below
                it depends on that anymore. */}
            {editorTab === "wall" && elevationWall && elevationControls}
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
                  const slot = (selectedSlot.story === "ground" ? baseWallSlots : (secondStory?.wallSlots ?? {}))[selectedSlot.wallId]?.[
                    selectedSlot.slotIndex
                  ];
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
                            <input
                              type="number"
                              id={`window-size-${wallId}-${slotIndex}`}
                              title="However wide, up to 10ft — the header's own truss web bracing angle adds/removes peaks in pairs to stay within its 30-45deg range as width changes"
                              value={slot.widthIn}
                              min={windowHeaderWidthInRange.minIn}
                              max={windowHeaderWidthInRange.maxIn}
                              step={0.125}
                              style={{ width: 64 }}
                              onChange={(e) => handleSetWindowWidth(story, wallId, slotIndex, Number(e.target.value))}
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
                            <input
                              type="number"
                              id={`window-sill-height-${wallId}-${slotIndex}`}
                              title="This window's own sill height (floor to Rough Opening bottom) — also draggable above and in the 3D Sill & Header tool"
                              value={zone.sillHeightIn ?? sillHeaderHeightInRange.minIn}
                              min={sillHeaderHeightInRange.minIn}
                              max={sillHeaderHeightInRange.maxIn}
                              step={0.125}
                              style={{ width: 64 }}
                              onChange={(e) => handleSetWindowSillHeight(story, wallId, slotIndex, Number(e.target.value), zoneIndex)}
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
                            <input
                              type="number"
                              id={`big-header-width-${wallId}-${slotIndex}`}
                              value={slot.widthIn}
                              min={bigHeaderWidthInRange.minIn}
                              max={bigHeaderWidthInRange.maxIn}
                              step={0.125}
                              style={{ width: 64 }}
                              onChange={(e) => handleSetBigHeaderWidth(story, wallId, slotIndex, Number(e.target.value))}
                            />
                            &quot; ({bigHeaderWidthInRange.minIn / 12}-{bigHeaderWidthInRange.maxIn / 12}ft)
                          </label>
                          <label style={{ display: "block" }}>
                            Height{" "}
                            <input
                              type="number"
                              id={`big-header-height-${wallId}-${slotIndex}`}
                              value={slot.heightIn ?? bigHeaderDefaultHeightIn.value}
                              min={bigHeaderHeightInRange.minIn}
                              max={bigHeaderHeightInRange.maxIn}
                              step={0.125}
                              style={{ width: 64 }}
                              onChange={(e) => handleSetBigHeaderHeight(story, wallId, slotIndex, Number(e.target.value))}
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
                          {materialSpecsSection}
                        </>
                      )}
                    </StickyNote>
                  );
                })()}
              <PageFeaturesButton features={pageFeatures[editorTab]} />
            </div>
          </div>

          <div className={styles.editorCanvasLayer}>
            {editorTab === "wall" && (
              <div className={styles.compassDock}>
                <CompassWidget ref={compassNeedleRef} />
              </div>
            )}
            {editorTab === "wall" &&
              (elevationWall ? (
                <WallElevationDiagram
                  wall={elevationWall}
                  slots={overlayWallSlots[elevationWall.id] ?? []}
                  wallHeightFt={wallHeightFt}
                  allInstances={allInstances}
                  secondStoryAllInstances={secondStoryAllInstances}
                  hasCornerStart={wallGeometryFor(elevationWall.id)?.hasCornerStart ?? true}
                  hasCornerEnd={wallGeometryFor(elevationWall.id)?.hasCornerEnd ?? true}
                  secondStorySlots={secondStory?.wallSlots[elevationWall.id]}
                  secondStoryWallHeightFt={secondStory?.wallHeightFt}
                  onToggleOpening={handleToggleOpening}
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
                  toolbarPortalTarget={elevationToolbarPortalNode}
                />
              ) : viewMode === "plan" ? (
                <FootprintCanvas
                  footprint={footprint}
                  shapeTool={shapeTool}
                  offsetPx={offsetPx}
                  wallSlots={effectiveViewedStoryId === "ground" ? overlayWallSlots : (secondStory?.wallSlots ?? {})}
                  wallStartOffsetIn={wallRenderOffsetIn}
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
                baleFoundationRingA={baleFoundationRingA}
                baleFoundationRingB={baleFoundationRingB}
                baleFoundationRingAInner={baleFoundationRingAInner}
                baleFoundationRingBInner={baleFoundationRingBInner}
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
              onCapture={handleCaptureRenderImage}
            />
          )}

          <div className={styles.editorRightSpacer} aria-hidden="true" />
        </div>

        <StickyNote
          id="detail-summary"
          label="Project Summary"
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
                  ${price.toFixed(2)}
                  <span className={styles.note}>
                    {" "}
                    — priced per panel type (standard/corner/braced/opening/roof rates), see Review Log
                  </span>
                  {role !== "public" && (
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
                "2 concentric doubled rings (2 framing stacks side by side each) carry the wall's own exterior/interior wythe loads — one flush with the inside of the primary footprint, one a further panel-width inward. Single (non-doubled) stacks fill the rest of the interior span.",
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
                    <td>3/4in plywood</td>
                    <td>
                      {plywoodAreaSqFt.threeQuarterSqFt.toFixed(1)} sqft → {plywoodThreeQuarterSheetCount} sheet
                      {plywoodThreeQuarterSheetCount === 1 ? "" : "s"} (4ft x 8ft, {PLYWOOD_SHEET_AREA_SQFT} sqft each)
                    </td>
                  </tr>
                  <tr>
                    <td>1/2in plywood (girt webs)</td>
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
              "3/4in plywood: every Standard/Braced/Sill panel's 2 skins, every Column/Corner panel's 2 side plies, every Safety/Gap panel's single sheet (see the Safety/Gap redesign note on its own Shop Drawing page), every Door/Window Header's top+bottom plate caps, plus the roof-bearing assembly's own plywood cap(s) — a box beam's top+bottom caps if Second Story is enabled, a truss plate's single cap otherwise — across the drawn footprint's real total wall perimeter, not an illustrative preview length.",
              "1/2in plywood is only the girt webs (girt bars themselves are dimensional lumber, tallied separately).",
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
              "Net plastered area auto-derives from the drawn footprint (wall perimeter x wall height, doubled if Second Story is on) minus each window/door's own clear Rough Opening area — the spreadsheet's own workflow instead had you type in a sqft figure by hand.",
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
                  track yet either. Floor/roof panels don&apos;t exist as modeled panel systems yet either — all
                  deferred until those systems are built.
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
                  <p className={styles.note}>
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
                  <p className={styles.note}>
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
                  <p className={styles.note}>
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
          </>
        )}

        <SectionCarousel
          sections={allNoteSections}
          openIds={openNoteIds}
          onToggle={handleToggleNote}
          header={
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
          }
          footer={
            <>
              <Link href="/sandbox">Single Wall Run Calculation Sandbox →</Link>
              <br />
              <Link href="/read-me">Read Me →</Link>
              <br />
              <Link href="/report-bug">Report Bug / Request Feature →</Link>
            </>
          }
        />
      </main>
    </div>
    </DocumentMetaProvider>
  );
}
