import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROJECT_FILE_VERSION,
  REDACTED_FIELD_SURVIVED_MESSAGE,
  REDACTED_UNMARKED_MESSAGE,
  parseProjectFile,
  parseRedactedProjectFile,
  redactedUnknownPathMessage,
  serializeProject,
  type ProjectState,
} from "./projectFile";
import { resolveTitleBlockDate, titleBlockDateLabel } from "./titleBlockDate";
import { findSubMinimumPanelWidths, mergeRunStopOpenings, type PanelSlot } from "@building-integrity/geometry";
import { fabricationMinPanelWidthIn } from "@building-integrity/panel-catalog";

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
    foundationEnabled: false,
    wallRunStopsByWallId: {},
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

  /**
   * Smearforn Stage 2b's key, which is deliberately NOT a version bump.
   *
   * The whole argument for that rests on two properties: a file WITHOUT the
   * key loads to a state without it (so every file ever saved round-trips
   * byte-identically, and `PROJECT_FILE_VERSION` — and its hand-pasted
   * Supabase redaction migration — does not have to move), and a file WITH
   * it keeps every field of every header. Both are asserted rather than
   * argued.
   */
  describe("spanningHeadersByStoryAndWallId (Stage 2b)", () => {
    it("is absent after a round trip when the file never had it", () => {
      const state = makeState();
      expect(state.spanningHeadersByStoryAndWallId).toBeUndefined();
      const result = parseProjectFile(JSON.stringify(serializeProject(state)));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect("spanningHeadersByStoryAndWallId" in result.state).toBe(false);
      expect(result.state).toEqual(state);
    });

    it("round-trips a header's slot range and both heights exactly", () => {
      const state = makeState({
        spanningHeadersByStoryAndWallId: {
          ground: { AB: [{ id: "h-1", heightIn: 96, headerHeightIn: 24, startSlotIndex: 1, endSlotIndex: 3 }] },
          second: {},
        },
      });
      const result = parseProjectFile(JSON.stringify(serializeProject(state)));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.spanningHeadersByStoryAndWallId).toEqual({
        ground: { AB: [{ id: "h-1", heightIn: 96, headerHeightIn: 24, startSlotIndex: 1, endSlotIndex: 3 }] },
        second: {},
      });
    });

    it("normalizes a half-written record rather than handing a consumer an undefined story", () => {
      const file = serializeProject(makeState());
      const halfWritten = {
        ...file,
        state: { ...file.state, spanningHeadersByStoryAndWallId: { ground: { AB: [] } } },
      };
      const result = parseProjectFile(JSON.stringify(halfWritten));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.spanningHeadersByStoryAndWallId).toEqual({ ground: { AB: [] }, second: {} });
    });
  });

  /**
   * Smearforn Stage 3's run-stop opening memory (Tommy, 2026-09-29: **"Drop
   * them, and remember"**), which is deliberately NOT a version bump either,
   * and for exactly the argument above: absent means nothing was ever
   * withheld, which is what every file ever saved meant.
   *
   * The second test is the one that carries the promise. A remembered window
   * is only worth remembering if every field survives the trip to disk and
   * back — a width without its height and sill is not the window Tommy drew.
   */
  describe("unbuiltOpeningsByStoryAndWallId (Stage 3's opening memory)", () => {
    it("is absent after a round trip when the file never had it", () => {
      const state = makeState();
      expect(state.unbuiltOpeningsByStoryAndWallId).toBeUndefined();
      const result = parseProjectFile(JSON.stringify(serializeProject(state)));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect("unbuiltOpeningsByStoryAndWallId" in result.state).toBe(false);
      expect(result.state).toEqual(state);
    });

    it("round-trips every field of a withheld opening, not just its width", () => {
      const withheld = {
        beforeStandardCount: 3,
        type: "big-header" as const,
        widthIn: 61.5,
        heightIn: 60,
        sillHeightIn: 36,
        includeSillOnBigHeader: true,
        zones: [{ type: "standard" as const, heightIn: 60, sillHeightIn: 36 }],
      };
      // The memory is BOTH halves: the withheld anchor and the pre-stop order
      // that puts it back on the correct side of the opening that survived. A
      // file that carried only the first would restore a window and a door in
      // each other places — see runStopOpenings.ts.
      const memory = {
        unbuilt: [withheld],
        preStop: [
          { beforeStandardCount: 1, withheld: false },
          { beforeStandardCount: 3, withheld: true },
        ],
      };
      const state = makeState({
        unbuiltOpeningsByStoryAndWallId: { ground: { AB: memory }, second: {} },
      });
      const result = parseProjectFile(JSON.stringify(serializeProject(state)));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.unbuiltOpeningsByStoryAndWallId).toEqual({ ground: { AB: memory }, second: {} });
    });

    it("normalizes a half-written record rather than handing a consumer an undefined story", () => {
      const file = serializeProject(makeState());
      const halfWritten = {
        ...file,
        state: { ...file.state, unbuiltOpeningsByStoryAndWallId: { ground: { AB: { unbuilt: [], preStop: [] } } } },
      };
      const result = parseProjectFile(JSON.stringify(halfWritten));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.unbuiltOpeningsByStoryAndWallId).toEqual({ ground: { AB: { unbuilt: [], preStop: [] } }, second: {} });
    });

    /**
     * ⚠ **A memory shaped like this feature's own FIRST commit white-screened
     * the editor rather than degrading.** The memory used to be a bare anchor
     * array, that shape still exists on a live branch, and the tiler reads
     * `…?.[wall.id]?.unbuilt.length` — so `undefined.length` threw straight out
     * of the re-tile and left no building on screen. Read as what it was: the
     * withheld anchors — **with a pre-stop order SYNTHESIZED from them, because
     * an empty one deletes them.** The test below this one is the proof.
     */
    it("reads a bare anchor array — the pre-`preStop` shape — as the withheld anchors", () => {
      const withheld = { beforeStandardCount: 3, type: "window" as const, widthIn: 61.5 };
      const file = serializeProject(makeState());
      const legacyShape = {
        ...file,
        state: { ...file.state, unbuiltOpeningsByStoryAndWallId: { ground: { AB: [withheld] }, second: {} } },
      };
      const result = parseProjectFile(JSON.stringify(legacyShape));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.unbuiltOpeningsByStoryAndWallId).toEqual({
        ground: {
          AB: {
            unbuilt: [withheld],
            preStop: [{ beforeStandardCount: 3, withheld: true, payload: { type: "window", widthIn: 61.5 } }],
          },
        },
        second: {},
      });
    });

    /**
     * ⚠ **The guard is only worth having if the openings it rescues actually
     * come back, and with an empty `preStop` they did NOT.** The fourth review
     * measured it: `mergeRunStopOpenings` emits withheld anchors only by walking
     * `memory.preStop`, so an empty one emits none and the window is gone — from
     * the slots, and then from state on the next re-tile. This drives the parser
     * output straight into the merge, which is the only place the rescue is
     * observable.
     */
    it("a legacy bare array really does restore its openings through the merge", () => {
      const withheld = { beforeStandardCount: 3, type: "window" as const, widthIn: 61.5 };
      const survivor = { beforeStandardCount: 1, type: "door" as const, widthIn: 37.5 };
      const file = serializeProject(makeState());
      const legacyShape = {
        ...file,
        state: { ...file.state, unbuiltOpeningsByStoryAndWallId: { ground: { AB: [withheld] }, second: {} } },
      };
      const result = parseProjectFile(JSON.stringify(legacyShape));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const memory = result.state.unbuiltOpeningsByStoryAndWallId!.ground.AB!;
      // With a survivor on the wall: nothing is lost. The order is approximate
      // — a bare array never recorded where the survivor sat — and
      // `runStopRestoreFidelity` says so, which is what keeps the user-facing
      // wording honest here.
      expect(mergeRunStopOpenings([survivor], memory).map((o) => o.type)).toEqual(["door", "window"]);
      // Fully stopped: the wall gets its opening back, which is the whole point.
      expect(mergeRunStopOpenings([], memory)).toEqual([withheld]);
    });

    /**
     * The merge walks `preStop`'s withheld entries and `unbuilt` in lockstep
     * (`memory.unbuilt[unbuiltIndex++]!`), so a hand-edited file claiming more
     * withheld entries than it carries anchors pushes `undefined` into the
     * anchor list and `retileWithOpenings` dereferences it — the same white
     * screen as the bare array, one field over. The order is what is wrong, so
     * the order is what is dropped; the anchors are kept.
     */
    it("rejects a pre-stop order that does not correspond to the anchors it indexes", () => {
      const withheld = { beforeStandardCount: 3, type: "window" as const, widthIn: 61.5 };
      const file = serializeProject(makeState());
      const overclaiming = {
        ...file,
        state: {
          ...file.state,
          unbuiltOpeningsByStoryAndWallId: {
            ground: {
              AB: {
                unbuilt: [withheld],
                preStop: [
                  { beforeStandardCount: 3, withheld: true },
                  { beforeStandardCount: 5, withheld: true },
                ],
              },
            },
            second: {},
          },
        },
      };
      const result = parseProjectFile(JSON.stringify(overclaiming));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const memory = result.state.unbuiltOpeningsByStoryAndWallId!.ground.AB!;
      expect(memory.preStop).toEqual([
        { beforeStandardCount: 3, withheld: true, payload: { type: "window", widthIn: 61.5 } },
      ]);
      // And the shape that used to crash the tiler now merges cleanly.
      expect(mergeRunStopOpenings([], memory)).toEqual([withheld]);
    });

    /** Not a memory at all — the wall simply has nothing withheld, which is the
     * state every project saved before this feature is in. Anything else here
     * means a crash inside the tiler. */
    it("drops a value that is not a memory rather than handing it to the tiler", () => {
      const file = serializeProject(makeState());
      const junk = {
        ...file,
        state: {
          ...file.state,
          unbuiltOpeningsByStoryAndWallId: { ground: { AB: "nonsense", BC: { preStop: [] } }, second: 7 },
        },
      };
      const result = parseProjectFile(JSON.stringify(junk));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.unbuiltOpeningsByStoryAndWallId).toEqual({ ground: {}, second: {} });
    });

    it("does not move PROJECT_FILE_VERSION — an additive optional key needs no bump", () => {
      // Stated in projectFile.ts's own v24->v25 note and asserted here so the
      // claim cannot drift: a file written with the new key is still a v25
      // file, and a v25 file written without it still opens.
      expect(PROJECT_FILE_VERSION).toBe(25);
      const withKey = serializeProject(makeState({ unbuiltOpeningsByStoryAndWallId: { ground: {}, second: {} } }));
      expect(withKey.schemaVersion).toBe(25);
      expect(parseProjectFile(JSON.stringify(withKey)).ok).toBe(true);
    });
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

describe("the standing 1/8in grid repair, exercised through a v24 file", () => {
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

  /** Builds a raw v24-shaped file: a current serialization with the version
   * rolled back AND v25's own keys stripped, which is exactly what a file
   * saved before Smearforn Stage 0 looks like. (The 1/8in repair these tests
   * exercise is unconditional — it runs on every load, v24 or v25 — so the
   * version number here only decides which required-key set applies.) */
  function makeV24File(overrides: Partial<ProjectState> = {}) {
    const { foundationEnabled: _f, wallRunStopsByWallId: _s, ...v24State } = serializeProject(makeState(overrides)).state;
    return { schemaVersion: 24, savedAt: new Date().toISOString(), state: v24State };
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
    const file = makeV24File({
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
    const result = parseProjectFile(JSON.stringify(makeV24File({ footprint: drifted, baseWallSlots: {}, stories: [] })));
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
        makeV24File({
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

  it("passes a v24 beam through untouched — v24->v25 changes no beam field", () => {
    const beams = {
      ground: { AB: [{ id: "beam-1", heightIn: 60, sizeId: "9x2-lvl" as const, kind: "box-beam" as const, startSlotIndex: 0, endSlotIndex: 3 }] },
      second: {},
    };
    const result = parseProjectFile(JSON.stringify(makeV24File({ midWallBeamsByStoryAndWallId: beams })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.midWallBeamsByStoryAndWallId.ground.AB).toEqual(beams.ground.AB);
  });

  it("now rejects v23, which has fallen out of the one-version-back window", () => {
    const v23File = { ...makeV24File(), schemaVersion: 23 };
    const result = parseProjectFile(JSON.stringify(v23File));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/version/i);
  });
});

describe("limits are enforced on EDIT, never on LOAD (Smearforn Stage 1)", () => {
  /** A design stored before the 24in fabrication minimum existed: one 20in
   * panel, which the shop cannot build and the tiler can still produce by
   * itself (computePlainSizing's two-way split). */
  const withNarrowPanel: PanelSlot[] = [
    { type: "standard", widthIn: 20 },
    { type: "standard", widthIn: 40 },
    { type: "braced", widthIn: 40, bracedPattern: "hatch", bracedMirrored: true },
  ];

  it("opens a stored design containing a 20in panel, with every width exactly as saved", () => {
    // The rule: a file must never become unopenable, or be quietly corrected,
    // because a limit tightened. Nothing about this load may differ from what
    // it did before the minimum existed.
    const state = makeState({
      baseWallSlots: { AB: withNarrowPanel },
      stories: [{ id: "ground", label: "Ground Floor", wallHeightFt: 10, wallSlots: { AB: withNarrowPanel } }],
    });
    const result = parseProjectFile(JSON.stringify(serializeProject(state)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.baseWallSlots.AB).toEqual(withNarrowPanel);
    expect(result.state.stories[0]!.wallSlots.AB).toEqual(withNarrowPanel);
  });

  it("opens the same design out of a v24 file too, and still does not touch it", () => {
    const { foundationEnabled: _f, wallRunStopsByWallId: _s, ...v24State } = serializeProject(
      makeState({ baseWallSlots: { AB: withNarrowPanel } }),
    ).state;
    const result = parseProjectFile(JSON.stringify({ schemaVersion: 24, savedAt: "2026-09-01T12:00:00.000Z", state: v24State }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.baseWallSlots.AB).toEqual(withNarrowPanel);
  });

  it("reports that panel instead of repairing it — the Review Log's own source", () => {
    const result = parseProjectFile(JSON.stringify(serializeProject(makeState({ baseWallSlots: { AB: withNarrowPanel } }))));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findSubMinimumPanelWidths(result.state.baseWallSlots, fabricationMinPanelWidthIn.value)).toEqual([
      { wallId: "AB", slotIndex: 0, type: "standard", widthIn: 20 },
    ]);
  });

  it("keeps a hand-set width that is itself under the minimum — a pin is user work, not an error to clean up", () => {
    const pinned: PanelSlot[] = [{ type: "standard", widthIn: 20, lockedWidthIn: 20 }, { type: "standard", widthIn: 40 }];
    const result = parseProjectFile(JSON.stringify(serializeProject(makeState({ baseWallSlots: { AB: pinned } }))));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.baseWallSlots.AB).toEqual(pinned);
  });
});

describe("v24 -> v25 migration (Foundation becomes an optional scope branch)", () => {
  /** A file saved before Smearforn Stage 0: the current serialization with the
   * version rolled back and v25's own two keys removed, which is byte-for-byte
   * the shape a real v24 save has. */
  function makeV24File(overrides: Partial<ProjectState> = {}) {
    const { foundationEnabled: _f, wallRunStopsByWallId: _s, ...v24State } = serializeProject(makeState(overrides)).state;
    return { schemaVersion: 24, savedAt: "2026-09-01T12:00:00.000Z", state: v24State };
  }

  it("opens a v24 project that has floors AND a foundation with both intact and both still enabled", () => {
    // The whole trap in this stage: the new-project default is OFF, and
    // applying it to an existing file would hide the Foundation tab on every
    // project ever saved. This is the test that would fail if the migration
    // default were copied from the useState call.
    const v24 = makeV24File({
      floorsEnabled: true,
      floorSystemId: "bale-foundation",
      perpendicular2x4Enabled: true,
      floorBottomSkinEnabled: true,
      baleFoundationTopDepthIn: 7.25,
      baleFoundationBottomDepthIn: 5.5,
      baleFoundationGapIn: 2,
      baleFoundationFieldSpacingIn: 24,
      foundationTypeId: "concrete-pier",
      pierSpacingFt: 6,
    });
    expect("foundationEnabled" in v24.state).toBe(false);

    const result = parseProjectFile(JSON.stringify(v24));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Enabled, not defaulted off.
    expect(result.state.foundationEnabled).toBe(true);
    expect(result.state.floorsEnabled).toBe(true);
    // And every piece of foundation/floor DATA is exactly what was saved —
    // a scope flag gates rendering, it never deletes.
    expect(result.state.foundationTypeId).toBe("concrete-pier");
    expect(result.state.pierSpacingFt).toBe(6);
    expect(result.state.floorSystemId).toBe("bale-foundation");
    expect(result.state.perpendicular2x4Enabled).toBe(true);
    expect(result.state.floorBottomSkinEnabled).toBe(true);
    expect(result.state.baleFoundationTopDepthIn).toBe(7.25);
    expect(result.state.baleFoundationBottomDepthIn).toBe(5.5);
    expect(result.state.baleFoundationGapIn).toBe(2);
    expect(result.state.baleFoundationFieldSpacingIn).toBe(24);
  });

  it("drops nothing else at all: every v24 key comes back with the value it was saved with", () => {
    const v24 = makeV24File({ floorsEnabled: true, roofEnabled: true, foundationTypeId: "slab", pierSpacingFt: 7 });
    const result = parseProjectFile(JSON.stringify(v24));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Compared against the v24 document itself rather than against makeState,
    // so a key silently dropped by the migration shows up here as undefined.
    const loaded = serializeProject(result.state).state as Record<string, unknown>;
    for (const [key, saved] of Object.entries(v24.state as Record<string, unknown>)) {
      expect({ key, value: loaded[key] }).toEqual({ key, value: saved });
    }
  });

  it("gives a v24 file an empty run-stop record — no wall stops short, which is what a v24 file meant", () => {
    const result = parseProjectFile(JSON.stringify(makeV24File()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wallRunStopsByWallId).toEqual({});
  });

  it("keeps a v25 project's own unchecked Foundation unchecked (false, not re-defaulted to true)", () => {
    const result = parseProjectFile(JSON.stringify(serializeProject(makeState({ foundationEnabled: false }))));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.foundationEnabled).toBe(false);
  });

  it("round-trips a Stage 3 run-stop record untouched, though nothing reads it yet", () => {
    const stops = { AB: { startStopIn: 24, endStopIn: 0 } };
    const result = parseProjectFile(JSON.stringify(serializeProject(makeState({ wallRunStopsByWallId: stops }))));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wallRunStopsByWallId).toEqual(stops);
  });

  it("still refuses a CURRENT-version file that is missing foundationEnabled — the skip is for v24 only", () => {
    const file = serializeProject(makeState());
    const { foundationEnabled: _dropped, ...state } = file.state;
    const result = parseProjectFile(JSON.stringify({ ...file, state }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/foundationEnabled/);
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

  it("carries savedAt through a prior-version file that goes through the load-time repair", () => {
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

// ---------------------------------------------------------------------------
// Stage 4B: parseRedactedProjectFile — the browse path's own parse
// ---------------------------------------------------------------------------

/**
 * Exactly what `browse_version` sends: the stored document minus every
 * classified money path, plus the top-level `redaction` marker. Built from a
 * real serialized project so the two never drift, and shaped after a genuine
 * `browse_redact` output read off local PostgreSQL 17.4 (see
 * `cloud/redaction.test.ts` for the captured original).
 */
function redactedFile(overrides: Partial<ProjectState> = {}) {
  const file = serializeProject(makeState(overrides));
  const { priceModifier: _removed, ...state } = file.state;
  return {
    ...file,
    state,
    redaction: {
      schemaVersion: file.schemaVersion,
      removedPaths: ["state.priceModifier"],
      reason: "another company's cost information",
    },
  };
}

describe("parseRedactedProjectFile", () => {
  it("opens a stripped document that parseProjectFile refuses as corrupt", () => {
    const raw = JSON.stringify(redactedFile());

    // THE WHOLE REASON THIS FUNCTION EXISTS. priceModifier is in
    // REQUIRED_STATE_KEYS, so the ordinary parser reads a redacted document as
    // a broken file — which would be the message on EVERY browsed project.
    const refused = parseProjectFile(raw);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/priceModifier/);

    const parsed = parseRedactedProjectFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.costsRedacted).toBe(true);
    expect(parsed.removedPaths).toEqual(["state.priceModifier"]);
    expect(parsed.reason).toBe("another company's cost information");
  });

  it("holds the price modifier as NaN — never 1, never 0, never 1.3", () => {
    const parsed = parseRedactedProjectFile(JSON.stringify(redactedFile()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Number.isNaN(parsed.state.priceModifier)).toBe(true);
    // Said as its own assertion because the point is what it is NOT: a missed
    // display gate must print $NaN, not a plausible figure.
    expect(parsed.state.priceModifier).not.toBe(1);
    expect(parsed.state.priceModifier).not.toBe(0);
    expect(parsed.state.priceModifier).not.toBe(1.3);
    // Any arithmetic on it stays NaN, so no downstream total can launder it.
    expect(Number.isNaN(parsed.state.priceModifier * 48210)).toBe(true);
  });

  it("brings the whole design through — money no, design yes (decision 20)", () => {
    const doc = redactedFile();
    const parsed = parseRedactedProjectFile(JSON.stringify(doc));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.state.projectName).toBe(makeState().projectName);
    expect(parsed.state.baseWallSlots.AB).toHaveLength(2);
    expect(parsed.state.primaryCornerIds).toBeInstanceOf(Set);
    expect(parsed.state.zipCode).toBe("97201");
    // The title block's fallback: the version's own created_at is what the
    // browse open actually writes, but savedAt must survive the parse.
    expect(parsed.savedAt).toBe(doc.savedAt);
  });

  it("refuses a document with NO marker, rather than treating it as a full one", () => {
    const file = serializeProject(makeState());
    const { priceModifier: _removed, ...state } = file.state;
    const parsed = parseRedactedProjectFile(JSON.stringify({ ...file, state }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe(REDACTED_UNMARKED_MESSAGE);
  });

  it("refuses a marker whose schemaVersion disagrees with the document's", () => {
    const doc = redactedFile();
    const parsed = parseRedactedProjectFile(
      JSON.stringify({ ...doc, redaction: { ...doc.redaction, schemaVersion: PROJECT_FILE_VERSION - 1 } }),
    );
    expect(parsed.ok).toBe(false);
  });

  it("refuses a marker naming a path this app does not know how to open without", () => {
    const doc = redactedFile();
    const parsed = parseRedactedProjectFile(
      JSON.stringify({ ...doc, redaction: { ...doc.redaction, removedPaths: ["state.zipCode"] } }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe(redactedUnknownPathMessage("state.zipCode"));
  });

  it("refuses a FORGED marker that tries to excuse a real design field", () => {
    // The defence that matters: a marker cannot be used to open a document
    // with a hole in the DESIGN. `standardWidthIn` is required and is not
    // money, so naming it excuses nothing.
    const file = serializeProject(makeState());
    const { priceModifier: _money, standardWidthIn: _design, ...state } = file.state;
    const parsed = parseRedactedProjectFile(
      JSON.stringify({
        ...file,
        state,
        redaction: { schemaVersion: file.schemaVersion, removedPaths: ["state.priceModifier", "state.standardWidthIn"], reason: "x" },
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe(redactedUnknownPathMessage("state.standardWidthIn"));
  });

  it("refuses a document whose marker says the field went but the field is still there", () => {
    // The server's account of what it sent is wrong. Refuse rather than show
    // another company's markup under a banner saying costs are not shown.
    const doc = redactedFile();
    const parsed = parseRedactedProjectFile(JSON.stringify({ ...doc, state: { ...doc.state, priceModifier: 1.3777 } }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe(REDACTED_FIELD_SURVIVED_MESSAGE);
  });

  it("refuses a money field that survived WITHOUT being named — the other side of the same fault", () => {
    const doc = redactedFile();
    const parsed = parseRedactedProjectFile(
      JSON.stringify({ ...doc, state: { ...doc.state, priceModifier: 1.3777 }, redaction: { ...doc.redaction, removedPaths: [] } }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe(REDACTED_FIELD_SURVIVED_MESSAGE);
  });

  it("still refuses everything the ordinary parser refuses: version, shape, and other missing keys", () => {
    const doc = redactedFile();
    expect(parseRedactedProjectFile("not json").ok).toBe(false);
    expect(parseRedactedProjectFile(JSON.stringify({ ...doc, schemaVersion: 2, redaction: { ...doc.redaction, schemaVersion: 2 } })).ok).toBe(
      false,
    );
    const { standardWidthIn: _drop, ...state } = doc.state;
    const missing = parseRedactedProjectFile(JSON.stringify({ ...doc, state }));
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toMatch(/standardWidthIn/);
  });

  it("does not loosen parseProjectFile: an ordinary file still needs every required key", () => {
    const file = serializeProject(makeState());
    const { priceModifier: _drop, ...state } = file.state;
    // Even WITH a marker attached, the ordinary parser is unchanged: it does
    // not read the marker, so the key is still required.
    const withMarker = { ...file, state, redaction: { schemaVersion: file.schemaVersion, removedPaths: ["state.priceModifier"], reason: "x" } };
    const result = parseProjectFile(JSON.stringify(withMarker));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/priceModifier/);
  });

  it("no PROJECT_FILE_VERSION bump of its own: a redacted document is still the current version", () => {
    const doc = redactedFile();
    expect(doc.schemaVersion).toBe(PROJECT_FILE_VERSION);
    expect(parseRedactedProjectFile(JSON.stringify(doc)).ok).toBe(true);
  });
});
