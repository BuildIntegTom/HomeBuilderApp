import { afterEach, describe, expect, it, vi } from "vitest";
import { PROJECT_FILE_VERSION, parseProjectFile, serializeProject, type ProjectState } from "./projectFile";
import { resolveTitleBlockDate, titleBlockDateLabel } from "./titleBlockDate";

function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    editorTab: "wall",
    viewMode: "plan",
    shapeTool: "rectangle",
    footprint: {
      corners: [
        { id: "A", point: { x: 0, y: 0 } },
        { id: "B", point: { x: 20, y: 0 } },
      ],
      walls: [{ id: "AB", startCorner: "A", endCorner: "B", lengthFt: 20 }],
    },
    isBumpedOut: false,
    primaryCornerIds: new Set(["A", "B"]),
    offsetPx: { x: 60, y: 60 },
    baseWallSlots: {
      AB: [
        { type: "standard", widthIn: 40 },
        { type: "braced", widthIn: 40, bracedPattern: "hatch", bracedMirrored: true },
      ],
    },
    leastAccessibleCorner: "A",
    standardWidthIn: 40,
    thicknessIn: 15.5,
    densityLbFt3: 7,
    wallHeightFt: 10,
    includeNailer: false,
    checkedInteriorIds: new Set(["intello-plus"]),
    checkedExteriorIds: new Set(["mento"]),
    season: "winter",
    seismicZone: "moderate",
    foundationTypeId: "vented-crawlspace-helical",
    pierSpacingFt: 8,
    zipCode: "97201",
    role: "fabricator",
    unitSystem: "imperial",
    priceModifier: 1.3,
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
    gableEndWallIds: new Set(),
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
    projectName: "Untitled Project",
    wallsEnabled: true,
    floorsEnabled: false,
    roofEnabled: false,
    wallReviewNotes: [{ id: "note-1", wallId: "AB", author: "Eng. Smith", note: "Confirm rim joist connection detailing." }],
    ...overrides,
  };
}

describe("serializeProject / parseProjectFile round-trip", () => {
  it("round-trips every field, converting primaryCornerIds through an array", () => {
    const state = makeState();
    const file = serializeProject(state);
    expect(file.schemaVersion).toBe(PROJECT_FILE_VERSION);
    expect(file.state.primaryCornerIds).toEqual(["A", "B"]);

    const result = parseProjectFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.primaryCornerIds).toBeInstanceOf(Set);
    expect([...result.state.primaryCornerIds]).toEqual(["A", "B"]);
    expect(result.state).toEqual(state);
  });

  it("round-trips a null footprint (nothing drawn yet)", () => {
    const state = makeState({ footprint: null, primaryCornerIds: new Set() });
    const result = parseProjectFile(JSON.stringify(serializeProject(state)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.footprint).toBeNull();
    expect(result.state.primaryCornerIds.size).toBe(0);
  });

  it("always stamps bracedStateSeeded: true on save, even if the in-memory state being saved didn't have it set", () => {
    // Simulates an in-memory state that originated from an old
    // (pre-migration) load, before page.tsx's own load handler had a
    // chance to seed it.
    const state = makeState();
    delete state.bracedStateSeeded;
    const file = serializeProject(state);
    expect(file.state.bracedStateSeeded).toBe(true);
  });

  it("parses an old-format file with no bracedStateSeeded field at all (the actual pre-migration shape) without error", () => {
    const file = serializeProject(makeState());
    const { bracedStateSeeded: _drop, ...oldFormatState } = file.state;
    const result = parseProjectFile(JSON.stringify({ ...file, state: oldFormatState }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Absent, not defaulted — parseProjectFile itself doesn't run the
    // migration seed pass (that's page.tsx's own load-handler job, since
    // it needs reconcileBracedPlacement + the project's own seismic
    // settings, not something this file-format layer should own).
    expect(result.state.bracedStateSeeded).toBeUndefined();
  });

  it("round-trips a 2-entry stories array (ground + second story)", () => {
    const state = makeState({
      stories: [
        { id: "ground", label: "Ground Floor", wallHeightFt: 10, wallSlots: { AB: [{ type: "standard", widthIn: 40 }] } },
        { id: "second", label: "Second Story", wallHeightFt: 9, wallSlots: { AB: [{ type: "window", widthIn: 40 }] } },
      ],
    });
    const result = parseProjectFile(JSON.stringify(serializeProject(state)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.stories).toEqual(state.stories);
  });
});

describe("v23 -> v24 migration (every stored length onto the 1/8in grid)", () => {
  /** A real 30x20 rectangle, so corner ownership and butt-joint insets are
   * the genuine ones rather than a degenerate 2-corner fixture's.
   *
   * Wall AB here loses its corner at BOTH ends to its two shorter neighbours,
   * so `wallGeometryFor(...).lengthIn` is 360 - 2 x 15.5 = **329in**. Worth
   * stating outright, because the file's OTHER fixture — `makeState()`'s
   * default two-corner footprint — gives wall AB a length of **240in** with no
   * insets at all, and the two are easy to confuse when reading a residual. */
  const rectangleFootprint = {
    corners: [
      { id: "A", point: { x: 0, y: 0 } },
      { id: "B", point: { x: 30, y: 0 } },
      { id: "C", point: { x: 30, y: 20 } },
      { id: "D", point: { x: 0, y: 20 } },
    ],
    walls: [
      { id: "AB", startCorner: "A", endCorner: "B", lengthFt: 30 },
      { id: "BC", startCorner: "B", endCorner: "C", lengthFt: 20 },
      { id: "CD", startCorner: "C", endCorner: "D", lengthFt: 30 },
      { id: "DA", startCorner: "D", endCorner: "A", lengthFt: 20 },
    ],
  };

  /** Builds a raw v23-shaped file. v23 and v24 have the identical SHAPE —
   * v23->v24 changes only values — so a v23 file is a current serialization
   * with the version number rolled back. */
  function makeV23File(overrides: Partial<ProjectState> = {}) {
    const currentState = serializeProject(makeState(overrides)).state;
    return { schemaVersion: 23, savedAt: new Date().toISOString(), state: currentState };
  }

  /** Wall AB of the rectangle above loses a corner at each end to its two
   * shorter neighbours, so its tiled length is 360 - 2 x thickness. These
   * widths sum to exactly that, but two of them sit on a SIXTEENTH — the
   * literal output of the pre-fix `(standardWidthIn + remainderIn) / 2`. */
  const offGridSlots = [
    { type: "standard" as const, widthIn: 23.5625 },
    { type: "standard" as const, widthIn: 23.5625 },
    { type: "standard" as const, widthIn: 281.875 },
  ];

  function loadWithOffGridWall(extraOverrides: Partial<ProjectState> = {}) {
    const file = makeV23File({
      footprint: rectangleFootprint,
      primaryCornerIds: new Set(["A", "B", "C", "D"]),
      leastAccessibleCorner: "A",
      thicknessIn: 15.5,
      baseWallSlots: { AB: offGridSlots },
      stories: [{ id: "ground" as const, label: "Ground Floor", wallHeightFt: 10, wallSlots: { AB: offGridSlots } }],
      ...extraOverrides,
    });
    return parseProjectFile(JSON.stringify(file));
  }

  it("puts every slot width on the 1/8in grid, summing exactly to the wall's own length", () => {
    const result = loadWithOffGridWall();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const repaired = result.state.baseWallSlots.AB!;
    for (const slot of repaired) {
      expect(Math.abs(slot.widthIn * 8 - Math.round(slot.widthIn * 8))).toBeLessThan(1e-9);
      expect(slot.widthIn).toBeGreaterThanOrEqual(0);
    }
    // Integer eighths, not toBeCloseTo — a tolerance would pass on exactly the
    // defect this migration exists to repair.
    const sumEighths = repaired.reduce((sum, slot) => sum + Math.round(slot.widthIn * 8), 0);
    expect(sumEighths).toBe(Math.round((30 * 12 - 2 * 15.5) * 8));
  });

  it("repairs the second story's own wallSlots too, not just baseWallSlots", () => {
    const result = loadWithOffGridWall();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const slot of result.state.stories[0]!.wallSlots.AB!) {
      expect(Math.abs(slot.widthIn * 8 - Math.round(slot.widthIn * 8))).toBeLessThan(1e-9);
    }
  });

  it("is a REPAIR, not a re-tile — slot count, order and types all survive", () => {
    const result = loadWithOffGridWall();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const repaired = result.state.baseWallSlots.AB!;
    expect(repaired).toHaveLength(offGridSlots.length);
    expect(repaired.map((s) => s.type)).toEqual(offGridSlots.map((s) => s.type));
    // Nothing moved more than its own rounding plus one eighth.
    repaired.forEach((slot, i) => {
      expect(Math.abs(slot.widthIn - offGridSlots[i]!.widthIn)).toBeLessThanOrEqual(1 / 16 + 0.125);
    });
  });

  it("keeps a manual panel-mover adjustment (lockedWidthIn), repairing it onto the grid", () => {
    // The whole reason this is a repair rather than a re-tile: a re-tile would
    // discard this.
    const locked = [
      { type: "standard" as const, widthIn: 23.5625, lockedWidthIn: 23.5625 },
      { type: "standard" as const, widthIn: 23.5625 },
      { type: "standard" as const, widthIn: 281.875 },
    ];
    const result = loadWithOffGridWall({ baseWallSlots: { AB: locked } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.baseWallSlots.AB![0]!.lockedWidthIn).toBe(23.625);
  });

  it("snaps footprint corners onto the grid and recomputes wall lengths from them", () => {
    const drifted = {
      corners: [
        { id: "A", point: { x: 0, y: 0 } },
        { id: "B", point: { x: 30.007, y: 0 } },
        { id: "C", point: { x: 30.007, y: 20.004 } },
        { id: "D", point: { x: 0, y: 20.004 } },
      ],
      walls: [
        { id: "AB", startCorner: "A", endCorner: "B", lengthFt: 30.007 },
        { id: "BC", startCorner: "B", endCorner: "C", lengthFt: 20.004 },
        { id: "CD", startCorner: "C", endCorner: "D", lengthFt: 30.007 },
        { id: "DA", startCorner: "D", endCorner: "A", lengthFt: 20.004 },
      ],
    };
    const result = parseProjectFile(JSON.stringify(makeV23File({ footprint: drifted, baseWallSlots: {}, stories: [] })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const wall of result.state.footprint!.walls) {
      expect(Math.abs(wall.lengthFt * 12 * 8 - Math.round(wall.lengthFt * 12 * 8))).toBeLessThan(1e-9);
    }
  });

  it("does not stretch a wall whose slots were never a tiling of it", () => {
    // The guard, on `rectangleFootprint` (so the target is 329in — see that
    // fixture's own comment): two 40in panels totalling 80in is not a
    // rounding residual of a 329in wall, so the repair works against the
    // wall's own stored total instead of inventing 249in of panel width.
    const result = loadWithOffGridWall({
      baseWallSlots: { AB: [{ type: "standard", widthIn: 40 }, { type: "standard", widthIn: 40 }] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.baseWallSlots.AB!.map((s) => s.widthIn)).toEqual([40, 40]);
  });

  /** Wall AB of `rectangleFootprint`, exactly as `tileWall(329, 40, 25.5,
   * ...)` produces it: 10 slots summing to precisely 329in, every width
   * already a whole eighth. */
  const genuinelyTiledSlots = [
    { type: "standard" as const, widthIn: 40 },
    { type: "standard" as const, widthIn: 40 },
    { type: "standard" as const, widthIn: 40 },
    { type: "standard" as const, widthIn: 40 },
    { type: "standard" as const, widthIn: 40 },
    { type: "standard" as const, widthIn: 40 },
    { type: "standard" as const, widthIn: 24.125 },
    { type: "standard" as const, widthIn: 24.125 },
    { type: "safety-gap" as const, widthIn: 0.75 },
    { type: "standard" as const, widthIn: 40 },
  ];

  it("is a true no-op on a genuinely tiled wall — the residual is zero, not merely guarded", () => {
    // This is the one that actually exercises the NO-OP branch. Every other
    // round-trip in this file uses makeState()'s degenerate 2-corner footprint
    // (80in of slots on a 240in wall), so they reach the same unchanged result
    // via the GUARD instead, and would keep passing if the no-op path broke.
    const result = parseProjectFile(
      JSON.stringify(
        makeV23File({
          footprint: rectangleFootprint,
          primaryCornerIds: new Set(["A", "B", "C", "D"]),
          leastAccessibleCorner: "A",
          thicknessIn: 15.5,
          baseWallSlots: { AB: genuinelyTiledSlots },
          stories: [{ id: "ground" as const, label: "Ground Floor", wallHeightFt: 10, wallSlots: { AB: genuinelyTiledSlots } }],
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The precondition that makes this the no-op branch rather than the guard:
    // the stored widths already sum to the wall's own tiled length.
    expect(genuinelyTiledSlots.reduce((sum, s) => sum + s.widthIn, 0)).toBe(329);
    expect(result.state.baseWallSlots.AB).toEqual(genuinelyTiledSlots);
    expect(result.state.stories[0]!.wallSlots.AB).toEqual(genuinelyTiledSlots);
  });

  it("leaves an already-quantized current-version file completely alone", () => {
    const state = makeState();
    const result = parseProjectFile(JSON.stringify(serializeProject(state)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.baseWallSlots).toEqual(state.baseWallSlots);
    expect(result.state.stories).toEqual(state.stories);
  });

  it("passes a v23 beam through untouched — v23->v24 changes no beam field", () => {
    const beams = {
      ground: { AB: [{ id: "beam-1", heightIn: 60, sizeId: "9x2-lvl" as const, kind: "box-beam" as const, startSlotIndex: 0, endSlotIndex: 3 }] },
      second: {},
    };
    const result = parseProjectFile(JSON.stringify(makeV23File({ midWallBeamsByStoryAndWallId: beams })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.midWallBeamsByStoryAndWallId.ground.AB).toEqual(beams.ground.AB);
  });

  it("now rejects v22, which has fallen out of the one-version-back window", () => {
    const v22File = { ...makeV23File(), schemaVersion: 22 };
    const result = parseProjectFile(JSON.stringify(v22File));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/version/i);
  });
});

describe("savedAt -> title-block date", () => {
  afterEach(() => vi.useRealTimers());

  it("a file saved at T and reloaded later resolves to T, not the load time", () => {
    const savedAtT = new Date("2025-03-14T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(savedAtT);
    const raw = JSON.stringify(serializeProject(makeState()));

    vi.setSystemTime(new Date("2026-09-13T15:00:00.000Z"));
    const result = parseProjectFile(raw);
    if (!result.ok) throw new Error(result.error);
    expect(result.savedAt).toBe(savedAtT.toISOString());

    const resolved = resolveTitleBlockDate({ lastSave: { savedAt: result.savedAt, source: "local-file" }, now: new Date() });
    expect(resolved.source).toBe("local-file");
    expect(resolved.date?.getTime()).toBe(savedAtT.getTime());
  });

  it("carries savedAt through a v23 file that goes through the v23 -> v24 repair", () => {
    const file = { ...serializeProject(makeState()), schemaVersion: PROJECT_FILE_VERSION - 1, savedAt: "2025-01-02T12:00:00.000Z" };
    const result = parseProjectFile(JSON.stringify(file));
    if (!result.ok) throw new Error(result.error);
    expect(result.savedAt).toBe("2025-01-02T12:00:00.000Z");
  });

  /** Load a file, then resolve its title-block date exactly as page.tsx does. */
  function loadAndLabel(file: object) {
    const result = parseProjectFile(JSON.stringify(file));
    if (!result.ok) throw new Error(result.error);
    const resolved = resolveTitleBlockDate({ lastSave: { savedAt: result.savedAt, source: "local-file" }, now: new Date("2026-09-13T15:00:00.000Z") });
    return { result, resolved, label: titleBlockDateLabel(resolved) };
  }

  it('still loads a file with no savedAt, and its sheet prints "Date not recorded" rather than today', () => {
    const { savedAt: _dropped, ...withoutSavedAt } = serializeProject(makeState());
    const { result, resolved, label } = loadAndLabel(withoutSavedAt);
    expect(result.savedAt).toBeUndefined();
    expect(resolved.source).toBe("local-file-unrecorded");
    expect(label).toBe("Date not recorded");
  });

  it("still loads a file whose savedAt is not a string, and prints Date not recorded", () => {
    const { result, label } = loadAndLabel({ ...serializeProject(makeState()), savedAt: 12345 });
    expect(result.savedAt).toBeUndefined();
    expect(label).toBe("Date not recorded");
  });

  it.each([["2025"], ["0"], ["not a date"], ["2025-02-30"], ["2025-03-14T12:00:00"]])(
    'loads a file with hand-written savedAt "%s" and prints Date not recorded',
    (savedAt) => {
      const { result, resolved, label } = loadAndLabel({ ...serializeProject(makeState()), savedAt });
      expect(result.savedAt).toBe(savedAt);
      expect(resolved.source).toBe("local-file-unrecorded");
      expect(label).toBe("Date not recorded");
    },
  );

  it('loads a file with hand-written date-only savedAt "2025-03-14" as that local calendar day', () => {
    const { resolved } = loadAndLabel({ ...serializeProject(makeState()), savedAt: "2025-03-14" });
    expect(resolved.source).toBe("local-file");
    expect([resolved.date?.getFullYear(), resolved.date?.getMonth(), resolved.date?.getDate()]).toEqual([2025, 2, 14]);
  });
});

describe("parseProjectFile rejecting malformed input", () => {
  it("rejects invalid JSON", () => {
    const result = parseProjectFile("{not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/valid JSON/i);
  });

  it("rejects a JSON value that isn't an object", () => {
    const result = parseProjectFile("42");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/JSON object/i);
  });

  it("rejects a mismatched schema version", () => {
    const result = parseProjectFile(JSON.stringify({ schemaVersion: 999, state: {} }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/version/i);
  });

  it("rejects a file missing the state object", () => {
    const result = parseProjectFile(JSON.stringify({ schemaVersion: PROJECT_FILE_VERSION }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/project state/i);
  });

  it("rejects a state object missing a required field", () => {
    const file = serializeProject(makeState());
    const { standardWidthIn: _drop, ...incompleteState } = file.state;
    const result = parseProjectFile(JSON.stringify({ ...file, state: incompleteState }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/standardWidthIn/);
  });

  it("rejects a state whose primaryCornerIds isn't a list", () => {
    const file = serializeProject(makeState());
    const result = parseProjectFile(JSON.stringify({ ...file, state: { ...file.state, primaryCornerIds: "A,B" } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/primaryCornerIds/);
  });
});
