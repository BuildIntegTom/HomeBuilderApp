import { describe, expect, it } from "vitest";
import { computeBoxBeamAssemblyHeightIn } from "@building-integrity/panel-catalog";
import {
  LINTEL_MIN_HEIGHT_IN,
  midWallBeamsToGeometry,
  resolveMidWallBeamAssemblyHeightIn,
  type MidWallBeam,
} from "./midWallBeam";

describe("midWallBeamsToGeometry", () => {
  it("resolves a box-beam's own sizeId into a real assemblyHeightIn, preserving height and slot range", () => {
    const beams: MidWallBeam[] = [
      { id: "a", heightIn: 60, kind: "box-beam", sizeId: "9x2-lvl", startSlotIndex: 0, endSlotIndex: 3 },
      { id: "b", heightIn: 30, kind: "box-beam", sizeId: "2x12-dimensional", startSlotIndex: 2, endSlotIndex: 6 },
    ];
    const geom = midWallBeamsToGeometry(beams);
    expect(geom).toEqual([
      { heightIn: 60, assemblyHeightIn: computeBoxBeamAssemblyHeightIn("9x2-lvl"), startSlotIndex: 0, endSlotIndex: 3 },
      { heightIn: 30, assemblyHeightIn: computeBoxBeamAssemblyHeightIn("2x12-dimensional"), startSlotIndex: 2, endSlotIndex: 6 },
    ]);
  });

  it("resolves a web-braced-lintel's own lintelHeightIn directly, not through the box-beam catalog", () => {
    const beams: MidWallBeam[] = [
      { id: "c", heightIn: 40, kind: "web-braced-lintel", lintelHeightIn: 14, startSlotIndex: 0, endSlotIndex: 2 },
    ];
    expect(midWallBeamsToGeometry(beams)).toEqual([{ heightIn: 40, assemblyHeightIn: 14, startSlotIndex: 0, endSlotIndex: 2 }]);
  });

  it("returns an empty array for an empty input", () => {
    expect(midWallBeamsToGeometry([])).toEqual([]);
  });
});

describe("resolveMidWallBeamAssemblyHeightIn", () => {
  it("box-beam kind resolves via the catalog (parity with computeBoxBeamAssemblyHeightIn)", () => {
    const beam: MidWallBeam = { id: "a", heightIn: 0, kind: "box-beam", sizeId: "11.25x2-lvl", startSlotIndex: 0, endSlotIndex: 1 };
    expect(resolveMidWallBeamAssemblyHeightIn(beam)).toBe(computeBoxBeamAssemblyHeightIn("11.25x2-lvl"));
  });

  it("web-braced-lintel kind returns lintelHeightIn directly", () => {
    const beam: MidWallBeam = { id: "b", heightIn: 0, kind: "web-braced-lintel", lintelHeightIn: 22, startSlotIndex: 0, endSlotIndex: 1 };
    expect(resolveMidWallBeamAssemblyHeightIn(beam)).toBe(22);
  });

  it("web-braced-lintel with lintelHeightIn undefined falls back to LINTEL_MIN_HEIGHT_IN", () => {
    const beam: MidWallBeam = { id: "c", heightIn: 0, kind: "web-braced-lintel", startSlotIndex: 0, endSlotIndex: 1 };
    expect(resolveMidWallBeamAssemblyHeightIn(beam)).toBe(LINTEL_MIN_HEIGHT_IN);
  });
});
