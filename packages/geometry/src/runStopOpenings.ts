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
 * 25.5in corner panel at both ends and two 61.5in windows, the LAST eighth at
 * which `retileWithOpenings` breaks the sum is **173.875in**, and it is
 * correct at every eighth from **174in** upward — which is exactly
 * `2 x 61.5 + 2 x 25.5`. **Tommy's 174in is his wall's own openings-plus-
 * corners total.**
 *
 * ⚠ **The boundary is exact; "it breaks at every eighth below it" is not, and
 * an earlier draft of this comment said so.** Counted: of the 984 eighths from
 * 51in to 173.875in, **793 break and 191 do not** — the tiler's own
 * merged-corner and corner-absorb branches happen to produce a summing run at
 * some of them. What matters for this module is the boundary, which is sharp:
 * below 174in there are runs with no legal tiling, and at or above it there
 * are none. Same law at other widths: three openings of 47.625/41.5/37.5in
 * with 14in corners have their last break at 154.5in and are correct from
 * 154.625in = 126.625 + 28.
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
 * ### The kept openings are deliberately NOT re-anchored — and why that alone
 * was not enough
 *
 * They keep the `beforeStandardCount` they arrived with, so the openings this
 * function hands the tiler are the caller's own anchors, untouched.
 *
 * **The first version of this module claimed that made restore byte-exact on
 * its own, and that claim was wrong.** It holds for this function in
 * isolation and is false through `tileOneWallPreservingOpenings`, because a
 * survivor's ordinal does not survive the round trip: the next re-tile reads
 * it back with `getOpeningAnchors(oldSlots)`, and on a stopped wall
 * `oldSlots` is the SHORTENED run. The remembered opening kept its long-run
 * ordinal while the survivor was silently re-derived against a shorter one,
 * so the two halves of the merged list were in different coordinate systems.
 * When the survivor's re-derived ordinal fell BELOW the remembered one, the
 * plain sort in `mergeRunStopOpenings` put them back in the wrong order —
 * measured on a 47ft wall carrying a window and a door, sweeping every
 * whole-inch start stop from 0 to 532in, **116 of those 533 stops came back
 * with the door and the window swapped.** A door where a window was, on a
 * shop drawing, is worse than a refusal.
 *
 * End stops happened to be clean (survivors keep the low ordinals and the
 * remembered ones are higher, so the sort agreed by accident), which is why
 * the first round of tests missed it. Tommy's 174in wall is stopped from BOTH
 * ends and carries two openings — the exact failing shape.
 *
 * ### What fixes it: the memory carries the pre-stop ORDER, not just the
 * withheld anchors
 *
 * `RunStopOpeningPartition.preStop` records the wall's opening sequence as it
 * was immediately before the stop withheld anything — one entry per opening,
 * left to right, each carrying the `beforeStandardCount` it had THEN and
 * whether the stop withheld it. That is the only thing re-derivation destroys
 * and the only thing stored to replace it.
 *
 * On the next re-tile `mergeRunStopOpenings` walks that sequence: it rebases
 * each survivor onto the pre-stop ordinal recorded for its position and
 * interleaves the remembered ones where they sat. Both halves are then in ONE
 * coordinate system — the pre-stop one — so the merged list is the list the
 * wall had before the stop, and un-stopping re-tiles to the slots it had
 * before the stop. Successive stop changes chain correctly, because each new
 * partition records the ordinals of the list the merge just rebased.
 *
 * Survivors are still not re-anchored for the BUILT run: re-anchoring them
 * onto the shortened run would improve their placement within a stopped run
 * by a panel or two, and it would throw away the pre-stop ordinals that make
 * the restore exact. Tommy's requirement is that window data never be lost by
 * stopping a wall and changing his mind; the trade goes that way.
 *
 * The visible consequence, stated rather than discovered: after a START stop,
 * surviving openings carry ordinals from the longer run, so
 * `retileWithOpenings` appends them toward the far end of the shortened run —
 * which is roughly where they are, since the start is what was removed.
 *
 * ### The one case restore is ordered-but-not-exact
 *
 * If openings are INSERTED or DELETED on the wall while it is stopped, the
 * survivor count no longer matches `preStop`'s kept count and there is no
 * one-for-one correspondence to rebase through. Restore then falls back to
 * splicing each remembered opening back at the position it held relative to
 * the survivors and clamping the merged ordinals monotonically, which
 * guarantees the ORDER — no opening ever changes places with another — but
 * not the exact panel it lands beside. Nothing is lost either way; that is
 * the promise, and it is the one it keeps in every case.
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

/** One opening in the wall's sequence as it stood immediately BEFORE the stop
 * withheld anything. See the module doc comment: this is the pre-stop
 * coordinate system, and storing it is what stops a re-derived survivor
 * ordinal from sorting past a remembered one. */
export interface PreStopOpeningPosition {
  /** The `beforeStandardCount` this opening had before the stop. */
  beforeStandardCount: number;
  /** True if an unbuilt span swallowed it. Withheld entries correspond, in
   * order, to `RunStopOpeningMemory.unbuilt`; the rest correspond, in order,
   * to the survivors `getOpeningAnchors` reads back off the stopped wall. */
  withheld: boolean;
}

/**
 * What a stopped wall hands forward so a later un-stop can put it back: the
 * anchors an unbuilt span swallowed, AND the order they sat in.
 *
 * **Both halves are load-bearing.** Storing only `unbuilt` is what the first
 * version of this change did, and it is what let a start stop swap a window
 * and a door — see the module doc comment.
 */
export interface RunStopOpeningMemory {
  /** Inside an unbuilt span: not built, not deleted. Handed back through
   * `remembered` on every later re-tile, so reducing or clearing the stop
   * restores them. Left-to-right order, aligned with `preStop`'s withheld
   * entries. Each carries its PRE-STOP `beforeStandardCount`. */
  readonly unbuilt: readonly OpeningAnchor[];
  /** The whole pre-stop sequence, left to right — survivors and withheld
   * alike. Empty when nothing was withheld. */
  readonly preStop: readonly PreStopOpeningPosition[];
}

export interface RunStopOpeningPartition {
  /** Built on the shortened run, in the caller's own order, anchors
   * untouched. */
  kept: OpeningAnchor[];
  /** Everything a later restore needs — see `RunStopOpeningMemory`. */
  memory: RunStopOpeningMemory;
}

/**
 * The memory of a wall that withheld nothing, which is every wall of every
 * unstopped project.
 *
 * **Shared and frozen on purpose.** Shared, because an unstopped project must
 * not allocate a fresh object per wall per re-tile; frozen, because a shared
 * value that anything could push into would be a cross-wall leak of exactly
 * the data this module exists to keep straight.
 */
export const EMPTY_RUN_STOP_OPENING_MEMORY: RunStopOpeningMemory = Object.freeze({
  unbuilt: Object.freeze([]),
  preStop: Object.freeze([]),
});

/** Every opening on the wall withheld — a fully-stopped run, or one the
 * tiler's own merged-corner/absorb branch could not keep reservations on. The
 * ordinals recorded are the ones the openings arrived with, which is the
 * pre-stop coordinate system by induction: the list came out of
 * `mergeRunStopOpenings`, which had already rebased it. */
function withholdEverything(openings: OpeningAnchor[]): RunStopOpeningMemory {
  const sorted = [...openings].sort((a, b) => a.beforeStandardCount - b.beforeStandardCount);
  return {
    unbuilt: sorted,
    preStop: sorted.map((o) => ({ beforeStandardCount: o.beforeStandardCount, withheld: true })),
  };
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
    return { kept: openings, memory: EMPTY_RUN_STOP_OPENING_MEMORY };
  }
  // Nothing at all is built on this wall, so nothing on it is built — every
  // opening is withheld, including any the caller had already withheld.
  if (toEighths(input.builtLengthIn) <= 0) return { kept: [], memory: withholdEverything(openings) };

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
  // The BASIS tiling itself dropped reservations (the merged corner, or the
  // corner-absorb band that could not keep them — see `resolveCorners`). That
  // is a pre-existing rule of the tiler and NOT something this stop did, so
  // there are no positions to read and nothing can be withheld by position.
  //
  // ⚠ **This bail-out is not harmless, and an earlier draft of this comment
  // calling it "today's behaviour, unchanged" was true only of an UNSTOPPED
  // wall.** On a stopped one it hands the shortened run every opening at full
  // width, which is exactly the over-length condition this module exists to
  // prevent; the sum-invariant backstop in page.tsx would then refuse with the
  // same useless message Tommy reported. It is accepted because every
  // reachable instance is latent: the basis run is this wall with its own
  // stops REMOVED, so it is the longest this wall is ever tiled at, and the
  // branches that drop reservations there need either a run under 51in or
  // corner 39 with `cornerMayWiden`, which the app does not currently produce.
  // **If a caller ever makes those reachable, this has to withhold rather than
  // pass through.**
  if (spans.length !== sorted.length) return { kept: openings, memory: EMPTY_RUN_STOP_OPENING_MEMORY };

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
      return { kept: [], memory: withholdEverything(openings) };
    }
  }

  // Nothing was withheld after all — every opening lies inside the built
  // window, so there is no memory and the anchor list round-trips untouched.
  if (unbuiltSet.size === 0) return { kept: openings, memory: EMPTY_RUN_STOP_OPENING_MEMORY };

  // `kept` in the CALLER's original order; the memory in LEFT-TO-RIGHT order,
  // read off `sorted`, because that is the order restore walks it in and the
  // order `getOpeningAnchors` will hand the survivors back in.
  return {
    kept: openings.filter((o) => !unbuiltSet.has(o)),
    memory: {
      unbuilt: sorted.filter((o) => unbuiltSet.has(o)),
      preStop: sorted.map((o) => ({ beforeStandardCount: o.beforeStandardCount, withheld: unbuiltSet.has(o) })),
    },
  };
}

/**
 * The full opening set a stopped wall is MEANT to have: what it currently
 * builds, plus whatever a stop withheld earlier — **in the order the wall had
 * them before the stop.**
 *
 * `current` is what `getOpeningAnchors` just read back off the stopped wall,
 * so it is in left-to-right order and carries the CURRENT payload of every
 * survivor (a width edited while the wall was stopped is honoured), but its
 * ordinals were re-derived against the SHORTENED run and are therefore in a
 * different coordinate system from the remembered ones. Reconciling those two
 * coordinate systems is this function's whole job; before it did, a start
 * stop could restore a window and a door in each other's places. See the
 * module doc comment for the measurement.
 *
 * The exact path: survivor *i* is rebased onto `memory.preStop`'s *i*-th kept
 * ordinal and the remembered ones are interleaved where they sat. The merged
 * list is then the pre-stop list, ordinal for ordinal.
 *
 * The fallback path, taken only when openings were inserted or deleted on the
 * wall while it was stopped so the counts no longer correspond: splice each
 * remembered opening back at the position it held among the survivors and
 * clamp the ordinals monotonically. Order is still exact — no two openings can
 * trade places — but placement is approximate, which it has to be once the
 * list itself changed underneath the memory.
 */
export function mergeRunStopOpenings(
  current: OpeningAnchor[],
  memory: RunStopOpeningMemory | undefined,
): OpeningAnchor[] {
  if (!memory || memory.unbuilt.length === 0) return current;
  const keptOrdinals = memory.preStop.filter((p) => !p.withheld).map((p) => p.beforeStandardCount);

  if (keptOrdinals.length === current.length) {
    const merged: OpeningAnchor[] = [];
    let keptIndex = 0;
    let unbuiltIndex = 0;
    for (const position of memory.preStop) {
      if (position.withheld) {
        merged.push(memory.unbuilt[unbuiltIndex++]!);
        continue;
      }
      const survivor = current[keptIndex]!;
      const ordinal = keptOrdinals[keptIndex++]!;
      merged.push(survivor.beforeStandardCount === ordinal ? survivor : { ...survivor, beforeStandardCount: ordinal });
    }
    // `preStop` was built from a sorted list, so `merged` is already
    // non-decreasing by ordinal and `retileWithOpenings`' own stable sort
    // cannot reorder it.
    return merged;
  }

  // Openings were added or removed while the wall was stopped. Insert from the
  // right, so an earlier recorded position is not shifted by a later
  // insertion; ties keep left-to-right order for the same reason.
  const spliced = [...current];
  const afterKept = afterKeptCounts(memory.preStop);
  for (let i = memory.unbuilt.length - 1; i >= 0; i--) {
    spliced.splice(Math.min(afterKept[i]!, spliced.length), 0, memory.unbuilt[i]!);
  }
  let previous = Number.NEGATIVE_INFINITY;
  return spliced.map((anchor) => {
    const ordinal = Math.max(anchor.beforeStandardCount, previous);
    previous = ordinal;
    return anchor.beforeStandardCount === ordinal ? anchor : { ...anchor, beforeStandardCount: ordinal };
  });
}

/** Per withheld entry of `preStop`, how many survivors preceded it. */
function afterKeptCounts(preStop: readonly PreStopOpeningPosition[]): number[] {
  const counts: number[] = [];
  let kept = 0;
  for (const position of preStop) {
    if (position.withheld) counts.push(kept);
    else kept++;
  }
  return counts;
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
      // `markSafetyCorner` rewrites ONE corner slot of a mitered footprint
      // (the octagon) to "safety-oct-corner" — still a corner panel, still
      // fixed content, and counting only "corner" understated an octagon's
      // requirement by a whole 25.5in panel. Measured before this fix: a
      // mitered run reported `cornerCount 1, requiredIn 87, plainBudgetIn 13`
      // where the truth is `2, 112.5, -12.5` — so the refusal quoted wrong
      // numbers, and there were stops where `refuses` stayed false and the
      // user fell through to the old "does not add back up" sentence.
    } else if (slot.type === "corner" || slot.type === "safety-oct-corner") {
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
