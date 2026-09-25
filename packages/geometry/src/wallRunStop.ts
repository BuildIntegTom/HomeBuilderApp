import { fromEighths, toEighths } from "./eighths";
import type { Footprint, WallRunStop } from "./types";

/**
 * Project Smearforn Stage 3 — "incomplete walls: a wall that simply ends"
 * (Tommy: "We need an addition tool setting or stop wall tool so that it is
 * possible to make incomplete walls").
 *
 * The whole stage rests on one decision, and it is worth restating at the
 * top of the module that implements it: **the footprint polygon stays
 * CLOSED.** `computeFootprintAreaSqFt`, `perimeterRing`, `pointInPolygon`,
 * `computeRoofBearingSegments`, the floor framing and the 3D pipeline all
 * assume a closed ring, and `cornerOwnership` walks it by
 * `walls.find(w => w.startCorner === wall.endCorner)`. So "incomplete" is a
 * property of the panel RUN, never of the shape — the floor and the roof
 * still reach the line where the wall stops; only the panels are absent.
 *
 * ### Where a stop is measured from
 *
 * A stop is inches in from one END of a wall, on the 1/8in grid — and it is
 * subtracted from the wall's own TILING length, i.e. the length
 * `wallGeometryFor` already produces after corner ownership has taken its
 * inset/extension out. For the overwhelmingly common case (a wall that owns
 * its corner at that end, so the inset is 0) that is exactly "inches from
 * the corner point on the plan", which is what a user measures. Where the
 * wall instead BUTTS a longer neighbour at that end, its run already starts
 * a wall-thickness in — the neighbour's corner panel fills that sliver —
 * and the stop is measured from where this wall's own run would have begun,
 * not from the shared corner point. Stated rather than left to be
 * discovered; the difference is one wall thickness and only on a butting
 * end.
 *
 * ### The invariant
 *
 * `Σ slot widths + startStopIn + endStopIn === (the tiling length the wall
 * would have had with no stops)` — exactly, in whole eighths. On a wall with
 * no corner inset or reflex extension that right-hand side IS
 * `wallFabricationLengthIn(wall)`, which is the form the plan states. Both
 * forms are asserted in `wallRunStop.test.ts`.
 *
 * ### An absent record is today's behaviour, byte-identical
 *
 * Every function here returns its input unchanged for an absent or all-zero
 * record. That is not a nicety — every project ever saved has no record at
 * all, and a stop is the kind of feature that must cost nothing when it is
 * not used.
 */

/** The identity stop — a fully panelized wall. */
export const NO_WALL_RUN_STOP: WallRunStop = { startStopIn: 0, endStopIn: 0 };

/** True when this record actually withholds something. An absent record and
 * a `{0, 0}` record are the same thing and both answer false. */
export function hasWallRunStop(stop: WallRunStop | undefined | null): boolean {
  if (!stop) return false;
  return toEighths(stop.startStopIn) > 0 || toEighths(stop.endStopIn) > 0;
}

/** Total inches of this wall that are deliberately not built. */
export function wallRunStopTotalIn(stop: WallRunStop | undefined | null): number {
  if (!stop) return 0;
  return fromEighths(Math.max(0, toEighths(stop.startStopIn)) + Math.max(0, toEighths(stop.endStopIn)));
}

export interface NormalizedWallRunStop {
  startStopIn: number;
  endStopIn: number;
  /** The record asked for more than the wall has, and was reduced to fit.
   * Never silent: `wallGeometryFor` carries this out to the Review Log. */
  clamped: boolean;
}

/**
 * Snaps a stored record onto the 1/8in grid, floors each end at 0, and caps
 * the pair at the wall's own tiling length so the run can never go negative.
 *
 * **Clamping rather than rejecting is deliberate, and it is the same rule
 * the rest of this app applies at LOAD.** A file whose stops no longer fit
 * (because the wall was shortened elsewhere, or because it was hand-edited)
 * must still open and still draw — `parseProjectFile` repairs rather than
 * refuses, and `repairStateToEighths` is the precedent. The reduction comes
 * off the END stop first, arbitrarily but FIXED, the same discipline
 * `distributeEighths` uses for its own absorber rule.
 */
export function normalizeWallRunStop(
  stop: WallRunStop | undefined | null,
  tilingLengthIn: number,
): NormalizedWallRunStop {
  if (!stop) return { startStopIn: 0, endStopIn: 0, clamped: false };
  const lengthEighths = Math.max(0, toEighths(tilingLengthIn));
  let startEighths = Math.max(0, toEighths(stop.startStopIn));
  let endEighths = Math.max(0, toEighths(stop.endStopIn));
  const clamped = startEighths + endEighths > lengthEighths;
  if (clamped) {
    endEighths = Math.max(0, Math.min(endEighths, lengthEighths - startEighths));
    startEighths = Math.min(startEighths, lengthEighths);
  }
  return { startStopIn: fromEighths(startEighths), endStopIn: fromEighths(endEighths), clamped };
}

export interface WallRunBase {
  lengthIn: number;
  hasCornerStart: boolean;
  hasCornerEnd: boolean;
}

export interface StoppedWallRun extends WallRunBase {
  startStopIn: number;
  endStopIn: number;
  clamped: boolean;
  /** Nothing at all is built on this wall — every slot is gone, including
   * both corners. Reachable as "an edge with no wall on it", which the plan
   * deliberately expresses as a stop covering the whole length rather than
   * as a separate mode. */
  fullyStopped: boolean;
}

/**
 * Turns a wall's plain tiling geometry into the geometry of its BUILT run.
 *
 * Two effects, and only two:
 *
 * 1. **The tiling length shrinks** by the stops. Everything downstream —
 *    corner resolution, the safety-panel 12ft threshold, the standard-panel
 *    count, absorb — then runs against the shorter run exactly as it always
 *    has, with no special cases anywhere in the tiler.
 * 2. **A stop at an end takes that end's corner panel with it.** The corner
 *    is simply not built. Inference, flagged as one: the plan states it and
 *    marks it an inference, and it is the only reading that makes physical
 *    sense — a corner panel wraps a corner, and a run that stops short of
 *    the corner has no corner to wrap.
 *
 * **What this function does NOT do, and where the rest of the rule lives.**
 * It is per-wall, so it cannot see the neighbour. An earlier version of this
 * comment claimed the neighbour was untouched because it "already either
 * owns that corner by its own rule or butts against it" — and that was wrong
 * for the butting case. A wall butting a corner its neighbour owns is inset
 * by a wall thickness to make room for that corner panel; if the neighbour
 * stops and never builds it, the butting wall was left insetting into air.
 * **Tommy's decision, 2026-09-25: the corner simply does not exist, and the
 * butting wall runs out to its own true end.** That adjustment is
 * necessarily cross-wall and lives in `cornerOwnershipWithRunStops`
 * (`retile.ts`), which is what feeds this function its `base`.
 *
 * A fully-stopped wall loses BOTH corners even though only one end may carry
 * a stop — otherwise `resolveCorners` would clamp the surviving corner to
 * the zero-length run and emit a zero-width corner slot, which renders
 * invisibly but is still a real, priced, fabricated panel instance. Same
 * reasoning `buildMiddle`'s own zero-budget guard is written from.
 */
export function applyWallRunStop(base: WallRunBase, stop: WallRunStop | undefined | null): StoppedWallRun {
  if (!hasWallRunStop(stop)) {
    return { ...base, startStopIn: 0, endStopIn: 0, clamped: false, fullyStopped: false };
  }
  const { startStopIn, endStopIn, clamped } = normalizeWallRunStop(stop, base.lengthIn);
  const lengthIn = fromEighths(
    Math.max(0, toEighths(base.lengthIn) - toEighths(startStopIn) - toEighths(endStopIn)),
  );
  const fullyStopped = toEighths(lengthIn) === 0;
  return {
    lengthIn,
    hasCornerStart: base.hasCornerStart && !fullyStopped && toEighths(startStopIn) === 0,
    hasCornerEnd: base.hasCornerEnd && !fullyStopped && toEighths(endStopIn) === 0,
    startStopIn,
    endStopIn,
    clamped,
    fullyStopped,
  };
}

/**
 * How many inches of each wall are actually BUILT — its raw length less its
 * run stops. **This is the fix for Stage 3's named trap**, and the reason it
 * is a function in this package rather than three inline reductions in
 * `page.tsx` is that it needed a test.
 *
 * No panels means no panel instances, so every total derived FROM instances
 * (price, weight, carbon, BOM, cut list, shipping) is already correct on a
 * stopped wall. Every total derived from `wall.lengthFt` is not, and it
 * over-counts silently — a plaster area, a membrane roll count, a plywood
 * cap, a truss-plate run for a wall that was never built. Those read this.
 *
 * **The LENGTH is measured off `lengthFt * 12`, deliberately not off the
 * tiling length.** Corner insets and reflex extensions are ownership
 * bookkeeping that nets out around a closed ring; the existing perimeter
 * totals are exactly the raw sum, so subtracting only the stops leaves an
 * unstopped project byte-identical to today.
 *
 * **But the CLAMP BASE must be the tiling length, and that is a different
 * number.** `applyWallRunStop` clamps a stop against the run the tiler
 * actually builds, which on a wall that butts a longer neighbour is up to
 * one wall-thickness shorter than the raw length. Clamping here against the
 * raw length instead let the two disagree: a stored stop landing between
 * those two values made the tiler build NOTHING while this function still
 * reported up to ~15¾in as built — so plaster and membrane counted a sliver
 * on a wall with no panels on it. Pass `tilingLengthInByWallId` (from
 * `wallGeometryFor(...).unstoppedLengthIn`) and the two agree exactly. Omit
 * it and the raw length is used, which is correct whenever the stops fit —
 * i.e. always, except through a clamp.
 *
 * **What must NOT read this: the floor, the foundation and the roof.** They
 * still extend to the line where the wall stops. That is the entire reason
 * the footprint polygon stays closed.
 */
export function builtWallLengthsIn(
  footprint: Footprint,
  runStopsByWallId?: Record<string, WallRunStop>,
  tilingLengthInByWallId?: Record<string, number>,
): Record<string, number> {
  const built: Record<string, number> = {};
  for (const wall of footprint.walls) {
    const fullIn = wall.lengthFt * 12;
    const clampBaseIn = tilingLengthInByWallId?.[wall.id] ?? fullIn;
    const { startStopIn, endStopIn } = normalizeWallRunStop(runStopsByWallId?.[wall.id], clampBaseIn);
    // A wall the tiler builds nothing on contributes nothing, even though
    // its raw length exceeds its tiling length by the butt-joint inset.
    if (toEighths(clampBaseIn) - toEighths(startStopIn) - toEighths(endStopIn) <= 0) {
      built[wall.id] = 0;
      continue;
    }
    built[wall.id] = Math.max(0, fullIn - startStopIn - endStopIn);
  }
  return built;
}

/** The building's BUILT wall perimeter in inches — see `builtWallLengthsIn`.
 * With no stops this is exactly `sum(wall.lengthFt * 12)`, i.e. the number
 * every wall-assembly total used before Stage 3. */
export function totalBuiltWallPerimeterIn(
  footprint: Footprint | null | undefined,
  runStopsByWallId?: Record<string, WallRunStop>,
  tilingLengthInByWallId?: Record<string, number>,
): number {
  if (!footprint) return 0;
  return Object.values(builtWallLengthsIn(footprint, runStopsByWallId, tilingLengthInByWallId)).reduce(
    (sum, lengthIn) => sum + lengthIn,
    0,
  );
}
