import type { PanelSlot } from "@building-integrity/geometry";
import type { NamedPanelType } from "./panelInstances";

/** Shared 2D-canvas/legend/3D-accent color per panel type — single source
 * of truth so FootprintCanvas, PanelLegend, and Building3DView's safety-gap
 * accent (see Building3DView.tsx) never drift apart. */
export const PANEL_TYPE_COLORS: Record<PanelSlot["type"], string> = {
  corner: "#8a8a8a",
  "safety-oct-corner": "#5c4a2e",
  standard: "#d9c9a3",
  braced: "#b06fc9",
  "safety-gap": "#e08a3c",
  window: "#8fc7e8",
  door: "#7a4a2b",
  column: "#4a90a4",
};

export const PANEL_TYPE_LABELS: Record<PanelSlot["type"], string> = {
  standard: "Standard",
  corner: "Corner",
  "safety-oct-corner": "Safety-Oct-Corner",
  braced: "Braced",
  "safety-gap": "Safety/Gap",
  column: "Column",
  window: "Window",
  door: "Door",
};

// Tommy: "lets make safety gaps the second to last label slot - right
// before the corner piece" — corner moved to last, safety-gap right before it.
export const PANEL_LEGEND_ORDER: PanelSlot["type"][] = [
  "standard",
  "safety-oct-corner",
  "braced",
  "column",
  "window",
  "door",
  "safety-gap",
  "corner",
];

/** Same color per named panel type (see panelInstances.ts) as
 * PANEL_TYPE_COLORS where the two share a name — header/sill get their own
 * colors here since they're not real `PanelSlot["type"]` values (they're
 * derived from a window/door slot, not their own slot type). Used by
 * TruckLoad3DView.tsx's simplified shipping-stack boxes. */
export const NAMED_PANEL_TYPE_COLORS: Record<NamedPanelType, string> = {
  standard: PANEL_TYPE_COLORS.standard,
  corner: PANEL_TYPE_COLORS.corner,
  "safety-oct-corner": PANEL_TYPE_COLORS["safety-oct-corner"],
  braced: PANEL_TYPE_COLORS.braced,
  "safety-gap": PANEL_TYPE_COLORS["safety-gap"],
  column: PANEL_TYPE_COLORS.column,
  header: "#c9a63f",
  sill: "#6fa87a",
  gable: "#9fb8e0",
  "jack-stud": "#8f6b4a",
};
