import { toEighths } from "./eighths";
import { retileWithOpenings, type OpeningAnchor } from "./tiling";
import type { PanelSlot, WallEnd } from "./types";

/**
 * Project Smearforn Stage 3, the defect Tommy hit building the Rogers-Sehorn
 * ADU:
 *
 * > *"i am having trouble building the seahorn project using the stop wall
 * > tool. whenever i stop wall over a certain amount, for one wall this
 * > boundary was 174", it says that the panel wall doesnt add up and will not
 * > let me edit the layout how i need to"*
 *
 * ### What was wrong
 *
 * `retileWithOpenings` reserves EVERY opening on the wall at its full width,
 * because an `OpeningAnchor` carries `beforeStandardCount` — an ORDINAL in
 * the slot sequence — and nothing in it says where along the wall the opening
 * actually sits. Shorten the run with a stop and the openings come along
 * whole. Once the shortened run is narrower than `Σ openings + Σ corners`,
 * `plainBudgetIn` goes negative, `Math.max(0, …)` clamps it, and the slots
 * then sum to MORE than the wall. The sum-invariant backstop in `page.tsx`
 * correctly refuses — but it reports the downstream symptom, which is the
 * useless message above.
 *
 * Measured, so the boundary is on the record rather than inferred: with a
 * 25.5in corner panel at both ends and two 61.5in windows,
 * `retileWithOpenings` breaks the sum at every eighth from 51in up to
 * **173.875in**, and is correct again from **174in** — which is exactly
 * `2 x 61.5 + 2 x 25.5`. **Tommy's 174in is his wall's own openings-plus-
 * corners total.** Same law at other widths: three openings of
 * 47.625/41.5/37.5in with 14in corners break up to 154.5in and are correct
 * from 154.625in = 126.625 + 28.
 *
 * ### Tommy's decision, 2026-09-29 — "Drop them, and remember"
 *
 * Offered three options, he chose:
 *
 * > *"Openings in the stopped-off part are removed from the built run, but
 * > stored so they come straight back if you un-stop the wall. Physically
 * > honest — an unbuilt section has no windows — and non-destructive."*
 *
 * So an opening inside an unbuilt span leaves the slot list, the cut list,
 * the fabrication groups and the shop drawings; and it is REMEMBERED, never
 * deleted, so un-stopping restores it exactly.
 *
 * ### Where "inside the stopped-off part" comes from
 *
 * Positions are not stored anywhere, so they are DERIVED: this tiles the
 * wall's BASIS run — the run it would have with its own stops removed but
 * every other wall's applied — with every opening, and walks the resulting
 * slots accumulating width. That gives each opening a real `[xStart, xEnd]`
 * along the basis run, which is the same coordinate the stops are measured
 * in. The built window is `[startStopIn, basisLengthIn − endStopIn]`; an
 * opening is built only if it lies wholly inside it. Both ends, and both
 * ends at once, fall out of that one test with no end-specific branches.
 *
 * ### Why the kept set always fits — the property this rests on
 *
 * The basis tiling already laid those openings out edge to edge without
 * overlap, and the corner panels occupy the two ends of that same layout. A
 * stopped end has no corner panel (`applyWallRunStop` takes it with the
 * stop), and an unstopped end's corner sits at exactly the same place in
 * basis coordinates as it does in the built run. So for every combination of
 * stops, `Σ kept openings + Σ built corners <= built length`, and the plain
 * budget can no longer go negative. That is the sentence the whole fix
 * reduces to.
 *
 * ### The kept openings are deliberately NOT re-anchored
 *
 * They keep the `beforeStandardCount` they arrived with. That is what makes
 * restore EXACT rather than approximate: `mergeRunStopOpenings` puts the
 * remembered ones back beside them by plain ordinal, and the merged list is
 * byte-for-byte the list the wall had before the stop, so un-stopping
 * re-tiles to the slots it had before the stop. Re-anchoring the survivors
 * onto the shorter run would improve their placement WITHIN a stopped run by
 * a panel or two, and would break that exactness — a remembered opening and a
 * re-anchored survivor would no longer sort back into their original order.
 * Tommy's requirement is that window data never be lost by stopping a wall
 * and changing his mind; the trade goes that way.
 *
 * The visible consequence, stated rather than discovered: after a START stop,
 * surviving openings carry ordinals from the longer run, so
 * `retileWithOpenings` appends them toward the far end of the shortened run —
 * which is roughly where they are, since the start is what was removed.
 */

const isOpeningSlot = (slot: PanelSlot): boolean =>
  slot.type === "window" || slot.type === "door" || slot.type === "column" || slot.type === "big-header";

export interface RunStopOpeningPartitionInput {
  /** The run this wall tiles at with its OWN stops removed but every other
   * wall's applied — `wallRunFor(wall, ownership, undefined).lengthIn`. The
   * same basis `wallRunStopBasisIn` in page.tsx measures a stop against, and
   * it has to be, or the window below is in the wrong coordinate. */
  basisLengthIn: number;
  basisHasCornerStart: boolean;
  basisHasCornerEnd: boolean;
  /** The BUILT run — `applyWallRunStop` already applied, corners at stopped
   * ends already gone. */
  builtLengthIn: number;
  builtHasCornerStart: boolean;
  builtHasCornerEnd: boolean;
  startStopIn: number;
  endStopIn: number;
  standardWidthIn: number;
  cornerWidthIn: number;
  gapEnd: WallEnd;
  allowBorrow: boolean;
  cornerMayWiden: boolean;
  /** Every opening this wall is meant to have — the built ones AND anything
   * a previous stop withheld. See `mergeRunStopOpenings`. */
  openings: OpeningAnchor[];
}

export interface RunStopOpeningPartition {
  /** Built on the shortened run, in the caller's own order, anchors
   * untouched. */
  kept: OpeningAnchor[];
  /** Inside an unbuilt span: not built, not deleted. Stored by the caller and
   * handed back through `openings` on every later re-tile, so reducing or
   * clearing the stop restores them. */
  unbuilt: OpeningAnchor[];
}

/**
 * Splits a wall's openings into the ones its BUILT run carries and the ones
 * an unbuilt span swallows. See this module's own doc comment for the rule,
 * the measurement behind Tommy's 174in, and why the kept set always fits.
 *
 * **A wall with no stop returns its input unchanged, by reference-equal
 * array**, before any tiling happens — every project ever saved has no stop
 * at all, and this must cost exactly nothing when it is not used.
 */
export function partitionOpeningsByRunStop(input: RunStopOpeningPartitionInput): RunStopOpeningPartition {
  const { openings } = input;
  const startEighths = Math.max(0, toEighths(input.startStopIn));
  const endEighths = Math.max(0, toEighths(input.endStopIn));
  if (openings.length === 0 || (startEighths === 0 && endEighths === 0)) {
    return { kept: openings, unbuilt: [] };
  }
  // Nothing at all is built on this wall, so nothing on it is built — every
  // opening is withheld, including any the caller had already withheld.
  if (toEighths(input.builtLengthIn) <= 0) return { kept: [], unbuilt: [...openings] };

  const basisSlots = retileWithOpenings(
    input.basisLengthIn,
    input.standardWidthIn,
    input.cornerWidthIn,
    input.gapEnd,
    input.basisHasCornerStart,
    input.basisHasCornerEnd,
    openings,
    input.allowBorrow,
    input.cornerMayWiden,
  ).slots;

  // `retileWithOpenings` sorts by anchor before laying out, so the opening
  // slots come out in that order and can be matched to it positionally.
  const sorted = [...openings].sort((a, b) => a.beforeStandardCount - b.beforeStandardCount);
  const spans: { startEighths: number; endEighths: number }[] = [];
  let cursor = 0;
  for (const slot of basisSlots) {
    const widthEighths = toEighths(slot.widthIn);
    if (isOpeningSlot(slot)) spans.push({ startEighths: cursor, endEighths: cursor + widthEighths });
    cursor += widthEighths;
  }
  // The basis tiling itself dropped reservations (the merged corner, or the
  // corner-absorb band that could not keep them — see `resolveCorners`). That
  // is a pre-existing rule of the tiler and NOT something this stop did, so
  // there are no positions to read and nothing new is withheld: today's
  // behaviour, unchanged.
  if (spans.length !== sorted.length) return { kept: openings, unbuilt: [] };

  const windowStartEighths = startEighths;
  const windowEndEighths = Math.max(startEighths, toEighths(input.basisLengthIn) - endEighths);
  const keptSorted: OpeningAnchor[] = [];
  const unbuiltSet = new Set<OpeningAnchor>();
  for (let i = 0; i < sorted.length; i++) {
    const span = spans[i]!;
    const anchor = sorted[i]!;
    if (span.startEighths >= windowStartEighths && span.endEighths <= windowEndEighths) keptSorted.push(anchor);
    else unbuiltSet.add(anchor);
  }

  // **Verify, then withhold.** The kept set fits by construction (see the
  // module doc comment), but the shortened run can still land in the tiler's
  // own merged-corner or corner-absorb branch, which drops every reservation
  // on its own. Those openings would otherwise vanish from the slots with
  // nothing remembering them — the exact data loss this whole change exists
  // to prevent. Cheap, and it makes the memory complete rather than mostly
  // complete.
  if (keptSorted.length > 0) {
    const builtSlots = retileWithOpenings(
      input.builtLengthIn,
      input.standardWidthIn,
      input.cornerWidthIn,
      input.gapEnd,
      input.builtHasCornerStart,
      input.builtHasCornerEnd,
      keptSorted,
      input.allowBorrow,
      input.cornerMayWiden,
    ).slots;
    if (builtSlots.filter(isOpeningSlot).length !== keptSorted.length) {
      return { kept: [], unbuilt: [...openings] };
    }
  }

  // Both lists in the CALLER's original order, not the sorted one — an anchor
  // list round-trips through here untouched when nothing is withheld.
  return {
    kept: openings.filter((o) => !unbuiltSet.has(o)),
    unbuilt: openings.filter((o) => unbuiltSet.has(o)),
  };
}

/**
 * The full opening set a stopped wall is MEANT to have: what it currently
 * builds, plus whatever a stop withheld earlier.
 *
 * Ordinals are never rewritten on either side (see the module doc comment),
 * so a plain stable sort puts a remembered opening back exactly where it was
 * relative to its neighbours — which is what makes un-stopping restore the
 * wall's previous slots rather than an approximation of them.
 *
 * Remembered entries are listed FIRST before sorting, so that where two
 * openings share an ordinal (they were adjacent, with no standard panel
 * between them) the remembered one lands on the left. Arbitrary but FIXED,
 * the same discipline `distributeEighths`' absorber rule uses — nobody has
 * decided which of two adjacent openings is "first", and a stable rule beats
 * a plausible one.
 */
export function mergeRunStopOpenings(
  current: OpeningAnchor[],
  remembered: OpeningAnchor[] | undefined,
): OpeningAnchor[] {
  if (!remembered || remembered.length === 0) return current;
  return [...remembered, ...current].sort((a, b) => a.beforeStandardCount - b.beforeStandardCount);
}

export interface RunStopOpeningFit {
  /** Openings the built run carries, and what they take. */
  openingCount: number;
  openingsTotalIn: number;
  /** Corner panels the built run still builds, and what they take. */
  cornerCount: number;
  cornersTotalIn: number;
  /** `openingsTotalIn + cornersTotalIn` — the run's fixed content. */
  requiredIn: number;
  /** What is left for standard/braced/safety panels. */
  plainBudgetIn: number;
  /** The budget is neither 0 nor wide enough to be a panel the shop can
   * build, so this run has no legal tiling. */
  refuses: boolean;
}

/**
 * Reads a tiled run back and says whether its fixed content — the openings
 * that survived the stop, plus the corner panels it still builds — leaves a
 * plain budget that can actually be panelized.
 *
 * This is what lets a refusal name the REAL constraint ("this wall's 2
 * windows and 2 corner panels need 174in") instead of the sum-invariant
 * symptom Tommy was shown. It reads the slots the tiler actually produced
 * rather than re-deriving corner widths, so it cannot drift from
 * `resolveCorners`' merge/absorb branches.
 *
 * A budget of exactly 0 is LEGAL — a run that is precisely its openings plus
 * its corners has no standard panels and sums exactly.
 */
export function runStopOpeningFit(
  slots: PanelSlot[],
  builtLengthIn: number,
  minPanelWidthIn: number,
): RunStopOpeningFit {
  let openingCount = 0;
  let openingEighths = 0;
  let cornerCount = 0;
  let cornerEighths = 0;
  for (const slot of slots) {
    const widthEighths = toEighths(slot.widthIn);
    if (isOpeningSlot(slot)) {
      openingCount++;
      openingEighths += widthEighths;
    } else if (slot.type === "corner") {
      cornerCount++;
      cornerEighths += widthEighths;
    }
  }
  // Measured against the run the wall HAS, not against the sum of the slots
  // the tiler emitted: when the budget went negative the tiler clamped it to
  // zero and emitted no plain panels at all, so that sum is exactly the
  // overrun this figure has to be able to report as negative.
  const plainEighths = toEighths(builtLengthIn) - openingEighths - cornerEighths;
  return {
    openingCount,
    openingsTotalIn: openingEighths / 8,
    cornerCount,
    cornersTotalIn: cornerEighths / 8,
    requiredIn: (openingEighths + cornerEighths) / 8,
    plainBudgetIn: plainEighths / 8,
    refuses: openingCount > 0 && plainEighths !== 0 && plainEighths < toEighths(minPanelWidthIn),
  };
}
