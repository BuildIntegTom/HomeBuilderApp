/**
 * ROOF BRACING, PHASE 3 — the full-plane pattern, in plane coordinates.
 *
 * Tommy's decision 5: *"one big x ... and then on each of the spaces around
 * the x ... a carrot"*, and separately *"4 diagonals per roof panel"*. The
 * plan established those are the same figure described from two ends: a plane
 * diagonal crosses every panel's band exactly once, so the X puts two segments
 * in each panel, and a carrot in the region covering that panel adds about two
 * more.
 *
 * ⚠ **THIS IS NOT `applyWallBracingPattern` WIDENED, and the difference is the
 * seams.** The wall mechanism is a PAIR mechanism: its X spans exactly two
 * panels and crosses one seam, because *"panels separated by a third thing
 * share no seam"*. A plane-wide X on a twelve-panel plane crosses ELEVEN
 * seams, and a diagonal is only as strong as the weakest seam it crosses. That
 * is a real difference in the load path, not an implementation detail, which
 * is why this is its own pass.
 *
 * Coordinates throughout are PLANE coordinates in inches: x runs along the
 * eave from 0 to `planeWidthIn`, y runs UP THE SLOPE from 0 at the eave to
 * `planeSlopeIn` at the ridge. They are the plane's own true lengths — the
 * slope dimension is the rafter length, not its horizontal run — so a diagonal
 * computed here is the length a shop actually cuts.
 */

/** A straight run of brace, in plane coordinates. */
export interface RoofBraceSegment {
  x1In: number;
  y1In: number;
  x2In: number;
  y2In: number;
  /** Which figure put it there. */
  figure: "x" | "carrot";
  /** Which bay, left to right from 0. */
  bayIndex: number;
}

export const ROOF_BRACE_MIN_ANGLE_DEG = 30;
export const ROOF_BRACE_MAX_ANGLE_DEG = 45;

/**
 * ⚠ **BOTH ENDS OF THE BAND ARE INCLUSIVE, AND THEY NEED A TOLERANCE TO STAY
 * THAT WAY.** A plane built to sit exactly on 30deg computes at
 * `29.999999999999996`, so an exact `>=` rejected it, added a bay, and braced
 * it at **49.1deg** — outside the band, on the steep side, over a rounding
 * error of about 1e-14. Found by a mutation run that asked what happens at
 * the boundary and then by constructing a plane that lands on it.
 *
 * A ten-millionth of a degree is far below anything a roof is built to, so
 * this cannot mask a real angle; it only stops the last bit of a double from
 * deciding how many bays a roof gets.
 */
export const ROOF_BRACE_ANGLE_EPSILON_DEG = 1e-7;

/** The length of a segment, which is the length the shop cuts. */
export function roofBraceSegmentLengthIn(segment: RoofBraceSegment): number {
  return Math.hypot(segment.x2In - segment.x1In, segment.y2In - segment.y1In);
}

/** The angle a segment makes with the eave, always reported 0–90. */
export function roofBraceSegmentAngleDeg(segment: RoofBraceSegment): number {
  const dx = Math.abs(segment.x2In - segment.x1In);
  const dy = Math.abs(segment.y2In - segment.y1In);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export interface RoofBayChoice {
  bays: number;
  /** The diagonal's angle off the eave, in degrees. */
  angleDeg: number;
  bayWidthIn: number;
  /** True when `angleDeg` sits inside Tommy's 30–45 band. */
  inBand: boolean;
  /** What one bay fewer and one bay more would have given, for the log. */
  oneFewerDeg: number | null;
  oneMoreDeg: number;
  why: string;
}

/**
 * How many bays a plane is divided into, from Tommy's angle band.
 *
 * ⚠ **MORE BAYS MEANS A STEEPER DIAGONAL, and that is the whole lever.** A
 * plane `W` wide split into `n` bays has each bay `W/n` across, so the diagonal
 * sits at `atan(n·L/W)`. Nothing makes a diagonal SHALLOWER except fewer, wider
 * bays. So the flattest option inside the band is the smallest `n` that reaches
 * the minimum, and that is what this returns.
 *
 * ⚠ **THE BAND IS NOT ALWAYS REACHABLE, and "where possible" is why this
 * returns `inBand` instead of throwing.** Tommy, 2026-11-20: *"i like keeping
 * angles between 30 and 45 degrees where possible."* Bay count is an integer,
 * so the angle jumps, and two cases miss:
 *
 *   - **Too tall and narrow for any of it.** A 12ft-wide plane at a 14.4ft
 *     slope is 50.2° at one X, and adding bays only steepens it. Nothing
 *     brings it into the band.
 *   - **Straddling the band.** A 24ft plane at a 12.65ft slope is 27.8° with
 *     one X and 46.5° with two; no integer count lands between.
 *
 * In both cases the nearest option is taken and `inBand` is false, so the
 * caller can say so. A preference the app silently failed to honour would be
 * worse than one it never had.
 */
export function chooseRoofBracingBays(
  planeWidthIn: number,
  planeSlopeIn: number,
  minAngleDeg: number = ROOF_BRACE_MIN_ANGLE_DEG,
  maxAngleDeg: number = ROOF_BRACE_MAX_ANGLE_DEG,
): RoofBayChoice {
  if (!(planeWidthIn > 0) || !(planeSlopeIn > 0)) {
    throw new Error(
      `A roof plane ${planeWidthIn}in x ${planeSlopeIn}in has no diagonal to brace. The caller must not ask for a pattern on a degenerate plane.`,
    );
  }

  const angleFor = (bays: number) => (Math.atan2(bays * planeSlopeIn, planeWidthIn) * 180) / Math.PI;

  /* The angle rises monotonically with the bay count, so the first count that
     reaches the minimum is the flattest one at or above it. The ceiling of 64
     is a guard, not a design limit: a plane needing more than that is far
     outside anything the app builds, and an unbounded loop here would hang a
     render rather than report a shape. */
  const MAX_BAYS = 64;
  let bays = MAX_BAYS;
  for (let n = 1; n <= MAX_BAYS; n += 1) {
    if (angleFor(n) >= minAngleDeg - ROOF_BRACE_ANGLE_EPSILON_DEG) {
      bays = n;
      break;
    }
  }

  const angleDeg = angleFor(bays);
  const inBand =
    angleDeg >= minAngleDeg - ROOF_BRACE_ANGLE_EPSILON_DEG &&
    angleDeg <= maxAngleDeg + ROOF_BRACE_ANGLE_EPSILON_DEG;
  const oneFewerDeg = bays > 1 ? angleFor(bays - 1) : null;
  const oneMoreDeg = angleFor(bays + 1);

  const round1 = (value: number) => Math.round(value * 10) / 10;
  let why: string;
  if (inBand) {
    why = `${bays} bay${bays === 1 ? "" : "s"} puts the diagonal at ${round1(angleDeg)}deg, inside the ${minAngleDeg}-${maxAngleDeg}deg band. It is the flattest count that reaches ${minAngleDeg}deg; ${
      oneFewerDeg === null
        ? "a single bay is the whole plane"
        : `one fewer would be ${round1(oneFewerDeg)}deg`
    }.`;
  } else if (bays === 1 && angleDeg > maxAngleDeg) {
    why = `⚠ This plane is too tall and narrow for the band. One X across the whole plane is already ${round1(angleDeg)}deg, steeper than ${maxAngleDeg}deg, and dividing it into bays only steepens it further (${round1(oneMoreDeg)}deg at two). Nothing can bring it inside, so it is braced at ${round1(angleDeg)}deg.`;
  } else {
    why = `⚠ This plane straddles the band: ${
      oneFewerDeg === null ? "none" : `${bays - 1} bay${bays - 1 === 1 ? "" : "s"} gives ${round1(oneFewerDeg)}deg`
    }, below ${minAngleDeg}deg, and ${bays} gives ${round1(angleDeg)}deg, above ${maxAngleDeg}deg. Bay count is a whole number, so no division lands between. The steeper option is taken, since the shallower one is in the direction a diagonal stops working.`;
  }

  return {
    bays,
    angleDeg,
    bayWidthIn: planeWidthIn / bays,
    inBand,
    oneFewerDeg,
    oneMoreDeg,
    why,
  };
}

/** Ten: two legs of the X, plus two diagonals in each of its four regions. */
export const ROOF_BRACE_SEGMENTS_PER_BAY = 10;

/**
 * The X and its carrots for one bay, in plane coordinates.
 *
 * ⚠ **A CARROT IS A PAIR OF DIAGONALS MEETING AT A POINT — that is what the
 * name describes, and the first draft of this got it wrong.** It built one
 * axis-aligned member per region, which produced exactly **3.0** segments
 * crossing each 24in panel band instead of his four, and the shortfall was
 * the whole error: an axis-aligned member is not a diagonal and carries
 * nothing in the direction a brace exists for. The wall pattern already says
 * it plainly — a little carrot is *"2 short ... load-path diagonals, one off
 * the top plate and one off the bottom"*.
 *
 * So: the X divides the bay into four triangular regions, and each gets a
 * carrot whose apex sits on that region's outer edge and whose two feet land
 * on the two legs of the X.
 *
 * ⚠ **EVERY CARROT SEGMENT COMES OUT PARALLEL TO A LEG OF THE X**, which is
 * not a coincidence and is worth keeping: each spans a quarter of the bay
 * across and a quarter of the slope up, so its angle is `atan(L/W_bay)` —
 * the X's own angle. One consequence matters: **Tommy's 30–45° band governs
 * every member in the figure, not just the two long ones.**
 *
 * ⚠ **His "4 diagonals per roof panel" is the OUTPUT of this, not a separate
 * instruction.** A plane diagonal crosses each 24in panel band once, so the X
 * leaves two in every panel; each carrot segment spans a quarter bay and the
 * carrots covering a panel add two more. Four per panel is predicted, and a
 * test measures it rather than taking it on trust.
 */
export function roofBayBracingSegments(
  bayIndex: number,
  bayLeftIn: number,
  bayWidthIn: number,
  planeSlopeIn: number,
): RoofBraceSegment[] {
  const quarterW = bayWidthIn / 4;
  return roofBayBracingSegmentsFromStations(
    bayIndex,
    [
      bayLeftIn,
      bayLeftIn + quarterW,
      bayLeftIn + 2 * quarterW,
      bayLeftIn + 3 * quarterW,
      bayLeftIn + bayWidthIn,
    ],
    planeSlopeIn,
  );
}

/**
 * The five positions along the eave that the whole figure hangs off, in
 * plane inches: the bay's two edges and the three stations between them.
 *
 * ⚠ **EVERY ENDPOINT IN THE FIGURE IS ONE OF THESE FIVE x VALUES**, which is
 * what makes them worth naming. The X runs edge to edge, a carrot's apex
 * stands on `x2` (or on an edge), and its feet land on `x1` or `x3`. Nothing
 * else in the figure touches the eave direction. So a figure whose five
 * stations are panel seams has no endpoint stranded part-way across a panel
 * — which is exactly what `snapRoofBracingToSeams` is for.
 */
export type RoofBayStationsIn = readonly [number, number, number, number, number];

/**
 * The X and its carrots for one bay, from the bay's five stations.
 *
 * ⚠ **THE FEET STAY ON THE LEGS OF THE X, which is the whole reason this
 * takes stations rather than offsets.** A carrot exists to hand its load to
 * the main diagonal, so where its foot lands is structural: it has to be ON
 * the leg. With evenly spaced stations the foot's height works out to a
 * quarter or three quarters of the slope, as it always did. With stations
 * snapped to panel seams the x moves, and the foot's height is **recomputed
 * from the leg it sits on** rather than left at the quarter point — a foot
 * left behind at `slope/4` would be floating beside the diagonal instead of
 * delivering into it.
 *
 * ⚠ **WHAT THAT COSTS IS THE PARALLELISM, and it is the right thing to
 * spend.** On even stations every carrot comes out parallel to a leg of the
 * X, so Tommy's 30–45° band governs the whole figure. Snapped stations are
 * not evenly spaced, so a carrot's angle drifts off its leg's by however far
 * its station moved — reported per bay rather than assumed away. A few
 * degrees of drift is a smaller price than a foot that misses the diagonal.
 */
export function roofBayBracingSegmentsFromStations(
  bayIndex: number,
  stationsIn: RoofBayStationsIn,
  planeSlopeIn: number,
): RoofBraceSegment[] {
  const [x0, x1, x2, x3, x4] = stationsIn;
  const span = x4 - x0;
  if (!(span > 0)) {
    throw new Error(
      `A bracing bay from ${x0}in to ${x4}in has no width. Its five stations must be strictly increasing along the eave.`,
    );
  }

  /* Height of the point where a leg of the X crosses a given x. Leg A climbs
     left to right, leg B climbs right to left, so the two are mirrors. */
  const onLegA = (xIn: number) => ((xIn - x0) / span) * planeSlopeIn;
  const onLegB = (xIn: number) => ((x4 - xIn) / span) * planeSlopeIn;
  const midY = planeSlopeIn / 2;

  const seg = (
    x1In: number,
    y1In: number,
    x2In: number,
    y2In: number,
    figure: RoofBraceSegment["figure"],
  ): RoofBraceSegment => ({ x1In, y1In, x2In, y2In, figure, bayIndex });

  return [
    /* The X itself: eave-left to ridge-right, and eave-right to ridge-left. */
    seg(x0, 0, x4, planeSlopeIn, "x"),
    seg(x4, 0, x0, planeSlopeIn, "x"),

    /* Lower region — apex on the eave at x2, feet up on both legs. */
    seg(x2, 0, x1, onLegA(x1), "carrot"),
    seg(x2, 0, x3, onLegB(x3), "carrot"),

    /* Upper region — apex at the ridge above x2, feet down on both legs. */
    seg(x2, planeSlopeIn, x1, onLegB(x1), "carrot"),
    seg(x2, planeSlopeIn, x3, onLegA(x3), "carrot"),

    /* Left region — apex on the bay's left edge, feet across on both legs. */
    seg(x0, midY, x1, onLegA(x1), "carrot"),
    seg(x0, midY, x1, onLegB(x1), "carrot"),

    /* Right region — the mirror of it. */
    seg(x4, midY, x3, onLegB(x3), "carrot"),
    seg(x4, midY, x3, onLegA(x3), "carrot"),
  ];
}

export interface RoofPlaneBracing {
  choice: RoofBayChoice;
  segments: RoofBraceSegment[];
  /** Total cut length, for the takeoff. */
  totalLengthIn: number;
  /**
   * ⚠ **The plane carries its own dimensions back out so that nothing
   * downstream has to be told them a second time.** `sliceRoofPlaneBracing`
   * has to know how wide the plane is, to check that the panel bands it is
   * given actually cover it; recovering that as `bays * bayWidthIn` works but
   * invites a caller to pass a width of its own, and a width passed twice is
   * a width that can disagree with itself.
   */
  planeWidthIn: number;
  planeSlopeIn: number;
}

/** The whole plane: the bay decision, then each bay's figure. */
export function roofPlaneBracing(
  planeWidthIn: number,
  planeSlopeIn: number,
  minAngleDeg: number = ROOF_BRACE_MIN_ANGLE_DEG,
  maxAngleDeg: number = ROOF_BRACE_MAX_ANGLE_DEG,
): RoofPlaneBracing {
  const choice = chooseRoofBracingBays(planeWidthIn, planeSlopeIn, minAngleDeg, maxAngleDeg);
  const segments: RoofBraceSegment[] = [];
  for (let bay = 0; bay < choice.bays; bay += 1) {
    segments.push(
      ...roofBayBracingSegments(bay, bay * choice.bayWidthIn, choice.bayWidthIn, planeSlopeIn),
    );
  }
  return {
    choice,
    segments,
    totalLengthIn: segments.reduce((sum, s) => sum + roofBraceSegmentLengthIn(s), 0),
    planeWidthIn,
    planeSlopeIn,
  };
}
