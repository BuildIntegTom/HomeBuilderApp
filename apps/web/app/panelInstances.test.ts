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
    const instances = allPanelInstances(fp, wallSlots);
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
    const instances = allPanelInstances(fp, wallSlots);
    const bc = instances.filter((i) => i.wallId === "BC");
    expect(bc.map((i) => ({ name: i.name, panelType: i.panelType }))).toEqual([
      { name: "E-1", panelType: "safety-oct-corner" },
      { name: "E-2", panelType: "braced" },
      { name: "E-3", panelType: "header" },
      { name: "E-4", panelType: "corner" },
    ]);
  });

  it("shares one slotIndexInWall between a window's header and sill (same physical slot)", () => {
    const instances = allPanelInstances(fp, wallSlots);
    const [header, sill] = instances.filter((i) => i.wallId === "AB" && (i.panelType === "header" || i.panelType === "sill"));
    expect(header!.slotIndexInWall).toBe(sill!.slotIndexInWall);
  });

  it("keeps numbering consistent regardless of which panel types a caller later filters to (the pre-existing Shop-Drawing-vs-canvas mismatch this replaces)", () => {
    const instances = allPanelInstances(fp, wallSlots);
    const onlyStandard = instances.filter((i) => i.panelType === "standard");
    // These must still be "N-2" and "N-5" (their true position in the AB sequence),
    // not "N-1"/"N-2" from an independent per-type counter.
    expect(onlyStandard.map((i) => i.name)).toEqual(["N-2", "N-5"]);
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
