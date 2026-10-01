import type { PanelSlot } from "./types";

/** One corner end of one wall whose corner-brace combine did not happen, and
 * what stands there instead. Everything a note needs is on the record, the
 * same self-describing shape `AbsorbedCornerWall` uses, so a reporting caller
 * never has to look a number back up. */
export interface CornerBraceCombineRefusal {
  wallId: string;
  /** Which end of the wall's own slot array — `"start"` is index 0. */
  end: "start" | "end";
  /** The plain (uncombined) safety-gap slot the corner walk had to step over.
   * Its presence IS the refusal: a combine that happened leaves a safety-gap
   * slot carrying `secondaryType: "braced"`, which this walk stops at. */
  gapSlotIndex: number;
  gapWidthIn: number;
  /** The slot that actually carries this corner's brace, or `null` when the
   * walk reached the far end of the wall without finding one at all. */
  braceSlotIndex: number | null;
  /** Inches between the corner panel's inner face and that brace's near edge
   * — 0.75in when the only thing in between is the safety gap itself (the
   * negligible case), and several feet when an opening sits in between.
   * `null` when there is no brace to measure to. */
  braceOffsetFromCornerIn: number | null;
  /** True when ONE braced panel is all that serves BOTH of this wall's
   * corners — the case that leaves the wall legal on its length while
   * carrying one brace where Tommy's rule asks for one per corner. */
  braceSharedWithOtherCorner: boolean;
  /** Braced panels on the whole wall, counting a combined safety-gap+brace as
   * one. Carried so the note can state it rather than implying it. */
  bracedPanelCountOnWall: number;
}

/** Does this slot carry a brace at all — a "braced" panel, or a safety-gap
 * slot the combine already merged a brace into. Mirrors
 * `applyBracedPlacement`'s rule 1, which treats both as "this corner is
 * already handled". */
function carriesBrace(slot: PanelSlot): boolean {
  return slot.type === "braced" || slot.secondaryType === "braced";
}

function isCorner(slot: PanelSlot | undefined): boolean {
  return slot?.type === "corner" || slot?.type === "safety-oct-corner";
}

/**
 * Every corner end whose **corner-brace combine was refused**, and what the
 * corner got instead.
 *
 * ### Why this is reported at all, when the wall it describes is legal
 *
 * Exactly the `findAbsorbedCornerWalls` situation, four days older. The
 * corner-brace combine used to pay for itself by shrinking a neighbouring
 * panel toward zero, which broke the wall's own total length; since
 * 2026-09-29 it pays by SWALLOWING a panel whole and **refuses outright when
 * the run cannot pay legally** (see `planCornerBraceCombine`). Refusing is
 * right — the wall's real length is never violated, and Tommy asked for
 * exactly that ("this app needs to be perfectly tight with dimensions and
 * wall lengths"). But the refusal has a consequence nobody can see from the
 * drawing:
 *
 *   * the safety gap stays a visible spacer (3/4in on a run over 144in, 1/2in at
 *     or under it) rather than merging into the
 *     brace, and the corner's brace lands on an ordinary standard panel
 *     further in;
 *   * **on 4,064 measured ends that panel sits 3ft 3/4in in, past an
 *     opening**, and on 5,490 more it sits 3ft 1/2in in — the same case one gap
 *     tier narrower — not "adjacent but one"; see the histogram under "the gap
 *     step" below for the other distances;
 *   * and on **14,972 measured walls the wall goes from two braced panels to
 *     one**, because the brace the far corner's walk finds is the same panel
 *     the near corner's walk found. Every one of those 14,972 owns two corners
 *     and carries exactly one brace on the whole wall. Tommy's rule is one
 *     brace per corner ("each wall must have two braced panels on it, touching
 *     each side of each corner panel"), so that wall is legal on its length
 *     and short of his rule at the same time.
 *
 * ⚠ **Every count in this comment is measured on ONE sweep and no other: the
 * 790,440-wall product sweep** (every eighth from 12in to 600in x standard
 * widths {39, 40, 48} x 4 corner configs x 2 gap ends x 7 opening sets), the
 * same one `bracedPlacement.test.ts` runs. An earlier version of this file
 * quoted the first three figures from a smaller 6-opening-set sweep beside
 * figures from this one, unlabelled, which is exactly the thing a file whose
 * job is to be the honest record may not do. All of them are now pinned by
 * `cornerBraceCombineRefusals.test.ts`'s census, so they fail rather than
 * drift.
 *
 * A wall that is legal and carries one brace where the rule asks for two is a
 * fact only an engineer can bless, and the Review Log is the one document that
 * engineer reads. **Nothing here changes a wall** — no slot moves, no width is
 * rewritten, nothing runs at load.
 *
 * ### It carries a pending status, and that is not decoration
 *
 * Brace placement derives from `seismicBracedPanelSpacingFt` and
 * `bracedWallLineSpacingFt`, **both `pending-BI-confirmation`**, and "Braced
 * Panel geometry" sits in the spec's own "Provisional beyond the flags" list.
 * A structural placement derived from unconfirmed values moved on tens of
 * thousands of walls; the entry has to carry that provisionality forward
 * rather than present the new placement as settled.
 *
 * ### What it looks at, and what it deliberately does not
 *
 * Only ends where the wall actually BUILDS a corner panel. An end with no
 * corner has no corner panel for a brace to touch, so Tommy's rule has
 * nothing to say about it; the combine can still be refused there and that
 * refusal is simply not this entry's business. Measured on the same
 * 790,440-wall product sweep: **75,480 of 100,451 refusal walls own at least
 * one corner**, where a "refusal wall" is one whose rule-1 corner walk reached
 * a plain safety gap — i.e. the combine was attempted there and did not fire.
 *
 * ⚠ **EVERY COUNT IN THIS COMMENT WAS RE-MEASURED ON 2026-10-01** for the
 * two-tier safety gap (the old figures are kept beside the new ones). The reason
 * they all roughly tripled is one thing: a run of 144in or less used to get NO
 * safety gap, so a short run had no plain gap for the corner walk to reach and
 * no refusal to report. Now every run reserves one. **The flip of corner
 * ownership on the same day does not touch this sweep at all** — it passes
 * `hasCornerStart`/`hasCornerEnd` to `retileWithOpenings` explicitly — and the
 * histogram below proves it: every wide-gap offset comes back bit-identical and
 * every new entry is its narrow-gap twin.
 *
 * ⚠ **One related figure is NOT pinned and cannot be, so read it as dated —
 * and it is now dated TWICE OVER:** of the 32,644 refusal walls as that sweep
 * stood on 2026-09-30, **13,355 came out carrying one fewer braced panel than
 * they did before the 2026-09-29 rewrite, and 0 carried more.** The refusal-wall
 * population is now 100,451, so that fraction no longer describes this tree
 * either; it is left as a record of what the rewrite cost on the sweep it was
 * measured against, and nothing has re-measured it since. That is a comparison
 * against an implementation that is no longer in the tree (`applyBracedPlacement`
 * as of commit b714fdb, whose combine paid by shedding width onto a neighbour
 * clamped at zero). Re-verified against that commit on 2026-09-30; if the
 * combine changes again, re-measure it the same way or delete the sentence
 * rather than carrying it forward untested. The 32,644 and 28,979 halves ARE
 * pinned (at their new values), and they are measured from this code alone.
 *
 * ### The one case deliberately NOT reported: the gap step
 *
 * When the ONLY thing between the corner panel and its brace is the safety gap
 * itself, the brace is the very next panel across a plywood spacer — 3/4in on a
 * run over 144in, 1/2in at or under it. That
 * is the "adjacent but one" case, and it is the refusal working as intended.
 * **Measured over the 790,440-wall product sweep: 50,269 refused corner ends,
 * of which 25,888 are that gap step. 20,129 of those are dropped here** — the
 * other 5,759 report anyway because their brace is shared — leaving **30,140
 * reported ends**, in two matched halves:
 *
 *   * the WIDE-gap (3/4in) offsets, every one of them unchanged from the
 *     2026-09-30 census: 6,559 whose brace sits 62-1/4in in from the corner,
 *     4,064 at 36-3/4in, 1,100 at 80-3/4in, 95 at 30-3/4in;
 *   * the NARROW-gap (1/2in) offsets, all new on 2026-10-01 and each a quarter
 *     inch nearer the corner than its twin: 2,098 at 62in, 5,490 at 36-1/2in,
 *     1,212 at 80-1/2in, 3,091 at 30-1/2in;
 *   * plus 672 ends with no brace anywhere on the wall at all (was 144), and the
 *     step itself where the brace is shared: 1,265 at 3/4in (unchanged) and
 *     4,494 at 1/2in (new).
 *
 * (Was 21,080 refused ends / 9,118 steps / 7,853 dropped / 1,265 reported
 * anyway / 13,227 reported.) A shared brace and a missing brace are reported at
 * any offset, including the step, because those are facts about the wall rather
 * than about a distance.
 *
 * It also cannot tell WHY the combine was refused — a run that could not pay
 * legally, or a wall whose slot indices are pinned by a Mid-Wall Bond Beam,
 * Box Beam coverage or a spanning header (`slotIndicesArePinned`). The caller
 * knows which walls are pinned and says so; this walk reads slots only.
 */
export function findCornerBraceCombineRefusals(slotsByWallId: Record<string, PanelSlot[]>): CornerBraceCombineRefusal[] {
  const found: CornerBraceCombineRefusal[] = [];
  for (const [wallId, slots] of Object.entries(slotsByWallId ?? {})) {
    const list = slots ?? [];
    if (list.length === 0) continue;
    const bracedPanelCountOnWall = list.filter(carriesBrace).length;

    /** Rule 1's own walk, inward from one end: step over everything until a
     * slot carrying a brace, remembering whether a PLAIN safety gap was one of
     * the things stepped over and how much width was crossed. */
    const walk = (start: number, step: number) => {
      let gapSlotIndex: number | null = null;
      let gapWidthIn = 0;
      let crossedIn = 0;
      for (let i = start; i >= 0 && i < list.length; i += step) {
        const slot = list[i]!;
        if (carriesBrace(slot)) return { gapSlotIndex, gapWidthIn, braceSlotIndex: i, braceOffsetFromCornerIn: crossedIn };
        if (slot.type === "safety-gap" && slot.secondaryType === undefined && gapSlotIndex === null) {
          gapSlotIndex = i;
          gapWidthIn = slot.widthIn;
        }
        // The corner panel itself is not "crossed" — the offset is measured
        // from its inner face.
        if (!isCorner(slot)) crossedIn += slot.widthIn;
      }
      return { gapSlotIndex, gapWidthIn, braceSlotIndex: null as number | null, braceOffsetFromCornerIn: null };
    };

    const startWalk = isCorner(list[0]) ? walk(1, 1) : null;
    const endWalk = isCorner(list[list.length - 1]) ? walk(list.length - 2, -1) : null;
    const shared =
      startWalk?.braceSlotIndex !== null &&
      startWalk?.braceSlotIndex !== undefined &&
      startWalk.braceSlotIndex === endWalk?.braceSlotIndex;

    for (const [end, result] of [
      ["start", startWalk],
      ["end", endWalk],
    ] as const) {
      if (!result || result.gapSlotIndex === null) continue;
      // The 3/4in step — see this function's own doc comment. Excluded on the
      // distance alone; a shared or missing brace still reports.
      const isAdjacentAcrossTheGapOnly =
        result.braceSlotIndex !== null && result.braceOffsetFromCornerIn === result.gapWidthIn;
      if (isAdjacentAcrossTheGapOnly && !shared) continue;
      found.push({
        wallId,
        end,
        gapSlotIndex: result.gapSlotIndex,
        gapWidthIn: result.gapWidthIn,
        braceSlotIndex: result.braceSlotIndex,
        braceOffsetFromCornerIn: result.braceOffsetFromCornerIn,
        braceSharedWithOtherCorner: shared,
        bracedPanelCountOnWall,
      });
    }
  }
  return found;
}
