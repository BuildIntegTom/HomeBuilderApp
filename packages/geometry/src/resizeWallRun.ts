import type { PanelSlot } from "./types";

/**
 * TILE-ONCE STAGE 4 — a wall gets longer or shorter, and its panels are
 * MANIPULATED rather than re-derived.
 *
 * Tommy's spec, 2026-09-30, and this is the whole behaviour:
 *
 * > *"when a user drags the east side of a square building making it bigger,
 * > it auto populates standard panels that enter and grow with the drag. When
 * > that side is dragged back, each of those latest panels shrinks and
 * > disappears. This will make some tiny panels as the drag is marked, and I
 * > think this is okay because there should be a drag tool on the elevation
 * > editor that allows one to drag the side of a panel and shrink/grow the one
 * > next to it."*
 *
 * And for an opening caught in the part a shrink removes, 2026-10-02:
 *
 * > *"It shortens the width of the RO, header, and sill and those shrink with
 * > the drag. This happens until it's less than 1' in which case the RO,
 * > header, and sill all 3 get replaced by 1 standard panel. That continues
 * > down to zero (even though that would make an 'impossible' panel - that's
 * > okay as long as the elevation edit tools can allow the user to fix it)."*
 *
 * ⚠ **CONSERVING BY CONSTRUCTION, like the swap and the boundary drag.** This
 * function works in whole EIGHTHS and moves a budget: it never computes a
 * width from a length and then hopes the sum lands. Every eighth it takes off
 * one slot it has already counted, and it stops when the budget is spent, so
 * `Σ(widthIn)` is `old total + delta` exactly — there is no residual to settle
 * and nothing for an invariant to catch. That is the property the tile-once
 * model is built on (see the spec's "The property that makes it work").
 */

/** The 1/8in grid the whole app is held to. Integer eighths in, integer
 * eighths out — no float width is ever produced here. */
const toEighths = (inches: number): number => Math.round(inches * 8);
const toInches = (eighths: number): number => eighths / 8;

/**
 * Below this, an opening caught in a shrink stops being an opening.
 *
 * Tommy's "less than 1'". The RO, its header and its sill are one slot in this
 * model (the header and sill are that slot's own zones), so "all 3 get
 * replaced by 1 standard panel" is a type change on one slot rather than a
 * three-way splice.
 */
export const OPENING_COLLAPSE_BELOW_IN = 12;

/**
 * Parts placed by rule rather than by the user, which a length change must not
 * consume — spec: *"Two parts remain rule-placed and therefore keep moving by
 * themselves: the corner panels and the safety gap."*
 *
 * ⚠ A corner panel's width IS its geometry (it wraps the corner), and the
 * safety gap is a fixed 3/4in detail. Letting either absorb a drag would make
 * the drag silently change a part whose size is not the user's to choose.
 */
function isRulePlaced(slot: PanelSlot): boolean {
  return slot.type === "corner" || slot.type === "safety-gap";
}

/** Whether this slot is an opening, for the collapse rule. */
function isOpening(slot: PanelSlot): boolean {
  return slot.type === "window" || slot.type === "door";
}

export interface ResizeWallRunResult {
  slots: PanelSlot[];
  /** How many openings the shrink collapsed into standard panels. The caller
   * reports these; they are a real change to what gets fabricated and must
   * not happen silently. */
  collapsedOpenings: number;
  /**
   * What a shrink actually took off, INNERMOST FIRST — the piece nearest the
   * surviving wall comes first.
   *
   * ⚠ Reported rather than reconstructed, and that is a correctness point, not
   * a convenience. The first version recovered this by diffing the before and
   * after arrays, which is AMBIGUOUS: `[40, 13⅜, 50⅝] → [40]` reads equally
   * well as "50⅝ and 13⅜ removed" or as "50⅝ shrank to 40, and 13⅜ and 40 were
   * removed". The diff picked the second and a restore then merged two panels
   * into an 80in one. This function knows which it did, so it says so.
   */
  removed: PanelSlot[];
  /** Whether `removed[0]` is the TAIL of a panel still in the wall rather than
   * a whole panel — i.e. the shrink stopped part-way through one. */
  removedInnermostIsPartial: boolean;
  /**
   * Eighths the wall could NOT give up, because everything that was allowed
   * to shrink had already reached zero.
   *
   * ⚠ Non-zero means the request was impossible, not that it was rounded: the
   * caller must refuse rather than show a wall whose panels no longer sum to
   * its length. Tommy's standing rule is that wall lengths are exact.
   */
  shortfallEighths: number;
}

/**
 * Grow or shrink a wall's panel run at ONE end.
 *
 * @param deltaIn  Positive grows, negative shrinks. Snapped to eighths.
 * @param growAtEnd Which end the drag is pulling. `"end"` is the high-index
 *   end of the array. Panels enter, grow, shrink and disappear HERE and
 *   nowhere else — which is what makes a length change feel like the wall
 *   being pulled rather than the whole run reflowing.
 * @param standardWidthIn The width a growing panel stops at before the next
 *   one enters behind it.
 */
export function resizeWallRun(
  slots: readonly PanelSlot[],
  deltaIn: number,
  growAtEnd: "start" | "end",
  standardWidthIn: number,
): ResizeWallRunResult {
  const budget = toEighths(deltaIn);
  if (budget === 0) {
    return { slots: slots.map((s) => s), collapsedOpenings: 0, shortfallEighths: 0, removed: [], removedInnermostIsPartial: false };
  }

  const working = slots.map((s) => ({ ...s }));
  const standardEighths = toEighths(standardWidthIn);
  let collapsedOpenings = 0;

  /* The index of the slot nearest the dragged end that may absorb width, and
     the direction to step inward from it. Rule-placed parts at the very end
     (a corner panel, and a safety gap tucked behind it) are stepped OVER, not
     through: growth happens just inside them, so a corner stays a corner and
     the gap stays where the rule put it. */
  const atEnd = growAtEnd === "end";
  const step = atEnd ? -1 : 1;

  /**
   * Walk inward from the dragged end to the first slot that may change.
   *
   * ⚠ The starting index is recomputed on EVERY call, not captured once. The
   * shrink loop splices panels out as they reach zero, so a start index taken
   * before the first removal points past the end of a shortened array — the
   * loop's own bounds check then fails immediately, `findAbsorber` returns -1
   * and the shrink stops early. Caught by three tests at once: a 55in shrink
   * took only 40, an impossible shrink reported no shortfall, and a grow/shrink
   * round trip left the panel it had just added.
   */
  const findAbsorber = (): number => {
    for (let i = atEnd ? working.length - 1 : 0; i >= 0 && i < working.length; i += step) {
      if (!isRulePlaced(working[i]!)) return i;
    }
    return -1;
  };

  if (budget > 0) {
    let remaining = budget;
    let at = findAbsorber();
    if (at < 0) {
      /* Nothing but rule-placed parts — a wall of just corners and a gap.
         Put the whole growth in one new standard panel just inside the end,
         because refusing would leave the wall shorter than its own length. */
      const insertAt = atEnd ? working.length - 1 : 1;
      working.splice(Math.max(0, Math.min(working.length, insertAt)), 0, {
        type: "standard",
        widthIn: toInches(remaining),
      });
      return { slots: working, collapsedOpenings, shortfallEighths: 0, removed: [], removedInnermostIsPartial: false };
    }

    /* ⚠ Only the END-MOST panel grows, and only to `standardWidthIn`; past
       that a NEW panel enters behind it. That is Tommy's "panels that enter
       and grow with the drag" read literally, and it is also what makes the
       reverse exact: shrinking pops those same panels off in the order they
       arrived. Spreading the growth over several existing panels instead
       would be impossible to undo by dragging back. */
    const headroom = Math.max(0, standardEighths - toEighths(working[at]!.widthIn));
    const intoExisting = Math.min(remaining, headroom);
    if (intoExisting > 0) {
      working[at] = { ...working[at]!, widthIn: toInches(toEighths(working[at]!.widthIn) + intoExisting) };
      remaining -= intoExisting;
    }
    while (remaining > 0) {
      const take = Math.min(remaining, standardEighths);
      // Inserted on the dragged side of the absorber, so the newest panel is
      // always the one nearest the end — the one a drag back removes first.
      const insertAt = atEnd ? at + 1 : at;
      working.splice(insertAt, 0, { type: "standard", widthIn: toInches(take) });
      if (!atEnd) at += 1;
      if (atEnd) at += 1;
      remaining -= take;
    }
    return { slots: working, collapsedOpenings, shortfallEighths: 0, removed: [], removedInnermostIsPartial: false };
  }

  // ---- shrink ------------------------------------------------------------
  let remaining = -budget;
  /* Collected in REMOVAL order (outermost first, since the shrink eats inward)
     and reversed at the end, because a stopped span is held innermost-first. */
  const removedOuterFirst: PanelSlot[] = [];
  let removedInnermostIsPartial = false;
  while (remaining > 0) {
    const at = findAbsorber();
    if (at < 0) break; // nothing left that may shrink
    const slot = working[at]!;
    const have = toEighths(slot.widthIn);
    if (have <= 0) {
      // A zero-width slot left from an earlier step: drop it and continue.
      working.splice(at, 1);
      continue;
    }
    const take = Math.min(remaining, have);
    const nextEighths = have - take;
    remaining -= take;

    if (nextEighths === 0) {
      removedOuterFirst.push({ ...slot });
      removedInnermostIsPartial = false;
      working.splice(at, 1);
      continue;
    }
    /* The shrink stopped part-way through this panel: what came off is a TAIL
       of a panel that is still there, which the restore must give back to it
       rather than re-inserting beside it. */
    removedOuterFirst.push({ ...slot, widthIn: toInches(take) });
    removedInnermostIsPartial = true;

    /* ⚠ The opening collapse, and it happens ON THE WAY DOWN rather than at
       the end: an opening narrower than a foot is not a window any more, it
       is a gap in the framing. Tommy: *"the RO, header, and sill all 3 get
       replaced by 1 standard panel. That continues down to zero."* So the
       slot becomes a plain standard and keeps shrinking on the next pass. */
    if (isOpening(slot) && nextEighths < toEighths(OPENING_COLLAPSE_BELOW_IN)) {
      collapsedOpenings += 1;
      working[at] = { type: "standard", widthIn: toInches(nextEighths), ...(slot.zones ? { zones: slot.zones } : {}) };
      // Zones describe the opening's own header/sill bands; a standard panel
      // has no business carrying them.
      delete (working[at] as { zones?: unknown }).zones;
      continue;
    }

    working[at] = { ...slot, widthIn: toInches(nextEighths) };
  }

  return {
    slots: working,
    collapsedOpenings,
    shortfallEighths: remaining,
    removed: removedOuterFirst.reverse(),
    removedInnermostIsPartial,
  };
}

/**
 * Which end of a wall the panels should enter at, worked out from which
 * CORNER ACTUALLY MOVED between two footprints.
 *
 * ⚠ **Derived, not hard-coded per shape, and that is the point.** Editing one
 * wall's length moves several walls: on a rectangle, typing a new width
 * changes AB and CD, and the growth belongs at opposite ends of their two
 * arrays because the walls run in opposite directions around the ring. A table
 * of "for wall AB grow at the end" would be four entries for a rectangle,
 * eight for an octagon, and wrong the first time a bump-out renumbered
 * anything. The corner that moved is the same fact in every shape.
 *
 * Tommy's framing is exactly this: *"when a user drags the east side of a
 * square building making it bigger, it auto populates standard panels"* — the
 * panels appear where the hand is, which is the end that moved.
 *
 * Returns `null` when neither end moved.
 *
 * ⚠ **`null` does NOT mean this wall's run is unchanged, and an earlier
 * version of this comment said it did.** A wall can keep both its own
 * corner points and still change length, because its RUN is its nominal
 * length less whatever a neighbour's corner panel occupies at each end —
 * and that ownership is decided by comparative wall length. Measured:
 * widening a 30x30 to 40x30 moves only B and C, so DA returns `null` here,
 * while DA's run goes from 344.5in to 329in because AB now builds the
 * corner at A. Treating `null` as "leave the panels alone" left DA's
 * panels summing 15.5in longer than the wall they sit in — a dimensional
 * tightness violation, not merely a composition one. Callers must fall
 * back to `runChangeEndFromInsets` rather than skipping the wall.
 */
export function wallGrowthEnd(
  oldCornerById: ReadonlyMap<string, { x: number; y: number }>,
  newCornerById: ReadonlyMap<string, { x: number; y: number }>,
  wall: { startCorner: string; endCorner: string },
): "start" | "end" | null {
  const moved = (id: string): number => {
    const a = oldCornerById.get(id);
    const b = newCornerById.get(id);
    if (!a || !b) return 0;
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  const startMoved = moved(wall.startCorner);
  const endMoved = moved(wall.endCorner);
  // Below an eighth of an inch in feet — below the grid, so not a move.
  const EPS = 1 / 8 / 12 / 2;
  if (startMoved < EPS && endMoved < EPS) return null;
  /* ⚠ When BOTH ends moved — a wall carried bodily sideways, as the far wall
     of a rectangle is when you widen it — the growth goes to the end that
     moved FURTHER. On a pure translation the two are equal and this picks
     `end` arbitrarily, which is harmless precisely because a translation does
     not change the wall's length: `resizeWallRun` is then called with a delta
     of zero and returns the array untouched. */
  return endMoved >= startMoved ? "end" : "start";
}

/**
 * The slots a run stop has taken out of a wall, kept so that reducing the stop
 * puts them back exactly as they were.
 *
 * Keyed by the END the stop is at, because a wall can be stopped at both ends
 * independently and the two spans must not mix.
 */
export interface StoppedSpan {
  /** Innermost first — `slots[0]` is the piece nearest the built wall, at
   * BOTH ends. One ordering means one restore loop. */
  slots: PanelSlot[];
  /**
   * ⚠ The innermost held piece is the TAIL OF A PANEL STILL IN THE WALL, not
   * a panel of its own.
   *
   * A stop lands wherever the user puts it, which is usually part-way through
   * a panel: a 1in stop shaves 1in off a 40in panel and leaves 39in built.
   * Without this flag the restore puts that 1in back as a SEPARATE panel, so a
   * 40in panel returns as `1 | 39` — caught by three tests at once, including
   * the stop-out-and-back identity. With it, the restore widens the panel the
   * tail came from.
   */
  innermostIsPartial?: boolean;
}

export interface StoppedSlots {
  start?: StoppedSpan;
  end?: StoppedSpan;
}

export interface ApplyStopResult {
  slots: PanelSlot[];
  /** What is now set aside for this wall. Replaces the caller's previous
   * record for it wholesale. */
  stopped: StoppedSlots;
  collapsedOpenings: number;
  shortfallEighths: number;
}

/**
 * Apply a change in a wall's BUILT run length caused by a run stop, setting
 * aside what the stop removes and restoring it when the stop is reduced.
 *
 * ⚠ **Why this exists rather than just calling `resizeWallRun`.** A stop is a
 * length change, so the resize does the arithmetic — but the stop path is the
 * only thing in the app that is expected to be REVERSIBLE in content as well
 * as in size. Tommy's run stop withholds what is inside the stopped span and
 * gives it back when the stop is reduced; before tile-once that was
 * `RunStopOpeningMemory`, which remembered OPENINGS by anchor and re-derived
 * their positions on the next re-tile. Under tile-once the panel array is the
 * document, so the honest memory is the slots themselves — which also restores
 * hand-set widths, braced patterns and types that the anchor memory never
 * could.
 *
 * ⚠ **Restoration comes BEFORE growth.** Reducing a stop by more than was
 * taken puts every remembered slot back first and only then lets fresh
 * standard panels enter, so a stop dragged out and back is an identity. If
 * growth ran first the remembered panels would land in the wrong order and the
 * round trip would silently rebuild a different wall.
 */
export function applyRunStopChange(
  slots: readonly PanelSlot[],
  deltaIn: number,
  stopEnd: "start" | "end",
  standardWidthIn: number,
  stopped: StoppedSlots,
): ApplyStopResult {
  const budget = toEighths(deltaIn);
  const held = stopped[stopEnd] ?? { slots: [] };

  if (budget === 0) {
    return { slots: slots.map((s) => s), stopped, collapsedOpenings: 0, shortfallEighths: 0 };
  }

  if (budget < 0) {
    // The stop GREW: take width off that end and keep exactly what left.
    const before = slots.map((s) => ({ ...s }));
    const out = resizeWallRun(before, deltaIn, stopEnd, standardWidthIn);
    const removed = out.removed;
    const innermostIsPartial = out.removedInnermostIsPartial;
    return {
      slots: out.slots,
      /* Newly removed pieces go INSIDE anything already held — they sat between
         the built wall and the previously stopped span. Both lists are
         innermost-first, so the new ones go in front. */
      stopped: {
        ...stopped,
        [stopEnd]: {
          slots: [...removed, ...held.slots],
          /* Only the innermost piece can be a partial, and after merging that is
             whichever one this pass just shaved — unless this pass removed
             nothing new, in which case the previous flag still stands. */
          innermostIsPartial: removed.length > 0 ? innermostIsPartial : held.innermostIsPartial,
        },
      },
      collapsedOpenings: out.collapsedOpenings,
      shortfallEighths: out.shortfallEighths,
    };
  }

  // The stop SHRANK: give back what is held, innermost first, then grow.
  let remaining = budget;
  const working = slots.map((s) => ({ ...s }));
  const stillHeld = held.slots.map((s) => ({ ...s }));
  let partialPending = held.innermostIsPartial === true;
  while (remaining > 0 && stillHeld.length > 0) {
    // Innermost first, at either end — see `StoppedSpan.slots`.
    const next = stillHeld.shift()!;
    const want = toEighths(next.widthIn);

    if (partialPending) {
      /* This piece is the tail of a panel still in the wall, so the width goes
         BACK ON that panel rather than becoming a new one. */
      const give = Math.min(remaining, want);
      const edge = edgeIndexInside(working, stopEnd);
      if (edge >= 0) {
        working[edge] = { ...working[edge]!, widthIn: toInches(toEighths(working[edge]!.widthIn) + give) };
      } else {
        insertInsideEnd(working, { ...next, widthIn: toInches(give) }, stopEnd);
      }
      remaining -= give;
      if (give < want) {
        stillHeld.unshift({ ...next, widthIn: toInches(want - give) });
        break;
      }
      partialPending = false;
      continue;
    }

    if (want > remaining) {
      /* ⚠ Only part of this panel fits back, so it is SPLIT and the rest stays
         held — flagged partial, so putting the remainder back later widens this
         same panel instead of adding another one beside it. */
      insertInsideEnd(working, { ...next, widthIn: toInches(remaining) }, stopEnd);
      stillHeld.unshift({ ...next, widthIn: toInches(want - remaining) });
      partialPending = true;
      remaining = 0;
      break;
    }
    insertInsideEnd(working, next, stopEnd);
    remaining -= want;
  }

  const nextStopped: StoppedSlots = { ...stopped };
  if (stillHeld.length > 0) nextStopped[stopEnd] = { slots: stillHeld, innermostIsPartial: partialPending };
  else delete nextStopped[stopEnd];

  if (remaining === 0) {
    return { slots: working, stopped: nextStopped, collapsedOpenings: 0, shortfallEighths: 0 };
  }
  // Nothing left to restore — the rest is genuinely new wall.
  const grown = resizeWallRun(working, toInches(remaining), stopEnd, standardWidthIn);
  return {
    slots: grown.slots,
    stopped: nextStopped,
    collapsedOpenings: grown.collapsedOpenings,
    shortfallEighths: grown.shortfallEighths,
  };
}

/** Put a restored slot back just inside the rule-placed parts at one end —
 * the same position `resizeWallRun` grows into, so restoring and growing
 * cannot disagree about where the edge of the run is. */
function insertInsideEnd(working: PanelSlot[], slot: PanelSlot, end: "start" | "end"): void {
  if (end === "end") {
    let i = working.length;
    while (i > 0 && isRulePlaced(working[i - 1]!)) i--;
    working.splice(i, 0, slot);
  } else {
    let i = 0;
    while (i < working.length && isRulePlaced(working[i]!)) i++;
    working.splice(i, 0, slot);
  }
}

/** The outermost slot at one end that is not rule-placed — the panel a stop
 * shaves into, and the one a partial restore widens again. */
function edgeIndexInside(working: PanelSlot[], end: "start" | "end"): number {
  if (end === "end") {
    for (let i = working.length - 1; i >= 0; i--) if (!isRulePlaced(working[i]!)) return i;
    return -1;
  }
  for (let i = 0; i < working.length; i++) if (!isRulePlaced(working[i]!)) return i;
  return -1;
}

/**
 * How many OPENINGS a run stop is currently holding out of a wall.
 *
 * ⚠ **This exists because Stage 4d orphaned the Review Log.** The withheld-
 * openings entry used to count `RunStopOpeningMemory.unbuilt`, which the
 * re-tile produced. Run stops no longer re-tile, so that memory stopped being
 * written — and `runStopRestoreFidelity` answers `"nothing-withheld"` for an
 * absent memory, so the Review Log quietly reported ZERO withheld openings on
 * a wall whose stop had swallowed a window. Safety-relevant output that
 * under-reports is the exact failure flags-check point 5 exists for.
 */
export function withheldOpeningCount(stopped: StoppedSlots | undefined): number {
  if (!stopped) return 0;
  const count = (span?: StoppedSpan) => {
    if (!span) return 0;
    /* ⚠ A PARTIAL innermost piece is the tail of an opening that is STILL IN
       THE WALL, just narrower — it has not been withheld, and counting it
       reports a window the user can still see. Caught by a test that stopped
       one wall from both ends and got 3 openings out of 2: the door was
       counted once as a tail here and once, correctly, as a whole opening in
       the other end's span. */
    const slots = span.innermostIsPartial ? span.slots.slice(1) : span.slots;
    return slots.filter((s) => s.type === "window" || s.type === "door").length;
  };
  return count(stopped.start) + count(stopped.end);
}

/**
 * Whether the openings a stop is holding would come back exactly as drawn.
 *
 * ⚠ **Always `"exact"` when anything is held, and that is a real improvement
 * rather than a shortcut.** The old anchor memory remembered openings by
 * ordinal and re-derived their positions on the next re-tile, so it genuinely
 * could not promise exactness — `runStopRestoreFidelity` existed to answer
 * "can we?" and often said no. A stopped span holds the PANELS themselves, so
 * reducing the stop puts back the same window at the same width with the same
 * sill, along with the hand-set widths and braced patterns around it. There is
 * no approximation left to warn about.
 */
export function stoppedSlotsRestoreFidelity(
  stopped: StoppedSlots | undefined,
): "nothing-withheld" | "exact" {
  return withheldOpeningCount(stopped) === 0 ? "nothing-withheld" : "exact";
}

/**
 * The end to resize at when NO corner of this wall moved but its run
 * changed anyway — the companion to `wallGrowthEnd`'s `null`.
 *
 * The only thing that can change a run without moving a corner point is an
 * INSET change at one end or the other: a neighbour started or stopped
 * building the corner panel there. So the end that changed is the end whose
 * inset moved, which is where the panels should enter or leave.
 *
 * Returns `null` when neither inset moved, which genuinely does mean the run
 * is the same length — though a rule-placed part can still have changed
 * side, so a caller must not read `null` as "nothing to do".
 */
export function runChangeEndFromInsets(
  startInsetDeltaIn: number,
  endInsetDeltaIn: number,
): "start" | "end" | null {
  const startE = Math.round(startInsetDeltaIn * 8);
  const endE = Math.round(endInsetDeltaIn * 8);
  if (startE === 0 && endE === 0) return null;
  /* Both ends can change at once — a wall can lose the corner at one end
     and gain the neighbour's at the other. The larger movement is the one
     that decides, and a tie goes to the start so the answer is at least
     deterministic rather than depending on argument order. */
  return Math.abs(startE) >= Math.abs(endE) ? "start" : "end";
}

export interface RulePlacedState {
  /** Does this wall BUILD a corner panel at its start end? */
  hasCornerStart: boolean;
  hasCornerEnd: boolean;
  /** Which end the safety gap belongs at. */
  gapEnd: "start" | "end";
}

export interface RulePlacedResult {
  slots: PanelSlot[];
  /** Width still to be absorbed by the wall's ordinary panels after the
   * rule-placed parts have taken their share of the length change. */
  remainingDeltaIn: number;
  cornerMoved: boolean;
  gapMoved: boolean;
}

/**
 * Move the parts that are placed BY RULE when the rule itself has changed.
 *
 * ⚠ **This is the half of a length change Stage 4 forgot, and it produced
 * physically wrong buildings.** Corner ownership is decided by *"the longer
 * wall runs through"*, so it reads `wall.lengthFt` — widening 30ft x 30ft to
 * 40ft x 30ft takes AB from one corner panel to two and BC from one to zero.
 * `resizeWallRun` moves STANDARD panels only, so neither moved: the model
 * ended up with two corner panels at one corner and BC's framing 25.5in short
 * of its own run. ⚠ The wall TOTALS stayed correct the whole time, because the
 * delta is measured from `wallGeometryFor(...).lengthIn` which already
 * accounts for the inset — the sum was right and the composition was wrong,
 * which is why no invariant caught it.
 *
 * The safety gap has the same shape of problem: `computeGapEnd` picks its end
 * by distance from the least-accessible corner, and changing lengths moves
 * corners.
 *
 * ⚠ **This is not a retreat to re-tiling.** The model's own rule 4 says the
 * corner panels and the safety gap *"remain rule-placed and therefore keep
 * moving by themselves"*. Nothing the user chose is re-derived here — only the
 * two parts that were never theirs.
 *
 * Returns the delta still owed to the ordinary panels: a corner panel this
 * wall has GAINED consumes its own width out of the length change, because the
 * run grew by exactly the corner it now builds.
 */
export function applyRulePlacedParts(
  slots: readonly PanelSlot[],
  before: RulePlacedState,
  after: RulePlacedState,
  deltaIn: number,
  cornerWidthIn: number,
): RulePlacedResult {
  const working = slots.map((s) => ({ ...s }));
  let remaining = toEighths(deltaIn);
  let cornerMoved = false;

  const leadingCornerIndex = working.findIndex((s) => s.type === "corner");
  const hasLeadingCorner = leadingCornerIndex === 0;
  const trailingCornerIndex = working.length - 1;
  const hasTrailingCorner = working[trailingCornerIndex]?.type === "corner";

  // ---- the END corner --------------------------------------------------
  if (after.hasCornerEnd && !before.hasCornerEnd) {
    working.push({ type: "corner", widthIn: cornerWidthIn });
    remaining -= toEighths(cornerWidthIn);
    cornerMoved = true;
  } else if (!after.hasCornerEnd && before.hasCornerEnd && hasTrailingCorner) {
    // Its OWN width back, not the nominal one — a corner panel may have been
    // widened by the tiler's own cornerMayWiden rule.
    remaining += toEighths(working[trailingCornerIndex]!.widthIn);
    working.splice(trailingCornerIndex, 1);
    cornerMoved = true;
  }

  // ---- the START corner ------------------------------------------------
  if (after.hasCornerStart && !before.hasCornerStart) {
    working.unshift({ type: "corner", widthIn: cornerWidthIn });
    remaining -= toEighths(cornerWidthIn);
    cornerMoved = true;
  } else if (!after.hasCornerStart && before.hasCornerStart && hasLeadingCorner) {
    remaining += toEighths(working[0]!.widthIn);
    working.splice(0, 1);
    cornerMoved = true;
  }

  // ---- the safety gap --------------------------------------------------
  let gapMoved = false;
  if (after.gapEnd !== before.gapEnd) {
    const gapIndex = working.findIndex((s) => s.type === "safety-gap");
    if (gapIndex >= 0) {
      const [gap] = working.splice(gapIndex, 1);
      /* Re-inserted just INSIDE the corner at the other end — the position the
         tiler puts it in — so moving it never displaces a corner panel. Its
         width is unchanged, so this costs the delta nothing. */
      if (after.gapEnd === "end") {
        let i = working.length;
        while (i > 0 && working[i - 1]!.type === "corner") i--;
        working.splice(i, 0, gap!);
      } else {
        let i = 0;
        while (i < working.length && working[i]!.type === "corner") i++;
        working.splice(i, 0, gap!);
      }
      gapMoved = true;
    }
  }

  return { slots: working, remainingDeltaIn: toInches(remaining), cornerMoved, gapMoved };
}
