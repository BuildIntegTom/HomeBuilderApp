import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN, SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Jack stud construction (Tommy: "RO's depend on jack studs, which i want
 * to be able to change from a default of 3/4in plywood to vertical 2x4's
 * right next to the adjacent wall's studs on the perimeter of the
 * slot"): "plywood" is the original "jack sheet" (one flat sheet, panel-
 * depth wide); "2x4-stud" is a real stud pair (ext + int wythe, same Y
 * convention as `buildCornerStuds`) instead of a single sheet — a rough
 * opening framed this way needs backing at BOTH wythes, not one
 * continuous sheet spanning the depth.
 */
export type JackStudConfig = "plywood" | "2x4-stud";

export const JACK_STUD_THICKNESS_IN = 0.75;

/** In-plane (along-the-slot) thickness one jack stud eats into the slot's
 * own width — 0.75in for the plywood sheet, 1.5in (a 2x4's thickness) for
 * the stud pair. Used by `computeRoughOpeningWidthIn` below. */
export function jackStudThicknessIn(config: JackStudConfig): number {
  return config === "plywood" ? JACK_STUD_THICKNESS_IN : PLATE_2X4_THICKNESS_IN;
}

/**
 * The actual clear Rough Opening width (Tommy: "RO's take into account
 * these jack studs") — a window/door slot's own widthIn represents the
 * WHOLE assembly's footprint (header + jack studs + RO + sill), per
 * Tommy: "make sure... the window slot... represents the entire primary
 * space which the headers, RO, and sills are." The header spans that
 * full slot width (it rests on top of both jack studs), but the RO itself
 * — and the sill panel(s) that share its run — is narrower by one jack
 * stud's thickness on each side.
 */
export function computeRoughOpeningWidthIn(slotWidthIn: number, config: JackStudConfig): number {
  return Math.max(0, slotWidthIn - 2 * jackStudThicknessIn(config));
}

/**
 * The real, built door Rough Opening height (Tommy: "RO height for doors
 * is almost always 80.5in — the actual number is derived from door RO
 * selected (default 82.5) − toe up height (usually 1.5in)") — the
 * selected door unit's own spec height, minus the toe-up member it sits
 * on top of. Also the door jack stud's own height (Tommy: jack studs "go
 * from the sill to the header" — a door has no sill, so its jack studs
 * span this full RO height instead, floor to header-bottom).
 */
export function computeDoorRoughOpeningHeightIn(selectedDoorRoHeightIn: number, toeUpHeightIn: number): number {
  return Math.max(0, selectedDoorRoHeightIn - toeUpHeightIn);
}

/** Jack stud material `qty: 1` here is one side's jack stud (matching the
 * pre-existing "one of a pair" note) — a real opening always needs 2 (one
 * each side of the rough opening), doubled by whatever's counting them. */
function buildPlywoodJackStud(depthIn: number, heightIn: number): PanelMember[] {
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

function build2x4JackStuds(depthIn: number, heightIn: number): PanelMember[] {
  return (["ext", "int"] as const).map((wythe) => ({
    memberId: `jack_stud_2x4_${wythe}`,
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: heightIn },
    orientation: "vertical",
    position: { xIn: 0, yIn: wythe === "ext" ? 0 : depthIn - PLATE_2X4_WIDTH_IN, zIn: 0, rotationDeg: 0 },
    role: "jack_stud",
    qty: 1,
    notes:
      `${wythe}-wythe jack stud, one side of a pair (one each side of the rough opening) — positioned flush ` +
      "with the adjacent wall panel's own corner/standard stud, right at the slot's perimeter.",
  }));
}

/**
 * `heightIn` is the real jack-stud span (Tommy: jack studs "go from the
 * sill to the header") — sill-top to header-bottom, not the whole wall
 * height (that illustrative-default gap is now the caller's, same as
 * every other header/sill/jack-stud component with no rough-opening-
 * placement mechanism yet).
 */
export function buildJackStudMembers(depthIn: number, heightIn: number, config: JackStudConfig = "plywood"): PanelMember[] {
  return config === "plywood" ? buildPlywoodJackStud(depthIn, heightIn) : build2x4JackStuds(depthIn, heightIn);
}

/**
 * Wraps `buildJackStudMembers` in the full shared component schema — see
 * `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildJackStudSchema(depthIn: number, heightIn: number, config: JackStudConfig = "plywood"): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "jack_stud",
    displayName: "Jack Stud",
    status: "draft",
    derivedFrom: null,
    // Both configs are described as spanning the panel's full depth
    // overall (the 2x4 pair's 2 discrete members bookend that same span,
    // even though there's a real gap between them) — consistent with the
    // "not to exact scale" 3D-preview convention this schema shares with
    // every other draft component.
    overallDimensions: { heightIn, widthIn: config === "plywood" ? JACK_STUD_THICKNESS_IN : PLATE_2X4_THICKNESS_IN, depthIn },
    members: buildJackStudMembers(depthIn, heightIn, config),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Height shown is the rough-opening-to-header span passed in by the caller — headers/sills/jack studs " +
          "don't have their own tracked placement mechanism yet, so a real design's actual sill-top-to-header-" +
          "bottom height isn't independently confirmed here." +
          (config === "2x4-stud"
            ? " The 2 studs (ext/int wythe) are shown at their real positions but not connected by any modeled blocking between them."
            : ""),
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
