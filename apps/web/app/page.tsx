"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  applyBracedPlacement,
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
  computeCarbonRange,
  computeConcretePierVolume,
  computeFastenerWeight,
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
  buildBracedPanelMembers,
  buildColumnPanelMembers,
  buildCornerPanelMembers,
  buildStandardPanelMembers,
  carbonFractionOfDryMass,
  COLUMN_TOTAL_WIDTH_IN,
  computePanelSizeShares,
  concreteEmbodiedCarbonKgPerFt3,
  concretePierDimensions,
  cornerPanelWidthIn,
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
  slabFoundationDimensions,
  seismicBracedPanelSpacingFt,
  shearLoadCapacity,
  standardPanelBom,
  standardPanelBomReferenceWidthIn,
  standardPanelHeightIn,
  standardWindowWidthsIn,
  strawMoistureContent,
  targetDensityKgM3,
  wallAssemblyLayers,
  type SeismicZone,
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
import SlabFoundationDiagram from "./SlabFoundationDiagram";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import styles from "./page.module.css";

const FootprintCanvas = dynamic(() => import("./FootprintCanvas"), { ssr: false });
const Building3DView = dynamic(() => import("./Building3DView"), { ssr: false });
const StandardPanel3DView = dynamic(() => import("./StandardPanel3DView"), { ssr: false });

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

// Only the wall panel types that actually have real instances in the
// current layout system get a Shop Drawing page today (Tommy also wants
// floor/roof panels covered, but floor/roof paneling itself doesn't exist
// yet — see the "not yet in the layout system" note below). Corner's
// safety-oct-corner variant shares the "corner" page (same fabrication,
// priced identically elsewhere already). Header and sill are derived from
// window/door slots (see panelInstances.ts) — a window is a header +
// sill, a door is a header only, not their own PanelSlot type.
const SHOP_DRAWING_PANEL_TYPES: {
  namedTypes: NamedPanelType[];
  panelTypeId: "standard" | "corner" | "braced" | "safety-gap" | "header" | "sill" | "column";
  hasWoodBom: boolean;
}[] = [
  { namedTypes: ["standard"], panelTypeId: "standard", hasWoodBom: true },
  { namedTypes: ["corner", "safety-oct-corner"], panelTypeId: "corner", hasWoodBom: false },
  { namedTypes: ["braced"], panelTypeId: "braced", hasWoodBom: true },
  { namedTypes: ["safety-gap"], panelTypeId: "safety-gap", hasWoodBom: false },
  { namedTypes: ["header"], panelTypeId: "header", hasWoodBom: false },
  { namedTypes: ["sill"], panelTypeId: "sill", hasWoodBom: false },
  { namedTypes: ["column"], panelTypeId: "column", hasWoodBom: false },
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
  const [interiorId, setInteriorId] = useState(interiorLayers[1]!.id);
  const [exteriorId, setExteriorId] = useState(exteriorLayers[1]!.id);
  const [season, setSeason] = useState<Season>("winter");

  const [seismicZone, setSeismicZone] = useState<SeismicZone>("moderate");
  const [foundationTypeId, setFoundationTypeId] = useState(foundationTypes[0]!.id);
  const [pierSpacingFt, setPierSpacingFt] = useState<number>(pierSpacingDefaultFt);
  const [zipCode, setZipCode] = useState("");
  const [role, setRole] = useState<ViewerRole>("public");
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

  const loadInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const floorJoistTypeId = floorSystemId && floorSystemId !== "thermal-slab" ? floorSystemId : null;
  const floorJoistType = floorJoistTypeId ? floorJoistTypes.find((t) => t.id === floorJoistTypeId)! : null;
  const isThermalSlabFloor = floorSystemId === "thermal-slab";
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
      setShapeTool("edit");
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
    setShapeTool("edit");
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

  // Braced-panel placement is a derived overlay, recomputed from the base
  // slots every render — never stored, so toggling an opening back to
  // standard just falls out of recomputation instead of needing to be undone.
  const overlayWallSlots = useMemo(() => {
    const next: Record<string, PanelSlot[]> = {};
    for (const [wallId, slots] of Object.entries(baseWallSlots)) {
      next[wallId] = applyBracedPlacement(slots, spacingIn, standardWidthIn);
    }
    return next;
  }, [baseWallSlots, spacingIn, standardWidthIn]);

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
  const strawSlots = allSlots.filter(
    (s) =>
      s.type === "corner" ||
      s.type === "safety-oct-corner" ||
      s.type === "standard" ||
      s.type === "safety-gap" ||
      s.type === "braced" ||
      s.type === "column",
  );
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
              widthIn: inst.widthIn,
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
      members: buildStandardPanelMembers(share.widthIn, thicknessIn, wallHeightFt * 12, includeNailer),
    }));
  }, [shopDrawings, standardWidthIn, thicknessIn, wallHeightFt, includeNailer]);

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
    if (floorJoistType) {
      pages.push({ id: "detail-floor", label: `Floor: ${floorJoistType.label}` });
      pages.push({ id: "detail-floor-assembly", label: "Floor: Full Assembly" });
      pages.push({ id: "detail-floor-corner", label: "Floor: Corner & Perimeter Sequencing" });
      if (perpendicular2x4Enabled) {
        pages.push({ id: "detail-floor-addon", label: "Floor: Perpendicular 2x4 Add-On Layer" });
      }
    }
    if (isThermalSlabFloor) {
      pages.push({ id: "detail-floor-thermal-slab", label: "Floor: Thermally Broken Slab" });
    }
    // Shop Drawings are a fabricator/detailer document, not a public-facing one (Tommy).
    if (role !== "public") {
      for (const { panelType, instances } of shopDrawings) {
        if (instances.length > 0) {
          pages.push({ id: `shop-${panelType.id}`, label: `Shop Drawing: ${panelType.label} (${instances.length})` });
        }
      }
    }
    return pages;
  }, [foundationType, floorJoistType, isThermalSlabFloor, perpendicular2x4Enabled, shopDrawings, role]);

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
      { label: "Shear / load capacity", ...shearLoadCapacity },
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
  }, [interior, exterior, foundationType, foundationTypeId, standardWidthIn]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.toolbar} role="group" aria-label="Unit system">
          <button
            type="button"
            aria-pressed={unitSystem === "imperial"}
            className={unitSystem === "imperial" ? styles.toolActive : styles.tool}
            onClick={() => setUnitSystem("imperial")}
          >
            Imperial
          </button>
          <button
            type="button"
            aria-pressed={unitSystem === "metric"}
            className={unitSystem === "metric" ? styles.toolActive : styles.tool}
            onClick={() => setUnitSystem("metric")}
          >
            Metric
          </button>
        </div>
        <p className={styles.note}>
          Sets the dimensional lumber standard (e.g. nominal 2x framing vs. metric equivalents) used for framing
          members added later in the app — not yet wired into any calculation below.
        </p>
        <h1>Fabricator App</h1>
        <div className={styles.toolbar} role="group" aria-label="Viewing as">
          {(Object.keys(roleDisclaimers) as ViewerRole[]).map((r) => (
            <button
              key={r}
              type="button"
              className={role === r ? styles.toolActive : styles.tool}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              Viewing as: {roleDisclaimers[r].label}
            </button>
          ))}
        </div>
        <p className={styles.disclaimer}>
          {roleDisclaimers[role].text} Single-story, exterior shell only.
        </p>
        <p className={styles.note}>
          <Link href="/sandbox">Simpler single-wall-run calculation sandbox →</Link>
        </p>

        <div className={styles.toolbar} role="group" aria-label="Project file">
          <button type="button" className={styles.tool} onClick={handleSaveProject}>
            Save Project
          </button>
          <button type="button" className={styles.tool} onClick={() => loadInputRef.current?.click()}>
            Load Project
          </button>
          <input
            ref={loadInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleLoadFileSelected}
            style={{ display: "none" }}
          />
        </div>
        {loadError && <p className={styles.disclaimer}>Couldn&apos;t load that file — {loadError}</p>}
        <p className={styles.note}>
          Save downloads every input on this page (footprint, panel/wall settings, site info) as one JSON file —
          hand it to someone else or reload it later with Load Project to pick up exactly where you left off.
        </p>

        <section>
          <h2>Site</h2>
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
        </section>

        <section>
          <h2>Panel parameters</h2>
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
        </section>

        <section>
          <h2>
            {editorTab === "wall"
              ? "Footprint"
              : editorTab === "foundation"
                ? "Foundation Layout"
                : editorTab === "floor"
                  ? "Floor Layout"
                  : "Roof Layout"}
          </h2>
          <p className={styles.note}>
            Wall, Foundation, Floor, and Roof are all different views onto the same building — switching between
            them keeps everything you&apos;ve drawn.
          </p>
          <div role="group" aria-label="Editor" className={styles.toolbar}>
            <button
              type="button"
              aria-pressed={editorTab === "wall"}
              className={editorTab === "wall" ? styles.toolActive : styles.tool}
              onClick={() => setEditorTab("wall")}
            >
              Wall
            </button>
            <button
              type="button"
              aria-pressed={editorTab === "foundation"}
              className={editorTab === "foundation" ? styles.toolActive : styles.tool}
              onClick={() => setEditorTab("foundation")}
            >
              Foundation
            </button>
            <button
              type="button"
              aria-pressed={editorTab === "floor"}
              className={editorTab === "floor" ? styles.toolActive : styles.tool}
              onClick={() => setEditorTab("floor")}
            >
              Floor
            </button>
            <button
              type="button"
              aria-pressed={editorTab === "roof"}
              className={editorTab === "roof" ? styles.toolActive : styles.tool}
              onClick={() => setEditorTab("roof")}
            >
              Roof
            </button>
          </div>
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
              <div role="group" aria-label="View mode" className={styles.toolbar}>
            <button
              type="button"
              aria-pressed={viewMode === "plan"}
              className={viewMode === "plan" ? styles.toolActive : styles.tool}
              onClick={() => setViewMode("plan")}
            >
              2D Plan
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "3d"}
              className={viewMode === "3d" ? styles.toolActive : styles.tool}
              onClick={() => setViewMode("3d")}
              disabled={!footprint}
            >
              3D Preview
            </button>
          </div>
          {viewMode === "plan" && (
            <>
              <div role="group" aria-label="Shape tool" className={styles.toolbar}>
                <button
                  type="button"
                  aria-pressed={shapeTool === "rectangle"}
                  className={shapeTool === "rectangle" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("rectangle")}
                >
                  Rectangle
                </button>
                <button
                  type="button"
                  aria-pressed={shapeTool === "octagon"}
                  className={shapeTool === "octagon" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("octagon")}
                >
                  Octagon
                </button>
                <button
                  type="button"
                  aria-pressed={shapeTool === "bump-out"}
                  className={shapeTool === "bump-out" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("bump-out")}
                  disabled={!footprint}
                >
                  Add Bump-out
                </button>
                <button
                  type="button"
                  aria-pressed={shapeTool === "drag-wall"}
                  className={shapeTool === "drag-wall" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("drag-wall")}
                  disabled={!footprint}
                >
                  Drag Wall
                </button>
                <button
                  type="button"
                  aria-pressed={shapeTool === "edit"}
                  className={shapeTool === "edit" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("edit")}
                  disabled={!footprint}
                >
                  Edit
                </button>
              </div>
              {shapeTool === "bump-out" && (
                <p className={styles.note}>
                  Drag along a wall to pick the span it attaches to, then drag
                  outward (an addition) or inward (a notch) to set the depth.
                </p>
              )}
              {shapeTool === "drag-wall" && (
                <p className={styles.note}>
                  Drag a wall to move it — its 2 neighbor walls stretch or
                  shrink to absorb the change; everything else stays fixed.
                  {footprint && !footprintIsAllRightAngles(footprint)
                    ? " On an octagon, only the 4 straight walls can be dragged (the mitered corners can't)."
                    : ""}
                </p>
              )}
            </>
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
          {viewMode === "plan" ? (
            <FootprintCanvas
              footprint={footprint}
              shapeTool={shapeTool}
              offsetPx={offsetPx}
              wallSlots={overlayWallSlots}
              wallStartOffsetIn={wallRenderOffsetIn}
              wallThicknessIn={thicknessIn}
              leastAccessibleCorner={leastAccessibleCorner}
              primaryCornerIds={primaryCornerIds}
              isWallLengthEditable={isWallLengthEditable}
              onDraw={handleDraw}
              onToggleOpening={handleToggleOpening}
              onSetLeastAccessibleCorner={handleSetLeastAccessibleCorner}
              onEditWallLength={handleEditWallLength}
              onAddBumpOut={handleAddBumpOut}
              onDragWall={handleDragWall}
            />
          ) : (
            <Building3DView
              footprint={footprint}
              wallSlots={overlayWallSlots}
              wallHeightFt={wallHeightFt}
              thicknessIn={thicknessIn}
              includeNailer={includeNailer}
              primaryCornerIds={primaryCornerIds}
            />
          )}
          {viewMode === "plan" && (
            <p className={styles.note}>
              {shapeTool === "edit"
                ? "Click a tan panel to cycle it: standard → window → door → column → standard."
                : "Switch to Edit mode, then click a tan panel to cycle it: standard → window → door → column → standard."}{" "}
              Gray = corner, dark brown = safety-oct-corner, purple = braced,
              orange = safety/gap, teal = column. A panel hashed orange over
              purple is a safety/gap panel combined with a corner brace (both
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
                  <FoundationCanvas footprint={footprint} offsetPx={offsetPx} piers={pierGrid} />
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
                  <FloorCanvas
                    footprint={footprint}
                    offsetPx={offsetPx}
                    floorPanels={floorPanels}
                    piers={pierGrid}
                    joistLayout={joistLayout}
                  />
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
            <p className={styles.note}>
              Roof editor — coming soon. Once wall and foundation layout are dialed in, roof geometry will build on
              this same footprint.
            </p>
          )}
        </section>

        {windowList.length > 0 && (
          <section>
            <h2>Windows</h2>
            {windowList.map(({ wallId, slotIndex, widthIn }) => (
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
            ))}
          </section>
        )}

        <section>
          <h2>Wall assembly (vapor check)</h2>
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
        </section>

        <section>
          <h2>Project totals</h2>
          <table className={styles.results}>
            <tbody>
              <tr>
                <td>Panels</td>
                <td>
                  {strawSlots.length + openingCounts.windows * 2 + openingCounts.doors}
                  <br />
                  <span className={styles.note}>
                    {strawSlots.length} wall panels + {openingCounts.windows} window header/sill pair
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
                <td>Shear / load capacity</td>
                <td className={styles.pending}>not yet modeled — {shearLoadCapacity.note}</td>
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
        </section>

        <section>
          <h2>Review Log — Items for Engineer/Contractor Review</h2>
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
        </section>

        <section className={styles.relevantPages}>
          <h2>Relevant Detail Pages</h2>
          {relevantDetailPages.length === 0 ? (
            <p className={styles.note}>Draw a footprint below to see the detail/shop-drawing pages that apply to your current design.</p>
          ) : (
            <ul className={styles.relevantPagesList}>
              {relevantDetailPages.map((p) => (
                <li key={p.id}>
                  <a href={`#${p.id}`}>{p.label} →</a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="detail-foundation">
          <h2>Detail Guide Pages</h2>
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
        </section>

        {floorJoistType && (
          <section id="detail-floor" className={styles.anchorTarget}>
            <DetailGuidePage
              title={`Suspended Floor Joists — ${floorJoistType.label}`}
              triggerCondition={`Every suspended-floor design using ${floorJoistType.label} — the thermally-broken rim detail at each short end, plus long-side blocking.`}
              diagram={<FloorJoistDiagram floorJoistTypeId={floorJoistTypeId!} />}
              fastenerSchedule={[]}
              notes={[
                floorJoistType.note,
                joistLayout
                  ? `${joistLayout.joists.length} joists at ${floorJoistType.spacingIn}in o.c. (max), running perpendicular to the longest walls, landing on the perimeter (or a beam over the piers). Field joist depth: panel thickness (${thicknessIn}in) − ${FIELD_JOIST_DEPTH_REDUCTION_IN}in = ${fieldJoistDepthIn}in.`
                  : "Draw a footprint to see the generated joist count.",
                floorRimJoistDetail.note,
                floorLongSideBlockingNote.note,
                ...(perpendicular2x4Enabled ? [perpendicular2x4Addition.note] : []),
              ]}
              role={role}
            />
          </section>
        )}

        {floorJoistType && (
          <section id="detail-floor-assembly" className={styles.anchorTarget}>
            <DetailGuidePage
              title="Floor Structure — Full Assembly"
              triggerCondition="Every suspended-floor design — the full bottom-to-top layer build-up inside and over the joist bays."
              diagram={<FloorAssemblyDiagram />}
              fastenerSchedule={[]}
              notes={floorAssemblyLayers.map((layer) => `${layer.label}: ${layer.description}`)}
              role={role}
            />
          </section>
        )}

        {floorJoistType && (
          <section id="detail-floor-corner" className={styles.anchorTarget}>
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
          </section>
        )}

        {floorJoistType && perpendicular2x4Enabled && (
          <section id="detail-floor-addon" className={styles.anchorTarget}>
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
          </section>
        )}

        {isThermalSlabFloor && (
          <section id="detail-floor-thermal-slab" className={styles.anchorTarget}>
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
          </section>
        )}

        {role !== "public" && (
          <section>
            <h2>Shop Drawings</h2>
            <p className={styles.note}>
              Fabricator/detailer document — one sheet per wall panel type, every individual panel currently in the
              design, named by compass direction (e.g. &quot;N-1&quot; — up is treated as North), with its own
              straw-only and full weight breakdown.
            </p>
            <p className={styles.pending}>
              Standard Panel now has a real 3D model, built member-by-member from its actual BOM geometry. Other
              panel types' reference drawings (the labeled-parts picture) are still placeholders — Tommy still needs
              to provide those real shop-drawing reference images.
            </p>
            {shopDrawings.map(({ panelType, hasWoodBom, instances }) => (
              <div key={panelType.id} id={`shop-${panelType.id}`} className={styles.anchorTarget}>
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
                    ) : panelType.id === "column" || panelType.id === "corner" ? (
                      <StandardPanel3DView
                        members={panelType.id === "column" ? columnPanelMembers : cornerPanelMembers3D}
                        overallDimensions={{ heightIn: wallHeightFt * 12, widthIn: COLUMN_TOTAL_WIDTH_IN, depthIn: thicknessIn }}
                        displayName={panelType.label}
                      />
                    ) : undefined
                  }
                  estimatedBearingLb={
                    panelType.id === "standard" ||
                    panelType.id === "braced" ||
                    panelType.id === "column" ||
                    panelType.id === "corner"
                      ? estimatedStudPackBearingLb
                      : undefined
                  }
                  estimatedShearLb={panelType.id === "braced" ? estimatedBracedShearLb : undefined}
                  instances={instances}
                  role={role}
                />
              </div>
            ))}
            <p className={styles.note}>
              Inclined/gable panel types aren&apos;t placed anywhere in the current layout system yet (no geometry
              produces them), and floor/roof panels don&apos;t exist as a modeled panel system yet either — all
              deferred until those systems are built.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
