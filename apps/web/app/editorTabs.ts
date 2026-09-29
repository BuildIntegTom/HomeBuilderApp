/**
 * The Wall / Foundation / Floor / Roof editor subjects, as one definition.
 *
 * ⚠ **THERE IS ONLY ONE CONTROL LEFT THAT PRESENTS THEM**, as of 2026-09-29:
 * the top bar's **Design menu**, where they are subject groups. Both of the
 * others are gone by Tommy's own decisions — the bar's nav tabs when the two
 * axes merged, and `EditorTabDial` the next day ("Remove it — Design is the
 * only door"). This module is kept as the single definition anyway, and that is
 * not sentiment: `EDITOR_TAB_LABEL` is what the Design menu's headings and its
 * subject entries read, so the menu introduces no new word for a subject, and
 * `editorTabsInScope` is still the one place the keyhole's "absent, not
 * shown-and-inert" rule is applied. One definition with one reader is still
 * worth having when a second reader is one feature away.
 */

export type EditorTab = "wall" | "foundation" | "floor" | "roof";

export const EDITOR_TAB_ORDER: readonly EditorTab[] = ["wall", "foundation", "floor", "roof"];

export const EDITOR_TAB_LABEL: Record<EditorTab, string> = {
  wall: "Wall",
  foundation: "Foundation",
  floor: "Floor",
  roof: "Roof",
};

/**
 * The tabs a control should offer, in building order, given Panelizer's
 * "keyhole" checkboxes. A ruled-out tab is absent, not shown-and-inert (spec:
 * "A ruled-out tab is absent from the nav"). Falls back to every tab if the
 * list is ever empty, so neither control can get stuck offering nothing.
 */
export function editorTabsInScope(enabledTabs: readonly EditorTab[]): EditorTab[] {
  return enabledTabs.length > 0
    ? EDITOR_TAB_ORDER.filter((tab) => enabledTabs.includes(tab))
    : [...EDITOR_TAB_ORDER];
}

/**
 * Panelizer's four scope-of-work checkboxes, as one value — Walls, Floors
 * and Roof have been here since the keyhole shipped; Foundation joined them
 * in Smearforn Stage 0 (Tommy: "I would like the turn off the floor and
 * foundation tools as default for now").
 */
export type ScopeBranch = "walls" | "foundation" | "floors" | "roof";

export type ScopeOfWork = Record<ScopeBranch, boolean>;

/**
 * Whether `branch` is the only scope branch still checked.
 *
 * **Why anything cares.** With Foundation optional, all four can be off for
 * the first time, and an empty scope is not a designed state: `editorTabsInScope([])`
 * deliberately falls back to EVERY tab (above), while page.tsx's snap-to-first
 * effect would set `editorTab` to its own `?? "foundation"` fallback — the
 * dial would offer everything while the state named one thing. Rather than
 * invent an empty-state nobody asked for, the last checked box refuses to be
 * unchecked. Cheapest correct answer, and it is reversible: checking a second
 * branch frees the first immediately.
 */
export function isLastEnabledScopeBranch(scope: ScopeOfWork, branch: ScopeBranch): boolean {
  return scope[branch] && enabledScopeBranchCount(scope) === 1;
}

export function enabledScopeBranchCount(scope: ScopeOfWork): number {
  return Object.values(scope).filter(Boolean).length;
}

/** The title a refusing checkbox carries, so the reason is readable on hover
 * rather than being a dead control. */
export const LAST_SCOPE_BRANCH_TITLE =
  "At least one branch of the scope of work has to stay checked — check another one first.";
