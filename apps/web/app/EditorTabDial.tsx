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
}

/**
 * A small vertical "dial" (Tommy: "a scroll menu that rolls up or down to
 * the next option between walls foundation floor roof wall etc.") standing
 * in for the old flat 4-button tab row — shows the current tab centered,
 * with up/down chevrons and mouse-wheel support both cycling through
 * Wall → Foundation → Floor → Roof → (wrap).
 */
export default function EditorTabDial({ value, onChange }: EditorTabDialProps) {
  const index = TAB_ORDER.indexOf(value);
  const step = (delta: number) => {
    const next = (index + delta + TAB_ORDER.length) % TAB_ORDER.length;
    onChange(TAB_ORDER[next]!);
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
