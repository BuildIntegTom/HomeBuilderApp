import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Plywood jack stud ("jack sheet") — Tommy: "3/4in of plywood that is the
 * panel depth wide and appears on each side of the rough opening under
 * headers... screwed to the adjacent wall using 2 4in T25 #9 screws every
 * 6in." One flat vertical sheet, panel-depth wide, spanning the rough
 * opening's height (bottom plate to underside of header) — a plywood
 * substitute for a dimensional-lumber jack stud. A door/window opening
 * gets 2 of these (one each side); this builds a single one.
 */
export const JACK_STUD_THICKNESS_IN = 0.75;

export function buildJackStudMembers(depthIn: number, heightIn: number): PanelMember[] {
  return [
    {
      memberId: "jack_stud_sheet",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: JACK_STUD_THICKNESS_IN, widthIn: depthIn, lengthIn: heightIn },
      orientation: "vertical",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "jack_stud",
      qty: 1,
      notes:
        "One of a pair (one each side of the rough opening) — screwed to the adjacent wall panel with 2x 4in " +
        "T25 #9 screws every 6in.",
    },
  ];
}

/**
 * Wraps `buildJackStudMembers` in the full shared component schema — see
 * `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildJackStudSchema(depthIn: number, heightIn: number): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "jack_stud",
    displayName: "Plywood Jack Stud",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn, widthIn: JACK_STUD_THICKNESS_IN, depthIn },
    members: buildJackStudMembers(depthIn, heightIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Height shown is an illustrative default (current wall height), not a real rough-opening height — " +
          "headers/sills don't have their own tracked height or placement mechanism yet.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
