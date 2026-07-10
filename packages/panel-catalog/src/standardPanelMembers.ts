import { standardPanelBomReferenceWidthIn } from "./data";
import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { SKIN_THICKNESS_IN, buildCornerStuds, buildGirtRows, buildNailer, buildPlates, buildSkins } from "./panelMemberHelpers";

const STANDARD_GIRT_ROW_COUNT = 2;

/**
 * Every physical member of a Standard Panel, positioned in world space —
 * X = along the panel's width, Y = along the panel's depth (thickness),
 * Z = up from the panel's bottom face, each member's `position` is its
 * own min-corner. Parametric in widthIn/depthIn/heightIn so it stays
 * exact at whatever standard width/thickness/wall height is currently
 * selected, not just Panel Set 1's 48in x 15.5in x 120in reference BOM:
 * cross-section dimensions (2x4 actual size, skin/girt-web thickness) are
 * fixed regardless of panel size, but every LENGTH that scales with
 * width/height is derived here, not copied from the reference BOM's
 * fixed numbers.
 *
 * Skins, plate 2x4s, 4 corner studs, and the optional nailer are shared
 * with the Braced Panel (see `buildBracedPanelMembers` in
 * `bracedPanelMembers.ts`) via `panelMemberHelpers.ts` — a Standard Panel
 * differs only in using 2 girt rows (see `buildGirtRows`'s doc comment)
 * instead of 3+.
 */
export function buildStandardPanelMembers(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const members: PanelMember[] = [
    ...buildSkins(widthIn, depthIn, heightIn),
    ...buildPlates(widthIn, depthIn, heightIn),
    ...buildCornerStuds(widthIn, depthIn, heightIn),
    ...buildGirtRows(STANDARD_GIRT_ROW_COUNT, widthIn, depthIn, studSpanIn),
  ];
  if (includeNailer) members.push(buildNailer(widthIn, heightIn));
  return members;
}

/**
 * Wraps `buildStandardPanelMembers` in the full shared component schema
 * (Tommy's `panel_schema_draft.md`) — the shape a future SketchUp exporter
 * would read `members` from directly. `status: "draft"` (not "locked")
 * since the girt/nailer in-plane placement above is an interpretation,
 * not an independently confirmed position.
 */
export function buildStandardPanelSchema(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "standard_panel",
    displayName: "Standard Panel",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildStandardPanelMembers(widthIn, depthIn, heightIn, includeNailer),
    fasteners: [],
    notes:
      widthIn !== standardPanelBomReferenceWidthIn
        ? [
            {
              type: "deviation",
              text: `Reference BOM (Panel Set 1) was confirmed at ${standardPanelBomReferenceWidthIn}in wide; lengths here are scaled to the selected ${widthIn}in width, cross-sections unchanged.`,
            },
          ]
        : [],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
