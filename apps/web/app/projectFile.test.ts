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
    boxBeamWallIds: new Set(),
    boxBeamSizeId: "9x2-lvl",
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

describe("v17 -> v18 migration (boxBeamWallIds/boxBeamSizeId)", () => {
  /** Builds a raw v17-shaped file (no boxBeamWallIds/boxBeamSizeId fields at
   * all) directly — bypassing serializeProject/ProjectState entirely, since
   * a v17 caller by definition doesn't have the current TS types
   * available. */
  function makeV17File(overrides: Partial<ProjectState> = {}) {
    const currentState = serializeProject(makeState(overrides)).state;
    const { boxBeamWallIds: _drop1, boxBeamSizeId: _drop2, ...v17State } = currentState;
    return {
      schemaVersion: 17,
      savedAt: new Date().toISOString(),
      state: v17State,
    };
  }

  it("migrates a 2-story v17 file to Box Beam on every existing wall, at the default 9x2 LVL size", () => {
    const twoStoryOverrides: Partial<ProjectState> = {
      footprint: {
        corners: [
          { id: "A", point: { x: 0, y: 0 } },
          { id: "B", point: { x: 20, y: 0 } },
          { id: "C", point: { x: 20, y: 20 } },
        ],
        walls: [
          { id: "AB", startCorner: "A", endCorner: "B", lengthFt: 20 },
          { id: "BC", startCorner: "B", endCorner: "C", lengthFt: 20 },
        ],
      },
      stories: [
        { id: "ground", label: "Ground Floor", wallHeightFt: 10, wallSlots: {} },
        { id: "second", label: "Second Story", wallHeightFt: 9, wallSlots: {} },
      ],
    };
    const result = parseProjectFile(JSON.stringify(makeV17File(twoStoryOverrides)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.boxBeamWallIds).toEqual(new Set(["AB", "BC"]));
    expect(result.state.boxBeamSizeId).toBe("9x2-lvl");
  });

  it("increases the migrated 2nd story's own wallHeightFt by the Box Beam/Truss Plate height delta, preserving the project's exact prior geometry", () => {
    const result = parseProjectFile(
      JSON.stringify(
        makeV17File({
          stories: [
            { id: "ground", label: "Ground Floor", wallHeightFt: 10, wallSlots: {} },
            { id: "second", label: "Second Story", wallHeightFt: 9, wallSlots: {} },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // (2*0.75 + 9) - (1.5 + 0.75) = 8.25in = 0.6875ft
    expect(result.state.stories[1]!.wallHeightFt).toBeCloseTo(9 + 0.6875, 6);
    expect(result.state.stories[0]!.wallHeightFt).toBe(10); // ground floor untouched
  });

  it("migrates a 1-story v17 file to an empty boxBeamWallIds (box beam never applies there)", () => {
    const result = parseProjectFile(JSON.stringify(makeV17File()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.boxBeamWallIds).toEqual(new Set());
  });

  it("still rejects a version older than the one-version-back migration window", () => {
    const v16File = { ...makeV17File(), schemaVersion: 16 };
    const result = parseProjectFile(JSON.stringify(v16File));
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
