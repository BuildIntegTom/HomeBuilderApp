import type { ProjectState } from "./projectFile";

/**
 * UNDO / REDO — the history itself, as pure data.
 *
 * Tommy, 2026-10-03: *"An undo and redo button seems like a great idea."*
 * Pulled forward out of tile-once Stage 5 because **Repanelize must not ship
 * without it** — a wholesale re-tile is the most destructive single action in
 * the app, and a confirmation dialog is a poor substitute for being able to
 * take it back.
 *
 * ## Why a whole ProjectState per entry, and why that is cheap
 *
 * `buildProjectState` and `applyProjectState` are already a serializer and a
 * deserializer the app trusts for Save and Load. Undo is the same pair
 * pointed at memory, which means it inherits whatever those two already get
 * right instead of growing a second, subtly different idea of what the
 * document is.
 *
 * An entry is **not a deep copy**. React state is replaced rather than
 * mutated — `setBaseWallSlots(next)` hands over a new object — so an entry
 * holds ~74 references to objects that already exist, and two entries that
 * differ by one wall share every other wall's array. The cost of an entry is
 * the pointer table, not the building.
 */

/**
 * Which keys are the DOCUMENT and which are just where the user happens to be
 * standing.
 *
 * ⚠ **Every key must be classified**, the same way `redaction.ts` forces every
 * key to be money or not-money — and that guard is exactly what caught R0's
 * new key. A key added here without a verdict fails the build rather than
 * silently defaulting into the undo stack.
 *
 * `transient` means: changing it alone creates NO undo entry, and undoing
 * does NOT put it back. Switching to the Roof tab is not an edit, and an undo
 * that yanked the user to a different tab — or flipped their units — would be
 * undoing something they did not do.
 */
export const UNDO_CLASSIFICATION = {
  // --- where the user is standing, not what they built ---------------------
  editorTab: "transient",
  viewMode: "transient",
  shapeTool: "transient",
  role: "transient",
  unitSystem: "transient",

  // --- the document --------------------------------------------------------
  footprint: "document",
  isBumpedOut: "document",
  primaryCornerIds: "document",
  offsetPx: "document",
  baseWallSlots: "document",
  leastAccessibleCorner: "document",
  standardWidthIn: "document",
  thicknessIn: "document",
  densityLbFt3: "document",
  wallHeightFt: "document",
  maxPanelHeightIn: "document",
  includeNailer: "document",
  checkedInteriorIds: "document",
  checkedExteriorIds: "document",
  season: "document",
  seismicZone: "document",
  foundationTypeId: "document",
  pierSpacingFt: "document",
  zipCode: "document",
  priceModifier: "document",
  floorSystemId: "document",
  perpendicular2x4Enabled: "document",
  baleFoundationTopDepthIn: "document",
  baleFoundationBottomDepthIn: "document",
  baleFoundationGapIn: "document",
  baleFoundationFieldSpacingIn: "document",
  floorBottomSkinEnabled: "document",
  roofSystemTypeId: "document",
  roofProfileType: "document",
  roofProfilePointHeightsFt: "document",
  gableProfilePositionsInByWallId: "document",
  gableWindowAnchorsByWallId: "document",
  maxGablePanelHeightIn: "document",
  trussPlateInsetIn: "document",
  heelHeightIn: "document",
  roofBearingAnchorMode: "document",
  boxBeamCoverageByWallId: "document",
  boxBeamSizeId: "document",
  midWallBeamsByStoryAndWallId: "document",
  spanningHeadersByStoryAndWallId: "document",
  roofCatcherBeamOffsetIn: "document",
  roofCatcherBeamShape: "document",
  octagonRingDiameterFt: "document",
  roofTrussCategory: "document",
  selectedClassicTrussId: "document",
  highPerfTrussTypeId: "document",
  highPerfTrussCavityDepthIn: "document",
  highPerfTrussBearingShapeId: "document",
  roofTrussSpacingIn: "document",
  roofTrussDoublingStrategy: "document",
  gableEndWallIds: "document",
  gableStructuralPanelWallIds: "document",
  stories: "document",
  panelizationType: "document",
  timberFrameCurtainPanelType: "document",
  timberFrameCurtainWidthIn: "document",
  nailerOffsetIn: "document",
  squareBaleStudConfig: "document",
  bracingStyle: "document",
  // Bookkeeping from the load path rather than anything the user sets, but it
  // travels with the document and must survive a round trip.
  bracedStateSeeded: "document",
  projectName: "document",
  wallsEnabled: "document",
  floorsEnabled: "document",
  roofEnabled: "document",
  foundationEnabled: "document",
  wallRunStopsByWallId: "document",
  unbuiltOpeningsByStoryAndWallId: "document",
  /* Undoing a stop must put back the panels that stop removed, so the
     remembered span travels with the document rather than being rebuilt. */
  stoppedSlotsByStoryAndWallId: "document",
  wallReviewNotes: "document",
  tilingBasis: "document",
} as const satisfies Record<keyof ProjectState, "document" | "transient">;

export const DOCUMENT_KEYS = (Object.keys(UNDO_CLASSIFICATION) as (keyof ProjectState)[]).filter(
  (k) => UNDO_CLASSIFICATION[k] === "document",
);

/**
 * Do these two states describe the same document?
 *
 * Reference equality per key, which is right because React replaces state
 * rather than mutating it: an edit produces a new object for the thing it
 * touched and leaves every other reference alone. ⚠ It also means a handler
 * that mutated state in place would look like "no change" here — that is a
 * bug in the handler, and this comparison is not the place to paper over it.
 */
export function sameDocument(a: ProjectState, b: ProjectState): boolean {
  for (const key of DOCUMENT_KEYS) if (a[key] !== b[key]) return false;
  return true;
}

export interface UndoHistory {
  /** Oldest first. `entries[index]` is what is on screen. */
  readonly entries: readonly ProjectState[];
  readonly index: number;
}

/**
 * How many steps back the user can go.
 *
 * ⚠ **A cap is not an optimisation here, it is a memory bound.** Entries share
 * structure, but a long session that redraws the footprint repeatedly retains
 * one full set of wall arrays per redraw. Fifty is deep enough that nobody
 * reaches it by hand and shallow enough that the retained set stays small.
 * ⚠ Tommy has NOT chosen this number; it is recorded as an open item.
 */
export const UNDO_DEPTH = 50;

export const emptyUndoHistory: UndoHistory = { entries: [], index: -1 };

/**
 * Record a new present.
 *
 * Anything that was undone is discarded, which is what every editor does: once
 * you undo and then do something else, the branch you abandoned is gone.
 */
export function pushUndoEntry(history: UndoHistory, state: ProjectState, depth = UNDO_DEPTH): UndoHistory {
  const kept = history.entries.slice(0, history.index + 1);
  kept.push(state);
  const overflow = Math.max(0, kept.length - depth);
  const entries = overflow > 0 ? kept.slice(overflow) : kept;
  return { entries, index: entries.length - 1 };
}

export const canUndo = (history: UndoHistory): boolean => history.index > 0;
export const canRedo = (history: UndoHistory): boolean => history.index >= 0 && history.index < history.entries.length - 1;

/** The state to restore, and the history to keep — or null when there is
 * nowhere to go, so a caller cannot accidentally "restore" the present. */
export function undoTo(history: UndoHistory): { state: ProjectState; history: UndoHistory } | null {
  if (!canUndo(history)) return null;
  const index = history.index - 1;
  return { state: history.entries[index]!, history: { ...history, index } };
}

export function redoTo(history: UndoHistory): { state: ProjectState; history: UndoHistory } | null {
  if (!canRedo(history)) return null;
  const index = history.index + 1;
  return { state: history.entries[index]!, history: { ...history, index } };
}
