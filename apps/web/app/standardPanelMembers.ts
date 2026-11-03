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
 * ⚠ **A pattern removes the centre nailer studs, and that is now a
 * DECISION rather than a side effect.** It has always been
 * `buildPanelFromRecipe`'s own rule — a diagonal and a centre stud occupy
 * the same place — and it was flagged here as an open conflict with
 * `panel_module_2ft_4ft`, which wants a 48in panel's CENTRE over the deck
 * joint between its two 24in deck panels: with a pattern, what lands there
 * is a diagonal rather than a stud. Put to him on 2026-11-02: *"Nailers can
 * be replaced by diagonals. That's not a problem."* So the centre still
 * carries wood down to the joint, just on the slant.
 */
export function standardPanelMembersFor(
  source: {
    bracePairPattern?: "superbrace" | "braced" | "nailer";
    bracePairHalf?: "left" | "right";
    braceFigure?: "super-carrot" | "big-carrot" | "little-carrot";
  },
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
): PanelMember[] {
  const { bracePairPattern, bracePairHalf, braceFigure } = source;
  if (bracePairPattern === undefined || bracePairHalf === undefined) {
    return buildStandardPanelMembers(widthIn, depthIn, heightIn, includeNailer);
  }
  return buildPanelFromRecipe({
    name: `Standard ${widthIn}in — ${braceFigure ?? bracePairPattern} ${bracePairHalf}`,
    widthIn,
    depthIn,
    heightIn,
    includeNailer,
    added: bracePairAddedMembers({ pattern: bracePairPattern, widthIn, heightIn, half: bracePairHalf, figure: braceFigure }),
  });
}
