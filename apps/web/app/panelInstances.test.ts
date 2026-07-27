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

describe("allPanelInstances — midWallBeamsByWallId", () => {
  const fp = buildRectangleFootprint(30, 20);
  const wallSlots = {
    AB: [
      { type: "standard" as const, widthIn: 40 },
      { type: "window" as const, widthIn: 40 },
    ],
  };
  const fullWidthBeam = { heightIn: 60, assemblyHeightIn: 11, startSlotIndex: 0, endSlotIndex: 2 };

  it("doubles every real instance on an affected wall — one per band — with the correct heightOverrideIn/midWallBandIndex", () => {
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, { AB: [fullWidthBeam] });
    const ab = instances.filter((i) => i.wallId === "AB");
    // Per band: standard (slot 0) + header+sill (slot 1, window) = 3
    // instances x 2 bands = 6 total.
    expect(ab.length).toBe(6);
    const below = ab.filter((i) => i.midWallBandIndex === 0);
    const above = ab.filter((i) => i.midWallBandIndex === 1);
    expect(below.length).toBe(3);
    expect(above.length).toBe(3);
    for (const inst of below) expect(inst.heightOverrideIn).toBe(60);
    for (const inst of above) expect(inst.heightOverrideIn).toBe(49);
  });

  it("shares the same slotIndexInWall between a slot's below-band and above-band instances", () => {
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, { AB: [fullWidthBeam] });
    const standardInstances = instances.filter((i) => i.wallId === "AB" && i.panelType === "standard");
    expect(standardInstances.length).toBe(2);
    expect(standardInstances[0]!.slotIndexInWall).toBe(standardInstances[1]!.slotIndexInWall);
    const headers = instances.filter((i) => i.wallId === "AB" && i.panelType === "header");
    expect(headers.length).toBe(2);
    expect(headers[0]!.slotIndexInWall).toBe(headers[1]!.slotIndexInWall);
  });

  it("leaves an unaffected slot with exactly 1 instance (undefined midWallBandIndex) when a beam covers only some slots", () => {
    // Beam covers only slot 0 (the standard panel), not slot 1 (the window).
    const partialBeam = { heightIn: 60, assemblyHeightIn: 11, startSlotIndex: 0, endSlotIndex: 1 };
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, { AB: [partialBeam] });
    const standardInstances = instances.filter((i) => i.wallId === "AB" && i.panelType === "standard");
    expect(standardInstances.length).toBe(2);
    for (const inst of standardInstances) expect(inst.midWallBandIndex).toBeDefined();
    const headers = instances.filter((i) => i.wallId === "AB" && i.panelType === "header");
    expect(headers.length).toBe(1);
    expect(headers[0]!.midWallBandIndex).toBeUndefined();
    expect(headers[0]!.heightOverrideIn).toBeUndefined();
  });

  it("splits into 3 instances when two beams at different heights both cover the same slot", () => {
    const beams = [
      { heightIn: 80, assemblyHeightIn: 10, startSlotIndex: 0, endSlotIndex: 1 },
      { heightIn: 30, assemblyHeightIn: 10, startSlotIndex: 0, endSlotIndex: 1 },
    ];
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, { AB: beams });
    const standardInstances = instances.filter((i) => i.wallId === "AB" && i.panelType === "standard");
    expect(standardInstances.length).toBe(3);
    expect(standardInstances.map((i) => i.midWallBandIndex).sort()).toEqual([0, 1, 2]);
    expect(standardInstances.find((i) => i.midWallBandIndex === 0)!.heightOverrideIn).toBe(30);
    expect(standardInstances.find((i) => i.midWallBandIndex === 1)!.heightOverrideIn).toBe(40); // 80 - (30+10)
    expect(standardInstances.find((i) => i.midWallBandIndex === 2)!.heightOverrideIn).toBe(30); // 120 - (80+10)
  });

  it("splits two beams with disjoint horizontal coverage independently", () => {
    const wideWallSlots = {
      AB: [
        { type: "standard" as const, widthIn: 40 },
        { type: "standard" as const, widthIn: 40 },
      ],
    };
    const beams = [
      { heightIn: 60, assemblyHeightIn: 11, startSlotIndex: 0, endSlotIndex: 1 },
      { heightIn: 30, assemblyHeightIn: 11, startSlotIndex: 1, endSlotIndex: 2 },
    ];
    const instances = allPanelInstances(fp, wideWallSlots, 40, "plywood", undefined, undefined, 120, { AB: beams });
    const bySlot0 = instances.filter((i) => i.wallId === "AB" && i.slotIndexInWall === 0);
    const bySlot1 = instances.filter((i) => i.wallId === "AB" && i.slotIndexInWall === 1);
    expect(bySlot0.length).toBe(2); // split by beam 0 only
    expect(bySlot1.length).toBe(2); // split by beam 1 only
    expect(bySlot0.every((i) => i.heightOverrideIn === 60 || i.heightOverrideIn === 49)).toBe(true);
    expect(bySlot1.every((i) => i.heightOverrideIn === 30 || i.heightOverrideIn === 79)).toBe(true);
  });

  it("produces zero instances for a wall whose real slot bands are empty (a beam consumes the whole story), without throwing", () => {
    const consumingBeam = { heightIn: 0, assemblyHeightIn: 120, startSlotIndex: 0, endSlotIndex: 2 };
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, { AB: [consumingBeam] });
    expect(instances.filter((i) => i.wallId === "AB")).toEqual([]);
  });

  it("degrades to unaffected (no throw) when midWallBeamsByWallId is passed but storyHeightIn is omitted", () => {
    const withoutHeight = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, undefined, { AB: [fullWidthBeam] });
    const withoutArg = allPanelInstances(fp, wallSlots, 40);
    expect(withoutHeight).toEqual(withoutArg);
  });

  it("leaves heightOverrideIn/midWallBandIndex undefined and output byte-identical to omitting the arg, for an unaffected wall / omitted arg / empty map", () => {
    const withoutArg = allPanelInstances(fp, wallSlots, 40);
    const withUnrelatedWall = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, { XY: [fullWidthBeam] });
    const withEmptyMap = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, {});
    for (const instances of [withoutArg, withUnrelatedWall, withEmptyMap]) {
      expect(instances).toEqual(withoutArg);
      for (const inst of instances) {
        expect(inst.heightOverrideIn).toBeUndefined();
        expect(inst.midWallBandIndex).toBeUndefined();
      }
    }
  });
});

describe("allPanelInstances — a braced slot split by a Mid-Wall Bond Beam degrades to standard only for a band too short for a girt", () => {
  const fp = buildRectangleFootprint(30, 20);
  const wallSlots = {
    AB: [{ type: "braced" as const, widthIn: 40, bracedPattern: "hatch" as const, bracedMirrored: true }],
  };
  // storyHeightIn 120: below-band [0,90] = 90in (well over 36, keeps bracing),
  // above-band [101,120] = 19in (under 36, degrades).
  const beam = { heightIn: 90, assemblyHeightIn: 11, startSlotIndex: 0, endSlotIndex: 1 };

  it("degrades only the short above-band instance to 'standard', leaving the tall below-band instance braced", () => {
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, { AB: [beam] });
    const ab = instances.filter((i) => i.wallId === "AB");
    expect(ab.length).toBe(2);
    const below = ab.find((i) => i.heightOverrideIn === 90)!;
    const above = ab.find((i) => i.heightOverrideIn === 19)!;
    expect(below.panelType).toBe("braced");
    expect(below.bracedPattern).toBe("hatch");
    expect(below.bracedMirrored).toBe(true);
    expect(above.panelType).toBe("standard");
    expect(above.bracedPattern).toBeUndefined();
    expect(above.bracedMirrored).toBeUndefined();
  });

  it("still reports 'braced' with its pattern intact for a slot no beam covers", () => {
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, {
      AB: [{ ...beam, startSlotIndex: 5, endSlotIndex: 6 }], // covers no real slot on this 1-slot wall
    });
    const ab = instances.filter((i) => i.wallId === "AB");
    expect(ab.length).toBe(1);
    expect(ab[0]!.panelType).toBe("braced");
    expect(ab[0]!.bracedPattern).toBe("hatch");
    expect(ab[0]!.bracedMirrored).toBe(true);
  });

  it("keeps both resulting bands braced when neither is short enough to degrade", () => {
    // below [0,60] = 60in, above [71,120] = 49in — both well over 36in.
    const tallBeam = { heightIn: 60, assemblyHeightIn: 11, startSlotIndex: 0, endSlotIndex: 1 };
    const instances = allPanelInstances(fp, wallSlots, 40, "plywood", undefined, undefined, 120, { AB: [tallBeam] });
    const ab = instances.filter((i) => i.wallId === "AB");
    expect(ab.length).toBe(2);
    for (const inst of ab) {
      expect(inst.panelType).toBe("braced");
      expect(inst.bracedPattern).toBe("hatch");
    }
  });

  it("leaves an unaffected braced wall (no midWallBeamsByWallId arg at all) reporting 'braced' unchanged", () => {
    const instances = allPanelInstances(fp, wallSlots, 40);
    const ab = instances.filter((i) => i.wallId === "AB");
    expect(ab.length).toBe(1);
    expect(ab[0]!.panelType).toBe("braced");
    expect(ab[0]!.bracedPattern).toBe("hatch");
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
