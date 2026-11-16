import { describe, expect, it } from "vitest";
import {
  buildOctagonFootprint,
  buildRectangleFootprint,
  roofHeightFtAt,
  shedTallWallId,
  simpleRoofPlanes,
  wallCompassDirection,
  wallRoofCrossRiseIn,
  type Footprint,
  type Point,
  type SimpleRoofOptions,
  type Wall,
} from "@building-integrity/geometry";
import { buildGablePanelMembers, gableTopDivesIntoBottom } from "@building-integrity/panel-catalog";
import { memberLocalCornersIn } from "@building-integrity/panel-catalog";

/**
 * ⚠ **THE WHOLE POINT, END TO END: a gable panel's top IS the roof plane.**
 *
 * > *"You're right, it is not flush for the roof at the top, can we make the
 * > top of Gable and dual beveled So that the roof can meet it?"* — Tommy,
 * > 2026-11-16
 *
 * The part is tested in the catalogue and the cross rise in the geometry
 * package; what neither can show is that the two COMPOSE. This builds each
 * facet's panel the way `page.tsx` does — roof planes, then
 * `wallRoofCrossRiseIn`, then `buildGablePanelMembers` — and then asks the
 * built panel where its top surface is, at all four of its top corners,
 * against the roof sampled at those same four points on the plan.
 *
 * ⚠ The LIFT (`gableTileRoofTopLiftIn`, which raises a full-height gable to
 * the roof's top surface rather than its underside) is deliberately left out:
 * it is one vertical offset applied to the whole panel, so it cannot change
 * the plane's tilt, and including it would only test addition.
 */

const THICK_IN = 15.5;
const PITCH = 4;
const EAVE_FT = 8;
const SHED: SimpleRoofOptions = { form: "shed", pitchIn12: PITCH, eaveHeightFt: EAVE_FT };

/** Inward normal, from the footprint's global winding — the same rule
 *  `wallRoofCrossRiseIn` uses, restated here so the test samples the plan
 *  independently of the function under test. */
function wallFrame(fp: Footprint, wall: Wall) {
  const byId = new Map(fp.corners.map((c) => [c.id, c.point]));
  const a = byId.get(wall.startCorner)!;
  const b = byId.get(wall.endCorner)!;
  const lengthFt = Math.hypot(b.x - a.x, b.y - a.y);
  const dir = { x: (b.x - a.x) / lengthFt, y: (b.y - a.y) / lengthFt };
  return { a, b, lengthFt, inward: { x: -dir.y, y: dir.x } };
}

/** The four top-face corners of a built panel's top skin, in panel space:
 *  (x along the width, y through the depth, z up from the panel's base). */
function topSkinCorners(members: ReturnType<typeof buildGablePanelMembers>) {
  const skin = members.find((m) => m.memberId === "top_plate_skin")!;
  const byColumn = new Map<string, { xIn: number; yIn: number; zIn: number }>();
  /* `memberLocalCornersIn` returns VIEW space: [x, up, depth]. */
  for (const [xIn, upIn, depthIn] of memberLocalCornersIn(skin)) {
    const key = `${xIn.toFixed(6)}|${depthIn.toFixed(6)}`;
    const seen = byColumn.get(key);
    if (!seen || upIn > seen.zIn) byColumn.set(key, { xIn, yIn: depthIn, zIn: upIn });
  }
  return [...byColumn.values()];
}

/** Fit z = a + b*x + c*y through the points and report the worst residual. */
function planeFit(points: { xIn: number; yIn: number; zIn: number }[]) {
  const [p, q, r] = points;
  if (!p || !q || !r) throw new Error("need three points");
  const d = (q.xIn - p.xIn) * (r.yIn - p.yIn) - (r.xIn - p.xIn) * (q.yIn - p.yIn);
  const b = ((q.zIn - p.zIn) * (r.yIn - p.yIn) - (r.zIn - p.zIn) * (q.yIn - p.yIn)) / d;
  const c = ((r.zIn - p.zIn) * (q.xIn - p.xIn) - (q.zIn - p.zIn) * (r.xIn - p.xIn)) / d;
  const a = p.zIn - b * p.xIn - c * p.yIn;
  let worst = 0;
  for (const pt of points) worst = Math.max(worst, Math.abs(pt.zIn - (a + b * pt.xIn + c * pt.yIn)));
  return { worstResidualIn: worst, at: (xIn: number, yIn: number) => a + b * xIn + c * yIn };
}

/** Build one facet's gable panel exactly as `page.tsx` composes it. */
function facetPanel(fp: Footprint, wall: Wall, roof: ReturnType<typeof simpleRoofPlanes>) {
  const frame = wallFrame(fp, wall);
  const aboveEaveIn = (p: Point) => Math.max(0, ((roofHeightFtAt(p, roof) ?? 0) - EAVE_FT) * 12);
  const leftIn = aboveEaveIn(frame.a);
  const rightIn = aboveEaveIn(frame.b);
  const cross = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN)!;
  const crossIn = cross.planar ? (cross.startIn + cross.endIn) / 2 : 0;
  const widthIn = frame.lengthFt * 12;
  return {
    frame,
    leftIn,
    rightIn,
    crossIn,
    widthIn,
    members: buildGablePanelMembers(widthIn, THICK_IN, leftIn, rightIn, false, undefined, crossIn),
  };
}

describe("⚠ the 16ft Octagon shed — every facet's gable top lands in the roof plane", () => {
  const fp = buildOctagonFootprint(16, 16);
  const roof = simpleRoofPlanes(fp, SHED);
  const tallWallId = shedTallWallId(fp, SHED);
  /* The walls that carry a row: roof above them, and not the shed's tall wall,
     which the cross-tilt row closes instead. */
  const carrying = fp.walls.filter((w) => {
    if (w.id === tallWallId) return false;
    const frame = wallFrame(fp, w);
    const top = Math.max((roofHeightFtAt(frame.a, roof) ?? 0) - EAVE_FT, (roofHeightFtAt(frame.b, roof) ?? 0) - EAVE_FT);
    return top * 12 > 1.5;
  });

  it("there are five of them, and their compass names", () => {
    expect(carrying.map((w) => wallCompassDirection(w, fp)).sort()).toEqual(["NE", "NW", "SE", "SW"].concat(["E", "W"]).sort());
  });

  for (const wall of carrying) {
    it(`⚠ every tile of the ${wallCompassDirection(wall, fp)} facet lands in the roof plane`, () => {
      /* ⚠ **TILED, because the app tiles.** A whole facet built as one panel
         runs out to nothing at a shed's low corner, which puts it in the band
         where the top and bottom plates merge and the bevel is refused (see
         `gableTopDivesIntoBottom`). Only the LAST tile of such a facet is
         really in that band; the rest carry the bevel. Testing a facet as one
         panel measured a shape the app never builds. */
      const frame = wallFrame(fp, wall);
      const widthIn = frame.lengthFt * 12;
      const tiles = Math.max(1, Math.ceil(widthIn / 48));
      const tileWidthIn = widthIn / tiles;
      const depthFt = THICK_IN / 12;
      const along = (t: number): Point => ({
        x: frame.a.x + ((frame.b.x - frame.a.x) * t) / widthIn,
        y: frame.a.y + ((frame.b.y - frame.a.y) * t) / widthIn,
      });
      const inset = (p: Point): Point => ({
        x: p.x + frame.inward.x * depthFt,
        y: p.y + frame.inward.y * depthFt,
      });
      const roofAt = (p: Point) => Math.max(0, ((roofHeightFtAt(p, roof) ?? 0) - EAVE_FT) * 12);
      const cross = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN)!;
      const crossIn = cross.planar ? (cross.startIn + cross.endIn) / 2 : 0;

      let bevelled = 0;
      let flat = 0;
      for (let i = 0; i < tiles; i++) {
        const x0 = i * tileWidthIn;
        const x1 = (i + 1) * tileWidthIn;
        const leftIn = roofAt(along(x0));
        const rightIn = roofAt(along(x1));
        if (Math.max(leftIn, rightIn) < 1.5) continue;
        const refused = gableTopDivesIntoBottom(tileWidthIn, THICK_IN, leftIn, rightIn, crossIn);
        const members = buildGablePanelMembers(tileWidthIn, THICK_IN, leftIn, rightIn, false, undefined, crossIn);
        const fit = planeFit(topSkinCorners(members));
        expect(fit.worstResidualIn, "a tile's own top must be ONE plane").toBeLessThan(1e-9);
        if (refused) {
          flat += 1;
          /* A refused tile is built FLAT across its depth — the panel this app
             built before 2026-11-16, which is a statement, not a silence. */
          expect(fit.at(0, THICK_IN)).toBeCloseTo(fit.at(0, 0), 9);
          continue;
        }
        bevelled += 1;
        for (const [xIn, yIn, roofIn] of [
          [0, 0, roofAt(along(x0))],
          [tileWidthIn, 0, roofAt(along(x1))],
          [0, THICK_IN, roofAt(inset(along(x0)))],
          [tileWidthIn, THICK_IN, roofAt(inset(along(x1)))],
        ] as [number, number, number][]) {
          expect(fit.at(xIn, yIn), `tile ${i} x=${xIn} y=${yIn}`).toBeCloseTo(roofIn, 6);
        }
      }
      expect(bevelled + flat, "every tile is accounted for").toBeGreaterThan(0);
      /* ⚠ Only a facet that RUNS OUT to the eave loses a tile's bevel, and
         only its last one. */
      expect(flat, `${wallCompassDirection(wall, fp)} flat tiles`).toBeLessThanOrEqual(1);
    });
  }

  it("⚠ four of the six really are bevelled, and E/W are not — the fault he reported", () => {
    const bevelled = carrying
      .filter((w) => Math.abs(facetPanel(fp, w, roof).crossIn) > 1e-9)
      .map((w) => wallCompassDirection(w, fp))
      .sort();
    expect(bevelled).toEqual(["NE", "NW", "SE", "SW"]);
  });

  it("⚠ the NE and SE facets are MIRROR parts, not copies", () => {
    /* Which is why the shop-sheet group key has to carry the cross rise: these
       two can land on the same width and the same two edge heights. */
    const ne = facetPanel(fp, fp.walls.find((w) => wallCompassDirection(w, fp) === "NE")!, roof);
    const se = facetPanel(fp, fp.walls.find((w) => wallCompassDirection(w, fp) === "SE")!, roof);
    expect(ne.crossIn).toBeCloseTo(-se.crossIn, 6);
    expect(Math.abs(ne.crossIn)).toBeCloseTo(3.6534, 3);
  });

  it("⚠ and without the second bevel the roof misses by 3.653in — the measured gap", () => {
    const wall = fp.walls.find((w) => wallCompassDirection(w, fp) === "NE")!;
    const panel = facetPanel(fp, wall, roof);
    const flat = buildGablePanelMembers(panel.widthIn, THICK_IN, panel.leftIn, panel.rightIn, false);
    const fit = planeFit(topSkinCorners(flat));
    const depthFt = THICK_IN / 12;
    const interior: Point = {
      x: panel.frame.a.x + panel.frame.inward.x * depthFt,
      y: panel.frame.a.y + panel.frame.inward.y * depthFt,
    };
    const roofIn = ((roofHeightFtAt(interior, roof) ?? 0) - EAVE_FT) * 12;
    expect(Math.abs(fit.at(0, THICK_IN) - roofIn)).toBeCloseTo(3.6534, 3);
  });
});

describe("⚠ a box is untouched, end to end", () => {
  for (const form of ["shed", "peaked"] as const) {
    it(`a 40 x 20 ${form} builds its gable panels with no bevel at all`, () => {
      const fp = buildRectangleFootprint(40, 20);
      const roof = simpleRoofPlanes(fp, { ...SHED, form });
      const tallWallId = form === "shed" ? shedTallWallId(fp, { ...SHED, form }) : null;
      for (const wall of fp.walls) {
        if (wall.id === tallWallId) continue;
        const cross = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN)!;
        /* The two walls that carry a row run straight down the fall. The eave
           walls read the full pitch and carry no row — a shed's low wall has
           no roof above it and its tall wall takes the cross-tilt row. */
        const frame = wallFrame(fp, wall);
        const carriesRow =
          Math.max(
            (roofHeightFtAt(frame.a, roof) ?? 0) - EAVE_FT,
            (roofHeightFtAt(frame.b, roof) ?? 0) - EAVE_FT,
          ) *
            12 >
            1.5 && Math.abs((roofHeightFtAt(frame.a, roof) ?? 0) - (roofHeightFtAt(frame.b, roof) ?? 0)) > 1e-9;
        if (!carriesRow) continue;
        expect(cross.startIn, `${wall.id}`).toBeCloseTo(0, 9);
        const panel = facetPanel(fp, wall, roof);
        expect(panel.crossIn).toBeCloseTo(0, 9);
        expect(panel.members).toEqual(
          buildGablePanelMembers(panel.widthIn, THICK_IN, panel.leftIn, panel.rightIn, false),
        );
      }
    });
  }
});
