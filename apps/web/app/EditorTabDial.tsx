"use client";

import styles from "./EditorTabDial.module.css";

export type EditorTab = "wall" | "foundation" | "floor" | "roof";

const TAB_ORDER: EditorTab[] = ["wall", "foundation", "floor", "roof"];
const TAB_LABEL: Record<EditorTab, string> = {
  wall: "Wall",
  foundation: "Foundation",
  floor: "Floor",
  roof: "Roof",
};

export interface EditorTabDialProps {
  value: EditorTab;
  onChange: (tab: EditorTab) => void;
  /** Which tabs are currently relevant — Panelizer's own "keyhole"
   * checkboxes (Tommy: "I want this tab to be the keyhole to getting down
   * to what editor tools are needed for this user's project") gate
   * Wall/Floor/Roof; Foundation has no such checkbox, so it's always
   * included by the caller. Cycling (chevrons/wheel) skips anything not in
   * this list. Falls back to the full TAB_ORDER if it's ever empty, so the
   * dial never gets stuck with nothing to show. */
  enabledTabs: EditorTab[];
}

/**
 * A small vertical "dial" (Tommy: "a scroll menu that rolls up or down to
 * the next option between walls foundation floor roof wall etc.") standing
 * in for the old flat 4-button tab row — shows the current tab centered,
 * with up/down chevrons and mouse-wheel support both cycling through
 * Wall → Foundation → Floor → Roof → (wrap), skipping whichever of those
 * Panelizer's own checkboxes have currently ruled out of scope.
 */
export default function EditorTabDial({ value, onChange, enabledTabs }: EditorTabDialProps) {
  const cycleOrder = enabledTabs.length > 0 ? TAB_ORDER.filter((t) => enabledTabs.includes(t)) : TAB_ORDER;
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
      <div className={styles.current}>{TAB_LABEL[value]}</div>
      <button type="button" className={styles.chevron} title="Next editor" onClick={() => step(1)}>
        ▼
      </button>
    </div>
  );
}
