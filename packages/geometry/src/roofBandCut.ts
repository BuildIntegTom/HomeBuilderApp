import { deckSpanRangeFtAt } from "./deckPanelCut";
import type { Footprint } from "./types";

/* ──────────────────────────────────────────────────────────────────────────
   CUTTING A BAND OF ROOF PANELS TO THE BUILDING

   > *"can we have the roof be basically cut to fit the raised octagon gable
   > perimeter?"* — Tommy, 2026-11-15, and then, asked how the cut is made:
   > *"i imagined roof panels to be cut plumb vertically when plan view looking
   > down on the building. this would in reality make an elongated octagon
   > roof."* — 2026-11-18

   ⚠ **The roof is cut in PLAN and the panels live on a SLOPE**, which is the
   one conversion in here and the one place it can go wrong. A chamfer that
   takes 12in of ground takes 12.6in off a panel at 4:12, because the panel is
   the hypotenuse over the ground it covers. Everything this module returns is
   in PLAN inches; `slopePerRunFt` is the caller's, and `roofBandCutToMitre`
   below is the one place the two meet.

   ⚠ **It is the same cut the FLOOR takes**, through `deckSpanRangeFtAt`, so a
   building cannot be cut one shape underneath and another on top. What it adds
   is the two things a roof has and a floor does not: a run that repeats along
   the EAVE rather than along the floor's own axis, and a band that is only
   part of the way up the slope.
   ────────────────────────────────────────────────────────────────────────── */

/** One roof panel's band, cut to the building at both of its ends. All in
 *  PLAN inches from the band's own start, up the slope. */
export interface RoofBandPanelCut {
  nearStartIn: number;
  nearEndIn: number;
  farStartIn: number;
  farEndIn: number;
  /** True when either end is a sloped cut rather than square. */
  isMitred: boolean;
}

export interface RoofBandCutOptions {
  /** The plan axis the panels repeat along — the eave's own axis, which is the
   *  ridge's. NOT the floor's run axis: they agree on most buildings and not
   *  on all, and taking the floor's is the mistake this parameter exists to
   *  make impossible. */
  runAxis: "x" | "y";
  /** Absolute coordinate on `runAxis` where this row of panels begins. */
  runOriginFt: number;
  /** Which way along `runAxis` the row advances. */
  runSign: 1 | -1;
  /** Absolute coordinate on the OTHER axis of the plane's low (eave) edge. */
  eaveAcrossFt: number;
  /** Which way across the plane climbs from that edge. */
  upSign: 1 | -1;
  /** Plan inches from the plane's low edge to this band's start. */
  bandBaseIn: number;
  /** Plan inches of ground this band covers. */
  bandRunIn: number;
  panelWidthsIn: readonly number[];
}

/**
 * How far the building reaches up the slope at one position along the eave —
 * in PLAN inches from the plane's own low edge, or `null` at a pointed corner.
 */
function reachUpSlopeIn(footprint: Footprint, o: RoofBandCutOptions, alongIn: number): { loIn: number; hiIn: number } | null {
  const runAtFt = o.runOriginFt + (o.runSign * alongIn) / 12;
  const range = deckSpanRangeFtAt(footprint, runAtFt, o.runAxis);
  if (!range) return null;
  const a = (range.startFt - o.eaveAcrossFt) * o.upSign * 12;
  const b = (range.endFt - o.eaveAcrossFt) * o.upSign * 12;
  return { loIn: Math.min(a, b), hiIn: Math.max(a, b) };
}

/**
 * Every panel of one band, cut to the building.
 *
 * ⚠ **The band's own interval bounds the answer.** A peaked roof's plane stops
 * at the ridge and a multi-band plane stops at its bearing wall; the building
 * carries on past both. Without the intersection a panel at the ridge would be
 * reported as reaching the far wall, and the "cut" would lengthen it.
 */
export function clipRoofBandPanels(footprint: Footprint, o: RoofBandCutOptions): RoofBandPanelCut[] {
  const bandEndIn = o.bandBaseIn + o.bandRunIn;
  const edgeAt = (alongIn: number): { startIn: number; endIn: number } => {
    const reach = reachUpSlopeIn(footprint, o, alongIn);
    /* A pointed corner has no width; the panel still has to start somewhere,
       so it collapses to a zero-length end rather than vanishing — the same
       answer `clipDeckPanelsToFootprint` gives the floor. */
    if (!reach) return { startIn: 0, endIn: 0 };
    const startIn = Math.min(Math.max(reach.loIn, o.bandBaseIn), bandEndIn) - o.bandBaseIn;
    const endIn = Math.min(Math.max(reach.hiIn, o.bandBaseIn), bandEndIn) - o.bandBaseIn;
    return { startIn, endIn };
  };

  const cuts: RoofBandPanelCut[] = [];
  let atIn = 0;
  for (const widthIn of o.panelWidthsIn) {
    const near = edgeAt(atIn);
    const far = edgeAt(atIn + widthIn);
    cuts.push({
      nearStartIn: near.startIn,
      nearEndIn: near.endIn,
      farStartIn: far.startIn,
      farEndIn: far.endIn,
      isMitred:
        Math.abs(near.startIn - far.startIn) > 1e-6 ||
        Math.abs(near.endIn - far.endIn) > 1e-6 ||
        Math.abs(near.startIn) > 1e-6 ||
        Math.abs(far.startIn) > 1e-6 ||
        Math.abs(near.endIn - o.bandRunIn) > 1e-6 ||
        Math.abs(far.endIn - o.bandRunIn) > 1e-6,
    });
    atIn += widthIn;
  }
  return cuts;
}

/**
 * One band cut, as the pull-backs a panel is built with — **converted from
 * PLAN inches to the panel's own SLOPE inches.**
 *
 * ⚠ This is the conversion the whole module exists to isolate. A roof panel is
 * the hypotenuse over the ground it covers, so a chamfer that takes 12in of
 * ground takes `12 * slopePerRun` off the panel — 12.65in at 4:12. Doing it in
 * plan and handing the number to a panel builder would cut every mitred roof
 * panel short, by more the steeper the roof.
 */
export function roofBandCutToMitre(
  cut: RoofBandPanelCut,
  bandRunIn: number,
  slopePerRun: number,
): { startNearIn: number; startFarIn: number; endNearIn: number; endFarIn: number } {
  return {
    startNearIn: Math.max(0, cut.nearStartIn) * slopePerRun,
    startFarIn: Math.max(0, cut.farStartIn) * slopePerRun,
    endNearIn: Math.max(0, bandRunIn - cut.nearEndIn) * slopePerRun,
    endFarIn: Math.max(0, bandRunIn - cut.farEndIn) * slopePerRun,
  };
}

/** The ground this cut panel really covers, in square feet — the trapezoid's
 *  area, which is what stops the roof overclaiming the way the floor deck used
 *  to. Plan area; the caller multiplies by its own slope factor for coverage. */
export function roofBandCutPlanAreaSqFt(cut: RoofBandPanelCut, widthIn: number): number {
  const near = Math.max(0, cut.nearEndIn - cut.nearStartIn);
  const far = Math.max(0, cut.farEndIn - cut.farStartIn);
  return ((near + far) / 2 / 12) * (widthIn / 12);
}
