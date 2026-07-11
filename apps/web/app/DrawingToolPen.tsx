"use client";

import styles from "./DrawingToolPen.module.css";

export type ShapeTool = "rectangle" | "octagon" | "bump-out" | "drag-wall" | "edit";

export interface DrawingToolPenProps {
  value: ShapeTool;
  onChange: (tool: ShapeTool) => void;
  bumpOutDisabled: boolean;
  dragWallDisabled: boolean;
  editDisabled: boolean;
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
 * all") — no container shape, just the buttons themselves. */
export default function DrawingToolPen({ value, onChange, bumpOutDisabled, dragWallDisabled, editDisabled }: DrawingToolPenProps) {
  const disabledFor: Record<string, boolean> = {
    bumpOutDisabled,
    dragWallDisabled,
    editDisabled,
  };

  return (
    <div className={styles.buttons} role="group" aria-label="Shape tool">
      {TOOLS.map((tool) => (
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
      ))}
    </div>
  );
}
