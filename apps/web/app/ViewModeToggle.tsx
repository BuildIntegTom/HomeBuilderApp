"use client";

import { useRustleSound } from "./useRustleSound";
import styles from "./EditorToolbar.module.css";

export interface ViewModeToggleProps {
  viewMode: "plan" | "3d";
  onViewModeChange: (mode: "plan" | "3d") => void;
  viewModeDisabled: boolean;
}

/**
 * Big 2D/3D buttons — Tommy: "lets put the layout editor scrollwheel and 2d
 * 3d buttons at the top of the tool bar," alongside the compass/zoom/pan
 * controls in page.tsx's top row, rather than below the Wall/Foundation/
 * Floor/Roof tab dial (see EditorToolbar.tsx, which now holds only the
 * dial). The 3D one keeps its extruded look (layered shadow) so it reads as
 * more three-dimensional next to the flat 2D button, plus the synthesized
 * rustle sound on every toggle (Tommy: "a brushling bush sound when you
 * toggle 2d to three d and back").
 */
export default function ViewModeToggle({ viewMode, onViewModeChange, viewModeDisabled }: ViewModeToggleProps) {
  const playRustle = useRustleSound();

  const handleViewModeChange = (mode: "plan" | "3d") => {
    if (mode !== viewMode) {
      playRustle();
    }
    onViewModeChange(mode);
  };

  return (
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
  );
}
