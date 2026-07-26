import { describe, expect, it } from "vitest";
import { computeBoxBeamAssemblyHeightIn } from "@building-integrity/panel-catalog";
import { midWallBeamsToGeometry, type MidWallBeam } from "./midWallBeam";

describe("midWallBeamsToGeometry", () => {
  it("resolves each beam's own sizeId into a real assemblyHeightIn, preserving height and slot range", () => {
    const beams: MidWallBeam[] = [
      { id: "a", heightIn: 60, sizeId: "9x2-lvl", startSlotIndex: 0, endSlotIndex: 3 },
      { id: "b", heightIn: 30, sizeId: "2x12-dimensional", startSlotIndex: 2, endSlotIndex: 6 },
    ];
    const geom = midWallBeamsToGeometry(beams);
    expect(geom).toEqual([
      { heightIn: 60, assemblyHeightIn: computeBoxBeamAssemblyHeightIn("9x2-lvl"), startSlotIndex: 0, endSlotIndex: 3 },
      { heightIn: 30, assemblyHeightIn: computeBoxBeamAssemblyHeightIn("2x12-dimensional"), startSlotIndex: 2, endSlotIndex: 6 },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(midWallBeamsToGeometry([])).toEqual([]);
  });
});
