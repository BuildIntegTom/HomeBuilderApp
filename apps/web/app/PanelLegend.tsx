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
export default function PanelLegend() {
  return (
    <div className={styles.legend} role="group" aria-label="Panel type color legend">
      {PANEL_LEGEND_ORDER.map((type) => (
        <div key={type} className={styles.row}>
          <span className={styles.swatch} style={{ background: PANEL_TYPE_COLORS[type] }} aria-hidden="true" />
          <span className={styles.label}>{PANEL_TYPE_LABELS[type]}</span>
        </div>
      ))}
    </div>
  );
}
