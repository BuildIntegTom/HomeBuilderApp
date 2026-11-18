import { describe, expect, it } from "vitest";
import {
  buildMultiplexFootprint,
  buildRectangleFootprint,
  interiorWallSeries,
  wallDisplayLabelsByWallId,
  type InteriorWall,
} from "@building-integrity/geometry";
import { viewerMenuForStop, viewerStopsForFootprint, viewerStopsForMenu, viewerStopKey } from "./viewerMenus";
import type { ElevationWall } from "./WallElevationDiagram";

/* ──────────────────────────────────────────────────────────────────────────
   B34 — AN ELEVATION FOR A DIVIDING WALL

   ⚠ Until 2026-11-18 a Multiplex's three dividing walls were the only walls
   in the building that could be seen in plan and in 3D and never read off a
   drawing panel by panel — which is the one way a shop checks a wall. The
   Review Log had been saying so since stride 2.

   ⚠ The thing worth pinning is not the drawing, it is REACHABILITY. The two
   bar menus are the only presentation of the stop list, and `viewerStopsForMenu`
   merely filters it, so a wall missing from the list is a wall nobody can
   reach at all. That claim was untestable while the array lived inside a
   component; it is a pure function now and this is its test.
   ────────────────────────────────────────────────────────────────────────── */

const multiplex = () =>
  buildMultiplexFootprint({ widthFt: 36, depthFt: 36, wallThicknessIn: 15.5, roofBearingWalls: true });

const stopsFor = (fp: ReturnType<typeof multiplex> | null) =>
  viewerStopsForFootprint(fp, fp ? wallDisplayLabelsByWallId(fp) : {});

describe("⚠ every wall in the building has a stop, dividing walls included", () => {
  it("one elevation per wall, outline then interior", () => {
    const fp = multiplex();
    const elevations = stopsFor(fp).filter((s) => s.kind === "elevation");
    expect(elevations).toHaveLength(fp.walls.length + fp.interiorWalls!.length);
    /* ⚠ The order matters and is not alphabetical: the ring first, then the
       walls inside it — the same place B35 puts their panels in the install
       sequence. An interior wall is inside every ring. */
    expect(elevations.map((s) => (s.kind === "elevation" ? s.wallId : ""))).toEqual([
      ...fp.walls.map((w) => w.id),
      ...fp.interiorWalls!.map((w) => w.id),
    ]);
  });

  it("they are labelled by their own SERIES, which is what their panels carry", () => {
    const fp = multiplex();
    const stops = stopsFor(fp).filter((s) => s.kind === "elevation");
    const interior = stops.slice(fp.walls.length);
    expect(interior.map((s) => (s.kind === "elevation" ? s.label : ""))).toEqual(
      fp.interiorWalls!.map((_, index) => interiorWallSeries(index)),
    );
    /* ⚠ And NOT a compass direction, ever: a dividing wall has no outside to
       face. `C` cannot collide with one because every series starts with C and
       no compass label does. */
    for (const stop of interior) {
      expect(stop.kind === "elevation" && stop.label.startsWith("C")).toBe(true);
    }
  });

  it("⚠ each one has its own key, so the menu can mark the right entry", () => {
    const keys = stopsFor(multiplex()).map(viewerStopKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("they land under Edit with the other elevations, not under View", () => {
    const stops = stopsFor(multiplex());
    const design = viewerStopsForMenu(stops, "design");
    const interior = design.filter((s) => s.kind === "elevation" && s.wallId.startsWith("CTR"));
    expect(interior).toHaveLength(1);
    for (const stop of stops.filter((s) => s.kind === "elevation")) {
      expect(viewerMenuForStop(stop)).toBe("design");
    }
  });

  it("a building with no dividing walls is exactly what it was", () => {
    const fp = buildRectangleFootprint(24, 20);
    const stops = stopsFor(fp);
    expect(stops.map((s) => s.kind)).toEqual([
      "plan",
      ...fp.walls.map(() => "elevation"),
      "3d-framed",
      "3d-boxes",
      "3d-wraps",
    ]);
  });

  it("and with no footprint at all there is still a plan and the three 3D modes", () => {
    expect(stopsFor(null).map((s) => s.kind)).toEqual(["plan", "3d-framed", "3d-boxes", "3d-wraps"]);
  });
});

describe("⚠ the labels map is ONE map, and the outline's half is untouched", () => {
  it("a dividing wall's label is its series and an outline wall's is its compass direction", () => {
    const fp = multiplex();
    const labels = wallDisplayLabelsByWallId(fp);
    expect(labels.CTR).toBe("C");
    expect(labels["BRG-W"]).toBeDefined();
    expect(labels["BRG-E"]).toBeDefined();
    /* The four outline walls still read N/E/S/W, which is the whole of his
       2026-10-18 ask. A second map for interior walls would be a second
       chance for one wall to have two names. */
    expect(new Set(fp.walls.map((w) => labels[w.id]))).toEqual(new Set(["N", "E", "S", "W"]));
  });

  it("every wall in the building is in it, and nothing else is", () => {
    const fp = multiplex();
    const labels = wallDisplayLabelsByWallId(fp);
    expect(new Set(Object.keys(labels))).toEqual(
      new Set([...fp.walls.map((w) => w.id), ...fp.interiorWalls!.map((w) => w.id)]),
    );
  });
});

describe("⚠ an InteriorWall is an ElevationWall as it stands", () => {
  it("nothing is invented to draw one", () => {
    /* The point of narrowing `WallElevationDiagram`'s own prop from `Wall` to
       `ElevationWall`: a dividing wall has no corners at all, and handing one
       in as a synthetic `Wall` with made-up corner ids would have been exactly
       the kind of lie this repo has paid for before. This assignment is the
       assertion — it does not compile if the type widens back. */
    const wall: InteriorWall = multiplex().interiorWalls![0]!;
    const asElevation: ElevationWall = wall;
    expect(asElevation.id).toBe("CTR");
    expect(asElevation.lengthFt * 12).toBeCloseTo(401, 6);
  });
});
