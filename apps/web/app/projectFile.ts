import { quantizeFootprint, repairWallToEighths, toEighths, wallGeometryFor } from "@building-integrity/geometry";
import type {
  BoxBeamCoverage,
  Footprint,
  GableWindowReservation,
  PanelSlot,
  RoofBearingAnchorMode,
  RunStopOpeningMemory,
  Story,
  TrussDoublingStrategy,
  WallRunStop,
} from "@building-integrity/geometry";
import type { Season } from "@building-integrity/calc-engine";
import {
  BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN,
  BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_GAP_DEFAULT_IN,
  BOX_BEAM_SIZE_DEFAULT,
  ROOF_TRUSS_SPACING_DEFAULT_IN,
  standardPanelHeightIn,
} from "@building-integrity/panel-catalog";
import type {
  BaleFoundationFieldSpacingIn,
  BoxBeamSizeId,
  BracingStyle,
  ClassicTrussTypeId,
  HighPerfTrussBearingShapeId,
  HighPerfTrussCavityDepthIn,
  HighPerfTrussTypeId,
  OctagonRingDiameterFt,
  RoofCatcherBeamShape,
  RoofSystemType,
  RoofTrussSpacingIn,
  SeismicZone,
  StudConfig,
} from "@building-integrity/panel-catalog";
import type { ViewerRole } from "./viewerRole";
import type { MidWallBeam } from "./midWallBeam";
import type { SpanningHeader } from "./spanningHeader";
import type { WallReviewNote } from "./wallReviewNotes";
// Stage 4B, for `parseRedactedProjectFile` only. `redaction.ts` imports
// `ProjectState` back from here with `import type`, which is erased, so this is
// not a runtime cycle.
import { MONEY_STATE_KEYS, isRedactablePath, readRedactionMarker } from "./cloud/redaction";

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
 * v21->v22: `roofProfilePointHeightsFt` changed from an ABSOLUTE height to
 * a RISE above the eave — a v21 file's absolute height migrates losslessly
 * by subtracting that project's own eave height (ground + second story
 * wall height, plus the shared truss-plate bearing height if `roofEnabled`
 * — see `computeSharedRooflineBearingHeightIn`), the same reference
 * `gableEaveHeightIn` in page.tsx already computes. Fixes a real bug: the
 * old absolute semantics meant an unconfigured default height could end up
 * BELOW a tall building's own eave (e.g. a 2-story building's eave sits
 * above the single-story-sane 16ft default), producing a roofline that
 * dips below the eave instead of rising above it.
 * v22->v23: each `MidWallBeam` gained a `kind` field ("box-beam" |
 * "web-braced-lintel") plus `lintelHeightIn` — Tommy: a second Mid-Wall
 * Bond Beam construction, "elongated header panels that have W bracing."
 * (That kind was later renamed "big-header-beam"/`bigHeaderBeamHeightIn` —
 * see remapLegacyBigHeaderBeamKind's own doc comment — but this entry
 * describes the schema as it stood at v22->v23, not current naming.)
 * A v22 file's beams have no `kind` at all — every one of them meant
 * "box-beam" (the only kind that existed), so migration is a straight
 * per-beam `kind: "box-beam"` stamp, `sizeId` passing through unchanged —
 * no cross-field lookups needed, the simplest migration in this file's
 * history so far. (That migration is gone as of v24 — v22 is now two
 * versions back and is rejected, per the one-version-back window.)
 * v23->v24: every stored length is quantized onto the 1/8in grid, so that a
 * wall's panel widths sum EXACTLY to the wall's own length (Tommy: "we must
 * remain absolutely precise on total lengths of wall segments being exactly
 * the same as the addition of all the panels"). Deliberately a load-time
 * REPAIR, not a re-tile: a re-tile would be a couple of lines shorter and
 * would throw away every manual panel-mover adjustment in the file, which is
 * real user work. Footprint corners snap via the same `quantizeFootprint` the
 * geometry ops now use; each slot width rounds independently and the residual
 * is shed round-robin over the standard/braced slots only, widest first — see
 * `repairStateToEighths`. Silent, with no Review Log entry: 1/8in is a shop
 * precision convention, not a building value, and nothing provisional moves.
 * v24->v25 (Project Smearforn, Stage 0): Foundation becomes an optional
 * scope-of-work branch (`foundationEnabled`), beside the Walls/Floors/Roof
 * checkboxes that already existed (Tommy: "I would like the turn off the
 * floor and foundation tools as default for now and primarily focus on
 * panelizing wall systems"). **A v24 file's `foundationEnabled` migrates to
 * `true`, NOT to the new-project default of `false`** — every project ever
 * saved was drawn with a Foundation tab, and a default change must never
 * take one away. That asymmetry (new project: off; existing file: on) is the
 * whole reason this is a version bump: an additive optional key with ONE
 * shared default needs no bump in this file at all (see `wallReviewNotes`,
 * `gableWindowAnchorsByWallId`, `maxPanelHeightIn`, every one of them added
 * without one). Nothing else moves: no length, no slot, no foundation type,
 * pier grid or floor system — those stay in state and in the file whether
 * their tab is shown or not, exactly as Floors and Roof already behaved.
 * Stage 3's own per-wall run-stop record (`wallRunStopsByWallId`) is added
 * here too, inert and empty, so the file format settles once this week
 * rather than twice — see the Smearforn plan's Stage 0.
 */
export const PROJECT_FILE_VERSION = 25;

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
  /** A wall column taller than this auto-splits into stacked zones (Tommy:
   * "panels should have a default max height of 10'... this option
   * editable... in the panelizer tab"). Optional (not in
   * REQUIRED_STATE_KEYS) so older project files, which predate this
   * feature, still load — see parseProjectFile's own defaulting. */
  maxPanelHeightIn?: number;
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
  /** Bale Foundation framing (Tommy: "the top framing member, bottom
   * framing member, and gap to be ui changable"). Optional (not in
   * REQUIRED_STATE_KEYS) so older project files, which predate this
   * feature, still load — see parseProjectFile's own defaulting. */
  baleFoundationTopDepthIn?: number;
  baleFoundationBottomDepthIn?: number;
  baleFoundationGapIn?: number;
  baleFoundationFieldSpacingIn?: BaleFoundationFieldSpacingIn;
  /** Rodent/air-sealed steel + clay bottom skin (Tommy: "a default option
   * to add to the bottom of the lowest floor framing member") — default
   * ON, optional for the same old-file-compat reason as the other Bale
   * Foundation fields above. */
  floorBottomSkinEnabled?: boolean;
  roofSystemTypeId: RoofSystemType;
  /** "peaked" = 1 top point (a ridge); "flat-top" = 2 independently
   * adjustable top points (Tommy: "options for peaked trusses with 1 point
   * on the top, or two points to make a triangle shaped with the top
   * chopped off") — the roofline gable-end panels tile up to meet. Global
   * (Roof tab), same as the single ridge height it replaces. */
  roofProfileType: "peaked" | "flat-top";
  /** One real RISE above the eave (ft), per profile point, index-matched to
   * `roofProfileType`'s own point count (length 1 for "peaked", 2 for
   * "flat-top") — fully independent, not forced symmetric. Relative to the
   * eave (not an absolute height) so a project's own default/unconfigured
   * profile always rises above whatever eave height that project actually
   * has (ground + second story + shared truss-plate bearing height), no
   * matter how many stories or what box beam is in play — see
   * `PROJECT_FILE_VERSION`'s own v21->v22 doc comment. */
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
  /** Gable end window panels (Tommy: "add an option to click-edit gable end
   * panels to become window gable end panels") — per-wall reservation list,
   * anchored the same way an opening on a normal wall is (see
   * computeGableTiledRow's own GableWindowReservation doc comment).
   * Optional (not in REQUIRED_STATE_KEYS) so older project files, which
   * predate this feature, still load — see parseProjectFile's own
   * defaulting to an empty record (no gable windows), matching every such
   * file's pre-existing behavior exactly. */
  gableWindowAnchorsByWallId?: Record<string, GableWindowReservation[]>;
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
  /** Where the gable roofline's slope actually starts lifting off — see
   * computeGableTiledRow's/resolveAnchors' own RoofBearingAnchorMode doc
   * comment. Optional (not in REQUIRED_STATE_KEYS) so older project files,
   * which predate this toggle, still load — see parseProjectFile's own
   * defaulting to `"truss-heel"`, matching every such file's pre-existing
   * behavior exactly. */
  roofBearingAnchorMode?: RoofBearingAnchorMode;
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
  /** Smearforn Stage 2b's spanning ("triple") headers — one header panel
   * over a slot-index RANGE, structurally the same record a Mid-Wall Bond
   * Beam carries (Tommy, 2026-09-24, on the model: "Yes, that's what it
   * is"). See `SpanningHeader`.
   *
   * **Optional, and therefore NOT a `PROJECT_FILE_VERSION` bump.** It is an
   * additive key with ONE shared default — absent (every file ever saved)
   * means no spanning headers, which is byte-identical to today's behaviour
   * — and this file's own v24->v25 note states that such a key needs no bump
   * (`wallReviewNotes`, `gableWindowAnchorsByWallId` and `maxPanelHeightIn`
   * were all added without one). Stage 0 deliberately did NOT pre-land this
   * key, because inventing the stored shape of an unconfirmed model is the
   * thing that log exists to prevent; the model is confirmed now, so the key
   * lands with the feature. It still needs a classification in
   * `cloud/redaction.ts`, which it has (`not-money`). */
  spanningHeadersByStoryAndWallId?: Record<"ground" | "second", Record<string, SpanningHeader[]>>;
  roofCatcherBeamOffsetIn: number;
  roofCatcherBeamShape: RoofCatcherBeamShape;
  /** Octagon roof-catcher ring's outside diameter (ft) — only shown/used
   * when the footprint is an octagon (8 corners), see octagonRingMembers.ts. */
  octagonRingDiameterFt: OctagonRingDiameterFt;
  /** Roof tab's own truss layout editor (Tommy: "the full 'panelized'
   * layout... spacing and doubles at the ends, or every member is a double
   * stud") — which of the 8 truss styles (6 classic + 2 high-performance)
   * is active, plus on-center spacing and sistering strategy. Optional
   * (not in REQUIRED_STATE_KEYS) so older project files, which predate this
   * feature, still load — see parseProjectFile's own defaulting. */
  roofTrussCategory?: "classic" | "high-perf";
  selectedClassicTrussId?: ClassicTrussTypeId;
  highPerfTrussTypeId?: HighPerfTrussTypeId;
  highPerfTrussCavityDepthIn?: HighPerfTrussCavityDepthIn;
  highPerfTrussBearingShapeId?: HighPerfTrussBearingShapeId;
  roofTrussSpacingIn?: RoofTrussSpacingIn;
  roofTrussDoublingStrategy?: TrussDoublingStrategy;
  /** Wall ids with "Add Gable End" enabled in the elevation view — see
   * page.tsx's elevationControls. Capped at 2, and the 2nd must be
   * areWallsOppositePair with the 1st (see gableEndToggleBlockReason in
   * page.tsx) — the roof-catcher beam's run is computed directly from these
   * 2 walls + gablePeakPositionInByWallId via computeRidgeLine, so no
   * separate run-length field needs to round-trip here. */
  gableEndWallIds: Set<string>;
  /** Which of `gableEndWallIds` are in "panels/beam" mode (Tommy: gable end
   * config is "the determining factor" for roof options) — `roofSystemTypeId`
   * above is now DERIVED from this at runtime rather than independently set,
   * but still round-trips here for a legacy-file migration fallback (see
   * parseProjectFile: an old save with `roofSystemTypeId === "structural-panel"`
   * and no entry here defaults every one of its own `gableEndWallIds` into
   * this set instead of silently losing that choice). Optional (not in
   * REQUIRED_STATE_KEYS) — older project files predate this field. */
  gableStructuralPanelWallIds?: Set<string>;
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
  /** The fourth scope-of-work branch, added in v25 (Tommy: "I would like
   * the turn off the floor and foundation tools as default for now"). New
   * projects start `false`; a v24 file, which has no such key, migrates to
   * `true` so an existing design never silently loses its Foundation tab —
   * see PROJECT_FILE_VERSION's own v24->v25 note. Unchecking it hides the
   * tab and its Detail Guide page; it deletes nothing (`foundationTypeId`,
   * `pierSpacingFt` and every derived pier/foundation geometry stay put). */
  foundationEnabled: boolean;
  /** Stage 3's per-wall unbuilt spans (Tommy: "a stop wall tool so that it
   * is possible to make incomplete walls") — inches from each wall end, on
   * the 1/8in grid. **Inert as of Stage 0**: the key round-trips and is
   * classified, and nothing reads it yet. An absent entry (and an absent
   * record) means a fully panelized wall, which is today's behaviour and
   * every existing file's. */
  wallRunStopsByWallId?: Record<string, WallRunStop>;
  /** Smearforn Stage 3's run-stop opening memory (Tommy, 2026-09-29, choosing
   * between three ways to handle an opening a stop swallows: **"Drop them,
   * and remember"** — *"Openings in the stopped-off part are removed from the
   * built run, but stored so they come straight back if you un-stop the wall.
   * Physically honest — an unbuilt section has no windows — and
   * non-destructive."*).
   *
   * Per story, per wall: the `OpeningAnchor`s an unbuilt span swallowed,
   * plus the pre-stop ORDER they sat in (`RunStopOpeningMemory`). They are not
   * in `baseWallSlots`/`stories[].wallSlots` at all — an unbuilt section of
   * wall has no window in it, so nothing derived from slots (cut list,
   * fabrication groups, shop drawings, price, weight) sees them — and they are
   * not deleted either: reducing or clearing the stop hands them back to the
   * tiler and the wall comes back exactly as it was.
   *
   * The `preStop` half is not redundant bookkeeping: without it a surviving
   * opening's ordinal is re-derived against the SHORTENED run while the
   * remembered one still carries its long-run ordinal, and restoring sorts the
   * two back in the wrong order. See `runStopOpenings.ts`'s module doc comment
   * and the measurement in it.
   *
   * **Keys are pruned to walls the footprint still has, at write time** — see
   * `pruneOpeningMemoryToLiveWalls` in page.tsx. Wall ids are reused, so a
   * memory outliving its wall would resurrect a window on an unrelated one.
   *
   * **Optional, and therefore NOT a `PROJECT_FILE_VERSION` bump**, by this
   * file's own stated rule: it is an additive optional key with ONE shared
   * default — absent (every file ever saved) means nothing was ever withheld,
   * which is byte-identical to today's behaviour. See the v24->v25 note above,
   * which states the rule and names `wallReviewNotes`,
   * `gableWindowAnchorsByWallId`, `maxPanelHeightIn` and
   * `spanningHeadersByStoryAndWallId` as precedents. Deliberately NOT added to
   * `REQUIRED_STATE_KEYS` for the same reason: requiring it would make every
   * project file that predates today unopenable, and this key's absence has an
   * unambiguous meaning. It still needs a classification in
   * `cloud/redaction.ts`, which it has (`not-money`). */
  unbuiltOpeningsByStoryAndWallId?: Record<"ground" | "second", Record<string, RunStopOpeningMemory>>;
  /** Engineer role's own per-wall attributed notes (Tommy's Engineer Lens
   * mockup: a free-text note signed "- Eng. Smith") — see
   * wallReviewNotes.ts's own doc comment on why this is a separate concept
   * from reviewLog. Optional (not in REQUIRED_STATE_KEYS) so older project
   * files, which predate this feature, still load — see parseProjectFile's
   * own defaulting to an empty array (no notes), matching every such
   * file's pre-existing behavior exactly. */
  wallReviewNotes?: WallReviewNote[];
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
  "foundationEnabled",
];

/** Keys that exist in v25 and did NOT exist in v24. The required-keys check
 * skips exactly these when reading the one accepted prior version — a v24
 * file is not missing `foundationEnabled`, it predates it, and refusing to
 * open it would be the "a file must never become unopenable because the
 * format moved" failure this parser exists to avoid. The list is deliberately
 * separate from `REQUIRED_STATE_KEYS` rather than a carve-out inside it, so
 * that when v24 falls out of the window it is one deletion, not an edit to
 * the required list. */
const KEYS_ADDED_IN_V25: readonly string[] = ["foundationEnabled"];

/** JSON has no Set type — `primaryCornerIds`/`gableEndWallIds`/
 * `checkedInteriorIds`/`checkedExteriorIds` round-trip as plain arrays.
 * `boxBeamCoverageByWallId` is a plain `Record`, not a Set, so it needs no
 * special array treatment here — it flows straight through. */
export interface ProjectFile {
  schemaVersion: number;
  savedAt: string;
  state: Omit<ProjectState, "primaryCornerIds" | "gableEndWallIds" | "gableStructuralPanelWallIds" | "checkedInteriorIds" | "checkedExteriorIds"> & {
    primaryCornerIds: string[];
    gableEndWallIds: string[];
    gableStructuralPanelWallIds?: string[];
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
      gableStructuralPanelWallIds: state.gableStructuralPanelWallIds ? [...state.gableStructuralPanelWallIds] : undefined,
      checkedInteriorIds: [...state.checkedInteriorIds],
      checkedExteriorIds: [...state.checkedExteriorIds],
      // Every save is written post-migration, regardless of whether the
      // in-memory state getting saved originated from an old (unseeded)
      // load — see bracedStateSeeded's own doc comment.
      bracedStateSeeded: true,
    },
  };
}

/**
 * Value-only remap (no `PROJECT_FILE_VERSION` bump — the shape hasn't
 * changed, just the string a beam's own `kind`/height field uses): a file
 * saved before the Mid-Wall Bond Beam's "Web Braced Lintel" kind was
 * renamed "Big Header (Mid-Wall Beam)" still has `kind: "web-braced-lintel"`
 * and `lintelHeightIn` in its raw JSON (both old identifiers — see the
 * Review Log). Applied unconditionally (both the current-version and
 * v22-migrated branches), since even a file saved moments before this
 * rename shipped is otherwise indistinguishable from a current one.
 */
function remapLegacyBigHeaderBeamKind(
  beamsByStoryAndWallId: Record<"ground" | "second", Record<string, MidWallBeam[]>>,
): Record<"ground" | "second", Record<string, MidWallBeam[]>> {
  const remapStory = (beamsByWallId: Record<string, MidWallBeam[]>): Record<string, MidWallBeam[]> =>
    Object.fromEntries(
      Object.entries(beamsByWallId).map(([wallId, beams]) => [
        wallId,
        beams.map((b) => {
          const raw = b as MidWallBeam & { lintelHeightIn?: number };
          if ((raw.kind as string) !== "web-braced-lintel") return b;
          const { lintelHeightIn, ...rest } = raw;
          return { ...rest, kind: "big-header-beam" as const, bigHeaderBeamHeightIn: lintelHeightIn };
        }),
      ]),
    );
  return { ground: remapStory(beamsByStoryAndWallId.ground ?? {}), second: remapStory(beamsByStoryAndWallId.second ?? {}) };
}

/**
 * v23 -> v24: puts every stored length on the 1/8in grid.
 *
 * Per wall: snap the footprint corners, then round each slot width to eighths
 * independently and shed the residual one eighth at a time, round-robin over
 * the standard/braced slots only, widest first (see `repairWallToEighths`).
 * Fixed-width slots — corner, safety-gap, and the openings — keep their own
 * rounding; they are already eighth-exact in every file this app has written.
 * Applied to `baseWallSlots` and to every story's `wallSlots`. Gable rows are
 * NOT touched here because they are not stored: `computeGableTiledRow` derives
 * them on every render, so they land on the grid the moment the file loads.
 *
 * **Which length a wall is repaired against, and the guard on it.** The target
 * is `wallGeometryFor(...).lengthIn` — the exact length the tiling engine
 * itself uses, corner-ownership insets and all — because that is what the next
 * re-tile will measure against and therefore what the invariant is stated in.
 * But a wall whose stored widths are off that target by more than one eighth
 * PER SLOT was never a tiling of this wall in the first place (hand-edited
 * state, a synthetic fixture, or a footprint/slots pair that drifted apart
 * some other way). Silently stretching such a wall to a length it was never
 * built at would be a real geometry change wearing a rounding repair's
 * clothes, so those walls are instead repaired against their own stored total:
 * still every-width-a-whole-eighth, but without inventing width that was not
 * there.
 *
 * The threshold is one eighth per slot. Deliberately NOT derived from
 * per-slot rounding alone (half an eighth each): `quantizeFootprint` also
 * moves the WALL's own length, by an amount independent of how many slots it
 * has, and on an octagon diagonal that term dominates. The justification is
 * empirical instead, which is the stronger claim anyway — measured across
 * legacy octagons at 8, 12, 20 and 40ft, every one of the eight walls
 * (including the 8ft case where both corners merge) came out with a residual
 * of 0 or 1 eighth. So a real file sits an order of magnitude inside the
 * threshold, and the guard only ever fires on state the tiler never produced.
 *
 * Deliberately UNCONDITIONAL rather than gated on the file's version. It is a
 * true no-op on an already-quantized file (`repairWallToEighths` returns the
 * same array reference), and it is the standing safety net the spec asks for
 * if some future code path ever produces an off-grid width. The cost of that
 * choice, stated rather than hidden: a Stage 2 input-snapping bug would be
 * repaired at load instead of showing up as a visible long fraction.
 *
 * That cost is currently zero, which is why unconditional wins today: the
 * "visible long fraction" signal DOES NOT EXIST YET — `formatImperialFractionIn`
 * still rounds to the nearest eighth silently, by design, until Stage 1b makes
 * it honest. **Revisit when 1b lands**: at that point either version-gate this
 * repair, or have it warn on the dev console when it actually changes a
 * CURRENT-version file, so a Stage 2 escape stays visible instead of being
 * quietly absorbed here.
 */
/**
 * One story of Stage 3's opening memory, with any value that is not a
 * `RunStopOpeningMemory` normalized rather than trusted.
 *
 * ⚠ **A malformed value here does not degrade, it WHITE-SCREENS the editor.**
 * `retilePreservingOpeningsWithRunStopMemory` reads `…?.[wall.id]?.unbuilt.length`,
 * so a value that is a bare ARRAY — the shape this feature's own first commit
 * wrote, and which still exists on a live branch — gives `undefined.length` and
 * throws straight out of the tiler: *"Cannot read properties of undefined
 * (reading 'length')"*, with no building on screen and no way back. The rest of
 * this parser validates the keys it requires; this one is optional, so nothing
 * else would catch it.
 *
 * A bare array WAS the withheld anchors, so it is read as exactly that, with an
 * empty pre-stop order — the openings come back approximately rather than not at
 * all, which is the side of that trade Tommy's "remember them" decision picks.
 * A value that is not a memory at all is dropped, leaving the wall with no
 * entry: nothing withheld, which is the state every project saved before this
 * feature is in.
 *
 * A well-formed value is passed through BY REFERENCE, so a round trip stays an
 * identity and a field added to the memory later cannot be silently stripped
 * here.
 */
function openingMemoryStory(value: unknown): Record<string, RunStopOpeningMemory> {
  if (!value || typeof value !== "object") return {};
  const story: Record<string, RunStopOpeningMemory> = {};
  for (const [wallId, memory] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(memory)) {
      story[wallId] = { unbuilt: memory as RunStopOpeningMemory["unbuilt"], preStop: [] };
      continue;
    }
    if (!memory || typeof memory !== "object") continue;
    const candidate = memory as RunStopOpeningMemory;
    if (!Array.isArray(candidate.unbuilt)) continue;
    story[wallId] = Array.isArray(candidate.preStop) ? candidate : { ...candidate, preStop: [] };
  }
  return story;
}

function repairStateToEighths(state: ProjectState): ProjectState {
  if (!state.footprint) return state;
  const footprint = quantizeFootprint(state.footprint);

  const repairWall = (slots: PanelSlot[], wallId: string): PanelSlot[] => {
    const ownTotalIn = slots.reduce((sum, slot) => sum + Math.max(0, toEighths(slot.widthIn)), 0) / 8;
    const geometry = wallGeometryFor(footprint, wallId, state.primaryCornerIds, state.leastAccessibleCorner, state.thicknessIn);
    if (!geometry) return repairWallToEighths(slots, ownTotalIn); // no such wall any more
    const residualEighths = Math.abs(toEighths(geometry.lengthIn) - toEighths(ownTotalIn));
    return repairWallToEighths(slots, residualEighths <= slots.length ? geometry.lengthIn : ownTotalIn);
  };
  const repairAll = (byWallId: Record<string, PanelSlot[]>): Record<string, PanelSlot[]> =>
    Object.fromEntries(Object.entries(byWallId ?? {}).map(([wallId, slots]) => [wallId, repairWall(slots ?? [], wallId)]));

  return {
    ...state,
    footprint,
    baseWallSlots: repairAll(state.baseWallSlots),
    stories: (state.stories ?? []).map((story) => ({ ...story, wallSlots: repairAll(story.wallSlots) })),
  };
}

/** `savedAt` is passed through as the raw string (undefined when absent or not
 * a string) and deliberately NOT validated here: a file with a missing or
 * damaged timestamp is still a loadable design, so it must not be rejected.
 * `resolveTitleBlockDate` decides what an unusable value prints as. */
export type ParseProjectFileResult = { ok: true; state: ProjectState; savedAt: string | undefined } | { ok: false; error: string };

/**
 * Validates just enough to reject something that clearly isn't one of our
 * own exports (wrong version, missing top-level fields) — a system
 * boundary (arbitrary user-uploaded file), not full deep schema
 * validation of every nested footprint/slot shape.
 *
 * NOTHING IS EXCUSED HERE. A file missing a required key is refused, exactly as
 * it always was; the one caller that may excuse a key is
 * `parseRedactedProjectFile` below, and it excuses only the paths a redaction
 * marker names AND the money classification recognises.
 */
export function parseProjectFile(raw: string): ParseProjectFileResult {
  return parseDocument(raw, NOTHING_EXCUSED);
}

const NOTHING_EXCUSED: ReadonlySet<string> = new Set();

function parseDocument(raw: string, excusedStateKeys: ReadonlySet<string>): ParseProjectFileResult {
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

  // v24 (the one prior version this file also accepts) carries every required
  // key EXCEPT the ones v25 introduced — see KEYS_ADDED_IN_V25, which is what
  // this skip reads, and PROJECT_FILE_VERSION's own v24->v25 note for what
  // each of them defaults to. Everything else about the two shapes is
  // identical: v24->v25 adds keys, it renames and removes nothing.
  for (const key of REQUIRED_STATE_KEYS) {
    if (excusedStateKeys.has(key)) continue;
    if (isPriorVersion && KEYS_ADDED_IN_V25.includes(key)) continue;
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

  // Every load — v23 or v24 — ends by going through the 1/8in quantization
  // repair; see repairStateToEighths for why it is unconditional.
  return {
    ok: true,
    savedAt: typeof file.savedAt === "string" ? file.savedAt : undefined,
    state: repairStateToEighths({
      ...(state as unknown as ProjectState),
      stories: state.stories as Story[],
      roofProfileType: state.roofProfileType as "peaked" | "flat-top",
      roofProfilePointHeightsFt: state.roofProfilePointHeightsFt as number[],
      gableProfilePositionsInByWallId: state.gableProfilePositionsInByWallId as Record<string, (number | null)[]>,
      // Optional — absent on any file saved before this feature existed, so
      // every one defaults to no gable windows (the pre-existing behavior
      // every such file was actually built with).
      gableWindowAnchorsByWallId: (state.gableWindowAnchorsByWallId as Record<string, GableWindowReservation[]> | undefined) ?? {},
      maxGablePanelHeightIn: state.maxGablePanelHeightIn as number,
      heelHeightIn: state.heelHeightIn as number,
      // Optional — absent on any file saved before this toggle existed, so
      // every one defaults to "truss-heel" (the pre-existing behavior every
      // such file was actually built with).
      roofBearingAnchorMode: (state.roofBearingAnchorMode as RoofBearingAnchorMode | undefined) ?? "truss-heel",
      boxBeamCoverageByWallId: state.boxBeamCoverageByWallId as Record<string, BoxBeamCoverage>,
      boxBeamSizeId: (state.boxBeamSizeId as BoxBeamSizeId) ?? BOX_BEAM_SIZE_DEFAULT,
      // Optional — absent on any file saved before the truss layout editor
      // existed (see ProjectState's own doc comment above), so every one
      // defaults exactly the way page.tsx's own useState calls do.
      roofTrussCategory: (state.roofTrussCategory as "classic" | "high-perf" | undefined) ?? "classic",
      selectedClassicTrussId: (state.selectedClassicTrussId as ClassicTrussTypeId | undefined) ?? "king-post",
      highPerfTrussTypeId: (state.highPerfTrussTypeId as HighPerfTrussTypeId | undefined) ?? "energy-heel",
      highPerfTrussCavityDepthIn: (state.highPerfTrussCavityDepthIn as HighPerfTrussCavityDepthIn | undefined) ?? 18,
      highPerfTrussBearingShapeId: (state.highPerfTrussBearingShapeId as HighPerfTrussBearingShapeId | undefined) ?? "built-up-3ply-2x12",
      roofTrussSpacingIn: (state.roofTrussSpacingIn as RoofTrussSpacingIn | undefined) ?? ROOF_TRUSS_SPACING_DEFAULT_IN,
      roofTrussDoublingStrategy: (state.roofTrussDoublingStrategy as TrussDoublingStrategy | undefined) ?? "single",
      baleFoundationTopDepthIn: (state.baleFoundationTopDepthIn as number | undefined) ?? BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
      baleFoundationBottomDepthIn: (state.baleFoundationBottomDepthIn as number | undefined) ?? BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
      baleFoundationGapIn: (state.baleFoundationGapIn as number | undefined) ?? BALE_FOUNDATION_GAP_DEFAULT_IN,
      baleFoundationFieldSpacingIn:
        (state.baleFoundationFieldSpacingIn as BaleFoundationFieldSpacingIn | undefined) ?? BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN,
      floorBottomSkinEnabled: (state.floorBottomSkinEnabled as boolean | undefined) ?? true,
      maxPanelHeightIn: (state.maxPanelHeightIn as number | undefined) ?? standardPanelHeightIn.value,
      // Optional — absent on any file saved before this feature existed, so
      // every one defaults to no notes (the pre-existing behavior every
      // such file was actually built with).
      wallReviewNotes: (state.wallReviewNotes as WallReviewNote[] | undefined) ?? [],
      // v24->v25. A v24 file has no such key and was drawn with a Foundation
      // tab, so it gets one: `true`, NOT the new-project default of `false`.
      // A v25 file always carries its own value, and `false ?? true` is
      // `false`, so a deliberately unchecked Foundation survives a round trip.
      foundationEnabled: (state.foundationEnabled as boolean | undefined) ?? true,
      // Stage 3's key, inert: absent (every v24 file, and every v25 file saved
      // before Stage 3 lands) means no wall stops short, which is exactly
      // today's behaviour.
      wallRunStopsByWallId: (state.wallRunStopsByWallId as Record<string, WallRunStop> | undefined) ?? {},
      // Stage 2b's key. Absent — every file saved before this feature, at
      // v25 or at v24 — means no spanning headers, which is byte-identical
      // to today's behaviour, so this is an additive optional key and NOT a
      // version bump.
      //
      // **Absent stays ABSENT**, rather than being defaulted to an empty
      // record here: a load of a file without the key must produce the state
      // that file describes, or a round trip stops being an identity (a test
      // says exactly that). Where it IS present, both halves are normalized,
      // so a file carrying only `ground` can never hand a consumer an
      // undefined `second`.
      ...(state.spanningHeadersByStoryAndWallId
        ? {
            spanningHeadersByStoryAndWallId: {
              ground:
                (state.spanningHeadersByStoryAndWallId as Partial<Record<"ground" | "second", Record<string, SpanningHeader[]>>>).ground ??
                {},
              second:
                (state.spanningHeadersByStoryAndWallId as Partial<Record<"ground" | "second", Record<string, SpanningHeader[]>>>).second ??
                {},
            },
          }
        : {}),
      // Stage 3's opening memory. Absent — every file saved before today, at
      // v25 or at v24 — means nothing was ever withheld from a run, which is
      // byte-identical to today's behaviour, so this is an additive optional
      // key and NOT a version bump (see its own doc comment, and the v24->v25
      // note, which states that rule).
      //
      // **Absent stays ABSENT**, for the same reason
      // `spanningHeadersByStoryAndWallId` above does: a load of a file without
      // the key must produce the state that file describes, or a round trip
      // stops being an identity. Where it IS present both halves are
      // normalized, so a file carrying only `ground` can never hand a consumer
      // an undefined `second`.
      ...(state.unbuiltOpeningsByStoryAndWallId
        ? {
            unbuiltOpeningsByStoryAndWallId: {
              ground: openingMemoryStory(
                (state.unbuiltOpeningsByStoryAndWallId as Partial<Record<"ground" | "second", unknown>>).ground,
              ),
              second: openingMemoryStory(
                (state.unbuiltOpeningsByStoryAndWallId as Partial<Record<"ground" | "second", unknown>>).second,
              ),
            },
          }
        : {}),
      // Both accepted versions (v23 and v24) already carry each beam's own
      // `kind` — v23->v24 changes no beam field at all — so there is no
      // per-version branch here any more. remapLegacyBigHeaderBeamKind still
      // fixes up any "web-braced-lintel" kind left over from before that
      // rename, which is a value remap rather than a version migration.
      midWallBeamsByStoryAndWallId: remapLegacyBigHeaderBeamKind(
        state.midWallBeamsByStoryAndWallId as Record<"ground" | "second", Record<string, MidWallBeam[]>>,
      ),
      primaryCornerIds: new Set(state.primaryCornerIds as string[]),
      gableEndWallIds: new Set(state.gableEndWallIds as string[]),
      // Optional — absent on any file saved before roofSystemTypeId became
      // derived from this. A legacy file that was saved in
      // "structural-panel" mode defaults every one of its own
      // gableEndWallIds into this set instead of silently losing that
      // choice; otherwise (or on a fresh v-current save) it's exactly
      // what was actually saved.
      gableStructuralPanelWallIds: new Set(
        (state.gableStructuralPanelWallIds as string[] | undefined) ??
          (state.roofSystemTypeId === "structural-panel" ? (state.gableEndWallIds as string[]) : []),
      ),
      checkedInteriorIds: new Set(state.checkedInteriorIds as string[]),
      checkedExteriorIds: new Set(state.checkedExteriorIds as string[]),
      // LAST, so it wins over every spread and default above: an excused key is
      // held as NaN, never as a substituted number. Empty unless the caller is
      // `parseRedactedProjectFile`. See `blankedExcusedKeys` for why NaN.
      ...blankedExcusedKeys(excusedStateKeys),
    }),
  };
}

// ---------------------------------------------------------------------------
// Stage 4B: the redacted-aware parse path, BESIDE parseProjectFile
// ---------------------------------------------------------------------------

/**
 * `priceModifier` is in `REQUIRED_STATE_KEYS`, so a document the database's
 * redactor has stripped would otherwise be refused by `parseProjectFile` with
 * "That file is missing the priceModifier field" — a message that reads like a
 * corrupt file, on every browsed project (spec, "The collision with the live
 * parser"). This is the separate path that opens one, and it is deliberately a
 * NEW function rather than a loosening of the old one: nothing that opens a
 * local file or a Stage 2 cloud version can reach the excusing branch.
 *
 * NaN, not 1.0 and not 0. Decision 21's field never leaves the server, so there
 * is no true value to show; the flag convention's own rule (a visible gap beats
 * a plausible substitute) says the substitute must be obviously broken. Every
 * price display is gated on `costsRedacted`, and if a gate is ever missed the
 * screen reads `$NaN` — impossible to mistake for the owner's number — instead
 * of a confident figure built from a defaulted markup.
 */
function blankedExcusedKeys(excusedStateKeys: ReadonlySet<string>): Record<string, number> {
  const blanked: Record<string, number> = {};
  for (const key of excusedStateKeys) blanked[key] = Number.NaN;
  return blanked;
}

export type ParseRedactedProjectFileResult =
  | { ok: true; state: ProjectState; savedAt: string | undefined; costsRedacted: true; removedPaths: string[]; reason: string }
  | { ok: false; error: string };

export const REDACTED_UNMARKED_MESSAGE =
  "That version didn't arrive marked as another company's, so it wasn't opened. Nothing is on screen from it; try again, and tell Tommy if it keeps happening.";

export function redactedUnknownPathMessage(path: string): string {
  return `That version says "${path}" was removed, which this app doesn't know how to open without. It wasn't opened.`;
}

export const REDACTED_FIELD_SURVIVED_MESSAGE =
  "That version still carried a field it said had been removed, so it wasn't opened.";

/**
 * Parse a document served by `browse_version`: the stored document minus every
 * classified money path, plus the top-level `redaction` marker naming what went.
 *
 * FAIL-CLOSED AT EVERY STEP, because this is the one parse that is allowed to
 * accept a document with a required key missing:
 *
 *   * NO MARKER, no excusing. A browsed document always carries one, so a
 *     document without one is a fault — refused, not opened as an ordinary
 *     full document, and not retried through `parseProjectFile`.
 *   * The marker's `schemaVersion` must match the document's own.
 *   * Every removed path must be one the money classification recognises
 *     (`state.priceModifier` today). A marker claiming `state.zipCode` went is
 *     refused rather than opened with a hole in the design.
 *   * A path the marker says was removed must genuinely be ABSENT. If the field
 *     is still there, the server's own account of what it sent is wrong, and
 *     this refuses instead of quietly showing another company's markup.
 *
 * It never removes anything itself: redaction happens in the database, and this
 * only reads what the database did.
 */
export function parseRedactedProjectFile(raw: string): ParseRedactedProjectFileResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That version isn't valid JSON." };
  }
  const marker = readRedactionMarker(json);
  if (!marker) return { ok: false, error: REDACTED_UNMARKED_MESSAGE };

  const file = json as Record<string, unknown>;
  if (file.schemaVersion !== marker.schemaVersion) {
    return { ok: false, error: REDACTED_UNMARKED_MESSAGE };
  }
  const state = (typeof file.state === "object" && file.state !== null ? file.state : {}) as Record<string, unknown>;

  const excused = new Set<string>();
  for (const path of marker.removedPaths) {
    if (!isRedactablePath(path)) return { ok: false, error: redactedUnknownPathMessage(path) };
    const key = path.slice("state.".length);
    if (key in state) return { ok: false, error: REDACTED_FIELD_SURVIVED_MESSAGE };
    excused.add(key);
  }
  // A money key the marker did NOT name, still sitting in the document, is the
  // same fault from the other side: the redactor should never serve one.
  for (const key of MONEY_STATE_KEYS) {
    if (key in state) return { ok: false, error: REDACTED_FIELD_SURVIVED_MESSAGE };
  }

  const parsed = parseDocument(raw, excused);
  if (!parsed.ok) return parsed;
  return { ok: true, state: parsed.state, savedAt: parsed.savedAt, costsRedacted: true, removedPaths: [...marker.removedPaths], reason: marker.reason };
}
