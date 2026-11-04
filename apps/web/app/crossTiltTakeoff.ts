import {
  gableEndWallIdsFor,
  shedTallWallId,
  simpleRoofPlanes,
  wallCompassDirection,
  type CompassDirection,
  type Footprint,
} from "@building-integrity/geometry";
import {
  buildCrossTiltPanelMembers,
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
  /**
   * The ROOFED span of this wall — its corner-to-corner length less the gable
   * end inset at each end that meets a gable end wall. The row sums to this
   * exactly, and the gable end panels own the rest.
   *
   * ⚠ **This was the wall's WHOLE length until 2026-11-03**, which ran the
   * row straight through the gable end panels at both corners. See
   * `computeCrossTiltTakeoff`.
   */
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
  /** Height at the INTERIOR face — the low side, the roof falling inward. */
  lowHeightIn: number;
  /** Height at the EXTERIOR face, under the roof's own high edge. */
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
  /**
   * How far the ROOF is held back from the floor plan at each gable end —
   * `deckPanelTakeoffInput.roofGableEndInsetIn`, the very field the roof deck
   * is laid out from, passed through rather than recomputed.
   *
   * ⚠ **This is what makes the row end with the roof.** With gable ends run
   * full height the gable row is the wall, *"corner to corner, the full width
   * of the floor plan"* (his 2026-10-30 ruling, see `gableTilesByWallId`), so
   * the band a gable end owns at each end of this wall is its own depth. The
   * row has to start after it.
   */
  roofGableEndInsetIn: number;
  /** Withheld where no pitch resolves — then there is no roof to receive and
   * no row, rather than a guessed one. */
  roofPitchIn12: number | undefined;
  /**
   * ⚠ **The ROOFLINE — the one the roof itself is laid from, which is the
   * top of the roof-bearing plate and NOT the wall's top plate.**
   *
   * This is both where the row's underside lands and what its height is
   * measured against, so the row cannot be referenced to one height while
   * the roof is laid off another. `page.tsx` passes
   * `deckPanelTakeoffInput.roofEaveHeightFt`, the very value the roof deck
   * is placed with.
   */
  roofEaveHeightFt: number | undefined;
  /** Fallback for the roofline when no roof resolves, and nothing else. */
  wallHeightFt: number;
}

const EMPTY: CrossTiltTakeoff = { runs: [], instances: [], groups: [], faceAreaSqFt: 0, refusal: null };

/**
 * ⚠ **HOW TALL THE ROW IS: whatever reaches the roof. It is NOT a property
 * of the pitch.**
 *
 * This row stands on the TALL wall of a shed, and a shed's tall wall is the
 * one under the roof's HIGH edge. The height it has to make up is therefore
 * the whole rise of the roof — span x pitch — which is a property of the
 * BUILDING, not of the panel.
 *
 * > *"These panels should begin at the top plate and have an inclined top
 * > plate sloped to receive the roof panels."* — Tommy
 *
 * ⚠ **Until 2026-11-01 it was a constant** — `max(3.5, the panel's own
 * minimum)`, 6.87in at 4:12 — with no term for the roof at all. Measured on
 * a drawn shed at the default 4:12 and a 10ft wall, the roof's high edge
 * stood this far ABOVE the top of the row:
 *
 * | shed | roof rise | gap above the row |
 * | --- | --- | --- |
 * | 24 x 12ft | 48.00in | **38.21in** |
 * | 30 x 14ft | 56.00in | **46.21in** |
 * | 40 x 16ft | 64.00in | **54.21in** |
 *
 * So the tall wall never reached its roof, and the gap grew with the
 * building. The row was a 12in cap where a full storey-height gable panel
 * belongs — the same height the gable END walls already run to at their own
 * tall ends, since all three meet at the two corners.
 *
 * ⚠ **It stops at the ROOFLINE, not at the top of the roof panels.** A
 * gable END wall may run up past the roofline to close against the roof's top
 * face, because nothing sits on that line. This wall has roof bearing
 * directly on it, so its top IS the roof's underside.
 *
 * ⚠ **No clamp.** Where the derived height will not hold the panel's own
 * layers (a very shallow shed), `buildCrossTiltPanelMembers` refuses in
 * words and the row is left undrawn. Clamping it up would lift the panel
 * through the roof it is meant to carry.
 */
function crossTiltRowHeightsIn(
  footprint: Footprint,
  pitchIn12: number,
  eaveHeightFt: number,
  depthIn: number,
): { exteriorIn: number; interiorIn: number; refusal: string | null } {
  const plane = simpleRoofPlanes(footprint, { form: "shed", pitchIn12, eaveHeightFt }).planes[0];
  if (!plane) {
    return {
      exteriorIn: 0,
      interiorIn: 0,
      refusal: "No shed roof plane resolves for this footprint, so there is no roof height for the tilted row to reach.",
    };
  }
  /* The plane's high edge lies ON the footprint polygon, which is the wall's
     EXTERIOR face (`footprintLoops`: "the exterior face of a wall is always
     to its left"). So this is the height at the panel's own y = 0, and the
     top falls inward from there over the panel's depth. */
  const exteriorIn = (plane.highHeightFt - eaveHeightFt) * IN_PER_FT;
  return { exteriorIn, interiorIn: exteriorIn - depthIn * (pitchIn12 / 12), refusal: null };
}

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
  const { footprint, crossTiltWallIds, depthIn, roofPitchIn12, wallHeightFt, roofGableEndInsetIn } = input;
  if (!footprint || !crossTiltWallIds || crossTiltWallIds.size === 0) return EMPTY;
  if (roofPitchIn12 === undefined) return EMPTY;

  /* ⚠ The row is referenced to the ROOFLINE — the top of the roof-bearing
     plate, which is what the roof itself is laid from. It anchored at the
     bare wall top until 2026-11-01, which put it 2 1/4in low and ran it
     straight through the truss plate that rings every wall. */
  const eaveHeightFt = input.roofEaveHeightFt ?? wallHeightFt;
  const rowHeights = crossTiltRowHeightsIn(footprint, roofPitchIn12, eaveHeightFt, depthIn);
  if (rowHeights.refusal !== null) return { ...EMPTY, refusal: rowHeights.refusal };

  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));
  /* ⚠ **WHICH ENDS OF THIS WALL A GABLE END OWNS.** Read off the footprint
     with the same function the roof planes and the auto-spawned gable walls
     are built from — a second rule for "which walls are the gable ends" would
     eventually disagree with the roof, and the symptom would be this row
     missing the roof it is cut to receive. */
  const gableEndWallIds = new Set(gableEndWallIdsFor(footprint));
  const gableEndOwnsCorner = (wallId: string, cornerId: string): boolean =>
    footprint.walls.some(
      (w) => w.id !== wallId && gableEndWallIds.has(w.id) && (w.startCorner === cornerId || w.endCorner === cornerId),
    );
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
    /* ⚠ **THE ROW ENDS WHERE THE ROOF ENDS, 2026-11-03.**
       > *"on a small shed building … the roof supporting panels overlap the
       > gable end panels, where as the roof support ones should end with the
       > roof."* — Tommy

       Two rows were both given the whole corner. The gable row runs *"corner
       to corner, the full width of the floor plan"* whenever gable ends run
       full height — his own 2026-10-30 ruling, after they looked like they
       stopped short — and this row ran its wall's full centreline length on
       the perpendicular wall. Both then claimed the same corner square, in the
       same band above the eave, which is two solids in one volume.

       The gable row is the one that was deliberately given the whole wall, so
       this one gives way, and it gives way by exactly the number the ROOF is
       held back by: the inset is `roofGableEndInsetIn` itself, passed through
       from the deck's own takeoff input. "Ends with the roof" is then true by
       construction rather than by two constants that happen to match. */
    const startInsetIn = gableEndOwnsCorner(wall.id, wall.startCorner) ? roofGableEndInsetIn : 0;
    const endInsetIn = gableEndOwnsCorner(wall.id, wall.endCorner) ? roofGableEndInsetIn : 0;
    const runIn = lengthIn - startInsetIn - endInsetIn;
    const widthsIn = runIn > 0 ? planFloorRoofPanelWidthsIn(runIn, depthIn) : null;
    if (widthsIn === null) {
      refusal ??= `Wall ${wall.id} is ${(lengthIn / IN_PER_FT).toFixed(1)}ft long and leaves ${(runIn / IN_PER_FT).toFixed(1)}ft of roofed span once the gable ends take their own depth at each corner — too short to divide into cross-tilted panels, so the row is not drawn there rather than drawn wrong.`;
      continue;
    }

    const direction = wallCompassDirection(wall, footprint);
    const runIndex = runs.length;
    runs.push({ index: runIndex, wallId: wall.id, direction, runIn, widthsIn });

    const rotationRad = Math.atan2(b.y - a.y, b.x - a.x);
    const ux = (b.x - a.x) / lengthFt;
    const uy = (b.y - a.y) / lengthFt;
    let atIn = 0;
    for (const [i, widthIn] of widthsIn.entries()) {
      const options: CrossTiltPanelOptions = {
        widthIn,
        depthIn,
        lowHeightIn: rowHeights.interiorIn,
        pitchIn12: roofPitchIn12,
      };
      const built = buildCrossTiltPanelMembers(options);
      if (built.refusal !== null) {
        refusal ??= built.refusal;
        atIn += widthIn;
        continue;
      }
      /* `atIn` stays RUN-relative — a panel's position in its own row — and
         the start inset is added once, here, where the row meets the world.
         The same split `roofBearingRenderData` makes for the same reason. */
      const alongFt = (startInsetIn + atIn) / IN_PER_FT;
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
          anchorYFt: eaveHeightFt,
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
