import { buildRectangleFootprint } from "@building-integrity/geometry";
import { describe, expect, it } from "vitest";
import { allPanelInstances, combinedPanelLabel } from "./panelInstances";

describe("allPanelInstances", () => {
  // A(0,0) B(30,0) C(30,20) D(0,20) -> AB=N, BC=E, CD=S, DA=W (see wallCompassDirection).
  const fp = buildRectangleFootprint(30, 20);
  const wallSlots = {
    AB: [
      { type: "corner" as const, widthIn: 24 },
      { type: "standard" as const, widthIn: 40 },
      { type: "window" as const, widthIn: 36 },
      { type: "standard" as const, widthIn: 40 },
      { type: "corner" as const, widthIn: 24 },
    ],
    BC: [
      { type: "safety-oct-corner" as const, widthIn: 24 },
      { type: "braced" as const, widthIn: 40 },
      { type: "door" as const, widthIn: 36 },
      { type: "corner" as const, widthIn: 24 },
    ],
  };

  it("counts every nameable type together, in true along-wall order, per compass direction", () => {
    const instances = allPanelInstances(fp, wallSlots, 40);
    const ab = instances.filter((i) => i.wallId === "AB");
    // corner, standard, [window -> header+sill], standard, corner
    expect(ab.map((i) => ({ name: i.name, panelType: i.panelType }))).toEqual([
      { name: "N-1", panelType: "corner" },
      { name: "N-2", panelType: "standard" },
      { name: "N-3", panelType: "header" },
      { name: "N-4", panelType: "sill" },
      { name: "N-5", panelType: "standard" },
      { name: "N-6", panelType: "corner" },
    ]);
  });

  it("gives a door only a header, no sill", () => {
    const instances = allPanelInstances(fp, wallSlots, 40);
    const bc = instances.filter((i) => i.wallId === "BC");
    expect(bc.map((i) => ({ name: i.name, panelType: i.panelType }))).toEqual([
      { name: "E-1", panelType: "safety-oct-corner" },
      { name: "E-2", panelType: "braced" },
      { name: "E-3", panelType: "header" },
      { name: "E-4", panelType: "corner" },
    ]);
  });

  it("shares one slotIndexInWall between a window's header and sill (same physical slot)", () => {
    const instances = allPanelInstances(fp, wallSlots, 40);
    const [header, sill] = instances.filter((i) => i.wallId === "AB" && (i.panelType === "header" || i.panelType === "sill"));
    expect(header!.slotIndexInWall).toBe(sill!.slotIndexInWall);
  });

  it("keeps numbering consistent regardless of which panel types a caller later filters to (the pre-existing Shop-Drawing-vs-canvas mismatch this replaces)", () => {
    const instances = allPanelInstances(fp, wallSlots, 40);
    const onlyStandard = instances.filter((i) => i.panelType === "standard");
    // These must still be "N-2" and "N-5" (their true position in the AB sequence),
    // not "N-1"/"N-2" from an independent per-type counter.
    expect(onlyStandard.map((i) => i.name)).toEqual(["N-2", "N-5"]);
  });

  it("splits a wide window's sill run into multiple sill instances sharing the same slotIndexInWall", () => {
    const wideWallSlots = {
      AB: [{ type: "window" as const, widthIn: 90 }],
    };
    // RO width (plywood jack studs, default config): 90 - 1.5 = 88.5in; at a
    // 40in standard width that's 2 sills sharing the run (round(88.5/40)=2).
    const instances = allPanelInstances(fp, wideWallSlots, 40);
    const sills = instances.filter((i) => i.panelType === "sill");
    expect(sills.length).toBeGreaterThan(1);
    for (const s of sills) expect(s.slotIndexInWall).toBe(0);
    const totalWidth = sills.reduce((sum, s) => sum + s.widthIn, 0);
    expect(totalWidth).toBeCloseTo(88.5, 6);
  });

  it("gives every header/sill instance a sourceSlotType matching the opening it came from", () => {
    const instances = allPanelInstances(fp, wallSlots, 40);
    const headersAndSills = instances.filter((i) => i.panelType === "header" || i.panelType === "sill");
    expect(headersAndSills.length).toBeGreaterThan(0);
    for (const inst of headersAndSills) expect(["window", "door"]).toContain(inst.sourceSlotType);
  });
});

describe("allPanelInstances — gableTilesByWallId", () => {
  const fp = buildRectangleFootprint(30, 20);
  const wallSlots = {
    AB: [
      { type: "corner" as const, widthIn: 24 },
      { type: "standard" as const, widthIn: 40 },
      { type: "corner" as const, widthIn: 24 },
    ],
  };

  it("continues the wall's own direction counter, not a fresh one, with no collisions", () => {
    const gableTilesByWallId = {
      AB: [
        { widthIn: 40, leftEdgeHeightIn: 120, rightEdgeHeightIn: 150 },
        { widthIn: 40, leftEdgeHeightIn: 150, rightEdgeHeightIn: 180 },
      ],
    };
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", gableTilesByWallId);
    const ab = instances.filter((i) => i.wallId === "AB");
    // 3 real slots (N-1..N-3) then 2 gable tiles continuing the same counter.
    expect(ab.map((i) => ({ name: i.name, panelType: i.panelType }))).toEqual([
      { name: "N-1", panelType: "corner" },
      { name: "N-2", panelType: "standard" },
      { name: "N-3", panelType: "corner" },
      { name: "N-4", panelType: "gable" },
      { name: "N-5", panelType: "gable" },
    ]);
  });

  it("carries each tile's own left/right edge heights onto its instance", () => {
    const gableTilesByWallId = { AB: [{ widthIn: 40, leftEdgeHeightIn: 120, rightEdgeHeightIn: 150 }] };
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", gableTilesByWallId);
    const gable = instances.find((i) => i.panelType === "gable")!;
    expect(gable.leftEdgeHeightIn).toBe(120);
    expect(gable.rightEdgeHeightIn).toBe(150);
  });

  it("gives gable tiles a negative slotIndexInWall that never collides with a real slot index", () => {
    const gableTilesByWallId = {
      AB: [
        { widthIn: 40, leftEdgeHeightIn: 120, rightEdgeHeightIn: 150 },
        { widthIn: 40, leftEdgeHeightIn: 150, rightEdgeHeightIn: 180 },
      ],
    };
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", gableTilesByWallId);
    const gableIndexes = instances.filter((i) => i.panelType === "gable").map((i) => i.slotIndexInWall);
    const realIndexes = instances.filter((i) => i.panelType !== "gable" && i.wallId === "AB").map((i) => i.slotIndexInWall);
    expect(gableIndexes).toEqual([-1, -2]);
    for (const gi of gableIndexes) expect(realIndexes).not.toContain(gi);
  });

  it("produces no gable instances, and identical output to omitting the arg entirely, when a wall has no entry", () => {
    const withEmptyMap = allPanelInstances(fp, wallSlots, 40, "plywood", {});
    const withoutArg = allPanelInstances(fp, wallSlots, 40);
    expect(withEmptyMap).toEqual(withoutArg);
    expect(withoutArg.some((i) => i.panelType === "gable")).toBe(false);
  });
});

describe("allPanelInstances — boxBeamCoverageByWallId", () => {
  const fp = buildRectangleFootprint(30, 20);
  const wallSlots = {
    AB: [
      { type: "standard" as const, widthIn: 40 },
      { type: "standard" as const, widthIn: 40 },
      { type: "window" as const, widthIn: 40 },
      { type: "standard" as const, widthIn: 40 },
    ],
  };

  it("flags every real instance (including a covered slot's header/sill) whose own slot falls inside the covered range", () => {
    const boxBeamCoverageByWallId = { AB: { startSlotIndex: 1, endSlotIndex: 3 } };
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, boxBeamCoverageByWallId);
    const ab = instances.filter((i) => i.wallId === "AB");
    // slot 0: uncovered standard; slot 1: covered standard; slot 2: covered
    // window (header + sill, same slot index); slot 3: uncovered standard.
    expect(ab.map((i) => ({ slotIndexInWall: i.slotIndexInWall, panelType: i.panelType, isBoxBeamCovered: i.isBoxBeamCovered }))).toEqual([
      { slotIndexInWall: 0, panelType: "standard", isBoxBeamCovered: undefined },
      { slotIndexInWall: 1, panelType: "standard", isBoxBeamCovered: true },
      { slotIndexInWall: 2, panelType: "header", isBoxBeamCovered: true },
      { slotIndexInWall: 2, panelType: "sill", isBoxBeamCovered: true },
      { slotIndexInWall: 3, panelType: "standard", isBoxBeamCovered: undefined },
    ]);
  });

  it("leaves isBoxBeamCovered undefined for every instance when the coverage map is omitted, missing this wall, or empty", () => {
    const withoutArg = allPanelInstances(fp, wallSlots, 40);
    const withUnrelatedWall = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, { XY: { startSlotIndex: 0, endSlotIndex: 1 } });
    const withEmptyMap = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, {});
    for (const instances of [withoutArg, withUnrelatedWall, withEmptyMap]) {
      for (const inst of instances) expect(inst.isBoxBeamCovered).toBeUndefined();
    }
  });

  it("never flags a gable instance, even at a wall/index that otherwise overlaps a covered range numerically", () => {
    const gableTilesByWallId = { AB: [{ widthIn: 40, leftEdgeHeightIn: 120, rightEdgeHeightIn: 150 }] };
    // Coverage range [0,4) would numerically "cover" every real slot AND
    // (if the negative gable index logic were buggy) risk misapplying to
    // the gable tile too — confirm it never does.
    const boxBeamCoverageByWallId = { AB: { startSlotIndex: 0, endSlotIndex: 4 } };
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", gableTilesByWallId, boxBeamCoverageByWallId);
    const gable = instances.find((i) => i.panelType === "gable")!;
    expect(gable.isBoxBeamCovered).toBeUndefined();
    for (const inst of instances.filter((i) => i.wallId === "AB" && i.panelType !== "gable")) {
      expect(inst.isBoxBeamCovered).toBe(true);
    }
  });
});

describe("combinedPanelLabel", () => {
  it("returns a single instance's own name unchanged", () => {
    expect(combinedPanelLabel([{ name: "N-2", wallId: "AB", panelType: "standard", widthIn: 40, slotIndexInWall: 1 }])).toBe(
      "N-2",
    );
  });

  it("combines 2 instances sharing a slot (window's header+sill) into one label", () => {
    const instances = [
      { name: "N-3", wallId: "AB", panelType: "header" as const, widthIn: 36, slotIndexInWall: 2 },
      { name: "N-4", wallId: "AB", panelType: "sill" as const, widthIn: 36, slotIndexInWall: 2 },
    ];
    expect(combinedPanelLabel(instances)).toBe("N-3+4");
  });

  it("returns an empty string for no instances", () => {
    expect(combinedPanelLabel([])).toBe("");
  });
});
