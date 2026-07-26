"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls } from "@react-three/drei";
import type { Mesh } from "three";
import {
  computeRoofBearingSegments,
  computeWallVerticalBands,
  isSlotBoxBeamCovered,
  panelSlotBoxes3D,
  wallAxis,
  type BoxBeamCoverage,
  type Footprint,
  type PanelSlot,
  type PanelSlotBox3D,
  type WallVerticalBand,
} from "@building-integrity/geometry";
import { allPanelInstances, combinedPanelLabel, type PanelInstance } from "./panelInstances";
import type { MidWallBeam } from "./midWallBeam";
import { NAMED_PANEL_TYPE_COLORS } from "./panelColors";
import { resolveBracedStyle } from "./bracedStyle";
import PanelLabel from "./PanelLabel";
import {
  BOX_BEAM_SIZE_DEFAULT,
  bracingStyleToPatternMirror,
  buildBoxBeamMembers,
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
  computeDoorRoughOpeningHeightIn,
  computeSharedRooflineBearingHeightIn,
  doorRoughOpeningSelectedHeightIn,
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
const EMPTY_MID_WALL_BEAM_BANDS_BY_WALL_ID: Record<string, WallVerticalBand[]> = {};
const EMPTY_MID_WALL_BEAMS_BY_WALL_ID: Record<string, MidWallBeam> = {};
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
): PanelMember[] | null {
  switch (slot.type) {
    case "standard":
      return isSquareBalePanelization
        ? buildSquareBalePanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer, squareBaleStudConfig, nailerOffsetIn)
        : buildStandardPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer);
    case "braced": {
      const defaultStyle = bracingStyleToPatternMirror(bracingStyle);
      const style = resolveBracedStyle(slot, defaultStyle.pattern, defaultStyle.mirrored);
      return buildBracedPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer, style.pattern, style.mirrored);
    }
    case "column":
      return buildColumnPanelMembers(thicknessIn, heightIn, includeNailer);
    case "corner":
    case "safety-oct-corner":
      // Square Bale Panels' corner is a wider, asymmetric-stud construction
      // (Tommy: "standard size at 39in") matching the 39in slot the tiling
      // system already reserves for it under this panelization type (see
      // cornerWidthInForTiling in page.tsx) — the plain fixed-25.5in
      // Column/Corner unit only applies to every other panelization type.
      return isSquareBalePanelization
        ? buildSquareBaleCornerPanelMembers(thicknessIn, heightIn, includeNailer, nailerOffsetIn)
        : buildCornerPanelMembers(thicknessIn, heightIn, includeNailer);
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
 * one, bottom-to-top — see computeWallVerticalBands) actually reaches the
 * story's own ceiling; a roofline Box Beam's own per-slot height
 * reduction (see secondStorySlotBoxes below) only ever applies there,
 * since that shortening always comes from the very top of the row
 * regardless of whether a bond beam also splits it lower down. */
interface SplitPanelSlotBox3D extends PanelSlotBox3D {
  yOffsetFt: number;
  midWallBeamBand?: "below-beam" | "above-beam";
  isTopmostBand: boolean;
}

function splitForMidWallBeam(
  boxes: PanelSlotBox3D[],
  bandsByWallId: Record<string, WallVerticalBand[]>,
): SplitPanelSlotBox3D[] {
  const result: SplitPanelSlotBox3D[] = [];
  for (const box of boxes) {
    const bands = bandsByWallId[box.wallId];
    if (!bands) {
      result.push({ ...box, yOffsetFt: 0, isTopmostBand: true });
      continue;
    }
    bands.forEach((band, i) => {
      result.push({
        ...box,
        yOffsetFt: band.bottomIn / IN_PER_FT,
        heightFt: (band.topIn - band.bottomIn) / IN_PER_FT,
        midWallBeamBand: band.band,
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
 * across its below/above-band instances (same convention a window's own
 * header+sill already use) — this narrows the lookup to just the one
 * band this particular box belongs to, so its label isn't a merge of
 * both bands' names. A box with no band (unaffected wall) returns every
 * instance for that key unfiltered, exactly today's behavior. */
function instancesForBox(instancesBySlot: Map<string, PanelInstance[]>, box: SplitPanelSlotBox3D): PanelInstance[] {
  const all = instancesBySlot.get(`${box.wallId}-${box.slotIndex}`) ?? [];
  if (!box.midWallBeamBand) return all;
  return all.filter((i) => i.midWallBeamBand === box.midWallBeamBand);
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

interface Building3DViewProps {
  footprint: Footprint | null;
  wallSlots: Record<string, PanelSlot[]>;
  wallHeightFt: number;
  thicknessIn: number;
  includeNailer: boolean;
  primaryCornerIds: Set<string>;
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
      verticalGapHeightIn?: number;
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
  /** Which walls (ground floor) have a Mid-Wall Bond Beam splitting their
   * own row into real vertical bands (page.tsx's own
   * `midWallBeamBandsByWallId`, pre-resolved via computeWallVerticalBands)
   * — a wall with no entry renders exactly as before this feature existed.
   * Stage 1: at most one beam per wall, full width. */
  midWallBeamBandsByWallId?: Record<string, WallVerticalBand[]>;
  /** Same as `midWallBeamBandsByWallId`, for the second story. */
  secondStoryMidWallBeamBandsByWallId?: Record<string, WallVerticalBand[]>;
  /** Each beam's own height/sizeId (page.tsx's own
   * `midWallBeamsByStoryAndWallId.ground`) — bands alone give the split,
   * but rendering the beam MEMBER itself (via buildBoxBeamMembers) also
   * needs its own real sizeId. */
  midWallBeamsByWallId?: Record<string, MidWallBeam>;
  secondStoryMidWallBeamsByWallId?: Record<string, MidWallBeam>;
  /** Renders a static, non-interactive SE bird's-eye frame instead of the
   * normal orbit-able preview — used to capture a PNG for the Project
   * Summary page's static rendering (Tommy: "a static 3d rendering image
   * from a SE birdseye view"). Reuses the exact same camera math
   * (birdsEyeCameraPosition) as the interactive preview's own default
   * starting angle, so the two stay visually consistent. */
  captureMode?: boolean;
  /** Called once, shortly after the capture-mode frame first renders, with
   * a `data:image/png` URL of that frame — `captureMode`'s Canvas needs
   * `gl={{ preserveDrawingBuffer: true }}` for `toDataURL` to read back a
   * real image (off by default for the interactive view, since it has a
   * small perf cost not worth paying there). */
  onCapture?: (dataUrl: string) => void;
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

/** Mounted only in `captureMode` — reads the Canvas's own `gl` via
 * `useThree` and grabs one frame as a PNG shortly after mount (a rAF tick
 * lets the scene's first real draw call land before reading pixels back). */
function CaptureFrame({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      onCapture(gl.domElement.toDataURL("image/png"));
    });
    return () => cancelAnimationFrame(id);
  }, [gl, onCapture]);
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
  thicknessIn,
  includeNailer,
  primaryCornerIds,
  secondStory,
  isSquareBalePanelization = false,
  squareBaleStudConfig = "single-2x4",
  bracingStyle = "chevron",
  nailerOffsetIn = 0,
  jackStudConfig,
  standardWidthIn,
  gableTilesByWallId = EMPTY_GABLE_TILES_BY_WALL_ID,
  roofEnabled = false,
  trussPlateInsetIn = 0,
  boxBeamCoverageByWallId = EMPTY_BOX_BEAM_COVERAGE_BY_WALL_ID,
  boxBeamSizeId = BOX_BEAM_SIZE_DEFAULT,
  midWallBeamBandsByWallId = EMPTY_MID_WALL_BEAM_BANDS_BY_WALL_ID,
  secondStoryMidWallBeamBandsByWallId = EMPTY_MID_WALL_BEAM_BANDS_BY_WALL_ID,
  midWallBeamsByWallId = EMPTY_MID_WALL_BEAMS_BY_WALL_ID,
  secondStoryMidWallBeamsByWallId = EMPTY_MID_WALL_BEAMS_BY_WALL_ID,
  captureMode = false,
  onCapture,
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
    () => (footprint ? panelSlotBoxes3D(footprint, wallSlots, thicknessIn, wallHeightFt, primaryCornerIds) : []),
    [footprint, wallSlots, thicknessIn, wallHeightFt, primaryCornerIds],
  );
  // Built flat (nominal height for every slot) above, then split into 1-2
  // real boxes for any wall with a Mid-Wall Bond Beam — mirrors
  // secondStorySlotBoxes' own "build flat, then post-process" pattern
  // below, generalized from overriding a box's height in place to
  // splitting it into two (a beam-covered slot now needs its own Y offset
  // too, not just its own height).
  const slotBoxes = useMemo(
    () => splitForMidWallBeam(rawSlotBoxes, midWallBeamBandsByWallId),
    [rawSlotBoxes, midWallBeamBandsByWallId],
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
  const secondStorySlotBoxes = useMemo(() => {
    if (!footprint || !secondStory) return [];
    const boxes = panelSlotBoxes3D(footprint, secondStory.wallSlots, thicknessIn, secondStory.wallHeightFt, primaryCornerIds);
    const splitBoxes = splitForMidWallBeam(boxes, secondStoryMidWallBeamBandsByWallId);
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
  }, [footprint, secondStory, thicknessIn, primaryCornerIds, secondStoryMidWallBeamBandsByWallId, boxBeamCoverageByWallId, boxBeamSizeId]);
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
  // WallElevationView's own 2D SVG nor anything else resolves today, since
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
        const members = tile.isSafetyGap
          ? buildSafetyGapMembers(thicknessIn, tallerLocalIn)
          : buildGablePanelMembers(tile.widthIn, thicknessIn, leftLocalIn, rightLocalIn, includeNailer);
        // A vertical safety-gap filler (Tommy: "an ability to put a safety
        // gap inbetween the truss bottom and the gable end top") stacks
        // directly above this tile's own capped high edge, up to the true
        // roofline — additive, not a replacement.
        if (tile.verticalGapHeightIn) {
          members.push(
            ...buildVerticalGapFillerMembers(tile.widthIn, thicknessIn, tile.verticalGapHeightIn).map((m) => ({
              ...m,
              position: { ...m.position, zIn: m.position.zIn + tallerLocalIn },
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
          verticalGapHeightFt: (tile.verticalGapHeightIn ?? 0) / IN_PER_FT,
        });
      });
    }
    return result.map((r) => ({ ...r, anchorYFt: gableBaseYFt }));
  }, [footprint, gableTilesByWallId, roofBaseHeightIn, roofEnabled, sharedRoofBearingHeightIn, thicknessIn, includeNailer]);

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
      const segments = secondStory
        ? computeRoofBearingSegments(slots, boxBeamCoverageByWallId[wall.id])
        : [{ kind: "truss-plate" as const, startXIn: 0, lengthIn: wall.lengthFt * IN_PER_FT }];
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
        const offsetFt = seg.startXIn / IN_PER_FT;
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
  ]);

  // Mid-Wall Bond Beam's own member geometry, one per wall (either story)
  // with a beam — mirrors roofBearingRenderData's own pattern exactly
  // (wallAxis for X/Z placement, buildBoxBeamMembers for the assembly),
  // just anchored at that beam's own real height within its own story
  // instead of always at the roofline. Stage 1: full wall width, so no
  // computeRoofBearingSegments-style horizontal splitting needed — the
  // beam's own length is simply that story's own slot-summed wall length.
  const midWallBeamRenderData = useMemo(() => {
    if (!footprint) return [];
    const result: {
      wallId: string;
      story: "ground" | "second";
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
      beams: Record<string, MidWallBeam>;
      baseYIn: number;
    }[] = [{ story: "ground", wallSlots, beams: midWallBeamsByWallId, baseYIn: 0 }];
    if (secondStory) {
      storiesData.push({ story: "second", wallSlots: secondStory.wallSlots, beams: secondStoryMidWallBeamsByWallId, baseYIn: heightIn });
    }
    for (const { story, wallSlots: storyWallSlots, beams, baseYIn } of storiesData) {
      for (const wall of footprint.walls) {
        const beam = beams[wall.id];
        if (!beam) continue;
        const axis = wallAxis(footprint, wall);
        const slots = storyWallSlots[wall.id] ?? [];
        const lengthIn = slots.reduce((sum, s) => sum + s.widthIn, 0);
        if (lengthIn <= 0) continue;
        const members = buildBoxBeamMembers(lengthIn, thicknessIn, beam.sizeId);
        const assemblyHeightIn = computeBoxBeamAssemblyHeightIn(beam.sizeId);
        result.push({
          wallId: wall.id,
          story,
          anchorX: axis.startXFt,
          anchorZ: axis.startZFt,
          anchorYIn: baseYIn + beam.heightIn,
          rotationRad: axis.rotationRad,
          members,
          widthFt: lengthIn / IN_PER_FT,
          heightFt: assemblyHeightIn / IN_PER_FT,
          depthFt: thicknessIn / IN_PER_FT,
        });
      }
    }
    return result;
  }, [footprint, wallSlots, secondStory, midWallBeamsByWallId, secondStoryMidWallBeamsByWallId, thicknessIn, heightIn]);

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
          ? allPanelInstances(footprint, wallSlots, standardWidthIn, jackStudConfig, undefined, undefined, midWallBeamBandsByWallId)
          : [],
      ),
    [footprint, wallSlots, standardWidthIn, jackStudConfig, midWallBeamBandsByWallId],
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
              secondStoryMidWallBeamBandsByWallId,
            )
          : [],
      ),
    [footprint, secondStory, standardWidthIn, jackStudConfig, secondStoryMidWallBeamBandsByWallId],
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
        label: `${labelPrefix}${box.wallId}_${box.slotIndex}${box.midWallBeamBand ? `_${box.midWallBeamBand}` : ""}`,
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
        ({ wallId, story, anchorX, anchorZ, anchorYIn, rotationRad, members }): WorldPlacedPanel => ({
          label: `midwallbeam_${story}_${wallId}`,
          worldXIn: anchorX * IN_PER_FT,
          worldZIn: anchorZ * IN_PER_FT,
          worldYIn: anchorYIn,
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
      {!captureMode && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button type="button" onClick={handleDownloadObj} style={{ fontSize: 12 }}>
            Export as OBJ
          </button>
        </div>
      )}
      <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: captureMode ? "none" : "1px solid #ccc" }}>
        <Canvas
          camera={{ position: cameraPosition, fov: 50, near: 0.1, far: 10000 }}
          gl={captureMode ? { preserveDrawingBuffer: true } : undefined}
          onPointerMissed={() => {
            if (tool3D === "orbit") setOrbitTargetOverride(null);
          }}
        >
          {captureMode && onCapture && <CaptureFrame onCapture={onCapture} />}
          <ambientLight intensity={0.6} />
          <directionalLight position={[bounds.maxDim, bounds.maxDim * 2, bounds.maxDim]} intensity={0.8} />
          <mesh position={[bounds.centerX, -0.05, bounds.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[groundSize, groundSize]} />
            <meshStandardMaterial color="#e8e6df" />
          </mesh>
          {slotRenderData.map(({ box, members }) => (
            <group
              key={`${box.wallId}-${box.slotIndex}-${box.midWallBeamBand ?? "full"}`}
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
              key={`story2-${box.wallId}-${box.slotIndex}-${box.midWallBeamBand ?? "full"}`}
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
          {midWallBeamRenderData.map(({ wallId, story, anchorX, anchorZ, anchorYIn, rotationRad, members, widthFt, heightFt, depthFt }) => (
            <group key={`midwallbeam-${story}-${wallId}`} position={[anchorX, anchorYIn / IN_PER_FT, anchorZ]} rotation={[0, -rotationRad, 0]}>
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
          {!captureMode && <OrbitControls target={target} makeDefault enabled={!isDraggingHandle} />}
          {!captureMode && compassRef && <CompassTracker compassRef={compassRef} target={target} />}
        </Canvas>
      </div>
    </div>
  );
}
