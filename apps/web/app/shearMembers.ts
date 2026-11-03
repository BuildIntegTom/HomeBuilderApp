import { buildBracedPanelMembers, type BracePattern, type PanelMember } from "@building-integrity/panel-catalog";
import { resolveBracedStyle } from "./bracedStyle";
import { standardPanelMembersFor } from "./standardPanelMembers";
import type { PanelInstance } from "./panelInstances";

export interface ShearMemberContext {
  thicknessIn: number;
  wallHeightIn: number;
  includeNailer: boolean;
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
 * Returns null for a panel with no diagonal at all — a plain standard, or a
 * Nailer Pair, which sets `bracePairPattern` and adds no brace. That null is
 * what keeps a Nailer out of both the total and the sheet.
 */
export function shearMembersFor(inst: PanelInstance, ctx: ShearMemberContext): PanelMember[] | null {
  if (inst.panelType === "braced") {
    const style = resolveBracedStyle(inst, ctx.defaultBracePattern, ctx.defaultBracedMirrored);
    return buildBracedPanelMembers(inst.widthIn, ctx.thicknessIn, ctx.wallHeightIn, ctx.includeNailer, style.pattern, style.mirrored);
  }
  if (inst.bracePairPattern !== undefined) {
    return standardPanelMembersFor(inst, inst.widthIn, ctx.thicknessIn, ctx.wallHeightIn, ctx.includeNailer);
  }
  return null;
}
