import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Vertical safety-gap filler (Tommy: "an ability to put a safety gap
 * inbetween the truss bottom and the gable end top") — the real remainder
 * between a capped Gable End Panel's own top (see GABLE_PANEL_MAX_HEIGHT_IN /
 * maxGablePanelHeightIn) and the true roofline, filled by a real piece
 * instead of the panel being silently clamped short. Unlike
 * buildSafetyGapMembers (a thin VERTICAL sliver sized for a horizontal wall
 * gap), this sits flat/horizontal, spanning the gable tile's own full width
 * — a different orientation entirely, not a reuse of that builder. Modeled
 * as one flat rectangular plywood filler (not a precisely sloped piece) —
 * the same "angle-cut simplified to a plain box" convention already used
 * elsewhere in gable geometry (see buildGableCornerStuds).
 */
export function buildVerticalGapFillerMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return [
    {
      memberId: "vertical_gap_filler_sheet",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: heightIn, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: "Flat rectangular filler between a capped Gable End Panel's own top and the true roofline — a simplification, not a precisely sloped piece.",
    },
  ];
}

/**
 * Wraps `buildVerticalGapFillerMembers` in the full shared component schema
 * — see `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildVerticalGapFillerSchema(widthIn: number, depthIn: number, heightIn: number): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "vertical_gap_filler",
    displayName: "Vertical Safety-Gap Filler",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildVerticalGapFillerMembers(widthIn, depthIn, heightIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Flat rectangular filler, not a precisely sloped piece — fills the real remainder above a capped Gable End Panel up to the true roofline.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
