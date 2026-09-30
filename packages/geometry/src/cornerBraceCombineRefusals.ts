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
 *   * the safety gap stays a visible 3/4in spacer rather than merging into the
 *     brace, and the corner's brace lands on an ordinary standard panel
 *     further in;
 *   * **on 1,158 measured ends that panel sits 3ft to 5ft in, past an
 *     opening**, not "adjacent but one";
 *   * and on **6,544 measured walls the wall goes from two braced panels to
 *     one**, because the brace the far corner's walk finds is the same panel
 *     the near corner's walk found. Tommy's rule is one brace per corner
 *     ("each wall must have two braced panels on it, touching each side of
 *     each corner panel"), so that wall is legal on its length and short of
 *     his rule at the same time.
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
 * refusal is simply not this entry's business. Measured: of the refusal walls
 * in the product sweep, 22,346 of 25,426 own at least one corner.
 *
 * ### The one case deliberately NOT reported: the 3/4in step
 *
 * When the ONLY thing between the corner panel and its brace is the safety gap
 * itself, the brace is the very next panel across a 3/4in plywood spacer. That
 * is the "adjacent but one" case, and it is the refusal working as intended.
 * **Measured over the 790,440-wall product sweep: 21,080 refused corner ends,
 * of which 9,118 are that 3/4in step. 7,853 of those are dropped here** — the
 * other 1,265 report anyway because their brace is shared — leaving **13,227
 * reported ends**: 6,559 whose brace sits 62-1/4in in from the corner, 4,064 at
 * 36-3/4in, 1,100 at 80-3/4in, 95 at 30-3/4in, and 144 with no brace anywhere
 * on the wall at all. A shared brace and a missing brace are reported at any
 * offset, including that one, because those are facts about the wall rather
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
