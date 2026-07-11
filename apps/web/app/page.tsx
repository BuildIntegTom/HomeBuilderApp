"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyBracedPlacement,
  applyUniformPanelization,
  buildOctagonFootprint,
  buildRectangleFootprint,
  computeFloorPanelGrid,
  computeJoistLayout,
  computePierGrid,
  cornerOwnership as cornerOwnershipPure,
  dragWall,
  editWallLength,
  footprintIsAllRightAngles,
  gapEndFor,
  getOpeningAnchors,
  insertBumpOut,
  isMiteredShape,
  markSafetyCorner,
  retile as retilePure,
  retileWithOpenings,
  wallGeometryFor as wallGeometryForPure,
  type CornerId,
  type Footprint,
  type PanelSlot,
  type Wall,
} from "@building-integrity/geometry";
import {
  computeAssemblyPerm,
  computeBracedPanelShearCapacityLb,
  computeBuiltUpColumnBearingCapacityLb,
  computeCarbonRange,
  computeConcretePierVolume,
  computeFastenerWeight,
  computeInsulationWeight,
  computeJackStudFastenerWeight,
  computeNetEmbodiedCarbonCO2e,
  computePanelWeightBreakdown,
  computePrice,
  computeStandardPanelWoodWeight,
  computeStrawWeight,
  computeStudPackBearingCapacityLb,
  toReviewLog,
  validateVaporOpenness,
  type Season,
} from "@building-integrity/calc-engine";
import {
  bomWidthMismatchWarning,
  BOX_BEAM_CAP_THICKNESS_IN,
  BOX_BEAM_LVL_HEIGHT_IN,
  buildBoxBeamMembers,
  buildBracedPanelMembers,
  buildColumnPanelMembers,
  buildCornerPanelMembers,
  buildGablePanelMembers,
  buildJackStudMembers,
  buildSafetyGapMembers,
  buildSquareBalePanelMembers,
  buildStandardPanelMembers,
  buildTrussPlateMembers,
  JACK_STUD_THICKNESS_IN,
  SAFETY_GAP_THICKNESS_IN,
  PLATE_2X6_THICKNESS_IN,
  carbonFractionOfDryMass,
  COLUMN_TOTAL_WIDTH_IN,
  computeDensePackCelluloseVolume,
  computeGableColumnHeightIn,
  computeGableRipCallout,
  computePanelSizeShares,
  computePlywoodAreaSqFt,
  computeTimberHpVolume,
  DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN,
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
  floorLongSideBlockingNote,
  floorRimJoistDetail,
  foundationFastenerSchedule,
  foundationTypes,
  looseDensePackDefaultThicknessIn,
  looseDensePackThicknessOptionsIn,
  looseDensePackWidthIn,
  panelTypes,
  perpendicular2x4Addition,
  pierSpacingDefaultFt,
  pierSpacingOptionsFt,
  pierSpacingStatus,
  priceRates,
  referenceDensities,
  roofCatcherBeamShapeDefault,
  roofCatcherBeamShapeOptions,
  roofBearingMemberNote,
  roofSystemTypes,
  slabFoundationDimensions,
  squareBalePanel,
  seismicBracedPanelSpacingFt,
  standardPanelBom,
  standardPanelBomReferenceWidthIn,
  standardPanelHeightIn,
  standardWindowWidthsIn,
  strawMoistureContent,
  targetDensityKgM3,
  timberHpDensityLbFt3,
  trussPlateInsetDefaultIn,
  wallAssemblyLayers,
  type RoofCatcherBeamShape,
  type RoofSystemType,
  type SeismicZone,
  type StudConfig,
} from "@building-integrity/panel-catalog";
import ConcreteBlockStemWallDiagram from "./ConcreteBlockStemWallDiagram";
import DetailGuidePage from "./DetailGuidePage";
import FloorAddOnLayerDiagram from "./FloorAddOnLayerDiagram";
import FloorAssemblyDiagram from "./FloorAssemblyDiagram";
import FloorCanvas from "./FloorCanvas";
import FloorCornerDetailDiagram from "./FloorCornerDetailDiagram";
import FloorJoistDiagram from "./FloorJoistDiagram";
import FoundationCanvas from "./FoundationCanvas";
import { allPanelInstances, type NamedPanelType } from "./panelInstances";
import PierFoundationDiagram from "./PierFoundationDiagram";
import { parseProjectFile, serializeProject, type ProjectState } from "./projectFile";
import RubbleTrenchDiagram from "./RubbleTrenchDiagram";
import ShopDrawingPage from "./ShopDrawingPage";
import BuildingSummaryRender from "./BuildingSummaryRender";
import CompassWidget from "./CompassWidget";
import { DocumentMetaProvider } from "./DocumentMetaContext";
import DrawingToolPen from "./DrawingToolPen";
import EditorToolbar from "./EditorToolbar";
import PanelLegend from "./PanelLegend";
import ProjectSummaryPage from "./ProjectSummaryPage";
import SectionCarousel from "./SectionCarousel";
import SlabFoundationDiagram from "./SlabFoundationDiagram";
import StickyNote from "./StickyNote";
import TopBar from "./TopBar";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import WallElevationView from "./WallElevationView";
import styles from "./page.module.css";

const FootprintCanvas = dynamic(() => import("./FootprintCanvas"), { ssr: false });
const Building3DView = dynamic(() => import("./Building3DView"), { ssr: false });
const StandardPanel3DView = dynamic(() => import("./StandardPanel3DView"), { ssr: false });

const BEARING_ELIGIBLE_TYPES = new Set(["standard", "corner", "safety-oct-corner", "braced", "column"]);
const STRAW_BALE_WEIGHT_LB = 40;
const KG_TO_LB = 2.20462;
const LB_FT3_TO_KG_M3 = 16.018463;

const interiorLayers = wallAssemblyLayers.filter((l) => l.side === "interior");
const exteriorLayers = wallAssemblyLayers.filter((l) => l.side === "exterior");

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
  hasWoodBom: boolean;
}[] = [
  { namedTypes: ["standard"], panelTypeId: "standard", hasWoodBom: true },
  { namedTypes: ["corner", "safety-oct-corner"], panelTypeId: "corner", hasWoodBom: false },
  { namedTypes: ["braced"], panelTypeId: "braced", hasWoodBom: true },
  { namedTypes: ["safety-gap"], panelTypeId: "safety-gap", hasWoodBom: false },
  { namedTypes: ["header"], panelTypeId: "header", hasWoodBom: false },
  { namedTypes: ["sill"], panelTypeId: "sill", hasWoodBom: false },
  { namedTypes: ["column"], panelTypeId: "column", hasWoodBom: false },
  // Gable End Panel isn't placeable anywhere in the layout yet (no roof/
  // ridge system exists) — namedTypes: [] means it always shows 0 real
  // instances, but it still gets a preview 3D model + rip-angle callout
  // below, built at illustrative default heights.
  { namedTypes: [], panelTypeId: "gable", hasWoodBom: false },
  // Plywood Jack Stud is always derived from a header/sill opening, never
  // its own placed slot — namedTypes: [] for the same reason as gable.
  { namedTypes: [], panelTypeId: "jack-stud", hasWoodBom: false },
];

const SHOP_DRAWING_BOM_PARTS = [
  { label: "Bottom plate skin (plywood)", qty: standardPanelBom.bottomPlateSkin.qty, dimensions: `${standardPanelBom.bottomPlateSkin.thicknessIn}"x${standardPanelBom.bottomPlateSkin.widthIn}"x${standardPanelBom.bottomPlateSkin.lengthIn}"` },
  { label: "Bottom plate 2x4s", qty: standardPanelBom.bottomPlate2x4s.qty, dimensions: `2x4 x ${standardPanelBom.bottomPlate2x4s.lengthIn}"` },
  { label: "Top plate assembly", qty: standardPanelBom.topPlateAssembly.qty, dimensions: "Mirrors bottom plate (1 skin + 2x 2x4s), inverted" },
  { label: "Studs", qty: standardPanelBom.studs.qty, dimensions: `2x4 x ${standardPanelBom.studs.lengthIn}"` },
  { label: "Girt block", qty: standardPanelBom.girts.qty, dimensions: `2x4 x ${standardPanelBom.girts.block.lengthIn}"` },
  { label: "Girt web (plywood)", qty: standardPanelBom.girts.qty, dimensions: `${standardPanelBom.girts.web.thicknessIn}"x${standardPanelBom.girts.web.widthIn}"x${standardPanelBom.girts.web.lengthIn}"` },
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
  const [interiorId, setInteriorId] = useState(interiorLayers[1]!.id);
  const [exteriorId, setExteriorId] = useState(exteriorLayers[1]!.id);
  const [season, setSeason] = useState<Season>("winter");

  const [seismicZone, setSeismicZone] = useState<SeismicZone>("moderate");
  const [foundationTypeId, setFoundationTypeId] = useState(foundationTypes[0]!.id);
  const [pierSpacingFt, setPierSpacingFt] = useState<number>(pierSpacingDefaultFt);
  const [zipCode, setZipCode] = useState("");
  // Title-block metadata (Tommy: "title block stuff on the right side...
  // project, site, date, etc.") — projectName is the only genuinely new
  // input; site label and date are derived from state that already exists.
  const [projectName, setProjectName] = useState("Untitled Project");
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

  // Per-wall elevation view (Tommy: "an arrow button for each wall section,
  // where we can see the whole line up still in 2d view") — additive to the
  // existing ground-floor PanelSlot[] row, not a replacement for it.
  // gableEndWallIds tracks which walls have a Gable End tiled on top;
  // elevationViewWallId is which wall's elevation view is currently open
  // (only one at a time).
  const [gableEndWallIds, setGableEndWallIds] = useState<Set<string>>(new Set());
  const [elevationViewWallId, setElevationViewWallId] = useState<string | null>(null);
  const handleToggleGableEnd = (wallId: string, enabled: boolean) => {
    setGableEndWallIds((was) => {
      const next = new Set(was);
      if (enabled) next.add(wallId);
      else next.delete(wallId);
      return next;
    });
  };

  // Second story (Tommy: "add a second level of panels") — shares the
  // ground floor's footprint/panel layout for now (a fully independent
  // per-story footprint/opening editor isn't wired up yet, see the
  // gable-multistory-roof-strategy memory), stacked at the ground floor's
  // own top-plate height in the 3D Preview + whole-building OBJ export.
  const [secondStoryEnabled, setSecondStoryEnabled] = useState(false);
  const [secondStoryWallHeightFt, setSecondStoryWallHeightFt] = useState(10);

  // Panelization type (Tommy: "categorize panelization types... three to
  // start with") — governs how plain wall infill (standard/braced/
  // safety-gap) is tiled; corners/columns/openings are unaffected in every
  // type, since they're structural/functional necessities regardless of
  // infill construction choice.
  // - loose-packed-braced: today's existing tiling/bracing system, unchanged.
  // - square-bale-panels: uniform 39in whole-bale panels (Tommy's existing
  //   squareBalePanel reference spec — "two 18in bales + two 1.5in studs,"
  //   already flagged reference/layout-mode-only, not fabricated to anymore).
  // - timber-frame-curtain: uniform standard OR braced panels at a fixed,
  //   adjustable width (default 3ft) — no bracing-near-corners/safety-gap
  //   logic, since the actual timber frame (not modeled) carries the
  //   structural load in this system.
  const [panelizationType, setPanelizationType] = useState<PanelizationType>("loose-packed-braced");
  const [timberFrameCurtainPanelType, setTimberFrameCurtainPanelType] = useState<"standard" | "braced">("standard");
  const [timberFrameCurtainWidthIn, setTimberFrameCurtainWidthIn] = useState(36);
  const isSquareBalePanelization = panelizationType === "square-bale-panels";

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
      interiorId,
      exteriorId,
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
      gableEndWallIds,
      secondStoryEnabled,
      secondStoryWallHeightFt,
      panelizationType,
      timberFrameCurtainPanelType,
      timberFrameCurtainWidthIn,
      nailerOffsetIn,
      squareBaleStudConfig,
      projectName,
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
      setInteriorId(s.interiorId);
      setExteriorId(s.exteriorId);
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
      setGableEndWallIds(s.gableEndWallIds);
      setSecondStoryEnabled(s.secondStoryEnabled);
      setSecondStoryWallHeightFt(s.secondStoryWallHeightFt);
      setPanelizationType(s.panelizationType);
      setTimberFrameCurtainPanelType(s.timberFrameCurtainPanelType);
      setTimberFrameCurtainWidthIn(s.timberFrameCurtainWidthIn);
      setNailerOffsetIn(s.nailerOffsetIn);
      setSquareBaleStudConfig(s.squareBaleStudConfig);
      setProjectName(s.projectName);
    });
  };

  const interior = interiorLayers.find((l) => l.id === interiorId)!;
  const exterior = exteriorLayers.find((l) => l.id === exteriorId)!;
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
    retilePure(fp, leastAccessible, primary, standardWidthIn, cornerPanelWidthIn.value, thicknessIn);
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
    if (!nextType) return; // corner/safety-gap untouched

    const anchors: { beforeStandardCount: number; type: "window" | "door" | "column"; widthIn: number }[] = [];
    let standardsSeen = 0;
    currentSlots.forEach((slot, i) => {
      const type = i === slotIndex ? nextType : slot.type;
      if (type === "window" || type === "door" || type === "column") {
        anchors.push({ beforeStandardCount: standardsSeen, type, widthIn: slot.widthIn });
      } else if (type === "standard") {
        standardsSeen++;
      }
    });

    const slots = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerPanelWidthIn.value,
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
    const anchors = getOpeningAnchors(currentSlots);
    if (!anchors[precedingOpenings]) return;
    anchors[precedingOpenings] = { ...anchors[precedingOpenings]!, widthIn };

    const slots = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerPanelWidthIn.value,
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
      setBaseWallSlots(retile(fp, leastAccessibleCorner, primaryCornerIds));
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
      setBaseWallSlots(retile(fp, leastAccessibleCorner, nextPrimary));
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
    setBaseWallSlots(retile(fp, leastAccessibleCorner, nextPrimary));
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
    setFootprint(fp);
    setIsBumpedOut(true);
    setPrimaryCornerIds(nextPrimary);
    setLeastAccessibleCorner(nextLeastAccessible);
    setBaseWallSlots(retile(fp, nextLeastAccessible, nextPrimary));
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
      const fp = dragWall(footprint, wallId, offsetFt);
      setFootprint(fp);
      setBaseWallSlots(retile(fp, leastAccessibleCorner, primaryCornerIds));
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
    setBaseWallSlots(retile(fp, leastAccessibleCorner, nextPrimary));
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

  const windowList = useMemo(() => {
    const items: { wallId: string; slotIndex: number; widthIn: number }[] = [];
    for (const [wallId, slots] of Object.entries(baseWallSlots)) {
      slots.forEach((s, i) => {
        if (s.type === "window") items.push({ wallId, slotIndex: i, widthIn: s.widthIn });
      });
    }
    return items;
  }, [baseWallSlots]);

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

  const woodPerPanel = useMemo(
    () => computeStandardPanelWoodWeight(includeNailer),
    [includeNailer],
  );
  const totalWoodWeightKg = woodEligibleCount * woodPerPanel.weightKg;
  const totalWeightKg = strawWeight.weightKg + totalWoodWeightKg;
  const totalWeightLb = totalWeightKg * KG_TO_LB;

  const hasClayPlaster = interior.id === "clay-plaster";
  const hasLimePlaster = exterior.id === "lime-plaster";

  // Computed once, across every nameable panel type together, so a panel's
  // number always reflects its true position in the along-wall sequence —
  // Shop Drawing pages then just filter this same list, rather than each
  // recomputing its own independent (and previously mismatched) counter.
  const allInstances = useMemo(
    () => (footprint ? allPanelInstances(footprint, overlayWallSlots) : []),
    [footprint, overlayWallSlots],
  );

  // Column/Corner panels are always COLUMN_TOTAL_WIDTH_IN (25.5in) wide —
  // a fixed unit, independent of standardWidthIn — so there's no size
  // grouping to do, just one 3D model each.
  const columnPanelMembers = useMemo(
    () => buildColumnPanelMembers(thicknessIn, wallHeightFt * 12, includeNailer),
    [thicknessIn, wallHeightFt, includeNailer],
  );
  const cornerPanelMembers3D = useMemo(
    () => buildCornerPanelMembers(thicknessIn, wallHeightFt * 12, includeNailer),
    [thicknessIn, wallHeightFt, includeNailer],
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

  // Plywood Jack Stud: full rough-opening height isn't tracked anywhere yet
  // (headers/sills have no real placement mechanism), so this preview uses
  // the current wall height as an illustrative default, same pattern as
  // the gable preview above.
  const jackStudPreviewHeightIn = wallHeightFt * 12;
  const jackStudMembers = useMemo(
    () => buildJackStudMembers(thicknessIn, jackStudPreviewHeightIn),
    [thicknessIn, jackStudPreviewHeightIn],
  );
  const jackStudFastenerResult = useMemo(
    () => computeJackStudFastenerWeight(jackStudPreviewHeightIn),
    [jackStudPreviewHeightIn],
  );

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
  const plywoodAreaSqFt = useMemo(() => {
    let threeQuarterSqFt = 0;
    let halfSqFt = 0;
    for (const inst of allInstances) {
      const members =
        inst.panelType === "standard"
          ? isSquareBalePanelization
            ? buildSquareBalePanelMembers(inst.widthIn, thicknessIn, heightIn, includeNailer, squareBaleStudConfig, nailerOffsetIn)
            : buildStandardPanelMembers(inst.widthIn, thicknessIn, heightIn, includeNailer)
          : inst.panelType === "braced"
            ? buildBracedPanelMembers(inst.widthIn, thicknessIn, heightIn, includeNailer)
            : inst.panelType === "column"
              ? columnPanelMembers
              : inst.panelType === "corner" || inst.panelType === "safety-oct-corner"
                ? cornerPanelMembers3D
                : inst.panelType === "safety-gap"
                  ? safetyGapMembers3D
                  : null;
      if (!members) continue;
      threeQuarterSqFt += computePlywoodAreaSqFt(members, 0.75);
      halfSqFt += computePlywoodAreaSqFt(members, 0.5);
    }
    // Roof-bearing assembly's own plywood cap(s) — box beam has both a top
    // and bottom cap, truss plate just one — over the real wall perimeter.
    threeQuarterSqFt += secondStoryEnabled
      ? (2 * totalWallPerimeterIn * thicknessIn) / 144
      : (totalWallPerimeterIn * thicknessIn) / 144;
    return { threeQuarterSqFt, halfSqFt };
  }, [
    allInstances,
    thicknessIn,
    heightIn,
    includeNailer,
    columnPanelMembers,
    cornerPanelMembers3D,
    safetyGapMembers3D,
    secondStoryEnabled,
    totalWallPerimeterIn,
    isSquareBalePanelization,
    squareBaleStudConfig,
    nailerOffsetIn,
  ]);

  const plywoodThreeQuarterSheetCount = Math.ceil(plywoodAreaSqFt.threeQuarterSqFt / PLYWOOD_SHEET_AREA_SQFT);
  const plywoodHalfSheetCount = Math.ceil(plywoodAreaSqFt.halfSqFt / PLYWOOD_SHEET_AREA_SQFT);

  // Square Bale Panels: each "standard"-typed slot under this panelization
  // type is a bale-pair unit (Tommy: "two 18in bales" per panel) — counted
  // as discrete purchase units, not a density x volume estimate, since
  // real bales aren't infinitely resizable the way loose-pack straw is.
  const strawBaleCount =
    panelizationType === "square-bale-panels" ? allInstances.filter((inst) => inst.panelType === "standard").length * 2 : 0;
  const strawBaleWeightLb = strawBaleCount * STRAW_BALE_WEIGHT_LB;

  // Fastener counts/weight are only modeled for panel types with real
  // member geometry (standard/braced/column/corner) — built per-instance
  // at that instance's own width (column/corner ignore it, always fixed at
  // COLUMN_TOTAL_WIDTH_IN) so girt-row/plate/brace counts are exact, not a
  // flat scalar like the older wood-weight calc.
  const fastenerWeightKgFor = (panelTypeId: string, widthIn: number): number | null => {
    const heightIn = wallHeightFt * 12;
    const members =
      panelTypeId === "standard"
        ? buildStandardPanelMembers(widthIn, thicknessIn, heightIn, includeNailer)
        : panelTypeId === "braced"
          ? buildBracedPanelMembers(widthIn, thicknessIn, heightIn, includeNailer)
          : panelTypeId === "column"
            ? columnPanelMembers
            : panelTypeId === "corner"
              ? cornerPanelMembers3D
              : panelTypeId === "gable"
                ? gablePanelMembers
                : null;
    return members ? computeFastenerWeight(members).totalWeightKg : null;
  };

  const shopDrawings = useMemo(
    () =>
      SHOP_DRAWING_PANEL_TYPES.map(({ namedTypes, panelTypeId, hasWoodBom }) => {
        const panelType = panelTypes.find((p) => p.id === panelTypeId)!;
        const instances = allInstances
          .filter((inst) => namedTypes.includes(inst.panelType))
          .map((inst) => ({
            ...inst,
            weightBreakdown: computePanelWeightBreakdown({
              // Safety/Gap is just a plywood sheet now, no straw-filled
              // cavity at all — widthIn: 0 forces straw weight to a
              // correct 0 here without touching inst.widthIn itself
              // (still shown as-is in the table's own Width column).
              widthIn: panelTypeId === "safety-gap" ? 0 : inst.widthIn,
              thicknessIn,
              heightIn: wallHeightFt * 12,
              densityKgM3: densityLbFt3 * LB_FT3_TO_KG_M3,
              woodWeightKg: hasWoodBom ? woodPerPanel.weightKg : null,
              fastenerWeightKg: fastenerWeightKgFor(panelTypeId, inst.widthIn),
              hasClayPlaster,
              hasLimePlaster,
            }),
          }));
        return { panelType, hasWoodBom, instances };
      }),
    [allInstances, thicknessIn, wallHeightFt, densityLbFt3, woodPerPanel.weightKg, hasClayPlaster, hasLimePlaster],
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

  // Distinct-width 3D renderings for the Standard/Braced Shop Drawing pages
  // — panel instances of the same type can differ in size (already true
  // for window/header/sill panels via their per-instance widthIn), so every
  // distinct width actually in the design gets its own model, sized per
  // Tommy's half/quarter/equal-share rule (see computePanelSizeShares).
  // Falls back to the globally-selected standardWidthIn when the design
  // has no instances of that type yet, so the page still shows a preview.
  const standardSizeGroups = useMemo(() => {
    const instances = shopDrawings.find((d) => d.panelType.id === "standard")?.instances ?? [];
    const widths = instances.length > 0 ? instances.map((i) => i.widthIn) : [standardWidthIn];
    return computePanelSizeShares(widths).map((share) => ({
      ...share,
      members: isSquareBalePanelization
        ? buildSquareBalePanelMembers(share.widthIn, thicknessIn, wallHeightFt * 12, includeNailer, squareBaleStudConfig, nailerOffsetIn)
        : buildStandardPanelMembers(share.widthIn, thicknessIn, wallHeightFt * 12, includeNailer),
    }));
  }, [
    shopDrawings,
    standardWidthIn,
    thicknessIn,
    wallHeightFt,
    includeNailer,
    isSquareBalePanelization,
    squareBaleStudConfig,
    nailerOffsetIn,
  ]);

  const bracedSizeGroups = useMemo(() => {
    const instances = shopDrawings.find((d) => d.panelType.id === "braced")?.instances ?? [];
    const widths = instances.length > 0 ? instances.map((i) => i.widthIn) : [standardWidthIn];
    return computePanelSizeShares(widths).map((share) => ({
      ...share,
      members: buildBracedPanelMembers(share.widthIn, thicknessIn, wallHeightFt * 12, includeNailer),
    }));
  }, [shopDrawings, standardWidthIn, thicknessIn, wallHeightFt, includeNailer]);

  // Estimated bearing/shear numbers (Tommy: "let's take a stab at making
  // some estimated engineering numbers") — bearing applies to any panel
  // type with real stud geometry (standard/braced/column/corner all share
  // the same 2x4 studs); shear is specific to the Braced Panel's diagonal
  // brace, computed from its own actual member geometry at the currently-
  // selected width/height rather than a flat constant.
  const estimatedStudPackBearingLb = useMemo(() => computeStudPackBearingCapacityLb(), []);
  const estimatedBracedShearLb = useMemo(
    () => computeBracedPanelShearCapacityLb(buildBracedPanelMembers(standardWidthIn, thicknessIn, wallHeightFt * 12, includeNailer)),
    [standardWidthIn, thicknessIn, wallHeightFt, includeNailer],
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
            sum + computeBracedPanelShearCapacityLb(buildBracedPanelMembers(inst.widthIn, thicknessIn, wallHeightFt * 12, includeNailer)),
          0,
        ),
    [allInstances, thicknessIn, wallHeightFt, includeNailer],
  );

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
    if (docFloorJoistType) {
      pages.push({ id: "detail-floor", label: `Floor: ${docFloorJoistType.label}` });
      pages.push({ id: "detail-floor-assembly", label: "Floor: Full Assembly" });
      pages.push({ id: "detail-floor-corner", label: "Floor: Corner & Perimeter Sequencing" });
      if (docPerpendicular2x4Enabled) {
        pages.push({ id: "detail-floor-addon", label: "Floor: Perpendicular 2x4 Add-On Layer" });
      }
    }
    if (docIsThermalSlabFloor) {
      pages.push({ id: "detail-floor-thermal-slab", label: "Floor: Thermally Broken Slab" });
    }
    if (!secondStoryEnabled) {
      pages.push({ id: "detail-truss-plate", label: "Roof: Truss Plate (Single-Story)" });
    } else {
      pages.push({ id: "detail-box-beam", label: "Roof: Box Beam (Two-Story)" });
    }
    pages.push({ id: "detail-material-totals", label: "Material Totals" });
    // Shop Drawings are a fabricator/detailer document, not a public-facing one (Tommy).
    if (role !== "public") {
      for (const { panelType, instances } of shopDrawings) {
        if (instances.length > 0 || canPreviewAllDetailPages) {
          pages.push({ id: `shop-${panelType.id}`, label: `Shop Drawing: ${panelType.label} (${instances.length})` });
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
    role,
    canPreviewAllDetailPages,
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
  // Windows/Wall Assembly/Project Totals/Review Log). "Wall Tools" (Tommy:
  // "wall tools sticky note should be a clickable option on the right tool
  // bar") relabels itself to match whichever editor tab is active, same as
  // it always has.
  const allNoteSections = useMemo(
    () => [
      { id: "editor-tools", label: editorToolsLabel },
      { id: "windows", label: "Windows" },
      { id: "wall-assembly", label: "Wall Assembly (Vapor Check)" },
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

  const handlePrintPacket = () => {
    // Every formal document note needs to actually be open (mounted) to
    // print — silently open any that aren't, restoring the prior open set
    // afterward.
    const wasOpen = new Set(openNoteIds);
    setOpenNoteIds((was) => new Set([...was, ...formalDocumentNoteIds]));
    requestAnimationFrame(() => {
      for (const id of formalDocumentNoteIds) {
        document.getElementById(id)?.setAttribute("data-print-target", "true");
      }
      document.body.setAttribute("data-print-mode", "packet");
      window.print();
      setOpenNoteIds(wasOpen);
    });
  };

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
          <option value="high">High ({seismicBracedPanelSpacingFt.high}ft braced spacing)</option>
          <option value="moderate">Moderate ({seismicBracedPanelSpacingFt.moderate}ft braced spacing)</option>
          <option value="low">Low ({seismicBracedPanelSpacingFt.low}ft braced spacing)</option>
        </select>
      </label>
      <label>
        Foundation type{" "}
        <select value={foundationTypeId} onChange={(e) => setFoundationTypeId(e.target.value as typeof foundationTypeId)}>
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
      <p className={foundationType.status === "pending-BI-confirmation" ? styles.pending : styles.note}>
        {foundationType.vaporNote}
      </p>
    </>
  );

  // Panel Standards dropdown content (Tommy: "middle right of the menu bar,
  // i want Panel Standards, which includes panel parameters section as well
  // as panel styles") — the old standalone "Panel parameters" section plus
  // the panelization-type controls that used to live inside the Wall tab
  // (moving them here means they're now editable regardless of which
  // editor tab is active, which is a genuine improvement — the underlying
  // state never depended on the Wall tab specifically).
  const panelStandardsContent = (
    <>
      <h2>Panel Standards</h2>
      <label>
        Standard width (in){" "}
        <input
          type="number"
          value={standardWidthIn}
          onChange={(e) => setStandardWidthIn(Number(e.target.value))}
        />
      </label>
      <label>
        Thickness (in){" "}
        <select value={thicknessIn} onChange={(e) => setThicknessIn(Number(e.target.value))}>
          {looseDensePackThicknessOptionsIn.map((t) => (
            <option key={t} value={t}>
              {t}&quot;
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
          onClick={() => setPanelizationType("square-bale-panels")}
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
      {panelizationType === "loose-packed-braced" && (
        <p className={styles.note}>
          Today&apos;s system: standard panels tiled at the width above, with corner-proximity bracing and
          safety/gap dimensional-tolerance absorption.
        </p>
      )}
      {panelizationType === "square-bale-panels" && (
        <>
          <p className={styles.pending}>
            Reference/layout mode only — not fabricated to anymore (Tommy). Every wall infill span (in place
            of standard/braced/safety-gap) is tiled at a fixed {squareBalePanel.widthIn}
            &quot; x {squareBalePanel.thicknessIn}&quot; whole-bale unit ({squareBalePanel.note}). Corners,
            columns, and openings are unaffected.
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
          panelStandardsContent={panelStandardsContent}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
              {editorTab === "wall" && <CompassWidget ref={compassNeedleRef} />}
              {editorTab === "wall" && viewMode === "plan" && (
                <div ref={setToolbarPortalNode} className={styles.toolbarPortalInline} />
              )}
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
            <EditorToolbar
              editorTab={editorTab}
              onEditorTabChange={setEditorTab}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              viewModeDisabled={editorTab !== "wall" || !footprint}
            />
            {editorTab === "wall" && viewMode === "plan" && (
              <>
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
          </div>

          <div className={styles.editorCanvasLayer}>
            {editorTab === "wall" &&
              (viewMode === "plan" ? (
                <FootprintCanvas
                  footprint={footprint}
                  shapeTool={shapeTool}
                  offsetPx={offsetPx}
                  wallSlots={overlayWallSlots}
                  wallStartOffsetIn={wallRenderOffsetIn}
                  wallThicknessIn={thicknessIn}
                  wallHeightFt={wallHeightFt}
                  includeNailer={includeNailer}
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
                  nailerOffsetIn={nailerOffsetIn}
                  compassRef={compassNeedleRef}
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
              nailerOffsetIn={nailerOffsetIn}
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
                    Drag to orbit, scroll to zoom — a rough bird's-eye starting
                    angle, not a fixed camera. Each wall panel shows its real
                    member geometry (standard/braced/column/corner) at its actual
                    position and width; panel types without member geometry yet
                    (window, door, safety/gap) render as plain gray placeholder
                    blocks. No roof yet.
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
                {viewMode === "plan" && footprint && (
                  <div>
                    <div role="group" aria-label="Elevation view" className={styles.toolbar}>
                      <span style={{ fontSize: 13, marginRight: 4 }}>Elevation view:</span>
                      {footprint.walls.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          aria-pressed={elevationViewWallId === w.id}
                          className={elevationViewWallId === w.id ? styles.toolActive : styles.tool}
                          onClick={() => setElevationViewWallId((was) => (was === w.id ? null : w.id))}
                        >
                          {w.id} ↑
                        </button>
                      ))}
                    </div>
                    <p className={styles.note}>
                      Opens a face-on 2D view of that wall section (X = position along the wall, Y = height) — the same
                      ground-floor run shown above, plus an optional Gable End row on top (see the Roof tab for the ridge
                      height it rises to).
                    </p>
                    {elevationWall && (
                      <WallElevationView
                        wall={elevationWall}
                        slots={overlayWallSlots[elevationWall.id] ?? []}
                        wallHeightFt={wallHeightFt}
                        hasGableEnd={gableEndWallIds.has(elevationWall.id)}
                        ridgeHeightFt={bottomOfTrussMaxHeightFt}
                        targetPanelWidthIn={standardWidthIn}
                        onToggleGableEnd={(enabled) => handleToggleGableEnd(elevationWall.id, enabled)}
                        onClose={() => setElevationViewWallId(null)}
                      />
                    )}
                  </div>
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
                ) : (
                  <p className={styles.note}>
                    {foundationType.label} doesn&apos;t use a pier grid — see the Detail Guide Pages section below for
                    its construction detail.
                  </p>
                )}
              </>
            )}
            {editorTab === "floor" && (
              <>
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
                    disabled={!footprint}
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
                ) : (
                  <p className={styles.note}>
                    {foundationType.label} doesn&apos;t use a pier grid, so there&apos;s no pier-to-pier floor panel
                    bay to derive yet — see the Detail Guide Pages section below for its construction detail.
                  </p>
                )}
              </>
            )}
            {editorTab === "roof" && (
              <>
                <div role="group" aria-label="Roof system type" className={styles.toolbar}>
                  {roofSystemTypes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={roofSystemTypeId === t.id}
                      className={roofSystemTypeId === t.id ? styles.toolActive : styles.tool}
                      onClick={() => setRoofSystemTypeId(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
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

                <label>
                  Truss plate inset (in){" "}
                  <input
                    type="number"
                    value={trussPlateInsetIn}
                    min={0}
                    step={0.25}
                    onChange={(e) => setTrussPlateInsetIn(Number(e.target.value))}
                  />
                </label>
                <p className={styles.note}>{trussPlateInsetDefaultIn.note}</p>

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
                      in at the current inputs) — see the Column Panel Shop Drawing page below. Beam shape is a label
                      only for now; real beam geometry is flagged to model later.
                    </p>
                  </>
                )}
              </>
            )}
          </StickyNote>
        </div>

        <StickyNote
          id="windows"
          label="Windows"
          isOpen={openNoteIds.has("windows")}
          isFullscreen={fullscreenNoteId === "windows"}
          cascadeIndex={noteOpenOrder.indexOf("windows")}
          onClose={() => handleToggleNote("windows")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("windows")}
          onPrint={() => handlePrintNote("windows")}
        >
          {windowList.length > 0 ? (
            windowList.map(({ wallId, slotIndex, widthIn }) => (
              <label key={`${wallId}-${slotIndex}`}>
                Wall {wallId}, window #{slotIndex}{" "}
                <select
                  id={`window-size-${wallId}-${slotIndex}`}
                  value={widthIn}
                  onChange={(e) => handleSetWindowWidth(wallId, slotIndex, Number(e.target.value))}
                >
                  {standardWindowWidthsIn.value.map((w) => (
                    <option key={w} value={w}>
                      {w}&quot;
                    </option>
                  ))}
                </select>
              </label>
            ))
          ) : (
            <p className={styles.note}>
              No windows placed yet. Switch to the Wall tab&apos;s 2D view, set the shape tool to Edit, and click a
              tan panel to cycle it to Window — it&apos;ll show up here with a width dropdown once placed.
            </p>
          )}
        </StickyNote>

        <StickyNote
          id="wall-assembly"
          label="Wall Assembly (Vapor Check)"
          isOpen={openNoteIds.has("wall-assembly")}
          isFullscreen={fullscreenNoteId === "wall-assembly"}
          cascadeIndex={noteOpenOrder.indexOf("wall-assembly")}
          onClose={() => handleToggleNote("wall-assembly")}
          onToggleFullscreen={() => handleToggleNoteFullscreen("wall-assembly")}
          onPrint={() => handlePrintNote("wall-assembly")}
        >
          <label>
            Interior finish{" "}
            <select value={interiorId} onChange={(e) => setInteriorId(e.target.value)}>
              {interiorLayers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Exterior finish{" "}
            <select value={exteriorId} onChange={(e) => setExteriorId(e.target.value)}>
              {exteriorLayers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
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
                </tbody>
              </table>
            }
            fastenerSchedule={[]}
            notes={[
              "3/4in plywood: every Standard/Braced panel's 2 skins, every Column/Corner panel's 2 side plies, every Safety/Gap panel's single sheet (see the Safety/Gap redesign note on its own Shop Drawing page), plus the roof-bearing assembly's own plywood cap(s) — a box beam's top+bottom caps if Second Story is enabled, a truss plate's single cap otherwise — across the drawn footprint's real total wall perimeter, not an illustrative preview length.",
              "1/2in plywood is only the girt webs (girt bars themselves are dimensional lumber, tallied separately).",
              ...(panelizationType === "square-bale-panels"
                ? [
                    "Straw bale count: 2 bales per Square Bale Panel instance (Tommy: \"two 18in bales\" per panel), counted as discrete purchase units rather than a density x volume estimate — real bales aren't infinitely resizable the way loose-pack straw is, even though the tiling math adjusts each panel's nominal width slightly to fit the wall run evenly.",
                  ]
                : ["Straw bale counts only apply when Square Bale Panels is the selected panelization type (Wall tab)."]),
              "Sheet counts round up from the summed real area (not per-instance), a reasonable purchasing estimate assuming offcuts get reused across panels.",
            ]}
            role={role}
          />
        </StickyNote>

        {role !== "public" && (
          <>
            {shopDrawings.map(({ panelType, hasWoodBom, instances }) => (
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
                  Fabricator/detailer document — one sheet per wall panel type, every individual panel currently in
                  the design, named by compass direction (e.g. &quot;N-1&quot; — up is treated as North), with its
                  own straw-only and full weight breakdown. Standard Panel has a real 3D model, built member-by-
                  member from its actual BOM geometry; other panel types&apos; reference drawings (the labeled-parts
                  picture) are still placeholders.
                </p>
                <ShopDrawingPage
                  title={`Shop Drawing — ${panelType.label}${panelType.label.toLowerCase().includes("panel") ? "" : " Panel"}`}
                  panelDescription={panelType.description}
                  standardWidthIn={standardWidthIn}
                  thicknessIn={thicknessIn}
                  heightIn={wallHeightFt * 12}
                  loadBearingCapacity={panelType.loadBearingCapacity}
                  shearValue={panelType.shearValue}
                  bomParts={hasWoodBom ? SHOP_DRAWING_BOM_PARTS : undefined}
                  bomNote={hasWoodBom ? standardPanelBom.note : undefined}
                  diagram3D={
                    panelType.id === "standard" || panelType.id === "braced" ? (
                      <div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {(panelType.id === "standard" ? standardSizeGroups : bracedSizeGroups).map((group) => (
                            <div key={group.widthIn} style={{ flex: `${group.sharePercent} 1 0%`, minWidth: 160 }}>
                              <StandardPanel3DView
                                members={group.members}
                                overallDimensions={{ heightIn: wallHeightFt * 12, widthIn: group.widthIn, depthIn: thicknessIn }}
                                displayName={`${panelType.label} ${group.widthIn}in (${group.count})`}
                              />
                            </div>
                          ))}
                        </div>
                        {panelType.id === "standard" && isSquareBalePanelization && (
                          <p className={styles.note}>
                            Square Bale Panels selected (Wall tab) — this is actually a Square Bale Panel
                            (rectangular blocking-girt construction) here, not a loose-pack Standard Panel.
                          </p>
                        )}
                      </div>
                    ) : panelType.id === "column" || panelType.id === "corner" ? (
                      <div>
                        <StandardPanel3DView
                          members={panelType.id === "column" ? columnPanelMembers : cornerPanelMembers3D}
                          overallDimensions={{ heightIn: wallHeightFt * 12, widthIn: COLUMN_TOTAL_WIDTH_IN, depthIn: thicknessIn }}
                          displayName={panelType.label}
                        />
                        {panelType.id === "column" && roofSystemTypeId === "structural-panel" && (
                          <p className={styles.note}>
                            At a Gable End roof-catcher-beam bearing point (structural-panel roof selected on the
                            Roof tab): Column Panel height ={" "}
                            {computeGableColumnHeightIn(bottomOfTrussMaxHeightFt * 12, roofCatcherBeamOffsetIn).toFixed(1)}
                            &quot; ({bottomOfTrussMaxHeightFt * 12}&quot; bottom-of-truss max height minus{" "}
                            {roofCatcherBeamOffsetIn}&quot; beam-depth offset), beam shape: {roofCatcherBeamShape} (label
                            only — real beam geometry flagged to model later).
                          </p>
                        )}
                      </div>
                    ) : panelType.id === "gable" ? (
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
                    ) : panelType.id === "jack-stud" ? (
                      <div>
                        <StandardPanel3DView
                          members={jackStudMembers}
                          overallDimensions={{ heightIn: jackStudPreviewHeightIn, widthIn: JACK_STUD_THICKNESS_IN, depthIn: thicknessIn }}
                          displayName={panelType.label}
                        />
                        <p className={styles.note}>
                          Preview only, at an illustrative default height (current wall height, {jackStudPreviewHeightIn}
                          &quot;) — real rough-opening height isn&apos;t tracked yet. Fasteners:{" "}
                          {jackStudFastenerResult.items[0]!.count} x 4in T25 #9 screws (
                          {jackStudFastenerResult.totalWeightLb.toFixed(2)} lb) for this one sheet — a full opening gets
                          2 (one each side).
                        </p>
                      </div>
                    ) : panelType.id === "safety-gap" ? (
                      <div>
                        <StandardPanel3DView
                          members={safetyGapMembers3D}
                          overallDimensions={{ heightIn: wallHeightFt * 12, widthIn: SAFETY_GAP_THICKNESS_IN, depthIn: thicknessIn }}
                          displayName={panelType.label}
                        />
                        <p className={styles.note}>
                          No longer an altered Standard Panel — just this one {SAFETY_GAP_THICKNESS_IN}in plywood
                          sheet, regardless of how much wall-run width the tiling reserves for this slot. See the
                          Material Totals page for the whole-project plywood count.
                        </p>
                      </div>
                    ) : undefined
                  }
                  estimatedBearingLb={
                    panelType.id === "column"
                      ? estimatedColumnBuiltUpBearingLb
                      : panelType.id === "corner"
                        ? estimatedCornerBuiltUpBearingLb
                        : panelType.id === "standard" || panelType.id === "braced" || panelType.id === "gable"
                          ? estimatedStudPackBearingLb
                          : undefined
                  }
                  estimatedShearLb={panelType.id === "braced" ? estimatedBracedShearLb : undefined}
                  estimatedBearingMethodLabel={
                    panelType.id === "column" || panelType.id === "corner" ? "built-up plywood section" : undefined
                  }
                  instances={instances}
                  role={role}
                />
                {(panelType.id === "gable" || panelType.id === "jack-stud") && (
                  <p className={styles.note}>
                    Preview-only (3D model + illustrative default dimensions) — not placed anywhere in the current
                    layout system yet: gable needs the not-yet-built roof/ridge system to supply real per-instance
                    edge heights, and jack studs need a real rough-opening height, which headers/sills don&apos;t
                    track yet either. Inclined/Gable (roof-slope) and floor/roof panels don&apos;t exist as modeled
                    panel systems yet either — all deferred until those systems are built.
                  </p>
                )}
              </StickyNote>
            ))}
          </>
        )}

        <SectionCarousel
          sections={allNoteSections}
          openIds={openNoteIds}
          onToggle={handleToggleNote}
          footer={<Link href="/sandbox">Single Wall Run Calculation Sandbox →</Link>}
        />
      </main>
    </div>
    </DocumentMetaProvider>
  );
}
