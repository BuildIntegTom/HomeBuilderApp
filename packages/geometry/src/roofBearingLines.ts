import type { Footprint, InteriorWall, Point } from "./types";
import { ridgeBearingWallFor, type SimpleRoofPlane, type SimpleRoofResult } from "./simpleRoofPlanes";

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

/**
 * ⚠ **EVERY INTERIOR WALL THAT CARRIES THE ROOF, AND HOW FAR ABOVE THE EAVE
 * THE ROOF SITS OVER IT — B34 stride 3b, 2026-11-18.**
 *
 * There are two kinds and they arrive from two different places: the wall
 * under the RIDGE (`ridgeBearingWallFor`, stride 3, which is also why that
 * roof has no ridge beam) and a wall part way up a PLANE (`roofBearingBands`,
 * stride 3c, likewise no purlin beam). A Multiplex has one of the first and
 * one of the second per side.
 *
 * ⚠ **This was computed inline inside the Review Log's own memo until stride
 * 3b**, which was fine while the only consumer was a sentence. It is now also
 * what decides how TALL those walls are built, and two derivations of "which
 * walls carry the roof" is how a building comes to be priced for a row the
 * log says is missing — or, worse, built to a height the log does not know
 * about. One function, both readers.
 *
 * ⚠ **The rise comes from the PLANE's own two heights, not from pitch x run.**
 * The arithmetic agrees exactly on a symmetric peak (and the Multiplex's 144in
 * is unchanged by the move), but the plane is the thing that was drawn, and an
 * off-centre or re-pitched roof is where the two would part company.
 *
 * Sorted tallest first, which is the order the Review Log reads them in.
 */
export interface InteriorRoofBearing {
  wallId: string;
  /** How far the roof's underside above this wall stands above the eave
   *  reference, in inches. The ridge wall's is the full rise. */
  aboveEaveIn: number;
}

export function interiorRoofBearingWalls(
  footprint: Footprint,
  roof: SimpleRoofResult,
  bands: RoofPlaneBands[],
): InteriorRoofBearing[] {
  const out: InteriorRoofBearing[] = [];
  /* ⚠ A SHED has no ridge wall even if a wall sits on the midline: its high
     edge is a wall of the outline, and `ridgeBearingWallFor` answers a
     question about a peak. A midline wall under a shed is picked up by the
     plane loop below like any other, at its own distance up the run. */
  if (roof.form === "peaked") {
    const ridge = ridgeBearingWallFor(footprint);
    if (ridge) {
      let riseIn = 0;
      for (const plane of roof.planes) riseIn = Math.max(riseIn, (plane.highHeightFt - plane.lowHeightFt) * 12);
      out.push({ wallId: ridge.wallId, aboveEaveIn: riseIn });
    }
  }
  for (const planeBands of bands) {
    const plane = roof.planes[planeBands.planeIndex];
    if (!plane || !(plane.runFt > 0)) continue;
    const riseIn = (plane.highHeightFt - plane.lowHeightFt) * 12;
    for (const line of planeBands.bearingLines) {
      /* The ridge wall can also read as a bearing line on a plane whose run
         reaches it; it is already in, at the full rise. */
      if (out.some((c) => c.wallId === line.wallId)) continue;
      out.push({ wallId: line.wallId, aboveEaveIn: (riseIn * line.atRunFt) / plane.runFt });
    }
  }
  return out.sort((a, b) => b.aboveEaveIn - a.aboveEaveIn);
}

/**
 * ⚠ **HIS RULE FOR HOW TALL ONE PANEL MAY BE ON SUCH A WALL — 2026-11-18.**
 *
 * > *"One panel whatever its height up until 16 ft tall peak. Otherwise break
 * > it down to 10 ft wall with another section above it"*
 *
 * Asked how the row above the ceiling should be built on a wall that carries
 * the roof, he answered about the WHOLE wall rather than about a row: a
 * bearing wall runs from its floor to the plate under the roof as **one
 * panel**, however tall that is, and only once the peak passes **16 ft** does
 * it break into courses.
 *
 * ⚠ **The "otherwise" branch is a rule this app already has**, which is what
 * makes it one decision rather than two: *"panels should have a default max
 * height of 10'... a wall taller than the selected max height spawns a 10'
 * panel and a 6' panel"* — `subdivideBandForMaxHeight`, greedy from the
 * bottom. So a wall over the limit is banded at the project's own
 * `maxPanelHeightIn` exactly as an over-tall outline wall is, and a wall under
 * it is **exempted** from that setting. The exemption is the new part: it is
 * the one place in the app where a panel is deliberately built taller than the
 * max-height setting allows, and the reason is a load path — the member
 * carrying the whole roof gets as few horizontal joints as it can.
 *
 * ⚠ **The peak, not the panel top, is what the 16ft is measured to**, because
 * that is what he said and because it is the number a person reads off a
 * section. The two differ by the bearing assembly's own 2¼in, which is exactly
 * the band where the distinction can flip the answer.
 */
export interface InteriorBearingWallBuild {
  wallId: string;
  /** How much taller than its story this wall is built. */
  aboveStoryIn: number;
  /** Its story's floor to the TOP of its panels — the plate's underside. */
  panelTopIn: number;
  /** Its story's floor to the roof's underside above it: his "peak". */
  peakIn: number;
  /** What to band this wall's columns at — `Infinity` is his one-panel case,
   *  i.e. do not subdivide however tall it is. */
  courseMaxHeightIn: number;
}

export function interiorBearingWallBuilds(
  bearing: readonly InteriorRoofBearing[],
  options: {
    /** The height of the story these walls stand on (the TOP story — the roof
     *  bears on that one). */
    storyHeightIn: number;
    /** The truss plate (or box beam) the roof lands on, which the panels are
     *  shortened by so the roof still arrives at the plane. */
    bearingAssemblyHeightIn: number;
    /** The project's own max panel height, used only past the limit. */
    maxPanelHeightIn: number;
    /** His 16ft. */
    onePanelPeakLimitIn: number;
  },
): InteriorBearingWallBuild[] {
  return bearing.map((wall) => {
    /* ⚠ The panels stop under the plate and the plate's top is the plane, so
       the panel top is the story height plus the rise — the assembly height
       cancels, exactly as it does on an eave wall, where `gableEaveHeightIn`
       is `roofBaseHeightIn` PLUS the same assembly. Subtracting it here as
       well would build every bearing wall 2¼in short. */
    const panelTopIn = options.storyHeightIn + Math.max(0, wall.aboveEaveIn);
    const peakIn = panelTopIn + options.bearingAssemblyHeightIn;
    return {
      wallId: wall.wallId,
      aboveStoryIn: Math.max(0, wall.aboveEaveIn),
      panelTopIn,
      peakIn,
      courseMaxHeightIn: peakIn <= options.onePanelPeakLimitIn ? Number.POSITIVE_INFINITY : options.maxPanelHeightIn,
    };
  });
}
