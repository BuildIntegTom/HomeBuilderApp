import type { Footprint, InteriorWall, Point } from "./types";
import type { SimpleRoofPlane, SimpleRoofResult } from "./simpleRoofPlanes";

/**
 * ⚠ **AN INTERIOR WALL PART WAY UP A ROOF PLANE — B34 stride 3c, 2026-11-17.**
 *
 * A roof panel is 18ft long at most, and a panel is the hypotenuse over the
 * ground it covers, so the ground it reaches *falls* as the pitch rises: 17.1ft
 * at 4:12, **15.0ft at 8:12**. His 36ft Multiplex needs 18ft of ground a side,
 * and `decideRoofForm` has always had a word for that —
 *
 * > *"This roof needs a bearing line between the wall and the ridge, which
 * > nothing models yet."*
 *
 * This is that bearing line. Asked how to carry it, Tommy chose **a second
 * interior wall under each purlin** (2026-11-17) over posts to the floor, over
 * raking struts back to the centre wall, and over a knee wall off a loft deck.
 *
 * ## ⚠ And therefore there is NO PURLIN BEAM
 *
 * That falls straight out of stride 3's own rule rather than being a second
 * decision: a beam catches panel ends that are over nothing, and a wall under
 * the line already catches them (`roofNeedsRidgeBeam`). So a bearing line here
 * is **not a part**. It is a place where one run of roof panels becomes two,
 * each landing on the wall from its own side — the lower band's plumb tall end
 * and the upper band's square eave end, both bearing on the same wall top, in
 * exactly the arrangement the ridge wall already gets.
 *
 * ## ⚠ The wall has to be PARALLEL to the eave, not merely inside the building
 *
 * A wall crossing the plane at any other angle meets the panel run diagonally,
 * so every panel in the band would break at a different distance and the band
 * would not be a band at all. Those walls are ignored here rather than
 * refused: they are perfectly good walls, they simply do not carry a roof.
 *
 * ## ⚠ The ridge wall is excluded by construction
 *
 * It sits AT the high edge, distance `runFt`, and every line here must be
 * STRICTLY inside the run. So a Multiplex's three interior walls sort
 * themselves out with no special case: the centre one carries the ridge
 * (`ridgeBearingWallFor`), the other two split the planes.
 */

/** Nothing closer to an edge than this counts as being inside the run: an
 *  eighth of an inch, in feet, the same grid `quantizeFootprint` works on. */
const INSIDE_RUN_TOLERANCE_FT = 0.125 / 12;

/** How near parallel a wall must be to the eave to carry a band. A hundredth
 *  of a foot of drift across the run — about 1/8in over 12ft — is the most a
 *  quantized wall can pick up. */
const PARALLEL_TOLERANCE = 1e-3;

export interface RoofBearingLine {
  /** The interior wall carrying it. */
  wallId: string;
  /** How far along the plane's RUN it sits, measured on the ground from the
   *  plane's low (eave) edge, in feet. Always strictly between 0 and `runFt`. */
  atRunFt: number;
}

export interface RoofPlaneBands {
  /** Index into `SimpleRoofResult.planes`. */
  planeIndex: number;
  /**
   * The ground run of each band, low to high, **summing exactly to the plane's
   * own `runFt`**. A plane with no bearing line returns a single band, which is
   * what every roof in this app was before stride 3c.
   */
  bandRunsFt: number[];
  /** The bearing line at the TOP of each band except the last, so
   *  `bearingLines.length === bandRunsFt.length - 1`. */
  bearingLines: RoofBearingLine[];
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Where an interior wall crosses one plane, as a distance along its run.
 *
 * Returns null unless the wall is parallel to the eave and strictly inside the
 * run.
 */
function bearingLineOnPlane(wall: InteriorWall, plane: SimpleRoofPlane): RoofBearingLine | null {
  const eaveDx = plane.lowEnd.x - plane.lowStart.x;
  const eaveDy = plane.lowEnd.y - plane.lowStart.y;
  const eaveLen = Math.hypot(eaveDx, eaveDy);
  if (!(eaveLen > 0) || !(plane.runFt > 0)) return null;

  const wallDx = wall.end.x - wall.start.x;
  const wallDy = wall.end.y - wall.start.y;
  const wallLen = Math.hypot(wallDx, wallDy);
  if (!(wallLen > 0)) return null;

  /* Parallel to the eave: the cross product of the two unit directions is
     zero. Sign does not matter — a wall drawn the other way round is the same
     wall. */
  const cross = (eaveDx / eaveLen) * (wallDy / wallLen) - (eaveDy / eaveLen) * (wallDx / wallLen);
  if (Math.abs(cross) > PARALLEL_TOLERANCE) return null;

  /* The unit vector pointing up the slope on the ground, from the low edge's
     midpoint toward the high edge's. */
  const lowMid = midpoint(plane.lowStart, plane.lowEnd);
  const highMid = midpoint(plane.highStart, plane.highEnd);
  const upDx = highMid.x - lowMid.x;
  const upDy = highMid.y - lowMid.y;
  const upLen = Math.hypot(upDx, upDy);
  if (!(upLen > 0)) return null;

  /* ⚠ Projected from the wall's START, which is enough BECAUSE the wall is
     already known to be parallel to the eave: both of its ends are the same
     distance up the slope. That is not true of any other wall, which is why
     the parallel test comes first rather than being a tidy-up afterwards. */
  const atRunFt = ((wall.start.x - lowMid.x) * upDx + (wall.start.y - lowMid.y) * upDy) / upLen;
  if (atRunFt <= INSIDE_RUN_TOLERANCE_FT) return null;
  if (atRunFt >= plane.runFt - INSIDE_RUN_TOLERANCE_FT) return null;
  return { wallId: wall.id, atRunFt };
}

/**
 * Every plane's bands, in order from the eave up.
 *
 * ⚠ **The returned runs sum EXACTLY to the plane's own `runFt`** — the last
 * band is the remainder rather than its own subtraction, so no rounding can
 * leave a strip of roof uncovered. That is [[dimensional-tightness-principle]]
 * applied up the slope instead of along a wall.
 */
export function roofBearingBands(footprint: Footprint, roof: SimpleRoofResult): RoofPlaneBands[] {
  const interior = footprint.interiorWalls ?? [];
  return roof.planes.map((plane, planeIndex) => {
    const lines: RoofBearingLine[] = [];
    for (const wall of interior) {
      const line = bearingLineOnPlane(wall, plane);
      /* Two walls on the same line would make a zero-width band. Keeping the
         first is arbitrary but harmless: they are the same bearing. */
      if (line && !lines.some((l) => Math.abs(l.atRunFt - line.atRunFt) <= INSIDE_RUN_TOLERANCE_FT)) lines.push(line);
    }
    lines.sort((a, b) => a.atRunFt - b.atRunFt);

    const bandRunsFt: number[] = [];
    let previousFt = 0;
    for (const line of lines) {
      bandRunsFt.push(line.atRunFt - previousFt);
      previousFt = line.atRunFt;
    }
    bandRunsFt.push(plane.runFt - previousFt);
    return { planeIndex, bandRunsFt, bearingLines: lines };
  });
}

/**
 * The LONGEST ground run any one panel has to cover on this roof, which is the
 * number the 18ft panel limit actually judges.
 *
 * ⚠ **Before stride 3c this was simply the plane's run**, and that is the
 * figure `decideRoofForm` still refuses against. With a bearing line it is the
 * worst band instead, so a building that could not be roofed at all becomes
 * one that can — which is the whole point of his answer, and the one place
 * the rest of the app has to learn the difference.
 */
export function longestBandRunFt(bands: RoofPlaneBands[]): number {
  let worst = 0;
  for (const plane of bands) for (const run of plane.bandRunsFt) worst = Math.max(worst, run);
  return worst;
}
