import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { roofHeightFtAt, shedTallWallId, simpleRoofPlanes, wallRoofTopsFor } from "./simpleRoofPlanes";
import { wallCompassDirection } from "./wallCompassDirection";
import type { Footprint } from "./types";

/**
 * ⚠ **HOW HIGH IS THE ROOF AT THIS WALL'S TWO CORNERS** — the question every
 * gable row in this app should have been asking and was not.
 *
 * > *"Octagon roofs does not meet, correct. I like the shed style on the
 * > octagon though as an option. I think octagon shed is possible, there's
 * > just going to be some very unique gable panels."* — Tommy, 2026-11-15
 *
 * `computeGableTiledRow` anchors both ends of a row at the eave, which is
 * true for a box and false for every wall of an octagon. These two functions
 * are the replacement for that assumption, and this file is what says they
 * are right — by pinning the octagon numbers that exposed the fault, and by
 * pinning that **a rectangle's answers are unchanged**, which is the property
 * that makes them safe to adopt.
 */

const PITCH = 4;
const EAVE_FT = 10;
const shed = { form: "shed" as const, pitchIn12: PITCH, eaveHeightFt: EAVE_FT };
const peaked = { form: "peaked" as const, pitchIn12: PITCH, eaveHeightFt: EAVE_FT };

/** Keyed by compass direction, which is how the fault reads on screen. */
function topsByDirection(fp: Footprint, options: Parameters<typeof simpleRoofPlanes>[1]) {
  const roof = simpleRoofPlanes(fp, options);
  const out: Record<string, { startIn: number; endIn: number; tallerIn: number }> = {};
  for (const top of wallRoofTopsFor(fp, roof, options.eaveHeightFt)) {
    const wall = fp.walls.find((w) => w.id === top.wallId)!;
    out[wallCompassDirection(wall, fp)] = {
      startIn: Number(top.startAboveEaveIn.toFixed(2)),
      endIn: Number(top.endAboveEaveIn.toFixed(2)),
      tallerIn: Number(top.tallerAboveEaveIn.toFixed(2)),
    };
  }
  return out;
}

describe("⚠ a rectangle's answers are exactly what the app already draws", () => {
  /* The safety property. If these moved, adopting this function would change
     every rectangular building in the app, which is not what it is for. */
  it("a 24 x 16 shed: the gable walls run 0 -> 64in and the eave wall is flat", () => {
    const fp = buildRectangleFootprint(24, 16);
    const tops = topsByDirection(fp, shed);
    /* 16ft of fall at 4:12 = 64in, which is the rise the Tiny House is given. */
    expect(tops.E!.tallerIn).toBeCloseTo(64, 2);
    expect(tops.W!.tallerIn).toBeCloseTo(64, 2);
    /* ⚠ One end of each gable wall sits ON the eave — the triangle the row
       already draws. The two walls are wound opposite ways round the
       footprint, which is why one reads 64 -> 0 and the other 0 -> 64. */
    expect(Math.min(tops.E!.startIn, tops.E!.endIn)).toBeCloseTo(0, 2);
    expect(Math.min(tops.W!.startIn, tops.W!.endIn)).toBeCloseTo(0, 2);
    /* The low eave wall needs nothing; the tall one is level at full rise and
       is closed by the cross-tilt row, not by a gable row. */
    expect(tops.S!.tallerIn).toBeCloseTo(0, 2);
    expect(tops.N!.startIn).toBeCloseTo(64, 2);
    expect(tops.N!.endIn).toBeCloseTo(64, 2);
  });

  it("a 48 x 24 peak: both gable walls rise to the ridge and both eave walls are flat", () => {
    const fp = buildRectangleFootprint(48, 24);
    const tops = topsByDirection(fp, peaked);
    /* ⚠ **EVERY CORNER OF A PEAKED RECTANGLE IS AT THE EAVE** — all four
       walls read 0 at both ends, and that is correct. A peaked gable wall
       crosses the RIDGE, so its high point is in the MIDDLE of the wall and
       no CORNER height can describe it. */
    expect(tops.E!.startIn).toBeCloseTo(0, 2);
    expect(tops.E!.endIn).toBeCloseTo(0, 2);
    expect(tops.N!.tallerIn).toBeCloseTo(0, 2);
    expect(tops.S!.tallerIn).toBeCloseTo(0, 2);
    /* ⚠ ...which is exactly why `ridgeCrossing` exists. Half of 24ft at 4:12
       is 48in, in the middle of the gable wall — the rise The Tank is given.
       Reported here, so a row over such a wall can carry an interior point and
       does not come out flat across its top. */
    const roof = simpleRoofPlanes(fp, peaked);
    const crossings = wallRoofTopsFor(fp, roof, EAVE_FT).filter((t) => t.ridgeCrossing !== null);
    expect(crossings).toHaveLength(2);
    for (const c of crossings) {
      const wall = fp.walls.find((w) => w.id === c.wallId)!;
      expect(["E", "W"]).toContain(wallCompassDirection(wall, fp));
      expect(c.ridgeCrossing!.aboveEaveIn).toBeCloseTo(48, 2);
      /* Dead centre of a 24ft wall. */
      expect(c.ridgeCrossing!.atIn).toBeCloseTo(144, 2);
      /* And `tallerAboveEaveIn` counts it, since it is the tallest thing on
         the wall — what has to be filled for the wall to be closed. */
      expect(c.tallerAboveEaveIn).toBeCloseTo(48, 2);
    }
    /* The two EAVE walls run alongside the ridge and are never crossed by it. */
    expect(wallRoofTopsFor(fp, roof, EAVE_FT).filter((t) => t.ridgeCrossing === null)).toHaveLength(2);
    expect(roofHeightFtAt({ x: 24, y: 12 }, roof)).toBeCloseTo(EAVE_FT + 4, 6);
  });
});

describe("⚠ a shed has no ridge to cross", () => {
  it("nothing on a rectangle, nothing on an octagon", () => {
    for (const fp of [buildRectangleFootprint(24, 16), buildOctagonFootprint(16, 16)]) {
      const roof = simpleRoofPlanes(fp, shed);
      expect(wallRoofTopsFor(fp, roof, EAVE_FT).every((t) => t.ridgeCrossing === null)).toBe(true);
    }
  });

  it("⚠ a PEAKED octagon's two E/W facets are crossed, and its diagonals are not", () => {
    /* The 32ft Octagon tile. Its E facet's corners are both 37.5in up while
       the ridge above its midpoint is 64in — a 26.5in flat top without this. */
    const fp = buildOctagonFootprint(32, 32);
    const roof = simpleRoofPlanes(fp, peaked);
    const tops = wallRoofTopsFor(fp, roof, EAVE_FT);
    const crossed = tops.filter((t) => t.ridgeCrossing !== null);
    expect(crossed.map((t) => wallCompassDirection(fp.walls.find((w) => w.id === t.wallId)!, fp)).sort()).toEqual(["E", "W"]);
    for (const c of crossed) {
      expect(c.startAboveEaveIn).toBeCloseTo(37.5, 1);
      expect(c.endAboveEaveIn).toBeCloseTo(37.5, 1);
      expect(c.ridgeCrossing!.aboveEaveIn).toBeCloseTo(64, 1);
      expect(c.tallerAboveEaveIn).toBeCloseTo(64, 1);
    }
  });
});

describe("⚠ an octagon shed — the numbers that exposed the fault", () => {
  it("a 16ft octagon: seven walls carry roof, and not one of them starts at the eave", () => {
    const fp = buildOctagonFootprint(16, 16);
    const tops = topsByDirection(fp, shed);

    /* Measured 2026-11-15. The N wall is level at the full 64in rise; every
       diagonal facet is a trapezoid raked ACROSS the roof's fall; only the S
       wall, down where the shed runs out, needs nothing. */
    expect(tops.N!.startIn).toBeCloseTo(64, 1);
    expect(tops.N!.endIn).toBeCloseTo(64, 1);
    expect(tops.NE!.tallerIn).toBeCloseTo(64, 1);
    expect(Math.min(tops.NE!.startIn, tops.NE!.endIn)).toBeCloseTo(45.25, 1);
    expect(tops.E!.tallerIn).toBeCloseTo(45.25, 1);
    expect(Math.min(tops.E!.startIn, tops.E!.endIn)).toBeCloseTo(18.75, 1);
    expect(tops.SE!.tallerIn).toBeCloseTo(18.75, 1);
    expect(Math.min(tops.SE!.startIn, tops.SE!.endIn)).toBeCloseTo(0, 1);
    expect(tops.S!.tallerIn).toBeCloseTo(0, 2);
    /* The west side mirrors the east exactly. */
    expect(tops.NW!.tallerIn).toBeCloseTo(tops.NE!.tallerIn, 2);
    expect(tops.W!.tallerIn).toBeCloseTo(tops.E!.tallerIn, 2);
    expect(tops.SW!.tallerIn).toBeCloseTo(tops.SE!.tallerIn, 2);

    /* ⚠ **The E facet is the one the app draws today, and it draws it wrong.**
       Its row runs 27in down to 0 — a triangle standing on the eave — where
       the roof over its corners is 45.25in and 18.75in. Neither end meets. */
    expect(tops.E!.tallerIn).not.toBeCloseTo(27, 0);
    expect(Math.min(tops.E!.startIn, tops.E!.endIn)).toBeGreaterThan(1);
  });

  it("⚠ only ONE of the walls carrying roof is already closed, and it is the cross-tilt wall", () => {
    /* This is the correction to the sweep's first reading, which counted five
       walls as open. The shed's tall wall is closed by the cross-tilt row
       (`crossTiltWallIdsFor` -> `shedTallWallId`), so the walls genuinely with
       nothing over them are the FOUR diagonals — plus the two E/W facets whose
       row is drawn at the wrong heights. */
    const fp = buildOctagonFootprint(16, 16);
    const roof = simpleRoofPlanes(fp, shed);
    const tallId = shedTallWallId(fp, shed);
    const tall = fp.walls.find((w) => w.id === tallId)!;
    expect(wallCompassDirection(tall, fp)).toBe("N");

    const needRoof = wallRoofTopsFor(fp, roof, EAVE_FT).filter((t) => t.tallerAboveEaveIn > 1e-6);
    expect(needRoof).toHaveLength(7);

    const uncovered = needRoof.filter((t) => t.wallId !== tallId && !roof.gableWallIds.includes(t.wallId));
    expect(uncovered).toHaveLength(4);
    expect(
      uncovered.map((t) => wallCompassDirection(fp.walls.find((w) => w.id === t.wallId)!, fp)).sort(),
    ).toEqual(["NE", "NW", "SE", "SW"]);
    /* ⚠ And the tallest thing standing open is 64in — an NE/NW facet, not the
       N wall, which the cross-tilt row already closes. */
    expect(Math.max(...uncovered.map((t) => t.tallerAboveEaveIn))).toBeCloseTo(64, 1);
  });

  it("a 32ft octagon doubles every one of those heights", () => {
    /* The rise scales with the span, so the open wall does too: 128in, which
       is 10ft 8in of nothing above a 10ft wall. */
    const fp = buildOctagonFootprint(32, 32);
    const tops = topsByDirection(fp, shed);
    expect(tops.N!.startIn).toBeCloseTo(128, 1);
    expect(tops.NE!.tallerIn).toBeCloseTo(128, 1);
    expect(tops.E!.tallerIn).toBeCloseTo(90.5, 1);
    expect(tops.SE!.tallerIn).toBeCloseTo(37.5, 1);
    expect(tops.S!.tallerIn).toBeCloseTo(0, 2);
  });
});

describe("roofHeightFtAt", () => {
  it("reads the plane it is standing on, and clamps rather than extrapolating", () => {
    const fp = buildRectangleFootprint(24, 16);
    const roof = simpleRoofPlanes(fp, shed);
    const plane = roof.planes[0]!;
    /* The two edges answer with the two edge heights... */
    expect(roofHeightFtAt({ x: 12, y: plane.lowStart.y }, roof)).toBeCloseTo(EAVE_FT, 6);
    expect(roofHeightFtAt({ x: 12, y: plane.highStart.y }, roof)).toBeCloseTo(EAVE_FT + 16 * (PITCH / 12), 6);
    /* ...the middle answers with the middle... */
    expect(roofHeightFtAt({ x: 12, y: (plane.lowStart.y + plane.highStart.y) / 2 }, roof)).toBeCloseTo(
      EAVE_FT + 8 * (PITCH / 12),
      6,
    );
    /* ...and a point past the end does NOT keep climbing. */
    expect(roofHeightFtAt({ x: 12, y: plane.highStart.y - 50 }, roof)).toBeCloseTo(EAVE_FT + 16 * (PITCH / 12), 6);
  });

  it("picks the right side of a peak", () => {
    const fp = buildRectangleFootprint(48, 24);
    const roof = simpleRoofPlanes(fp, peaked);
    expect(roof.planes).toHaveLength(2);
    /* Both eaves at the eave, the middle at the ridge. */
    expect(roofHeightFtAt({ x: 24, y: 0 }, roof)).toBeCloseTo(EAVE_FT, 6);
    expect(roofHeightFtAt({ x: 24, y: 24 }, roof)).toBeCloseTo(EAVE_FT, 6);
    expect(roofHeightFtAt({ x: 24, y: 12 }, roof)).toBeCloseTo(EAVE_FT + 12 * (PITCH / 12), 6);
    /* A quarter of the way in is half way up, on both sides alike. */
    expect(roofHeightFtAt({ x: 24, y: 6 }, roof)).toBeCloseTo(EAVE_FT + 6 * (PITCH / 12), 6);
    expect(roofHeightFtAt({ x: 24, y: 18 }, roof)).toBeCloseTo(EAVE_FT + 6 * (PITCH / 12), 6);
  });

  it("answers null when there is no roof to stand on", () => {
    const fp = buildRectangleFootprint(24, 16);
    const refused = simpleRoofPlanes(fp, { ...shed, pitchIn12: -1 });
    expect(refused.refusal).not.toBeNull();
    expect(roofHeightFtAt({ x: 0, y: 0 }, refused)).toBeNull();
  });
});
