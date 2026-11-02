import {
  type PanelMember,
  bracePairAddedMembers,
  buildPanelFromRecipe,
  buildStandardPanelMembers,
} from "@building-integrity/panel-catalog";

/**
 * ⚠ **ONE PLACE A STANDARD PANEL'S MEMBERS COME FROM — B15.**
 *
 * There were five calls to `buildStandardPanelMembers` across `page.tsx`,
 * `Building3DView.tsx` and `FootprintCanvas.tsx`, and a panel's brace pattern
 * has to reach every one of them or the picture, the cut list and the weight
 * describe different panels. That is the same trap the corner panel was in an
 * hour earlier: two of its five call sites were still passing no width and
 * drawing a 25.5in corner against a 15.5in reservation.
 *
 * ⚠ **Behaviour-preserving when a panel has no pattern.** `buildPanelFromRecipe`
 * is `buildStandardPanelMembers` plus the added members, so a slot with no
 * `bracePairPattern` goes down the identical path it always did — and takes
 * the plain call rather than an empty recipe, so nothing depends on the two
 * being equivalent.
 *
 * ⚠ **A pattern removes the centre nailer studs**, and that is
 * `buildPanelFromRecipe`'s own rule, not one invented here: a diagonal and a
 * centre stud occupy the same place. Worth naming because
 * `panel_module_2ft_4ft` wants a 48in wall panel's CENTRE to land on the deck
 * joint between its two 24in deck panels — with a superbrace, what lands
 * there is the crossing of the two diagonals rather than a stud. Flagged for
 * Tommy rather than decided here.
 */
export function standardPanelMembersFor(
  source: { bracePairPattern?: "superbrace" | "braced" | "nailer"; bracePairHalf?: "left" | "right" },
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
): PanelMember[] {
  const { bracePairPattern, bracePairHalf } = source;
  if (bracePairPattern === undefined || bracePairHalf === undefined) {
    return buildStandardPanelMembers(widthIn, depthIn, heightIn, includeNailer);
  }
  return buildPanelFromRecipe({
    name: `Standard ${widthIn}in — ${bracePairPattern} ${bracePairHalf}`,
    widthIn,
    depthIn,
    heightIn,
    includeNailer,
    added: bracePairAddedMembers({ pattern: bracePairPattern, widthIn, heightIn, half: bracePairHalf }),
  });
}
