import { describe, expect, it } from "vitest";
import {
  buildMultiplexFootprint,
  buildRectangleFootprint,
  interiorWallSeries,
  isCompassDirection,
  tileInteriorWalls,
  wallFabricationLengthIn,
} from "@building-integrity/geometry";
import { allPanelInstances } from "./panelInstances";

/* ──────────────────────────────────────────────────────────────────────────
   B34 STRIDE 2 — THE CENTRE WALL IS PANELIZED

   > "all the loads of everything transfer down the center row of diving wall
   >  panels"  — Tommy, 2026-11-16

   It tiles on the same module out of the same panels, and everything
   downstream counts, weighs, prices and exports it like any other wall. What
   differs is only what it meets at each end.
   ────────────────────────────────────────────────────────────────────────── */

const THICKNESS_IN = 15.5;
const STANDARD_IN = 48;
const multiplex = () => buildMultiplexFootprint({ widthFt: 36, depthFt: 36, wallThicknessIn: THICKNESS_IN });

describe("the centre wall tiles", () => {
  it("⚠ its panels sum EXACTLY to the clear span — his dimensional-tightness rule", () => {
    /* 36 ft less a wall thickness at each end = 401in, and the row has to
       close on it to the eighth. A row that does not sum is a wall that
       cannot be built. */
    const fp = multiplex();
    const slots = tileInteriorWalls(fp, STANDARD_IN, "A")[fp.interiorWalls![0]!.id]!;
    const clearIn = wallFabricationLengthIn(fp.interiorWalls![0]!);
    expect(clearIn).toBeCloseTo(36 * 12 - 2 * THICKNESS_IN, 6);
    expect(slots.reduce((n, s) => n + s.widthIn, 0)).toBeCloseTo(clearIn, 6);
  });

  it("⚠ has NO corner panels at either end — his 'butts, square'", () => {
    /* Corner panels would have keyed into the north and south walls and
       re-tiled every panel in both of them. */
    const fp = multiplex();
    const slots = tileInteriorWalls(fp, STANDARD_IN, "A")[fp.interiorWalls![0]!.id]!;
    expect(slots.some((s) => s.type === "corner" || s.type === "safety-oct-corner")).toBe(false);
  });

  it("no interior walls means no extra slots at all", () => {
    expect(tileInteriorWalls(buildRectangleFootprint(36, 36), STANDARD_IN, "A")).toEqual({});
  });
});

describe("the centre wall's panels are named C1, C2, …", () => {
  const fp = multiplex();
  const slots = tileInteriorWalls(fp, STANDARD_IN, "A");
  const instances = allPanelInstances(fp, slots, STANDARD_IN, "plywood");

  it("⚠ C, not a compass letter — his pick", () => {
    /* Reusing a compass letter would have given a crew two different walls
       both answering to N. */
    expect(interiorWallSeries(0)).toBe("C");
    const centre = instances.filter((i) => i.wallId === fp.interiorWalls![0]!.id);
    expect(centre.length).toBeGreaterThan(0);
    expect(centre.map((i) => i.name)).toEqual(centre.map((_, n) => `C${n + 1}`));
  });

  it("a second interior wall takes the same suffix convention a second N wall does", () => {
    expect(interiorWallSeries(1)).toBe("C2");
  });

  it("⚠ its series is NOT a compass direction, so B35 gives it the non-compass chip", () => {
    const centre = instances.find((i) => i.wallId === fp.interiorWalls![0]!.id)!;
    expect(isCompassDirection(centre.direction)).toBe(false);
    /* While an outline panel still is one. */
    const outline = instances.find((i) => i.wallId === "AB");
    expect(outline === undefined || isCompassDirection(outline.direction)).toBe(true);
  });

  it("⚠ the outline's own names are untouched by the new series", () => {
    /* The counters are per series, so adding a C run cannot renumber N1. */
    const withoutCentre = allPanelInstances(buildRectangleFootprint(36, 36), slots, STANDARD_IN, "plywood");
    const namesOn = (list: typeof instances, wallId: string) =>
      list.filter((i) => i.wallId === wallId).map((i) => i.name);
    for (const wallId of ["AB", "BC", "CD", "DA"]) {
      expect(namesOn(instances, wallId), wallId).toEqual(namesOn(withoutCentre, wallId));
    }
  });
});
