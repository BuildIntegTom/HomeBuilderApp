/**
 * ROOF BRACING, PHASE 3 STRIDE 3 — putting the figure's joints on the panel
 * seams.
 *
 * ⚠ **WHY, in one line: stride 2 measured a three-inch brace.** Slicing the
 * unsnapped figure at the seams produced 4.67–5.23 pieces a panel against
 * Tommy's four, as many as eight in one panel, and shortest pieces of
 * 3.06in, 4.14in and 5.09in across the app's plane range — with 26 to 36
 * pieces under a foot on the larger planes. Every one of those stubs is a
 * member that costs two end connections and carries almost nothing. His
 * call, 2026-11-21: *"Snap it."*
 *
 * ⚠ **AND SNAPPING MAKES HIS FOUR EXACT BY CONSTRUCTION, not approximately.**
 * Every endpoint in the figure is one of a bay's five stations (see
 * `RoofBayStationsIn`). Put all five on panel seams and no segment can end
 * part-way across a panel, so each segment covers whole panels only. Count
 * what then reaches one panel:
 *
 *   - a panel between `x0` and `x1`: both legs of the X, plus the left
 *     carrot's two segments — **four**;
 *   - between `x1` and `x2`: both legs, plus the lower and upper carrots'
 *     left-hand segments — **four**;
 *   - between `x2` and `x3`: both legs, plus their right-hand segments —
 *     **four**;
 *   - between `x3` and `x4`: both legs, plus the right carrot's two — **four**.
 *
 * Every panel on the plane, at any module, with no sliver anywhere: the
 * shortest piece on a snapped plane is its narrowest panel divided by the
 * cosine of the brace angle. *"4 diagonals per roof panel"* stops being a
 * measured average and becomes a property of the figure.
 *
 * ⚠ **WHAT IT SPENDS.** Snapped bays are not equal, so each bay's X has its
 * own angle and some can leave the 30–45° band; a carrot is no longer exactly
 * parallel to its leg. Both are reported per bay rather than smoothed over —
 * see `RoofSnappedBay`. The feet stay on the legs of the X throughout, which
 * is the one thing not traded (`roofBayBracingSegmentsFromStations`).
 */

import type { RoofBracePanelBand } from "./roofBracePanelSlices";
import { roofBracePanelSeamsIn } from "./roofBracePanelSlices";
import {
  chooseRoofBracingBays,
  roofBayBracingSegmentsFromStations,
  roofBraceSegmentAngleDeg,
  roofBraceSegmentLengthIn,
  ROOF_BRACE_ANGLE_EPSILON_DEG,
  ROOF_BRACE_MAX_ANGLE_DEG,
  ROOF_BRACE_MIN_ANGLE_DEG,
  type RoofBayStationsIn,
  type RoofBraceSegment,
  type RoofPlaneBracing,
} from "./roofPlaneBracing";

/**
 * ⚠ **A bay needs FOUR panels, and the number is forced rather than chosen.**
 * A bay's figure hangs off five stations, three of them strictly inside it,
 * and a station is a seam. Three interior seams means four panels. A bay with
 * three panels has only two interior seams, so two of `x1`/`x2`/`x3` would
 * have to share one — collapsing a carrot to zero width.
 */
export const ROOF_SNAP_MIN_PANELS_PER_BAY = 4;

/** One bay after snapping, with what the snap moved and what it cost. */
export interface RoofSnappedBay {
  bayIndex: number;
  /** All five on panel seams, strictly increasing. */
  stationsIn: RoofBayStationsIn;
  /** Where the five stations would have been on even spacing. */
  idealStationsIn: RoofBayStationsIn;
  /** Station by station, how far the snap moved it. Signed, along the eave. */
  driftIn: readonly [number, number, number, number, number];
  /** This bay's X legs, which now have an angle of their own. */
  angleDeg: number;
  /** True when this bay's X sits inside the band. */
  inBand: boolean;
  /**
   * The widest gap between a carrot's angle and its leg's, in degrees.
   *
   * On even stations every carrot is parallel to a leg and this is 0. It is
   * the honest measure of what snapping spent.
   */
  carrotAngleDriftDeg: number;
  /** The shallowest and steepest member in this bay, carrots included. */
  minMemberAngleDeg: number;
  maxMemberAngleDeg: number;
}

export interface RoofBraceSeamSnap extends RoofPlaneBracing {
  bays: RoofSnappedBay[];
  /**
   * Non-null when the figure could NOT be snapped, in words. The segments
   * returned are then the unsnapped figure, unchanged — a plane with too few
   * panels still gets braced, it just keeps the offcuts.
   */
  refusal: string | null;
  /** True when every station in every bay landed on a seam. */
  snapped: boolean;
  /** The furthest any one station had to move. */
  maxDriftIn: number;
  /** Bays whose X left the band because snapping moved their edges. */
  outOfBandBayIndexes: number[];
  /** The shallowest and steepest member anywhere in the figure. */
  minMemberAngleDeg: number;
  maxMemberAngleDeg: number;
  /** How many of the figure's members sit outside the band. */
  outOfBandMemberCount: number;
  /**
   * What the snap bought and what it spent, in a sentence, for the Review Log.
   *
   * ⚠ **IT STATES THE ANGLE COST RATHER THAN ONLY THE WIN**, because the win
   * is the part that is easy to see — four pieces a panel, no offcuts — and
   * the cost is a spread of member angles that nothing on screen would show.
   */
  why: string;
}

/**
 * How far an angle falls outside Tommy's band, in degrees. Zero inside it.
 */
function bandViolationDeg(angleDeg: number, minAngleDeg: number, maxAngleDeg: number): number {
  return Math.max(0, minAngleDeg - angleDeg, angleDeg - maxAngleDeg);
}

/**
 * The five angles a bay's figure contains, from its four gaps.
 *
 * ⚠ **CLOSED FORM, and that is what makes choosing the stations by their
 * angles affordable.** The alternative is to build all ten segments for every
 * candidate station triple and measure them, which is the same arithmetic
 * done ten times over with a few thousand candidates behind it. Derived from
 * `roofBayBracingSegmentsFromStations` and checked against it by a test that
 * builds the segments and compares, so the two cannot drift apart:
 *
 *   - both legs of the X run the bay's whole span, `atan(slope / S)`;
 *   - the lower and upper carrots' left segments rise `g1/S` of the slope
 *     over a run of `g2`, and their right segments `g4/S` over `g3`;
 *   - the left carrot's two segments both run `g1` from the bay edge at
 *     mid-height to a foot `g1/S` of the way up a leg, so each stands
 *     `|g1/S - 1/2|` of the slope off mid-height; the right carrot mirrors it
 *     with `g4`.
 *
 * On even gaps every one of them collapses to `atan(slope / S)` — the
 * parallelism the unsnapped figure has.
 */
function bayMemberAnglesDeg(
  gaps: readonly [number, number, number, number],
  spanIn: number,
  planeSlopeIn: number,
): number[] {
  const [g1, g2, g3, g4] = gaps;
  const deg = (dyIn: number, dxIn: number) => (Math.atan2(Math.abs(dyIn), Math.abs(dxIn)) * 180) / Math.PI;
  return [
    deg(planeSlopeIn, spanIn),
    deg((g1 / spanIn) * planeSlopeIn, g2),
    deg((g4 / spanIn) * planeSlopeIn, g3),
    deg(planeSlopeIn * Math.abs(g1 / spanIn - 0.5), g1),
    deg(planeSlopeIn * Math.abs(g4 / spanIn - 0.5), g4),
  ];
}

/**
 * The three interior stations for one bay, chosen for the ANGLES they
 * produce rather than for how near they are to the quarter points.
 *
 * ⚠ **CHOOSING EACH STATION AS THE NEAREST SEAM TO ITS QUARTER POINT IS WHAT
 * THE FIRST BUILD DID, AND IT PUT A CARROT 19° OFF ITS LEG.** The failure is
 * a cascade, not a near miss: on a 24ft plane the first station took the seam
 * that left the second nowhere to go but one panel along, so two stations
 * ended up 24in apart while the third sat 48in further out. A carrot spanning
 * 24in across while climbing a third of the plane's slope stands at 61.5°,
 * and measured member angles ran 29.3° to 63.9° — against a band of 30 to 45.
 *
 * So the three are chosen TOGETHER, by how far the figure's five angles fall
 * outside the band: worst excursion first, total excursion to break a tie,
 * and gap evenness to break that. Even gaps are what the unsnapped figure
 * has, so the last of those keeps the choice close to the ideal when the band
 * cannot tell two candidates apart.
 *
 * ⚠ **The leg's own angle is in that measure and cannot be improved by any
 * station** — it is fixed by the bay's span. That is deliberate: it costs one
 * constant on every candidate and keeps the number reported here comparable
 * with the band itself, rather than being a different quantity that happens
 * to be measured in degrees.
 */
function chooseBayStationIndexes(
  seamsIn: readonly number[],
  loIndex: number,
  hiIndex: number,
  planeSlopeIn: number,
  minAngleDeg: number,
  maxAngleDeg: number,
): [number, number, number] {
  const x0 = seamsIn[loIndex]!;
  const x4 = seamsIn[hiIndex]!;
  const span = x4 - x0;
  const quarter = span / 4;

  let best: [number, number, number] = [loIndex + 1, loIndex + 2, loIndex + 3];
  let bestScore: [number, number, number] = [Infinity, Infinity, Infinity];

  for (let q1 = loIndex + 1; q1 <= hiIndex - 3; q1 += 1) {
    for (let q2 = q1 + 1; q2 <= hiIndex - 2; q2 += 1) {
      /* ⚠ `hiIndex - 1`, so no station lands on the bay's far edge and
         collapses the right carrot to nothing. A mutation run shows removing
         this changes no output: such a candidate scores a 90deg member and a
         wildly uneven gap, so the chooser rejects it on both measures. It
         stays as a guard on the CONTRACT — `stationsIn` strictly increasing —
         rather than on the choice. */
      for (let q3 = q2 + 1; q3 <= hiIndex - 1; q3 += 1) {
        const x1 = seamsIn[q1]!;
        const x2 = seamsIn[q2]!;
        const x3 = seamsIn[q3]!;
        const gaps: [number, number, number, number] = [x1 - x0, x2 - x1, x3 - x2, x4 - x3];
        const angles = bayMemberAnglesDeg(gaps, span, planeSlopeIn);
        const violations = angles.map((a) => bandViolationDeg(a, minAngleDeg, maxAngleDeg));
        const score: [number, number, number] = [
          Math.max(...violations),
          violations.reduce((sum, v) => sum + v, 0),
          gaps.reduce((sum, g) => sum + (g - quarter) ** 2, 0),
        ];
        for (let i = 0; i < score.length; i += 1) {
          if (score[i]! < bestScore[i]!) {
            best = [q1, q2, q3];
            bestScore = score;
            break;
          }
          if (score[i]! > bestScore[i]!) break;
        }
      }
    }
  }
  return best;
}

/**
 * The bay edges, chosen together so no bay's X strays further from the band
 * than it has to.
 *
 * ⚠ **GREEDY LEFT TO RIGHT IS WRONG HERE FOR THE SAME REASON IT IS WRONG FOR
 * THE STATIONS**: an early edge taking the seam nearest its own ideal can
 * leave a later bay with nothing but a bad one, and the bay that pays is not
 * the bay that chose. A bay's span fixes its X's angle outright, so this is
 * the one decision snapping makes that can push a MAIN diagonal out of the
 * band.
 *
 * Exact, by the obvious dynamic program over (bay, edge seam): minimise the
 * worst span error, then the total. `ROOF_SNAP_MIN_PANELS_PER_BAY` is the
 * spacing constraint, so every bay the program can reach is buildable.
 *
 * ⚠ **THE WORST-BEFORE-TOTAL ORDERING ALMOST NEVER SHOWS, and it took a
 * search to find a case where it does.** At two bays the two objectives are
 * provably identical — the spans sum to the plane, so the two errors are
 * equal — and no plane the app builds with a real run distinguishes them, nor
 * did 400,000 random band layouts at two and three bays. A five-bay plane of
 * wildly uneven panels does: minimax takes a worst error of 23.8in where
 * minimising the total takes 24.8in. That case is a test, so the ordering is
 * pinned by something rather than by argument.
 */
function chooseBayEdgeIndexes(
  seamsIn: readonly number[],
  panelCount: number,
  bays: number,
  bayWidthIn: number,
): number[] {
  type Cell = { worst: number; total: number; from: number } | null;
  const errorOf = (fromIndex: number, toIndex: number) =>
    Math.abs(seamsIn[toIndex]! - seamsIn[fromIndex]! - bayWidthIn);

  /* dp[j][k]: the best way to place bay edge j at seam k, bays 0..j-1 cut. */
  let previous: Cell[] = seamsIn.map(() => null);
  previous[0] = { worst: 0, total: 0, from: 0 };
  const parents: number[][] = [];

  for (let bay = 1; bay <= bays; bay += 1) {
    const current: Cell[] = seamsIn.map(() => null);
    const lastEdge = bay === bays;
    for (let k = 0; k <= panelCount; k += 1) {
      if (lastEdge && k !== panelCount) continue;
      /* ⚠ No bound on `k` beyond that, and the two that were here are gone
         deliberately: a cell too far left or right simply has no path, since
         every transition below already demands its own four panels and the
         last edge must land on `panelCount`. Both read like safety and were
         measured to be unreachable — a mutation run removed each in turn and
         nothing changed, because nothing could. */
      for (let p = 0; p <= k - ROOF_SNAP_MIN_PANELS_PER_BAY; p += 1) {
        const before = previous[p];
        if (before === null) continue;
        const error = errorOf(p, k);
        const worst = Math.max(before.worst, error);
        const total = before.total + error;
        const held = current[k];
        if (held === null || worst < held.worst || (worst === held.worst && total < held.total)) {
          current[k] = { worst, total, from: p };
        }
      }
    }
    parents.push(current.map((cell) => (cell === null ? -1 : cell.from)));
    previous = current;
  }

  /* Walk the choices back. The guard in the caller is what guarantees the
     last cell was reached, so a missing one is a bug rather than a shape. */
  if (previous[panelCount] === null) {
    throw new Error(
      `No way to cut ${bays} bracing bays out of ${panelCount} panels at ${ROOF_SNAP_MIN_PANELS_PER_BAY} panels a bay. The caller must check the panel count before snapping.`,
    );
  }
  const edges: number[] = [panelCount];
  let at = panelCount;
  for (let bay = bays; bay >= 1; bay -= 1) {
    at = parents[bay - 1]![at]!;
    edges.unshift(at);
  }
  return edges;
}

/**
 * Snap the plane's figure onto the panel seams of the run beneath it.
 *
 * The bay COUNT is still chosen by the angle rule — `chooseRoofBracingBays`,
 * from Tommy's 30–45° band — because that is a decision about load path and
 * the seams have no opinion on it. What snapping moves is where the bay
 * EDGES and the three stations inside each bay fall.
 *
 * ⚠ **IT REFUSES BY FALLING BACK, NOT BY THROWING.** A plane with fewer than
 * four panels to a bay cannot carry the figure on seams. That is a real
 * building — a narrow plane the angle rule has divided into several bays —
 * and the answer is to brace it the unsnapped way and say so, not to leave
 * it unbraced or to crash the view. `refusal` carries the sentence.
 */
export function snapRoofBracingToSeams(
  planeWidthIn: number,
  planeSlopeIn: number,
  bands: readonly RoofBracePanelBand[],
  minAngleDeg: number = ROOF_BRACE_MIN_ANGLE_DEG,
  maxAngleDeg: number = ROOF_BRACE_MAX_ANGLE_DEG,
): RoofBraceSeamSnap {
  const choice = chooseRoofBracingBays(planeWidthIn, planeSlopeIn, minAngleDeg, maxAngleDeg);
  const seamsIn = roofBracePanelSeamsIn(bands, planeWidthIn);
  const panelCount = seamsIn.length - 1;

  const evenStations = (bayIndex: number): RoofBayStationsIn => {
    const left = bayIndex * choice.bayWidthIn;
    const quarter = choice.bayWidthIn / 4;
    return [left, left + quarter, left + 2 * quarter, left + 3 * quarter, left + choice.bayWidthIn];
  };

  const unsnapped = (refusal: string): RoofBraceSeamSnap => {
    const segments: RoofBraceSegment[] = [];
    for (let bay = 0; bay < choice.bays; bay += 1) {
      segments.push(...roofBayBracingSegmentsFromStations(bay, evenStations(bay), planeSlopeIn));
    }
    return {
      choice,
      segments,
      totalLengthIn: segments.reduce((sum, s) => sum + roofBraceSegmentLengthIn(s), 0),
      planeWidthIn,
      planeSlopeIn,
      bays: [],
      refusal,
      snapped: false,
      maxDriftIn: 0,
      outOfBandBayIndexes: [],
      minMemberAngleDeg: choice.angleDeg,
      maxMemberAngleDeg: choice.angleDeg,
      outOfBandMemberCount: choice.inBand ? 0 : segments.length,
      why: refusal,
    };
  };

  const needed = choice.bays * ROOF_SNAP_MIN_PANELS_PER_BAY;
  if (panelCount < needed) {
    return unsnapped(
      `⚠ This plane's bracing is NOT snapped to the panel seams, and the figure keeps its offcuts. The angle band puts ${choice.bays} ${
        choice.bays === 1 ? "bay" : "bays"
      } on this plane, and each one needs ${ROOF_SNAP_MIN_PANELS_PER_BAY} panels to hang its five stations on seams — ${needed} in all, against the ${panelCount} this run has. A narrower panel module, or one bay fewer, would let it snap.`,
    );
  }

  const edgeIndexes = chooseBayEdgeIndexes(
    seamsIn,
    panelCount,
    choice.bays,
    choice.bayWidthIn,
  );

  const bays: RoofSnappedBay[] = [];
  const segments: RoofBraceSegment[] = [];
  for (let bay = 0; bay < choice.bays; bay += 1) {
    const loIndex = edgeIndexes[bay]!;
    const hiIndex = edgeIndexes[bay + 1]!;
    const x0 = seamsIn[loIndex]!;
    const x4 = seamsIn[hiIndex]!;
    const span = x4 - x0;

    const [q1, q2, q3] = chooseBayStationIndexes(
      seamsIn,
      loIndex,
      hiIndex,
      planeSlopeIn,
      minAngleDeg,
      maxAngleDeg,
    );
    const stationsIn: RoofBayStationsIn = [x0, seamsIn[q1]!, seamsIn[q2]!, seamsIn[q3]!, x4];

    /* ⚠ **Where each station WANTED to be, given what was already settled —
       which is two different questions and that is deliberate.** The two
       edges are measured against even bays across the whole plane, because
       that is what the angle rule asked for. The three interior stations are
       measured against the quarters of the bay they actually landed in,
       because once an edge has moved, the old quarter point is not what the
       figure wants any more. Measuring the interiors against the original
       bay would report a drift the snap never had a choice about. */
    const ideal = evenStations(bay);
    const idealStationsIn: RoofBayStationsIn = [
      ideal[0],
      x0 + span / 4,
      x0 + span / 2,
      x0 + (3 * span) / 4,
      ideal[4],
    ];

    const bayfigure = roofBayBracingSegmentsFromStations(bay, stationsIn, planeSlopeIn);
    segments.push(...bayfigure);

    const angleDeg = (Math.atan2(planeSlopeIn, span) * 180) / Math.PI;
    const memberAngles = bayfigure.map((s) => roofBraceSegmentAngleDeg(s));
    const carrotAngles = bayfigure
      .filter((s) => s.figure === "carrot")
      .map((s) => roofBraceSegmentAngleDeg(s));

    bays.push({
      bayIndex: bay,
      stationsIn,
      idealStationsIn,
      driftIn: [
        stationsIn[0] - idealStationsIn[0],
        stationsIn[1] - idealStationsIn[1],
        stationsIn[2] - idealStationsIn[2],
        stationsIn[3] - idealStationsIn[3],
        stationsIn[4] - idealStationsIn[4],
      ],
      angleDeg,
      inBand:
        angleDeg >= minAngleDeg - ROOF_BRACE_ANGLE_EPSILON_DEG &&
        angleDeg <= maxAngleDeg + ROOF_BRACE_ANGLE_EPSILON_DEG,
      carrotAngleDriftDeg: Math.max(...carrotAngles.map((a) => Math.abs(a - angleDeg))),
      minMemberAngleDeg: Math.min(...memberAngles),
      maxMemberAngleDeg: Math.max(...memberAngles),
    });
  }

  const memberAngles = segments.map((s) => roofBraceSegmentAngleDeg(s));
  const outOfBandMemberCount = memberAngles.filter(
    (a) => bandViolationDeg(a, minAngleDeg, maxAngleDeg) > ROOF_BRACE_ANGLE_EPSILON_DEG,
  ).length;
  const minMemberAngleDeg = Math.min(...memberAngles);
  const maxMemberAngleDeg = Math.max(...memberAngles);
  const round1 = (value: number) => Math.round(value * 10) / 10;

  return {
    choice,
    segments,
    totalLengthIn: segments.reduce((sum, s) => sum + roofBraceSegmentLengthIn(s), 0),
    planeWidthIn,
    planeSlopeIn,
    bays,
    refusal: null,
    snapped: true,
    maxDriftIn: Math.max(...bays.flatMap((b) => b.driftIn.map((d) => Math.abs(d)))),
    outOfBandBayIndexes: bays.filter((b) => !b.inBand).map((b) => b.bayIndex),
    minMemberAngleDeg,
    maxMemberAngleDeg,
    outOfBandMemberCount,
    why:
      `Every joint in this plane's bracing sits on a panel seam, so each panel holds exactly four brace pieces and none of them is an offcut: the shortest piece on the plane is its narrowest panel divided by the cosine of the brace angle. The figure's stations moved up to ${round1(
        Math.max(...bays.flatMap((b) => b.driftIn.map((d) => Math.abs(d)))),
      )}in along the eave to get there.` +
      (outOfBandMemberCount === 0
        ? ` Every member stays inside the ${minAngleDeg}-${maxAngleDeg}deg band, at ${round1(minMemberAngleDeg)}-${round1(maxMemberAngleDeg)}deg.`
        : ` ⚠ The cost is the angles: ${outOfBandMemberCount} of ${segments.length} members sit outside the ${minAngleDeg}-${maxAngleDeg}deg band, spanning ${round1(minMemberAngleDeg)}-${round1(maxMemberAngleDeg)}deg. A carrot can only match its leg's angle when a seam falls exactly on a quarter of the bay, and a run opening with a 15.5in edge panel never puts one there.`),
  };
}
