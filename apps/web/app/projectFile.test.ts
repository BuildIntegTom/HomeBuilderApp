import { describe, expect, it } from "vitest";
import { PROJECT_FILE_VERSION, parseProjectFile, serializeProject, type ProjectState } from "./projectFile";

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
    roofSystemTypeId: "truss",
    roofProfileType: "peaked",
    roofProfilePointHeightsFt: [16],
    gableProfilePositionsInByWallId: {},
    maxGablePanelHeightIn: 96,
    trussPlateInsetIn: 5.5,
    heelHeightIn: 6,
    boxBeamCoverageByWallId: {},
    boxBeamSizeId: "9x2-lvl",
    midWallBeamsByStoryAndWallId: { ground: {}, second: {} },
    roofCatcherBeamOffsetIn: 11.25,
    roofCatcherBeamShape: "Built-up 2-ply 2x12",
    octagonRingDiameterFt: 3,
    gableEndWallIds: new Set(),
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

describe("v20 -> v21 migration (midWallBeamsByStoryAndWallId: single beam -> array)", () => {
  /** Builds a raw v20-shaped file (midWallBeamsByStoryAndWallId's own
   * per-wall value swapped back to a single beam object — no id, no
   * coverage range, exactly Stage 1's shape) directly from a real
   * serialized current state. */
  function makeV20File(
    midWallBeamsByStoryAndWallId: Record<"ground" | "second", Record<string, { heightIn: number; sizeId: string }>>,
    overrides: Partial<ProjectState> = {},
  ) {
    const currentState = serializeProject(makeState(overrides)).state;
    return {
      schemaVersion: 20,
      savedAt: new Date().toISOString(),
      state: { ...currentState, midWallBeamsByStoryAndWallId },
    };
  }

  it("migrates a ground-floor beam to a 1-element array with full-width coverage from baseWallSlots", () => {
    const result = parseProjectFile(
      JSON.stringify(
        makeV20File({ ground: { AB: { heightIn: 60, sizeId: "9x2-lvl" } }, second: {} }, { baseWallSlots: { AB: [{ type: "standard", widthIn: 40 }, { type: "standard", widthIn: 40 }, { type: "standard", widthIn: 40 }] } }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const beams = result.state.midWallBeamsByStoryAndWallId.ground.AB;
    expect(beams).toHaveLength(1);
    expect(beams![0]).toMatchObject({ heightIn: 60, sizeId: "9x2-lvl", startSlotIndex: 0, endSlotIndex: 3 });
    expect(typeof beams![0]!.id).toBe("string");
    expect(beams![0]!.id.length).toBeGreaterThan(0);
  });

  it("migrates a second-story beam's endSlotIndex from stories[1].wallSlots, NOT baseWallSlots (the swap trap)", () => {
    const result = parseProjectFile(
      JSON.stringify(
        makeV20File(
          { ground: {}, second: { AB: { heightIn: 30, sizeId: "2x10-dimensional" } } },
          {
            baseWallSlots: { AB: [{ type: "standard", widthIn: 40 }] }, // 1 slot — must NOT be used for the second-story beam
            stories: [
              { id: "ground", label: "Ground Floor", wallHeightFt: 10, wallSlots: { AB: [{ type: "standard", widthIn: 40 }] } },
              {
                id: "second",
                label: "Second Story",
                wallHeightFt: 9,
                wallSlots: { AB: [{ type: "standard", widthIn: 40 }, { type: "standard", widthIn: 40 }] },
              },
            ],
          },
        ),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const beams = result.state.midWallBeamsByStoryAndWallId.second.AB;
    expect(beams).toHaveLength(1);
    expect(beams![0]).toMatchObject({ heightIn: 30, sizeId: "2x10-dimensional", startSlotIndex: 0, endSlotIndex: 2 });
  });

  it("migrates beams on both stories for the same wall id independently", () => {
    const result = parseProjectFile(
      JSON.stringify(
        makeV20File(
          {
            ground: { AB: { heightIn: 60, sizeId: "9x2-lvl" } },
            second: { AB: { heightIn: 30, sizeId: "2x8-dimensional" } },
          },
          {
            baseWallSlots: { AB: [{ type: "standard", widthIn: 40 }] },
            stories: [
              { id: "ground", label: "Ground Floor", wallHeightFt: 10, wallSlots: { AB: [{ type: "standard", widthIn: 40 }] } },
              {
                id: "second",
                label: "Second Story",
                wallHeightFt: 9,
                wallSlots: { AB: [{ type: "standard", widthIn: 40 }, { type: "standard", widthIn: 40 }] },
              },
            ],
          },
        ),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.midWallBeamsByStoryAndWallId.ground.AB![0]).toMatchObject({ endSlotIndex: 1 });
    expect(result.state.midWallBeamsByStoryAndWallId.second.AB![0]).toMatchObject({ endSlotIndex: 2 });
    expect(result.state.midWallBeamsByStoryAndWallId.ground.AB![0]!.id).not.toBe(result.state.midWallBeamsByStoryAndWallId.second.AB![0]!.id);
  });

  it("migrates a wall with zero slots in that story to endSlotIndex: 0 without throwing", () => {
    const result = parseProjectFile(
      JSON.stringify(makeV20File({ ground: { XY: { heightIn: 60, sizeId: "9x2-lvl" } }, second: {} }, { baseWallSlots: {} })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.midWallBeamsByStoryAndWallId.ground.XY![0]).toMatchObject({ startSlotIndex: 0, endSlotIndex: 0 });
  });

  it("leaves every other field (e.g. boxBeamCoverageByWallId) untouched by this migration", () => {
    const result = parseProjectFile(
      JSON.stringify(makeV20File({ ground: {}, second: {} }, { boxBeamCoverageByWallId: { AB: { startSlotIndex: 0, endSlotIndex: 2 } } })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.boxBeamCoverageByWallId).toEqual({ AB: { startSlotIndex: 0, endSlotIndex: 2 } });
  });

  it("still rejects a version older than the one-version-back migration window (v19, 2 versions back)", () => {
    const v19File = { ...makeV20File({ ground: {}, second: {} }), schemaVersion: 19 };
    const result = parseProjectFile(JSON.stringify(v19File));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/version/i);
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
