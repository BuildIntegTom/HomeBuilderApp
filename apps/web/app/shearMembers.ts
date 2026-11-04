import { buildBracedPanelMembers, type BracePattern, type GirtStyle, type PanelMember } from "@building-integrity/panel-catalog";
import { resolveBracedStyle } from "./bracedStyle";
import { standardPanelMembersFor } from "./standardPanelMembers";
import type { PanelInstance } from "./panelInstances";

export interface ShearMemberContext {
  thicknessIn: number;
  wallHeightIn: number;
  includeNailer: boolean;
  /** ⚠ The project's girt style. A girt is not a shear member, but the shear
   * check reads the WHOLE panel and then picks the diagonals out of it — so a
   * context missing this would measure a panel the building does not have. */
  girtStyle: GirtStyle;
  defaultBracePattern: BracePattern;
  defaultBracedMirrored: boolean;
}

/**
 * ⚠ **The members a panel's SHEAR is read from — one definition.**
 *
 * The whole-project total, the Engineer role's per-wall card and the Derivation
 * Sheet (B18) all ask this. A sheet that explained a figure it did not
 * reproduce would be worse than no sheet: the arithmetic would check out and
 * still describe a different panel.
 *
 * ⚠ **It lives in its own module, at module scope, on purpose.** It began as a
 * closure inside `page.tsx`'s component body, and the Derivation Sheet's memo
 * calling it raised `react-hooks/exhaustive-deps` from 12 to 13 — a rule this
 * project's gate says may never rise, because a stale memo there once cut real
 * parts wrong. Taking the five values it needs as an explicit context object
 * makes it pure, so nothing has to be listed as a dependency and nothing can go
 * stale. Wrapping it in `useCallback` would have traded one flagged rule for
 * another.
 *
 * Returns null for a panel with no pattern at all — a plain standard panel.
 *
 * ⚠ A Vertical Nailer panel does NOT come back null: since B21 it sets
 * `bracePairPattern` and carries real members, so it is built here like any
 * other. It still contributes nothing, because `derivePanelShear` filters on
 * `role === "brace"` and a nailer is not one — the zero now comes from the
 * member list rather than from an early return, which is the more honest place
 * for it to come from.
 */
export function shearMembersFor(inst: PanelInstance, ctx: ShearMemberContext): PanelMember[] | null {
  /* ⚠ **B22: the panel's OWN height, not the wall's.** A wall tall enough to
     split carries an upper band that is much shorter than the storey, and
     `heightOverrideIn` is that band's real height. Every other reader of this
     instance already passes it — the weight, the wood weight, the fastener
     count, the 3D view and the Shop Fabrication sheet all build the short
     panel. Only shear read `ctx.wallHeightIn`, so an upper-row panel CUT with
     40in diagonals was COUNTED as one with 120in diagonals. A brace's capacity
     is resolved through its own tilt, so a panel measured at the wrong height
     is measured at the wrong angle as well as the wrong length: the error ran
     in the unsafe direction, inflating the building's reported shear. */
  const heightIn = inst.heightOverrideIn ?? ctx.wallHeightIn;
  if (inst.panelType === "braced") {
    const style = resolveBracedStyle(inst, ctx.defaultBracePattern, ctx.defaultBracedMirrored);
    return buildBracedPanelMembers(
      inst.widthIn,
      ctx.thicknessIn,
      heightIn,
      ctx.includeNailer,
      style.pattern,
      style.mirrored,
      false,
      ctx.girtStyle,
    );
  }
  if (inst.bracePairPattern !== undefined) {
    return standardPanelMembersFor(inst, inst.widthIn, ctx.thicknessIn, heightIn, ctx.includeNailer, ctx.girtStyle);
  }
  return null;
}
