import type { PanelComponentSchema } from "./componentSchema";
import { COLUMN_TOTAL_WIDTH_IN, buildColumnPanelMembers } from "./columnPanelMembers";

/**
 * A Corner Panel is built exactly like a Column Panel (Tommy: "corner
 * panels are just like this too actually, so let's copy everything over
 * for them too") — same 24in core + 3/4in plywood on both sides + 16in
 * blocking, same 25.5in overall width. Re-exported under its own name
 * rather than aliased directly so callers/detail pages read "corner", not
 * "column", and so the two can diverge later without a breaking rename.
 */
export const buildCornerPanelMembers = buildColumnPanelMembers;

export function buildCornerPanelSchema(depthIn: number, heightIn: number, includeNailer: boolean): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "corner_panel",
    displayName: "Corner Panel",
    status: "draft",
    derivedFrom: "column_panel",
    overallDimensions: { heightIn, widthIn: COLUMN_TOTAL_WIDTH_IN, depthIn },
    members: buildCornerPanelMembers(depthIn, heightIn, includeNailer),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Identical construction to the Column Panel (Tommy) — blocking row count/spacing and in-plane X position are interpretations, not independently confirmed against a shop drawing.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
