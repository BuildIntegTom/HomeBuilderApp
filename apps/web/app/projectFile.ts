import type { Footprint, PanelSlot, Story } from "@building-integrity/geometry";
import type { Season } from "@building-integrity/calc-engine";
import type {
  BracingStyle,
  OctagonRingDiameterFt,
  RoofCatcherBeamShape,
  RoofSystemType,
  SeismicZone,
  StudConfig,
} from "@building-integrity/panel-catalog";
import type { ViewerRole } from "./viewerRole";

/**
 * Save/Load a project file — Tommy: "a saveable file that the user or
 * anyone could upload and look at the plans for." Bumps whenever a field
 * is added/renamed/removed from `ProjectState` below, so an old file from
 * a future incompatible version fails loudly (`parseProjectFile`) instead
 * of silently restoring a half-broken layout. One deliberate, bounded
 * exception: `parseProjectFile` also accepts the immediately-prior version
 * and migrates it forward. v15->v16: `bottomOfTrussMaxHeightFt`/
 * `gablePeakPositionInByWallId` (a single ridge height + single per-wall
 * peak position) were replaced by the generalized N-point roofline profile
 * (`roofProfileType`/`roofProfilePointHeightsFt`/
 * `gableProfilePositionsInByWallId`) — see the `schemaVersion === 15`
 * branch below for the lossless "1 point, same height/position" migration.
 */
export const PROJECT_FILE_VERSION = 16;

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

/** The v15 shape's own required keys — same list as REQUIRED_STATE_KEYS but
 * with the 4 new roofline-profile fields swapped back for the 2 old fields
 * they replaced — used only to validate a v15 file before migrating it
 * forward (see parseProjectFile's `schemaVersion === 15` branch). */
const V15_REQUIRED_STATE_KEYS: string[] = (REQUIRED_STATE_KEYS as string[])
  .filter((k) => k !== "roofProfileType" && k !== "roofProfilePointHeightsFt" && k !== "gableProfilePositionsInByWallId" && k !== "maxGablePanelHeightIn")
  .concat(["bottomOfTrussMaxHeightFt", "gablePeakPositionInByWallId"]);

/** JSON has no Set type — `primaryCornerIds`/`gableEndWallIds`/
 * `checkedInteriorIds`/`checkedExteriorIds` round-trip as plain arrays. */
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

  for (const key of isCurrentVersion ? REQUIRED_STATE_KEYS : V15_REQUIRED_STATE_KEYS) {
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

  // v15 -> v16 migration: the old single ridge height
  // (bottomOfTrussMaxHeightFt) + single per-wall peak position
  // (gablePeakPositionInByWallId) become a 1-point "peaked" roofline
  // profile — a lossless translation (a single peak is exactly what the
  // old fields already described), same "not yet customized" (`null`)
  // sentinel meaning the old absent-entry convention had.
  let roofProfileType: "peaked" | "flat-top";
  let roofProfilePointHeightsFt: number[];
  let gableProfilePositionsInByWallId: Record<string, (number | null)[]>;
  if (isCurrentVersion) {
    roofProfileType = state.roofProfileType as "peaked" | "flat-top";
    roofProfilePointHeightsFt = state.roofProfilePointHeightsFt as number[];
    gableProfilePositionsInByWallId = state.gableProfilePositionsInByWallId as Record<string, (number | null)[]>;
  } else {
    roofProfileType = "peaked";
    roofProfilePointHeightsFt = [state.bottomOfTrussMaxHeightFt as number];
    const oldPositions = state.gablePeakPositionInByWallId as Record<string, number>;
    gableProfilePositionsInByWallId = Object.fromEntries(Object.entries(oldPositions).map(([wallId, posIn]) => [wallId, [posIn]]));
  }

  return {
    ok: true,
    state: {
      ...(state as unknown as ProjectState),
      stories: state.stories as Story[],
      roofProfileType,
      roofProfilePointHeightsFt,
      gableProfilePositionsInByWallId,
      maxGablePanelHeightIn: isCurrentVersion ? (state.maxGablePanelHeightIn as number) : 96,
      primaryCornerIds: new Set(state.primaryCornerIds as string[]),
      gableEndWallIds: new Set(state.gableEndWallIds as string[]),
      checkedInteriorIds: new Set(state.checkedInteriorIds as string[]),
      checkedExteriorIds: new Set(state.checkedExteriorIds as string[]),
    },
  };
}
