/**
 * **What an upper row is cut into, so its studs land on the wall's.**
 *
 * > *"I also noticed that the second story as having a hard time landing on
 * > the same pattern as the wall below it. I really want these studs to line
 * > up."* — Tommy, 2026-11-12
 *
 * The row above a wall — a shed's tilted row, a second storey, a gable end —
 * was divided by its own rule and the wall by another, so the two never
 * agreed. The shed row said so on its own shop sheet: *"The row is divided on
 * the same 12in-minimum module the floor and roof runs use"*, which comes out
 * 15.5/24/17 over a wall running 48/44.125/40/28.125/32.125.
 *
 * ⚠ **The whole idea is that the upper row never learns what an opening IS.**
 * His: *"instead of the upstairs panels being for instance a door header,
 * they would simply be the same width as a door header."* So this takes
 * WIDTHS and nothing else. A door below is a width; a window below is a
 * width; the wall's own safety gap is a width that happens to be 3/4in.
 *
 * ⚠ **It refuses rather than approximating.** His call, 2026-11-12: *"build
 * the exact match rule, refuse the exceptions."* A row that cannot take the
 * wall's widths exactly is a row whose studs will not line up, and quietly
 * returning something close is how a panel comes to bear on nothing.
 */

/** One slot of the wall below, as this needs to see it. */
export interface WallSlotWidth {
  widthIn: number;
  /** A safety gap is carried through at its own width even though it is far
   * under the minimum — it is a gap, not a panel. */
  isSafetyGap?: boolean;
  /**
   * For a slot WIDER than the maximum panel: where its header's zigzag peaks
   * sit, as offsets from the slot's own start.
   *
   * > *"on a longer header, ideally the separations of panels would be at the
   * > same intervals of where the /\/\/\/\ zigzag pattern of headers peaks."*
   * > — Tommy, 2026-11-12
   *
   * An apex is where two web members meet the top chord, so a joint above one
   * lands on a real bearing point rather than on an arbitrary division of the
   * span. Absent or empty on a slot that is over-wide and has no header to
   * follow, which this refuses rather than dividing evenly.
   */
  headerPeakOffsetsIn?: readonly number[];
}

export interface UpperRowWidthsInput {
  /** The wall's slots, in order, measured from its true start corner. */
  wallSlotsIn: readonly WallSlotWidth[];
  /** Where the upper row starts, from that same corner. */
  rowStartIn: number;
  /** How long the upper row is. */
  rowRunIn: number;
  /** The narrowest and widest a panel in this row may be built. His
   * 2026-11-12 spec: *"Second story/roof helper panels can be 15.5" to 4'
   * wide."* */
  minPanelWidthIn: number;
  maxPanelWidthIn: number;
  /** How close two inch figures must be to count as the same joint. An
   * eighth is the grid everything else here snaps to. */
  toleranceIn?: number;
}

export type UpperRowWidths =
  | { kind: "aligned"; widthsIn: number[]; refusal: null }
  | { kind: "refused"; widthsIn: null; refusal: string };

const DEFAULT_TOLERANCE_IN = 1 / 8;

function refuse(reason: string): UpperRowWidths {
  return { kind: "refused", widthsIn: null, refusal: reason };
}

const inches = (n: number) => `${n.toFixed(3)}in`;

/**
 * Splits one over-wide slot at its header's peaks.
 *
 * Returns null when there is no header to follow, or when following it would
 * produce a piece outside the band — both of which are refusals for the
 * caller to report with the slot's own measurements.
 */
function splitAtPeaks(slot: WallSlotWidth, minPanelWidthIn: number, maxPanelWidthIn: number): number[] | null {
  const peaks = [...(slot.headerPeakOffsetsIn ?? [])].sort((a, b) => a - b);
  if (peaks.length === 0) return null;
  const cuts = [0, ...peaks, slot.widthIn];
  const pieces: number[] = [];
  for (let i = 1; i < cuts.length; i++) {
    const widthIn = cuts[i]! - cuts[i - 1]!;
    if (!(widthIn > 0)) return null;
    if (widthIn < minPanelWidthIn || widthIn > maxPanelWidthIn) return null;
    pieces.push(widthIn);
  }
  return pieces;
}

/**
 * The widths an upper row should be cut into so every one of its joints lands
 * on a joint of the wall below.
 */
export function computeUpperRowWidths(input: UpperRowWidthsInput): UpperRowWidths {
  const { wallSlotsIn, rowStartIn, rowRunIn, minPanelWidthIn, maxPanelWidthIn } = input;
  const tol = input.toleranceIn ?? DEFAULT_TOLERANCE_IN;
  if (!(rowRunIn > 0)) return refuse("The row has no run to fill.");
  const rowEndIn = rowStartIn + rowRunIn;

  /* Walk the wall once, recording where each slot begins and ends. */
  const spans: { slot: WallSlotWidth; startIn: number; endIn: number }[] = [];
  let atIn = 0;
  for (const slot of wallSlotsIn) {
    spans.push({ slot, startIn: atIn, endIn: atIn + slot.widthIn });
    atIn += slot.widthIn;
  }
  if (spans.length === 0) return refuse("The wall below has no panels to follow.");

  /* ⚠ **Both ends must land ON a wall joint**, or every joint after them is
     off by the remainder. On a default building they do, exactly: the row's
     own inset is the wall THICKNESS and the wall's corner panel is the same
     15.5in, so the row's run is precisely the wall between its two corners.
     That is not luck — the corner panel was taken from 25.5in to 15.5in on
     2026-11-01 so wall joints would stack on deck joints, and this falls out
     of it. Where the two differ (a 39in Square Bale corner, or a row whose
     inset was switched off) the row simply cannot follow the wall, and this
     says so with both numbers. */
  const startSpan = spans.find((s) => Math.abs(s.startIn - rowStartIn) <= tol);
  const endSpan = spans.find((s) => Math.abs(s.endIn - rowEndIn) <= tol);
  if (!startSpan) {
    const nearest = spans.reduce((best, s) =>
      Math.abs(s.startIn - rowStartIn) < Math.abs(best.startIn - rowStartIn) ? s : best,
    );
    return refuse(
      `The row starts at ${inches(rowStartIn)}, which is not a joint in the wall below — the nearest is ` +
        `${inches(nearest.startIn)}, ${inches(Math.abs(nearest.startIn - rowStartIn))} away. Its panels cannot line up ` +
        "with the wall's until the two runs start together.",
    );
  }
  if (!endSpan) {
    const nearest = spans.reduce((best, s) => (Math.abs(s.endIn - rowEndIn) < Math.abs(best.endIn - rowEndIn) ? s : best));
    return refuse(
      `The row ends at ${inches(rowEndIn)}, which is not a joint in the wall below — the nearest is ` +
        `${inches(nearest.endIn)}, ${inches(Math.abs(nearest.endIn - rowEndIn))} away. Its panels cannot line up with ` +
        "the wall's until the two runs end together.",
    );
  }

  const covered = spans.filter((s) => s.startIn >= startSpan.startIn - tol && s.endIn <= endSpan.endIn + tol);
  if (covered.length === 0) return refuse("The row covers no whole panel of the wall below.");

  const widthsIn: number[] = [];
  for (const { slot, startIn } of covered) {
    /* A safety gap rides through at its own width. His 2026-11-12 spec:
       the row "should have the same safety gaps as the walls below it", and
       copying the wall's widths is what delivers that — the gap is simply one
       of the widths. */
    if (slot.isSafetyGap) {
      widthsIn.push(slot.widthIn);
      continue;
    }
    if (slot.widthIn > maxPanelWidthIn) {
      const pieces = splitAtPeaks(slot, minPanelWidthIn, maxPanelWidthIn);
      if (pieces === null) {
        return refuse(
          `The wall has a ${inches(slot.widthIn)} panel at ${inches(startIn)}, wider than the ` +
            `${inches(maxPanelWidthIn)} this row may be built at. ` +
            (slot.headerPeakOffsetsIn && slot.headerPeakOffsetsIn.length > 0
              ? "Splitting it at its header's own peaks leaves a piece outside the row's width band."
              : "It carries no header whose peaks the split could follow, and dividing it anywhere else would " +
                "put a joint over nothing."),
        );
      }
      widthsIn.push(...pieces);
      continue;
    }
    if (slot.widthIn < minPanelWidthIn) {
      return refuse(
        `The wall has a ${inches(slot.widthIn)} panel at ${inches(startIn)}, narrower than the ` +
          `${inches(minPanelWidthIn)} this row may be built at.`,
      );
    }
    widthsIn.push(slot.widthIn);
  }

  /* The sum is the invariant everything else here exists to protect: the row
     has to be the row, to the eighth. */
  const sumIn = widthsIn.reduce((total, w) => total + w, 0);
  if (Math.abs(sumIn - rowRunIn) > tol) {
    return refuse(
      `Following the wall's widths gives ${inches(sumIn)} against the row's own ${inches(rowRunIn)}.`,
    );
  }
  return { kind: "aligned", widthsIn, refusal: null };
}

/**
 * Where a header's zigzag peaks sit across its own width, as offsets from its
 * start — the split points for a slot too wide for one upper panel.
 *
 * ⚠ Derived the same way `buildTrussWebZigzag` places them: the width is cut
 * into `peakCount` equal segments and each apex sits at its own segment's
 * middle. One derivation, so a joint above a peak cannot drift from the peak.
 */
export function headerPeakOffsetsIn(widthIn: number, peakCount: number): number[] {
  if (!(widthIn > 0) || !(peakCount >= 1)) return [];
  const segWidthIn = widthIn / peakCount;
  return Array.from({ length: peakCount }, (_, i) => segWidthIn * (i + 0.5));
}
