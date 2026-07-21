"use client";

import { panelHeightInRange } from "@building-integrity/panel-catalog";
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
  /** Plan View "height-slice lens" (Tommy: "the 2d viewer is basically a
   * lens of which height slice you are at") — which story the 2D Plan View
   * currently shows/edits, and every real story to choose from. Only
   * rendered as a toggle when there's more than one (nothing to switch
   * between otherwise). */
  stories: { id: "ground" | "second"; label: string }[];
  viewedStoryId: "ground" | "second";
  onChangeViewedStoryId: (id: "ground" | "second") => void;
}

const TOOLS: { id: ShapeTool; label: string; short: string; disabledKey?: "bumpOutDisabled" | "dragWallDisabled" | "editDisabled" }[] = [
  { id: "rectangle", label: "Rectangle", short: "▭" },
  { id: "octagon", label: "Octagon", short: "⯃" },
  { id: "bump-out", label: "Add Bump-out", short: "+", disabledKey: "bumpOutDisabled" },
  { id: "drag-wall", label: "Drag Wall", short: "↔", disabledKey: "dragWallDisabled" },
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
  stories,
  viewedStoryId,
  onChangeViewedStoryId,
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
        title="Stacks a second, independently-editable story at the ground floor's own top-plate height — give it its own windows/doors/panel layout via this Plan View's own Ground/Second Story toggle below, the elevation view, or the 3D Edit tool. Note: editing the footprint itself (wall length, bump-out, drag-wall) always applies to the ground floor only — the second story doesn't resync from those edits yet."
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
            min={panelHeightInRange.minIn / 12}
            max={panelHeightInRange.maxIn / 12}
            style={{ width: 56 }}
            onChange={(e) => onSecondStoryWallHeightChange(Number(e.target.value))}
          />
        </label>
      )}
      {stories.length > 1 && (
        <div role="group" aria-label="Viewed story" style={{ display: "flex", gap: 2 }}>
          {stories.map((story) => (
            <button
              key={story.id}
              type="button"
              title={`Show and edit ${story.label}'s own panels in this Plan View`}
              aria-pressed={viewedStoryId === story.id}
              className={viewedStoryId === story.id ? styles.toolActive : styles.tool}
              onClick={() => onChangeViewedStoryId(story.id)}
            >
              <span className={styles.toolLabel}>{story.label}</span>
            </button>
          ))}
        </div>
      )}
      {TOOLS.slice(2).map(renderTool)}
    </div>
  );
}
