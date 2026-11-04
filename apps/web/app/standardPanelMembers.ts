import {
  type AddedMemberSpec,
  type GirtStyle,
  type PanelMember,
  bracePairAddedMembers,
  buildPanelFromRecipe,
  buildStandardPanelMembers,
} from "@building-integrity/panel-catalog";
import type { StoredPanelMemberSpec } from "@building-integrity/geometry";

/**
 * The project file's member specs, narrowed to the catalog's own union.
 *
 * ⚠ **Two types for one shape, on purpose.** `StoredPanelMemberSpec` lives in
 * `packages/geometry` because that is where `PanelSlot` lives, and geometry is
 * a SIBLING of panel-catalog rather than a dependency — the same arrangement
 * `BracePattern` has. The fields are identical; what differs is that the stored
 * form carries `kind: "diagonal" | "straight"` on one object while
 * `AddedMemberSpec` is a discriminated union of two. This is the one-line
 * narrowing between them, and it is a function rather than a cast so that a
 * third kind added on either side becomes a type error here instead of a
 * member drawn as the wrong shape.
 */
export function toAddedMemberSpecs(stored: readonly StoredPanelMemberSpec[]): AddedMemberSpec[] {
  return stored.map((spec) => {
    if (spec.kind === "diagonal") {
      /* ⚠ Written out field by field rather than spread, because this branch
         has to DROP one: `role` only means anything on a square-cut board, and
         a diagonal is always a brace. A spread would carry it along into the
         catalog's union, which has no field for it, and
         `const { role: _role, ...rest }` would leave an unused binding behind
         to say so. */
      return {
        kind: "diagonal" as const,
        id: spec.id,
        fromXIn: spec.fromXIn,
        fromZIn: spec.fromZIn,
        toXIn: spec.toXIn,
        toZIn: spec.toZIn,
        wythe: spec.wythe,
        ...(spec.notes !== undefined && { notes: spec.notes }),
      };
    }
    return { ...spec, kind: "straight" as const };
  });
}

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
    editedMembers?: StoredPanelMemberSpec[];
    panelName?: string;
  },
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  /** ⚠ **The project's girt style, and every caller of this seam passes it.**
   * The one that did not pass `braceFigure` built every Shop Fabrication sheet
   * at the default brace figure — same shape of defect, one field over. */
  girtStyle: GirtStyle,
): PanelMember[] {
  const { bracePairPattern, bracePairHalf, braceFigure, editedMembers } = source;
  /* ⚠ **A hand-edited panel is its own panel — B19's panel editor.**
     The stored list REPLACES the pattern rather than adding to it, which is
     the only way deleting a carrot leg can stick: a pattern asked for the
     derived list on every render, so anything the editor removed came
     straight back. The editor seeds the list from the pattern, so a panel
     opened and left alone is byte-identical to the one that was there.

     Nothing else is lost by this: the cut list, the weight, the price, the
     overlap check, the 3D view and every file export read members through
     this one function, so the edit reaches all of them at once. */
  if (editedMembers !== undefined) {
    return buildPanelFromRecipe({
      name: source.panelName ?? `Standard ${widthIn}in — edited`,
      widthIn,
      depthIn,
      heightIn,
      includeNailer,
      girtStyle,
      added: toAddedMemberSpecs(editedMembers),
    });
  }
  if (bracePairPattern === undefined || bracePairHalf === undefined) {
    return buildStandardPanelMembers(widthIn, depthIn, heightIn, includeNailer, girtStyle);
  }
  return buildPanelFromRecipe({
    name: `Standard ${widthIn}in — ${braceFigure ?? bracePairPattern} ${bracePairHalf}`,
    widthIn,
    depthIn,
    heightIn,
    includeNailer,
    girtStyle,
    added: bracePairAddedMembers({ pattern: bracePairPattern, widthIn, heightIn, half: bracePairHalf, figure: braceFigure }),
  });
}
