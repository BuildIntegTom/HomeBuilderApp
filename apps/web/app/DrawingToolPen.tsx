"use client";

import styles from "./DrawingToolPen.module.css";

export type ShapeTool = "rectangle" | "octagon" | "bump-out" | "drag-wall" | "edit";

export interface DrawingToolPenProps {
  value: ShapeTool;
  onChange: (tool: ShapeTool) => void;
  bumpOutDisabled: boolean;
  dragWallDisabled: boolean;
  editDisabled: boolean;
  secondStoryEnabled: boolean;
  onToggleSecondStory: () => void;
  secondStoryDisabled: boolean;
  secondStoryWallHeightFt: number;
  onSecondStoryWallHeightChange: (heightFt: number) => void;
}

const TOOLS: { id: ShapeTool; label: string; short: string; disabledKey?: "bumpOutDisabled" | "dragWallDisabled" | "editDisabled" }[] = [
  { id: "rectangle", label: "Rectangle", short: "▭" },
  { id: "octagon", label: "Octagon", short: "⯃" },
  { id: "bump-out", label: "Add Bump-out", short: "+", disabledKey: "bumpOutDisabled" },
  { id: "drag-wall", label: "Drag Wall", short: "↔" },
  { id: "edit", label: "Edit", short: "✎" },
];

/** The 5 shape-drawing tools, as a plain floating button row (Tommy: "lets
 * loose the pen outline for the drawing tools - no outline shape here at
 * all") — no container shape, just the buttons themselves. "Add Second
 * Story" (Tommy: "should be a button below octagon and have all that text
 * as a hover option") sits between Octagon and Add Bump-out — its own
 * concern (stacking a 2nd story), not a `ShapeTool` value, so it's a
 * separate toggle button rather than a 6th entry in `TOOLS`. */
export default function DrawingToolPen({
  value,
  onChange,
  bumpOutDisabled,
  dragWallDisabled,
  editDisabled,
  secondStoryEnabled,
  onToggleSecondStory,
  secondStoryDisabled,
  secondStoryWallHeightFt,
  onSecondStoryWallHeightChange,
}: DrawingToolPenProps) {
  const disabledFor: Record<string, boolean> = {
    bumpOutDisabled,
    dragWallDisabled,
    editDisabled,
  };

  const renderTool = (tool: (typeof TOOLS)[number]) => (
    <button
      key={tool.id}
      type="button"
      title={tool.label}
      aria-pressed={value === tool.id}
      disabled={tool.disabledKey ? disabledFor[tool.disabledKey] : false}
      className={value === tool.id ? styles.toolActive : styles.tool}
      onClick={() => onChange(tool.id)}
    >
      <span className={styles.toolIcon} aria-hidden="true">
        {tool.short}
      </span>
      <span className={styles.toolLabel}>{tool.label}</span>
    </button>
  );

  return (
    <div className={styles.buttons} role="group" aria-label="Shape tool">
      {TOOLS.slice(0, 2).map(renderTool)}
      <button
        type="button"
        title="Shares the ground floor's footprint and panel layout for now (a fully independent second-story footprint/opening editor isn't wired up yet) — stacked at the ground floor's own top-plate height in 3D Preview and the whole-building OBJ export."
        aria-pressed={secondStoryEnabled}
        disabled={secondStoryDisabled}
        className={secondStoryEnabled ? styles.toolActive : styles.tool}
        onClick={onToggleSecondStory}
      >
        <span className={styles.toolIcon} aria-hidden="true">
          2
        </span>
        <span className={styles.toolLabel}>Add Second Story</span>
      </button>
      {secondStoryEnabled && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "0 4px" }}>
          Wall height (ft)
          <input
            type="number"
            value={secondStoryWallHeightFt}
            step={0.5}
            min={1}
            style={{ width: 56 }}
            onChange={(e) => onSecondStoryWallHeightChange(Number(e.target.value))}
          />
        </label>
      )}
      {TOOLS.slice(2).map(renderTool)}
    </div>
  );
}
