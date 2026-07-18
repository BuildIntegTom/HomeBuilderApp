"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyBracedPlacement,
  applyUniformPanelization,
  areWallsOppositePair,
  buildOctagonFootprint,
  buildRectangleFootprint,
  collapseNearZeroWalls,
  computeFloorPanelGrid,
  computeFootprintAreaSqFt,
  computeJoistLayout,
  computePanelLoadOrder,
  computePanelsPerStack,
  computePierGrid,
  computeRidgeLine,
  computeSillRunWidths,
  computeTruckLoads,
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
  pointAlongRidgeLine,
  retile as retilePure,
  retilePreservingOpenings as retilePreservingOpeningsPure,
  retileWithOpenings,
  wallGeometryFor as wallGeometryForPure,
  type CornerId,
  type Footprint,
  type PanelGroup,
  type PanelSlot,
  type TruckDims,
  type Wall,
} from "@building-integrity/geometry";
import {
  computeAssemblyPerm,
  computeBoardFeetByNominalSize,
  computeBracedPanelShearCapacityLb,
  computeBuiltUpColumnBearingCapacityLb,
  computeCarbonRange,
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
  computeStrawWeight,
  computeStudPackBearingCapacityLb,
  formatLengthIn,
  MM_PER_IN,
  toReviewLog,
  validateVaporOpenness,
  type Season,
} from "@building-integrity/calc-engine";
import {
  bomWidthMismatchWarning,
  BOX_BEAM_CAP_THICKNESS_IN,
  BOX_BEAM_LVL_HEIGHT_IN,
  bracedPanelDisplayLabel,
  buildBoxBeamMembers,
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
  buildWindowHeaderMembers,
  computeDoorRoughOpeningHeightIn,
  computeHeaderHeightIn,
  computeRoughOpeningWidthIn,
  doorRoughOpeningSelectedHeightIn,
  jackStudThicknessIn,
  JACK_STUD_THICKNESS_IN,
  SAFETY_GAP_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  PLATE_2X6_THICKNESS_IN,
  carbonFractionOfDryMass,
  COLUMN_TOTAL_WIDTH_IN,
  computeDensePackCelluloseVolume,
  computeGableColumnHeightIn,
  computeGableRipCallout,
  computePlywoodAreaSqFt,
  computeRoofCatcherBeamPostPositions,
  computeRoofCatcherBeamSegments,
  computeTimberHpVolume,
  DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN,
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
  CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
  CLASSIC_TRUSS_DISCLAIMER,
  CLASSIC_TRUSS_TYPES,
  buildEnergyHeelTrussSchema,
  buildParallelChordTrussSchema,
  HIGH_PERF_TRUSS_BEARING_SHAPES,
  HIGH_PERF_TRUSS_CAVITY_DEPTH_OPTIONS_IN,
  HIGH_PERF_TRUSS_DEFAULT_SPAN_IN,
  HIGH_PERF_TRUSS_MAX_PITCH_IN12,
  HIGH_PERF_TRUSS_MIN_PITCH_IN12,
  floorLongSideBlockingNote,
  floorRimJoistDetail,
  foundationFastenerSchedule,
  foundationTypes,
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
  type BracingStyle,
  type ClassicTrussTypeId,
  type HighPerfTrussBearingShapeId,
  type HighPerfTrussCavityDepthIn,
  type JackStudConfig,
  type OctagonRingDiameterFt,
  type PanelMember,
  type RoofCatcherBeamShape,
  type RoofSystemType,
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
import FloorJoistDiagram from "./FloorJoistDiagram";
import FoundationCanvas from "./FoundationCanvas";
import { allPanelInstances, type NamedPanelType, type PanelInstance } from "./panelInstances";
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
import PanelFabricationPage from "./PanelFabricationPage";
import BuildingSummaryRender from "./BuildingSummaryRender";
import CompassWidget from "./CompassWidget";
import { DocumentMetaProvider } from "./DocumentMetaContext";
import DrawingToolPen from "./DrawingToolPen";
import EditorToolbar from "./EditorToolbar";
import OctagonRingPreview from "./OctagonRingPreview";
import TrussPreview from "./TrussPreview";
import HighPerfTrussPreview, { type HighPerfTrussTypeId } from "./HighPerfTrussPreview";
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
import WallElevationView from "./WallElevationView";
import styles from "./page.module.css";

const FootprintCanvas = dynamic(() => import("./FootprintCanvas"), { ssr: false });
const Building3DView = dynamic(() => import("./Building3DView"), { ssr: false });
const StandardPanel3DView = dynamic(() => import("./StandardPanel3DView"), { ssr: false });
const TruckLoad3DView = dynamic(() => import("./TruckLoad3DView"), { ssr: false });

const BEARING_ELIGIBLE_TYPES = new Set(["standard", "corner", "safety-oct-corner", "braced", "column"]);
const STRAW_BALE_WEIGHT_LB = 40;
const KG_TO_LB = 2.20462;
const LB_FT3_TO_KG_M3 = 16.018463;

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
// Gable has an empty namedTypes (no PanelSlotType exists for it yet, so it
// always shows 0 real instances) but still gets a preview 3D model built
// at illustrative default heights.
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
  // Gable End Panel isn't placeable anywhere in the layout yet (no roof/
  // ridge system exists) — namedTypes: [] means it always shows 0 real
  // instances, but it still gets a preview 3D model + rip-angle callout
  // below, built at illustrative default heights.
  { namedTypes: [], panelTypeId: "gable" },
  // Plywood Jack Stud is always derived from a header/sill opening, never
  // its own placed slot — namedTypes: [] for the same reason as gable.
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
  });
  const [plasterSandPricePerCuYd, setPlasterSandPricePerCuYd] = useState(plasterPriceDefaults.sandPricePerCuYd.value);
  const [plasterClayPricePerBag, setPlasterClayPricePerBag] = useState(plasterPriceDefaults.clayPricePerBag.value);
  const [plasterLimePricePerBag, setPlasterLimePricePerBag] = useState(plasterPriceDefaults.limePricePerBag.value);
  const [plasterStrawPricePerCuFt, setPlasterStrawPricePerCuFt] = useState(plasterPriceDefaults.strawPricePerCuFt.value);
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
  // Null until a floor-type button is clicked - "autogenerate when the
  // button is clicked" (Tommy), not selected by default. Covers both the
  // suspended-joist options and the Thermally Broken Slab floor option —
  // mutually exclusive, so one state covers the whole button group.
  const [floorSystemId, setFloorSystemId] = useState<(typeof floorJoistTypes)[number]["id"] | "thermal-slab" | null>(
    null,
  );
  const [perpendicular2x4Enabled, setPerpendicular2x4Enabled] = useState(false);

  // Roof is its own system (parallel to the Floor tab's joist catalog), not
  // a wall panel type — see the Roof tab below. Truss plate / box beam
  // geometry itself is flagged to model later (Tommy); these are just the
  // inset/height/offset numbers that feed the Gable End Panel + Column
  // Panel previews.
  const [roofSystemTypeId, setRoofSystemTypeId] = useState<RoofSystemType>("truss");
  const [bottomOfTrussMaxHeightFt, setBottomOfTrussMaxHeightFt] = useState(16);
  const [trussPlateInsetIn, setTrussPlateInsetIn] = useState(trussPlateInsetDefaultIn.value);
  const [roofCatcherBeamOffsetIn, setRoofCatcherBeamOffsetIn] = useState(DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN);
  const [roofCatcherBeamShape, setRoofCatcherBeamShape] = useState<RoofCatcherBeamShape>(roofCatcherBeamShapeDefault);
  // Octagon roof-catcher ring (Tommy: "for octagon roofs, lets do an octagon
  // ring made out of LVL's that are 14x1.75in") — only relevant when the
  // footprint is an octagon (8 corners, the octagon drawing tool's own
  // shape), independent of roofSystemTypeId.
  const [octagonRingDiameterFt, setOctagonRingDiameterFt] = useState<OctagonRingDiameterFt>(3);

  // Classic Truss Reference gallery (Tommy: "model out some classic truss
  // examples... this is a basic outline and estimate - refer to truss
  // manufacturer for more details") — a standalone browsing selection, not
  // tied to the project's own drawn footprint/roof, so (like
  // elevationViewWallId) it doesn't round-trip in ProjectFile.
  const [selectedClassicTrussId, setSelectedClassicTrussId] = useState<ClassicTrussTypeId>(CLASSIC_TRUSS_TYPES[0]!.id);
  const selectedClassicTruss = CLASSIC_TRUSS_TYPES.find((t) => t.id === selectedClassicTrussId)!;

  // High-Performance Truss (Tommy: "we are designing for a high performance
  // house here... each of these trusses should be able to meet a variety of
  // different slopes, 2/12 to 12/12... have them sit on the 2x12's that are
  // up there (or 14in LVL)") — same standalone-reference pattern as the
  // Classic Truss gallery above, but with real adjustable pitch/cavity-
  // depth/bearing-shape controls instead of fixed illustrative defaults.
  const [highPerfTrussTypeId, setHighPerfTrussTypeId] = useState<HighPerfTrussTypeId>("energy-heel");
  const [highPerfTrussPitchIn12, setHighPerfTrussPitchIn12] = useState(CLASSIC_TRUSS_DEFAULT_PITCH_IN12);
  const [highPerfTrussCavityDepthIn, setHighPerfTrussCavityDepthIn] = useState<HighPerfTrussCavityDepthIn>(18);
  const [highPerfTrussBearingShapeId, setHighPerfTrussBearingShapeId] = useState<HighPerfTrussBearingShapeId>(HIGH_PERF_TRUSS_BEARING_SHAPES[0]!.id);

  // Per-wall elevation view (Tommy: "an arrow button for each wall section,
  // where we can see the whole line up still in 2d view") — additive to the
  // existing ground-floor PanelSlot[] row, not a replacement for it.
  // gableEndWallIds tracks which walls have a Gable End tiled on top;
  // elevationViewWallId is which wall's elevation view is currently open
  // (only one at a time).
  const [gableEndWallIds, setGableEndWallIds] = useState<Set<string>>(new Set());
  const [elevationViewWallId, setElevationViewWallId] = useState<string | null>(null);
  // Which panel a click in Edit mode most recently landed on (2D or 3D —
  // both route through handleToggleOpening below) — drives the "Selected
  // Panel" note. Re-derived fresh from baseWallSlots on every render (see
  // that note's isOpen check), so a stale wallId/slotIndex after a redraw
  // just fails to find a slot and the note stops rendering, rather than
  // showing the wrong panel.
  const [selectedSlot, setSelectedSlot] = useState<{ wallId: string; slotIndex: number } | null>(null);
  // Feedback for the Selected Panel note's window-sill controls (number
  // input + WindowSizeDiagram's drag handle) — Tommy: "when a drag or the
  // number input gets clamped... show a brief inline note instead of
  // silently snapping". Set by handleSetWindowSillHeight itself, so both
  // input paths share one source of truth for what actually got clamped.
  const [sillClampNotice, setSillClampNotice] = useState<string | null>(null);
  const sillClampNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (enabled) next.add(wallId);
      else next.delete(wallId);
      return next;
    });
  };

  // Gable End peak position (Tommy: "drag wall tool the peak of this
  // triangle... a sliding scale that you can also click and edit how far
  // away from each end it is"). Inches from the wall's start corner; a
  // missing entry means "not yet customized" (auto-centered midpoint) — see
  // computeGableTiledRow's own peakPositionIn default + snap-to-shed logic.
  const [gablePeakPositionInByWallId, setGablePeakPositionInByWallId] = useState<Record<string, number>>({});
  const handleChangeGablePeakPositionIn = useCallback((wallId: string, positionIn: number | undefined) => {
    setGablePeakPositionInByWallId((was) => {
      const next = { ...was };
      if (positionIn === undefined || Number.isNaN(positionIn)) delete next[wallId];
      else next[wallId] = positionIn;
      return next;
    });
  }, []);
  // "add shed roof option next to gable end options to auto generate a 4/12
  // scenario of gable end shed roof" (Tommy) — snaps the peak to this wall's
  // start and sets the Roof tab's ridge height so the resulting single slope
  // (spanning the wall's own full width) is a 4-in-12 pitch.
  const handleGenerateShedRoof = (wall: Wall) => {
    handleToggleGableEnd(wall.id, true);
    handleChangeGablePeakPositionIn(wall.id, 0);
    // Round to the nearest inch (this app's finest dimension unit
    // everywhere else) — a raw 4/12 pitch over an arbitrary wall length
    // is a repeating decimal in feet and would otherwise leak an ugly
    // value like 16.666666666666668 into the height input/diagrams below.
    setBottomOfTrussMaxHeightFt(Math.round((wallHeightFt + wall.lengthFt * (4 / 12)) * 12) / 12);
  };

  // Second story (Tommy: "add a second level of panels") — shares the
  // ground floor's footprint/panel layout for now (a fully independent
  // per-story footprint/opening editor isn't wired up yet, see the
  // gable-multistory-roof-strategy memory), stacked at the ground floor's
  // own top-plate height in the 3D Preview + whole-building OBJ export.
  const [secondStoryEnabled, setSecondStoryEnabled] = useState(false);
  const [secondStoryWallHeightFt, setSecondStoryWallHeightFt] = useState(10);

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
      bottomOfTrussMaxHeightFt,
      trussPlateInsetIn,
      roofCatcherBeamOffsetIn,
      roofCatcherBeamShape,
      octagonRingDiameterFt,
      gableEndWallIds,
      gablePeakPositionInByWallId,
      secondStoryEnabled,
      secondStoryWallHeightFt,
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
      setBaseWallSlots(s.baseWallSlots);
      setLeastAccessibleCorner(s.leastAccessibleCorner);
      setStandardWidthIn(s.standardWidthIn);
      setThicknessIn(s.thicknessIn);
      setDensityLbFt3(s.densityLbFt3);
      setWallHeightFt(s.wallHeightFt);
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
      setRoofSystemTypeId(s.roofSystemTypeId);
      setBottomOfTrussMaxHeightFt(s.bottomOfTrussMaxHeightFt);
      setTrussPlateInsetIn(s.trussPlateInsetIn);
      setRoofCatcherBeamOffsetIn(s.roofCatcherBeamOffsetIn);
      setRoofCatcherBeamShape(s.roofCatcherBeamShape);
      setOctagonRingDiameterFt(s.octagonRingDiameterFt);
      setGableEndWallIds(s.gableEndWallIds);
      setGablePeakPositionInByWallId(s.gablePeakPositionInByWallId);
      setSecondStoryEnabled(s.secondStoryEnabled);
      setSecondStoryWallHeightFt(s.secondStoryWallHeightFt);
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

  const floorJoistTypeId = floorSystemId && floorSystemId !== "thermal-slab" ? floorSystemId : null;
  const floorJoistType = floorJoistTypeId ? floorJoistTypes.find((t) => t.id === floorJoistTypeId)! : null;
  const isThermalSlabFloor = floorSystemId === "thermal-slab";
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

  // Only concrete piers contribute embodied-carbon emissions here — the
  // helical-screw crawlspace is steel, not concrete, so it nets 0.
  const concretePierVolumeFt3 =
    foundationTypeId === "concrete-pier"
      ? computeConcretePierVolume(pierGrid.length, concretePierDimensions.diameterIn, concretePierDimensions.depthFt)
          .totalVolumeFt3
      : 0;

  const spacingIn = seismicBracedPanelSpacingFt[seismicZone] * 12;

  // `cornerOwnership`/`retile`/`wallGeometryFor` (imported above) are pure
  // functions from the geometry package — corner-ownership rules,
  // safety/gap-panel placement, per-wall tiling (see
  // packages/geometry/src/retile.ts for the full rationale, including the
  // reflex-corner gap fix that was originally verified by direct pixel
  // measurement). They take this component's panel parameters as explicit
  // arguments rather than closing over them, so these 3 names are
  // intentionally shadowed for the rest of this component with thin
  // partial applications supplying `thicknessIn`/`standardWidthIn`/
  // `cornerPanelWidthIn` — every call site below already expects the
  // closure-capturing signature these provide.
  const cornerOwnership = (fp: Footprint, primary: Set<string>) => cornerOwnershipPure(fp, primary, thicknessIn);
  const retile = (fp: Footprint, leastAccessible: CornerId, primary: Set<string>): Record<string, PanelSlot[]> =>
    retilePure(fp, leastAccessible, primary, standardWidthIn, cornerWidthInForTiling, thicknessIn);
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
  };

  // Re-tiles the whole wall from scratch around its openings (Tommy: resizing
  // an opening was leaving the rest of the wall protruding past the drawn
  // box instead of auto-adjusting the standard count and gap/borrowed
  // panel sizing) — see `retileWithOpenings`.
  const isOpeningType = (type: PanelSlot["type"]) => type === "window" || type === "door" || type === "column";

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

  const handleToggleOpening = (wallId: Wall["id"], slotIndex: number) => {
    const currentSlots = baseWallSlots[wallId] ?? [];
    const currentSlot = currentSlots[slotIndex];
    const geometry = wallGeometryFor(wallId);
    if (!currentSlot || !geometry) return;
    const cycle: Partial<Record<PanelSlot["type"], PanelSlot["type"]>> = {
      standard: "window",
      window: "door",
      door: "column",
      column: "standard",
    };
    const nextType = cycle[currentSlot.type];
    if (!nextType) {
      // corner/safety-gap: not cyclable, but still selectable for read-only
      // details in the Selected Panel note.
      setSelectedSlot({ wallId, slotIndex });
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
    const anchors: { beforeStandardCount: number; type: "window" | "door" | "column"; widthIn: number }[] = [];
    let standardsSeen = 0;
    currentSlots.forEach((slot, i) => {
      const type = i === slotIndex ? nextType : slot.type;
      if (type === "window" || type === "door" || type === "column") {
        anchors.push({
          beforeStandardCount: standardsSeen,
          type,
          widthIn: type === "column" ? COLUMN_TOTAL_WIDTH_IN : slot.widthIn,
        });
      } else if (type === "standard") {
        standardsSeen++;
      }
    });

    // Openings keep their relative order, so "how many opening-type slots
    // sit before this one" (computed against the *pre*-retile array, same
    // ordinal handleSetWindowWidth's precedingOpenings uses) still uniquely
    // identifies this exact panel after retiling reshuffles indices.
    // Converting *to* plain "standard" has no such stable identity (any
    // number of standards can appear anywhere) — selection is just cleared.
    const openingOrdinal = nextType === "standard" ? null : currentSlots.slice(0, slotIndex).filter((s) => isOpeningType(s.type)).length;

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
    const finalSlots = footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots;

    if (openingOrdinal === null) {
      setSelectedSlot(null);
    } else {
      const newIndex = findNthOpeningIndex(finalSlots, openingOrdinal);
      setSelectedSlot(newIndex === -1 ? null : { wallId, slotIndex: newIndex });
    }

    setBaseWallSlots((prev) => ({
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

  const handleSetWindowWidth = (wallId: string, slotIndex: number, widthIn: number) => {
    const currentSlots = baseWallSlots[wallId] ?? [];
    const geometry = wallGeometryFor(wallId);
    if (!geometry) return;
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
    setBaseWallSlots((prev) => ({
      ...prev,
      [wallId]: footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots,
    }));
  };

  // Unlike width, a window's height doesn't affect wall tiling at all
  // (Tommy: "i want each window individually adjustable") — just a direct
  // per-slot field update, no re-tiling needed.
  const handleSetWindowHeight = (wallId: string, slotIndex: number, heightIn: number) => {
    setBaseWallSlots((prev) => {
      const slots = prev[wallId];
      if (!slots || !slots[slotIndex]) return prev;
      const nextSlots = slots.slice();
      nextSlots[slotIndex] = { ...nextSlots[slotIndex]!, heightIn };
      return { ...prev, [wallId]: nextSlots };
    });
  };

  // Same "direct per-slot field, no re-tiling" pattern as
  // handleSetWindowHeight — a window's sill height (Tommy: "manipulate
  // sill and header height with the drag tool") is purely a vertical/Z-axis
  // concern, orthogonal to the horizontal wall-tiling system. Clamped to
  // the mfr spec sheet's sill/lintel-height range, and further clamped so
  // the sill can't push the RO's top past the wall's own height.
  const handleSetWindowSillHeight = (wallId: string, slotIndex: number, requestedSillHeightIn: number) => {
    const slots = baseWallSlots[wallId];
    const slot = slots?.[slotIndex];
    if (!slots || !slot) return;
    const windowHeightIn = slot.heightIn ?? standardWindowHeightDefaultIn.value;
    const maxSillHeightIn = wallHeightFt * 12 - windowHeightIn;
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
    nextSlots[slotIndex] = { ...nextSlots[slotIndex]!, sillHeightIn: clampedSillHeightIn };
    setBaseWallSlots((prev) => ({ ...prev, [wallId]: nextSlots }));
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

  // Braced-panel placement (or, under an alternate panelization type, a
  // uniform re-tiling instead) is a derived overlay, recomputed from the
  // base slots every render — never stored, so toggling an opening back to
  // standard, or switching panelization type, just falls out of
  // recomputation instead of needing to be undone. Corner-bracing/safety-
  // gap placement only applies to "loose-packed-braced" (today's system) —
  // the other two types are uniform by explicit choice, not by the
  // automatic corner-proximity rule, so they skip straight to
  // applyUniformPanelization instead.
  const overlayWallSlots = useMemo(() => {
    const next: Record<string, PanelSlot[]> = {};
    for (const [wallId, slots] of Object.entries(baseWallSlots)) {
      if (panelizationType === "loose-packed-braced") {
        next[wallId] = applyBracedPlacement(slots, spacingIn, standardWidthIn);
      } else {
        const uniformType = panelizationType === "square-bale-panels" ? "standard" : timberFrameCurtainPanelType;
        const uniformWidthIn = panelizationType === "square-bale-panels" ? squareBalePanel.widthIn : timberFrameCurtainWidthIn;
        next[wallId] = applyUniformPanelization(slots, uniformType, uniformWidthIn);
      }
    }
    return next;
  }, [baseWallSlots, spacingIn, standardWidthIn, panelizationType, timberFrameCurtainPanelType, timberFrameCurtainWidthIn]);

  const allSlots = useMemo(() => Object.values(overlayWallSlots).flat(), [overlayWallSlots]);
  // Every real wall panel type, straw-filled or not — used for the panel
  // COUNT. Safety/Gap is a real wall panel (counted here) but, since it's
  // just a plywood sheet now (Tommy), has no straw-filled cavity at all —
  // strawSlots below excludes it so straw weight isn't overcounted.
  const allWallPanelSlots = allSlots.filter(
    (s) =>
      s.type === "corner" ||
      s.type === "safety-oct-corner" ||
      s.type === "standard" ||
      s.type === "safety-gap" ||
      s.type === "braced" ||
      s.type === "column",
  );
  const strawSlots = allWallPanelSlots.filter((s) => s.type !== "safety-gap");
  const woodEligibleCount = allSlots.filter((s) => s.type === "standard" || s.type === "braced").length;
  const openingCounts = useMemo(
    () => ({
      windows: allSlots.filter((s) => s.type === "window").length,
      doors: allSlots.filter((s) => s.type === "door").length,
    }),
    [allSlots],
  );

  const totalStrawWidthIn = strawSlots.reduce((sum, s) => sum + s.widthIn, 0);

  const strawWeight = useMemo(
    () =>
      computeStrawWeight(
        totalStrawWidthIn,
        thicknessIn,
        wallHeightFt * 12,
        densityLbFt3 * LB_FT3_TO_KG_M3,
      ),
    [totalStrawWidthIn, thicknessIn, wallHeightFt, densityLbFt3],
  );

  // Summed from each real instance's own member geometry (not a flat
  // per-panel constant multiplied by count) — the only way a braced
  // panel's diagonal braces/connector (real trapezoid-cut length, per
  // bracingStyle) actually count toward the project's wood weight total
  // (Tommy: "make sure trapezoid pieces... have wood weight... that fill
  // into project totals").
  const totalWoodWeightKg = useMemo(() => {
    const heightIn = wallHeightFt * 12;
    return allSlots
      .filter((s) => s.type === "standard" || s.type === "braced")
      .reduce((sum, s) => {
        const members =
          s.type === "braced"
            ? buildBracedPanelMembers(s.widthIn, thicknessIn, heightIn, includeNailer, bracingStyle)
            : buildStandardPanelMembers(s.widthIn, thicknessIn, heightIn, includeNailer);
        return sum + computeMemberSetWoodWeight(members).weightKg;
      }, 0);
  }, [allSlots, wallHeightFt, thicknessIn, includeNailer, bracingStyle]);
  const totalWeightKg = strawWeight.weightKg + totalWoodWeightKg;
  const totalWeightLb = totalWeightKg * KG_TO_LB;

  const hasClayPlaster = checkedInteriorIds.has("clay-plaster");
  const hasLimePlaster = checkedExteriorIds.has("lime-plaster");

  // Computed once, across every nameable panel type together, so a panel's
  // number always reflects its true position in the along-wall sequence —
  // Shop Drawing pages then just filter this same list, rather than each
  // recomputing its own independent (and previously mismatched) counter.
  const allInstances = useMemo(
    () => (footprint ? allPanelInstances(footprint, overlayWallSlots, standardWidthIn, jackStudConfig) : []),
    [footprint, overlayWallSlots, standardWidthIn, jackStudConfig],
  );

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

  // Gable End Panel: the low edge is the current wall height (the eave);
  // the high edge is the Roof tab's "bottom of truss max height" (the
  // ridge) — a real roof-derived number now, not a placeholder pitch.
  // Clamped so a ridge typed below the eave doesn't throw. There's still no
  // per-instance placement mechanism yet (see the elevation view), so this
  // remains a preview 3D model + rip callout, not a real gable instance.
  const gablePreviewLowEdgeHeightIn = wallHeightFt * 12;
  const gablePreviewHighEdgeHeightIn = Math.max(bottomOfTrussMaxHeightFt * 12, gablePreviewLowEdgeHeightIn);
  const gablePanelMembers = useMemo(
    () =>
      buildGablePanelMembers(
        standardWidthIn,
        thicknessIn,
        gablePreviewLowEdgeHeightIn,
        gablePreviewHighEdgeHeightIn,
        includeNailer,
      ),
    [standardWidthIn, thicknessIn, gablePreviewLowEdgeHeightIn, gablePreviewHighEdgeHeightIn, includeNailer],
  );
  const gableRipCallout = useMemo(
    () => computeGableRipCallout(standardWidthIn, gablePreviewLowEdgeHeightIn, gablePreviewHighEdgeHeightIn),
    [standardWidthIn, gablePreviewLowEdgeHeightIn, gablePreviewHighEdgeHeightIn],
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
  const trussPlatePreviewMembers = useMemo(
    () => buildTrussPlateMembers(ASSEMBLY_PREVIEW_LENGTH_IN, thicknessIn, trussPlateInsetIn),
    [thicknessIn, trussPlateInsetIn],
  );
  const timberHpTotal = useMemo(
    () => computeTimberHpVolume(totalWallPerimeterIn, thicknessIn, trussPlateInsetIn),
    [totalWallPerimeterIn, thicknessIn, trussPlateInsetIn],
  );
  const timberHpWeight = useMemo(
    () => computeInsulationWeight(timberHpTotal.volumeFt3, timberHpDensityLbFt3.value),
    [timberHpTotal],
  );
  const boxBeamPreviewMembers = useMemo(
    () => buildBoxBeamMembers(ASSEMBLY_PREVIEW_LENGTH_IN, thicknessIn),
    [thicknessIn],
  );
  const denseCelluloseTotal = useMemo(
    () => computeDensePackCelluloseVolume(totalWallPerimeterIn, thicknessIn),
    [totalWallPerimeterIn, thicknessIn],
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
            ? buildBracedPanelMembers(inst.widthIn, thicknessIn, heightIn, includeNailer, bracingStyle)
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
                      : null;
      if (instMembers) members.push(...instMembers);
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
    bracingStyle,
    nailerOffsetIn,
    doorHeaderHeightIn,
    sillHeightIn,
  ]);

  const plywoodAreaSqFt = useMemo(() => {
    let threeQuarterSqFt = computePlywoodAreaSqFt(allRealMembers, 0.75);
    const halfSqFt = computePlywoodAreaSqFt(allRealMembers, 0.5);
    // Roof-bearing assembly's own plywood cap(s) — box beam has both a top
    // and bottom cap, truss plate just one — over the real wall perimeter.
    threeQuarterSqFt += secondStoryEnabled
      ? (2 * totalWallPerimeterIn * thicknessIn) / 144
      : (totalWallPerimeterIn * thicknessIn) / 144;
    return { threeQuarterSqFt, halfSqFt };
  }, [allRealMembers, secondStoryEnabled, totalWallPerimeterIn, thicknessIn]);

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
      if (inst.panelType !== "header") continue;
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
      } else {
        map.set(inst.name, mainHeightIn);
      }
    }
    for (const ref of shippingJackStudRefs) map.set(ref.id, ref.heightIn);
    return map;
  }, [allInstances, wallHeightFt, doorHeaderHeightIn, shippingJackStudRefs]);

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
  // gets diverted into its own stack, not this sort.
  const shippingCombinedPanelRefs = useMemo(
    () =>
      allInstances
        .slice()
        .sort(
          (a, b) =>
            (shippingLoadOrderIndex.get(`${a.wallId}:${a.slotIndexInWall}`) ?? 0) -
            (shippingLoadOrderIndex.get(`${b.wallId}:${b.slotIndexInWall}`) ?? 0),
        )
        .map((inst) => ({ id: inst.name, widthIn: inst.widthIn, heightIn: shippingPanelHeightById.get(inst.name) })),
    [allInstances, shippingLoadOrderIndex, shippingPanelHeightById],
  );

  const selectedTruck = truckBedTypes.value.find((t) => t.id === selectedTruckBedId) ?? truckBedTypes.value[0]!;
  const shippingTruckDims: TruckDims = {
    lengthIn: selectedTruck.interiorLengthIn,
    widthIn: selectedTruck.interiorWidthIn,
    heightIn: selectedTruck.interiorHeightIn,
  };
  const shippingGroups: PanelGroup[] = [
    { panels: shippingCombinedPanelRefs, thicknessIn, defaultHeightIn: wallHeightFt * 12, useCompatibilityStacking: true },
    { panels: shippingJackStudRefs, thicknessIn: jackStudThicknessIn(jackStudConfig), defaultHeightIn: wallHeightFt * 12 },
  ];
  const truckLoads = computeTruckLoads(shippingGroups, shippingTruckDims, shippingStackBufferIn.value);
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
  const plasterFloorCount = secondStoryEnabled ? 2 : 1;
  const plasterGrossWallAreaSqFt =
    (totalWallPerimeterIn / 12) * wallHeightFt + (secondStoryEnabled ? (totalWallPerimeterIn / 12) * secondStoryWallHeightFt : 0);
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
    return secondStoryEnabled ? [...perFloor, ...perFloor] : perFloor;
  }, [allInstances, jackStudConfig, secondStoryEnabled]);
  const extoSealLengthFt = useMemo(() => computeSillTapeLengthFt(extoSealOpeningWidths), [extoSealOpeningWidths]);

  const intelloWallRuns = useMemo(() => {
    if (!footprint) return [];
    const ground = footprint.walls.map((w) => ({ lengthFt: w.lengthFt, heightFt: wallHeightFt }));
    const second = secondStoryEnabled
      ? footprint.walls.map((w) => ({ lengthFt: w.lengthFt, heightFt: secondStoryWallHeightFt }))
      : [];
    return [...ground, ...second];
  }, [footprint, wallHeightFt, secondStoryEnabled, secondStoryWallHeightFt]);
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
  };
  const plasterActiveSideCount = (hasClayPlaster ? 1 : 0) + (hasLimePlaster ? 1 : 0);
  const plasterLaborHoursPerSide = computePlasterLaborHours(
    plasterNetAreaSqFt,
    plasterRoughOpeningCount,
    plasterLaborRatesRef.roughOpeningEdgeAllowanceSqFt.value,
    plasterLaborRatesRef.fieldHrsPerSqFt.value,
    plasterLaborRatesRef.edgeHrsPerSqFt.value,
  );
  const plasterTotalLaborHrs = plasterLaborHoursPerSide.totalHrs * plasterActiveSideCount + plasterFussyHoursExtra;
  const plasterTotalLaborCost = computePlasterLaborCost(plasterTotalLaborHrs, plasterLaborRatePerHour);
  const plasterTotalMaterialCost =
    (plasterSideResults.interior ? plasterSideResults.interior.base.materialCost + plasterSideResults.interior.finish.materialCost : 0) +
    (plasterSideResults.exterior ? plasterSideResults.exterior.base.materialCost + plasterSideResults.exterior.finish.materialCost : 0);
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
  ) => {
    const heightIn = wallHeightFt * 12;
    const resolvedSillHeightIn = sillHeightInOverride ?? sillDefaultHeightIn.value;
    return panelTypeId === "standard"
      ? buildStandardPanelMembers(widthIn, thicknessIn, heightIn, includeNailer)
      : panelTypeId === "braced"
        ? buildBracedPanelMembers(widthIn, thicknessIn, heightIn, includeNailer, bracingStyle)
        : panelTypeId === "column"
          ? columnPanelMembers
          : panelTypeId === "corner"
            ? cornerPanelMembers3D
            : panelTypeId === "gable"
              ? gablePanelMembers
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
  };

  // Fastener counts/weight are only modeled for panel types with real
  // member geometry (standard/braced/column/corner).
  const fastenerWeightKgFor = (
    panelTypeId: string,
    widthIn: number,
    sourceSlotType?: PanelInstance["sourceSlotType"],
    windowHeightInOverride?: number,
    sillHeightInOverride?: number,
  ): number | null => {
    const members = membersForPanelTypeId(panelTypeId, widthIn, sourceSlotType, windowHeightInOverride, sillHeightInOverride);
    return members ? computeFastenerWeight(members).totalWeightKg : null;
  };

  // Wood weight is modeled for any panel type with real member geometry
  // (membersForPanelTypeId returns non-null) — geometry-aware via the same
  // real member list fastenerWeightKgFor uses, so e.g. a braced panel's
  // diagonal braces (real trapezoid length) actually count, unlike the old
  // flat computeStandardPanelWoodWeight scalar that assumed every braced
  // panel shares the plain standard panel's BOM. Only gable/jack-stud (no
  // membersForPanelTypeId branch) fall through to "not modeled".
  const woodWeightKgFor = (
    panelTypeId: string,
    widthIn: number,
    sourceSlotType?: PanelInstance["sourceSlotType"],
    windowHeightInOverride?: number,
    sillHeightInOverride?: number,
  ): number | null => {
    const members = membersForPanelTypeId(panelTypeId, widthIn, sourceSlotType, windowHeightInOverride, sillHeightInOverride);
    return members ? computeMemberSetWoodWeight(members).weightKg : null;
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
              // Safety/Gap and Header are both a solid wood truss/sheet
              // filling the wall's cavity there, no straw at all — widthIn:
              // 0 forces straw weight to a correct 0 here without touching
              // inst.widthIn itself (still shown as-is in the table's own
              // Width column).
              widthIn: panelTypeId === "safety-gap" || panelTypeId === "header" ? 0 : inst.widthIn,
              thicknessIn,
              // A sill is a much shorter panel (Tommy: "sills are almost
              // always 32in tall") than the full wall height every other
              // panel type here uses.
              heightIn: panelTypeId === "sill" ? (inst.sillHeightIn ?? sillDefaultHeightIn.value) : wallHeightFt * 12,
              densityKgM3: densityLbFt3 * LB_FT3_TO_KG_M3,
              woodWeightKg: woodWeightKgFor(panelTypeId, inst.widthIn, inst.sourceSlotType, inst.windowHeightIn, inst.sillHeightIn),
              fastenerWeightKg: fastenerWeightKgFor(panelTypeId, inst.widthIn, inst.sourceSlotType, inst.windowHeightIn, inst.sillHeightIn),
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
      bracingStyle,
      hasClayPlaster,
      hasLimePlaster,
      doorHeaderHeightIn,
      sillHeightIn,
    ],
  );

  // Total fastener weight (Tommy: "do a full check on what might not be on
  // this but should be" — fasteners are computed per-instance via
  // computePanelWeightBreakdown above, but were never rolled up into a
  // single project-wide total before). Sums only the panel types that
  // actually have modeled fastener counts, honestly naming the rest.
  const fastenerTotals = useMemo(() => {
    let totalKg = 0;
    const unmodeledLabels = new Set<string>();
    for (const { panelType, instances } of shopDrawings) {
      for (const inst of instances) {
        const fastenerKg = inst.weightBreakdown.components.find((c) => c.label === "Fasteners")?.weightKg;
        if (fastenerKg != null) totalKg += fastenerKg;
        else unmodeledLabels.add(panelType.label);
      }
    }
    return { totalLb: totalKg * KG_TO_LB, unmodeledLabels: [...unmodeledLabels] };
  }, [shopDrawings]);

  // Estimated bearing/shear numbers (Tommy: "let's take a stab at making
  // some estimated engineering numbers") — bearing applies to any panel
  // type with real stud geometry (standard/braced/column/corner all share
  // the same 2x4 studs); shear is specific to the Braced Panel's diagonal
  // brace, computed from its own actual member geometry at the currently-
  // selected width/height rather than a flat constant.
  const estimatedStudPackBearingLb = useMemo(() => computeStudPackBearingCapacityLb(), []);
  const estimatedBracedShearLb = useMemo(
    () =>
      computeBracedPanelShearCapacityLb(buildBracedPanelMembers(standardWidthIn, thicknessIn, wallHeightFt * 12, includeNailer, bracingStyle)),
    [standardWidthIn, thicknessIn, wallHeightFt, includeNailer, bracingStyle],
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

  // Whole-project estimated totals (Tommy: replace the Review Log's flat
  // "shear/load capacity: not yet modeled" line with these) — bearing is a
  // flat per-panel figure (computeStudPackBearingCapacityLb takes no
  // width), summed across every instance with real stud-pack geometry;
  // shear is summed per actual braced instance at ITS OWN tiled width
  // (braced panels aren't all the same size — computePanelSizeShares can
  // give them different widths), not the globally-selected standardWidthIn.
  const estimatedTotalBearingLb = useMemo(() => {
    const perTypeBearingLb: Partial<Record<string, number>> = {
      standard: estimatedStudPackBearingLb,
      braced: estimatedStudPackBearingLb,
      column: estimatedColumnBuiltUpBearingLb,
      corner: estimatedCornerBuiltUpBearingLb,
      "safety-oct-corner": estimatedCornerBuiltUpBearingLb,
    };
    return allInstances.reduce((sum, inst) => sum + (perTypeBearingLb[inst.panelType] ?? 0), 0);
  }, [allInstances, estimatedStudPackBearingLb, estimatedColumnBuiltUpBearingLb, estimatedCornerBuiltUpBearingLb]);
  const estimatedTotalShearLb = useMemo(
    () =>
      allInstances
        .filter((inst) => inst.panelType === "braced")
        .reduce(
          (sum, inst) =>
            sum +
            computeBracedPanelShearCapacityLb(
              buildBracedPanelMembers(inst.widthIn, thicknessIn, wallHeightFt * 12, includeNailer, bracingStyle),
            ),
          0,
        ),
    [allInstances, thicknessIn, wallHeightFt, includeNailer, bracingStyle],
  );

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
          : computeHeaderHeightIn(wallHeightFt * 12, resolvedSillHeightInFor(inst) + resolvedWindowHeightInFor(inst));
      }
      return wallHeightFt * 12;
    };
    const panelWidthInFor = (panelTypeId: string, inst: PanelInstance): number =>
      panelTypeId === "safety-gap" ? SAFETY_GAP_THICKNESS_IN : inst.widthIn;
    const groupKeyFor = (panelTypeId: string, inst: PanelInstance): string => {
      if (panelTypeId === "safety-gap") return panelTypeId;
      const parts = [panelTypeId, inst.widthIn.toFixed(3)];
      if (panelTypeId === "header" || panelTypeId === "sill") {
        parts.push(inst.sourceSlotType ?? "", resolvedWindowHeightInFor(inst).toFixed(3), resolvedSillHeightInFor(inst).toFixed(3));
      }
      return parts.join("|");
    };

    return shopDrawings
      .filter(({ panelType }) => panelType.id !== "gable" && panelType.id !== "jack-stud")
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
          const members =
            membersForPanelTypeId(panelType.id, first.widthIn, first.sourceSlotType, first.windowHeightIn, first.sillHeightIn) ?? [];
          return {
            uniqueKey: `${panelType.id}-${key}`,
            panelType,
            widthIn: panelWidthInFor(panelType.id, first),
            heightIn: panelHeightInFor(panelType.id, first),
            members,
            weightBreakdown: first.weightBreakdown,
            instances: groupInstances.map((inst) => ({
              name: inst.name,
              isSafetyOctCorner: inst.panelType === "safety-oct-corner",
            })),
          };
        });
      });
  }, [shopDrawings, thicknessIn, wallHeightFt, includeNailer, bracingStyle, doorHeaderHeightIn, sillHeightIn]);

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
    if (floorsEnabled && docIsThermalSlabFloor) {
      pages.push({ id: "detail-floor-thermal-slab", label: "Floor: Thermally Broken Slab" });
    }
    if (roofEnabled) {
      if (!secondStoryEnabled) {
        pages.push({ id: "detail-truss-plate", label: "Roof: Truss Plate (Single-Story)" });
      } else {
        pages.push({ id: "detail-box-beam", label: "Roof: Box Beam (Two-Story)" });
      }
      pages.push({ id: "detail-classic-truss", label: "Classic Truss Reference" });
      pages.push({ id: "detail-high-perf-truss", label: "High-Performance Truss" });
    }
    if (wallsEnabled) {
      pages.push({ id: "detail-material-totals", label: "Material Totals" });
      if (footprint && allInstances.length > 0) {
        pages.push({ id: "detail-shipping", label: "Shipping" });
      }
      if (hasClayPlaster || hasLimePlaster) {
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
        // Gable/Jack-Stud: no real placed instances yet (see
        // panelFabricationGroups' own doc comment) — keep the single
        // preview-only page.
        for (const { panelType, instances } of shopDrawings) {
          if (panelType.id !== "gable" && panelType.id !== "jack-stud") continue;
          if (instances.length > 0 || canPreviewAllDetailPages) {
            pages.push({ id: `shop-${panelType.id}`, label: `Shop Drawing: ${panelType.label} (${instances.length})` });
          }
        }
        // Every other type: one page per unique panel (exact copies grouped together).
        for (const group of panelFabricationGroups) {
          const label = group.panelType.id === "braced" ? bracedPanelDisplayLabel(bracingStyle) : group.panelType.label;
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
    secondStoryEnabled,
    shopDrawings,
    panelFabricationGroups,
    role,
    canPreviewAllDetailPages,
    allInstances,
    footprint,
    hasClayPlaster,
    hasLimePlaster,
    floorsEnabled,
    roofEnabled,
    wallsEnabled,
    bracingStyle,
  ]);

  const editorToolsLabel =
    editorTab === "wall" ? "Wall Tools" : editorTab === "foundation" ? "Foundation Tools" : editorTab === "floor" ? "Floor Tools" : "Roof Tools";

  // Sticky-note sections (Tommy: "the other sections... appear as its own
  // sticky note on the screen... make sure we aren't hiding any options") —
  // every section that used to be its own always-visible StrawSection in
  // the scrolling document is now an entry here, opened/closed via the
  // bottom SectionCarousel. `formalDocumentNoteIds` is the subset "Print
  // Packet" covers (the actual printable sheets — Project Summary + every
  // Detail Guide/Shop Drawing page — not the live editing panels like
  // Wall Assembly/Project Totals/Review Log). "Windows" used to be one of
  // these too, but its per-window controls moved into the click-driven
  // "Selected Panel" note (see selectedSlot/handleToggleOpening) — not part
  // of this carousel list at all, since its visibility is driven by
  // selection state rather than being manually toggled open/closed. "Wall
  // Tools" (Tommy:
  // "wall tools sticky note should be a clickable option on the right tool
  // bar") relabels itself to match whichever editor tab is active, same as
  // it always has.
  const allNoteSections = useMemo(
    () => [
      { id: "editor-tools", label: editorToolsLabel },
      { id: "wall-assembly", label: "Wall Assembly" },
      { id: "detail-summary", label: "Project Summary" },
      { id: "project-totals", label: "Project Totals" },
      { id: "review-log", label: "Review Log" },
      ...relevantDetailPages,
    ],
    [editorToolsLabel, relevantDetailPages],
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
    const areaSqFtFor = (type: PanelSlot["type"]) =>
      (allSlots.filter((s) => s.type === type).reduce((sum, s) => sum + s.widthIn, 0) / 12) *
      wallHeightFt;
    return computePrice(
      [
        // No distinct rate given for safety/gap panels — priced at the standard rate (assumption, see Review Log).
        { type: "standard", areaSqFt: areaSqFtFor("standard") + areaSqFtFor("safety-gap") },
        // safety-oct-corner is a fabrication-ID variant of the same corner panel, priced identically.
        { type: "corner", areaSqFt: areaSqFtFor("corner") + areaSqFtFor("safety-oct-corner") },
        { type: "braced", areaSqFt: areaSqFtFor("braced") },
        { type: "opening", areaSqFt: areaSqFtFor("window") + areaSqFtFor("door") },
        { type: "column", areaSqFt: areaSqFtFor("column") },
      ],
      effectivePriceModifier,
    );
  }, [allSlots, wallHeightFt, effectivePriceModifier]);

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
              <input
                type="checkbox"
                checked={roofSystemTypeId === t.id}
                onChange={() => setRoofSystemTypeId(t.id)}
              />{" "}
              {t.label}
            </label>
          ))}
        </div>
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
          onChange={(e) => setWallHeightFt(Number(e.target.value))}
        />
      </label>
      <p className={styles.note}>
        Default 10ft (120in) is Panel Set 1&apos;s confirmed standard panel height.
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
      <div role="group" aria-label="Bracing style" className={styles.toolbar}>
        <button
          type="button"
          aria-pressed={bracingStyle === "chevron"}
          className={bracingStyle === "chevron" ? styles.toolActive : styles.tool}
          onClick={() => setBracingStyle("chevron")}
        >
          Chevron Braced
        </button>
        <button
          type="button"
          aria-pressed={bracingStyle === "hatch-forward"}
          className={bracingStyle === "hatch-forward" ? styles.toolActive : styles.tool}
          onClick={() => setBracingStyle("hatch-forward")}
        >
          Hatch Forward
        </button>
        <button
          type="button"
          aria-pressed={bracingStyle === "hatch-back"}
          className={bracingStyle === "hatch-back" ? styles.toolActive : styles.tool}
          onClick={() => setBracingStyle("hatch-back")}
        >
          Hatch Back
        </button>
      </div>
      <p className={styles.note}>
        Which diagonal-brace pattern every &quot;braced&quot;-typed panel uses, project-wide — Chevron is the
        original &quot;&lt;&quot; shape (both braces meet at the same stud); Hatch Forward (&quot;/&quot;) and Hatch
        Back (&quot;\&quot;) continue one single diagonal slope instead, split at the middle girt row with each
        brace's inner end at the opposite stud from the other. Applies wherever a &quot;braced&quot; panel is
        placed (corner-proximity/seismic spacing under Loose Packed Braced, or &quot;All Braced&quot; under Timber
        Frame Curtain) — has no effect under Square Bale Panels, which never places a braced slot.
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
  const roofMaterialNote = secondStoryEnabled
    ? `Dense-pack cellulose: ${denseCelluloseTotal.volumeFt3.toFixed(2)} ft3, ~${denseCelluloseWeight.weightLb.toFixed(1)} lb (box beam)`
    : `Timber HP: ${timberHpTotal.volumeFt3.toFixed(2)} ft3, ~${timberHpWeight.weightLb.toFixed(1)} lb (truss plate)`;
  const strawBaleSummaryNote =
    panelizationType === "square-bale-panels" ? `${strawBaleCount} bales to purchase (${strawBaleWeightLb.toFixed(1)} lb total, ${STRAW_BALE_WEIGHT_LB} lb/bale)` : null;
  const fastenerWeightNote =
    fastenerTotals.unmodeledLabels.length > 0
      ? `~${fastenerTotals.totalLb.toFixed(1)} lb modeled — not modeled for: ${fastenerTotals.unmodeledLabels.join(", ")}`
      : `~${fastenerTotals.totalLb.toFixed(1)} lb`;
  const plasterFinishes = [hasClayPlaster ? "Clay plaster" : null, hasLimePlaster ? "Lime plaster" : null].filter(
    (v): v is string => v !== null,
  );
  const plasterNote = plasterFinishes.length > 0 ? `${plasterFinishes.join(", ")} selected — weight not yet modeled` : null;

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
            {editorTab === "wall" && viewMode === "plan" && (
              <>
                <div ref={setToolbarPortalNode} className={styles.toolbarPortalInline} />
                <DrawingToolPen
                  value={shapeTool}
                  onChange={setShapeTool}
                  bumpOutDisabled={!footprint}
                  dragWallDisabled={!footprint}
                  editDisabled={!footprint}
                  secondStoryEnabled={secondStoryEnabled}
                  onToggleSecondStory={() => setSecondStoryEnabled((v) => !v)}
                  secondStoryDisabled={!footprint}
                  secondStoryWallHeightFt={secondStoryWallHeightFt}
                  onSecondStoryWallHeightChange={setSecondStoryWallHeightFt}
                />
                <div ref={setToolbarSecondaryPortalNode} className={styles.toolbarPortalInline} />
                <PanelLegend />
              </>
            )}
            {editorTab === "wall" && viewMode === "3d" && (
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

          <div className={styles.editorCanvasLayer}>
            {editorTab === "wall" && (
              <div className={styles.compassDock}>
                <CompassWidget ref={compassNeedleRef} />
              </div>
            )}
            {editorTab === "wall" &&
              (elevationWall ? (
                <WallElevationView
                  wall={elevationWall}
                  slots={overlayWallSlots[elevationWall.id] ?? []}
                  wallHeightFt={wallHeightFt}
                  hasGableEnd={gableEndWallIds.has(elevationWall.id)}
                  ridgeHeightFt={bottomOfTrussMaxHeightFt}
                  targetPanelWidthIn={standardWidthIn}
                  thicknessIn={thicknessIn}
                  jackStudConfig={jackStudConfig}
                  includeNailer={includeNailer}
                  roofCatcherBeamOffsetIn={roofCatcherBeamOffsetIn}
                  roofSystemTypeId={roofSystemTypeId}
                  gablePeakPositionIn={gablePeakPositionInByWallId[elevationWall.id]}
                  gableEndToggleBlockReason={gableEndToggleBlockReason(elevationWall.id)}
                  onToggleGableEnd={(enabled) => handleToggleGableEnd(elevationWall.id, enabled)}
                  onChangeGablePeakPositionIn={(positionIn) => handleChangeGablePeakPositionIn(elevationWall.id, positionIn)}
                  onGenerateShedRoof={() => handleGenerateShedRoof(elevationWall)}
                  onClose={() => setElevationViewWallId(null)}
                />
              ) : viewMode === "plan" ? (
                <FootprintCanvas
                  footprint={footprint}
                  shapeTool={shapeTool}
                  offsetPx={offsetPx}
                  wallSlots={overlayWallSlots}
                  wallStartOffsetIn={wallRenderOffsetIn}
                  wallThicknessIn={thicknessIn}
                  wallHeightFt={wallHeightFt}
                  includeNailer={includeNailer}
                  bracingStyle={bracingStyle}
                  standardWidthIn={standardWidthIn}
                  jackStudConfig={jackStudConfig}
                  leastAccessibleCorner={leastAccessibleCorner}
                  primaryCornerIds={primaryCornerIds}
                  isWallLengthEditable={isWallLengthEditable}
                  onDraw={handleDraw}
                  onToggleOpening={handleToggleOpening}
                  onSetLeastAccessibleCorner={handleSetLeastAccessibleCorner}
                  onEditWallLength={handleEditWallLength}
                  onAddBumpOut={handleAddBumpOut}
                  onDragWall={handleDragWall}
                  toolbarPortalTarget={toolbarPortalNode}
                  secondaryToolbarPortalTarget={toolbarSecondaryPortalNode}
                />
              ) : (
                <Building3DView
                  footprint={footprint}
                  wallSlots={overlayWallSlots}
                  wallHeightFt={wallHeightFt}
                  thicknessIn={thicknessIn}
                  includeNailer={includeNailer}
                  primaryCornerIds={primaryCornerIds}
                  secondStory={secondStoryEnabled ? { wallHeightFt: secondStoryWallHeightFt, wallSlots: overlayWallSlots } : null}
                  isSquareBalePanelization={panelizationType === "square-bale-panels"}
                  squareBaleStudConfig={squareBaleStudConfig}
                  bracingStyle={bracingStyle}
                  nailerOffsetIn={nailerOffsetIn}
                  jackStudConfig={jackStudConfig}
                  standardWidthIn={standardWidthIn}
                  compassRef={compassNeedleRef}
                  simplified={simplified3D}
                  showWraps={showWraps}
                  checkedInteriorIds={checkedInteriorIds}
                  checkedExteriorIds={checkedExteriorIds}
                  tool3D={tool3D}
                  onToggleOpening={(_story, wallId, slotIndex) => handleToggleOpening(wallId, slotIndex)}
                  onSetWindowSillHeight={(_story, wallId, slotIndex, sillHeightIn) => handleSetWindowSillHeight(wallId, slotIndex, sillHeightIn)}
                  onSetWindowHeight={(_story, wallId, slotIndex, heightIn) => handleSetWindowHeight(wallId, slotIndex, heightIn)}
                />
              ))}
            {editorTab === "foundation" && foundationType.usesPierGrid && (
              <FoundationCanvas footprint={footprint} offsetPx={offsetPx} piers={pierGrid} />
            )}
            {editorTab === "floor" && foundationType.usesPierGrid && (
              <FloorCanvas
                footprint={footprint}
                offsetPx={offsetPx}
                floorPanels={floorPanels}
                piers={pierGrid}
                joistLayout={joistLayout}
              />
            )}
          </div>

          {footprint && (
            <BuildingSummaryRender
              footprint={footprint}
              wallSlots={overlayWallSlots}
              wallHeightFt={wallHeightFt}
              thicknessIn={thicknessIn}
              includeNailer={includeNailer}
              primaryCornerIds={primaryCornerIds}
              secondStory={secondStoryEnabled ? { wallHeightFt: secondStoryWallHeightFt, wallSlots: overlayWallSlots } : null}
              isSquareBalePanelization={panelizationType === "square-bale-panels"}
              squareBaleStudConfig={squareBaleStudConfig}
              bracingStyle={bracingStyle}
              nailerOffsetIn={nailerOffsetIn}
              jackStudConfig={jackStudConfig}
              standardWidthIn={standardWidthIn}
              onCapture={handleCaptureRenderImage}
            />
          )}

          <div className={styles.editorRightSpacer} aria-hidden="true" />

          <StickyNote
            id="editor-tools"
            label={editorToolsLabel}
            isOpen={openNoteIds.has("editor-tools")}
            isFullscreen={fullscreenNoteId === "editor-tools"}
            cascadeIndex={noteOpenOrder.indexOf("editor-tools")}
            top={68}
            left={256}
            onClose={() => handleToggleNote("editor-tools")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("editor-tools")}
            onPrint={() => handlePrintNote("editor-tools")}
          >
            {editorTab === "wall" && (
              <>
                <p className={styles.note}>
                  Choose a shape, then click and drag on the canvas to draw the
                  footprint. Drawing a shape (or adding a bump-out) switches to Edit
                  mode automatically.{" "}
                  {footprint && footprintIsAllRightAngles(footprint)
                    ? "In Edit mode, click a corner marker to mark it least-accessible — safety/gap panels re-place to the far end of each wall (this also clears any openings you've placed, since re-tiling re-derives all slots)."
                    : "Every wall owns its own mitered corner panels — the left-most corner of each run (standing outside the shell) is automatically the safety-oct-corner panel, so there's no corner marker to set here."}
                </p>
                {viewMode === "plan" && shapeTool === "bump-out" && (
                  <p className={styles.note}>
                    Drag along a wall to pick the span it attaches to, then drag
                    outward (an addition) or inward (a notch) to set the depth.
                  </p>
                )}
                {viewMode === "plan" && shapeTool === "drag-wall" && (
                  <p className={styles.note}>
                    Drag a wall to move it — its 2 neighbor walls stretch or
                    shrink to absorb the change; everything else stays fixed.
                    {footprint && !footprintIsAllRightAngles(footprint)
                      ? " On an octagon, only the 4 straight walls can be dragged (the mitered corners can't)."
                      : ""}
                  </p>
                )}
                {viewMode === "3d" && (
                  <p className={styles.note}>
                    Drag to orbit, scroll to zoom — a rough bird&apos;s-eye starting
                    angle, not a fixed camera. Every wall panel — including window/door
                    openings (header, jack studs, and sill) — shows its real member
                    geometry at its actual position and width. No roof surface yet.
                  </p>
                )}
                {viewMode === "plan" && (
                  <p className={styles.note}>
                    {shapeTool === "edit"
                      ? "Click a panel to cycle it: standard → window → door → column → standard."
                      : "Switch to Edit mode, then click a panel to cycle it: standard → window → door → column → standard."}{" "}
                    See the legend to the left for what each panel color means — a panel hashed
                    orange over purple is a safety/gap panel combined with a corner brace (both
                    roles, one panel). Panel labels are named by compass direction
                    (N/NE/E/SE/S/SW/W/NW) — up is treated as North (no real site
                    orientation set yet).{" "}
                    {isBumpedOut ? (
                      <>Red circle = least-accessible corner. Click a wall&apos;s
                        length label to type an exact value — editing one wall moves
                        its far corner and shifts the next wall to match, leaving
                        the rest of the shape in place.</>
                    ) : footprint?.corners.length === 4 ? (
                      <>Red circle = least-accessible corner. Click a wall&apos;s
                        length label to type an exact value (e.g. 40 or
                        40&apos;-6&quot;) — editing one wall resizes the whole
                        rectangle since opposite walls stay equal.</>
                    ) : footprint && footprintIsAllRightAngles(footprint) ? (
                      "Red circle = least-accessible corner."
                    ) : (
                      <>Click a straight wall&apos;s length label to resize it — the
                        parallel wall changes to match. The 4 mitered corner walls
                        aren&apos;t independently editable yet.</>
                    )}{" "}
                    Or switch to Drag Wall and drag a wall directly instead of
                    typing a length.
                  </p>
                )}
              </>
            )}
            {editorTab === "foundation" && (
              <>
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
                      {pierGrid.length} piers derived from the footprint above at max {pierSpacingFt}ft spacing (
                      {foundationType.label}). See Detail Guide Pages below for the full load path.
                    </p>
                  </>
                ) : foundationType.loadPath.length > 0 ? (
                  <p className={styles.note}>
                    {foundationType.label} doesn&apos;t use a pier grid — see the Detail Guide Pages section below for
                    its construction detail.
                  </p>
                ) : (
                  <p className={styles.pending}>
                    {foundationType.label} doesn&apos;t use a pier grid, and its construction isn&apos;t modeled yet —
                    {" "}
                    {foundationType.vaporNote}
                  </p>
                )}
              </>
            )}
            {editorTab === "floor" && (
              <>
                {foundationType.usesPierGrid ? (
                  <>
                    <p className={styles.note}>
                      {floorPanels.length} floor panels tiled pier-to-pier at max {pierSpacingFt}ft spacing — same
                      spacing as the Foundation tab (change it there, not here).
                    </p>
                    {joistLayout && (
                      <p className={styles.note}>
                        {joistLayout.joists.length} {floorJoistType!.label} joists running perpendicular to the
                        longest walls (perimeter-to-perimeter, or perimeter-to-beam over the piers). See the Detail
                        Guide Pages section below for the rim/thermal-break detail.
                      </p>
                    )}
                  </>
                ) : isThermalSlabFloor ? (
                  <p className={styles.note}>
                    Thermally Broken Slab floor selected — the slab is both the foundation and the floor system, so
                    there&apos;s no separate floor panel/joist layout to draw. See the Detail Guide Pages section below
                    for the full thermal-break detail.
                  </p>
                ) : foundationType.loadPath.length > 0 ? (
                  <p className={styles.note}>
                    {foundationType.label} doesn&apos;t use a pier grid, so there&apos;s no pier-to-pier floor panel
                    bay to derive yet — see the Detail Guide Pages section below for its construction detail.
                  </p>
                ) : (
                  <p className={styles.pending}>
                    {foundationType.label} doesn&apos;t use a pier grid, so there&apos;s no pier-to-pier floor panel
                    bay to derive yet, and its construction isn&apos;t modeled yet — {foundationType.vaporNote}
                  </p>
                )}
              </>
            )}
            {editorTab === "roof" && (
              <>
                <p className={styles.note}>{roofSystemTypes.find((t) => t.id === roofSystemTypeId)!.description}</p>

                <label>
                  Bottom of truss max height (ft){" "}
                  <input
                    type="number"
                    value={bottomOfTrussMaxHeightFt}
                    step={0.5}
                    onChange={(e) => setBottomOfTrussMaxHeightFt(Number(e.target.value))}
                  />
                </label>
                <p className={styles.note}>
                  The ridge/peak height of the roof&apos;s bottom bearing line — a Gable End Panel&apos;s high edge
                  rises to meet this number (see the Gable End Panel Shop Drawing page below).
                </p>

                <div role="group" aria-label="Bottom edge reference" className={styles.toolbar}>
                  <span style={{ fontSize: 13, marginRight: 4 }}>Bottom edge reference:</span>
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
                </div>
                <p className={styles.note}>
                  How far the truss bottom / roof-catcher beam sits inset from the adjacent wall&apos;s primary
                  (exterior/floor-plan-line) edge. {trussPlateInsetDefaultIn.note}
                </p>

                <p className={styles.pending}>{roofBearingMemberNote}</p>

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
                      <select
                        value={roofCatcherBeamShape}
                        onChange={(e) => setRoofCatcherBeamShape(e.target.value as RoofCatcherBeamShape)}
                      >
                        {roofCatcherBeamShapeOptions.map((shape) => (
                          <option key={shape} value={shape}>
                            {shape}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className={styles.note}>
                      Column Panel height at a roof-catcher-beam bearing point = bottom-of-truss max height minus this
                      offset ({computeGableColumnHeightIn(bottomOfTrussMaxHeightFt * 12, roofCatcherBeamOffsetIn).toFixed(1)}
                      in at the current inputs) — see the Column Panel Shop Drawing page below.
                    </p>

                    {(() => {
                      const gableWallIds = [...gableEndWallIds];
                      const ridge =
                        footprint && gableWallIds.length === 2
                          ? computeRidgeLine(footprint, gableWallIds[0]!, gableWallIds[1]!, gablePeakPositionInByWallId)
                          : null;
                      if (!ridge) {
                        return (
                          <p className={styles.note}>
                            Add Gable End to exactly 2 (opposite) walls — see that wall&apos;s elevation view (Wall
                            tab&apos;s view-mode dial) — to compute a real roof-catcher-beam run from the footprint.
                          </p>
                        );
                      }
                      const segments = computeRoofCatcherBeamSegments(ridge.runIn);
                      const postPositionsIn = computeRoofCatcherBeamPostPositions(ridge.runIn);
                      const piers = footprint ? computePierGrid(footprint, pierSpacingFt) : [];
                      const postPoints = postPositionsIn.map((posIn) => pointAlongRidgeLine(ridge, posIn));
                      return (
                        <p className={styles.note}>
                          Run: {(ridge.runIn / 12).toFixed(1)}ft between {gableWallIds[0]} and {gableWallIds[1]}
                          &apos;s Column Panels — {segments.length} built-up 3-ply 2x12 beam segment
                          {segments.length === 1 ? "" : "s"} ({segments[0]!.spanIn.toFixed(1)}in each, max 144in/12ft).{" "}
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
                      8 mitered 1-3/4in x 14in LVL segments (on edge), one per compass direction, forming a closed
                      ring — a compression ring near the roof&apos;s apex for an octagon roof, sized independently of
                      the building&apos;s own (much larger) footprint. &quot;Outside diameter&quot; is the flat-to-flat
                      distance across the ring (the standard way octagonal hardware/rings are sized), not
                      point-to-point across the corners. Miters (22.5deg at each of the 8 corners) are simplified to
                      straight boxes here, not true beveled geometry.
                    </p>
                  </>
                )}
              </>
            )}
          </StickyNote>
        </div>

        {selectedSlot &&
          (() => {
            const slot = baseWallSlots[selectedSlot.wallId]?.[selectedSlot.slotIndex];
            if (!slot) return null;
            const { wallId, slotIndex } = selectedSlot;
            return (
              <StickyNote
                id="selected-panel"
                label={`Panel: ${wallId} #${slotIndex} — ${PANEL_TYPE_LABELS[slot.type]}`}
                isOpen
                isFullscreen={fullscreenNoteId === "selected-panel"}
                cascadeIndex={0}
                onClose={() => setSelectedSlot(null)}
                onToggleFullscreen={() => handleToggleNoteFullscreen("selected-panel")}
              >
                {slot.type === "window" ? (
                  <>
                    <WindowSizeDiagram
                      wallHeightFt={wallHeightFt}
                      windowWidthIn={slot.widthIn}
                      sillHeightIn={slot.sillHeightIn ?? sillDefaultHeightIn.value}
                      windowHeightIn={slot.heightIn ?? standardWindowHeightDefaultIn.value}
                      thicknessIn={thicknessIn}
                      jackStudConfig={jackStudConfig}
                      includeNailer={includeNailer}
                      standardWidthIn={standardWidthIn}
                      onSetSillHeight={(v) => handleSetWindowSillHeight(wallId, slotIndex, v)}
                      onSetWindowHeight={(v) => handleSetWindowHeight(wallId, slotIndex, v)}
                    />
                    {sillClampNotice && (
                      <p className={styles.note} style={{ color: "#a67c00" }}>
                        {sillClampNotice}
                      </p>
                    )}
                    <label style={{ display: "block", marginTop: 6 }}>
                      Width{" "}
                      <select
                        id={`window-size-${wallId}-${slotIndex}`}
                        value={slot.widthIn}
                        onChange={(e) => handleSetWindowWidth(wallId, slotIndex, Number(e.target.value))}
                      >
                        {standardWindowWidthsIn.value.map((w) => (
                          <option key={w} value={w}>
                            {w}&quot;
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className={styles.note}>
                      Changing width can shift neighboring panels on this wall (the wall re-tiles around it); height
                      and sill (above) never do — they're a purely vertical/Z-axis change.
                    </p>
                    <label style={{ display: "block" }}>
                      Height (preset){" "}
                      <select
                        id={`window-height-${wallId}-${slotIndex}`}
                        title="This window's own Rough Opening height (sill-top to header-bottom) — also draggable above"
                        value={slot.heightIn ?? standardWindowHeightsIn.value[0]}
                        onChange={(e) => handleSetWindowHeight(wallId, slotIndex, Number(e.target.value))}
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
                        value={slot.sillHeightIn ?? sillHeaderHeightInRange.minIn}
                        min={sillHeaderHeightInRange.minIn}
                        max={sillHeaderHeightInRange.maxIn}
                        step={0.125}
                        style={{ width: 64 }}
                        onChange={(e) => handleSetWindowSillHeight(wallId, slotIndex, Number(e.target.value))}
                      />
                    </label>
                  </>
                ) : (
                  <p className={styles.note}>
                    {PANEL_TYPE_LABELS[slot.type]} panel, {slot.widthIn.toFixed(1)}in wide.
                    {slot.type === "column" ? " Column Panels are always fabricated at a fixed width, not adjustable here." : ""}
                    {slot.type === "standard" || slot.type === "door"
                      ? " Click it again on the canvas to cycle its type."
                      : ""}
                  </p>
                )}
              </StickyNote>
            );
          })()}

        <StickyNote
          id="wall-assembly"
          label="Wall Assembly"
          isOpen={openNoteIds.has("wall-assembly")}
          isFullscreen={fullscreenNoteId === "wall-assembly"}
          cascadeIndex={noteOpenOrder.indexOf("wall-assembly")}
          onClose={() => handleToggleNote("wall-assembly")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("wall-assembly")}
          onPrint={() => handlePrintNote("wall-assembly")}
        >
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
        </StickyNote>

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
          priceNote="Priced per panel type (standard/corner/braced/opening rates), see Review Log."
          carbonSequesteredLb={carbonRange.atStandardMoisture.carbonLb}
          carbonSequesteredKg={carbonRange.atStandardMoisture.carbonKg}
          netCO2eKg={embodiedCarbon.netCO2eKg}
          netCO2eNote={`Straw sequestered: +${embodiedCarbon.strawCO2eKg.toFixed(1)} kg CO2e. Concrete embodied: −${embodiedCarbon.concreteCO2eKg.toFixed(1)} kg CO2e.`}
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
          fastenerWeightNote={fastenerWeightNote}
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
                    — priced per panel type (standard/corner/braced/opening rates), see Review Log
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

        {!secondStoryEnabled && (
          <StickyNote
            id="detail-truss-plate"
            label="Roof: Truss Plate (Single-Story)"
            isOpen={openNoteIds.has("detail-truss-plate")}
            isFullscreen={fullscreenNoteId === "detail-truss-plate"}
            cascadeIndex={noteOpenOrder.indexOf("detail-truss-plate")}
            onClose={() => handleToggleNote("detail-truss-plate")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-truss-plate")}
            onPrint={() => handlePrintNote("detail-truss-plate")}
          >
            <DetailGuidePage
              title="Truss Plate — Single-Story Roof Bearing"
              triggerCondition="Single-story buildings (Second Story not enabled on the Wall tab) — the roof-bearing member on top of the wall panels."
              diagram={
                <StandardPanel3DView
                  members={trussPlatePreviewMembers}
                  overallDimensions={{ heightIn: PLATE_2X6_THICKNESS_IN + 0.75, widthIn: ASSEMBLY_PREVIEW_LENGTH_IN, depthIn: thicknessIn }}
                  displayName="Truss Plate"
                />
              }
              fastenerSchedule={[]}
              notes={[
                "3D model above is an illustrative 10ft segment, not full building length. 2x4 along the interior wythe, 2x6 along the exterior wythe (its own 5.5in width doubles as the Roof tab's truss plate inset), both capped by one continuous 3/4in plywood top skin.",
                `Timber HP fills the open cavity under the plywood cap, between the 2x4 and 2x6 (${timberHpTotal.gapWidthIn.toFixed(2)}in wide x 1.5in tall) — across the drawn footprint's full ${(totalWallPerimeterIn / 12).toFixed(1)}ft wall perimeter: ${timberHpTotal.volumeFt3.toFixed(2)} ft3, ~${timberHpWeight.weightLb.toFixed(1)} lb (${timberHpWeight.weightKg.toFixed(1)} kg) at ${timberHpDensityLbFt3.value} lb/ft3.`,
                timberHpDensityLbFt3.note,
              ]}
              role={role}
            />
          </StickyNote>
        )}

        {secondStoryEnabled && (
          <StickyNote
            id="detail-box-beam"
            label="Roof: Box Beam (Two-Story)"
            isOpen={openNoteIds.has("detail-box-beam")}
            isFullscreen={fullscreenNoteId === "detail-box-beam"}
            cascadeIndex={noteOpenOrder.indexOf("detail-box-beam")}
            onClose={() => handleToggleNote("detail-box-beam")}
            onToggleFullscreen={() => handleToggleNoteFullscreen("detail-box-beam")}
            onPrint={() => handlePrintNote("detail-box-beam")}
          >
            <DetailGuidePage
              title="Box Beam — Two-Story Roof Bearing"
              triggerCondition="Two-story buildings (Second Story enabled on the Wall tab) — the roof-bearing member on top of the second story's wall panels."
              diagram={
                <StandardPanel3DView
                  members={boxBeamPreviewMembers}
                  overallDimensions={{ heightIn: 2 * BOX_BEAM_CAP_THICKNESS_IN + BOX_BEAM_LVL_HEIGHT_IN, widthIn: ASSEMBLY_PREVIEW_LENGTH_IN, depthIn: thicknessIn }}
                  displayName="Box Beam"
                />
              }
              fastenerSchedule={[]}
              notes={[
                "3D model above is an illustrative 10ft segment, not full building length. Two 9in x 2in LVL webs (exterior + interior wythe edges) capped top and bottom by 3/4in plywood — a hollow box, blown in with dense-pack cellulose.",
                `Across the drawn footprint's full ${(totalWallPerimeterIn / 12).toFixed(1)}ft wall perimeter: ${denseCelluloseTotal.volumeFt3.toFixed(2)} ft3, ~${denseCelluloseWeight.weightLb.toFixed(1)} lb (${denseCelluloseWeight.weightKg.toFixed(1)} kg) at ${densePackCelluloseDensityLbFt3.value} lb/ft3.`,
                densePackCelluloseDensityLbFt3.note,
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
              "Roof-bearing assembly (Truss Plate/Box Beam) and Gable/Column preview-only members aren't included in the board-feet total yet — only real, placed panel instances are.",
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
              "Stacks pack row by row across the trailer's own width using each stack's own real width (Tommy: \"its very very handy to be able to have 2 rows of panels\") — 2 or more narrower stacks share a row whenever they both fit, rather than every stack being forced into one lane sized to the single widest stack anywhere.",
              "Jack studs ship as their own loose-lumber bundle (Tommy: \"jack studs can be piled up together and stacked 90 degrees hot dog rotation\") — thin sheets or 2x4 sticks piled face-to-face using their own real thickness, not the wall's own much thicker cross-section, so far more of them stack in the same trailer height.",
              shippingRatePerMileDefault.note ?? "",
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
            triggerCondition="Interior finish = Clay plaster and/or exterior finish = Lime plaster (Panelizer > Wall Assembly) — total plaster materials, purchase units, and price."
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
                          — {plasterGrossWallAreaSqFt.toFixed(1)} sqft gross wall{secondStoryEnabled ? " (both stories)" : ""} minus{" "}
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
            ]}
            role={role}
          />
        </StickyNote>

        <StickyNote
          id="detail-classic-truss"
          label="Classic Truss Reference"
          isOpen={openNoteIds.has("detail-classic-truss")}
          isFullscreen={fullscreenNoteId === "detail-classic-truss"}
          cascadeIndex={noteOpenOrder.indexOf("detail-classic-truss")}
          onClose={() => handleToggleNote("detail-classic-truss")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-classic-truss")}
          onPrint={() => handlePrintNote("detail-classic-truss")}
        >
          <DetailGuidePage
            title={`Classic Truss Reference — ${selectedClassicTruss.label}`}
            triggerCondition="Always available — a standalone reference gallery of classic truss profiles, independent of this project's own drawn footprint/roof (see the Roof tab's Truss Plate for the actual roof-bearing member this app models)."
            diagram={
              <>
                <div role="group" aria-label="Classic truss type" className={styles.toolbar}>
                  {CLASSIC_TRUSS_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={selectedClassicTrussId === t.id}
                      className={selectedClassicTrussId === t.id ? styles.toolActive : styles.tool}
                      onClick={() => setSelectedClassicTrussId(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <TrussPreview trussType={selectedClassicTruss} />
              </>
            }
            fastenerSchedule={[]}
            notes={[
              CLASSIC_TRUSS_DISCLAIMER,
              selectedClassicTruss.description,
              `Shown at a representative ${Math.round(selectedClassicTruss.defaultSpanIn / 12)}ft span — chords are 2x6, web/post members are 2x4, all a single ~1.5in-thick flat truss unit (no metal plate connectors modeled).`,
              "Every chord/web angle-cut end is simplified to a straight tilted box, not true beveled geometry — same simplification as every other diagonal brace in this app.",
            ]}
            role={role}
          />
        </StickyNote>

        <StickyNote
          id="detail-high-perf-truss"
          label="High-Performance Truss"
          isOpen={openNoteIds.has("detail-high-perf-truss")}
          isFullscreen={fullscreenNoteId === "detail-high-perf-truss"}
          cascadeIndex={noteOpenOrder.indexOf("detail-high-perf-truss")}
          onClose={() => handleToggleNote("detail-high-perf-truss")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("detail-high-perf-truss")}
          onPrint={() => handlePrintNote("detail-high-perf-truss")}
        >
          {(() => {
            const bearingShape = HIGH_PERF_TRUSS_BEARING_SHAPES.find((b) => b.id === highPerfTrussBearingShapeId)!;
            const schema =
              highPerfTrussTypeId === "energy-heel"
                ? buildEnergyHeelTrussSchema(HIGH_PERF_TRUSS_DEFAULT_SPAN_IN, highPerfTrussPitchIn12, highPerfTrussCavityDepthIn, highPerfTrussBearingShapeId)
                : buildParallelChordTrussSchema(HIGH_PERF_TRUSS_DEFAULT_SPAN_IN, highPerfTrussPitchIn12, highPerfTrussCavityDepthIn, highPerfTrussBearingShapeId);
            return (
              <DetailGuidePage
                title={schema.displayName}
                triggerCondition="Always available — a standalone, adjustable high-performance roof truss reference (energy/raised heel for a deep, uncompressed insulation cavity), independent of this project's own drawn footprint/roof."
                diagram={
                  <>
                    <div role="group" aria-label="High-performance truss type" className={styles.toolbar}>
                      <button
                        type="button"
                        aria-pressed={highPerfTrussTypeId === "energy-heel"}
                        className={highPerfTrussTypeId === "energy-heel" ? styles.toolActive : styles.tool}
                        onClick={() => setHighPerfTrussTypeId("energy-heel")}
                      >
                        Energy-Heel (Gable)
                      </button>
                      <button
                        type="button"
                        aria-pressed={highPerfTrussTypeId === "parallel-chord"}
                        className={highPerfTrussTypeId === "parallel-chord" ? styles.toolActive : styles.tool}
                        onClick={() => setHighPerfTrussTypeId("parallel-chord")}
                      >
                        Parallel Chord (Shed)
                      </button>
                    </div>
                    <label>
                      Pitch{" "}
                      <select value={highPerfTrussPitchIn12} onChange={(e) => setHighPerfTrussPitchIn12(Number(e.target.value))}>
                        {Array.from({ length: HIGH_PERF_TRUSS_MAX_PITCH_IN12 - HIGH_PERF_TRUSS_MIN_PITCH_IN12 + 1 }, (_, i) => HIGH_PERF_TRUSS_MIN_PITCH_IN12 + i).map((p) => (
                          <option key={p} value={p}>
                            {p}/12
                          </option>
                        ))}
                      </select>
                    </label>
                    <div role="group" aria-label="Insulation cavity depth" className={styles.toolbar}>
                      {HIGH_PERF_TRUSS_CAVITY_DEPTH_OPTIONS_IN.map((d) => (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={highPerfTrussCavityDepthIn === d}
                          className={highPerfTrussCavityDepthIn === d ? styles.toolActive : styles.tool}
                          onClick={() => setHighPerfTrussCavityDepthIn(d)}
                        >
                          {formatLengthIn(d, unitSystem)} cavity
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
                    <HighPerfTrussPreview
                      trussTypeId={highPerfTrussTypeId}
                      spanIn={HIGH_PERF_TRUSS_DEFAULT_SPAN_IN}
                      pitchIn12={highPerfTrussPitchIn12}
                      cavityDepthIn={highPerfTrussCavityDepthIn}
                      bearingShapeId={highPerfTrussBearingShapeId}
                    />
                  </>
                }
                fastenerSchedule={[]}
                notes={[
                  ...schema.notes.map((n) => n.text),
                  `Shown at a representative ${Math.round(HIGH_PERF_TRUSS_DEFAULT_SPAN_IN / 12)}ft span — chords are 2x6, web/heel-post members are 2x4, matching the Classic Truss Reference gallery's own convention.`,
                  `Bearing shown: ${bearingShape.label}, ${formatLengthIn(bearingShape.depthIn, unitSystem)} deep — this is a visualization only; it doesn't change the wall's own real roof-bearing member (see the Roof tab's Truss Plate/Box Beam).`,
                ]}
                role={role}
              />
            );
          })()}
        </StickyNote>

        {role !== "public" && (
          <>
            {shopDrawings
              .filter(({ panelType }) => panelType.id === "gable" || panelType.id === "jack-stud")
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
                    panelType.id === "gable" ? (
                      <div>
                        <StandardPanel3DView
                          members={gablePanelMembers}
                          overallDimensions={{ heightIn: gablePreviewHighEdgeHeightIn, widthIn: standardWidthIn, depthIn: thicknessIn }}
                          displayName={panelType.label}
                        />
                        <p className={styles.note}>
                          Preview only, at the Roof tab&apos;s current inputs (low/eave edge {gablePreviewLowEdgeHeightIn}
                          &quot;, high/ridge edge {gablePreviewHighEdgeHeightIn.toFixed(1)}&quot;) — real instances will
                          take manual per-instance edge heights once there&apos;s a layout mechanism to place them (see
                          the elevation view). Top skin rip: {gableRipCallout.angleDeg.toFixed(2)}
                          &deg;, {gableRipCallout.lengthIn.toFixed(2)}&quot; long.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <StandardPanel3DView
                          members={jackStudMembers}
                          overallDimensions={{ heightIn: jackStudPreviewHeightIn, widthIn: jackStudThicknessIn(jackStudConfig), depthIn: thicknessIn }}
                          displayName={panelType.label}
                        />
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
                      </div>
                    )
                  }
                  estimatedBearingLb={panelType.id === "gable" ? estimatedStudPackBearingLb : undefined}
                  instances={instances}
                  role={role}
                />
                <p className={styles.note}>
                  Preview-only (3D model + illustrative default dimensions) — not placed anywhere in the current
                  layout system yet: gable needs the not-yet-built roof/ridge system to supply real per-instance
                  edge heights, and jack studs need a real rough-opening height, which headers/sills don&apos;t
                  track yet either. Inclined/Gable (roof-slope) and floor/roof panels don&apos;t exist as modeled
                  panel systems yet either — all deferred until those systems are built.
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
              const displayLabel = group.panelType.id === "braced" ? bracedPanelDisplayLabel(bracingStyle) : group.panelType.label;
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
