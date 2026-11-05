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
  // Tommy: "a unique color maybe pink for 2d box views" — distinct from
  // every other panel-type color already in use.
  "big-header": "#e85d9c",
  /* ⚠ A framed VOID, not a panel. Deliberately the palest thing on the
     drawing — it must read as "nothing is here" at a glance, and must not be
     mistaken for a Standard panel's own warm tan. See `PanelSlotType`'s own
     doc comment for why the slot exists at all. */
  open: "#eceae6",
};

/**
 * ⚠ **The deck panels' own two colours — his, 2026-11-04.**
 *
 * > *"Floors should be dark grey and roofs light brown."*
 *
 * Floor and roof panels are the two panel types the 2D plan has never drawn,
 * so they had no colour and their fabrication sheets carried no band. B25
 * refused to invent one; this is the answer. Kept in a separate map because
 * they are not `PanelSlot["type"]` values and never will be — they are not
 * placed in the wall layout system at all.
 *
 * Both are checked the way every other sheet colour is (see
 * `panelSheetIdentity.test.ts`): tinted towards white they hold black text at
 * better than 7:1 and stay light in greyscale, which is how these sheets
 * print.
 */
export const DECK_PANEL_COLORS: Record<"floor" | "roof", string> = {
  floor: "#4f4f4f",
  roof: "#b98b5e",
};

/**
 * ⚠ **The two assemblies' colours — his, 2026-11-05:** *"Box beam green and
 * truss plate blue."* The last two fabrication sheets without a band. Kept
 * apart from the panel maps above because these are not panels: they are
 * beams that run along the top of a wall, and nothing tiles them.
 */
export const ASSEMBLY_COLORS: Record<"truss-plate" | "box-beam", string> = {
  "truss-plate": "#4a7fb5",
  "box-beam": "#4f9456",
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
  "big-header": "Big Header",
  open: "Open (no panel)",
};

// Tommy: "lets make safety gaps the second to last label slot - right
// before the corner piece" — corner moved to last, safety-gap right before it.
export const PANEL_LEGEND_ORDER: PanelSlot["type"][] = [
  "standard",
  "safety-oct-corner",
  "braced",
  "column",
  "big-header",
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
  "big-header": PANEL_TYPE_COLORS["big-header"],
  header: "#c9a63f",
  sill: "#6fa87a",
  gable: "#9fb8e0",
  "jack-stud": "#8f6b4a",
};
