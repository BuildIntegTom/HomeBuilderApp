"use client";

import { useState } from "react";
import EditorTabDial, { type EditorTab } from "./EditorTabDial";
import StrawWiggleBadge from "./StrawWiggleBadge";
import { useRustleSound } from "./useRustleSound";
import styles from "./EditorToolbar.module.css";

export interface EditorToolbarProps {
  editorTab: EditorTab;
  onEditorTabChange: (tab: EditorTab) => void;
  viewMode: "plan" | "3d";
  onViewModeChange: (mode: "plan" | "3d") => void;
  viewModeDisabled: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/**
 * Sits directly above the Wall/Foundation/Floor/Roof editor region (Tommy:
 * "the editor should have a menu bar along the top of it and be able to
 * snap to full screen mode"). Left: the tab dial. Center: big 2D/3D
 * buttons — the 3D one gets an extruded look (layered shadow) so it reads
 * as more three-dimensional next to the flat 2D button — plus a small
 * decorative straw bale that wiggles with a rustle sound + flying wisps on
 * every 2D/3D toggle (Tommy: "a brushling bush sound when you toggle 2d to
 * three d and back, and wiggle the straw bale"). Right: fullscreen toggle.
 */
export default function EditorToolbar({
  editorTab,
  onEditorTabChange,
  viewMode,
  onViewModeChange,
  viewModeDisabled,
  isFullscreen,
  onToggleFullscreen,
}: EditorToolbarProps) {
  const playRustle = useRustleSound();
  const [isBadgeAnimating, setIsBadgeAnimating] = useState(false);

  const handleViewModeChange = (mode: "plan" | "3d") => {
    if (mode !== viewMode) {
      playRustle();
      setIsBadgeAnimating(true);
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
        <StrawWiggleBadge isAnimating={isBadgeAnimating} onAnimationEnd={() => setIsBadgeAnimating(false)} />
      </div>

      <button
        type="button"
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen editor"}
        className={styles.fullscreenButton}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? "⤡ Exit Fullscreen" : "⤢ Fullscreen"}
      </button>
    </div>
  );
}
