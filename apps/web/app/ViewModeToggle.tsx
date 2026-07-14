"use client";

import { useRustleSound } from "./useRustleSound";
import styles from "./EditorToolbar.module.css";

export type ViewerState = "plan" | "3d-framed" | "3d-boxes";

export interface ViewModeToggleProps {
  viewMode: "plan" | "3d";
  simplified3D: boolean;
  onChange: (viewMode: "plan" | "3d", simplified3D: boolean) => void;
  viewModeDisabled: boolean;
}

const CYCLE: ViewerState[] = ["plan", "3d-framed", "3d-boxes"];

function toViewerState(viewMode: "plan" | "3d", simplified3D: boolean): ViewerState {
  if (viewMode === "plan") return "plan";
  return simplified3D ? "3d-boxes" : "3d-framed";
}

const LABELS: Record<ViewerState, string> = {
  plan: "Viewer: 2D",
  "3d-framed": "Viewer: 3D Framed",
  "3d-boxes": "Viewer: 3D Boxes",
};

const TITLES: Record<ViewerState, string> = {
  plan: "2D floor-plan view — click for the 3D Framed view",
  "3d-framed": "3D building preview, full member-by-member geometry — click for 3D Boxes (simplified)",
  "3d-boxes": "3D building preview, simplified flat-colored panel boxes — click to return to 2D",
};

/**
 * One cycling button (Tommy: "incorporate the functions of the simplified
 * 3D button AND 2D buttons into the 3D button") — 2D -> 3D Framed (full
 * member-by-member geometry) -> 3D Boxes (simplified flat-colored panel
 * boxes, formerly its own "Simplified 3D" toggle) -> back to 2D. Both 3D
 * states keep the extruded "block of shadows" look (Tommy: "the 3D one some
 * how looking more three dimentional than the 2d graphic"), with 3D Boxes
 * rendered a lighter blue (Tommy: "make the 3D Boxes button turn lighter
 * blue but still 3D when its selected") so the two 3D states stay visually
 * distinct without losing the shared 3D styling. Rustle sound plays on
 * every step of the cycle, same as the old 2-button toggle.
 */
export default function ViewModeToggle({ viewMode, simplified3D, onChange, viewModeDisabled }: ViewModeToggleProps) {
  const playRustle = useRustleSound();
  const state = toViewerState(viewMode, simplified3D);

  const handleClick = () => {
    const nextState = CYCLE[(CYCLE.indexOf(state) + 1) % CYCLE.length]!;
    playRustle();
    onChange(nextState === "plan" ? "plan" : "3d", nextState === "3d-boxes");
  };

  return (
    <button
      type="button"
      title={TITLES[state]}
      aria-label="View mode"
      className={styles.viewerButton}
      data-state={state}
      disabled={viewModeDisabled && state === "plan"}
      onClick={handleClick}
    >
      {LABELS[state]}
    </button>
  );
}
