import { MAX_PANEL_LENGTH_IN, MAX_PANEL_WIDTH_IN } from "./ringFacetPanels";

/**
 * The longest roof a single run of panels can cover, measured FLAT ON THE
 * GROUND, at a given pitch.
 *
 * > *"I don't think we can make roof panels that are all that much longer
 * > than 16'. I have not had any structural engineer look at these yet. But
 * > that's a safe bet for now."* — Tommy, 2026-10-24
 *
 * ⚠ **16ft is a horizontal number, and a roof panel is not horizontal.** A
 * panel covering 16ft of ground at a 4:12 pitch is 16.87ft long, inside the
 * 18ft maximum. At 8:12 the same 16ft of ground needs 19.23ft of panel, and
 * at 12:12 it needs 22.63ft — both longer than anything the shop will build.
 * So the limit has to be computed back from the panel length rather than
 * fixed at 16:
 *
 * | Pitch | 18ft of panel covers |
 * |-------|----------------------|
 * | 2:12  | 17.76ft |
 * | 4:12  | 17.08ft |
 * | 6:12  | 16.10ft |
 * | 8:12  | 14.98ft |
 * | 12:12 | 12.73ft |
 *
 * His 16ft holds to about 6:12 and stops being true above it, which is why
 * he agreed this should be derived. Measured, not estimated.
 */
export function maxRoofPanelGroundRunIn(pitchIn12: number, maxPanelLengthIn = MAX_PANEL_LENGTH_IN): number {
  if (!(pitchIn12 >= 0)) return 0;
  /* A panel on a pitched roof is the hypotenuse of 12-and-rise over the run
     it covers, so the ground it reaches is its length divided by that. */
  const slopeMultiplier = Math.hypot(12, pitchIn12) / 12;
  return maxPanelLengthIn / slopeMultiplier;
}

/** The panel length a given run of ground needs at this pitch — the inverse,
 * and what a shop sheet has to print. */
export function roofPanelLengthForGroundRunIn(groundRunIn: number, pitchIn12: number): number {
  return groundRunIn * (Math.hypot(12, pitchIn12) / 12);
}

export type RoofFormKind = "shed" | "peaked";

export interface RoofFormDecision {
  kind: RoofFormKind;
  /** What one panel has to cover on the ground, after the form is chosen. */
  panelGroundRunIn: number;
  /** The panel length that implies, which is what the 18ft limit judges. */
  panelLengthIn: number;
  /** Why this form, in words the UI can show. */
  reason: string;
  /** Non-null when even the peaked form cannot be built at this pitch. */
  refusal: string | null;
}

/**
 * Which roof a building gets, from its own width.
 *
 * > *"If the roof panels length is 0-16, then gable ends spawn as shed roof,
 * > if longer than that, then [peaked] roof."* — Tommy, 2026-10-24
 *
 * A shed runs one set of panels clear across the building. A peaked roof
 * halves that, because each side only reaches the ridge — so a building that
 * a shed cannot cover usually falls inside a peak, and the trigger is simply
 * whether one panel can reach.
 *
 * ⚠ `forcePeaked` exists because he asked for it outright: *"some settings to
 * be able to do peaked roof even if it's a small building."* A small building
 * can have a peak because somebody wants one, not only because it needs one.
 */
export function decideRoofForm(options: {
  buildingWidthIn: number;
  pitchIn12: number;
  forcePeaked?: boolean;
  maxPanelLengthIn?: number;
}): RoofFormDecision {
  const maxPanelLengthIn = options.maxPanelLengthIn ?? MAX_PANEL_LENGTH_IN;
  const limitIn = maxRoofPanelGroundRunIn(options.pitchIn12, maxPanelLengthIn);
  const shedRunIn = options.buildingWidthIn;
  const peakedRunIn = options.buildingWidthIn / 2;
  const ft = (n: number) => (n / 12).toFixed(1);

  const shedFits = shedRunIn <= limitIn + 1e-9;
  if (shedFits && !options.forcePeaked) {
    return {
      kind: "shed",
      panelGroundRunIn: shedRunIn,
      panelLengthIn: roofPanelLengthForGroundRunIn(shedRunIn, options.pitchIn12),
      reason:
        `One run of panels reaches clear across ${ft(shedRunIn)}ft, inside the ${ft(limitIn)}ft a ` +
        `${(maxPanelLengthIn / 12).toFixed(0)}ft panel covers at ${options.pitchIn12}:12.`,
      refusal: null,
    };
  }

  const peakedLengthIn = roofPanelLengthForGroundRunIn(peakedRunIn, options.pitchIn12);
  if (peakedRunIn > limitIn + 1e-9) {
    return {
      kind: "peaked",
      panelGroundRunIn: peakedRunIn,
      panelLengthIn: peakedLengthIn,
      reason: "",
      refusal:
        `Even split at a ridge, each side of this roof covers ${ft(peakedRunIn)}ft of ground, which needs a ` +
        `${ft(peakedLengthIn)}ft panel at ${options.pitchIn12}:12 — longer than the ` +
        `${(maxPanelLengthIn / 12).toFixed(0)}ft maximum. This roof needs a bearing line between the wall and ` +
        "the ridge, which nothing models yet.",
    };
  }

  return {
    kind: "peaked",
    panelGroundRunIn: peakedRunIn,
    panelLengthIn: peakedLengthIn,
    reason: options.forcePeaked
      ? `Peaked because it was asked for. Each side covers ${ft(peakedRunIn)}ft.`
      : `A shed would need one panel to cover ${ft(shedRunIn)}ft, past the ${ft(limitIn)}ft a ` +
        `${(maxPanelLengthIn / 12).toFixed(0)}ft panel reaches at ${options.pitchIn12}:12. Split at a ridge, ` +
        `each side covers ${ft(peakedRunIn)}ft.`,
    refusal: null,
  };
}

/** Re-exported so callers reasoning about roof panels have the envelope to
 * hand without reaching into the ring-roof module for it. */
export { MAX_PANEL_LENGTH_IN, MAX_PANEL_WIDTH_IN };
