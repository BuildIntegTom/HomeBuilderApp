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
 * ### Where restore is exact, where it is not, and how a caller can tell
 *
 * ⚠ **An earlier draft of this comment promised "order is still exact — no two
 * openings can trade places" in every case, and the spec and two pieces of
 * user-facing text repeated it. It was false in two reachable shapes, both
 * measured.** Both need an intervening edit while the wall is stopped, which
 * is the one thing a memory keyed by ordinals cannot see.
 *
 * 1. **Delete a survivor while stopped.** Pre-stop
 *    `[door(1), WINDOW(3, withheld), column(5)]`; the user deletes the door;
 *    the survivors read back as `[column]`. The counts no longer correspond,
 *    and the old fallback spliced the remembered window in after 1 survivor:
 *    `[column, window]` — the window back on the WRONG SIDE of a survivor.
 *    Two openings traded places, which is the same class of defect as the
 *    window/door swap that blocked the first review.
 * 2. **Delete one and insert another, count unchanged.** Same memory,
 *    survivors `[column, big-header]`. The counts still correspond, so the
 *    exact path is taken — and it assumes survivor *i* is `preStop`'s *i*-th
 *    kept entry. One delete plus one insert breaks that correspondence without
 *    breaking the count, so nothing notices: merged `[column, window,
 *    big-header]`, reported as byte-exact.
 *
 * **What is fixed: each `preStop` entry now records the opening's PAYLOAD as
 * well as its ordinal** (`PreStopOpeningPosition.payload` — type, width,
 * height). The fallback matches survivors to the kept entries they came from
 * by payload, in order, rather than by index, so shape 1 restores the window
 * on the correct side of the column and a single delete is no longer
 * approximate at all.
 *
 * **What is NOT fixed, stated rather than glossed:** shape 2 still takes the
 * index path.
 *
 * **The decisive reason is not frequency, it is that payload alignment would
 * MANUFACTURE an order defect in the case the index path gets exactly right.**
 * An unmatched survivor is placed at `lastMatchedIndex + k/(n+1)`, and before
 * the first match `lastMatchedIndex` is `-1` — a NEGATIVE position, which sorts
 * ahead of a remembered opening recorded at `preStop` index 0. So pre-stop
 * `[WINDOW(withheld), door]` with the door's width edited while stopped — no
 * insert, no delete, the commonest edit there is — would stop matching the door
 * to its kept entry and restore `[door, window]`: two openings traded places,
 * the exact class of defect this module exists to prevent, introduced to fix a
 * rarer one. The index path restores `[window, door]` there, correctly.
 *
 * Frequency is the secondary argument and it is **reasoned, not measured** — we
 * believe a count-preserving change is far more often a width or height edit on
 * a survivor (which the app's own opening tools make easy) than a delete plus an
 * insert, but nobody has used this in anger yet and nobody will before November,
 * so it cannot be more than a prior. Without stable opening ids the two are
 * indistinguishable either way.
 *
 * So the promise, in the only form that is true everywhere:
 *
 * - **Nothing is ever lost.** Every remembered opening comes back on its own
 *   wall, in every case. That is Tommy's decision and it holds unconditionally.
 * - **Restore is exact when the wall's opening payloads still match the ones
 *   `preStop` recorded.** `runStopRestoreFidelity` answers exactly that, and
 *   the Review Log entry and the elevation notice condition their wording on
 *   it — no user-facing text promises "exactly as drawn" unless it passes.
 * - **Otherwise placement is approximate and order can differ**, because the
 *   list changed underneath the memory.
 *
 * The full fix is stable opening ids, which all three bullets reduce to, and
 * which is deliberately out of scope here.
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
   * to the survivors `getOpeningAnchors` reads back off the stopped wall —
   * **unless openings were inserted or deleted while the wall was stopped,
   * which is what `payload` exists to detect.** */
  withheld: boolean;
  /** What sat here, so a survivor can be matched to the entry it came from by
   * WHAT IT IS rather than by its index in a list that may have changed
   * underneath the memory. See the module doc comment's two measured shapes.
   *
   * Optional only so that a memory written without it — a hand-edited file, or
   * one carrying an in-flight shape from this change's own earlier commits —
   * degrades to positional correspondence instead of misaligning everything.
   * Every memory this module writes sets it. */
  payload?: PreStopOpeningPayload;
}

/**
 * Type/width/height of one opening. **Payload, never identity:** two identical
 * windows are indistinguishable here, which is precisely why restoring them in
 * either order produces the same drawing.
 *
 * Deliberately NOT the whole `OpeningAnchor`. Zones, braced style and sill
 * height are carried by the anchor itself (for a withheld opening) or by the
 * live slot (for a survivor); duplicating them here would be a second copy of
 * the same data that could disagree with the first.
 */
export interface PreStopOpeningPayload {
  type: OpeningAnchor["type"];
  widthIn: number;
  heightIn?: number;
}

/** Eighth-grid equality, since every width and height in this app is on that
 * grid and a raw `===` on halves of an inch would be comparing floats. */
const sameLength = (a: number | undefined, b: number | undefined): boolean =>
  a === undefined || b === undefined ? a === b : toEighths(a) === toEighths(b);

const samePayload = (a: PreStopOpeningPayload, b: PreStopOpeningPayload): boolean =>
  a.type === b.type && sameLength(a.widthIn, b.widthIn) && sameLength(a.heightIn, b.heightIn);

/** `heightIn` is omitted rather than set to `undefined` so the stored shape
 * round-trips through JSON unchanged. */
const payloadOf = (opening: OpeningAnchor): PreStopOpeningPayload =>
  opening.heightIn === undefined
    ? { type: opening.type, widthIn: opening.widthIn }
    : { type: opening.type, widthIn: opening.widthIn, heightIn: opening.heightIn };

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
   * alike, each with the ordinal it had then and what it was. Empty when
   * nothing was withheld.
   *
   * ⚠ **INVARIANT, and it is load-bearing rather than tidy: the withheld
   * entries here correspond ONE FOR ONE with `unbuilt`.** `mergeRunStopOpenings`
   * emits a remembered opening only when it walks past a withheld entry, on
   * both of its paths, and it takes them from `unbuilt` in lockstep — so too
   * FEW withheld entries silently deletes the extra anchors (an empty `preStop`
   * beside a non-empty `unbuilt` deletes all of them, and
   * `runStopRestoreFidelity` then vacuously calls that `"exact"`), and too many
   * pushes `undefined` into the anchor list and throws out of the tiler.
   * Everything this module writes holds it by construction; the one thing that
   * can hand over a memory it did not build is `parseProjectFile`, and
   * `openingMemoryStory` there checks and repairs it. */
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
    preStop: sorted.map((o) => ({ beforeStandardCount: o.beforeStandardCount, withheld: true, payload: payloadOf(o) })),
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
      preStop: sorted.map((o) => ({
        beforeStandardCount: o.beforeStandardCount,
        withheld: unbuiltSet.has(o),
        payload: payloadOf(o),
      })),
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
 * The payload path, taken when openings were inserted or deleted on the wall
 * while it was stopped so the counts no longer correspond: each survivor is
 * matched — in order, by payload — to the kept entry it came from, the
 * remembered ones go back at their own recorded positions, and the ordinals are
 * clamped monotonically. A survivor with no match is one inserted while the
 * wall was stopped; it keeps its own re-derived ordinal and stays between the
 * same two survivors it was inserted between. **A single deletion restores
 * exactly: the matched survivors carry their pre-stop ordinals, so the result
 * is the pre-stop list minus the deleted opening.**
 *
 * The positional fallback, for a memory whose kept entries carry no payload at
 * all (hand-edited, or an in-flight shape from this change's own earlier
 * commits): splice each remembered opening back after the number of survivors
 * that preceded it. This is what the payload path replaced, kept because
 * degrading to it is strictly better than matching against nothing.
 *
 * ⚠ **Read the module doc comment before describing any of this as exact.**
 * One reachable shape — a delete plus an insert, count unchanged — takes the
 * exact path and is NOT exact, deliberately; `runStopRestoreFidelity` is how a
 * caller tells, and it is what the user-facing wording is conditioned on.
 *
 * ⚠ **PRECONDITION: `memory.preStop`'s withheld entries correspond one for one
 * with `memory.unbuilt`** — see `RunStopOpeningMemory.preStop`. Both paths below
 * emit remembered openings only by walking `preStop`, so a memory that breaks it
 * loses anchors outright (`mergeRunStopOpenings([door], { unbuilt: [window],
 * preStop: [] })` returns `[door]`) or reads past the end of `unbuilt`. This
 * function does not re-check it per call — it is on the hot re-tile path and
 * every writer in this module holds it by construction; `parseProjectFile` is
 * where an outside memory is made to hold it.
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

  // Openings were added or removed while the wall was stopped, so there is no
  // one-for-one correspondence left to rebase through. Match each survivor to
  // the kept entry it came from BY PAYLOAD instead — which is what puts a
  // remembered opening back on the correct side of a survivor after a delete.
  const keptEntries = memory.preStop
    .map((position, preStopIndex) => ({ position, preStopIndex }))
    .filter((entry) => !entry.position.withheld);
  if (!keptEntries.every((entry) => entry.position.payload !== undefined)) {
    return mergeByRecordedPosition(current, memory);
  }
  const matchedTo = matchSurvivorsByPayload(keptEntries, current);

  // One list in PRE-STOP coordinates: a matched survivor sits at its kept
  // entry's own index, a remembered one at its own, and a survivor inserted
  // while the wall was stopped takes a fractional place just after the last
  // matched one — which keeps it between the same two survivors it was
  // inserted between, the only thing about it that is actually known.
  const placed: { anchor: OpeningAnchor; position: number; ordinal: number }[] = [];
  let lastMatchedIndex = -1;
  let unmatchedSinceMatch = 0;
  current.forEach((survivor, survivorIndex) => {
    const preStopIndex = matchedTo[survivorIndex];
    if (preStopIndex !== undefined) {
      lastMatchedIndex = preStopIndex;
      unmatchedSinceMatch = 0;
      placed.push({
        anchor: survivor,
        position: preStopIndex,
        ordinal: memory.preStop[preStopIndex]!.beforeStandardCount,
      });
      return;
    }
    unmatchedSinceMatch++;
    placed.push({
      anchor: survivor,
      // Strictly between `lastMatchedIndex` and the next integer position, so
      // it can never sort past a matched survivor either way.
      position: lastMatchedIndex + unmatchedSinceMatch / (current.length + 1),
      ordinal: survivor.beforeStandardCount,
    });
  });
  let unbuiltIndex = 0;
  memory.preStop.forEach((position, preStopIndex) => {
    if (!position.withheld) return;
    const anchor = memory.unbuilt[unbuiltIndex++]!;
    placed.push({ anchor, position: preStopIndex, ordinal: anchor.beforeStandardCount });
  });
  placed.sort((a, b) => a.position - b.position);
  return clampMonotonic(placed);
}

/**
 * Per survivor, the index in `preStop` of the kept entry it came from, or
 * `undefined` for one with no match — an opening inserted while the wall was
 * stopped.
 *
 * A longest-in-order match (the classic LCS walk), not a greedy two-pointer:
 * greedy has to guess, on a mismatch, whether an opening was deleted or one was
 * inserted, and guessing wrong mis-matches everything after it. The lists here
 * are one wall's openings — single digits — so the quadratic table is free.
 */
function matchSurvivorsByPayload(
  keptEntries: { position: PreStopOpeningPosition; preStopIndex: number }[],
  survivors: readonly OpeningAnchor[],
): (number | undefined)[] {
  const keptCount = keptEntries.length;
  const survivorCount = survivors.length;
  const matches = (keptIndex: number, survivorIndex: number): boolean => {
    const payload = keptEntries[keptIndex]!.position.payload;
    return payload !== undefined && samePayload(payload, payloadOf(survivors[survivorIndex]!));
  };
  // best[i][j] — the most pairs still matchable from keptEntries[i..] and
  // survivors[j..].
  const best: number[][] = Array.from({ length: keptCount + 1 }, () => new Array<number>(survivorCount + 1).fill(0));
  for (let i = keptCount - 1; i >= 0; i--) {
    for (let j = survivorCount - 1; j >= 0; j--) {
      best[i]![j] = matches(i, j) ? best[i + 1]![j + 1]! + 1 : Math.max(best[i + 1]![j]!, best[i]![j + 1]!);
    }
  }
  const matchedTo = new Array<number | undefined>(survivorCount).fill(undefined);
  let i = 0;
  let j = 0;
  while (i < keptCount && j < survivorCount) {
    if (matches(i, j)) {
      matchedTo[j] = keptEntries[i]!.preStopIndex;
      i++;
      j++;
    } else if (best[i + 1]![j]! >= best[i]![j + 1]!) i++;
    else j++;
  }
  return matchedTo;
}

/** The pre-payload fallback: splice each remembered opening back after the
 * number of survivors that preceded it, from the right so an earlier recorded
 * position is not shifted by a later insertion. Reachable only from a memory
 * whose kept entries carry no payload — see `mergeRunStopOpenings`. */
function mergeByRecordedPosition(current: OpeningAnchor[], memory: RunStopOpeningMemory): OpeningAnchor[] {
  const spliced = [...current];
  const afterKept = afterKeptCounts(memory.preStop);
  for (let i = memory.unbuilt.length - 1; i >= 0; i--) {
    spliced.splice(Math.min(afterKept[i]!, spliced.length), 0, memory.unbuilt[i]!);
  }
  return clampMonotonic(spliced.map((anchor) => ({ anchor, ordinal: anchor.beforeStandardCount })));
}

/** Ordinals non-decreasing, so `retileWithOpenings`' own stable sort cannot
 * reorder the list this module just decided the order of. */
function clampMonotonic(placed: { anchor: OpeningAnchor; ordinal: number }[]): OpeningAnchor[] {
  let previous = Number.NEGATIVE_INFINITY;
  return placed.map(({ anchor, ordinal: recorded }) => {
    const ordinal = Math.max(recorded, previous);
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

/** How faithfully a wall's withheld openings can be put back — see
 * `runStopRestoreFidelity`. */
export type RunStopRestoreFidelity = "nothing-withheld" | "exact" | "approximate";

/**
 * Whether restoring this wall's withheld openings puts them back where they
 * were, or only approximately — the honest answer the user-facing wording has
 * to be conditioned on.
 *
 * - `"nothing-withheld"` — no memory, or nothing in it. Nothing to restore.
 * - `"exact"` — the wall's surviving openings still ARE the ones `preStop`
 *   recorded as kept, payload for payload and in the same order, so
 *   `mergeRunStopOpenings` takes its exact path and the merged list is the
 *   pre-stop list. Two openings with identical payloads are indistinguishable
 *   here, which is why this is still honest: restoring them in either order
 *   produces the same drawing.
 * - `"approximate"` — openings were inserted, deleted or edited on this wall
 *   while it was stopped. Nothing is lost, but a remembered opening can come
 *   back beside a different panel, and in the count-unchanged case on the wrong
 *   side of a survivor. See the module doc comment's two measured shapes.
 *
 * ⚠ An EDIT to a survivor's width or height also reports `"approximate"`, and
 * that restore is in fact exact. Deliberate, and the reason the wording this
 * gates says "may": promising exactness and failing to deliver it is the defect
 * this function exists to stop, and a caution the user did not strictly need is
 * the cheap side of that trade.
 *
 * ⚠ It answers `"exact"` for a memory with no kept entries and no survivors —
 * a fully stopped wall — and that is right **only because
 * `RunStopOpeningMemory`'s correspondence invariant holds**, which makes the
 * merge hand every remembered opening back at its own recorded ordinal. On a
 * memory that breaks the invariant the same `every` is vacuously true over an
 * empty list and this would promise exactness for openings the merge is about to
 * drop. That is not a shape the app can reach — see `openingMemoryStory` in
 * `projectFile.ts` — and it is named here because it is the one way this
 * predicate can lie.
 */
export function runStopRestoreFidelity(
  memory: RunStopOpeningMemory | undefined,
  currentOpenings: readonly OpeningAnchor[],
): RunStopRestoreFidelity {
  if (!memory || memory.unbuilt.length === 0) return "nothing-withheld";
  const kept = memory.preStop.filter((position) => !position.withheld);
  if (kept.length !== currentOpenings.length) return "approximate";
  const corresponds = kept.every((position, index) => {
    const payload = position.payload;
    return payload !== undefined && samePayload(payload, payloadOf(currentOpenings[index]!));
  });
  return corresponds ? "exact" : "approximate";
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
