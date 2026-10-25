import type { Footprint, Point } from "./types";
import { footprintSpanAndRun } from "./joistLayout";
import { wallCompassDirection } from "./wallCompassDirection";

/**
 * The roof over an ordinary rectangular building: one sloped plane, or two
 * meeting at a ridge.
 *
 * `ringRoofPlanes` already does this for a courtyard ring, where the roof
 * slopes outward in every direction and there is no ridge at all. This is its
 * sibling for the simple case, and the two deliberately share nothing but the
 * idea of a plane, because a ring has no gable ends and a rectangle has no
 * hole.
 */

export type RoofForm = "shed" | "peaked";

export interface SimpleRoofPlane {
  /** Plan corners. The low edge is the eave, the high edge is the ridge on a
   * peaked roof or the tall wall on a shed. */
  lowStart: Point;
  lowEnd: Point;
  highStart: Point;
  highEnd: Point;
  lowHeightFt: number;
  highHeightFt: number;
  /** Ground this plane covers, which is what the panel length is judged
   * against once the pitch is applied. */
  runFt: number;
  /** The real sloped length a panel has to reach. */
  slopeFt: number;
}

export interface SimpleRoofResult {
  form: RoofForm;
  planes: SimpleRoofPlane[];
  /** The axis the ridge (or the shed's high edge) runs along. */
  ridgeAxis: "x" | "y";
  /** Walls that carry a gable end — the ones at the ends of the ridge. */
  gableWallIds: string[];
  /** ⚠ Non-null when the rule could not be followed, saying which rule. */
  orientationNote: string | null;
  refusal: string | null;
}

export interface SimpleRoofOptions {
  form: RoofForm;
  pitchIn12: number;
  /** Height of the LOW edge above the floor. */
  eaveHeightFt: number;
  /** Shed only. Default puts the tall side north so the roof faces south;
   * `false` flips it, which he asked for outright. */
  tallSideNorth?: boolean;
}

/**
 * ⚠ WHICH WAY THE RIDGE RUNS, and why it is not simply "the long way".
 *
 * > *"it should default to have the largest roof surface area face south. On
 * > a square building gable ends should be east and west with half the roof
 * > facing the sun."* — Tommy, 2026-10-24
 *
 * Gable ends go on the SHORT walls, which puts the ridge along the long
 * dimension and the roof planes facing the long sides. On a square there is
 * no short wall, so the tie goes to east/west gables — the ridge runs
 * east-west and both planes face the sun.
 *
 * ⚠ Those two rules can disagree. A building that is long north-to-south has
 * its short walls east and west, so the ridge runs north-south and the planes
 * face EAST and WEST, not south. The short-wall rule wins because he gave it
 * first and it is the structural one, and `orientationNote` says so rather
 * than letting a south-facing roof be quietly assumed.
 */
export function simpleRoofPlanes(footprint: Footprint, options: SimpleRoofOptions): SimpleRoofResult {
  const { minX, maxX, minY, maxY } = footprintSpanAndRun(footprint);
  const widthFt = maxX - minX;
  const depthFt = maxY - minY;
  const empty = { planes: [], gableWallIds: [], orientationNote: null };

  if (!(widthFt > 0) || !(depthFt > 0)) {
    return { ...empty, form: options.form, ridgeAxis: "x", refusal: "This building has no footprint to roof." };
  }
  if (!(options.pitchIn12 >= 0)) {
    return { ...empty, form: options.form, ridgeAxis: "x", refusal: "A roof needs a pitch before its planes can be placed." };
  }

  /* Ridge along the longer dimension, so the gables land on the short walls.
     A square ties to X, which is east-west. */
  const ridgeAxis: "x" | "y" = depthFt <= widthFt ? "x" : "y";
  const runFt = (ridgeAxis === "x" ? depthFt : widthFt) / (options.form === "peaked" ? 2 : 1);
  const riseFt = (runFt * options.pitchIn12) / 12;
  const slopeFt = Math.hypot(runFt, riseFt);

  /* Which walls get the gable: the ones whose outward face points along the
     ridge. Taken from `wallCompassDirection` rather than from coordinates, so
     this cannot disagree with the labels the user already reads. */
  const alongRidge = ridgeAxis === "x" ? ["E", "W"] : ["N", "S"];
  const gableWallIds = footprint.walls
    .filter((wall) => alongRidge.includes(wallCompassDirection(wall, footprint)))
    .map((wall) => wall.id);

  const facesSouth = ridgeAxis === "x";
  const orientationNote = facesSouth
    ? null
    : `This building is longer north-to-south, so its short walls are the east and west ones and the ridge ` +
      `runs north-south. The roof therefore faces EAST and WEST rather than south. Gable ends follow the short ` +
      `walls, which is the rule that wins here.`;

  const at = (x: number, y: number): Point => ({ x, y });
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const highFt = options.eaveHeightFt + riseFt;

  const planes: SimpleRoofPlane[] = [];
  const plane = (lowA: Point, lowB: Point, highA: Point, highB: Point): SimpleRoofPlane => ({
    lowStart: lowA,
    lowEnd: lowB,
    highStart: highA,
    highEnd: highB,
    lowHeightFt: options.eaveHeightFt,
    highHeightFt: highFt,
    runFt,
    slopeFt,
  });

  if (options.form === "peaked") {
    if (ridgeAxis === "x") {
      planes.push(plane(at(minX, minY), at(maxX, minY), at(minX, midY), at(maxX, midY)));
      planes.push(plane(at(minX, maxY), at(maxX, maxY), at(minX, midY), at(maxX, midY)));
    } else {
      planes.push(plane(at(minX, minY), at(minX, maxY), at(midX, minY), at(midX, maxY)));
      planes.push(plane(at(maxX, minY), at(maxX, maxY), at(midX, minY), at(midX, maxY)));
    }
  } else {
    /* ⚠ A shed's high side goes NORTH by default, so the single plane faces
       south: *"it should auto spawn tall side on the north but have a way to
       then switch it around."* North is screen-up, the same simplification
       `wallCompassDirection` already makes. */
    const tallNorth = options.tallSideNorth ?? true;
    if (ridgeAxis === "x") {
      const [lowY, highY] = tallNorth ? [maxY, minY] : [minY, maxY];
      planes.push(plane(at(minX, lowY), at(maxX, lowY), at(minX, highY), at(maxX, highY)));
    } else {
      /* Ridge runs north-south, so the shed falls east or west and "tall side
         north" cannot apply. Reported in orientationNote above. */
      const [lowX, highX] = tallNorth ? [maxX, minX] : [minX, maxX];
      planes.push(plane(at(lowX, minY), at(lowX, maxY), at(highX, minY), at(highX, maxY)));
    }
  }

  return { form: options.form, planes, ridgeAxis, gableWallIds, orientationNote, refusal: null };
}
