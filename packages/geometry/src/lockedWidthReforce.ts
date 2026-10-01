import { fromEighths, toEighths } from "./eighths";
import type { PanelWidthLimitsIn } from "./panelWidthEdit";
import { settleResidualEighths } from "./settleResidualEighths";
import { TILER_MAX_PANEL_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN } from "./tiling";
import type { PanelSlot } from "./types";

/**
 * Re-forcing a hand-set (`lockedWidthIn`) panel width after a re-tile — and
 * **refusing that re-force outright when the wall's own length cannot pay for
 * it.**
 *
 * ### The defect this replaces, measured rather than quoted
 *
 * `reconcileBracedPlacement` has always re-forced every carried-through
 * `lockedWidthIn` back to its exact value and handed the difference to a
 * neighbour via a helper called `shedWidthToNearestUnlocked`, which (a) was a
 * **no-op when the run had no unlocked standard-family slot at all**, leaving
 * the wall off by the whole delta, and (b) **clamped the neighbour at zero** —
 * the same mistake `planCornerBraceCombine` was fixed for one day earlier.
 *
 * **Re-measured here on 2026-09-30 before any code was written**, on the
 * fixture the spec names: every eighth of wall length from 150in to 400in,
 * standard widths {40, 48}, two corners, one 61.5in window against the corner,
 * and a lock of 24in or 48in on the first standard-family slot, skipping the
 * walls the tiler itself does not sum (its own opening overflow, a separate
 * open item). **8,004 cases, 362 of them came out off their own length, from
 * 23⅞in SHORT to 11¼in long, and 2 carried a 0in panel.** The worst is a
 * 161⅛in wall with a 24in lock reconciling to 137¼in — two feet of wall that
 * is not there. The named case reproduces exactly: a 150in two-corner wall,
 * lock 48in → 161¼in, lock 24in → 137¼in. Those are this file's own numbers,
 * from the sweep in `lockedWidthReforce.test.ts`, not carried over from the
 * report.
 *
 * On that 150in wall the whole run is
 * `corner 25.5 | window 61.5 | gap 0.75 | standard 36.75 | corner 25.5`:
 * **one** standard-family slot, and it is the locked one. There is nothing to
 * shed to, so the old helper did nothing at all and the forced width simply
 * made the wall longer (or shorter) than itself.
 *
 * ### What it does instead — Tommy's decision, 2026-09-29
 *
 * > *a locked/dragged width the wall length cannot honour is* **refused
 * > outright** *— nothing changes, and the message names what is in the way
 * > and the widest legal value. The wall's real length is never violated.*
 *
 * So, per locked slot: either the re-force is paid for **exactly** by the
 * unlocked standard/braced slots on the run, every one of them left inside
 * `[TILER_MIN_PANEL_WIDTH_IN, TILER_MAX_PANEL_WIDTH_IN]` — or it does not
 * happen at all and the slot keeps the width the tiler gave it. There is no
 * partial application and no clamp. The payment goes through
 * `settleResidualEighths`, the same helper `planCornerBraceCombine` pays
 * itself with, so the two refusals share one discipline rather than having two.
 *
 * ### Three things it deliberately does NOT do
 *
 * 1. **It never clears `lockedWidthIn`.** A refused lock is dormant, not
 *    destroyed: the slot shows the tiler's width now and the hand-set width
 *    comes back by itself the moment the wall can afford it again (lengthen the
 *    wall, delete the opening, reset another pin). Clearing it would be a
 *    silent deletion of a hand edit, which is the one thing every other part of
 *    this feature is built not to do — `handleResetPanelWidth` exists so that
 *    releasing a pin is always something a user asked for.
 *    ⚠ **This is in tension with one line of the Stage 1 DESIGN note**, which
 *    said unfittable pins "are **released** — their `lockedWidthIn` is
 *    cleared". That line predates Tommy's 2026-09-29 decision, whose words are
 *    "nothing changes"; retaining is what "nothing changes" means. Recorded in
 *    the spec as his call if he wants the other one.
 * 2. **It never swallows a panel.** `planCornerBraceCombine` may remove a
 *    panel from the run, because a combined slot physically IS one panel where
 *    two stood. A hand-set width is not: a wall that quietly lost a panel
 *    because of a width pin would be a second silent change made in the name of
 *    preventing one. If the existing panels cannot pay, it refuses.
 * 3. **It never policies the locked value itself.** A stored file carrying a
 *    20in or a 60in pin is honoured if the run can pay for it, exactly as
 *    before — limits bind at the point of EDIT, never at load (see
 *    `panelWidthEdit.ts`). What is policed is the width of every OTHER panel,
 *    which is the wall's own arithmetic.
 *
 * ### Which gesture is refused, and which is not
 *
 * **Not the user's current gesture.** The width edit itself already refuses
 * before it commits anything — `resolvePanelWidthEdit`'s `refuse-no-room`, plus
 * `retileWallAroundPins`' "the wall must still sum and the pin must have come
 * back at exactly its pinned width" guards in page.tsx. (Verified on the named
 * case: typing 48in on that 150in wall is refused today, because the wall has
 * no free panel to take the 11¼in from.) What reaches this function is a lock
 * that was LEGAL when it was set and became unpayable because of a later,
 * unrelated edit — the wall dragged shorter, an opening added, a run stop, a
 * different standard width. Refusing *that* gesture would refuse an edit the
 * user did not just make, and would let a panel pin block a wall drag; so the
 * thing refused here is the **re-force**, and the wall is left exactly as the
 * tiler laid it out. `findUnhonouredLockedWidths` is how that refusal reaches a
 * human, since the wall it leaves behind is perfectly legal and nothing else
 * would show it.
 */

/** One hand-set width that could not be re-applied, and every number a note
 * needs to explain why — the same self-describing shape
 * `CornerBraceCombineRefusal` and `AbsorbedCornerWall` use, so a reporting
 * caller never has to look a number back up. */
export interface LockedWidthRefusal {
  /** Index in the wall's own slot array of the pinned slot. */
  slotIndex: number;
  /** The width the user hand-set, which is NOT in force. Still on the slot. */
  lockedWidthIn: number;
  /** The width the tiler gave this slot, which it keeps. */
  tiledWidthIn: number;
  /** How many unlocked standard/braced slots the rest of the run has. **0 is
   * the common case and the reachable one** — a wall whose only other slots are
   * corners, openings and the safety gap. */
  freePanelCount: number;
  /** Total width those panels could give UP before one of them hit the
   * fabrication minimum — i.e. the most this slot could GROW by. */
  canGiveUpIn: number;
  /** Total width they could ABSORB before one hit the catalog maximum — i.e.
   * the most this slot could SHRINK by. */
  canAbsorbIn: number;
}

export interface LockedWidthReforceResult {
  /** The run with every payable lock re-forced and every unpayable one left at
   * the tiler's width. **Its total always equals the input's, to the eighth.** */
  slots: PanelSlot[];
  refusals: LockedWidthRefusal[];
}

/** Slots the free run may resize: standard-family, not pinned by a hand edit of
 * their own. Same split `panelWidthEdit.ts`'s `isFreePanel` uses, and the same
 * one the old `shedWidthToNearestUnlocked` used. */
function isFreePanel(slot: PanelSlot): boolean {
  return (slot.type === "standard" || slot.type === "braced") && slot.lockedWidthIn === undefined;
}

/** Free slots in the order the old shed walked them — outward from the pinned
 * slot, forward to the end of the run first and then back toward the start —
 * so a wall the old code already got right settles the same way. */
function freeRunCandidates(slots: PanelSlot[], fromIndex: number): number[] {
  const candidates: number[] = [];
  for (let i = fromIndex + 1; i < slots.length; i++) if (isFreePanel(slots[i]!)) candidates.push(i);
  for (let i = fromIndex - 1; i >= 0; i--) if (isFreePanel(slots[i]!)) candidates.push(i);
  return candidates;
}

/**
 * Re-forces every hand-set width this run carries, or refuses the ones it
 * cannot pay for.
 *
 * **The wall's total is an integer identity, not a hope:** every quantity below
 * is a count of 1/8in, the pinned slot's new width is paid for exactly by the
 * settle, and a settle that cannot reach zero produces no mutation at all.
 *
 * ⚠ **Locks are planned one at a time, in slot order, each against the run as
 * the earlier ones left it, and the walk REPEATS until a whole pass applies
 * nothing.** They share one free run, so order is load bearing: on a wall with
 * two pins and only enough slack for one, the earlier slot gets it. Each
 * INDIVIDUAL lock is still all-or-nothing.
 *
 * The repeat is not tidiness — **it is what makes this function a fixpoint**,
 * and a fixpoint is a hard requirement rather than a nicety. `retile.ts`'s
 * preserving path re-reconciles EVERY wall, so an edit anywhere in the building
 * runs this over every other wall again; if a refused pin could become payable
 * on the second pass, a wall would change with no user action at all and the cut
 * list would depend on edit history. That is the exact defect the corner-brace
 * combine was fixed for on 2026-09-29 ("0 of 790,440 walls change under a no-op
 * reconcile"). **It is reachable here with two pins:** on
 * `[36in pinned 48in, 36in free, 30in pinned 24in]` the second pin hands 6in
 * back to the free panel, which is then exactly enough for the first — so a
 * single ordered pass refuses the first pin and the NEXT pass honours it.
 * Repeating settles both in one call instead. It also honours strictly more hand
 * edits, which is the right direction for a feature whose whole point is that a
 * user's width survives.
 *
 * Termination is immediate: every iteration either applies at least one pin, of
 * which there are finitely many, or ends the loop.
 *
 * ⚠ **A locked width is snapped to the 1/8in grid as it is applied.** The old
 * code assigned `slot.widthIn = slot.lockedWidthIn` raw, so an off-grid pin
 * from a pre-grid file put the wall itself off the grid. `repairWallToEighths`
 * already rounds stored pins at load; this makes it true of this path too.
 */
export function planLockedWidthReforce(slots: PanelSlot[]): LockedWidthReforceResult {
  const lockedIndices: number[] = [];
  for (let i = 0; i < slots.length; i++) if (slots[i]!.lockedWidthIn !== undefined) lockedIndices.push(i);
  // Overwhelmingly the common case, and worth keeping allocation-free: nothing
  // is pinned, so there is nothing to force and nothing to copy.
  if (lockedIndices.length === 0) return { slots, refusals: [] };

  const minEighths = toEighths(TILER_MIN_PANEL_WIDTH_IN);
  const maxEighths = toEighths(TILER_MAX_PANEL_WIDTH_IN);
  const working = slots.map((s) => ({ ...s }));
  let outstanding = lockedIndices;

  for (;;) {
    const stillOutstanding: number[] = [];
    for (const i of outstanding) {
      const slot = working[i]!;
      const lockedEighths = toEighths(slot.lockedWidthIn!);
      // Positive = the pin is NARROWER than the tiler's width, so there is
      // surplus to hand back to the run. Negative = the pin is wider and the run
      // has to give that much up. Same sign convention `settleResidualEighths`
      // takes, which is why it is passed straight through.
      const residualEighths = toEighths(slot.widthIn) - lockedEighths;
      if (residualEighths === 0) continue; // already in force; nothing owed
      const candidates = freeRunCandidates(working, i);
      const settled = candidates.length === 0 ? null : settleResidualEighths(working, candidates, residualEighths);
      if (!settled) {
        stillOutstanding.push(i);
        continue;
      }
      slot.widthIn = fromEighths(lockedEighths);
      for (const [j, nextEighths] of settled) working[j]!.widthIn = fromEighths(nextEighths);
    }
    if (stillOutstanding.length === outstanding.length) {
      outstanding = stillOutstanding;
      break;
    }
    outstanding = stillOutstanding;
  }

  const refusals: LockedWidthRefusal[] = outstanding.map((i) => {
    const slot = working[i]!;
    const candidates = freeRunCandidates(working, i);
    let canGiveUpEighths = 0;
    let canAbsorbEighths = 0;
    for (const j of candidates) {
      const e = toEighths(working[j]!.widthIn);
      canGiveUpEighths += Math.max(0, e - minEighths);
      canAbsorbEighths += Math.max(0, maxEighths - e);
    }
    return {
      slotIndex: i,
      lockedWidthIn: slot.lockedWidthIn!,
      tiledWidthIn: slot.widthIn,
      freePanelCount: candidates.length,
      canGiveUpIn: fromEighths(canGiveUpEighths),
      canAbsorbIn: fromEighths(canAbsorbEighths),
    };
  });

  return { slots: working, refusals };
}

/**
 * The widest and narrowest hand-set width this slot could actually carry on
 * this wall right now — the number Tommy's decision says the message has to
 * name ("the widest legal value").
 *
 * `null` when there is no legal hand-set width at all: the tiler's own width is
 * outside the catalog range and the run has no slack to move it into range. A
 * caller that gets `null` has to say "no hand-set width fits this wall as it
 * stands" rather than quote a figure, which is the same distinction
 * `narrowestAcceptablePinWidthIn` already makes in page.tsx.
 *
 * **The limits come IN**, exactly as `resolvePanelWidthEdit`'s do, because
 * `fabricationMinPanelWidthIn` (24in, confirmed) and `panelWidthInRange.maxIn`
 * (48in, manufacturer) are Building Integrity's numbers and live in the
 * catalog. This package restates neither.
 */
export function honourableLockedWidthRangeIn(
  refusal: LockedWidthRefusal,
  limits: PanelWidthLimitsIn,
): { narrowestIn: number; widestIn: number } | null {
  const widestEighths = Math.min(toEighths(refusal.tiledWidthIn + refusal.canGiveUpIn), toEighths(limits.maxIn));
  const narrowestEighths = Math.max(toEighths(refusal.tiledWidthIn - refusal.canAbsorbIn), toEighths(limits.minIn));
  if (widestEighths < narrowestEighths) return null;
  return { narrowestIn: fromEighths(narrowestEighths), widestIn: fromEighths(widestEighths) };
}

/** One refused lock, with the wall it is on. */
export interface UnhonouredLockedWidth extends LockedWidthRefusal {
  wallId: string;
}

/**
 * Every hand-set panel width in a building that is **not in force**, because
 * its wall cannot pay for it.
 *
 * ### Why this is reported at all, when the wall it describes is legal
 *
 * The `findCornerBraceCombineRefusals` / `findAbsorbedCornerWalls` situation
 * exactly. Refusing the re-force is right — the wall's real length is never
 * violated, which is what Tommy asked for — but the refusal has a consequence
 * nobody can see from the drawing: **the panel is fabricated at the tiler's
 * width, not at the width the user typed or dragged**, and it appears on the
 * cut list, the fabrication sheet and the shop drawing at that width. The
 * Selected Panel note says so for the panel a user happens to have selected;
 * this is how it reaches the one document an engineer reads for the panels
 * nobody selected.
 *
 * **It asks the planner rather than comparing `widthIn` to `lockedWidthIn`**,
 * deliberately. The planner is what decides, so report and behaviour cannot
 * drift apart, and a 1/8in difference that the next re-tile would legitimately
 * settle does not masquerade as a refusal. On a committed wall a lock that IS in
 * force has `widthIn === lockedWidthIn`, so its residual is zero and it is
 * never considered.
 *
 * **Nothing here changes a wall** — no slot moves, no width is rewritten,
 * nothing runs at load.
 */
export function findUnhonouredLockedWidths(slotsByWallId: Record<string, PanelSlot[]>): UnhonouredLockedWidth[] {
  const found: UnhonouredLockedWidth[] = [];
  for (const [wallId, slots] of Object.entries(slotsByWallId ?? {})) {
    for (const refusal of planLockedWidthReforce(slots ?? []).refusals) found.push({ wallId, ...refusal });
  }
  return found;
}
