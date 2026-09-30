// TYPE-ONLY, deliberately: `projectFile.ts` imports MONEY_STATE_KEYS from here
// for its redacted parse path, and a type import is erased, so the two files do
// not form a runtime cycle.
import type { ProjectState } from "../projectFile";

/**
 * Which fields of a saved document are another company's money — decision 21's
 * "tested against `ProjectState`'s own key list", Stage 4.
 *
 * THE POINT OF THIS FILE IS THAT IT DOES NOT REDACT ANYTHING. The redactor runs
 * in the database (`browse_redact`, migration 0009) because the publishable key
 * ships in the browser bundle, so anything RLS will serve, PostgREST will serve
 * directly; a TypeScript redactor could simply be gone around. What lives here
 * is the CLASSIFICATION — the list the database's seed row must agree with —
 * and the shape of the marker the database adds in place of what it removed.
 *
 * THREE LAYERS, AND WHAT EACH ONE CATCHES (spec, "The TypeScript side"):
 *
 *   (a) `MONEY_CLASSIFICATION` is exhaustive over `keyof ProjectState` by type.
 *       Add a field to `ProjectState` and forget to classify it and `tsc
 *       --noEmit` FAILS, naming the missing key. A silently unclassified new
 *       field is how the first leak would happen, so the compiler is the gate,
 *       not a test that someone could skip.
 *   (b) `redaction.test.ts` serializes a real project and asserts every runtime
 *       key of `serializeProject(state).state` appears here — drift the type
 *       cannot see.
 *   (c) `redaction.test.ts` reads `0009_stage4_browsing.sql` and asserts its
 *       seeded paths for `PROJECT_FILE_VERSION` are exactly the keys classified
 *       `money` here. So a new money field fails (a); classifying it without
 *       seeding it fails (c); and a schema version with no seed row at all is
 *       asserted to be absent — which is the state that makes the database
 *       refuse to serve it rather than serve it unredacted.
 *
 * WHAT IS NOT HERE, AND WHY. `shippingRatePerMile`, the four `plaster*Price*`,
 * `steelMeshPricePerSqFt` and `plasterLaborRatePerHour` are dollars, but they
 * are `useState` in `page.tsx` and are NOT in `ProjectState`, so they are not in
 * the document and there is nothing to redact. THE DAY THEY ARE ADDED TO
 * `ProjectState` THEY BECOME MONEY, and (a) is what will force that decision:
 * the build will not compile until each one is classified. The browse path says
 * so in words meanwhile — see `viewerOwnDefaultsNote` in `browseDisplay.ts`.
 *
 * The catalog list rates (`priceRates.*`) are the app's own arithmetic, in the
 * app's own code, and are not hidden from anyone (decision 21's own note).
 */
export type MoneyClassification = "money" | "not-money";

/**
 * `satisfies` rather than a type annotation on purpose: it enforces
 * exhaustiveness over `keyof ProjectState` (a missing or misspelled key fails
 * the build, by name) while keeping the literal values, so `MoneyStateKey`
 * below can be derived from it instead of restated.
 */
export const MONEY_CLASSIFICATION = {
  // --- the one money field, for schema version 24 ---------------------------
  priceModifier: "money",

  // --- everything else, said explicitly rather than by default --------------
  editorTab: "not-money",
  viewMode: "not-money",
  shapeTool: "not-money",
  footprint: "not-money",
  isBumpedOut: "not-money",
  primaryCornerIds: "not-money",
  offsetPx: "not-money",
  baseWallSlots: "not-money",
  leastAccessibleCorner: "not-money",
  standardWidthIn: "not-money",
  thicknessIn: "not-money",
  densityLbFt3: "not-money",
  wallHeightFt: "not-money",
  maxPanelHeightIn: "not-money",
  includeNailer: "not-money",
  checkedInteriorIds: "not-money",
  checkedExteriorIds: "not-money",
  season: "not-money",
  seismicZone: "not-money",
  foundationTypeId: "not-money",
  pierSpacingFt: "not-money",
  // A design input, and decision 12 already accepted that a browsing company
  // sees which client and place a project is for.
  zipCode: "not-money",
  // Already ignored on a cloud open (Roles, 9): the viewer's own toggle wins.
  role: "not-money",
  unitSystem: "not-money",
  floorSystemId: "not-money",
  perpendicular2x4Enabled: "not-money",
  baleFoundationTopDepthIn: "not-money",
  baleFoundationBottomDepthIn: "not-money",
  baleFoundationGapIn: "not-money",
  baleFoundationFieldSpacingIn: "not-money",
  floorBottomSkinEnabled: "not-money",
  roofSystemTypeId: "not-money",
  roofProfileType: "not-money",
  roofProfilePointHeightsFt: "not-money",
  gableProfilePositionsInByWallId: "not-money",
  gableWindowAnchorsByWallId: "not-money",
  maxGablePanelHeightIn: "not-money",
  trussPlateInsetIn: "not-money",
  heelHeightIn: "not-money",
  roofBearingAnchorMode: "not-money",
  boxBeamCoverageByWallId: "not-money",
  boxBeamSizeId: "not-money",
  midWallBeamsByStoryAndWallId: "not-money",
  // Smearforn Stage 2b. Slot indices, a height and an id — geometry, no
  // price anywhere in it, exactly like the Mid-Wall Bond Beam record above
  // that it mirrors.
  spanningHeadersByStoryAndWallId: "not-money",
  roofCatcherBeamOffsetIn: "not-money",
  roofCatcherBeamShape: "not-money",
  octagonRingDiameterFt: "not-money",
  roofTrussCategory: "not-money",
  selectedClassicTrussId: "not-money",
  highPerfTrussTypeId: "not-money",
  highPerfTrussCavityDepthIn: "not-money",
  highPerfTrussBearingShapeId: "not-money",
  roofTrussSpacingIn: "not-money",
  roofTrussDoublingStrategy: "not-money",
  gableEndWallIds: "not-money",
  gableStructuralPanelWallIds: "not-money",
  stories: "not-money",
  panelizationType: "not-money",
  timberFrameCurtainPanelType: "not-money",
  timberFrameCurtainWidthIn: "not-money",
  nailerOffsetIn: "not-money",
  squareBaleStudConfig: "not-money",
  bracingStyle: "not-money",
  bracedStateSeeded: "not-money",
  projectName: "not-money",
  wallsEnabled: "not-money",
  floorsEnabled: "not-money",
  roofEnabled: "not-money",
  foundationEnabled: "not-money",
  wallRunStopsByWallId: "not-money",
  // Smearforn Stage 3's opening memory: the window/door/column reservations a
  // wall's unbuilt span swallowed, held so un-stopping brings them back. A
  // width, a height, a sill height and a slot ordinal — a remembered window
  // is geometry, and there is no price anywhere in it. Its absence from a
  // redacted document costs a browsing company nothing it was entitled to.
  unbuiltOpeningsByStoryAndWallId: "not-money",
  wallReviewNotes: "not-money",
} as const satisfies Record<keyof ProjectState, MoneyClassification>;

/** The keys classified `money`, as a literal union. Derived, never restated. */
export type MoneyStateKey = {
  [K in keyof typeof MONEY_CLASSIFICATION]: (typeof MONEY_CLASSIFICATION)[K] extends "money" ? K : never;
}[keyof typeof MONEY_CLASSIFICATION];

/**
 * Compile-time: every money field must be a NUMBER, because `NaN` is how the
 * redacted parse path poisons it (a visible `$NaN` beats a plausible 1.0 or
 * 1.3 — spec, "What the client does with a redacted document"). A money field
 * of some other type would need its own decision about what the gap looks
 * like, and this line is what forces that conversation instead of letting
 * `NaN` be assigned to a string.
 */
type MoneyFieldsAreNumbers = ProjectState[MoneyStateKey] extends number ? true : never;
const _moneyFieldsAreNumbers: MoneyFieldsAreNumbers = true;
void _moneyFieldsAreNumbers;

/** Sorted, so every comparison against the migration and the marker is stable. */
export const MONEY_STATE_KEYS: readonly MoneyStateKey[] = (Object.keys(MONEY_CLASSIFICATION) as (keyof typeof MONEY_CLASSIFICATION)[])
  .filter((key): key is MoneyStateKey => MONEY_CLASSIFICATION[key] === "money")
  .sort();

/** `["state.priceModifier"]` — the dotted paths the database's marker names. */
export const MONEY_DOCUMENT_PATHS: readonly string[] = MONEY_STATE_KEYS.map((key) => `state.${key}`);

// ---------------------------------------------------------------------------
// The marker the database adds in place of what it removed
// ---------------------------------------------------------------------------

/**
 * The top-level key `browse_redact` writes beside `schemaVersion` / `savedAt` /
 * `state`. Read off PostgreSQL 17.4 rather than assumed:
 *
 *   "redaction": { "schemaVersion": 24,
 *                  "removedPaths": ["state.priceModifier"],
 *                  "reason": "another company's cost information" }
 *
 * `parseProjectFile` reads only `schemaVersion`, `state` and `savedAt`, so an
 * extra top-level key is ignored by it and NO `PROJECT_FILE_VERSION` BUMP IS
 * NEEDED (Open Item 1, as decided).
 */
export const REDACTION_MARKER_KEY = "redaction";

export interface RedactionMarker {
  schemaVersion: number;
  removedPaths: string[];
  reason: string;
}

/**
 * The marker, or null when the document does not carry a well-formed one.
 *
 * Null is the FAIL-CLOSED answer on the browse path: `browse_version` always
 * adds a marker, so a browsed document without one is a fault, and the caller
 * refuses rather than treating it as an ordinary full document. It never
 * invents a marker, and it never trusts a marker's own claim that a path was
 * removed — `parseRedactedProjectFile` checks the path is genuinely absent.
 */
export function readRedactionMarker(document: unknown): RedactionMarker | null {
  if (!document || typeof document !== "object" || Array.isArray(document)) return null;
  const marker = (document as Record<string, unknown>)[REDACTION_MARKER_KEY];
  if (!marker || typeof marker !== "object" || Array.isArray(marker)) return null;
  const record = marker as Record<string, unknown>;
  if (typeof record.schemaVersion !== "number" || !Number.isInteger(record.schemaVersion)) return null;
  if (!Array.isArray(record.removedPaths) || !record.removedPaths.every((p) => typeof p === "string")) return null;
  if (typeof record.reason !== "string") return null;
  return { schemaVersion: record.schemaVersion, removedPaths: record.removedPaths as string[], reason: record.reason };
}

/**
 * Is this dotted path one this app knows how to open without? Only the paths
 * the classification calls money are, so a marker claiming `state.zipCode` was
 * removed is refused rather than opened with a hole in the design.
 */
export function isRedactablePath(path: string): boolean {
  return MONEY_DOCUMENT_PATHS.includes(path);
}
