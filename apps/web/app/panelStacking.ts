/**
 * ⚠ **IS A WALL JOINT HELD UP BY ANYTHING? — B15's first sentence, made
 * measurable.**
 *
 * > *"I want the floors, walls, and roof intersections of panels to be
 * > stacked and supported."* — Tommy, 2026-11-01
 *
 * A wall panel's two edges carry its share of everything above it. If the
 * deck below has a panel joint — and therefore a pair of structural girts —
 * directly under that edge, the load goes straight down into the deck's
 * framing. If the edge lands mid-panel instead, it bears on a deck panel's
 * skin and whatever girt happens to be nearby.
 *
 * ⚠ **Measured before anything was changed, on his 25ft 3in x 22ft 9in
 * building: ZERO of 13 deck joints land on a wall joint**, and every wall
 * joint sits up to 10.00in from the nearest one. That is not bad luck, it is
 * arithmetic:
 *
 * | run | first panel | then |
 * | --- | --- | --- |
 * | wall | corner, **25.5in** | 48in standards |
 * | deck | edge, **15.5in** (the wall's own thickness) | 24in field panels |
 *
 * 48 is exactly two 24s, so the two grids have the same PITCH and would
 * interleave perfectly — but they start 10in apart and therefore never meet.
 * Drop the corner to 15.5in and they lock immediately (verified: wall joints
 * at 15.5, 63.5, 111.5, 159.5 all land dead on deck joints), which is
 * `panel_module_2ft_4ft` working as intended. The corner is a **confirmed**
 * catalog value at 25.5in, though — "24in core + two 3/4in plywood side
 * faces" — so the offset is not a bug to delete.
 *
 * ⚠ **And even in phase, the TAIL breaks it.** On a 30ft wall with a 15.5in
 * corner the first five joints are exact and then the borrowed pair plus the
 * 3/4in safety gap push the rest out by 3.88in, 7.75in and 7.00in before the
 * far corner lands back on the grid. Whatever reconciles the two runs has to
 * survive the remainder, not just the full-width panels.
 *
 * This module only MEASURES. It makes no decision about which run gives way,
 * because that is a building decision and it is Tommy's.
 */

/** Cumulative joint positions from a run of panel widths, far end excluded. */
export function jointsFromWidths(widthsIn: readonly number[]): number[] {
  const out: number[] = [];
  let atIn = 0;
  for (const widthIn of widthsIn) {
    atIn += widthIn;
    out.push(Number(atIn.toFixed(4)));
  }
  out.pop(); // the run's far end is the building, not a joint
  return out;
}

export interface StackedJoint {
  /** Along the wall, from its own start corner. */
  atIn: number;
  /** The closest joint in the deck below, or null when the deck has none. */
  nearestDeckJointIn: number | null;
  /** How far the deck joint misses by. Infinity when there is no deck joint. */
  offsetIn: number;
  /** Within tolerance, so the load goes straight down. */
  stacked: boolean;
}

export interface WallStackingReport {
  wallId: string;
  joints: StackedJoint[];
  /** How many of this wall's joints land on a deck joint. */
  stackedCount: number;
  /** Of this wall's joints. `stackedCount === jointCount` is the goal. */
  jointCount: number;
  /** The worst miss on this wall, in inches. 0 when every joint stacks. */
  worstOffsetIn: number;
  /** The unsupported joints, for a notice or a Review Log line. */
  unstackedAtIn: number[];
}

/**
 * ⚠ **Exact, not nearly.** Both runs are built on the same 1/8in grid and
 * [[dimensional_tightness]] is a standing rule, so the default tolerance is
 * floating-point slack and nothing more. A caller that wants to ask a looser
 * question has to say so in the call, where it can be read.
 */
export const STACKING_TOLERANCE_IN = 1e-6;

export function reportWallStacking(input: {
  wallId: string;
  wallJointsIn: readonly number[];
  deckJointsIn: readonly number[];
  toleranceIn?: number;
}): WallStackingReport {
  const toleranceIn = input.toleranceIn ?? STACKING_TOLERANCE_IN;
  const joints: StackedJoint[] = input.wallJointsIn.map((atIn) => {
    let nearestDeckJointIn: number | null = null;
    let offsetIn = Number.POSITIVE_INFINITY;
    for (const deckIn of input.deckJointsIn) {
      const deltaIn = Math.abs(deckIn - atIn);
      if (deltaIn < offsetIn) {
        offsetIn = deltaIn;
        nearestDeckJointIn = deckIn;
      }
    }
    return { atIn, nearestDeckJointIn, offsetIn, stacked: offsetIn <= toleranceIn };
  });

  const stacked = joints.filter((j) => j.stacked);
  return {
    wallId: input.wallId,
    joints,
    stackedCount: stacked.length,
    jointCount: joints.length,
    worstOffsetIn: joints.reduce((worst, j) => (Number.isFinite(j.offsetIn) ? Math.max(worst, j.offsetIn) : worst), 0),
    unstackedAtIn: joints.filter((j) => !j.stacked).map((j) => j.atIn),
  };
}
