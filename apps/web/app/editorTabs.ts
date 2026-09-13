/**
 * The Wall / Foundation / Floor / Roof editor tabs, as one definition shared by
 * both controls that present them: `EditorTabDial` (below 1200px) and the top
 * bar's nav (1200px and up). Both render from `page.tsx`'s one `editorTab`
 * state; sharing the order, the labels and the keyhole filter here is what
 * stops the two presentations from ever disagreeing about which tabs exist.
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
