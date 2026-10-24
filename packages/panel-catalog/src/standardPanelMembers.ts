import { standardPanelBomReferenceWidthIn, standardPanelHeightIn } from "./data";
import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { SKIN_THICKNESS_IN, buildCentreNailerStuds, buildCornerStuds, buildGirtRows, buildNailer, buildPlates, buildSkins } from "./panelMemberHelpers";

const STANDARD_GIRT_ROW_COUNT = 2;

/** How many girt rows past-height's short spot needs (Tommy: "sill panels
 * (or any short variety of standard panel) only needs to spawn 1 girt if
 * it is more than 36", 2 girts if the total height is more than 72
 * inches, etc") — a girt every 36in, starting past 36in. At/above the
 * confirmed Panel Set 1 standard height (`standardPanelHeightIn`) this
 * stays at the fixed, already-confirmed `STANDARD_GIRT_ROW_COUNT` (2)
 * instead — this rule is specifically for panels SHORTER than that (sills,
 * or any other custom short standard panel), not a replacement for the
 * confirmed full-height spec.
 */
export function computeStandardGirtRowCount(heightIn: number): number {
  if (heightIn >= standardPanelHeightIn.value) return STANDARD_GIRT_ROW_COUNT;
  return Math.max(0, Math.ceil(heightIn / 36) - 1);
}

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
 * differs only in its girt row count (see `computeStandardGirtRowCount`
 * and `buildGirtRows`'s doc comment) instead of 3+.
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
    ...buildCentreNailerStuds(widthIn, depthIn, heightIn),
    ...buildGirtRows(computeStandardGirtRowCount(heightIn), widthIn, depthIn, studSpanIn),
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
