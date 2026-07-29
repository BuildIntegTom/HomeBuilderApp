import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { SKIN_PLY_SPEC, SKIN_THICKNESS_IN, tiltedMember } from "./panelMemberHelpers";

/**
 * Vertical safety-gap filler (Tommy: "an ability to put a safety gap
 * inbetween the truss bottom and the gable end top") — the real remainder
 * between a capped Gable End Panel's own (now always FLAT) top and the true
 * roofline, filled by a real piece instead of the panel being silently
 * clamped short. Unlike buildSafetyGapMembers (a thin VERTICAL sliver sized
 * for a horizontal wall gap), this sits above the gable row, spanning the
 * gable tile's own full width — a different orientation entirely, not a
 * reuse of that builder.
 *
 * `leftHeightIn`/`rightHeightIn` are this filler's own real height at local
 * x=0 and x=widthIn respectively — each independently the true roofline's
 * own remainder above the flat panel top at that edge (see
 * `capGableTileHeights` in apps/web/app/gableProfilePoints.ts, the shared
 * function that derives these) — either can be 0 (the common case: a tile
 * straddling the fabrication cap flattens to its own shorter true edge, so
 * that side needs no filler at all, while the other side gets the full
 * difference). Built as ONE sloped plywood sheet — reusing `tiltedMember`,
 * the same helper the Gable End Panel's own top skin uses — so its bottom
 * sits flush with the flat panel top below it (both are laid at the
 * caller's own Z origin) and its top lands exactly on the true roofline on
 * both edges, never a uniform flat box that either floats disconnected
 * above the panel or overshoots past the real roof (both of which a single
 * flat rectangle sized by the taller edge's overflow used to do whenever
 * the 2 edges' real remainders differed, which is the normal case).
 */
export function buildVerticalGapFillerMembers(widthIn: number, depthIn: number, leftHeightIn: number, rightHeightIn: number): PanelMember[] {
  return [
    tiltedMember(
      "vertical_gap_filler_sheet",
      "plywood",
      SKIN_PLY_SPEC,
      null,
      SKIN_THICKNESS_IN,
      depthIn,
      0,
      leftHeightIn - SKIN_THICKNESS_IN / 2,
      widthIn,
      rightHeightIn - SKIN_THICKNESS_IN / 2,
      depthIn / 2,
      "skin",
      "Sloped filler between a capped Gable End Panel's own flat top and the true roofline — rip parallel to the true roofline, flush with the flat panel top below.",
    ),
  ];
}

/**
 * Wraps `buildVerticalGapFillerMembers` in the full shared component schema
 * — see `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildVerticalGapFillerSchema(widthIn: number, depthIn: number, leftHeightIn: number, rightHeightIn: number): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "vertical_gap_filler",
    displayName: "Vertical Safety-Gap Filler",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: Math.max(leftHeightIn, rightHeightIn), widthIn, depthIn },
    members: buildVerticalGapFillerMembers(widthIn, depthIn, leftHeightIn, rightHeightIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Sloped single-sheet filler, parallel to the true roofline — fills the real remainder above a capped (flat-topped) Gable End Panel up to the true roofline.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
