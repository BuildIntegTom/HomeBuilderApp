import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Safety/Gap panel (Tommy: "get rid of safety panels and instead create a
 * safety gap... instead of a safety panel being a standard panel slightly
 * altered, its actually just a 3/4in piece of plywood that is the panel
 * thickness and panel height") — no studs, plates, or girts at all: just
 * one 3/4in plywood sheet, spanning the wall's full thickness (depth) and
 * full height. The slot's own widthIn (used for tiling/placement — see
 * bracedPlacement.ts/retile.ts) is unaffected by this — it's still how
 * much wall-run space the gap reserves, independent of the single fixed-
 * size plywood piece actually built into it.
 */
export const SAFETY_GAP_THICKNESS_IN = 0.75;

export function buildSafetyGapMembers(depthIn: number, heightIn: number): PanelMember[] {
  return [
    {
      memberId: "safety_gap_sheet",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SAFETY_GAP_THICKNESS_IN, widthIn: depthIn, lengthIn: heightIn },
      orientation: "vertical",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: "Dimensional-tolerance buffer — no framing, just this one plywood sheet.",
    },
  ];
}

/**
 * Wraps `buildSafetyGapMembers` in the full shared component schema — see
 * `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildSafetyGapSchema(depthIn: number, heightIn: number): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "safety_gap",
    displayName: "Safety / Gap Panel",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn, widthIn: SAFETY_GAP_THICKNESS_IN, depthIn },
    members: buildSafetyGapMembers(depthIn, heightIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "No longer modeled as an altered Standard Panel — just this one plywood sheet, held to whatever width the wall run's tiling reserves for it.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
