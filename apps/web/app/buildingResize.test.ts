import { describe, expect, it } from "vitest";
import {
  buildOctagonFootprint,
  buildRectangleFootprint,
  insertBumpOut,
  type Footprint,
} from "@building-integrity/geometry";
import {
  BOX_CHANGE_EPSILON_FT,
  boxAxisForWall,
  boxChanged,
  boxRefusalReason,
  boxWithAxis,
  buildingBoxFt,
  buildingShapeKind,
  footprintForBox,
  snapToEighthFt,
} from "./buildingResize";

const RECTANGLE = buildRectangleFootprint(24, 16);
const OCTAGON = buildOctagonFootprint(30, 20);

function bumpedOut(): Footprint {
  return insertBumpOut(RECTANGLE, "AB", 6, 12, 4, new Set(RECTANGLE.corners.map((c) => c.id))).footprint;
}

describe("which shapes have a W x D box", () => {
  it("a plain rectangle does, and it is the two wall lengths", () => {
    expect(buildingShapeKind(RECTANGLE, false)).toBe("rectangle");
    expect(buildingBoxFt(RECTANGLE, false)).toEqual({ widthFt: 24, depthFt: 16 });
  });

  it("an octagon does, and it is the box it is inscribed in", () => {
    expect(buildingShapeKind(OCTAGON, false)).toBe("octagon");
    const box = buildingBoxFt(OCTAGON, false)!;
    expect(box.widthFt).toBeCloseTo(30, 6);
    expect(box.depthFt).toBeCloseTo(20, 6);
  });

  it("⚠ a bumped-out plan does NOT, even though it still has four-cornered ancestry", () => {
    expect(buildingShapeKind(bumpedOut(), true)).toBe("freeform");
    expect(buildingBoxFt(bumpedOut(), true)).toBeNull();
  });

  it("⚠ and `isBumpedOut` is believed over the corner count, because the flag is what the app sets for a split or a courtyard too", () => {
    /* `handleKeepSplitRegion` and `commitFootprintShapeChange` both set this
       flag; its name is older than its job. A four-cornered kept half is still
       not resizable from two numbers, because its walls were renumbered. */
    expect(buildingShapeKind(RECTANGLE, true)).toBe("freeform");
    expect(buildingBoxFt(RECTANGLE, true)).toBeNull();
  });

  it("the refusal says what to do instead, not just that it cannot", () => {
    const reason = boxRefusalReason("freeform")!;
    expect(reason).toMatch(/one wall at a time/);
    expect(boxRefusalReason("rectangle")).toBeNull();
    expect(boxRefusalReason("octagon")).toBeNull();
  });
});

describe("which axis a wall drives", () => {
  it("a rectangle's walls pair up across the box", () => {
    expect(boxAxisForWall("rectangle", "AB")).toBe("width");
    expect(boxAxisForWall("rectangle", "CD")).toBe("width");
    expect(boxAxisForWall("rectangle", "BC")).toBe("depth");
    expect(boxAxisForWall("rectangle", "DA")).toBe("depth");
  });

  it("an octagon's STRAIGHT walls drive an axis and its mitered ones drive neither", () => {
    expect(boxAxisForWall("octagon", "01")).toBe("width");
    expect(boxAxisForWall("octagon", "45")).toBe("width");
    expect(boxAxisForWall("octagon", "23")).toBe("depth");
    expect(boxAxisForWall("octagon", "67")).toBe("depth");
    /* ⚠ The four corner walls ARE the clip, which falls out of min(W, D) —
       they are not an independent handle and must not pretend to be. */
    for (const mitered of ["12", "34", "56", "70"]) {
      expect(boxAxisForWall("octagon", mitered), `${mitered} must drive no axis`).toBeNull();
    }
  });

  it("a freeform plan's walls drive nothing", () => {
    expect(boxAxisForWall("freeform", "AB")).toBeNull();
  });

  it("every wall a rectangle and an octagon actually has is answered, not just the ones I remembered", () => {
    for (const wall of RECTANGLE.walls) expect(boxAxisForWall("rectangle", wall.id)).not.toBeNull();
    const driven = OCTAGON.walls.filter((w) => boxAxisForWall("octagon", w.id) !== null);
    expect(driven).toHaveLength(4);
  });
});

describe("a box round-trips through the footprint it builds", () => {
  it("rectangle: the footprint a box implies has that box", () => {
    for (const box of [
      { widthFt: 24, depthFt: 16 },
      { widthFt: 40, depthFt: 40 },
      { widthFt: 12.125, depthFt: 33.5 },
    ]) {
      const fp = footprintForBox("rectangle", box)!;
      expect(buildingBoxFt(fp, false)).toEqual(box);
    }
  });

  it("octagon: likewise, within the eighth every length in this app lives on", () => {
    for (const box of [
      { widthFt: 30, depthFt: 20 },
      { widthFt: 24, depthFt: 24 },
      { widthFt: 44, depthFt: 18.5 },
    ]) {
      const fp = footprintForBox("octagon", box)!;
      const back = buildingBoxFt(fp, false)!;
      expect(back.widthFt).toBeCloseTo(box.widthFt, 6);
      expect(back.depthFt).toBeCloseTo(box.depthFt, 6);
    }
  });

  it("⚠ the wall IDS survive a resize, which is what lets panels ride across instead of being re-tiled", () => {
    const before = buildRectangleFootprint(24, 16).walls.map((w) => w.id);
    const after = footprintForBox("rectangle", { widthFt: 44, depthFt: 9 })!.walls.map((w) => w.id);
    expect(after).toEqual(before);

    const octBefore = buildOctagonFootprint(30, 20).walls.map((w) => w.id);
    const octAfter = footprintForBox("octagon", { widthFt: 18, depthFt: 52 })!.walls.map((w) => w.id);
    expect(octAfter).toEqual(octBefore);
  });

  it("a freeform shape builds no footprint from a box", () => {
    expect(footprintForBox("freeform", { widthFt: 24, depthFt: 16 })).toBeNull();
  });
});

describe("editing one axis of the box", () => {
  it("leaves the other alone", () => {
    const box = { widthFt: 24, depthFt: 16 };
    expect(boxWithAxis(box, "width", 30)).toEqual({ widthFt: 30, depthFt: 16 });
    expect(boxWithAxis(box, "depth", 30)).toEqual({ widthFt: 24, depthFt: 30 });
  });

  it("⚠ a move under a sixteenth of an inch is not a move", () => {
    const box = { widthFt: 24, depthFt: 16 };
    expect(boxChanged(box, box)).toBe(false);
    expect(boxChanged(box, { widthFt: 24 + BOX_CHANGE_EPSILON_FT / 3, depthFt: 16 })).toBe(false);
    expect(boxChanged(box, { widthFt: 24 + 1 / 8 / 12, depthFt: 16 })).toBe(true);
    expect(boxChanged(box, { widthFt: 24, depthFt: 16.5 })).toBe(true);
  });
});

describe("the gesture proposes, the arithmetic disposes", () => {
  it("snaps a dragged length to the eighth every cut in this app lives on", () => {
    expect(snapToEighthFt(24 + 0.37 / 12) * 12).toBeCloseTo(24 * 12 + 0.375, 9);
    expect(snapToEighthFt(16.00031) * 12).toBeCloseTo(192, 9);
  });

  it("⚠ a snapped length is always a whole number of eighths, for any input", () => {
    for (let i = 0; i < 400; i++) {
      const raw = 3 + (i * 7919) / 997; // spread over a wide, non-round range
      const eighths = snapToEighthFt(raw) * 12 * 8;
      expect(Math.abs(eighths - Math.round(eighths)), `${raw}ft snapped off-grid`).toBeLessThan(1e-9);
    }
  });

  it("and snapping is idempotent — committing a snapped value never moves it again", () => {
    for (let i = 0; i < 100; i++) {
      const once = snapToEighthFt(5 + i / 13);
      expect(snapToEighthFt(once)).toBe(once);
    }
  });
});
