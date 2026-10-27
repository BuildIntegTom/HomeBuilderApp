"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls } from "@react-three/drei";
import type { Mesh } from "three";
import {
  applyZonesToSlot,
  computeFieldFramingLayout,
  computeFloorMembraneBandPolygons,
  computeInsetPerimeterRing,
  computeRoofBearingSegments,
  computeWallVerticalBandsForSlotWithMaxHeight,
  effectiveZonesForSlot,
  isSlotBoxBeamCovered,
  builtWallSpan,
  deckPanelPlacements,
  footprintSpanAndRun,
  simpleRoofPlanes,
  defaultTransparentRoofFacing,
  panelSlotBoxes3D,
  wallAxis,
  type BoxBeamCoverage,
  type CornerId,
  type Footprint,
  type PanelSlot,
  type PanelSlotBox3D,
  type WallRunStop,
} from "@building-integrity/geometry";
import { allPanelInstances, combinedPanelLabel, type PanelInstance } from "./panelInstances";
import { midWallBeamsToGeometry, resolveMidWallBeamAssemblyHeightIn, type MidWallBeam } from "./midWallBeam";
import { resolveSpanningHeaderHeightIn, spanningHeadersToGeometry, wallBandGeometry, type SpanningHeader } from "./spanningHeader";
import { NAMED_PANEL_TYPE_COLORS } from "./panelColors";
import { resolveBracedStyle } from "./bracedStyle";
import PanelLabel from "./PanelLabel";
import {
  BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_GAP_DEFAULT_IN,
  BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN,
  baleFoundationRingPlan,
  baleFoundationTopFaceZIn,
  buildDoubledStackPair,
  buildFloorBottomSkinMembers,
  buildFramingStackMembers,
  buildFloorRoofPanelMembers,
  buildRoofCatcherBeamMembers,
  buildStructuralColumnMembers,
  ridgeBeamLayout,
  ROOF_CATCHER_BEAM_DEPTH_IN,
  planFloorRoofPanelWidthsIn,
  STEEL_MESH_THICKNESS_IN,
  SUBFLOOR_DEPTH_DEFAULT_IN,
  BOX_BEAM_SIZE_DEFAULT,
  bracingStyleToPatternMirror,
  buildBoxBeamMembers,
  buildBigHeaderBeamMembers,
  buildBigHeaderMembers,
  bigHeaderDefaultHeightIn,
  buildBracedPanelMembers,
  buildBuildingObj,
  buildColumnPanelMembers,
  buildCornerPanelMembers,
  buildGablePanelMembers,
  buildOpeningAssemblyMembers,
  buildSafetyGapMembers,
  buildSquareBaleCornerPanelMembers,
  buildSquareBalePanelMembers,
  buildStandardPanelMembers,
  buildTrussPlateMembers,
  buildVerticalGapFillerMembers,
  computeBoxBeamAssemblyHeightIn,
  computeBoxBeamHeightDeltaIn,
  computeStandardGirtRowCount,
  computeDoorRoughOpeningHeightIn,
  computeSharedRooflineBearingHeightIn,
  doorRoughOpeningSelectedHeightIn,
  panelHeightInRange,
  sillDefaultHeightIn,
  sillHeaderHeightInRange,
  standardWindowHeightDefaultIn,
  toeUpHeightIn,
  wallAssemblyLayers,
  type BoxBeamSizeId,
  type BracingStyle,
  type JackStudConfig,
  type PanelMember,
  type StudConfig,
  type WorldPlacedPanel,
} from "@building-integrity/panel-catalog";
import PanelMembersGroup from "./PanelMembersGroup";
import { PANEL_TYPE_COLORS } from "./panelColors";
import { computeOpeningGeometry } from "./openingGeometry";
import { useBrowsing } from "./BrowseModeContext";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 480;
const BIRDS_EYE_ELEVATION_DEG = 50;
const BIRDS_EYE_AZIMUTH_DEG = 45; // a corner/3-quarter starting view, not straight-on
const IN_PER_FT = 12;
const BLOB_COLOR = "#b5b0a8";
// Roof-bearing member (truss plate / box beam) isn't a NamedPanelType (no
// panel instance identity — see roofBearingRenderData), so it has no home
// in panelColors.ts's NAMED_PANEL_TYPE_COLORS; a plain neutral lumber tone.
const ROOF_BEARING_COLOR = "#c2a878";
const EMPTY_ID_SET: Set<string> = new Set();
const EMPTY_GABLE_TILES_BY_WALL_ID: Record<string, { widthIn: number; xStartIn: number; leftEdgeHeightIn: number; rightEdgeHeightIn: number }[]> =
  {};
const EMPTY_BOX_BEAM_COVERAGE_BY_WALL_ID: Record<string, BoxBeamCoverage> = {};
const EMPTY_MID_WALL_BEAMS_BY_WALL_ID: Record<string, MidWallBeam[]> = {};
// Stable empty defaults, same reason the beam one above exists: a fresh
// object literal in a default parameter is a new identity every render and
// would defeat every memo that lists it.
const EMPTY_SPANNING_HEADERS_BY_WALL_ID: Record<string, SpanningHeader[]> = {};
const EMPTY_SPANNING_HEADER_NAMES: Map<string, string> = new Map();
// Standard click-vs-drag screen-space threshold (px) before the Orbit
// tool's click-and-swipe re-centering commits — a plain click stays a
// true no-op below this.
const ORBIT_RETARGET_DRAG_THRESHOLD_PX = 5;

interface Bounds {
  centerX: number;
  centerZ: number;
  maxDim: number;
}

function footprintBounds(footprint: Footprint): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const c of footprint.corners) {
    minX = Math.min(minX, c.point.x);
    maxX = Math.max(maxX, c.point.x);
    minZ = Math.min(minZ, c.point.y);
    maxZ = Math.max(maxZ, c.point.y);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    maxDim: Math.max(maxX - minX, maxZ - minZ, 10),
  };
}

/** Initial camera position for a "bird's-eye at `BIRDS_EYE_ELEVATION_DEG`"
 * starting view, auto-fit to the footprint's size — distance is a rough
 * multiple of the footprint's largest dimension, not a tight/exact fit
 * (this is a starting point; `OrbitControls` lets the view be adjusted
 * freely from there). */
function birdsEyeCameraPosition(bounds: Bounds): [number, number, number] {
  const distance = bounds.maxDim * 1.6;
  const elevationRad = (BIRDS_EYE_ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (BIRDS_EYE_AZIMUTH_DEG * Math.PI) / 180;
  const height = distance * Math.sin(elevationRad);
  const horizontal = distance * Math.cos(elevationRad);
  return [
    bounds.centerX + horizontal * Math.cos(azimuthRad),
    height,
    bounds.centerZ + horizontal * Math.sin(azimuthRad),
  ];
}

/** Real, real-height door Rough Opening height — see
 * computeDoorRoughOpeningHeightIn's own doc comment. A window's RO height is
 * its own `PanelSlot.heightIn` instead (Tommy: "i want each window
 * individually adjustable"), falling back to `standardWindowHeightDefaultIn`
 * when uncustomized — both openings' headers fill the real remaining space
 * up to the wall's own top plate, via `computeHeaderHeightIn`. */
const DOOR_RO_HEIGHT_IN = computeDoorRoughOpeningHeightIn(doorRoughOpeningSelectedHeightIn.value, toeUpHeightIn.value);

// Each window carries its own sill/RO height (Tommy: "manipulate sill and
// header height with the drag tool" / "i want each window individually
// adjustable") — falls back to the project default when this particular
// slot hasn't been customized. A door's RO always starts at the floor
// (sillHeightIn 0) and uses the fixed real door RO height, not a window's
// slot.heightIn field.
function resolveSillHeightIn(slot: PanelSlot, isDoor: boolean): number {
  return isDoor ? 0 : (slot.sillHeightIn ?? sillDefaultHeightIn.value);
}
function resolveJackStudSpanIn(slot: PanelSlot, isDoor: boolean): number {
  return isDoor ? DOOR_RO_HEIGHT_IN : (slot.heightIn ?? standardWindowHeightDefaultIn.value);
}

/** Real member geometry for every panel type, including window/door
 * openings (Tommy: "why arent the RO's, headers, and sills spawning into
 * the 3d drawing... fill them in") — a whole opening (header + both jack
 * studs + sill(s) for windows) via buildOpeningAssemblyMembers, correctly
 * Z-positioned within the slot's own box. Safety/Gap (including one
 * combined with a corner brace — its bracing itself still isn't modeled in
 * 3D, only its own plywood sheet) is just a single 3/4in plywood sheet now,
 * not an altered Standard Panel. Under Square Bale Panels (Tommy's
 * panelization type), a "standard"-typed slot is actually a Square Bale
 * Panel (blocking-girt construction), not a loose-pack Standard Panel. */
function membersForSlot(
  slot: PanelSlot,
  thicknessIn: number,
  heightIn: number,
  includeNailer: boolean,
  isSquareBalePanelization: boolean,
  squareBaleStudConfig: StudConfig,
  bracingStyle: BracingStyle,
  nailerOffsetIn: number,
  jackStudConfig: JackStudConfig,
  standardWidthIn: number,
  // A Mid-Wall Bond Beam can split a "braced" slot into its own separate
  // bands, each sized to `heightIn` above — a band too short to even
  // warrant a Standard Panel's own girt (computeStandardGirtRowCount === 0)
  // is also too short to properly anchor a diagonal brace's own required
  // middle girt row (computeBracedGirtRowCount floors at 3, never scaling
  // down), so it degrades to a plain "standard" instance instead — see
  // panelInstances.ts's own doc comment on this same degrade. A still-tall
  // band next to a beam keeps its real bracing unaffected.
  isMidWallBandAffected: boolean,
): PanelMember[] | null {
  switch (slot.type) {
    case "standard":
      return isSquareBalePanelization
        ? buildSquareBalePanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer, squareBaleStudConfig, nailerOffsetIn)
        : buildStandardPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer);
    case "braced": {
      if (isMidWallBandAffected && computeStandardGirtRowCount(heightIn) === 0) {
        return buildStandardPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer);
      }
      const defaultStyle = bracingStyleToPatternMirror(bracingStyle);
      const style = resolveBracedStyle(slot, defaultStyle.pattern, defaultStyle.mirrored);
      return buildBracedPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer, style.pattern, style.mirrored);
    }
    case "column":
      return buildColumnPanelMembers(thicknessIn, heightIn, includeNailer);
    case "big-header":
      return buildBigHeaderMembers(
        slot.widthIn,
        thicknessIn,
        slot.heightIn ?? bigHeaderDefaultHeightIn.value,
        slot.includeSillOnBigHeader ?? false,
        jackStudConfig,
      );
    case "corner":
    case "safety-oct-corner":
      // Square Bale Panels' corner is a wider, asymmetric-stud construction
      // (Tommy: "standard size at 39in") matching the 39in slot the tiling
      // system already reserves for it under this panelization type (see
      // cornerWidthInForTiling in page.tsx) — the plain fixed-25.5in
      // Column/Corner unit only applies to every other panelization type.
      //
      // ⚠ `slot.widthIn`, not the nominal 25.5in. A corner slot is NOT a fixed
      // unit: merge and clamp size it down, and corner absorb widens a pair to
      // share a wall in the 51in-75.5in band (so a 72in wall is two 36in corner
      // panels, and every octagon 10.5ft-15ft across is built of them). With
      // the nominal hard-coded here, such a wall rendered 25.5in of framing in
      // a 36in box — visibly short by up to 21in in Framed 3D and in the OBJ
      // export, since `toWorldPlacedPanel` places these members as-is and
      // performs no width fit. Square Bale's corner stays fixed: its 39in
      // whole-bale body genuinely cannot be built another width, which is why
      // the tiler never widens it (see `cornerMayWidenForTiling`).
      return isSquareBalePanelization
        ? buildSquareBaleCornerPanelMembers(thicknessIn, heightIn, includeNailer, nailerOffsetIn)
        : buildCornerPanelMembers(thicknessIn, heightIn, includeNailer, slot.widthIn);
    case "safety-gap":
      return buildSafetyGapMembers(thicknessIn, heightIn);
    case "window":
    case "door": {
      const isDoor = slot.type === "door";
      const g = computeOpeningGeometry(
        isDoor,
        slot.widthIn,
        heightIn,
        resolveSillHeightIn(slot, isDoor),
        resolveJackStudSpanIn(slot, isDoor),
        jackStudConfig,
        standardWidthIn,
      );
      return buildOpeningAssemblyMembers(
        slot.widthIn,
        thicknessIn,
        isDoor ? "door" : "window",
        jackStudConfig,
        g.sillHeightIn,
        g.jackStudSpanIn,
        g.headerHeightIn,
        g.sillHeightIn,
        g.sillWidthsIn,
        includeNailer,
      );
    }
    default:
      return null;
  }
}

/** Keys every instance by the single rendered slot it came from — a
 * window/door slot produces multiple instances (1 header + however many
 * sills share its run) sharing one `wallId`+`slotIndexInWall` (see
 * `panelInstances.ts`'s own doc comment), everything else exactly 1. */
/** A slot box, post-processed for a Mid-Wall Bond Beam split — `yOffsetFt`
 * is this box's own offset in FEET from its story's own floor, ADDED to
 * the story `<group>`'s flat Y position, since a beam-affected wall's own
 * above-band box no longer starts at that story's own floor the way every
 * other box still does. `isTopmostBand` marks whichever band (the last
 * one, bottom-to-top — see computeWallVerticalBandsForSlotWithMaxHeight) actually
 * reaches the story's own ceiling; a roofline Box Beam's own per-slot
 * height reduction (see secondStorySlotBoxes below) only ever applies
 * there, since that shortening always comes from the very top of the row
 * regardless of how many bond beams also split it lower down. */
interface SplitPanelSlotBox3D extends PanelSlotBox3D {
  yOffsetFt: number;
  midWallBandIndex?: number;
  isTopmostBand: boolean;
  /** Which of this slot's own independently-typed vertical zones (see
   * PanelSlotZone) this box renders — undefined for an unsplit slot (a
   * single real band). Real (0 = bottom-most) for any split slot, beam-
   * driven or height-driven alike (Stride 2), index-matched to
   * `midWallBandIndex`. */
  zoneIndex?: number;
}

/** Splits every box on a beam-covered OR max-height-split slot into its
 * own real per-band boxes — different slots of the SAME wall can see
 * different band counts now (each beam has its own horizontal coverage
 * range, and a beam-free slot can independently auto-split by
 * `maxPanelHeightIn`), so bands are computed per slot, not once for the
 * whole wall. Stride 2: a beam-covered slot and a beam-free split slot go
 * through the SAME zone-aware banding — every band gets its own real,
 * independently-typed PanelSlotZone (falling back to
 * `effectiveZonesForSlot`'s "standard" padding until something reconciles
 * real zone data into `slot.zones`), instead of a beam-affected slot
 * sharing one type across every band. Each split band gets a synthetic
 * per-band `slot` (via applyZonesToSlot) so `membersForSlot`'s own type
 * dispatch (which only ever reads a slot's top-level fields) builds the
 * right member geometry for that zone. A slot with only 1 real band (no
 * beam, short enough to fit under `maxPanelHeightIn`) stays a single,
 * unsplit box — same "unaffected = unchanged" contract Stage 1 had. */
function splitForMidWallBeam(
  boxes: PanelSlotBox3D[],
  beamsByWallId: Record<string, MidWallBeam[]>,
  storyHeightIn: number,
  maxPanelHeightIn: number,
  /** Smearforn Stage 2b. A spanning header splits a column exactly as a beam
   * does, so it belongs in the SAME band computation — otherwise 3D would
   * draw a full-height panel through a header the elevation and the named
   * instance list have both already made room for. */
  headersByWallId: Record<string, SpanningHeader[]> = {},
): SplitPanelSlotBox3D[] {
  const result: SplitPanelSlotBox3D[] = [];
  const wallIds = new Set([...Object.keys(beamsByWallId), ...Object.keys(headersByWallId)]);
  const geomByWallId = new Map(
    [...wallIds].map((wallId) => [
      wallId,
      wallBandGeometry(midWallBeamsToGeometry(beamsByWallId[wallId] ?? []), spanningHeadersToGeometry(headersByWallId[wallId] ?? [])),
    ]),
  );
  for (const box of boxes) {
    const geom = geomByWallId.get(box.wallId) ?? [];
    const bands = computeWallVerticalBandsForSlotWithMaxHeight(box.slotIndex, storyHeightIn, geom, maxPanelHeightIn, panelHeightInRange.minIn);
    const isGenuinelyUnaffected = bands.length === 1 && bands[0]!.bottomIn === 0 && bands[0]!.topIn === storyHeightIn;
    if (isGenuinelyUnaffected) {
      result.push({ ...box, yOffsetFt: 0, isTopmostBand: true });
      continue;
    }
    // bands.length === 0 (a beam consumes this slot's ENTIRE story
    // height): pushes nothing — no real box exists there, not a phantom
    // full-height one. 1 partial band or 2+ real bands: each gets its own
    // real per-band box/zone below.
    const zones = effectiveZonesForSlot(box.slot, bands.length);
    bands.forEach((band, i) => {
      result.push({
        ...box,
        slot: applyZonesToSlot(box.slot, [zones[i]!]),
        yOffsetFt: band.bottomIn / IN_PER_FT,
        heightFt: (band.topIn - band.bottomIn) / IN_PER_FT,
        midWallBandIndex: band.bandIndex,
        zoneIndex: i,
        isTopmostBand: i === bands.length - 1,
      });
    });
  }
  return result;
}

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

/** A Mid-Wall Bond Beam-affected slot shares one wallId+slotIndex key
 * across its stacked-band instances (same convention a window's own
 * header+sill already use) — this narrows the lookup to just the one
 * band this particular box belongs to, so its label isn't a merge of
 * every band's names. A box with no band (unaffected wall) returns every
 * instance for that key unfiltered, exactly today's behavior. */
function instancesForBox(instancesBySlot: Map<string, PanelInstance[]>, box: SplitPanelSlotBox3D): PanelInstance[] {
  const all = instancesBySlot.get(`${box.wallId}-${box.slotIndex}`) ?? [];
  if (box.midWallBandIndex === undefined) return all;
  return all.filter((i) => i.midWallBandIndex === box.midWallBandIndex);
}

const LABEL_MIN_WIDTH_FT = 0.5;
// Tommy: "double the size of the box view labeling".
const LABEL_SIZE_MULTIPLIER = 2;

/** Each simplified box's own panel-name label, on 3 of its faces (Tommy:
 * "the specific panel label... on the top, largest exterior face... as if
 * looking at it from the exterior" plus, later, "add the label on the top
 * and right side of each panel") — same double-outline white-fill look as
 * the 2D plan view's panel labels, via the shared `PanelLabel`. A slot's
 * box origin is always its EXTERIOR face at local Z=0 (see
 * `panelSlotBoxes3D`'s own doc comment: "Z=depth from the exterior face at
 * the anchor"), so:
 * - Front: sits just outside that face (Z slightly negative), rotated
 *   180deg around Y — a rigid turn-around, not a mirror — so it reads
 *   correctly for a viewer standing outside the building looking at the
 *   wall's exterior face.
 * - Top: sits just above the box's top edge, rotated -90deg around X to
 *   face straight up, for a viewer looking straight down.
 * - Right: sits just past the box's +X edge (its right side as drawn,
 *   i.e. "right" per the wall's own local frame), rotated 90deg around Y
 *   to face outward, for a viewer standing to that side looking back.
 * Skipped entirely for anything too narrow to hold legible text on its
 * front face (e.g. a 0.75in Safety/Gap sheet). */
function WallPanelLabel({
  text,
  widthFt,
  heightFt,
  depthFt,
  faces = ["front", "top", "right"],
}: {
  text: string | undefined;
  widthFt: number;
  heightFt: number;
  depthFt: number;
  /** Which faces to label (Tommy: carry the box-view labeling into 3D
   * Framed mode, but "only to the top plate area") — defaults to all 3 so
   * every existing box-mode call site is unaffected. */
  faces?: ("front" | "top" | "right")[];
}) {
  if (!text || widthFt < LABEL_MIN_WIDTH_FT) return null;
  const frontFontSize = Math.max(0.12, Math.min(0.35, heightFt * 0.15, widthFt * 0.3)) * LABEL_SIZE_MULTIPLIER;
  const topFontSize = Math.max(0.1, Math.min(0.3, widthFt * 0.25, depthFt * 0.6)) * LABEL_SIZE_MULTIPLIER;
  const rightFontSize = Math.max(0.1, Math.min(0.3, heightFt * 0.12, depthFt * 0.6)) * LABEL_SIZE_MULTIPLIER;
  return (
    <>
      {faces.includes("front") && (
        <PanelLabel
          text={text}
          position={[widthFt / 2, heightFt - frontFontSize * 1.3, -0.02]}
          rotation={[0, Math.PI, 0]}
          fontSize={frontFontSize}
        />
      )}
      {faces.includes("top") && (
        <PanelLabel
          text={text}
          position={[widthFt / 2, heightFt + 0.02, depthFt / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={topFontSize}
        />
      )}
      {faces.includes("right") && (
        <PanelLabel
          text={text}
          position={[widthFt + 0.02, heightFt / 2, depthFt / 2]}
          rotation={[0, Math.PI / 2, 0]}
          fontSize={rightFontSize}
        />
      )}
    </>
  );
}

interface WrapSkin {
  color: string;
  coverageKind: "wall-and-roof-interior-surface" | "opening-sill-perimeter";
  side: "interior" | "exterior";
}

/** Which checked products get a 3D Wraps skin (Tommy: "most things dont
 * need an elaborate model, just a skin of color... on the face surface
 * area") — only products with both a `skinColor` AND a coverage rule this
 * view knows how to draw (a whole-surface color, or a sill strip);
 * Tescon Vana (seam-tape-for) is quantity-only, no 3D geometry yet — see
 * the module doc comment on renderSimplifiedSlot. */
function checkedWrapSkins(checkedIds: Set<string>, side: "interior" | "exterior"): WrapSkin[] {
  const skins: WrapSkin[] = [];
  for (const l of wallAssemblyLayers) {
    if (!checkedIds.has(l.id) || !l.skinColor) continue;
    if (l.coverageRule?.kind === "wall-and-roof-interior-surface" || l.coverageRule?.kind === "opening-sill-perimeter") {
      skins.push({ color: l.skinColor, coverageKind: l.coverageRule.kind, side });
    }
  }
  return skins;
}

const SKIN_THICKNESS_FT = 0.02;
// Stacks 2+ skins checked on the same face slightly apart so they don't
// z-fight (Tommy: "just a skin of color... on the face surface area" —
// illustrative layering, not real material thickness).
const SKIN_STACK_STEP_FT = 0.03;

/** One flush-face colored overlay per full-surface skin checked on a side
 * — interior skins stack outward from the interior face (Z=depthFt),
 * exterior skins stack outward from the exterior face (Z=0), per the
 * panel-space convention `panelSlotBoxes3D` already establishes. */
function renderWallSkins(widthFt: number, heightFt: number, depthFt: number, skins: WrapSkin[]) {
  const wallSkins = skins.filter((s) => s.coverageKind === "wall-and-roof-interior-surface");
  return wallSkins.map((skin, i) => {
    const z = skin.side === "interior" ? depthFt + SKIN_STACK_STEP_FT * i : -SKIN_STACK_STEP_FT * i;
    return (
      <mesh key={`${skin.side}-${skin.color}-${i}`} position={[widthFt / 2, heightFt / 2, z]}>
        <boxGeometry args={[widthFt, heightFt, SKIN_THICKNESS_FT]} />
        <meshStandardMaterial color={skin.color} transparent opacity={0.5} side={2} />
      </mesh>
    );
  });
}

/** Same idea as renderWallSkins, but only for a sill's own (narrower)
 * box — Exto Seal (Tommy: "Exto Seal is for window and door sills"). Only
 * ever called for a WINDOW sill box — doors have no sill box in this
 * model at all (floor-level RO), so a door's Exto Seal contribution is
 * quantity-only, not drawn. */
function renderSillSkins(sillWidthFt: number, sillHeightFt: number, depthFt: number, skins: WrapSkin[]) {
  const sillSkins = skins.filter((s) => s.coverageKind === "opening-sill-perimeter");
  return sillSkins.map((skin, i) => {
    const z = skin.side === "interior" ? depthFt + SKIN_STACK_STEP_FT * i : -SKIN_STACK_STEP_FT * i;
    return (
      <mesh key={`${skin.side}-${skin.color}-${i}`} position={[sillWidthFt / 2, sillHeightFt / 2, z]}>
        <boxGeometry args={[sillWidthFt, sillHeightFt, SKIN_THICKNESS_FT]} />
        <meshStandardMaterial color={skin.color} transparent opacity={0.7} side={2} />
      </mesh>
    );
  });
}

/** One simplified-mode slot (Tommy: "for panels to appear as their
 * respective color and just appear as the primary 3D shapes that they
 * are"), now split into a real header box + sill box(es) for a window/door
 * instead of one undivided placeholder (Tommy: "i want headers and sills
 * in the 3d box view to appear as separate panels") — reuses the exact
 * same `computeOpeningGeometry` the full member view builds from, so the
 * two can never drift apart on where the header/sill actually sit. Each
 * box gets its own `PanelLabel` from `instances` (that slot's own ordered
 * `PanelInstance[]` — header first, then each sill, matching
 * `panelInstances.ts`'s own push order).
 *
 * `showWraps`/`wrapSkins` (Tommy: "3d model selected after box mode and is
 * everything box mode is with a few changes: panels not labeled, and the
 * 3D models of the wraps appear") — `showWraps` suppresses every label;
 * `wrapSkins` adds a thin colored overlay per checked product with a
 * drawable coverage rule. Window/door openings themselves don't get a
 * whole-surface skin (the opening is the actual hole in the wall, not
 * wall surface) — only the header box does, since it's still real wall
 * material above the RO. */
function renderSimplifiedSlot(
  box: PanelSlotBox3D,
  heightIn: number,
  jackStudConfig: JackStudConfig,
  standardWidthIn: number,
  instances: PanelInstance[],
  showWraps: boolean,
  wrapSkins: WrapSkin[],
) {
  const slot = box.slot;
  if (slot.type === "window" || slot.type === "door") {
    const isDoor = slot.type === "door";
    const g = computeOpeningGeometry(
      isDoor,
      slot.widthIn,
      heightIn,
      resolveSillHeightIn(slot, isDoor),
      resolveJackStudSpanIn(slot, isDoor),
      jackStudConfig,
      standardWidthIn,
    );
    const headerHeightFt = g.headerHeightIn / IN_PER_FT;
    const headerYFt = g.roTopZIn / IN_PER_FT;
    const headerName = instances.find((i) => i.panelType === "header")?.name;
    const sillInstances = instances.filter((i) => i.panelType === "sill");
    let sillCursorFt = g.jackThicknessIn / IN_PER_FT;
    return (
      <>
        <mesh position={[box.widthFt / 2, headerYFt + headerHeightFt / 2, box.depthFt / 2]}>
          <boxGeometry args={[box.widthFt, headerHeightFt, box.depthFt]} />
          <meshStandardMaterial color={NAMED_PANEL_TYPE_COLORS.header} transparent opacity={0.6} />
        </mesh>
        <group position={[0, headerYFt, 0]}>
          <WallPanelLabel text={showWraps ? undefined : headerName} widthFt={box.widthFt} heightFt={headerHeightFt} depthFt={box.depthFt} />
          {showWraps && renderWallSkins(box.widthFt, headerHeightFt, box.depthFt, wrapSkins)}
        </group>
        {!isDoor &&
          g.sillWidthsIn.map((sillWidthIn, i) => {
            const sillWidthFt = sillWidthIn / IN_PER_FT;
            const xFt = sillCursorFt;
            sillCursorFt += sillWidthFt;
            const sillHeightFt = g.sillHeightIn / IN_PER_FT;
            return (
              <group key={i} position={[xFt, 0, 0]}>
                <mesh position={[sillWidthFt / 2, sillHeightFt / 2, box.depthFt / 2]}>
                  <boxGeometry args={[sillWidthFt, sillHeightFt, box.depthFt]} />
                  <meshStandardMaterial color={NAMED_PANEL_TYPE_COLORS.sill} transparent opacity={0.6} />
                </mesh>
                <WallPanelLabel
                  text={showWraps ? undefined : sillInstances[i]?.name}
                  widthFt={sillWidthFt}
                  heightFt={sillHeightFt}
                  depthFt={box.depthFt}
                />
                {showWraps && renderSillSkins(sillWidthFt, sillHeightFt, box.depthFt, wrapSkins)}
              </group>
            );
          })}
      </>
    );
  }
  return (
    <>
      <mesh position={[box.widthFt / 2, box.heightFt / 2, box.depthFt / 2]}>
        <boxGeometry args={[box.widthFt, box.heightFt, box.depthFt]} />
        <meshStandardMaterial color={PANEL_TYPE_COLORS[slot.type]} transparent opacity={0.6} />
      </mesh>
      <WallPanelLabel text={showWraps ? undefined : instances[0]?.name} widthFt={box.widthFt} heightFt={box.heightFt} depthFt={box.depthFt} />
      {showWraps && renderWallSkins(box.widthFt, box.heightFt, box.depthFt, wrapSkins)}
    </>
  );
}

/** Enough to see the framing through, not so little it vanishes. */
const ROOF_SEE_THROUGH_OPACITY = 0.25;

interface Building3DViewProps {
  footprint: Footprint | null;
  wallSlots: Record<string, PanelSlot[]>;
  wallHeightFt: number;
  /** A wall column taller than this auto-splits into stacked, independently-
   * typed zones (page.tsx's own `maxPanelHeightIn`) — only applied to a
   * slot with NO covering Mid-Wall Bond Beam, same restriction
   * allPanelInstances' own maxPanelHeightIn param already has (Stride 1). */
  maxPanelHeightIn: number;
  thicknessIn: number;
  includeNailer: boolean;
  primaryCornerIds: Set<string>;
  /** Stage 3 "a wall that simply ends" — inches at each end of a wall that
   * are deliberately NOT built. **In 3D nothing at all is drawn there**: a
   * ghost solid would read as a wall that exists, which is exactly
   * backwards. Absent/empty = every wall fully panelized, unchanged. */
  wallRunStopsByWallId?: Record<string, WallRunStop>;
  /** Each wall's UNSTOPPED tiling length — the base a stop is clamped
   * against, so this view and page.tsx's own totals cannot disagree. */
  wallTilingLengthInByWallId?: Record<string, number>;
  /** A second story stacked at `wallHeightFt`'s top-plate height, sharing
   * the ground floor's footprint (Tommy: "an option for adding a second
   * level of panels"). `wallSlots` here is a genuinely independent copy of
   * data (see page.tsx's `Story` type/`secondStory` state) — no longer the
   * same object reference the ground floor's own `wallSlots` prop uses —
   * though there's still no editing UI wired up for it yet, so it starts as
   * a mirror of the ground floor and stays that way until a real per-story
   * editor exists. Undefined/null = single story, unchanged from before. */
  secondStory?: { wallHeightFt: number; wallSlots: Record<string, PanelSlot[]> } | null;
  /** Square Bale Panels panelization type (Tommy) — "standard"-typed slots
   * are Square Bale Panels (blocking-girt construction), not loose-pack
   * Standard Panels, when true. */
  isSquareBalePanelization?: boolean;
  /** Square Bale Panel-only stud config + nailer slide offset — ignored
   * when `isSquareBalePanelization` is false. */
  squareBaleStudConfig?: StudConfig;
  /** Which diagonal-brace pattern every "braced"-typed slot uses,
   * project-wide (Tommy: "add another bracing option... Hatch Forward,
   * and Hatch Back"). */
  bracingStyle?: BracingStyle;
  nailerOffsetIn?: number;
  /** Jack stud construction + standard panel width — feed window/door
   * opening assemblies (header/jack-studs/sill) via buildOpeningAssemblyMembers. */
  jackStudConfig: JackStudConfig;
  standardWidthIn: number;
  /** Bale Foundation floor system (Tommy: "the default option is the
   * double 2x6 + 1.5in gap 'bale foundation'") — Ring A/Ring B/field-stack
   * geometry renders only when true, purely additive below the wall's own
   * existing Z=0 (see baleFoundationTopFaceZIn in panel-catalog). */
  isBaleFoundationFloor?: boolean;
  /** Draw the floor deck's own panels. Gated by the Floors scope checkbox
   * in page.tsx, then by the layer toggle beside the 3D view. */
  showFloorPanels?: boolean;
  /** Draw the roof deck's panels. Same two gates, Roof scope. */
  showRoofPanels?: boolean;
  /** The roof's pitch, so its panels can be laid on the slope instead of
   * flat. Without one there is no plane to lay them on and the deck is
   * withheld. */
  roofPitchIn12?: number;
  /** Height of the roof's LOW edge above the floor. */
  roofEaveHeightFt?: number;
  /** Two planes meeting at a ridge, or one falling across the building. */
  roofForm?: "shed" | "peaked";
  roofTallSideNorth?: boolean;
  /** Draw the whole roof solid. Off by default: half of it is see-through so
   * the building can be looked into without turning the deck off entirely. */
  roofDeckSolid?: boolean;
  baleFoundationTopDepthIn?: number;
  baleFoundationBottomDepthIn?: number;
  baleFoundationGapIn?: number;
  baleFoundationFieldSpacingIn?: number;
  /** Rodent/air-sealed steel bottom skin (Tommy: "a default option to add
   * to the bottom of the lowest floor framing member") — only meaningful
   * alongside isBaleFoundationFloor. */
  floorBottomSkinEnabled?: boolean;
  /** Site-wide "least accessible corner" marker (page.tsx's own
   * `leastAccessibleCorner`) — the floor bottom skin's 3 opacity bands
   * (Tommy: "dividing the space into one side being opaque and the other
   * side being 75% opaque followed by 50%") radiate from this corner's own
   * resolved point. Missing/no match on `footprint.corners` falls back to
   * the bounding box's own min corner. */
  leastAccessibleCorner?: CornerId;
  /** Real per-wall Gable End Panel tiles (page.tsx's own `gableTilesByWallId`
   * memo, already the single source of truth the Panel Fabrication pages
   * use) — each tile's `leftEdgeHeightIn`/`rightEdgeHeightIn` are absolute
   * (floor-relative) real heights at this tile's own local x=0 (left) and
   * x=widthIn (right), matching how they're stored everywhere else; either
   * can be the taller one (see buildGablePanelMembers's own doc comment on
   * why order matters). This component subtracts its own `roofBaseHeightIn`
   * before building real member geometry, same as page.tsx does, without
   * reordering. Empty/missing wall = no gable tiles there. */
  gableTilesByWallId?: Record<
    string,
    {
      widthIn: number;
      xStartIn: number;
      leftEdgeHeightIn: number;
      rightEdgeHeightIn: number;
      isSafetyGap?: boolean;
      verticalGapIn?: { leftIn: number; rightIn: number };
      /** This tile has been split into a window (Tommy: "add an option to
       * click-edit gable end panels to become window gable end panels...
       * dont forget jack studs") — rendered as jack studs + sill below,
       * and a reduced-height Gable End Panel cap above the window's own
       * RO-top instead of one full-height tile. */
      isWindow?: boolean;
      windowHeightIn?: number;
      windowSillHeightIn?: number;
      /** The auto-centered structural Column Panel reserved under a
       * single-peak roofline (Tommy: "panels/beam" mode) — rendered as a
       * real Column Panel via buildColumnPanelMembers, not the sloped
       * Gable End Panel shape every other tile uses. */
      isColumn?: boolean;
    }[]
  >;
  /** Whether the Roof system is in scope at all (page.tsx's own
   * `roofEnabled` checkbox) — gates whether a roof-bearing (truss plate/box
   * beam) member renders atop every wall. */
  roofEnabled?: boolean;
  /** Truss plate's own inset from each wall's true corners (page.tsx's
   * `trussPlateInsetIn`) — unused for box beam, which has no inset. */
  trussPlateInsetIn?: number;
  /** Which walls (and exactly which of their own 2nd-story slots) have a
   * Box Beam rather than a Truss Plate (page.tsx's
   * `boxBeamCoverageByWallId`) — only meaningful when `secondStory` is
   * set. Empty/missing = every wall uses a Truss Plate along its own full
   * length, same as before this was a per-wall/per-section choice. */
  boxBeamCoverageByWallId?: Record<string, BoxBeamCoverage>;
  /** Which box-beam size/material every selected wall uses, project-wide
   * (page.tsx's `boxBeamSizeId`) — see BOX_BEAM_SIZE_OPTIONS. */
  boxBeamSizeId?: BoxBeamSizeId;
  /** Which walls (ground floor) have one or more Mid-Wall Bond Beams
   * (page.tsx's own `midWallBeamsByStoryAndWallId.ground`) — a wall with
   * no entry renders exactly as before this feature existed. Bands are
   * computed internally per slot (each beam has its own horizontal
   * coverage range, so different slots of the same wall can see different
   * band counts) via computeWallVerticalBandsForSlotWithMaxHeight, not pre-resolved by
   * the caller. */
  midWallBeamsByWallId?: Record<string, MidWallBeam[]>;
  /** Same as `midWallBeamsByWallId`, for the second story. */
  secondStoryMidWallBeamsByWallId?: Record<string, MidWallBeam[]>;
  /** Smearforn Stage 2b's spanning ("triple") headers, ground floor
   * (page.tsx's own `spanningHeadersByStoryAndWallId.ground`). Fed into the
   * SAME per-slot band computation the beams go through, so the panels
   * beneath a header are built shorter here exactly as they are in the
   * elevation, and the header itself is drawn as real member geometry.
   * A wall with no entry renders exactly as before this feature existed. */
  spanningHeadersByWallId?: Record<string, SpanningHeader[]>;
  /** Same, second story. */
  secondStorySpanningHeadersByWallId?: Record<string, SpanningHeader[]>;
  /** Each header's own building-wide name (`H1`), by header id — used for
   * the OBJ export's group label, so an exported scene names a header the
   * same way the sheet does. Resolved once in page.tsx; never re-derived
   * here, since two independent numberings of one series is how a drawing
   * and a sheet come to disagree. */
  spanningHeaderNameById?: Map<string, string>;
  /** Renders a static, non-interactive SE bird's-eye frame instead of the
   * normal orbit-able preview — used to capture a PNG for the Project
   * Summary page's static rendering (Tommy: "a static 3d rendering image
   * from a SE birdseye view"). Reuses the exact same camera math
   * (birdsEyeCameraPosition) as the interactive preview's own default
   * starting angle, so the two stay visually consistent. */
  captureMode?: boolean;
  /** Called with a `data:image/png` URL of the capture-mode frame, shortly
   * after the scene first renders **and again after every change to it** —
   * so the Project Summary's static rendering is the design the user
   * currently has, not the one they had when the page loaded. (It used to
   * be called literally once per mount; see CaptureFrame's own note for
   * what that cost and how it was measured.) `captureMode`'s Canvas needs
   * `gl={{ preserveDrawingBuffer: true }}` for `toDataURL` to read back a
   * real image (off by default for the interactive view, since it has a
   * small perf cost not worth paying there). Never called twice with the
   * same image, so it cannot drive a state-update loop. */
  onCapture?: (dataUrl: string) => void;
  /** Called when a capture asked for via `captureRequestId` has been dealt
   * with — including when it was skipped because the scene had not changed.
   * A caller that is waiting to print depends on this always arriving. */
  onCaptureDone?: () => void;
  /** True while the captured image is actually on screen (the Project
   * Summary note is open). False leaves the capture dormant — see
   * CaptureFrame. */
  captureLive?: boolean;
  /** Bump to take one capture now regardless of `captureLive`. */
  captureRequestId?: number;
  /** Forwarded to CompassWidget's rotating face — see CompassTracker below. */
  compassRef?: RefObject<HTMLDivElement | null>;
  /** Renders every panel as a single flat-colored box (its own panel-type
   * legend color) instead of its full member-by-member geometry (Tommy:
   * "lets simplify... for panels to appear as their respective color and
   * just appear as the primary 3D shapes that they are") — meant for
   * scenes with many panels at once (e.g. TruckLoad3DView's stacked
   * shipping view) where full wood-member detail would be unreadable
   * clutter, but available as a general toggle here too. Off by default. */
  simplified?: boolean;
  /** 3D Wraps view (Tommy: "3d model selected after box mode and is
   * everything box mode is with a few changes: panels not labeled, and
   * the 3D models of the wraps appear") — implies `simplified` (same box
   * geometry); suppresses every panel label and adds a colored skin mesh
   * for each checked product with a `skinColor` (see panelColors.ts /
   * wallAssemblyLayers). Off by default. */
  showWraps?: boolean;
  /** Every interior/exterior wall-assembly product currently checked
   * (page.tsx's checkedInteriorIds/checkedExteriorIds) — only consulted
   * when `showWraps` is true. */
  checkedInteriorIds?: Set<string>;
  checkedExteriorIds?: Set<string>;
  /** Which 3D-only editor tool is active (Tommy: "build the 3d viewer into
   * an editor with all the same tools as the 2d plan editor" — Phase 1
   * scope: just Edit-cycle parity + the Sill & Header drag tool; draw/
   * bump-out/drag-wall are deferred, so this is a deliberately separate,
   * smaller vocabulary from the 2D `ShapeTool` union, not a reuse of it).
   * "orbit" (default) leaves every slot non-interactive so OrbitControls
   * has the pointer to itself. */
  tool3D?: "orbit" | "edit" | "sill-header";
  /** Cycles one panel slot's type the same way the 2D Edit tool's
   * `onToggleOpening` does — only wired up when `tool3D === "edit"`. The
   * `story` param is real now that the second story is independently-stored
   * data (see the `secondStory` prop's own doc comment): the caller
   * currently no-ops `story === "second"` clicks (no editing UI exists yet
   * for the second story's own wallSlots), rather than silently mutating
   * the ground floor's same-position panel the way a shared-reference
   * second story used to. */
  onToggleOpening?: (story: "ground" | "second", wallId: string, slotIndex: number) => void;
  /** Commits the bottom handle's dragged position (floor to RO-bottom) —
   * only wired up when `tool3D === "sill-header"`. Same story-forwarding
   * rationale as `onToggleOpening`. */
  onSetWindowSillHeight?: (story: "ground" | "second", wallId: string, slotIndex: number, sillHeightIn: number) => void;
  /** Commits the top handle's dragged position, expressed as the window's
   * own RO height (top edge relative to the bottom handle) — same field
   * `handleSetWindowHeight` already writes for the 2D dropdown. */
  onSetWindowHeight?: (story: "ground" | "second", wallId: string, slotIndex: number, heightIn: number) => void;
}

/** How long a burst of design changes is allowed to settle before the
 * capture canvas is read back. `toDataURL` encodes a 720x480 PNG and the
 * resulting ~140KB string is pushed into `page.tsx` state, so a capture
 * costs a full page re-render — this keeps a continuous gesture (a wall
 * drag, holding an arrow key) to a few captures per second instead of one
 * per frame. Pure debounce, no building number in it. Safe at any length
 * because `captureMode`'s Canvas sets `preserveDrawingBuffer: true`, which
 * is exactly the guarantee that the last rendered frame is still readable
 * later. */
const CAPTURE_SETTLE_MS = 300;

/** A stable no-op, so the optional `onCaptureDone` never changes identity
 * between renders and cannot churn CaptureFrame. */
const NOOP = () => {};

/**
 * Mounted only in `captureMode` — reads the Canvas's own `gl` via `useThree`
 * and keeps the Project Summary's PNG equal to the current design.
 *
 * ### Why this hangs off `useFrame` and NOT off a list of scene inputs
 *
 * The capture Canvas runs `frameloop="demand"` (see the `<Canvas>` below),
 * so react-three-fiber renders a frame **only** when its reconciler has
 * committed an actual change to the scene graph. That makes "a frame was
 * rendered" and "the design changed" the same event, which is why this
 * needs no dependency array enumerating footprint/slots/heights/beams/
 * headers/roof. An enumerated list is precisely what goes quietly stale:
 * the version this replaces keyed its effect on `[gl, onCapture]`, and
 * `onCapture` is a `useCallback(..., [])` in `page.tsx` — a stable identity
 * — so **the capture fired exactly once per mount and never again.**
 * Measured on a production build of `main` @ `2422fbd`: changing the wall
 * height from 10ft to 16ft moved the summary's own totals (5223.0 lb ->
 * 8114.3 lb, $28031.66 -> $44651.02) and left the rendering image
 * byte-identical, SHA-256 `813dfc105388b943` both sides.
 *
 * ### The two guards, and what each is for
 *
 * - `timerRef` debounces: at most one readback in flight, so a gesture that
 *   renders sixty frames produces one PNG, not sixty.
 * - `lastRef` makes the capture idempotent: if a frame renders that happens
 *   to draw the same pixels, `onCapture` is not called, so no `page.tsx`
 *   state update and no re-render. That is what stops a
 *   capture -> setState -> re-render -> capture cycle from existing at all,
 *   rather than relying on r3f's commit diffing to not invalidate.
 *
 * The read itself still happens on the frame AFTER the draw (the timeout
 * lands outside r3f's own rAF), which is the same ordering the original
 * single-shot version relied on and the reason `preserveDrawingBuffer` is
 * on.
 */
function CaptureFrame({
  onCapture,
  onCaptureDone,
  live,
  captureRequestId,
}: {
  onCapture: (dataUrl: string) => void;
  /** Always called when a REQUESTED capture has been dealt with, including
   * when it was skipped because nothing had changed — so a caller waiting
   * to print cannot hang on a capture that was never needed. */
  onCaptureDone: () => void;
  /** True while something is actually displaying the image (the Project
   * Summary note is open). See the "while nobody is looking" note above. */
  live: boolean;
  /** Bumped to ask for one capture now, whatever `live` is. */
  captureRequestId: number;
}) {
  const { gl, invalidate } = useThree();
  const timerRef = useRef<number | null>(null);
  const lastDataUrlRef = useRef<string>("");
  /** The scene has changed since the last readback. Set from `useFrame`, so
   * it costs a boolean write per frame and never a React render. */
  const dirtyRef = useRef(true);
  const servedRequestRef = useRef(captureRequestId);

  const readBack = () => {
    const dataUrl = gl.domElement.toDataURL("image/png");
    dirtyRef.current = false;
    if (dataUrl === lastDataUrlRef.current) return;
    lastDataUrlRef.current = dataUrl;
    onCapture(dataUrl);
  };

  useFrame(() => {
    // A frame rendered, so under `frameloop="demand"` the scene changed.
    // Marking a ref is the whole cost when nobody is looking.
    dirtyRef.current = true;

    if (servedRequestRef.current !== captureRequestId) {
      servedRequestRef.current = captureRequestId;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      readBack();
      onCaptureDone();
      return;
    }

    if (!live || timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (dirtyRef.current) readBack();
    }, CAPTURE_SETTLE_MS);
  });

  // A request has to land on a frame, and `demand` renders none on its own
  // when the scene has not changed — so ask for one explicitly.
  useEffect(() => {
    invalidate();
  }, [captureRequestId, invalidate]);

  // ⚠ And the same applies to going live, which is the whole open/close
  // path: edits made while the note was CLOSED each rendered a frame and
  // set `dirtyRef`, but re-opening the note changes nothing in this scene,
  // so `demand` would render no further frame and `useFrame` would never
  // run — leaving the note showing the image from before those edits. That
  // is the original stale-summary bug wearing a different hat, so going
  // live forces a frame exactly the way an explicit request does.
  useEffect(() => {
    if (live) invalidate();
  }, [live, invalidate]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  return null;
}

/** Drives the CompassWidget (Tommy: "the compass should always be
 * corresponding to the camera angle, even rotating in 3D") — every frame,
 * computes the camera's azimuthal angle around `target` and writes it
 * straight to the compass face's `style.transform` via the forwarded ref.
 * Deliberately NOT React state: a state update here would re-render
 * page.tsx up to 60x/second for a value nothing else needs. */
function CompassTracker({ compassRef, target }: { compassRef: RefObject<HTMLDivElement | null>; target: [number, number, number] }) {
  useFrame(({ camera }) => {
    if (!compassRef.current) return;
    const azimuthRad = Math.atan2(camera.position.x - target[0], camera.position.z - target[2]);
    const azimuthDeg = (azimuthRad * 180) / Math.PI;
    compassRef.current.style.transform = `rotate(${-azimuthDeg}deg)`;
  });
  return null;
}

/** Whole-building 3D preview, built from the SAME per-panel member geometry
 * as each Shop Drawing page's 3D view (Tommy: "is there a way that the 3D
 * Preview button can show these models in their place together on the
 * floor plan?") — one positioned/rotated group per wall slot, each
 * containing that slot's own `PanelMembersGroup`. Column/Corner panels
 * ignore the slot's own tiled width and instead always build at their own
 * fixed fabrication width (`COLUMN_TOTAL_WIDTH_IN`, or 39in for a Square
 * Bale Panels corner) — the group is still sized/positioned to the slot's
 * tiled width, which the tiling system (page.tsx/retile.ts/tiling.ts) keeps
 * exactly equal to that same fixed width, so there's no unrendered gap
 * (Tommy: "we cannot have this type of error happening"). */
export default function Building3DView({
  footprint,
  wallSlots,
  wallHeightFt,
  maxPanelHeightIn,
  thicknessIn,
  includeNailer,
  primaryCornerIds,
  wallRunStopsByWallId,
  wallTilingLengthInByWallId,
  secondStory,
  isSquareBalePanelization = false,
  squareBaleStudConfig = "single-2x4",
  bracingStyle = "chevron",
  nailerOffsetIn = 0,
  jackStudConfig,
  standardWidthIn,
  isBaleFoundationFloor = false,
  showFloorPanels = false,
  showRoofPanels = false,
  roofPitchIn12,
  roofEaveHeightFt,
  roofForm = "peaked",
  roofTallSideNorth,
  roofDeckSolid = false,
  baleFoundationTopDepthIn = BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
  baleFoundationBottomDepthIn = BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
  baleFoundationGapIn = BALE_FOUNDATION_GAP_DEFAULT_IN,
  baleFoundationFieldSpacingIn = BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN,
  floorBottomSkinEnabled = false,
  leastAccessibleCorner,
  gableTilesByWallId = EMPTY_GABLE_TILES_BY_WALL_ID,
  roofEnabled = false,
  trussPlateInsetIn = 0,
  boxBeamCoverageByWallId = EMPTY_BOX_BEAM_COVERAGE_BY_WALL_ID,
  boxBeamSizeId = BOX_BEAM_SIZE_DEFAULT,
  midWallBeamsByWallId = EMPTY_MID_WALL_BEAMS_BY_WALL_ID,
  secondStoryMidWallBeamsByWallId = EMPTY_MID_WALL_BEAMS_BY_WALL_ID,
  spanningHeadersByWallId = EMPTY_SPANNING_HEADERS_BY_WALL_ID,
  secondStorySpanningHeadersByWallId = EMPTY_SPANNING_HEADERS_BY_WALL_ID,
  spanningHeaderNameById = EMPTY_SPANNING_HEADER_NAMES,
  captureMode = false,
  onCapture,
  onCaptureDone,
  captureLive = false,
  captureRequestId = 0,
  compassRef,
  simplified = false,
  showWraps = false,
  checkedInteriorIds = EMPTY_ID_SET,
  checkedExteriorIds = EMPTY_ID_SET,
  tool3D = "orbit",
  onToggleOpening,
  onSetWindowSillHeight,
  onSetWindowHeight,
}: Building3DViewProps) {
  // Stage 4B: another company's design is on screen, browsed read-only. Read
  // from Context rather than taken as a prop — see BrowseModeContext.tsx.
  const browsing = useBrowsing();
  const heightIn = wallHeightFt * IN_PER_FT;
  // Sill & Header drag tool's own selection + drag-in-progress state — a
  // pure 3D-view interaction concern (mirrors how FootprintCanvas.tsx keeps
  // its own pan/zoom fully local rather than lifting it to page.tsx).
  const [selectedWindow, setSelectedWindow] = useState<{ wallId: string; slotIndex: number; story: "ground" | "second" } | null>(
    null,
  );
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  useEffect(() => {
    if (tool3D !== "sill-header") setSelectedWindow(null);
  }, [tool3D]);
  // Only one window can be selected at a time, so one pair of refs (rather
  // than a ref per rendered slot) is enough to read each handle's own
  // dragged position back out on release.
  const sillHandleRef = useRef<Mesh>(null);
  const headerHandleRef = useRef<Mesh>(null);

  // Orbit tool re-centering (Tommy: "if you click and swipe on a panel or
  // object, then the camera orbits around that point instead" of the
  // building's own default center) — null means "use the default
  // building-center target", matching today's behavior exactly. Reset
  // whenever the Orbit tool isn't active, so a stale override from a
  // previous session doesn't linger once the user switches tools and back.
  const [orbitTargetOverride, setOrbitTargetOverride] = useState<[number, number, number] | null>(null);
  useEffect(() => {
    if (tool3D !== "orbit") setOrbitTargetOverride(null);
  }, [tool3D]);
  // Click-vs-drag disambiguation: a plain click on a panel (no follow-up
  // drag) should be a true no-op — changing OrbitControls' own `target`
  // alone never produces a visible camera jump (it only affects where the
  // NEXT orbit gesture rotates around), so a bare click would otherwise
  // silently arm a later, unrelated gesture to behave differently than
  // expected. This ref holds the pointerdown's own screen position + the
  // clicked world point; only once real drag movement is observed does it
  // get promoted into `orbitTargetOverride` state.
  const orbitDragStartRef = useRef<{ clientX: number; clientY: number; worldPoint: [number, number, number] } | null>(null);
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const start = orbitDragStartRef.current;
      if (!start) return;
      const distancePx = Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY);
      if (distancePx < ORBIT_RETARGET_DRAG_THRESHOLD_PX) return;
      setOrbitTargetOverride(start.worldPoint);
      orbitDragStartRef.current = null; // commit once per gesture, then stop tracking
    };
    const handlePointerUp = () => {
      orbitDragStartRef.current = null;
    };
    // Window-level, not on the Canvas/group itself — purely observing an
    // in-progress gesture that OrbitControls is simultaneously handling
    // for the actual rotation; never calls stopPropagation/preventDefault,
    // so it can't interfere with that.
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const rawSlotBoxes = useMemo(
    () =>
      footprint
        ? panelSlotBoxes3D(footprint, wallSlots, thicknessIn, wallHeightFt, primaryCornerIds, wallRunStopsByWallId)
        : [],
    [footprint, wallSlots, thicknessIn, wallHeightFt, primaryCornerIds, wallRunStopsByWallId],
  );
  // Built flat (nominal height for every slot) above, then split into 1-2
  // real boxes for any wall with a Mid-Wall Bond Beam — mirrors
  // secondStorySlotBoxes' own "build flat, then post-process" pattern
  // below, generalized from overriding a box's height in place to
  // splitting it into two (a beam-covered slot now needs its own Y offset
  // too, not just its own height).
  const slotBoxes = useMemo(
    () => splitForMidWallBeam(rawSlotBoxes, midWallBeamsByWallId, heightIn, maxPanelHeightIn, spanningHeadersByWallId),
    [rawSlotBoxes, midWallBeamsByWallId, heightIn, maxPanelHeightIn, spanningHeadersByWallId],
  );

  const slotRenderData = useMemo(
    () =>
      slotBoxes.map((box) => ({
        box,
        members: membersForSlot(
          box.slot,
          thicknessIn,
          box.heightFt * IN_PER_FT,
          includeNailer,
          isSquareBalePanelization,
          squareBaleStudConfig,
          bracingStyle,
          nailerOffsetIn,
          jackStudConfig,
          standardWidthIn,
          box.midWallBandIndex !== undefined,
        ),
      })),
    [
      slotBoxes,
      thicknessIn,
      includeNailer,
      isSquareBalePanelization,
      squareBaleStudConfig,
      bracingStyle,
      nailerOffsetIn,
      jackStudConfig,
      standardWidthIn,
    ],
  );

  // Second story: same XZ anchor positions as the ground floor (shares its
  // footprint), just its own wall height for member geometry + a Y offset
  // by the ground floor's own top-plate height. secondStory.wallHeightFt is
  // always the NOMINAL (Truss Plate) height — a slot inside a wall's own
  // Box Beam coverage range (boxBeamCoverageByWallId, which can now cover
  // just PART of a wall's own row) gets its own box built shorter by
  // computeBoxBeamHeightDeltaIn, so wall+beam still reaches the exact same
  // shared roofline as every other slot (see sharedRoofBearingHeightIn's
  // own doc comment). panelSlotBoxes3D is called once at the nominal
  // height (so its own X-offset math sees every wall's own FULL slot list,
  // required for correct positioning), then covered boxes have their own
  // `heightFt` overridden in a light post-process pass — height is fully
  // independent of a box's X/Z position/width, so this is safe.
  const secondStoryHeightIn = secondStory ? secondStory.wallHeightFt * IN_PER_FT : 0;
  /**
   * The second story's boxes BEFORE any band splitting — one box per slot,
   * exactly what `rawSlotBoxes` is for the ground floor.
   *
   * Split out because anything that needs a slot's X/Z ANCHOR has to look it
   * up here and not in the split list: a band split can leave a slot with a
   * box of a different height, several boxes, or — when a beam consumes the
   * slot's whole height — no box at all, and a `.find` by slot index then
   * misses and the thing being anchored is silently not drawn.
   */
  const rawSecondStorySlotBoxes = useMemo(
    () =>
      footprint && secondStory
        ? panelSlotBoxes3D(
            footprint,
            secondStory.wallSlots,
            thicknessIn,
            secondStory.wallHeightFt,
            primaryCornerIds,
            wallRunStopsByWallId,
          )
        : [],
    [footprint, secondStory, thicknessIn, primaryCornerIds, wallRunStopsByWallId],
  );
  const secondStorySlotBoxes = useMemo(() => {
    if (!footprint || !secondStory) return [];
    const boxes = rawSecondStorySlotBoxes;
    const splitBoxes = splitForMidWallBeam(
      boxes,
      secondStoryMidWallBeamsByWallId,
      secondStory.wallHeightFt * IN_PER_FT,
      maxPanelHeightIn,
      secondStorySpanningHeadersByWallId,
    );
    if (Object.keys(boxBeamCoverageByWallId).length === 0) return splitBoxes;
    const heightDeltaFt = computeBoxBeamHeightDeltaIn(boxBeamSizeId) / IN_PER_FT;
    // Roofline Box Beam always shortens from the very top of the row — only
    // ever applies within whichever band actually reaches the story's own
    // ceiling (isTopmostBand — see splitForMidWallBeam's own doc comment).
    return splitBoxes.map((box) =>
      box.isTopmostBand && isSlotBoxBeamCovered(box.slotIndex, boxBeamCoverageByWallId[box.wallId])
        ? { ...box, heightFt: box.heightFt - heightDeltaFt }
        : box,
    );
  }, [
    footprint,
    secondStory,
    rawSecondStorySlotBoxes,
    secondStoryMidWallBeamsByWallId,
    secondStorySpanningHeadersByWallId,
    boxBeamCoverageByWallId,
    boxBeamSizeId,
    maxPanelHeightIn,
  ]);
  const secondStorySlotRenderData = useMemo(
    () =>
      secondStorySlotBoxes.map((box) => ({
        box,
        // Each box already carries its own real height (see above) — a
        // covered wall's own boxes are shorter than secondStoryHeightIn.
        members: membersForSlot(
          box.slot,
          thicknessIn,
          box.heightFt * IN_PER_FT,
          includeNailer,
          isSquareBalePanelization,
          squareBaleStudConfig,
          bracingStyle,
          nailerOffsetIn,
          jackStudConfig,
          standardWidthIn,
          box.midWallBandIndex !== undefined,
        ),
      })),
    [
      secondStorySlotBoxes,
      thicknessIn,
      includeNailer,
      isSquareBalePanelization,
      squareBaleStudConfig,
      bracingStyle,
      nailerOffsetIn,
      jackStudConfig,
      standardWidthIn,
    ],
  );

  // The roofline's own base height (sum of every story's own wall height —
  // same semantics as page.tsx's own `roofBaseHeightIn`, and provably
  // identical: `wallHeightFt`/`secondStory` here ARE page.tsx's
  // `stories[0].wallHeightFt`/`stories[1]`). Both the gable cap and the
  // roof-bearing member anchor off this.
  const roofBaseHeightIn = heightIn + secondStoryHeightIn;
  // The shared roofline/eave reference every wall agrees on, regardless of
  // which roof-bearing member any individual wall actually uses (Tommy:
  // "the roof lines needs to be respected" — a box-beam wall's own panel
  // row is built shorter to still reach this same height, see the
  // per-wall secondStoryPanelHeightIn logic below). Always the Truss
  // Plate's own (shorter) assembly height. Only relevant/rendered when
  // `roofEnabled`.
  const sharedRoofBearingHeightIn = computeSharedRooflineBearingHeightIn();

  // Real per-wall Gable End Panel tiles (page.tsx's own `gableTilesByWallId`
  // — the same data the Panel Fabrication pages use). Each tile sits on TOP
  // of the roof-bearing member (when one exists), not at the raw eave line,
  // so the two don't interpenetrate — a real stacking interaction neither
  // WallElevationDiagram's own 2D SVG nor anything else resolves today, since
  // roof-bearing has never been drawn alongside gable anywhere until now.
  const gableRenderData = useMemo(() => {
    if (!footprint) return [];
    // The real "eave" reference every tile's own leftEdgeHeightIn/
    // rightEdgeHeightIn is absolute relative to (page.tsx's own
    // gableEaveHeightIn) — flush with the TOP of the roof-bearing member,
    // not the bare wall-top-plate height. Subtracting anything else here
    // would offset every gable panel's own LOCAL geometry by the roof-
    // bearing member's thickness, even though gableBaseYFt (the group's
    // own world-space anchor) already accounts for it correctly.
    const gableEaveHeightIn = roofBaseHeightIn + (roofEnabled ? sharedRoofBearingHeightIn : 0);
    const gableBaseYFt = gableEaveHeightIn / IN_PER_FT;
    const result: {
      wallId: string;
      tileIndex: number;
      anchorX: number;
      anchorZ: number;
      rotationRad: number;
      members: PanelMember[];
      widthFt: number;
      heightFt: number;
      depthFt: number;
      isSafetyGap: boolean;
      verticalGapHeightFt: number;
    }[] = [];
    for (const [wallId, tiles] of Object.entries(gableTilesByWallId)) {
      const wall = footprint.walls.find((w) => w.id === wallId);
      if (!wall || tiles.length === 0) continue;
      const axis = wallAxis(footprint, wall);
      tiles.forEach((tile, tileIndex) => {
        const offsetFt = tile.xStartIn / IN_PER_FT;
        // Pass leftLocalIn/rightLocalIn straight through in this same
        // order — NOT min/max'd — so a tile whose real roofline falls
        // left-to-right (e.g. one to the right of a peak) builds correctly
        // mirrored, instead of always assuming the low edge is on the left.
        const leftLocalIn = tile.leftEdgeHeightIn - gableEaveHeightIn;
        const rightLocalIn = tile.rightEdgeHeightIn - gableEaveHeightIn;
        const tallerLocalIn = Math.max(leftLocalIn, rightLocalIn);
        let members: PanelMember[];
        if (tile.isColumn) {
          // Real, fabricable structural Column Panel (Tommy: "panels/beam"
          // mode) — reuses the SAME builder a normal ground-level column
          // already uses, just at this tile's own local height (flat top,
          // leftLocalIn === rightLocalIn by construction — see
          // computeGableTiledRow's own columnReservationWidthIn doc
          // comment) instead of a full story height.
          members = buildColumnPanelMembers(thicknessIn, tallerLocalIn, includeNailer);
        } else if (tile.isWindow) {
          // Gable window (Tommy: "add an option to click-edit gable end
          // panels to become window gable end panels... this is just a
          // small version of an inclined panel that should follow all of
          // inclined panel dynamics. the only difference is that it uses
          // the top of the RO below it as its slot. dont forget jack
          // studs") — 2 pieces, both reused builders, no new shapes:
          // jack studs + sill from buildOpeningAssemblyMembers (its own
          // header discarded — the upper gable cap takes that structural
          // role instead), plus a second, smaller buildGablePanelMembers
          // call for the cap, shifted up by the window's own RO-top.
          const windowHeightIn = tile.windowHeightIn ?? standardWindowHeightDefaultIn.value;
          const windowSillHeightIn = tile.windowSillHeightIn ?? sillDefaultHeightIn.value;
          const g = computeOpeningGeometry(
            false,
            tile.widthIn,
            Math.max(tallerLocalIn, windowSillHeightIn + windowHeightIn + 1),
            windowSillHeightIn,
            windowHeightIn,
            jackStudConfig,
            standardWidthIn,
          );
          const lowerMembers = buildOpeningAssemblyMembers(
            tile.widthIn,
            thicknessIn,
            "window",
            jackStudConfig,
            g.sillHeightIn,
            g.jackStudSpanIn,
            0,
            g.sillHeightIn,
            g.sillWidthsIn,
            includeNailer,
          ).filter((m) => !m.memberId.startsWith("header_"));
          // Clamped so a window tall enough to reach one edge's own true
          // roofline gets zero-height (flush) gable material on that side
          // instead of an inverted/negative-height panel.
          const capLeftLocalIn = Math.max(0, leftLocalIn - g.roTopZIn);
          const capRightLocalIn = Math.max(0, rightLocalIn - g.roTopZIn);
          const capMembers = buildGablePanelMembers(tile.widthIn, thicknessIn, capLeftLocalIn, capRightLocalIn, includeNailer).map((m) => ({
            ...m,
            position: { ...m.position, zIn: m.position.zIn + g.roTopZIn },
          }));
          members = [...lowerMembers, ...capMembers];
        } else {
          members = tile.isSafetyGap
            ? buildSafetyGapMembers(thicknessIn, tallerLocalIn)
            : buildGablePanelMembers(tile.widthIn, thicknessIn, leftLocalIn, rightLocalIn, includeNailer);
        }
        // A vertical safety-gap filler (Tommy: "an ability to put a safety
        // gap inbetween the truss bottom and the gable end top") stacks
        // directly above this (now always flat, when a gap exists) tile's
        // own top, up to the true roofline — additive, not a replacement.
        // leftLocalIn === rightLocalIn whenever a gap exists
        // (capGableTileHeights's own guarantee), so either works as the
        // flat top's own Z-offset.
        if (tile.verticalGapIn) {
          members.push(
            ...buildVerticalGapFillerMembers(tile.widthIn, thicknessIn, tile.verticalGapIn.leftIn, tile.verticalGapIn.rightIn).map((m) => ({
              ...m,
              position: { ...m.position, zIn: m.position.zIn + leftLocalIn },
            })),
          );
        }
        result.push({
          wallId,
          tileIndex,
          anchorX: axis.startXFt + axis.dirX * offsetFt,
          anchorZ: axis.startZFt + axis.dirZ * offsetFt,
          rotationRad: axis.rotationRad,
          members,
          widthFt: tile.widthIn / IN_PER_FT,
          heightFt: tallerLocalIn / IN_PER_FT,
          depthFt: thicknessIn / IN_PER_FT,
          isSafetyGap: !!tile.isSafetyGap,
          verticalGapHeightFt: Math.max(tile.verticalGapIn?.leftIn ?? 0, tile.verticalGapIn?.rightIn ?? 0) / IN_PER_FT,
        });
      });
    }
    return result.map((r) => ({ ...r, anchorYFt: gableBaseYFt }));
  }, [footprint, gableTilesByWallId, roofBaseHeightIn, roofEnabled, sharedRoofBearingHeightIn, thicknessIn, includeNailer, jackStudConfig, standardWidthIn]);

  // 1-3 real roof-bearing (truss plate/box beam) segments per wall (see
  // computeRoofBearingSegments) — a wall with partial Box Beam coverage
  // gets its own Truss Plate remainder segment(s) on either side, each
  // sized to its own real length — same member builders the Panel
  // Fabrication pages already use, just placed in world space here. Box
  // beam is a per-wall/per-section choice now (boxBeamCoverageByWallId),
  // not automatic once secondStory exists.
  const roofBearingRenderData = useMemo(() => {
    if (!footprint || !roofEnabled) return [];
    const result: {
      wallId: string;
      segmentIndex: number;
      anchorX: number;
      anchorZ: number;
      anchorYIn: number;
      rotationRad: number;
      members: PanelMember[];
      widthFt: number;
      heightFt: number;
      depthFt: number;
    }[] = [];
    for (const wall of footprint.walls) {
      const axis = wallAxis(footprint, wall);
      const slots = secondStory?.wallSlots[wall.id] ?? [];
      // A roof-bearing plate sits on TOP of this wall's panels, so where
      // there are no panels there is no plate — the span is the BUILT run,
      // not the raw wall (Stage 3).
      //
      // **`startXIn` is RUN-relative in both branches, and the stop is
      // added once at the anchor below.** `computeRoofBearingSegments`
      // measures from the slot run's own origin, not from the wall's true
      // corner, so the multi-story branch shrinks for free in LENGTH but
      // not in POSITION: with a start stop the run begins further along the
      // wall and the beam would be drawn that far back, overlapping the
      // unbuilt span and falling short at the far end. Making the
      // single-story branch run-relative too keeps the two symmetric, so
      // the shift can be applied in exactly one place instead of being
      // baked into one branch and missing from the other.
      // `builtWallSpan`, not a local clamp against the raw length: a stop is
      // clamped against the TILING length, and clamping it here against the
      // raw one instead left this view disagreeing with page.tsx's own
      // fabrication groups by up to a wall thickness on a butting wall.
      const rawLengthIn = wall.lengthFt * IN_PER_FT;
      const runStop = builtWallSpan(rawLengthIn, wallTilingLengthInByWallId?.[wall.id] ?? rawLengthIn, wallRunStopsByWallId?.[wall.id]);
      const builtLengthIn = runStop.builtLengthIn;
      const segments = secondStory
        ? computeRoofBearingSegments(slots, boxBeamCoverageByWallId[wall.id])
        : // A wall built to zero gets NO plate at all, not a zero-length
          // one — `computeRoofBearingSegments` already returns [] for an
          // empty run, and this branch has to agree with it.
          builtLengthIn > 0
          ? [{ kind: "truss-plate" as const, startXIn: 0, lengthIn: builtLengthIn }]
          : [];
      segments.forEach((seg, segmentIndex) => {
        const hasBoxBeam = seg.kind === "box-beam";
        const members = hasBoxBeam
          ? buildBoxBeamMembers(seg.lengthIn, thicknessIn, boxBeamSizeId)
          : buildTrussPlateMembers(seg.lengthIn, thicknessIn, trussPlateInsetIn);
        const assemblyHeightIn = hasBoxBeam ? computeBoxBeamAssemblyHeightIn(boxBeamSizeId) : sharedRoofBearingHeightIn;
        // A box-beam segment's own row is built shorter (see
        // secondStorySlotBoxes above) so the beam itself must anchor lower
        // by that exact same delta — its own top still reaches
        // roofBaseHeightIn (the shared roofline), same as a Truss Plate
        // segment.
        const anchorYIn = hasBoxBeam ? roofBaseHeightIn - computeBoxBeamHeightDeltaIn(boxBeamSizeId) : roofBaseHeightIn;
        // Run-relative segment position + where the run itself starts. Only
        // the run STOP is added here: a wall that butts a longer neighbour
        // has its slots start `thicknessIn` in as well, and this anchor has
        // always ignored that. That is a PRE-EXISTING, RENDER-ONLY offset on
        // butting walls, unrelated to Stage 3 and deliberately not changed
        // here — fixing it would move the roof-bearing render on every
        // existing two-story project. Still open; noted rather than silently
        // left.
        //
        // **Not to be confused with the plate's CUT LENGTH**, which is a
        // different question with a different answer. This memo's `widthFt`
        // comes from `seg.lengthIn` and never reaches a fabrication sheet;
        // the sheet is cut by `roofBearingFabricationGroups`, and Tommy
        // settled on 2026-09-25 that it correctly spans the full wall line
        // because top plates LAP AT THE CORNERS. The two got conflated once.
        const offsetFt = (seg.startXIn + runStop.startStopIn) / IN_PER_FT;
        result.push({
          wallId: wall.id,
          segmentIndex,
          anchorX: axis.startXFt + axis.dirX * offsetFt,
          anchorZ: axis.startZFt + axis.dirZ * offsetFt,
          anchorYIn,
          rotationRad: axis.rotationRad,
          members,
          widthFt: seg.lengthIn / IN_PER_FT,
          heightFt: assemblyHeightIn / IN_PER_FT,
          depthFt: thicknessIn / IN_PER_FT,
        });
      });
    }
    return result;
  }, [
    footprint,
    roofEnabled,
    secondStory,
    boxBeamCoverageByWallId,
    boxBeamSizeId,
    thicknessIn,
    trussPlateInsetIn,
    sharedRoofBearingHeightIn,
    roofBaseHeightIn,
    // Read at the top of this memo (Stage 3). Missing, a single-story
    // building kept drawing its truss plate at FULL length across an
    // unbuilt span until something unrelated invalidated the memo — the
    // exact failure this stage exists to prevent, relocated one layer up.
    // `rawSlotBoxes` lists it, so the panels moved and the plate did not.
    wallRunStopsByWallId,
    wallTilingLengthInByWallId,
  ]);

  // Bale Foundation's own rim rings + field stacks (Tommy: "the default
  // option is the double 2x6 + 1.5in gap 'bale foundation'") — purely
  // additive, anchored entirely below the wall's own existing Z=0 (see
  // baleFoundationTopFaceZIn's own doc comment), so nothing about existing
  // wall/roof placement changes. Each ring segment/field line becomes one
  // positioned group, same "anchor at the segment's own start point,
  // rotate by -rotationRad" convention roofBearingRenderData uses.
  /* The floor and roof decks, placed the same way the bale foundation's
     framing is: one group per panel, anchored in plan, with its members drawn
     in the panel's own frame.

     ⚠ A panel's members are built AS FABRICATED — lying in the compressor
     table, so the panel's own Z is its span, the same axis a wall panel uses
     for its height. Installing a floor means tipping it flat, which is the
     inner group's job below. Nothing bakes that into the members, because the
     shop drawing has to keep showing the panel the way it is built. */
  const deckRenderData = useMemo(() => {
    if (!footprint || (!showFloorPanels && !showRoofPanels)) return [];
    const result: {
      id: string;
      kind: "floor" | "roof";
      anchorX: number;
      anchorZ: number;
      anchorYFt: number;
      rotationRad: number;
      /** How far the panel is tipped off flat: 0 for a floor, the roof's own
       * pitch for a roof plane. */
      tiltRad: number;
      members: PanelMember[];
    }[] = [];

    const widths = planFloorRoofPanelWidthsIn(footprintSpanAndRun(footprint).runFt * IN_PER_FT, thicknessIn);
    if (widths === null) return [];
    const placed = deckPanelPlacements(footprint, widths);
    if (placed.refusal !== null) return [];

    if (showFloorPanels) {
      /* The floor deck hangs below Z=0, the finished floor the walls stand on
         — the same datum the bale foundation hangs its framing from. */
      for (const p of placed.placements) {
        result.push({
          id: `floor-${p.index}`,
          kind: "floor",
          anchorX: p.anchorX,
          anchorZ: p.anchorZ,
          anchorYFt: 0,
          rotationRad: p.rotationRad,
          tiltRad: 0,
          members: buildFloorRoofPanelMembers({
            kind: "floor",
            widthIn: p.widthIn,
            depthIn: thicknessIn,
            lengthIn: p.spanIn,
            structuralGirtEnds: ["start", "end"],
          }),
        });
      }
    }

    /* ⚠ The roof deck is laid on its real PLANES now, not flat. Tommy saw
       the flat one cut straight through his gable panels, which is the
       overlap the app is not allowed to have. Without a pitch there is no
       plane to lay anything on, so it stays withheld rather than guessed. */
    if (showRoofPanels && roofPitchIn12 !== undefined && roofEaveHeightFt !== undefined) {
      const roof = simpleRoofPlanes(footprint, {
        form: roofForm,
        pitchIn12: roofPitchIn12,
        eaveHeightFt: roofEaveHeightFt,
        tallSideNorth: roofTallSideNorth,
      });
      if (roof.refusal === null) {
        const tiltRad = Math.atan2(roofPitchIn12, 12);
        /* ⚠ Half the roof is see-through so a new project shows the inside of
           the building rather than a lid. Applied as each member's own
           `opacityOverride`, which the renderer already honours, rather than
           as a whole-group material — so the framing still reads as framing
           through it instead of becoming a flat ghost. */
        const seeThroughFacing = roofDeckSolid ? null : defaultTransparentRoofFacing(roof.planes);
        for (const [planeIndex, plane] of roof.planes.entries()) {
          const edgeDx = plane.lowEnd.x - plane.lowStart.x;
          const edgeDy = plane.lowEnd.y - plane.lowStart.y;
          const edgeLengthIn = Math.hypot(edgeDx, edgeDy) * IN_PER_FT;
          /* Panels repeat ALONG the eave and span UP the slope, so the run is
             the eave's own length and the span is the real sloped length —
             longer than the ground it covers, which is the whole reason the
             shed-or-peak limit is computed from the pitch. */
          const roofWidths = planFloorRoofPanelWidthsIn(edgeLengthIn, thicknessIn);
          if (roofWidths === null) continue;
          const rotationRad = Math.atan2(edgeDy, edgeDx);
          const ux = edgeDx / (edgeLengthIn / IN_PER_FT);
          const uy = edgeDy / (edgeLengthIn / IN_PER_FT);
          let atIn = 0;
          for (const [i, widthIn] of roofWidths.entries()) {
            const alongFt = atIn / IN_PER_FT;
            result.push({
              id: `roof-${planeIndex}-${i}`,
              kind: "roof",
              anchorX: plane.lowStart.x + ux * alongFt,
              anchorZ: plane.lowStart.y + uy * alongFt,
              anchorYFt: plane.lowHeightFt + thicknessIn / IN_PER_FT,
              rotationRad,
              tiltRad,
              members: buildFloorRoofPanelMembers({
                kind: "roof",
                widthIn,
                depthIn: thicknessIn,
                lengthIn: plane.slopeFt * IN_PER_FT,
                structuralGirtEnds: [],
              }).map((m) =>
                plane.facing === seeThroughFacing ? { ...m, opacityOverride: ROOF_SEE_THROUGH_OPACITY } : m,
              ),
            });
            atIn += widthIn;
          }
        }
      }
    }

    return result;
  }, [footprint, showFloorPanels, showRoofPanels, thicknessIn, roofPitchIn12, roofEaveHeightFt, roofForm, roofTallSideNorth, roofDeckSolid]);

  /* The ridge beam and the columns under it.

     > *"two sets of roof panels... resting on a center beam... the center
     > beam now must be supported by column panels directly below it all the
     > way to the foundation."*

     Peaked roofs only: a shed has no ridge to run a beam along. */
  const ridgeRenderData = useMemo(() => {
    if (!footprint || !showRoofPanels || roofPitchIn12 === undefined || roofEaveHeightFt === undefined) return [];
    if (roofForm !== "peaked") return [];
    const roof = simpleRoofPlanes(footprint, { form: "peaked", pitchIn12: roofPitchIn12, eaveHeightFt: roofEaveHeightFt });
    const plane = roof.planes[0];
    if (roof.refusal !== null || !plane) return [];

    const layout = ridgeBeamLayout({ ridgeStartFt: plane.highStart, ridgeEndFt: plane.highEnd });
    if (layout.refusal !== null) return [];

    const out: {
      id: string;
      anchorX: number;
      anchorZ: number;
      anchorYFt: number;
      rotationRad: number;
      members: PanelMember[];
    }[] = [];
    const ridgeRad = Math.atan2(plane.highEnd.y - plane.highStart.y, plane.highEnd.x - plane.highStart.x);
    /* The beam hangs UNDER the ridge line, so its top face is the ridge. */
    const beamUnderFt = plane.highHeightFt - ROOF_CATCHER_BEAM_DEPTH_IN / IN_PER_FT;

    for (const segment of layout.segments) {
      out.push({
        id: `beam-${segment.index}`,
        anchorX: segment.startFt.x,
        anchorZ: segment.startFt.y,
        anchorYFt: beamUnderFt,
        rotationRad: ridgeRad,
        members: buildRoofCatcherBeamMembers(segment.spanIn),
      });
    }

    /* ⚠ Columns run from the floor up to the beam's underside. He asked for
       them continuous TO THE FOUNDATION; this is as far as a single-story
       model reaches. Carrying them through a second story, and the extra
       girts in the floor panel beneath each one, are both still to do. */
    for (const column of layout.columns) {
      const built = buildStructuralColumnMembers({ heightIn: beamUnderFt * IN_PER_FT });
      if (built.refusal !== null) continue;
      out.push({
        id: `column-${column.index}`,
        /* Centred on the ridge, so the beam lands on the middle of it. */
        anchorX: column.atFt.x - (Math.cos(ridgeRad) * column.widthIn) / 2 / IN_PER_FT,
        anchorZ: column.atFt.y - (Math.sin(ridgeRad) * column.widthIn) / 2 / IN_PER_FT,
        anchorYFt: 0,
        rotationRad: ridgeRad,
        members: built.members,
      });
    }
    return out;
  }, [footprint, showRoofPanels, roofPitchIn12, roofEaveHeightFt, roofForm]);

  const baleFoundationRenderData = useMemo(() => {
    if (!footprint || !isBaleFoundationFloor) return [];
    const result: { id: string; anchorX: number; anchorZ: number; anchorYFt: number; rotationRad: number; members: PanelMember[] }[] = [];
    const topFaceZIn = baleFoundationTopFaceZIn(SUBFLOOR_DEPTH_DEFAULT_IN);
    const stackHeightIn = baleFoundationTopDepthIn + baleFoundationGapIn + baleFoundationBottomDepthIn;
    const bottomZIn = topFaceZIn - stackHeightIn;
    const anchorYFt = bottomZIn / IN_PER_FT;

    // Both ring insets, the doubled-pair width, and where the field
    // stacks start come from ONE shared derivation, which the 2D
    // FloorCanvas feed in page.tsx reads too — see this app's own history
    // of those two copies drifting apart. baleFoundationRingPlan carries
    // the bracket-the-wall rule and its interpretations.
    const ringPlan = baleFoundationRingPlan(thicknessIn);
    for (const { name, insetIn } of ringPlan.rings) {
      for (const seg of computeInsetPerimeterRing(footprint, insetIn, primaryCornerIds)) {
        result.push({
          id: `ring-${name}-${seg.wallId}`,
          anchorX: seg.startPoint.x,
          anchorZ: seg.startPoint.y,
          anchorYFt,
          rotationRad: seg.rotationRad,
          members: buildDoubledStackPair(
            `ring_${name}_${seg.wallId}`,
            seg.lengthFt * IN_PER_FT,
            baleFoundationTopDepthIn,
            baleFoundationBottomDepthIn,
            baleFoundationGapIn,
          ),
        });
      }
    }
    // One entry per SPAN, not per bay — computeFieldFramingLayout clips each
    // bay to the footprint polygon, so a notch can cut one bay into several
    // disjoint stacks. `line.id` already carries the span index, which is what
    // keeps this group id (and the OBJ `g` label built from it below) unique;
    // without it two stacks would silently export as one group.
    for (const line of computeFieldFramingLayout(footprint, ringPlan.fieldInsetIn, baleFoundationFieldSpacingIn)) {
      const lengthFt = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
      result.push({
        id: `field-${line.id}`,
        anchorX: line.x1,
        anchorZ: line.y1,
        anchorYFt,
        rotationRad: Math.atan2(line.y2 - line.y1, line.x2 - line.x1),
        members: buildFramingStackMembers(`field_${line.id}`, lengthFt * IN_PER_FT, baleFoundationTopDepthIn, baleFoundationBottomDepthIn, baleFoundationGapIn),
      });
    }
    if (floorBottomSkinEnabled) {
      const xs = footprint.corners.map((c) => c.point.x);
      const zs = footprint.corners.map((c) => c.point.y);
      const minX = Math.min(...xs);
      const minZ = Math.min(...zs);
      const nearPoint = footprint.corners.find((c) => c.id === leastAccessibleCorner)?.point ?? { x: minX, y: minZ };
      // The skin is the FOOTPRINT POLYGON clipped into opacity bands, not
      // the footprint's bounding box (Tommy: "lets make that the same size
      // as the footprint") — so a bump-out, notch or octagon no longer
      // overhangs the real floor. Each piece's ring maps straight into
      // member space (X = width, Y = depth) off the same min-corner anchor
      // this group is already placed at.
      const pieces = computeFloorMembraneBandPolygons(footprint, nearPoint).map((piece) => ({
        bandIndex: piece.bandIndex,
        pieceIndex: piece.pieceIndex,
        cornersIn: piece.polygon.map((p) => ({ xIn: (p.x - minX) * IN_PER_FT, yIn: (p.y - minZ) * IN_PER_FT })),
      }));
      result.push({
        id: "floor-bottom-skin",
        anchorX: minX,
        anchorZ: minZ,
        anchorYFt: (bottomZIn - STEEL_MESH_THICKNESS_IN) / IN_PER_FT,
        rotationRad: 0,
        members: buildFloorBottomSkinMembers(pieces),
      });
    }
    return result;
  }, [
    footprint,
    isBaleFoundationFloor,
    thicknessIn,
    primaryCornerIds,
    baleFoundationTopDepthIn,
    baleFoundationBottomDepthIn,
    baleFoundationGapIn,
    baleFoundationFieldSpacingIn,
    floorBottomSkinEnabled,
    leastAccessibleCorner,
  ]);

  // Mid-Wall Bond Beam's own member geometry, one per BEAM (either story,
  // a wall can have several) — mirrors roofBearingRenderData's own
  // pattern (wallAxis for X/Z placement, buildBoxBeamMembers for the
  // assembly), just anchored at that beam's own real height within its
  // own story instead of always at the roofline. Each beam's own
  // horizontal placement/length comes from that story's own cumulative
  // slot-offset array — the same "slot index -> real X offset" lookup the
  // roofline box beam already uses, just without needing
  // computeRoofBearingSegments' 3-way split (a single beam's own coverage
  // is always one contiguous run).
  const midWallBeamRenderData = useMemo(() => {
    if (!footprint) return [];
    const result: {
      wallId: string;
      story: "ground" | "second";
      /** Which of the two things sharing this list a record is. Carried as a
       * real field so no consumer has to read `beamId`'s prefix back to find
       * out — see the spanning-header branch below. */
      kind: "mid-wall-beam" | "spanning-header";
      beamId: string;
      anchorX: number;
      anchorZ: number;
      anchorYIn: number;
      rotationRad: number;
      members: PanelMember[];
      widthFt: number;
      heightFt: number;
      depthFt: number;
    }[] = [];
    const storiesData: {
      story: "ground" | "second";
      wallSlots: Record<string, PanelSlot[]>;
      beams: Record<string, MidWallBeam[]>;
      headers: Record<string, SpanningHeader[]>;
      baseYIn: number;
    }[] = [{ story: "ground", wallSlots, beams: midWallBeamsByWallId, headers: spanningHeadersByWallId, baseYIn: 0 }];
    if (secondStory) {
      storiesData.push({
        story: "second",
        wallSlots: secondStory.wallSlots,
        beams: secondStoryMidWallBeamsByWallId,
        headers: secondStorySpanningHeadersByWallId,
        baseYIn: heightIn,
      });
    }
    for (const { story, wallSlots: storyWallSlots, beams, headers, baseYIn } of storiesData) {
      for (const wall of footprint.walls) {
        const wallBeams = beams[wall.id];
        const wallHeaders = headers[wall.id] ?? [];
        if ((!wallBeams || wallBeams.length === 0) && wallHeaders.length === 0) continue;
        const axis = wallAxis(footprint, wall);
        const slots = storyWallSlots[wall.id] ?? [];
        const offsetsIn = slots.reduce<number[]>((acc, s) => [...acc, acc[acc.length - 1]! + s.widthIn], [0]);
        // Stage 2b: a spanning header draws as the real header panel it is
        // (buildBigHeaderMembers at its own derived span), in the space the
        // band split above already left for it. Placed by the same wallAxis
        // + slot-offset math the beams use one loop down — nothing about
        // where a thing sits on a wall is re-derived for it.
        for (const header of wallHeaders) {
          const startXIn = offsetsIn[header.startSlotIndex] ?? 0;
          const endXIn = offsetsIn[header.endSlotIndex] ?? 0;
          const lengthIn = Math.max(0, endXIn - startXIn);
          if (lengthIn <= 0) continue;
          const assemblyHeightIn = resolveSpanningHeaderHeightIn(header);
          // ⚠ Anchored on the FIRST PANEL IT SPANS, not on `wallAxis` plus a
          // slot offset — and the difference is real, not tidiness. A slot
          // offset is measured from the panel RUN's origin, while
          // `axis.startXFt` is the wall's true corner, and on a wall that
          // butts a longer neighbour the run starts a wall-thickness in.
          // The browser harness measured the gap: **15.5in of drift**, a
          // header floating off the panels it is carried by.
          //
          // The beam loop just below has the same shape and the same drift.
          // It is PRE-EXISTING and deliberately left alone here: fixing it
          // would move the rendered beam on every existing project, which is
          // the same call Stage 3 made about the roof-bearing anchor. Noted
          // rather than quietly matched — see the report.
          //
          // ⚠ Both stories look the anchor up in their own RAW (pre-split)
          // box list. Reading the second story's already-split list (the
          // asymmetry this line used to carry) is harmless right up until a
          // beam consumes a slot's whole height — then that slot has no box
          // in the split list, this `.find` misses, and the header is simply
          // not drawn, with nothing said.
          const anchorBox = (story === "ground" ? rawSlotBoxes : rawSecondStorySlotBoxes).find(
            (b) => b.wallId === wall.id && b.slotIndex === header.startSlotIndex,
          );
          if (!anchorBox) continue;
          result.push({
            wallId: wall.id,
            story,
            // The real discriminant. Everything downstream (the OBJ label,
            // above all) branches on THIS and never on the shape of `beamId` —
            // a string prefix is the shape that cost this repo the hyphen
            // parse in `combinedPanelLabel` and the verb parse in
            // `applyPlacementResult`, and a feature whose own doc comments
            // cite both should not add a third.
            kind: "spanning-header",
            beamId: `spanningheader_${spanningHeaderNameById.get(header.id) ?? header.id}`,
            anchorX: anchorBox.anchorX,
            anchorZ: anchorBox.anchorZ,
            anchorYIn: baseYIn + header.heightIn,
            rotationRad: anchorBox.rotationRad,
            members: buildBigHeaderMembers(lengthIn, thicknessIn, assemblyHeightIn, false, jackStudConfig),
            widthFt: lengthIn / IN_PER_FT,
            heightFt: assemblyHeightIn / IN_PER_FT,
            depthFt: thicknessIn / IN_PER_FT,
          });
        }
        if (!wallBeams || wallBeams.length === 0) continue;
        for (const beam of wallBeams) {
          const startXIn = offsetsIn[beam.startSlotIndex] ?? 0;
          const endXIn = offsetsIn[beam.endSlotIndex] ?? 0;
          const lengthIn = Math.max(0, endXIn - startXIn);
          if (lengthIn <= 0) continue;
          const assemblyHeightIn = resolveMidWallBeamAssemblyHeightIn(beam);
          const members =
            beam.kind === "big-header-beam"
              ? buildBigHeaderBeamMembers(lengthIn, thicknessIn, assemblyHeightIn)
              : buildBoxBeamMembers(lengthIn, thicknessIn, beam.sizeId);
          const offsetFt = startXIn / IN_PER_FT;
          result.push({
            wallId: wall.id,
            story,
            kind: "mid-wall-beam",
            beamId: beam.id,
            anchorX: axis.startXFt + axis.dirX * offsetFt,
            anchorZ: axis.startZFt + axis.dirZ * offsetFt,
            anchorYIn: baseYIn + beam.heightIn,
            rotationRad: axis.rotationRad,
            members,
            widthFt: lengthIn / IN_PER_FT,
            heightFt: assemblyHeightIn / IN_PER_FT,
            depthFt: thicknessIn / IN_PER_FT,
          });
        }
      }
    }
    return result;
    // ⚠ Every input this memo READS is listed, including the three Stage 2b
    // ones. The stale-memo defect Stage 3's review found was exactly this
    // array one entry short: the truss plate stayed drawn at full length
    // across an unbuilt span because the memo did not list the stop map.
  }, [
    footprint,
    wallSlots,
    secondStory,
    midWallBeamsByWallId,
    secondStoryMidWallBeamsByWallId,
    spanningHeadersByWallId,
    secondStorySpanningHeadersByWallId,
    spanningHeaderNameById,
    rawSlotBoxes,
    // ⚠ `rawSecondStorySlotBoxes`, not `secondStorySlotBoxes` — this memo's
    // anchor lookup moved to the raw list and this array has to move with it.
    // Listing the old one would have been a memo that reads one value and
    // watches another: the second story's headers would have stayed drawn at
    // stale anchors, which is precisely the stale-memo defect the comment
    // above describes. Caught by the `exhaustive-deps` WARNING, which is why
    // this app's notes insist a lint delta counts warnings.
    rawSecondStorySlotBoxes,
    thicknessIn,
    heightIn,
    jackStudConfig,
  ]);

  // Panel-name labels (Tommy: "the specific panel label (N1 for example)
  // to appear on... the simplified box 3d views") — a pure re-derivation of
  // the exact same compass-direction naming `page.tsx`'s own `allInstances`
  // uses (same footprint/wallSlots/standardWidthIn/jackStudConfig inputs),
  // so labels here can never drift out of sync with the 2D view or Shop
  // Drawing pages' own numbering. Second story reuses the ground floor's
  // wallSlots today (no independent per-story data yet), so it currently
  // resolves to the same names — computed separately anyway so this stays
  // correct once a real per-story model exists.
  const groundInstancesBySlot = useMemo(
    () =>
      groupInstancesBySlot(
        footprint
          ? allPanelInstances(
              footprint,
              wallSlots,
              standardWidthIn,
              jackStudConfig,
              undefined,
              undefined,
              heightIn,
              // Beams AND spanning headers. ⚠ This matters even though a
              // header alone leaves a covered slot with one band: a slot
              // carrying BOTH a beam and a header splits into two, and a
              // naming pass that saw only the beams would count a different
              // number of instances than page.tsx does — i.e. the 3D labels
              // and the panel schedule would disagree about which panel is
              // N7.
              Object.fromEntries(
                [...new Set([...Object.keys(midWallBeamsByWallId), ...Object.keys(spanningHeadersByWallId)])].map((id) => [
                  id,
                  wallBandGeometry(
                    midWallBeamsToGeometry(midWallBeamsByWallId[id] ?? []),
                    spanningHeadersToGeometry(spanningHeadersByWallId[id] ?? []),
                  ),
                ]),
              ),
            )
          : [],
      ),
    [footprint, wallSlots, standardWidthIn, jackStudConfig, heightIn, midWallBeamsByWallId, spanningHeadersByWallId],
  );
  const secondStoryInstancesBySlot = useMemo(
    () =>
      groupInstancesBySlot(
        footprint && secondStory
          ? allPanelInstances(
              footprint,
              secondStory.wallSlots,
              standardWidthIn,
              jackStudConfig,
              undefined,
              undefined,
              secondStory.wallHeightFt * IN_PER_FT,
              // Same joined list as the ground floor above, same reason.
              Object.fromEntries(
                [...new Set([...Object.keys(secondStoryMidWallBeamsByWallId), ...Object.keys(secondStorySpanningHeadersByWallId)])].map(
                  (id) => [
                    id,
                    wallBandGeometry(
                      midWallBeamsToGeometry(secondStoryMidWallBeamsByWallId[id] ?? []),
                      spanningHeadersToGeometry(secondStorySpanningHeadersByWallId[id] ?? []),
                    ),
                  ],
                ),
              ),
            )
          : [],
      ),
    [footprint, secondStory, standardWidthIn, jackStudConfig, secondStoryMidWallBeamsByWallId, secondStorySpanningHeadersByWallId],
  );

  const wrapSkins = useMemo(
    () =>
      showWraps ? [...checkedWrapSkins(checkedInteriorIds, "interior"), ...checkedWrapSkins(checkedExteriorIds, "exterior")] : [],
    [showWraps, checkedInteriorIds, checkedExteriorIds],
  );

  const handleDownloadObj = () => {
    const toWorldPlacedPanel =
      (labelPrefix: string, worldYIn: number) =>
      ({ box, members }: { box: (typeof slotRenderData)[number]["box"]; members: PanelMember[] | null }): WorldPlacedPanel => ({
        label: `${labelPrefix}${box.wallId}_${box.slotIndex}${box.midWallBandIndex !== undefined ? `_band${box.midWallBandIndex}` : ""}`,
        worldXIn: box.anchorX * IN_PER_FT,
        worldZIn: box.anchorZ * IN_PER_FT,
        worldYIn: worldYIn + box.yOffsetFt * IN_PER_FT,
        rotationRad: box.rotationRad,
        members,
        blobSizeIn: members
          ? undefined
          : { widthIn: box.widthFt * IN_PER_FT, heightIn: box.heightFt * IN_PER_FT, depthIn: box.depthFt * IN_PER_FT },
      });
    const panels: WorldPlacedPanel[] = [
      ...slotRenderData.map(toWorldPlacedPanel("", 0)),
      ...secondStorySlotRenderData.map(toWorldPlacedPanel("story2_", heightIn)),
      ...gableRenderData.map(
        ({ wallId, tileIndex, anchorX, anchorZ, anchorYFt, rotationRad, members }): WorldPlacedPanel => ({
          label: `gable_${wallId}_${tileIndex}`,
          worldXIn: anchorX * IN_PER_FT,
          worldZIn: anchorZ * IN_PER_FT,
          worldYIn: anchorYFt * IN_PER_FT,
          rotationRad,
          members,
        }),
      ),
      ...roofBearingRenderData.map(
        ({ wallId, segmentIndex, anchorX, anchorZ, anchorYIn, rotationRad, members }): WorldPlacedPanel => ({
          label: `roofbearing_${wallId}_${segmentIndex}`,
          worldXIn: anchorX * IN_PER_FT,
          worldZIn: anchorZ * IN_PER_FT,
          worldYIn: anchorYIn,
          rotationRad,
          members,
        }),
      ),
      ...midWallBeamRenderData.map(
        ({ wallId, story, kind, beamId, anchorX, anchorZ, anchorYIn, rotationRad, members }): WorldPlacedPanel => ({
          // A spanning header labels itself rather than being filed under
          // `midwallbeam_` — an export should name a header the way its own
          // sheet does. Chosen by the record's own `kind`, NEVER by
          // `beamId.startsWith("spanningheader_")`: an id is a display/export
          // string, and logic that reads one back is the shape that cost this
          // repo `combinedPanelLabel`'s hyphen parse and the placement
          // notice's verb parse. (The id still carries the prefix, because the
          // OBJ group names the harness reads are built from it.)
          label: kind === "spanning-header" ? `${beamId}_${story}_${wallId}` : `midwallbeam_${story}_${wallId}_${beamId}`,
          worldXIn: anchorX * IN_PER_FT,
          worldZIn: anchorZ * IN_PER_FT,
          worldYIn: anchorYIn,
          rotationRad,
          members,
        }),
      ),
      /* ⚠ NOT included: the OBJ exporter has no way to express the tip the
         view applies above, so a deck panel would land in the file standing on
         end. Left out deliberately rather than exported wrong — the decks are
         a view layer until the exporter can place them. */
      ...baleFoundationRenderData.map(
        ({ id, anchorX, anchorZ, anchorYFt, rotationRad, members }): WorldPlacedPanel => ({
          label: `balefoundation_${id}`,
          worldXIn: anchorX * IN_PER_FT,
          worldZIn: anchorZ * IN_PER_FT,
          worldYIn: anchorYFt * IN_PER_FT,
          rotationRad,
          members,
        }),
      ),
    ];
    const objText = buildBuildingObj(panels, "Building");
    const blob = new Blob([objText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "building.obj";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!footprint) {
    return (
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          border: "1px solid #ccc",
          background: "#fcfcfa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
        }}
      >
        Click and drag to draw the footprint
      </div>
    );
  }

  const footprintBoundsRaw = footprintBounds(footprint);
  // A second story makes the building taller without making the footprint
  // any wider — factor total height into the camera distance too, so the
  // default starting view doesn't come in cropped against the roofline.
  const totalHeightFt = wallHeightFt + (secondStory ? secondStory.wallHeightFt : 0);
  const bounds: Bounds = { ...footprintBoundsRaw, maxDim: Math.max(footprintBoundsRaw.maxDim, totalHeightFt) };
  const cameraPosition = birdsEyeCameraPosition(bounds);
  const defaultTarget: [number, number, number] = [footprintBoundsRaw.centerX, totalHeightFt / 2, footprintBoundsRaw.centerZ];
  const target: [number, number, number] = orbitTargetOverride ?? defaultTarget;
  const groundSize = bounds.maxDim * 3;

  // Sill & Header drag tool (Tommy: "manipulate sill and header height with
  // the drag tool") — only rendered for the currently-selected window slot,
  // as 2 small Y-axis-only TransformControls handles at its RO's bottom
  // (sill) and top (header) edges. The scene's Y axis is in FEET (see the
  // second-story stacking above, which uses `wallHeightFt` directly as a Y
  // offset) while sill/window heights are stored in INCHES — every
  // conversion here divides/multiplies by IN_PER_FT accordingly.
  const renderSillHeaderHandles = (box: (typeof slotBoxes)[number], story: "ground" | "second") => {
    if (
      tool3D !== "sill-header" ||
      box.slot.type !== "window" ||
      !selectedWindow ||
      selectedWindow.story !== story ||
      selectedWindow.wallId !== box.wallId ||
      selectedWindow.slotIndex !== box.slotIndex
    ) {
      return null;
    }
    const sillHeightIn = box.slot.sillHeightIn ?? sillDefaultHeightIn.value;
    const windowHeightIn = box.slot.heightIn ?? standardWindowHeightDefaultIn.value;
    const xLocal = box.widthFt / 2;
    const zLocal = box.depthFt / 2;
    const sillYFt = sillHeightIn / IN_PER_FT;
    const headerYFt = (sillHeightIn + windowHeightIn) / IN_PER_FT;

    const commitSill = () => {
      setIsDraggingHandle(false);
      const draggedYFt = sillHandleRef.current?.position.y;
      if (draggedYFt === undefined) return;
      const rawIn = draggedYFt * IN_PER_FT;
      const effectiveWallHeightFt = story === "second" && secondStory ? secondStory.wallHeightFt : wallHeightFt;
      const maxSillHeightIn = effectiveWallHeightFt * IN_PER_FT - windowHeightIn;
      const clampedIn = Math.min(Math.max(rawIn, sillHeaderHeightInRange.minIn), Math.min(sillHeaderHeightInRange.maxIn, maxSillHeightIn));
      onSetWindowSillHeight?.(story, box.wallId, box.slotIndex, clampedIn);
    };
    const commitHeader = () => {
      setIsDraggingHandle(false);
      const draggedYFt = headerHandleRef.current?.position.y;
      if (draggedYFt === undefined) return;
      const rawTopIn = draggedYFt * IN_PER_FT;
      onSetWindowHeight?.(story, box.wallId, box.slotIndex, Math.max(1, rawTopIn - sillHeightIn));
    };

    return (
      <>
        <TransformControls mode="translate" showX={false} showZ={false} onMouseDown={() => setIsDraggingHandle(true)} onMouseUp={commitSill}>
          <mesh ref={sillHandleRef} position={[xLocal, sillYFt, zLocal]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#2f8f4e" />
          </mesh>
        </TransformControls>
        <TransformControls mode="translate" showX={false} showZ={false} onMouseDown={() => setIsDraggingHandle(true)} onMouseUp={commitHeader}>
          <mesh ref={headerHandleRef} position={[xLocal, headerYFt, zLocal]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#c0392b" />
          </mesh>
        </TransformControls>
      </>
    );
  };

  return (
    <div style={{ width: CANVAS_WIDTH }}>
      {/* Stage 4B: no Export as OBJ while a browsed design is on screen
          (decision 23). The 3D view itself stays — browsing is "design yes,
          money no", and the model is part of the design. */}
      {!captureMode && !browsing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button type="button" onClick={handleDownloadObj} style={{ fontSize: 12 }}>
            Export as OBJ
          </button>
        </div>
      )}
      <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: captureMode ? "none" : "1px solid #ccc" }}>
        <Canvas
          camera={{ position: cameraPosition, fov: 50, near: 0.1, far: 10000 }}
          /* react-three-fiber's default is `frameloop="always"`, which
             renders at 60fps for as long as the Canvas is mounted. For the
             interactive view that is correct and wanted: it has OrbitControls
             and a user looking at it, and it is mounted only on the 3D view
             stop (`page.tsx` renders it in the else-branch of
             `viewMode === "elevation" ? ... : viewMode === "plan" ? ...`), so
             it stops costing anything the moment the user leaves 3D.

             `captureMode` is the opposite case and was the bug. Its Canvas is
             `BuildingSummaryRender`'s, mounted unconditionally whenever a
             footprint exists and parked at `left: -9999px`; measured on a
             production build of `main` @ `2422fbd` it issued ~29,700 WebGL
             draw calls per second while the user sat idle in plan view at 19
             panels, for a PNG it had already taken. `demand` renders only
             when r3f's reconciler commits a change to the scene, which is
             also exactly when the PNG needs re-taking — see CaptureFrame. */
          frameloop={captureMode ? "demand" : "always"}
          gl={captureMode ? { preserveDrawingBuffer: true } : undefined}
          onPointerMissed={() => {
            if (tool3D === "orbit") setOrbitTargetOverride(null);
          }}
        >
          {captureMode && onCapture && (
            <CaptureFrame
              onCapture={onCapture}
              onCaptureDone={onCaptureDone ?? NOOP}
              live={captureLive}
              captureRequestId={captureRequestId}
            />
          )}
          <ambientLight intensity={0.6} />
          <directionalLight position={[bounds.maxDim, bounds.maxDim * 2, bounds.maxDim]} intensity={0.8} />
          <mesh position={[bounds.centerX, -0.05, bounds.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[groundSize, groundSize]} />
            <meshStandardMaterial color="#e8e6df" />
          </mesh>
          {slotRenderData.map(({ box, members }) => (
            <group
              key={`${box.wallId}-${box.slotIndex}-${box.midWallBandIndex ?? "full"}`}
              position={[box.anchorX, box.yOffsetFt, box.anchorZ]}
              rotation={[0, -box.rotationRad, 0]}
              onClick={
                tool3D === "edit"
                  ? (e) => {
                      e.stopPropagation();
                      onToggleOpening?.("ground", box.wallId, box.slotIndex);
                    }
                  : tool3D === "sill-header" && box.slot.type === "window"
                    ? (e) => {
                        e.stopPropagation();
                        setSelectedWindow({ wallId: box.wallId, slotIndex: box.slotIndex, story: "ground" });
                      }
                    : undefined
              }
              onPointerDown={
                tool3D === "orbit"
                  ? (e) => {
                      orbitDragStartRef.current = {
                        clientX: e.nativeEvent.clientX,
                        clientY: e.nativeEvent.clientY,
                        worldPoint: [e.point.x, e.point.y, e.point.z],
                      };
                    }
                  : undefined
              }
            >
              {!simplified && members ? (
                <>
                  <PanelMembersGroup
                    members={members}
                    colorOverride={box.slot.type === "safety-gap" ? PANEL_TYPE_COLORS["safety-gap"] : undefined}
                  />
                  <WallPanelLabel
                    faces={["top"]}
                    text={combinedPanelLabel(instancesForBox(groundInstancesBySlot, box))}
                    widthFt={box.widthFt}
                    heightFt={box.heightFt}
                    depthFt={box.depthFt}
                  />
                </>
              ) : simplified ? (
                renderSimplifiedSlot(
                  box,
                  box.heightFt * IN_PER_FT,
                  jackStudConfig,
                  standardWidthIn,
                  instancesForBox(groundInstancesBySlot, box),
                  showWraps,
                  wrapSkins,
                )
              ) : (
                <mesh position={[box.widthFt / 2, box.heightFt / 2, box.depthFt / 2]}>
                  <boxGeometry args={[box.widthFt, box.heightFt, box.depthFt]} />
                  <meshStandardMaterial color={BLOB_COLOR} transparent opacity={0.6} />
                </mesh>
              )}
              {renderSillHeaderHandles(box, "ground")}
            </group>
          ))}
          {secondStorySlotRenderData.map(({ box, members }) => (
            <group
              key={`story2-${box.wallId}-${box.slotIndex}-${box.midWallBandIndex ?? "full"}`}
              position={[box.anchorX, wallHeightFt + box.yOffsetFt, box.anchorZ]}
              rotation={[0, -box.rotationRad, 0]}
              onClick={
                tool3D === "edit"
                  ? (e) => {
                      e.stopPropagation();
                      onToggleOpening?.("second", box.wallId, box.slotIndex);
                    }
                  : tool3D === "sill-header" && box.slot.type === "window"
                    ? (e) => {
                        e.stopPropagation();
                        setSelectedWindow({ wallId: box.wallId, slotIndex: box.slotIndex, story: "second" });
                      }
                    : undefined
              }
              onPointerDown={
                tool3D === "orbit"
                  ? (e) => {
                      orbitDragStartRef.current = {
                        clientX: e.nativeEvent.clientX,
                        clientY: e.nativeEvent.clientY,
                        worldPoint: [e.point.x, e.point.y, e.point.z],
                      };
                    }
                  : undefined
              }
            >
              {!simplified && members ? (
                <>
                  <PanelMembersGroup
                    members={members}
                    colorOverride={box.slot.type === "safety-gap" ? PANEL_TYPE_COLORS["safety-gap"] : undefined}
                  />
                  <WallPanelLabel
                    faces={["top"]}
                    text={combinedPanelLabel(instancesForBox(secondStoryInstancesBySlot, box))}
                    widthFt={box.widthFt}
                    heightFt={box.heightFt}
                    depthFt={box.depthFt}
                  />
                </>
              ) : simplified ? (
                renderSimplifiedSlot(
                  box,
                  box.heightFt * IN_PER_FT,
                  jackStudConfig,
                  standardWidthIn,
                  instancesForBox(secondStoryInstancesBySlot, box),
                  showWraps,
                  wrapSkins,
                )
              ) : (
                <mesh position={[box.widthFt / 2, box.heightFt / 2, box.depthFt / 2]}>
                  <boxGeometry args={[box.widthFt, box.heightFt, box.depthFt]} />
                  <meshStandardMaterial color={BLOB_COLOR} transparent opacity={0.6} />
                </mesh>
              )}
              {renderSillHeaderHandles(box, "second")}
            </group>
          ))}
          {gableRenderData.map(
            ({ wallId, tileIndex, anchorX, anchorZ, anchorYFt, rotationRad, members, widthFt, heightFt, depthFt, isSafetyGap, verticalGapHeightFt }) => (
              <group key={`gable-${wallId}-${tileIndex}`} position={[anchorX, anchorYFt, anchorZ]} rotation={[0, -rotationRad, 0]}>
                {simplified ? (
                  <>
                    <mesh position={[widthFt / 2, heightFt / 2, depthFt / 2]}>
                      <boxGeometry args={[widthFt, heightFt, depthFt]} />
                      <meshStandardMaterial
                        color={isSafetyGap ? NAMED_PANEL_TYPE_COLORS["safety-gap"] : NAMED_PANEL_TYPE_COLORS.gable}
                        transparent
                        opacity={0.6}
                      />
                    </mesh>
                    {verticalGapHeightFt > 0 && (
                      <mesh position={[widthFt / 2, heightFt + verticalGapHeightFt / 2, depthFt / 2]}>
                        <boxGeometry args={[widthFt, verticalGapHeightFt, depthFt]} />
                        <meshStandardMaterial color={NAMED_PANEL_TYPE_COLORS["safety-gap"]} transparent opacity={0.6} />
                      </mesh>
                    )}
                  </>
                ) : (
                  <PanelMembersGroup members={members} />
                )}
              </group>
            ),
          )}
          {roofBearingRenderData.map(({ wallId, segmentIndex, anchorX, anchorZ, anchorYIn, rotationRad, members, widthFt, heightFt, depthFt }) => (
            <group
              key={`roofbearing-${wallId}-${segmentIndex}`}
              position={[anchorX, anchorYIn / IN_PER_FT, anchorZ]}
              rotation={[0, -rotationRad, 0]}
            >
              {simplified ? (
                <mesh position={[widthFt / 2, heightFt / 2, depthFt / 2]}>
                  <boxGeometry args={[widthFt, heightFt, depthFt]} />
                  <meshStandardMaterial color={ROOF_BEARING_COLOR} transparent opacity={0.6} />
                </mesh>
              ) : (
                <PanelMembersGroup members={members} />
              )}
            </group>
          ))}
          {midWallBeamRenderData.map(({ beamId, anchorX, anchorZ, anchorYIn, rotationRad, members, widthFt, heightFt, depthFt }) => (
            <group key={`midwallbeam-${beamId}`} position={[anchorX, anchorYIn / IN_PER_FT, anchorZ]} rotation={[0, -rotationRad, 0]}>
              {simplified ? (
                <mesh position={[widthFt / 2, heightFt / 2, depthFt / 2]}>
                  <boxGeometry args={[widthFt, heightFt, depthFt]} />
                  <meshStandardMaterial color={ROOF_BEARING_COLOR} transparent opacity={0.6} />
                </mesh>
              ) : (
                <PanelMembersGroup members={members} />
              )}
            </group>
          ))}
          {ridgeRenderData.map(({ id, anchorX, anchorZ, anchorYFt, rotationRad, members }) => (
            <group key={`ridge-${id}`} position={[anchorX, anchorYFt, anchorZ]} rotation={[0, -rotationRad, 0]}>
              <PanelMembersGroup members={members} />
            </group>
          ))}
          {deckRenderData.map(({ id, anchorX, anchorZ, anchorYFt, rotationRad, tiltRad, members }) => (
            <group key={`deck-${id}`} position={[anchorX, anchorYFt, anchorZ]} rotation={[0, -rotationRad, 0]}>
              {/* ⚠ Tips the panel off its end and onto the plane it belongs
                  on. Its members are built lying in the compressor table, so
                  the panel's own Z — its span — comes through as three.js Y,
                  standing upright. A quarter turn LESS the roof's pitch sends
                  that span out along the slope; a floor passes tiltRad 0 and
                  gets the flat case exactly.

                  ⚠ This read `Math.PI / 2` with no tilt term until
                  2026-10-26. The commit that was meant to introduce it was
                  written by a script that threw before writing the file, so
                  the deck went on drawing FLAT while the data carried a tilt
                  nothing used. */}
              <group rotation={[Math.PI / 2 - tiltRad, 0, 0]}>
                <PanelMembersGroup members={members} />
              </group>
            </group>
          ))}
          {baleFoundationRenderData.map(({ id, anchorX, anchorZ, anchorYFt, rotationRad, members }) => (
            <group key={`balefoundation-${id}`} position={[anchorX, anchorYFt, anchorZ]} rotation={[0, -rotationRad, 0]}>
              <PanelMembersGroup members={members} />
            </group>
          ))}
          {!captureMode && <OrbitControls target={target} makeDefault enabled={!isDraggingHandle} />}
          {!captureMode && compassRef && <CompassTracker compassRef={compassRef} target={target} />}
        </Canvas>
      </div>
    </div>
  );
}
