import {
  shedTallWallId,
  wallCompassDirection,
  type CompassDirection,
  type Footprint,
} from "@building-integrity/geometry";
import {
  PLATE_2X4_WIDTH_IN,
  buildCrossTiltPanelMembers,
  crossTiltMinimumLowHeightIn,
  planFloorRoofPanelWidthsIn,
  type CrossTiltPanelOptions,
  type PanelMember,
} from "@building-integrity/panel-catalog";

const IN_PER_FT = 12;

/** Where a panel sits in the world, in the frame `Building3DView` draws in. */
export interface CrossTiltWorldPlacement {
  anchorX: number;
  anchorZ: number;
  anchorYFt: number;
  rotationRad: number;
}

/** One wall's row of cross-tilted panels. */
export interface CrossTiltTakeoffRun {
  index: number;
  wallId: string;
  direction: CompassDirection;
  /** The wall's own length, which the row sums to exactly. */
  runIn: number;
  widthsIn: number[];
}

export interface CrossTiltTakeoffInstance {
  /** Stable id, and the same one the 3D view uses for its React keys. */
  id: string;
  /** `T1`, `T2`… along the wall — the row is one wall long, so a plain
   * counter locates a panel as well as a compass bearing would. */
  name: string;
  runIndex: number;
  wallId: string;
  direction: CompassDirection;
  /** How far along the wall this panel starts. */
  atIn: number;
  widthIn: number;
  groupKey: string;
  world: CrossTiltWorldPlacement;
}

export interface CrossTiltTakeoffGroup {
  /** Stable per unique panel, for React keys and sheet ids. */
  key: string;
  widthIn: number;
  /** Height at the EXTERIOR face — the low side, the roof rising inward. */
  lowHeightIn: number;
  /** Height at the interior face. */
  highHeightIn: number;
  /** The angle the one inclined top is cut to, off level. */
  tiltDeg: number;
  /** The rip taken off one edge of each top plate, for the cut list. */
  topPlateRip: { nominalSize: "2x4" | "4x4"; thinEdgeIn: number; thickEdgeIn: number; removedIn: number; angleDeg: number };
  /** How far the plate finishes proud of a square-cut top skin — his
   * *"~1/4in"*, computed from the real pitch rather than written as 1/4. */
  skinProudIn: number;
  /** Exactly what built `members`, so a consumer can re-read it without
   * reconstructing the options and risking a different panel. */
  options: CrossTiltPanelOptions;
  members: PanelMember[];
  instances: CrossTiltTakeoffInstance[];
}

export interface CrossTiltTakeoff {
  runs: CrossTiltTakeoffRun[];
  instances: CrossTiltTakeoffInstance[];
  groups: CrossTiltTakeoffGroup[];
  /**
   * The row's elevation face, for the one bucket that prices it.
   *
   * ⚠ Each panel's own width x its AVERAGE height, because the two faces of
   * this panel are different heights — the same trapezoid average the gable
   * row is priced on, read through the depth instead of across the width.
   */
  faceAreaSqFt: number;
  /** In words, not an empty row, when the wall is too short to panelise. */
  refusal: string | null;
}

export interface CrossTiltTakeoffInput {
  footprint: Footprint | null;
  /** Which walls carry the row. A shed's tall wall, set when the building is
   * drawn; empty on a peak, which has no tall side. */
  crossTiltWallIds: Set<string> | undefined;
  /** The wall/panel depth, which is this panel's depth and the distance the
   * tilt runs over. */
  depthIn: number;
  /** Withheld where no pitch resolves — then there is no roof to receive and
   * no row, rather than a guessed one. */
  roofPitchIn12: number | undefined;
  /** The row sits ON the wall, so this is where its underside lands. */
  wallHeightFt: number;
}

const EMPTY: CrossTiltTakeoff = { runs: [], instances: [], groups: [], faceAreaSqFt: 0, refusal: null };

/**
 * ⚠ **A cross-tilted panel's own low height — the tilt's rise and nothing
 * more.**
 *
 * His *"smaller set of gable line panels on top of the main wall"*: a short
 * panel sitting ON the wall, not a replacement for it, so the pair comes to
 * the wall height plus what the roof needs. One 2x4's width of straight
 * exterior face below the rip is what the row has always been built with.
 */
const CROSS_TILT_LOW_HEIGHT_IN = PLATE_2X4_WIDTH_IN;

/**
 * ⚠ **…but never shorter than the panel's own layers.**
 *
 * The 3 1/2in above is this app's stand-in and nothing more, and on a flat
 * enough roof it does not hold the panel's own bottom skin, bottom plate,
 * ripped plate edge and top skin — which is exactly what B8's five pinned
 * interferences were. `crossTiltMinimumLowHeightIn` is that sum, derived from
 * the panel rather than chosen, so the floor can be applied without waiting
 * on anyone. At the default 4:12 it is 3.374in and does not bite; it only
 * lifts the row on a flatter roof, where the rip leaves more board standing.
 */
function crossTiltLowHeightIn(pitchIn12: number): number {
  return Math.max(CROSS_TILT_LOW_HEIGHT_IN, crossTiltMinimumLowHeightIn(pitchIn12));
}

/* ⚠ On 2026-11-01 the minimum grew to include a real exterior stud (*"tall
   enough for a real stud in both wythes"*), so at the default 4:12 it is
   6.87in and the 3.5in stand-in above no longer decides anything. The
   stand-in stays as a floor for a hypothetical pitch steep enough to make
   the derived minimum smaller than it — which cannot happen today, and is
   cheaper to leave than to reason about again later. */

/** The signature a shop cuts by, so two panels share a sheet only if they
 * really are the same part. */
function optionsKey(o: CrossTiltPanelOptions): string {
  return [
    o.widthIn.toFixed(3),
    o.depthIn.toFixed(3),
    o.lowHeightIn.toFixed(3),
    o.pitchIn12.toFixed(3),
  ].join("-");
}

/**
 * ⚠ **THE ONE CROSS-TILTED PANEL TAKEOFF — the tilted gable row the building
 * actually has, for every consumer that draws, counts, weighs or prices it.**
 *
 * The row existed only inside `Building3DView`, as a loop that built members
 * and threw everything but the members away. So a shed's tall wall grew a row
 * of real framed panels that no document knew about: not in the panel count,
 * not in the plywood or board-feet totals, not in the project weight, not in
 * the fastener schedule, not priced, and with no Shop Fabrication sheet. The
 * shop was being handed a building missing a row of panels it can see on
 * screen.
 *
 * > *"Let's finish B1 with the tilted gable panels populating upon draw,
 * > material counts, screw counts, etc, along with shop fabrication pages."*
 * > — Tommy, 2026-11-01
 *
 * Same answer as the floor and roof decks: one pure function, called by the
 * view and by the documents, so the picture and the paperwork cannot describe
 * different panels. Two calls to it can only disagree by being given
 * different inputs, which is why `CrossTiltTakeoffInput` is assembled once in
 * `page.tsx` and the view is handed those very values.
 *
 * ⚠ It computes the row regardless of any view toggle. What is drawn and what
 * is built are different questions, and a takeoff that answered either would
 * be wrong for the other.
 */
export function computeCrossTiltTakeoff(input: CrossTiltTakeoffInput): CrossTiltTakeoff {
  const { footprint, crossTiltWallIds, depthIn, roofPitchIn12, wallHeightFt } = input;
  if (!footprint || !crossTiltWallIds || crossTiltWallIds.size === 0) return EMPTY;
  if (roofPitchIn12 === undefined) return EMPTY;

  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));
  const runs: CrossTiltTakeoffRun[] = [];
  const instances: CrossTiltTakeoffInstance[] = [];
  const byKey = new Map<string, { options: CrossTiltPanelOptions; instances: CrossTiltTakeoffInstance[] }>();
  let refusal: string | null = null;

  /* Walked in the footprint's own wall order, not the Set's insertion order,
     so the row's numbering is a property of the building rather than of
     whatever order the ids happened to be stored in. */
  for (const wall of footprint.walls) {
    if (!crossTiltWallIds.has(wall.id)) continue;
    const a = byId.get(wall.startCorner);
    const b = byId.get(wall.endCorner);
    if (!a || !b) continue;
    const lengthFt = Math.hypot(b.x - a.x, b.y - a.y);
    const lengthIn = lengthFt * IN_PER_FT;
    const widthsIn = planFloorRoofPanelWidthsIn(lengthIn, depthIn);
    if (widthsIn === null) {
      refusal ??= `Wall ${wall.id} is ${(lengthIn / IN_PER_FT).toFixed(1)}ft long — too short to divide into cross-tilted panels, so the row is not drawn there rather than drawn wrong.`;
      continue;
    }

    const direction = wallCompassDirection(wall, footprint);
    const runIndex = runs.length;
    runs.push({ index: runIndex, wallId: wall.id, direction, runIn: lengthIn, widthsIn });

    const rotationRad = Math.atan2(b.y - a.y, b.x - a.x);
    const ux = (b.x - a.x) / lengthFt;
    const uy = (b.y - a.y) / lengthFt;
    let atIn = 0;
    for (const [i, widthIn] of widthsIn.entries()) {
      const options: CrossTiltPanelOptions = {
        widthIn,
        depthIn,
        lowHeightIn: crossTiltLowHeightIn(roofPitchIn12),
        pitchIn12: roofPitchIn12,
      };
      const built = buildCrossTiltPanelMembers(options);
      if (built.refusal !== null) {
        refusal ??= built.refusal;
        atIn += widthIn;
        continue;
      }
      const alongFt = atIn / IN_PER_FT;
      const groupKey = optionsKey(options);
      const instance: CrossTiltTakeoffInstance = {
        id: `crosstilt-${wall.id}-${i}`,
        name: `T${instances.length + 1}`,
        runIndex,
        wallId: wall.id,
        direction,
        atIn,
        widthIn,
        groupKey,
        world: {
          anchorX: a.x + ux * alongFt,
          anchorZ: a.y + uy * alongFt,
          anchorYFt: wallHeightFt,
          rotationRad,
        },
      };
      instances.push(instance);
      const existing = byKey.get(groupKey);
      if (existing) existing.instances.push(instance);
      else byKey.set(groupKey, { options, instances: [instance] });
      atIn += widthIn;
    }
  }

  let faceAreaSqFt = 0;
  const groups: CrossTiltTakeoffGroup[] = [];
  for (const [key, { options, instances: groupInstances }] of byKey) {
    const built = buildCrossTiltPanelMembers(options);
    groups.push({
      key,
      widthIn: options.widthIn,
      lowHeightIn: options.lowHeightIn,
      highHeightIn: built.highHeightIn,
      tiltDeg: built.tiltDeg,
      topPlateRip: built.topPlateRip,
      skinProudIn: 0.75 * Math.sin((built.tiltDeg * Math.PI) / 180),
      options,
      members: built.members,
      instances: groupInstances,
    });
    faceAreaSqFt +=
      groupInstances.length * (options.widthIn / IN_PER_FT) * ((options.lowHeightIn + built.highHeightIn) / 2 / IN_PER_FT);
  }

  return { runs, instances, groups, faceAreaSqFt, refusal };
}

/**
 * The wall a shed's cross-tilted row belongs on, or null on a shape with no
 * tall side.
 *
 * ⚠ Read off the roof's OWN plane rather than from a compass guess, so the
 * row cannot disagree with where the roof is actually put — the same reason
 * the gable profile positions are derived that way (see `page.tsx`, where a
 * compass guess once sloped one gable wall uphill and the other down).
 */
export function crossTiltWallIdsFor(
  footprint: Footprint,
  roofForm: "shed" | "peaked" | "flat" | string,
  pitchIn12: number,
  eaveHeightFt: number,
): Set<string> {
  if (roofForm !== "shed") return new Set();
  const tallWallId = shedTallWallId(footprint, { form: "shed", pitchIn12, eaveHeightFt });
  return tallWallId ? new Set([tallWallId]) : new Set();
}
