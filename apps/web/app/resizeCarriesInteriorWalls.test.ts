import { describe, expect, it } from "vitest";
import { buildMultiplexFootprint, ridgeBearingWallFor, simpleRoofPlanes, roofBearingBands } from "@building-integrity/geometry";
import { footprintForBox } from "./buildingResize";

/* ──────────────────────────────────────────────────────────────────────────
   ⚠ RESIZING A BUILDING USED TO DELETE ITS INTERIOR WALLS — found 2026-11-18

   B34 stride 1 audited the eight places that rebuild a footprint from
   `{ corners, walls }` and made every one spread its source. `footprintForBox`
   is a NINTH, and it is the one with a dial on it: it does not edit a
   footprint, it builds a fresh one from two numbers, so there was nothing to
   spread.

   Measured in the browser before this fix: two clicks of Decrease Width on the
   Multiplex took it from 63 wall panels to 34, collapsed the roof from 72
   panels back to 36, and removed every interior-wall line from the Review Log.
   Two apartments and the roof's bearing, gone, silently.
   ────────────────────────────────────────────────────────────────────────── */

const THICKNESS_IN = 15.5;
const multiplex = () =>
  buildMultiplexFootprint({ widthFt: 36, depthFt: 36, wallThicknessIn: THICKNESS_IN, roofBearingWalls: true });

describe("⚠ a resize carries the interior walls", () => {
  it("keeps all three, where it used to keep none", () => {
    const resized = footprintForBox("rectangle", { widthFt: 34, depthFt: 36 }, multiplex())!;
    expect(resized.interiorWalls).toHaveLength(3);
    expect(resized.interiorWalls!.map((w) => w.id).sort()).toEqual(["BRG-E", "BRG-W", "CTR"]);
  });

  it("⚠ and the OLD behaviour is what happens with no source — the regression, pinned", () => {
    /* The parameter is optional because every shape without interior walls
       still wants a bare outline. This is the line between the two. */
    expect(footprintForBox("rectangle", { widthFt: 34, depthFt: 36 })!.interiorWalls).toBeUndefined();
  });

  it("⚠ SCALED, not copied — a centred wall stays centred", () => {
    /* Copying the points would leave the centre wall at x = 18 in a 34ft
       building, which is off the midline, and `ridgeBearingWallFor` would stop
       recognising it. The roof would lose its bearing with nothing said. */
    const resized = footprintForBox("rectangle", { widthFt: 34, depthFt: 36 }, multiplex())!;
    const centre = resized.interiorWalls!.find((w) => w.id === "CTR")!;
    expect(centre.start.x).toBeCloseTo(17, 6);
    expect(ridgeBearingWallFor(resized)).toEqual({ wallId: "CTR", axis: "y" });
  });

  it("⚠ the purlin walls keep carrying the roof, so the bands survive", () => {
    /* The whole point of them: without the bands this building's roof panels
       go back over the 18ft limit. */
    const resized = footprintForBox("rectangle", { widthFt: 34, depthFt: 36 }, multiplex())!;
    const roof = simpleRoofPlanes(resized, { form: "peaked", pitchIn12: 8, eaveHeightFt: 10 });
    const bands = roofBearingBands(resized, roof);
    expect(bands).toHaveLength(2);
    for (const plane of bands) expect(plane.bandRunsFt).toHaveLength(2);
  });

  it("⚠ every carried wall lands back on the EIGHTH GRID", () => {
    /* A scale factor walks straight off the grid, and an off-grid wall is a
       row of panels that cannot sum to it — his dimensional-tightness rule.
       `quantizeFootprint` is what puts it back, and this is the proof. */
    for (const widthFt of [34, 33.5, 29, 41.125]) {
      const resized = footprintForBox("rectangle", { widthFt, depthFt: 31.375 }, multiplex())!;
      for (const wall of resized.interiorWalls!) {
        for (const v of [wall.start.x, wall.start.y, wall.end.x, wall.end.y]) {
          expect(Math.abs(v * 96 - Math.round(v * 96)), `${widthFt}ft ${wall.id} ${v}`).toBeLessThan(1e-9);
        }
      }
    }
  });

  it("⚠ the depth scales the walls' LENGTH, because they run that way", () => {
    const grown = footprintForBox("rectangle", { widthFt: 36, depthFt: 72 }, multiplex())!;
    const centre = grown.interiorWalls!.find((w) => w.id === "CTR")!;
    const was = multiplex().interiorWalls!.find((w) => w.id === "CTR")!;
    /* Twice the depth, twice the clear span — to the eighth it snaps to. */
    expect(centre.lengthFt).toBeCloseTo(was.lengthFt * 2, 2);
  });

  it("⚠ a shape with no interior walls is byte-identical to the bare outline", () => {
    /* Every building that is not a Multiplex has to be untouched by this. */
    const plain = { widthFt: 24, depthFt: 48 };
    const withSource = footprintForBox("rectangle", plain, footprintForBox("rectangle", { widthFt: 30, depthFt: 20 }));
    expect(withSource).toEqual(footprintForBox("rectangle", plain));
  });
});
