import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { buildStandardPanelMembers } from "./standardPanelMembers";

/**
 * A Sill Panel is just a short Standard Panel (Tommy: "sills are short
 * standard panels") — same construction (skins, plates, 4 corner studs,
 * 2 girt rows, optional nailer), just at the sill's own (default 32in,
 * see `sillDefaultHeightIn`) height instead of the full wall height.
 */
export function buildSillPanelMembers(widthIn: number, depthIn: number, heightIn: number, includeNailer: boolean): PanelMember[] {
  return buildStandardPanelMembers(widthIn, depthIn, heightIn, includeNailer);
}

/**
 * Wraps `buildSillPanelMembers` in the full shared component schema — see
 * `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildSillPanelSchema(widthIn: number, depthIn: number, heightIn: number, includeNailer: boolean): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "sill_panel",
    displayName: "Sill Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildSillPanelMembers(widthIn, depthIn, heightIn, includeNailer),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Identical construction to a Standard Panel, just shorter (Tommy: \"sills are short standard panels\") " +
          "— the same simplifications/interpretations noted on the Standard Panel's own schema apply here too. " +
          "A window wider than one standard panel's width gets multiple sill panels sharing the run (see " +
          "computeSillRunWidths in packages/geometry), not one oversized sill.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
