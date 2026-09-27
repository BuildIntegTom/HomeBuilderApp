import { afterEach, describe, expect, it, vi } from "vitest";
import { PROJECT_FILE_VERSION, parseProjectFile, serializeProject, type ProjectState } from "../projectFile";
import { projectFileText } from "./companyBackup";
import { REDACTION_MARKER_KEY, readRedactionMarker } from "./redaction";

/**
 * Stage 5, second slice — THE ACCEPTANCE CRITERION FOR A BACKUP FILE.
 * Spec: "Stage 5 plan — second slice: THE PLATFORM-WIDE BACKUP", section 2
 * ("Restorability is the promise now, so it gets a named acceptance criterion").
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * Tommy's condition on a cross-company backup was that the files "can
 * repopulate the actual building structure". A backup you cannot restore from
 * is not a backup; it is a listing. So the one thing the artifact exists to
 * deliver gets a test of its own, with no database, no route and no browser in
 * it: a document written the way the zip writes it is read back by the SAME
 * strict parser the file picker uses, and it comes back as the same building.
 *
 * ── AND WHY THE NEGATIVE CONTROL IS LOAD-BEARING, NOT DECORATION ────────────
 *
 * Redacting the cross-company half of a backup was chosen first and then
 * REVERSED ON EVIDENCE: `priceModifier` is in `REQUIRED_STATE_KEYS`, so
 * `parseProjectFile` refuses a redacted document outright, and the file picker
 * uses that strict parser. A redacted backup file would therefore not open at
 * all — not "open with a gap". `describe("the negative control")` below is that
 * fact, pinned. It must keep failing for a document with `priceModifier`
 * removed, so a later pass cannot reintroduce a redaction here and believe the
 * files still open. IT IS NOT A TEST OF THE REDACTOR; `browse_redact` and
 * `parseRedactedProjectFile` are untouched by this slice and stay exactly as
 * they are for the browse path.
 *
 * ── WHAT IT DOES NOT CLAIM ─────────────────────────────────────────────────
 *
 * ⚠ THE CLAIM IS ABOUT TODAY'S FILE FORMAT, v25. A later format bump must
 * re-run this. `classifyCloudSchemaVersion` is what already tells a manifest
 * which stored versions fall outside this app's window; those are included raw
 * and marked `opensWithLoadProject: false`, and that field's ONLY reason to be
 * false is the format window.
 */

/**
 * A whole, real project state — the same shape `serializeProject` writes to a
 * file and to the cloud, built by hand rather than imported so that this test
 * keeps describing a complete building as `ProjectState` grows.
 *
 * ⚠ EVERY NUMBER BELOW IS AN ARBITRARY FIXTURE VALUE, not a building figure and
 * not a catalog value. This test reads only whether values SURVIVE A ROUND
 * TRIP; nothing here is a claim about a real thickness, density, spacing,
 * height or price, and none of it is provisional in the flag convention's
 * sense. (`projectFile.test.ts`'s `makeState` and `redaction.test.ts`'s state
 * are the same kind of fixture.)
 *
 * Two properties are deliberate rather than incidental:
 *  - every width and height is already a whole eighth of an inch, so
 *    `repairStateToEighths` (which every load runs, unconditionally) has
 *    nothing to move and a deep-equality assertion means what it says;
 *  - `priceModifier` is a value that appears nowhere else in the fixture, so
 *    "the margin survived" is checkable as text and not just as a key.
 */
const FIXTURE_PRICE_MODIFIER = 1.3777;

function makeRestorableState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    editorTab: "wall",
    viewMode: "plan",
    shapeTool: "rectangle",
    footprint: {
      corners: [
        { id: "A", point: { x: 0, y: 0 } },
        { id: "B", point: { x: 24, y: 0 } },
        { id: "C", point: { x: 24, y: 16 } },
        { id: "D", point: { x: 0, y: 16 } },
      ],
      walls: [
        { id: "AB", startCorner: "A", endCorner: "B", lengthFt: 24 },
        { id: "BC", startCorner: "B", endCorner: "C", lengthFt: 16 },
        { id: "CD", startCorner: "C", endCorner: "D", lengthFt: 24 },
        { id: "DA", startCorner: "D", endCorner: "A", lengthFt: 16 },
      ],
    },
    isBumpedOut: false,
    primaryCornerIds: new Set(["A", "C"]),
    offsetPx: { x: 60, y: 60 },
    baseWallSlots: {
      AB: [
        { type: "standard", widthIn: 40 },
        { type: "braced", widthIn: 40, bracedPattern: "hatch", bracedMirrored: true },
      ],
      BC: [{ type: "standard", widthIn: 40 }],
      CD: [{ type: "standard", widthIn: 40 }],
      DA: [{ type: "standard", widthIn: 40 }],
    },
    leastAccessibleCorner: "A",
    standardWidthIn: 40,
    thicknessIn: 15.5,
    densityLbFt3: 7,
    wallHeightFt: 10,
    includeNailer: false,
    checkedInteriorIds: new Set(["intello-plus", "membrain"]),
    checkedExteriorIds: new Set(["mento"]),
    season: "winter",
    seismicZone: "moderate",
    foundationTypeId: "vented-crawlspace-helical",
    pierSpacingFt: 8,
    zipCode: "65201",
    role: "fabricator",
    unitSystem: "imperial",
    // The one price-shaped value in the fixture. It is copied, never computed.
    priceModifier: FIXTURE_PRICE_MODIFIER,
    floorSystemId: null,
    perpendicular2x4Enabled: false,
    baleFoundationTopDepthIn: 5.5,
    baleFoundationBottomDepthIn: 5.5,
    baleFoundationGapIn: 1.5,
    baleFoundationFieldSpacingIn: 16,
    floorBottomSkinEnabled: true,
    roofSystemTypeId: "truss",
    roofProfileType: "peaked",
    roofProfilePointHeightsFt: [16],
    gableProfilePositionsInByWallId: {},
    gableWindowAnchorsByWallId: {},
    maxGablePanelHeightIn: 96,
    maxPanelHeightIn: 120,
    trussPlateInsetIn: 5.5,
    heelHeightIn: 6,
    roofBearingAnchorMode: "truss-heel",
    boxBeamCoverageByWallId: {},
    boxBeamSizeId: "9x2-lvl",
    midWallBeamsByStoryAndWallId: { ground: {}, second: {} },
    roofCatcherBeamOffsetIn: 11.25,
    roofCatcherBeamShape: "Built-up 2-ply 2x12",
    octagonRingDiameterFt: 3,
    roofTrussCategory: "classic",
    selectedClassicTrussId: "king-post",
    highPerfTrussTypeId: "energy-heel",
    highPerfTrussCavityDepthIn: 18,
    highPerfTrussBearingShapeId: "built-up-3ply-2x12",
    roofTrussSpacingIn: 24,
    roofTrussDoublingStrategy: "single",
    gableEndWallIds: new Set(["BC"]),
    gableStructuralPanelWallIds: new Set(),
    stories: [
      {
        id: "ground",
        label: "Ground Floor",
        wallHeightFt: 10,
        wallSlots: {
          AB: [
            { type: "standard", widthIn: 40 },
            { type: "braced", widthIn: 40, bracedPattern: "hatch", bracedMirrored: true },
          ],
          BC: [{ type: "standard", widthIn: 40 }],
          CD: [{ type: "standard", widthIn: 40 }],
          DA: [{ type: "standard", widthIn: 40 }],
        },
      },
    ],
    panelizationType: "loose-packed-braced",
    timberFrameCurtainPanelType: "standard",
    timberFrameCurtainWidthIn: 36,
    nailerOffsetIn: 0,
    squareBaleStudConfig: "single-2x4",
    bracingStyle: "chevron",
    bracedStateSeeded: true,
    projectName: "Rogers-Sehorn ADU",
    wallsEnabled: true,
    floorsEnabled: false,
    roofEnabled: true,
    foundationEnabled: false,
    wallRunStopsByWallId: {},
    wallReviewNotes: [{ id: "note-1", wallId: "AB", author: "Eng. Smith", note: "Confirm rim joist connection detailing." }],
    ...overrides,
  };
}

/** The clock the fixture's `savedAt` is taken from, so it can be asserted verbatim. */
const SAVED_AT = "2026-09-27T14:02:05.000Z";

/**
 * A stored `ProjectFile` and the exact text the zip would hold for it. The
 * second step is the load-bearing one: `projectFileText` is what
 * `collectCompanyBackup` calls, so the bytes under test are the bytes in the
 * archive and not a re-serialization of them.
 */
function writeAsBackupFile(state: ProjectState): { document: ReturnType<typeof serializeProject>; text: string } {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(SAVED_AT));
  try {
    const document = serializeProject(state);
    return { document, text: projectFileText(document) };
  } finally {
    vi.useRealTimers();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("a backup file reloads into the same building", () => {
  it("parses with the STRICT parser the file picker uses — no excused keys, no redacted path", () => {
    const { text } = writeAsBackupFile(makeRestorableState());
    const result = parseProjectFile(text);
    // Named rather than asserted through `result.ok &&`: a refusal must show
    // its message here, because the message is what a person would see.
    expect(result.ok ? null : result.error).toBeNull();
    expect(result.ok).toBe(true);
  });

  it("round-trips the whole state, priceModifier included", () => {
    const state = makeRestorableState();
    const { text } = writeAsBackupFile(state);
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error);

    // The margin, on its own and first: this is the field whose absence from a
    // redacted document is what killed the redaction.
    expect(result.state.priceModifier).toBe(FIXTURE_PRICE_MODIFIER);
    expect(text).toContain(String(FIXTURE_PRICE_MODIFIER));

    // The whole building. `toEqual` compares Sets structurally, and the four
    // Set-valued keys are ALSO compared explicitly below, because
    // "checkedInteriorIds came back as an array" is exactly the kind of
    // failure a whole-object matcher can be talked out of.
    expect(result.state).toEqual(state);
  });

  it("brings the four Set-valued keys back AS SETS, with the same members", () => {
    const state = makeRestorableState();
    const { text } = writeAsBackupFile(state);
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error);

    const setKeys = ["primaryCornerIds", "gableEndWallIds", "checkedInteriorIds", "checkedExteriorIds"] as const;
    for (const key of setKeys) {
      const parsed = result.state[key];
      expect(parsed, key).toBeInstanceOf(Set);
      expect([...(parsed as Set<string>)].sort(), key).toEqual([...(state[key] as Set<string>)].sort());
    }
    // JSON has no Set type, so the file itself must hold arrays — which is why
    // the assertion above is about the PARSE and not about the text.
    const onDisk = JSON.parse(text) as { state: Record<string, unknown> };
    for (const key of setKeys) expect(Array.isArray(onDisk.state[key]), key).toBe(true);
  });

  it("keeps savedAt verbatim, so a restored file's title block shows the date it was saved", () => {
    const { document, text } = writeAsBackupFile(makeRestorableState());
    expect(document.savedAt).toBe(SAVED_AT);
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error);
    expect(result.savedAt).toBe(SAVED_AT);
  });

  it("carries no redaction marker of any kind", () => {
    const { document, text } = writeAsBackupFile(makeRestorableState());
    expect(readRedactionMarker(document)).toBeNull();
    expect(text).not.toContain(REDACTION_MARKER_KEY);
  });

  it("is written at the app's current file-format version", () => {
    const { document } = writeAsBackupFile(makeRestorableState());
    expect(document.schemaVersion).toBe(PROJECT_FILE_VERSION);
  });

  it("is 2-space JSON, exactly as Save Project writes a file", () => {
    const { document, text } = writeAsBackupFile(makeRestorableState());
    expect(text).toBe(JSON.stringify(document, null, 2));
    expect(text.split("\n")[1]?.startsWith("  ")).toBe(true);
  });
});

describe("the negative control: WHY the redaction was abandoned", () => {
  /**
   * Removing `state.priceModifier` and nothing else is exactly what
   * `browse_redact` does to a cross-company document (its `removedPaths` is
   * `["state.priceModifier"]`). The assertion is that such a file DOES NOT
   * OPEN — refused by name, not opened with a gap.
   *
   * ⚠ If a later pass makes this test pass with the key removed, that pass has
   * reintroduced a redaction into the backup and the files no longer open.
   * Do not relax it; change the design instead.
   */
  function withoutPriceModifier(text: string): string {
    const parsed = JSON.parse(text) as { state: Record<string, unknown> };
    delete parsed.state.priceModifier;
    return JSON.stringify(parsed, null, 2);
  }

  it("a document with priceModifier removed is REFUSED by parseProjectFile", () => {
    const { text } = writeAsBackupFile(makeRestorableState());
    const redactedLike = withoutPriceModifier(text);
    expect(redactedLike).not.toContain("priceModifier");

    const result = parseProjectFile(redactedLike);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toBe('That file is missing the "priceModifier" field.');
  });

  it("and the SAME document with the key present opens — so the refusal is about the key, not the fixture", () => {
    const { text } = writeAsBackupFile(makeRestorableState());
    expect(parseProjectFile(text).ok).toBe(true);
    expect(parseProjectFile(withoutPriceModifier(text)).ok).toBe(false);
  });
});
