"use client";

import EditorTabDial, { type EditorTab } from "./EditorTabDial";
import { useRustleSound } from "./useRustleSound";
import styles from "./EditorToolbar.module.css";

export interface EditorToolbarProps {
  editorTab: EditorTab;
  onEditorTabChange: (tab: EditorTab) => void;
  viewMode: "plan" | "3d";
  onViewModeChange: (mode: "plan" | "3d") => void;
  viewModeDisabled: boolean;
}

/**
 * Sits directly above the Wall/Foundation/Floor/Roof editor region (Tommy:
 * "the editor should have a menu bar along the top of it"). Left: the tab
 * dial. Right: big 2D/3D buttons — the 3D one gets an extruded look
 * (layered shadow) so it reads as more three-dimensional next to the flat
 * 2D button — plus a synthesized rustle sound on every toggle (Tommy: "a
 * brushling bush sound when you toggle 2d to three d and back" — the
 * accompanying straw-wiggle animation was dropped later, "no need to have
 * this feature... the grass animation", but the sound stayed). Fullscreen
 * now lives in page.tsx's compass row instead of here (Tommy: "squeeze all
 * the viewing tab stuff beside the compass").
 */
export default function EditorToolbar({
  editorTab,
  onEditorTabChange,
  viewMode,
  onViewModeChange,
  viewModeDisabled,
}: EditorToolbarProps) {
  const playRustle = useRustleSound();

  const handleViewModeChange = (mode: "plan" | "3d") => {
    if (mode !== viewMode) {
      playRustle();
    }
    onViewModeChange(mode);
  };

  return (
    <div className={styles.bar}>
      <EditorTabDial value={editorTab} onChange={onEditorTabChange} />

      <div className={styles.viewModeGroup} role="group" aria-label="View mode">
        <button
          type="button"
          title="2D floor-plan view"
          aria-pressed={viewMode === "plan"}
          className={styles.flatButton}
          data-active={viewMode === "plan"}
          onClick={() => handleViewModeChange("plan")}
        >
          2D
        </button>
        <button
          type="button"
          title="3D building preview"
          aria-pressed={viewMode === "3d"}
          className={styles.cubeButton}
          data-active={viewMode === "3d"}
          disabled={viewModeDisabled}
          onClick={() => handleViewModeChange("3d")}
        >
          3D
        </button>
      </div>
    </div>
  );
}
