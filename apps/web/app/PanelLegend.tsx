"use client";

import { PANEL_LEGEND_ORDER, PANEL_TYPE_COLORS, PANEL_TYPE_LABELS } from "./panelColors";
import styles from "./PanelLegend.module.css";

/**
 * Formalized panel-color legend (Tommy: "formalize the wall tools section
 * into a legend bar that is below the viewing and editor bars. i want each
 * of the colors of panel types clearly noted what they mean instead of all
 * word[s]") — a color swatch next to each panel type's label, replacing the
 * old "Gray = corner, dark brown = safety-oct-corner..." plain-text
 * sentence that used to live inside the Wall Tools note. Colors come from
 * `panelColors.ts`, the same source FootprintCanvas and Building3DView's
 * safety-gap accent use, so this never drifts from what's actually drawn.
 */
export interface PanelLegendProps {
  /** "sidebar" (default): opaque instrument-panel block, unchanged — used
   * by Plan View's own sidebar. "overlay": translucent floating treatment
   * for the Elevation view's canvas overlay (see page.tsx's .legendDock) —
   * positioning itself is the caller's job, this only changes the card's
   * own background/blur. */
  variant?: "sidebar" | "overlay";
}

export default function PanelLegend({ variant = "sidebar" }: PanelLegendProps) {
  return (
    <div
      className={`${styles.legend}${variant === "overlay" ? ` ${styles.legendOverlay}` : ""}`}
      role="group"
      aria-label="Panel type color legend"
    >
      {PANEL_LEGEND_ORDER.map((type) => (
        <div key={type} className={styles.row}>
          <span className={styles.swatch} style={{ background: PANEL_TYPE_COLORS[type] }} aria-hidden="true" />
          <span className={styles.label}>{PANEL_TYPE_LABELS[type]}</span>
        </div>
      ))}
    </div>
  );
}
