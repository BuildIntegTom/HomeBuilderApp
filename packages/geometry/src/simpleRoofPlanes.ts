import type { Footprint, Point } from "./types";
import { footprintSpanAndRun } from "./joistLayout";
import { wallCompassDirection, type CompassDirection } from "./wallCompassDirection";

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
  /** Which way the plane looks, taken from the eave wall under its low edge
   * so it can never disagree with the compass labels the user reads. */
  facing: CompassDirection;
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
 * ⚠ **THE PLANE IS NOT LIFTED FOR THE TALL END'S BEARING WEDGE, and that
 * was tried first.**
 *
 * A roof panel's underside runs at the pitch and a top plate is level, so
 * the panel carries a wedge under its tall end to bear across the whole
 * wall (`bearingSeatDepthIn` in the panel catalogue). The obvious move is to
 * lift this plane by the wedge's height so it clears the plate. Lifting both
 * edges keeps the pitch honest — but it also lifts the EAVE edge off its own
 * bearing, and nothing fills that.
 *
 * The wedge is purely ADDITIVE instead: it hangs below the panel into the
 * void that already exists over the tall wall, between the level plate and
 * the underside rising away from it. The tall wall's plate therefore sits
 * `seat x pitch/12` below the roof's high edge — the roof standing proud of
 * the wall, which is what *"make the roof taller"* asks for, rather than the
 * wall being built up to meet it.
 *
 * The eave end has the same void mirrored, and his earlier spec already
 * fills it: `buildRoofPanelCapMembers(..., "eave", pitch)` is an L whose
 * seat is *"cut off square"* by exactly the pitch and bears on the top
 * plate. The two ends are the same idea from opposite directions.
 */

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
export function roofRidgeAxis(footprint: Footprint): "x" | "y" {
  const { minX, maxX, minY, maxY } = footprintSpanAndRun(footprint);
  /* Ridge along the longer dimension, so the gables land on the short walls.
     A square ties to X, which is east-west. */
  return maxY - minY <= maxX - minX ? "x" : "y";
}

/**
 * The two walls that should carry a gable end: the ones at the ends of the
 * ridge, which are the building's SHORT walls.
 *
 * Exported so the app can spawn them automatically when a roof is switched
 * on, using the same rule the planes themselves are built from. Two copies of
 * "which walls are the gable ends" would eventually disagree, and the symptom
 * would be a roof whose planes do not sit on its gables.
 */
/**
 * ⚠ **THE SPAN A ROOF HAS TO CROSS — the building's own dimension across the
 * ridge, which is NOT the same as a gable wall's length.**
 *
 * They are equal on a box, which is why two call sites measured a gable
 * wall instead and nobody noticed. On an octagon a gable "wall" is one
 * eighth facet: the 32ft Octagon's E facet is 13.25ft, so `decideRoofForm`
 * was asked about 13.25ft, answered **shed**, and the app built a roof that
 * would need a 33.7ft panel against the 17.1ft one reaches at 4:12. Asked
 * about the real 32ft it answers **peaked**, 16ft a side, comfortably inside.
 *
 * It is also the run a rise is computed over, so the same mistake made the
 * 16ft Octagon's gable row rise 2.25ft under a roof that rises 5.33ft.
 *
 * `simpleRoofPlanes` takes its own `runFt` from here, so the planes and
 * anything deciding a form from the span cannot disagree about how wide the
 * building is.
 */
export function roofSpanFt(footprint: Footprint): number {
  const { minX, maxX, minY, maxY } = footprintSpanAndRun(footprint);
  return roofRidgeAxis(footprint) === "x" ? maxY - minY : maxX - minX;
}

export function gableEndWallIdsFor(footprint: Footprint): string[] {
  const alongRidge = roofRidgeAxis(footprint) === "x" ? ["E", "W"] : ["N", "S"];
  return footprint.walls
    .filter((wall) => alongRidge.includes(wallCompassDirection(wall, footprint)))
    .map((wall) => wall.id);
}

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

  const ridgeAxis = roofRidgeAxis(footprint);
  /* ⚠ Through `roofSpanFt`, so the planes and every caller that decides a
     form or a rise from the span read one number. */
  const runFt = roofSpanFt(footprint) / (options.form === "peaked" ? 2 : 1);
  const riseFt = (runFt * options.pitchIn12) / 12;
  const slopeFt = Math.hypot(runFt, riseFt);

  const gableWallIds = gableEndWallIdsFor(footprint);

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

  /* A plane looks the way its own eave wall looks. Found by which eave wall
     the low edge sits nearest, rather than by snapping a vector to a compass
     here, so there is exactly one compass rule in this app. */
  const eaveWalls = footprint.walls.filter((w) => !gableWallIds.includes(w.id));
  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));
  const facingOf = (lowA: Point, lowB: Point): CompassDirection => {
    const midX = (lowA.x + lowB.x) / 2;
    const midY = (lowA.y + lowB.y) / 2;
    let best = eaveWalls[0];
    let bestDist = Infinity;
    for (const wall of eaveWalls) {
      const a = byId.get(wall.startCorner);
      const b = byId.get(wall.endCorner);
      if (!a || !b) continue;
      const d = Math.hypot((a.x + b.x) / 2 - midX, (a.y + b.y) / 2 - midY);
      if (d < bestDist) {
        bestDist = d;
        best = wall;
      }
    }
    return best ? wallCompassDirection(best, footprint) : "S";
  };

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
    facing: facingOf(lowA, lowB),
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

/**
 * Which of a roof's planes should be drawn see-through, so the building can
 * be looked into from outside.
 *
 * > *"east default is transparent or south if n/s>e/w"* — Tommy, 2026-10-26
 *
 * ⚠ Only one of those can ever apply. A roof's two planes depend on which way
 * its ridge runs: a wide building's face north and south, a tall one's face
 * east and west. So this reads his sentence as "whichever of this roof's own
 * planes faces east or south", preferring east where it exists — which
 * honours both halves in the only way the geometry allows.
 */
/* Takes anything that knows which way it faces, so a caller holding a
   per-panel takeoff rather than the planes themselves can still ask. */
export function defaultTransparentRoofFacing(planes: readonly { facing: CompassDirection }[]): CompassDirection | null {
  for (const preferred of ["E", "S"] as CompassDirection[]) {
    if (planes.some((plane) => plane.facing === preferred)) return preferred;
  }
  return planes[0]?.facing ?? null;
}

/**
 * ⚠ Whether this roof has a ridge beam at all.
 *
 * > *"No catcher beam for the shed roof, all the load goes down the walls."*
 * > — Tommy, 2026-10-26
 *
 * A shed's panels reach from one wall to the other, so both ends of every
 * panel are already over bearing and there is nothing for a beam to do. Only
 * a peak puts panel ends in mid-air, and the beam is what catches them.
 *
 * This matters beyond the beam itself: the beam is what the columns carry,
 * and the columns are what wants a continuous load path to the foundation
 * and extra girts in the floor beneath. No beam means none of that follows.
 */
export function roofNeedsRidgeBeam(form: RoofForm): boolean {
  return form === "peaked";
}

/**
 * The wall a shed's TALL side stands on — the one whose panels need their
 * tops tilted front to back to receive the roof flush.
 *
 * > *"Shed roof on small building should spawn with inclined Gable end panels
 * > all along the wall of the taller side too."* — Tommy, 2026-10-26
 *
 * ⚠ **This is deliberately NOT a gable end wall**, and the distinction is
 * what keeps an existing guardrail intact. The app allows at most two gable
 * walls and insists they be opposite, because a roof-catcher beam spans
 * between exactly two. A shed's tall wall would be a third, and not opposite
 * either of them — so adding it to that set would mean weakening a rule that
 * is right for every roof that does have a beam.
 *
 * It does not belong in that set anyway. A gable wall's panels slope along
 * their WIDTH, making the triangle you see in elevation. These slope through
 * their DEPTH and look level head-on. Two different panels, two different
 * sets, and the guardrail goes untouched.
 *
 * Returns null unless this really is a shed with a tall side to find.
 */
export function shedTallWallId(footprint: Footprint, options: SimpleRoofOptions): string | null {
  if (options.form !== "shed") return null;
  const roof = simpleRoofPlanes(footprint, options);
  const plane = roof.planes[0];
  if (roof.refusal !== null || !plane) return null;

  /* The high edge's midpoint, and whichever wall centre sits nearest it. The
     gable walls are excluded: they run alongside the slope and meet the high
     edge at its ends, so one of them can be nearer than the wall actually
     under it on a short building. */
  const midX = (plane.highStart.x + plane.highEnd.x) / 2;
  const midY = (plane.highStart.y + plane.highEnd.y) / 2;
  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));

  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const wall of footprint.walls) {
    if (roof.gableWallIds.includes(wall.id)) continue;
    const a = byId.get(wall.startCorner);
    const b = byId.get(wall.endCorner);
    if (!a || !b) continue;
    const d = Math.hypot((a.x + b.x) / 2 - midX, (a.y + b.y) / 2 - midY);
    if (d < bestDist) {
      bestDist = d;
      bestId = wall.id;
    }
  }
  return bestId;
}

/* ──────────────────────────────────────────────────────────────────────────
   WHAT THE ROOF IS DOING OVER EACH WALL

   > *"Octagon roofs does not meet, correct. I like the shed style on the
   > octagon though as an option. I think octagon shed is possible, there's
   > just going to be some very unique gable panels."* — Tommy, 2026-11-15

   ⚠ **Every gable row in this app is built on one assumption that is only
   true for a box: that a gable wall runs the full way across the roof, so
   both of its ends sit at the eave.** `computeGableTiledRow` hard-anchors
   them there. On a rectangle that is right — the gable walls ARE the short
   walls, corner to corner under the slope.

   On an octagon it is wrong on every wall. The E facet spans only the middle
   third of the building's depth, so the roof over its two corners is already
   45in and 19in up a 16ft shed — and the app draws a triangle from 27in down
   to nothing, meeting the roof at neither end. The four diagonal facets get
   no row at all.

   These two functions answer the question the gable row should have been
   asking all along: **how high is the roof at this wall's two corners.**
   Geometry, so that the gable row, the elevation and the 3D view cannot each
   have their own opinion — and so the same question can be put to a ring
   roof when the courtyards are built.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * The roof's height in feet at a point on the plan, or `null` if this roof
 * has no planes to stand on.
 *
 * ⚠ **Sampled off the planes themselves, never re-derived from the pitch.**
 * The planes already encode the ridge axis, which way a shed falls and where
 * a peak splits; a second derivation here is how the roof and the walls under
 * it start disagreeing. A point outside every plane's span clamps to the
 * nearest edge rather than extrapolating — the planes cover the footprint's
 * bounding box, so this only bites on floating-point slop at a corner.
 */
export function roofHeightFtAt(point: Point, roof: SimpleRoofResult): number | null {
  if (roof.planes.length === 0) return null;
  /* The roof falls across the ridge, so height varies along the OTHER axis. */
  const along = (p: Point) => (roof.ridgeAxis === "x" ? p.y : p.x);
  const here = along(point);

  let best: number | null = null;
  let bestOutsideBy = Infinity;
  for (const plane of roof.planes) {
    const lowAt = along(plane.lowStart);
    const highAt = along(plane.highStart);
    /* A plane with no extent along the fall axis is flat; it answers with its
       own height and cannot be interpolated. */
    if (Math.abs(highAt - lowAt) < 1e-9) {
      if (bestOutsideBy > 0) {
        best = plane.lowHeightFt;
        bestOutsideBy = 0;
      }
      continue;
    }
    const t = (here - lowAt) / (highAt - lowAt);
    const outsideBy = t < 0 ? -t : t > 1 ? t - 1 : 0;
    if (outsideBy < bestOutsideBy) {
      bestOutsideBy = outsideBy;
      const clamped = Math.min(Math.max(t, 0), 1);
      best = plane.lowHeightFt + clamped * (plane.highHeightFt - plane.lowHeightFt);
    }
  }
  return best;
}

/** How far the roof stands above the eave at one wall's two corners. */
export interface WallRoofTop {
  wallId: string;
  /** At the wall's START corner, in inches above `eaveHeightFt`. */
  startAboveEaveIn: number;
  /** At its END corner. */
  endAboveEaveIn: number;
  /** The taller of the two — what has to be filled for this wall to be
   *  closed. 0 means the wall is already at the roof and needs nothing. */
  tallerAboveEaveIn: number;
  /**
   * ⚠ **Where the RIDGE crosses this wall, when it does** — inches from the
   * wall's own start corner, with the height there.
   *
   * Two corner heights cannot describe a wall the ridge runs over: its high
   * point is in the MIDDLE. On a peaked octagon the E facet's corners are
   * both 37 1/2in up while the ridge above its midpoint is 64in, so a row
   * built from the corners alone came out **26 1/2in flat** across the top.
   *
   * `null` on a shed, and on any wall a peak's ridge does not reach.
   */
  ridgeCrossing: { atIn: number; aboveEaveIn: number } | null;
}

/**
 * Every wall of a footprint, with the roof's height above the eave at each of
 * its two corners.
 *
 * ⚠ **It returns ALL of them, including the ones that need nothing**, and the
 * filtering is deliberately left to the caller. Two different callers want
 * two different subsets — the gable row wants the walls that need a row and
 * not the shed's tall wall (which the cross-tilt row already closes, see
 * `shedTallWallId`), while a review or an audit wants to see the whole
 * building including the walls that are correctly empty. A function that
 * pre-filtered would force one of them to re-derive the other.
 *
 * ⚠ **On a rectangle this agrees with what the app already does**, which is
 * the property that makes it safe to adopt: a rectangular shed's two gable
 * walls come back 0 -> rise and rise -> 0, exactly the triangle the row
 * already draws, and its eave wall comes back 0/0.
 */
export function wallRoofTopsFor(footprint: Footprint, roof: SimpleRoofResult, eaveHeightFt: number): WallRoofTop[] {
  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));
  /* The ridge, read off the planes' shared high edge rather than recomputed
     from the bounding box — same reason `roofHeightFtAt` samples the planes. */
  const ridge =
    roof.form === "peaked" && roof.planes.length > 1
      ? {
          /* Its position on the fall axis, and its height. */
          at: roof.ridgeAxis === "x" ? roof.planes[0]!.highStart.y : roof.planes[0]!.highStart.x,
          heightFt: Math.max(...roof.planes.map((pl) => pl.highHeightFt)),
        }
      : null;
  const tops: WallRoofTop[] = [];
  for (const wall of footprint.walls) {
    const a = byId.get(wall.startCorner);
    const b = byId.get(wall.endCorner);
    if (!a || !b) continue;
    const startFt = roofHeightFtAt(a, roof);
    const endFt = roofHeightFtAt(b, roof);
    if (startFt === null || endFt === null) continue;
    /* Never negative: a roof below its own eave is not a wall to fill, and
       floating-point slop at a low corner must not read as one. */
    const startAboveEaveIn = Math.max(0, (startFt - eaveHeightFt) * 12);
    const endAboveEaveIn = Math.max(0, (endFt - eaveHeightFt) * 12);
    /* ⚠ Strictly BETWEEN the corners: a ridge landing exactly on a corner is
       already described by that corner's own height, and adding a point on top
       of an end anchor is what `resolveAnchors` has to clamp away. */
    let ridgeCrossing: WallRoofTop["ridgeCrossing"] = null;
    if (ridge) {
      const along = (p: Point) => (roof.ridgeAxis === "x" ? p.y : p.x);
      const fromA = along(a);
      const toB = along(b);
      const span = toB - fromA;
      if (Math.abs(span) > 1e-9) {
        const t = (ridge.at - fromA) / span;
        if (t > 1e-6 && t < 1 - 1e-6) {
          ridgeCrossing = {
            atIn: t * Math.hypot(b.x - a.x, b.y - a.y) * 12,
            aboveEaveIn: Math.max(0, (ridge.heightFt - eaveHeightFt) * 12),
          };
        }
      }
    }
    tops.push({
      wallId: wall.id,
      startAboveEaveIn,
      endAboveEaveIn,
      tallerAboveEaveIn: Math.max(startAboveEaveIn, endAboveEaveIn, ridgeCrossing?.aboveEaveIn ?? 0),
      ridgeCrossing,
    });
  }
  return tops;
}
