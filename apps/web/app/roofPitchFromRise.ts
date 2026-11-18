import { gableProfilePointIsShedEnd, type RoofBearingAnchorMode } from "@building-integrity/geometry";
import { computeRiseFtForPitch, resolveHeelSeat } from "./gableProfilePoints";

/**
 * ⚠ **READING A BUILDING'S PITCH BACK OUT OF ITS STORED RISE — B34 stride 4,
 * 2026-11-17.**
 *
 * The app stores a roof's shape as a **rise above the eave**
 * (`roofProfilePointHeightsFt`), never as a pitch — see
 * `gable_roofline_height_relative_to_eave`. That is the right storage, because
 * a rise is what a gable tile is drawn from. But it means *"what pitch is this
 * roof at"* is a derived question, and until stride 4 nothing derived it
 * outside the gable row.
 *
 * ## ⚠ Why it had to exist: a RESIZE threw the pitch away
 *
 * `refreshRoofForShapeChange` re-derives the whole roof when a shape change
 * genuinely invalidates it — when the gable-end pair flips, or when the span
 * crosses the shed/peak limit. It re-derived at the app's **4:12 default**, so
 * a roof somebody had set to 8:12 by hand came back 4:12 after one drag,
 * silently, with every gable tile, every roof panel and the price following it
 * down.
 *
 * ⚠ **Nobody had hit it because every building was DRAWN at 4:12**, so the
 * default was almost always the right answer by accident. The Multiplex ships
 * at his 8:12, which would have made it the normal case on the first resize.
 *
 * ## ⚠ The pair has to agree, which is why both directions live here
 *
 * `computeRiseFtForPitch` is `(round(run x pitch/12) + heel) / 12` — linear in
 * the pitch, so the inverse is exact arithmetic rather than a search. What is
 * NOT automatic is that both directions measure the same run over the same
 * heel seat: a shed runs the wall's full width and a centred peak half of it,
 * and a truss heel shortens the run while raising its start. Two copies of
 * that would drift, and the symptom would be a building whose pitch creeps by
 * a fraction every time it is resized.
 *
 * Pure, and taking its context explicitly, for the reason `shearMembers.ts`
 * does: a helper declared in the component body is a new value every render,
 * so every memo calling it grows a missing dependency and `exhaustive-deps`
 * rises — a rule that may never rise.
 */
export interface RoofPitchSeatContext {
  /** The project's standard panel width, which is the seat a truss heel needs. */
  standardWidthIn: number;
  /** The heel height in force, already resolved (0 when heel is off). */
  heelHeightIn: number;
  anchorMode: RoofBearingAnchorMode;
  /** Truss plate inset, used instead of a heel under `panel-depth` anchoring. */
  trussPlateInsetIn: number;
}

export interface RoofPitchRun {
  /** The ground a pitch is measured over: a shed's whole span, a peak's half,
   *  less whatever the seat takes off it. */
  runForPitchIn: number;
  /** How far the heel riser lifts the start of that run. */
  heelOffsetIn: number;
}

/**
 * The run a pitch is measured over on this building, and the heel under it.
 *
 * ⚠ `acrossFt` is the building's span **across the ridge** (`roofSpanFt`), not
 * a gable wall's own length. They are equal on a box and differ on an octagon,
 * and taking the wall instead is a mistake this app has already made twice.
 */
export function roofPitchRunAndHeel(acrossFt: number, isShed: boolean, ctx: RoofPitchSeatContext): RoofPitchRun {
  const wallWidthIn = acrossFt * 12;
  const seat = resolveHeelSeat(
    wallWidthIn,
    ctx.standardWidthIn,
    ctx.heelHeightIn,
    isShed ? 1 : 2,
    ctx.anchorMode,
    ctx.trussPlateInsetIn,
  );
  return {
    runForPitchIn: (isShed ? wallWidthIn : wallWidthIn / 2) - seat.runOffsetIn,
    heelOffsetIn: seat.heelOffsetIn,
  };
}

/** The rise this building would have at a given pitch — the forward direction,
 *  wrapped here only so both directions read the same run and seat. */
export function riseFtForPitch(
  acrossFt: number,
  isShed: boolean,
  pitchIn12: number,
  ctx: RoofPitchSeatContext,
): number {
  const { runForPitchIn, heelOffsetIn } = roofPitchRunAndHeel(acrossFt, isShed, ctx);
  return computeRiseFtForPitch(pitchIn12, runForPitchIn, heelOffsetIn);
}

/**
 * The pitch a stored rise represents. **Null** when there is no rise stored or
 * no run to measure it over — the caller then falls back to the app default,
 * which is what every path did before this existed.
 *
 * ⚠ **Not exactly invertible, and the error is bounded rather than zero.**
 * `computeRiseFtForPitch` ROUNDS the rise to a whole inch, so a pitch comes
 * back within half an inch of rise of where it went in — about 0.03:12 on an
 * 18ft run. That is far inside anything a roof cares about, and it is better
 * than the alternative: a round trip that reports 7.97:12 is honest, where
 * silently snapping to 8 would hide a real drift if this ever stopped being
 * linear.
 */
export function pitchFromStoredRiseFt(
  acrossFt: number,
  isShed: boolean,
  riseFt: number | undefined,
  ctx: RoofPitchSeatContext,
): number | null {
  if (riseFt === undefined || !(riseFt > 0)) return null;
  const { runForPitchIn, heelOffsetIn } = roofPitchRunAndHeel(acrossFt, isShed, ctx);
  if (!(runForPitchIn > 0)) return null;
  return (12 * (riseFt * 12 - heelOffsetIn)) / runForPitchIn;
}

/**
 * ⚠ **IS THIS ROOF A SHED OR A PEAK, read off the stored profile positions.**
 *
 * > *"I slid the peak to the middle of a tiny house and it didn't change the
 * > roof into a gable roof."* — Tommy, 2026-11-14
 *
 * A gable end stores WHERE its high point sits along its own wall, and a point
 * inside the 24in dead zone at either end means a shed. The gable END always
 * knew this; the roof planes, the roof panels, the ridge beam and the deck
 * takeoff were all told "shed" by a different rule until that was fixed.
 *
 * ⚠ **Extracted as a pure function on 2026-11-17 for two reasons, and the
 * second is the one that forced it.** It is the same question asked about two
 * different footprints — the CURRENT one for everything downstream, and the
 * OLD one when a resize needs to know what form the stored rise was measured
 * under. And reading the component's own `roofFormFromProfile` from a handler
 * declared ABOVE it cost three `preserve-manual-memoization` errors: the value
 * escapes into a function defined before it, so the compiler stops treating it
 * as preservable and every memo that depends on it flags. A pure function
 * taking its inputs explicitly costs nothing.
 */
export function roofFormFromProfilePositions(
  walls: readonly { id: string; lengthFt: number }[],
  gableEndWallIds: Iterable<string>,
  positionsInByWallId: Readonly<Record<string, readonly (number | null)[] | undefined>>,
): "shed" | "peaked" {
  for (const wallId of gableEndWallIds) {
    const positionIn = positionsInByWallId[wallId]?.[0];
    if (positionIn === null || positionIn === undefined) continue;
    const wallLengthIn = (walls.find((w) => w.id === wallId)?.lengthFt ?? 0) * 12;
    /* A wall with no length cannot be measured along, so it cannot be the
       thing that declares a shed. */
    if (!(wallLengthIn > 0)) continue;
    if (gableProfilePointIsShedEnd(positionIn, wallLengthIn)) return "shed";
  }
  return "peaked";
}
