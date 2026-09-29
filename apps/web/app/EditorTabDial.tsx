"use client";

import { EDITOR_TAB_LABEL, editorTabsInScope, type EditorTab } from "./editorTabs";
import styles from "./EditorTabDial.module.css";

export type { EditorTab };

export interface EditorTabDialProps {
  value: EditorTab;
  onChange: (tab: EditorTab) => void;
  /** Which tabs are currently relevant — Panelizer's own "keyhole"
   * checkboxes (Tommy: "I want this tab to be the keyhole to getting down
   * to what editor tools are needed for this user's project") gate all four.
   * ⚠ This used to say "Foundation has no such checkbox, so it's always
   * included by the caller", which went stale when Smearforn Stage 0 added
   * `foundationEnabled` (2026-09-24) and defaulted Floor and Foundation OFF;
   * `page.tsx`'s `enabledEditorTabs` now derives from `wallsEnabled`,
   * `foundationEnabled`, `floorsEnabled` and `roofEnabled` together. Corrected
   * 2026-09-28. Cycling (chevrons/wheel) skips anything not in this list. Falls
   * back to every tab if it's ever empty, so the dial never gets stuck with
   * nothing to show. */
  enabledTabs: EditorTab[];
}

/**
 * A small vertical "dial" (Tommy: "a scroll menu that rolls up or down to
 * the next option between walls foundation floor roof wall etc.") standing
 * in for the old flat 4-button tab row — shows the current tab centered,
 * with up/down chevrons and mouse-wheel support both cycling through
 * Wall → Foundation → Floor → Roof → (wrap), skipping whichever of those
 * Panelizer's own checkboxes have currently ruled out of scope.
 *
 * Below 1200px this is the tab control; at 1200px and up the top bar's nav
 * takes over and EditorToolbar hides it (spec: "Top Bar & App Chrome", Tommy's
 * 2026-09-13 decision). Same state, same `editorTabs.ts` definition, so the two
 * can never disagree. Demoted, not deleted: whether it survives at desktop width
 * is still Tommy's call.
 */
export default function EditorTabDial({ value, onChange, enabledTabs }: EditorTabDialProps) {
  const cycleOrder = editorTabsInScope(enabledTabs);
  const index = Math.max(0, cycleOrder.indexOf(value));
  const step = (delta: number) => {
    const next = (index + delta + cycleOrder.length) % cycleOrder.length;
    onChange(cycleOrder[next]!);
  };

  return (
    <div
      className={styles.dial}
      role="group"
      aria-label="Editor"
      title="Scroll or use the arrows to switch between Wall, Foundation, Floor, and Roof"
      onWheel={(e) => {
        e.preventDefault();
        step(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <button type="button" className={styles.chevron} title="Previous editor" onClick={() => step(-1)}>
        ▲
      </button>
      <div className={styles.current}>{EDITOR_TAB_LABEL[value]}</div>
      <button type="button" className={styles.chevron} title="Next editor" onClick={() => step(1)}>
        ▼
      </button>
    </div>
  );
}
