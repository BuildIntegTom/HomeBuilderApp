import type { BoxBeamCoverage, Footprint, PanelSlot, Story } from "@building-integrity/geometry";
import type { Season } from "@building-integrity/calc-engine";
import { BOX_BEAM_SIZE_DEFAULT } from "@building-integrity/panel-catalog";
import type {
  BoxBeamSizeId,
  BracingStyle,
  OctagonRingDiameterFt,
  RoofCatcherBeamShape,
  RoofSystemType,
  SeismicZone,
  StudConfig,
} from "@building-integrity/panel-catalog";
import type { ViewerRole } from "./viewerRole";
import type { MidWallBeam } from "./midWallBeam";

/**
 * Save/Load a project file — Tommy: "a saveable file that the user or
 * anyone could upload and look at the plans for." Bumps whenever a field
 * is added/renamed/removed from `ProjectState` below, so an old file from
 * a future incompatible version fails loudly (`parseProjectFile`) instead
 * of silently restoring a half-broken layout. One deliberate, bounded
 * exception: `parseProjectFile` also accepts the immediately-prior version
 * and migrates it forward. v18->v19: `boxBeamWallIds` (a plain Set of
 * fully-covered wall ids) became `boxBeamCoverageByWallId` (Tommy: "dragged
 * shorter and snap to the edge of each panel... just one section of the
 * wall") — Box Beam coverage can now start/stop partway through a single
 * wall, not just on/off per whole wall. A v18 file's coverage was always
 * "every slot of this wall" for each listed wall id, so it migrates
 * losslessly to `{startSlotIndex: 0, endSlotIndex: <that wall's own real
 * 2nd-story slot count>}` per wall — no roofline/height math needed this
 * time (v18 already has the real per-wall Truss-Plate-anchored heights).
 * v19->v20: added `midWallBeamsByStoryAndWallId` (Mid-Wall Bond Beam) — a
 * v19 file simply never had any (the feature didn't exist yet), so this
 * migration is trivial (defaults to `{ ground: {}, second: {} }`), unlike
 * v18->v19's real data reshape above.
 * v20->v21: `midWallBeamsByStoryAndWallId`'s own per-wall value changed
 * from a single `MidWallBeam` to a `MidWallBeam[]` (Tommy: multiple beams
 * per wall, each with its own independent horizontal coverage range) — a
 * v20 file's one beam per wall migrates losslessly to a 1-element array,
 * assigned a fresh id and full-width coverage
 * (`{startSlotIndex: 0, endSlotIndex: <that wall's own real slot count
 * for that story>}`), preserving exactly what a v20 file's beam always
 * meant (Stage 1: always full width). The top-level key itself is
 * unchanged (present in both v20 and v21), so no REQUIRED_STATE_KEYS
 * carve-out is needed this time — unlike v18->v19/v19->v20, which each
 * added/renamed a top-level key.
 */
export const PROJECT_FILE_VERSION = 21;

export interface ProjectState {
  editorTab: "wall" | "foundation" | "floor" | "roof";
  viewMode: "plan" | "3d";
  shapeTool: "rectangle" | "octagon" | "bump-out" | "edit" | "drag-wall";
  footprint: Footprint | null;
  isBumpedOut: boolean;
  primaryCornerIds: Set<string>;
  offsetPx: { x: number; y: number };
  baseWallSlots: Record<string, PanelSlot[]>;
  leastAccessibleCorner: string;
  standardWidthIn: number;
  thicknessIn: number;
  densityLbFt3: number;
  wallHeightFt: number;
  includeNailer: boolean;
  /** Every interior/exterior finish AND product checked (Tommy: "change
   * those interior and exterior finishes to check boxes... a repertoire")
   * — replaces the old single-select interiorId/exteriorId. */
  checkedInteriorIds: Set<string>;
  checkedExteriorIds: Set<string>;
  season: Season;
  seismicZone: SeismicZone;
  foundationTypeId: string;
  pierSpacingFt: number;
  zipCode: string;
  role: ViewerRole;
  unitSystem: "imperial" | "metric";
  priceModifier: number;
  floorSystemId: string | null;
  perpendicular2x4Enabled: boolean;
  roofSystemTypeId: RoofSystemType;
  /** "peaked" = 1 top point (a ridge); "flat-top" = 2 independently
   * adjustable top points (Tommy: "options for peaked trusses with 1 point
   * on the top, or two points to make a triangle shaped with the top
   * chopped off") — the roofline gable-end panels tile up to meet. Global
   * (Roof tab), same as the single ridge height it replaces. */
  roofProfileType: "peaked" | "flat-top";
  /** One real height (ft) per profile point, index-matched to
   * `roofProfileType`'s own point count (length 1 for "peaked", 2 for
   * "flat-top") — fully independent, not forced symmetric. */
  roofProfilePointHeightsFt: number[];
  /** Per-wall along-wall position (inches from the wall's start corner) for
   * each profile point, index-matched the same way — Tommy: "drag wall
   * tool the peak of this triangle," now generalized to up to 2
   * independently-placeable points per wall. `null` means "not yet
   * customized" (auto-centered — see computeGableTiledRow's own resolution
   * in page.tsx), same sentinel meaning the old single-position field's
   * absent-entry convention had (an explicit `null` instead of an absent
   * array index, since JSON has no `undefined`). */
  gableProfilePositionsInByWallId: Record<string, (number | null)[]>;
  /** A single gable panel can't be fabricated taller than
   * GABLE_PANEL_MAX_HEIGHT_IN (packages/panel-catalog) — this is a
   * user-tunable threshold AT OR BELOW that real physical ceiling; the
   * difference between it and the true truss-bottom height (if any) is
   * filled by a real vertical safety-gap tile instead of silently clamped. */
  maxGablePanelHeightIn: number;
  trussPlateInsetIn: number;
  /** Energy-heel (raised-heel) truss seat height (Tommy: "have the truss
   * seat be the full panel width AND THEN go vertical for 6in
   * (adjustable)") — 0 disables it. See computeGableTiledRow's own
   * `heelHeightIn` param. */
  heelHeightIn: number;
  /** Which walls (and exactly which of their own 2nd-story slots) have a
   * Box Beam rather than a Truss Plate (Tommy: "options for being a ring
   * all the way around or just one section of the wall... dragged shorter
   * and snap to the edge of each panel") — see BoxBeamCoverage/
   * computeRoofBearingSegments in the geometry package. A wall with no
   * entry uses a Truss Plate along its own full length. Only meaningful
   * once a 2nd story exists. */
  boxBeamCoverageByWallId: Record<string, BoxBeamCoverage>;
  /** Which box-beam size/material every selected wall uses, project-wide
   * — see BOX_BEAM_SIZE_OPTIONS in boxBeamMembers.ts. */
  boxBeamSizeId: BoxBeamSizeId;
  /** Which walls (on either story) have one or more Mid-Wall Bond Beams,
   * each with its own height/size/horizontal coverage (Tommy: "cellulose
   * box beam"... "same beam, positionable at any height in the wall"...
   * multiple beams per wall, each with independent partial horizontal
   * coverage) — see MidWallBeam/computeWallVerticalBandsForSlot. A story
   * with no entries here uses a single full-height row, exactly as before
   * this feature existed. Story-keyed (unlike boxBeamCoverageByWallId,
   * which is inherently second-story-only) since a bond beam can exist on
   * either story. */
  midWallBeamsByStoryAndWallId: Record<"ground" | "second", Record<string, MidWallBeam[]>>;
  roofCatcherBeamOffsetIn: number;
  roofCatcherBeamShape: RoofCatcherBeamShape;
  /** Octagon roof-catcher ring's outside diameter (ft) — only shown/used
   * when the footprint is an octagon (8 corners), see octagonRingMembers.ts. */
  octagonRingDiameterFt: OctagonRingDiameterFt;
  /** Wall ids with "Add Gable End" enabled in the elevation view — see
   * WallElevationView.tsx. Capped at 2, and the 2nd must be
   * areWallsOppositePair with the 1st (see gableEndToggleBlockReason in
   * page.tsx) — the roof-catcher beam's run is computed directly from these
   * 2 walls + gablePeakPositionInByWallId via computeRidgeLine, so no
   * separate run-length field needs to round-trip here. */
  gableEndWallIds: Set<string>;
  /** Every real story, ground floor first (page.tsx's own `stories` memo —
   * see the Story type's own doc comment). Only `stories[1]` (if present)
   * round-trips as genuinely independent data here; `stories[0]` is
   * reconstructed on load from `wallHeightFt`/`baseWallSlots` instead (see
   * page.tsx's load handler), so a saved `stories[0]` entry is otherwise
   * unused by the loader — kept for shape-completeness/symmetry, not because
   * anything reads it back out. */
  stories: Story[];
  panelizationType: "loose-packed-braced" | "square-bale-panels" | "timber-frame-curtain";
  timberFrameCurtainPanelType: "standard" | "braced";
  timberFrameCurtainWidthIn: number;
  /** Square Bale Panel-only controls (Tommy: nailer "slide" + "double 2x4
   * studs, or double 2x6 studs"). Nailer offset is a numeric slide amount,
   * not a literal drag gesture yet — see buildNailer's doc comment. */
  nailerOffsetIn: number;
  squareBaleStudConfig: StudConfig;
  /** The DEFAULT pattern/mirror a brand-new braced panel gets
   * auto-suggested with — no longer forces every braced panel project-wide
   * (Tommy: "softly decouple [seismic auto-population] to be an original
   * suggestion... allows the user to change each panel"); each slot's own
   * choice now lives directly in `baseWallSlots` (see `PanelSlot.bracedPattern`). */
  bracingStyle: BracingStyle;
  /** True once this file has gone through the braced-state-is-real-stored-
   * data migration (see page.tsx's load handler) — absent (an old file,
   * predating this field) means `baseWallSlots` has zero "braced" slots
   * stored and needs the one-time corner/spacing seed pass on load, exactly
   * reproducing what the old derived-overlay system would have rendered.
   * Deliberately NOT in `REQUIRED_STATE_KEYS` — its absence is the whole
   * migration signal, not an error. */
  bracedStateSeeded?: boolean;
  /** Landscape title-block metadata (Tommy: "project, site, date, etc.") —
   * see DocumentMetaContext.tsx. Site/date are derived from other state
   * already in this file (zipCode, current date), so only the project name
   * itself needs to round-trip here. */
  projectName: string;
  /** Panelizer's own "keyhole" scope-of-work checkboxes (Tommy: "I want
   * this tab to be the keyhole to getting down to what editor tools are
   * needed for this user's project") — gate which of the Wall/Floor/Roof
   * editor tabs are relevant, and which of their own Detail Guide/Shop
   * Drawing pages show up. Foundation has no such checkbox (always
   * relevant). Walls defaults on since a footprint can't exist without it;
   * Floors/Roof default off (Tommy: "default is that walls are the only
   * checked of these three original branches"). */
  wallsEnabled: boolean;
  floorsEnabled: boolean;
  roofEnabled: boolean;
}

const REQUIRED_STATE_KEYS: (keyof ProjectState)[] = [
  "editorTab",
  "viewMode",
  "shapeTool",
  "footprint",
  "isBumpedOut",
  "primaryCornerIds",
  "offsetPx",
  "baseWallSlots",
  "leastAccessibleCorner",
  "standardWidthIn",
  "thicknessIn",
  "densityLbFt3",
  "wallHeightFt",
  "includeNailer",
  "checkedInteriorIds",
  "checkedExteriorIds",
  "season",
  "seismicZone",
  "foundationTypeId",
  "pierSpacingFt",
  "zipCode",
  "role",
  "unitSystem",
  "priceModifier",
  "floorSystemId",
  "perpendicular2x4Enabled",
  "roofSystemTypeId",
  "roofProfileType",
  "roofProfilePointHeightsFt",
  "gableProfilePositionsInByWallId",
  "maxGablePanelHeightIn",
  "trussPlateInsetIn",
  "heelHeightIn",
  "boxBeamCoverageByWallId",
  "boxBeamSizeId",
  "midWallBeamsByStoryAndWallId",
  "roofCatcherBeamOffsetIn",
  "roofCatcherBeamShape",
  "octagonRingDiameterFt",
  "gableEndWallIds",
  "stories",
  "panelizationType",
  "timberFrameCurtainPanelType",
  "timberFrameCurtainWidthIn",
  "nailerOffsetIn",
  "squareBaleStudConfig",
  "bracingStyle",
  "projectName",
  "wallsEnabled",
  "floorsEnabled",
  "roofEnabled",
];

/** JSON has no Set type — `primaryCornerIds`/`gableEndWallIds`/
 * `checkedInteriorIds`/`checkedExteriorIds` round-trip as plain arrays.
 * `boxBeamCoverageByWallId` is a plain `Record`, not a Set, so it needs no
 * special array treatment here — it flows straight through. */
export interface ProjectFile {
  schemaVersion: number;
  savedAt: string;
  state: Omit<ProjectState, "primaryCornerIds" | "gableEndWallIds" | "checkedInteriorIds" | "checkedExteriorIds"> & {
    primaryCornerIds: string[];
    gableEndWallIds: string[];
    checkedInteriorIds: string[];
    checkedExteriorIds: string[];
  };
}

export function serializeProject(state: ProjectState): ProjectFile {
  return {
    schemaVersion: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    state: {
      ...state,
      primaryCornerIds: [...state.primaryCornerIds],
      gableEndWallIds: [...state.gableEndWallIds],
      checkedInteriorIds: [...state.checkedInteriorIds],
      checkedExteriorIds: [...state.checkedExteriorIds],
      // Every save is written post-migration, regardless of whether the
      // in-memory state getting saved originated from an old (unseeded)
      // load — see bracedStateSeeded's own doc comment.
      bracedStateSeeded: true,
    },
  };
}

function cumulativeOffsetsIn(slots: PanelSlot[]): number[] {
  return slots.reduce<number[]>((acc, s) => [...acc, acc[acc.length - 1]! + s.widthIn], [0]);
}

/** v20->v21: a v20 file's single beam per wall migrates to a 1-element
 * array, given a fresh id and full-width coverage — preserving exactly
 * what a v20 beam always meant (Stage 1 had no partial coverage). Ground-
 * floor slot counts come from `baseWallSlots` (the real ground-floor
 * source of truth, per this file's own `stories[0]` doc comment above —
 * NOT `state.stories[0]`); second-story counts come from
 * `state.stories[1]?.wallSlots`. Getting these two backwards would
 * silently produce a wrong `endSlotIndex` for one story's migrated beams. */
function migrateMidWallBeamsV20ToV21(
  v20: Record<"ground" | "second", Record<string, { heightIn: number; sizeId: BoxBeamSizeId }>>,
  groundWallSlots: Record<string, PanelSlot[]>,
  secondWallSlots: Record<string, PanelSlot[]>,
): Record<"ground" | "second", Record<string, MidWallBeam[]>> {
  const migrateStory = (story: "ground" | "second", slotsByWallId: Record<string, PanelSlot[]>): Record<string, MidWallBeam[]> => {
    const result: Record<string, MidWallBeam[]> = {};
    for (const [wallId, beam] of Object.entries(v20[story] ?? {})) {
      const offsetsIn = cumulativeOffsetsIn(slotsByWallId[wallId] ?? []);
      result[wallId] = [
        { id: crypto.randomUUID(), heightIn: beam.heightIn, sizeId: beam.sizeId, startSlotIndex: 0, endSlotIndex: offsetsIn.length - 1 },
      ];
    }
    return result;
  };
  return { ground: migrateStory("ground", groundWallSlots), second: migrateStory("second", secondWallSlots) };
}

export type ParseProjectFileResult = { ok: true; state: ProjectState } | { ok: false; error: string };

/**
 * Validates just enough to reject something that clearly isn't one of our
 * own exports (wrong version, missing top-level fields) — a system
 * boundary (arbitrary user-uploaded file), not full deep schema
 * validation of every nested footprint/slot shape.
 */
export function parseProjectFile(raw: string): ParseProjectFileResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  if (typeof json !== "object" || json === null) {
    return { ok: false, error: "That file isn't a Building Integrity project (expected a JSON object)." };
  }
  const file = json as Record<string, unknown>;

  const isCurrentVersion = file.schemaVersion === PROJECT_FILE_VERSION;
  const isPriorVersion = file.schemaVersion === PROJECT_FILE_VERSION - 1;
  if (!isCurrentVersion && !isPriorVersion) {
    return {
      ok: false,
      error: `Unsupported project file version (${JSON.stringify(file.schemaVersion)}) — expected ${PROJECT_FILE_VERSION}.`,
    };
  }
  if (typeof file.state !== "object" || file.state === null) {
    return { ok: false, error: "That file is missing its project state." };
  }
  const state = file.state as Record<string, unknown>;

  // v20 (the one prior version this file also accepts) has the exact same
  // top-level required keys as v21 — only midWallBeamsByStoryAndWallId's
  // own INNER shape changed (see PROJECT_FILE_VERSION's own v20->v21 doc
  // comment), so one shared list covers both, unlike v18->v19/v19->v20
  // which each added/renamed a top-level key.
  for (const key of REQUIRED_STATE_KEYS) {
    if (!(key in state)) return { ok: false, error: `That file is missing the "${key}" field.` };
  }
  if (!Array.isArray(state.primaryCornerIds)) {
    return { ok: false, error: '"primaryCornerIds" should be a list of corner ids.' };
  }
  if (!Array.isArray(state.gableEndWallIds)) {
    return { ok: false, error: '"gableEndWallIds" should be a list of wall ids.' };
  }
  if (!Array.isArray(state.checkedInteriorIds)) {
    return { ok: false, error: '"checkedInteriorIds" should be a list of product ids.' };
  }
  if (!Array.isArray(state.checkedExteriorIds)) {
    return { ok: false, error: '"checkedExteriorIds" should be a list of product ids.' };
  }

  return {
    ok: true,
    state: {
      ...(state as unknown as ProjectState),
      stories: state.stories as Story[],
      roofProfileType: state.roofProfileType as "peaked" | "flat-top",
      roofProfilePointHeightsFt: state.roofProfilePointHeightsFt as number[],
      gableProfilePositionsInByWallId: state.gableProfilePositionsInByWallId as Record<string, (number | null)[]>,
      maxGablePanelHeightIn: state.maxGablePanelHeightIn as number,
      heelHeightIn: state.heelHeightIn as number,
      boxBeamCoverageByWallId: state.boxBeamCoverageByWallId as Record<string, BoxBeamCoverage>,
      boxBeamSizeId: (state.boxBeamSizeId as BoxBeamSizeId) ?? BOX_BEAM_SIZE_DEFAULT,
      // v20 -> v21 migration: a v20 file's single beam per wall becomes a
      // 1-element array with full-width coverage (see
      // migrateMidWallBeamsV20ToV21's own doc comment).
      midWallBeamsByStoryAndWallId: isCurrentVersion
        ? (state.midWallBeamsByStoryAndWallId as Record<"ground" | "second", Record<string, MidWallBeam[]>>)
        : migrateMidWallBeamsV20ToV21(
            state.midWallBeamsByStoryAndWallId as Record<"ground" | "second", Record<string, { heightIn: number; sizeId: BoxBeamSizeId }>>,
            (state.baseWallSlots as Record<string, PanelSlot[]>) ?? {},
            (state.stories as Story[] | undefined)?.[1]?.wallSlots ?? {},
          ),
      primaryCornerIds: new Set(state.primaryCornerIds as string[]),
      gableEndWallIds: new Set(state.gableEndWallIds as string[]),
      checkedInteriorIds: new Set(state.checkedInteriorIds as string[]),
      checkedExteriorIds: new Set(state.checkedExteriorIds as string[]),
    },
  };
}
