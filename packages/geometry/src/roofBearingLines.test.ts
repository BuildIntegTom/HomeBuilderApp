import { describe, expect, it } from "vitest";
import { buildMultiplexFootprint, multiplexRoomWidthFt, multiplexStudioWidthFt } from "./multiplex";
import { buildRectangleFootprint } from "./footprint";
import { simpleRoofPlanes } from "./simpleRoofPlanes";
import { longestBandRunFt, roofBearingBands } from "./roofBearingLines";
import type { Footprint } from "./types";

/* ──────────────────────────────────────────────────────────────────────────
   B34 STRIDE 3c — AN INTERIOR WALL PART WAY UP A ROOF PLANE

   A roof panel is 18ft at most, and it is the hypotenuse over the ground it
   covers, so its reach FALLS as the pitch rises: 17.1ft at 4:12, 15.0ft at
   8:12. His 36ft Multiplex needs 18ft a side, which is why it could not be
   roofed at all.

   Asked how to carry an intermediate bearing line, he chose A WALL UNDER EACH
   PURLIN (2026-11-17) over posts, struts and a loft knee wall.
   ────────────────────────────────────────────────────────────────────────── */

const THICKNESS_IN = 15.5;
const PANEL_MAX_FT = 18;

/** The ground one 18ft panel covers at a pitch — the inverse of the slope
 *  multiplier, restated here so the test's own numbers are checkable rather
 *  than imported from the thing being judged. */
const reachFt = (pitchIn12: number) => PANEL_MAX_FT / (Math.hypot(12, pitchIn12) / 12);

const multiplex = (roofBearingWalls: boolean) =>
  buildMultiplexFootprint({ widthFt: 36, depthFt: 36, wallThicknessIn: THICKNESS_IN, roofBearingWalls });

const bandsFor = (fp: Footprint, pitchIn12: number) =>
  roofBearingBands(fp, simpleRoofPlanes(fp, { form: "peaked", pitchIn12, eaveHeightFt: 10 }));

describe("⚠ the roof his 36x36 could not have", () => {
  it("⚠ 18ft a side is past what a panel reaches at ANY pitch", () => {
    /* The measurement behind the whole stride, and worth stating as an
       inequality rather than a figure: even dead flat, 18ft of panel covers
       18ft of ground and nothing more, so an 18ft run has no slack at all. */
    expect(reachFt(0)).toBeCloseTo(18, 9);
    expect(reachFt(4)).toBeLessThan(18);
    expect(reachFt(8)).toBeCloseTo(14.98, 2);

    const bare = bandsFor(multiplex(false), 8);
    expect(longestBandRunFt(bare)).toBeCloseTo(18, 6);
    expect(longestBandRunFt(bare)).toBeGreaterThan(reachFt(8));
  });

  it("⚠ with a wall under each purlin it fits, at 4:12 AND at his 8:12", () => {
    for (const pitch of [4, 8, 12]) {
      const bands = bandsFor(multiplex(true), pitch);
      const worstFt = longestBandRunFt(bands);
      const panelFt = worstFt * (Math.hypot(12, pitch) / 12);
      expect(panelFt, `${pitch}:12`).toBeLessThan(PANEL_MAX_FT);
    }
    /* His own pitch, with the figure spelled out: 11.2ft of panel against 18. */
    const bands = bandsFor(multiplex(true), 8);
    expect(longestBandRunFt(bands) * (Math.hypot(12, 8) / 12)).toBeCloseTo(11.2, 1);
  });

  it("⚠ each plane splits into exactly TWO bands, summing to the plane's own run", () => {
    const fp = multiplex(true);
    const roof = simpleRoofPlanes(fp, { form: "peaked", pitchIn12: 8, eaveHeightFt: 10 });
    const bands = roofBearingBands(fp, roof);
    expect(bands).toHaveLength(2);
    for (const [i, plane] of bands.entries()) {
      expect(plane.bandRunsFt).toHaveLength(2);
      expect(plane.bearingLines).toHaveLength(1);
      /* ⚠ The sum is EXACT, because the last band is the remainder rather than
         its own subtraction. A strip of roof left uncovered by rounding is
         [[dimensional-tightness-principle]] failing up the slope. */
      const sum = plane.bandRunsFt.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(roof.planes[i]!.runFt, 9);
    }
    /* The two planes are mirror images, so their bands match. */
    expect(bands[0]!.bandRunsFt[0]).toBeCloseTo(bands[1]!.bandRunsFt[0]!, 9);
    expect(bands.map((b) => b.bearingLines[0]!.wallId).sort()).toEqual(["BRG-E", "BRG-W"]);
  });

  it("⚠ the CENTRE wall is not a bearing line — it is the ridge, and it is excluded by construction", () => {
    /* It sits AT the high edge, distance `runFt`, and every line has to be
       STRICTLY inside the run. So the Multiplex's three interior walls sort
       themselves out with no special case at all. */
    const fp = multiplex(true);
    expect(fp.interiorWalls).toHaveLength(3);
    const bands = bandsFor(fp, 8);
    for (const plane of bands) {
      expect(plane.bearingLines.map((l) => l.wallId)).not.toContain("CTR");
    }
  });

  it("⚠ a wall NOT parallel to the eave carries nothing, and is ignored rather than refused", () => {
    /* It meets the panel run diagonally, so every panel in the band would
       break at a different distance and the band would not be a band. Such a
       wall is a perfectly good wall; it simply does not carry a roof. */
    const diagonal: Footprint = {
      ...buildRectangleFootprint(36, 36),
      interiorWalls: [{ id: "DIAG", start: { x: 4, y: 2 }, end: { x: 14, y: 34 }, lengthFt: 33.5 }],
    };
    const bands = bandsFor(diagonal, 8);
    for (const plane of bands) {
      expect(plane.bearingLines).toHaveLength(0);
      expect(plane.bandRunsFt).toHaveLength(1);
    }
  });

  it("⚠ a plain building with no interior wall is byte-identical: ONE band, the whole run", () => {
    const plain = buildRectangleFootprint(24, 48);
    const roof = simpleRoofPlanes(plain, { form: "peaked", pitchIn12: 4, eaveHeightFt: 10 });
    const bands = roofBearingBands(plain, roof);
    expect(bands.map((b) => b.bandRunsFt)).toEqual(roof.planes.map((p) => [p.runFt]));
    expect(bands.every((b) => b.bearingLines.length === 0)).toBe(true);
  });

  it("⚠ a SHED splits too, and it is the same code path", () => {
    /* A shed has one plane whose run is the WHOLE span, which is the form most
       likely to be too long to reach. Nothing here is peak-specific. */
    const fp = multiplex(true);
    const shed = simpleRoofPlanes(fp, { form: "shed", pitchIn12: 4, eaveHeightFt: 10 });
    const bands = roofBearingBands(fp, shed);
    expect(bands).toHaveLength(1);
    /* All three interior walls are inside a shed's single 36ft run, so it
       splits into four bands, not two. */
    expect(bands[0]!.bandRunsFt).toHaveLength(4);
    expect(bands[0]!.bandRunsFt.reduce((a, b) => a + b, 0)).toBeCloseTo(36, 6);
    /* ⚠ **The order is UP THE SLOPE, not west-to-east** — and this assertion
       had it backwards first. A shed's tall side defaults north, and with the
       ridge axis following the interior wall the shed falls WEST, so the low
       edge is the east one and `BRG-E` is the first line the run meets.
       Reading these as compass order would put a band's panels on the wrong
       wall. */
    expect(bands[0]!.bearingLines.map((l) => l.wallId)).toEqual(["BRG-E", "CTR", "BRG-W"]);
    expect(bands[0]!.bandRunsFt.map((r) => +r.toFixed(4))).toEqual([9.3229, 8.6771, 8.6771, 9.3229]);
  });
});

describe("⚠ what the purlin walls do to the rooms", () => {
  it("⚠ a studio is 16'-0¾\" clear, NOT the 17'-4¼\" this app said until 2026-11-17", () => {
    /* Three wall thicknesses cross a Multiplex's width, not one: two exterior
       and the centre. The old figure measured from the building's OUTSIDE face
       to the centre wall and called it a room. */
    expect(multiplexStudioWidthFt(36, THICKNESS_IN) * 12).toBeCloseTo(16 * 12 + 0.75, 6);
  });

  it("⚠ and a purlin wall makes it TWO rooms of 7'-4⅝\" — he chose this knowing it", () => {
    /* "Turns each studio into two rooms." Said plainly here because a 36ft
       Multiplex with purlin walls is two one-bedrooms, not two studios, and
       that belongs in a test rather than only in a blurb. */
    const roomIn = multiplexRoomWidthFt(36, THICKNESS_IN) * 12;
    expect(roomIn).toBeCloseTo(88.625, 6); // 7'-4⅝"
    /* Every wall and every room across the building add up to the 36 ft
       outside: 5 walls, 4 rooms. */
    expect(4 * roomIn + 5 * THICKNESS_IN).toBeCloseTo(36 * 12, 6);
  });

  it("⚠ the purlin walls sit on the EIGHTH GRID, like every other wall", () => {
    /* A wall off the grid is a row of panels that cannot sum to it — his
       dimensional-tightness rule. 111⅞in from the west face here. */
    const fp = multiplex(true);
    for (const wall of fp.interiorWalls!) {
      for (const v of [wall.start.x, wall.start.y, wall.end.x, wall.end.y]) {
        expect(Math.abs(v * 96 - Math.round(v * 96)), `${wall.id} ${v}`).toBeLessThan(1e-9);
      }
    }
    const west = fp.interiorWalls!.find((w) => w.id === "BRG-W")!;
    expect(west.start.x * 12).toBeCloseTo(111.875, 6);
  });

  it("⚠ the pair is symmetric about the centre wall", () => {
    const fp = multiplex(true);
    const west = fp.interiorWalls!.find((w) => w.id === "BRG-W")!;
    const east = fp.interiorWalls!.find((w) => w.id === "BRG-E")!;
    expect(west.start.x + east.start.x).toBeCloseTo(36, 9);
    /* All three run the same clear span, so they tile identically. */
    const centre = fp.interiorWalls!.find((w) => w.id === "CTR")!;
    expect(west.lengthFt).toBeCloseTo(centre.lengthFt, 9);
    expect(east.lengthFt).toBeCloseTo(centre.lengthFt, 9);
  });

  it("⚠ opting out leaves the stride-2 building exactly as it was", () => {
    const without = multiplex(false);
    expect(without.interiorWalls).toHaveLength(1);
    expect(without.interiorWalls![0]!.id).toBe("CTR");
  });
});
