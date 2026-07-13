import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
  TRUSS_WEB_MIN_ANGLE_DEG,
  buildTrussWebBraces,
  computeTrussWebAngleDeg,
  computeTrussWebPeakCount,
} from "./panelMemberHelpers";

// Tommy: "i believe the math with the triangle parts of the headers cannot
// go outside the range of 30-45 degrees" — TRUSS_WEB_MIN_ANGLE_DEG (30) is
// shared with the gable/braced-panel bracing; this is the header-specific
// upper bound, used only to flag (not force) an out-of-range result — a
// door's peak count is always exactly 1 regardless of the angle that
// produces, per Tommy's own spec, so it can't be corrected by adding peaks
// the way a window header's can.
const HEADER_MAX_ANGLE_DEG = 45;

/**
 * Top + bottom chord 2x4s, on both wythes (Tommy: "window and door headers
 * have the V framing on interior and exterior"), plus a plywood cap tying
 * each chord's 2 wythes into one rigid plate (Tommy: "we need to add the
 * plywood in the top and bottom plate") — the truss web braces (see
 * `buildTrussWebBraces`) bear against these plywood caps, not the raw 2x4
 * faces directly, same "lumber + plywood cap" convention as the truss
 * plate's own skin (see trussPlateMembers.ts). Otherwise no skins of its
 * own (like the Plywood Jack Stud, this is a sub-assembly that sits inside
 * a larger wall panel's own rough opening, not a free-standing panel).
 */
function buildHeaderChords(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const members: PanelMember[] = [];
  for (const [chord, zIn, otherChord] of [
    ["bottom", 0, "top"],
    ["top", heightIn - PLATE_2X4_THICKNESS_IN, "bottom"],
  ] as const) {
    for (const [wythe, yIn] of [
      ["ext", 0],
      ["int", depthIn - PLATE_2X4_WIDTH_IN],
    ] as const) {
      members.push({
        memberId: `${chord}_chord_2x4_${wythe}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: widthIn },
        orientation: "flat",
        position: { xIn: 0, yIn, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: `${chord} chord, ${wythe} wythe — the truss web braces span between this and the ${otherChord} chord.`,
      });
    }
  }

  const bottomPlyZIn = PLATE_2X4_THICKNESS_IN;
  const topPlyZIn = heightIn - PLATE_2X4_THICKNESS_IN - SKIN_THICKNESS_IN;
  for (const [chord, zIn] of [
    ["bottom", bottomPlyZIn],
    ["top", topPlyZIn],
  ] as const) {
    members.push({
      memberId: `${chord}_chord_ply`,
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: `${chord} plate plywood cap — ties both wythes' ${chord} chord 2x4s into one rigid plate; the truss web bears against this, not the bare 2x4 faces.`,
    });
  }
  return members;
}

/** The rise (in) available to the truss web between the chords' plywood-capped facing edges. */
export function headerWebRiseIn(heightIn: number): number {
  return heightIn - 2 * PLATE_2X4_THICKNESS_IN - 2 * SKIN_THICKNESS_IN;
}

/**
 * Shared construction behind both header variants (Tommy: "there are long
 * headers and door headers... door headers just have one upside down V as
 * a brace") — top/bottom chords plus a repeating W-truss web (see
 * `buildTrussWebBraces`) between them, on both wythes. A door header
 * always gets exactly 1 peak regardless of the resulting angle; a window
 * ("long") header gets as many peaks as `computeTrussWebPeakCount` says it
 * needs to keep every web segment at or above the 30deg minimum.
 */
function buildHeaderMembers(widthIn: number, depthIn: number, heightIn: number, isDoor: boolean): PanelMember[] {
  // The web bears against each chord's plywood cap (see buildHeaderChords),
  // not the bare 2x4 face — one skin thickness further inboard on each side.
  const bottomChordTopZIn = PLATE_2X4_THICKNESS_IN + SKIN_THICKNESS_IN;
  const topChordBottomZIn = heightIn - PLATE_2X4_THICKNESS_IN - SKIN_THICKNESS_IN;
  const riseIn = headerWebRiseIn(heightIn);
  const peakCount = isDoor ? 1 : computeTrussWebPeakCount(widthIn, riseIn);

  const members: PanelMember[] = [...buildHeaderChords(widthIn, depthIn, heightIn)];
  for (const [wythe, yIn] of [
    ["ext", PLATE_2X4_THICKNESS_IN / 2],
    ["int", depthIn - PLATE_2X4_THICKNESS_IN / 2],
  ] as const) {
    members.push(
      ...buildTrussWebBraces(peakCount, widthIn, bottomChordTopZIn, () => topChordBottomZIn, yIn, `truss_brace_${wythe}`),
    );
  }
  return members;
}

/** Door Header: always exactly 1 peak ("one upside down V"), on both wythes. */
export function buildDoorHeaderMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return buildHeaderMembers(widthIn, depthIn, heightIn, true);
}

/** Window ("long") Header: repeating peaks, however many keep every web segment >= 30deg, on both wythes. */
export function buildWindowHeaderMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return buildHeaderMembers(widthIn, depthIn, heightIn, false);
}

function angleNote(widthIn: number, heightIn: number, peakCount: number): { type: "warning"; text: string } | null {
  const angleDeg = computeTrussWebAngleDeg(widthIn, headerWebRiseIn(heightIn), peakCount);
  if (angleDeg >= TRUSS_WEB_MIN_ANGLE_DEG && angleDeg <= HEADER_MAX_ANGLE_DEG) return null;
  return {
    type: "warning",
    text: `Resulting web brace angle (${angleDeg.toFixed(1)}deg) falls outside the target ${TRUSS_WEB_MIN_ANGLE_DEG}-${HEADER_MAX_ANGLE_DEG}deg range for this opening's width/height — flagged, not auto-corrected.`,
  };
}

export function buildDoorHeaderSchema(widthIn: number, depthIn: number, heightIn: number): PanelComponentSchema {
  const notes: PanelComponentSchema["notes"] = [
    {
      type: "deviation",
      text:
        "Height shown is an illustrative default, not a real rough-opening-to-top-plate height — headers don't " +
        "have their own tracked height or placement mechanism yet (same gap as the Plywood Jack Stud). Chord/brace " +
        "angle-cut ends are simplified to straight tilted boxes, not true beveled geometry.",
    },
  ];
  const angle = angleNote(widthIn, heightIn, 1);
  if (angle) notes.push(angle);
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "door_header",
    displayName: "Door Header",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildDoorHeaderMembers(widthIn, depthIn, heightIn),
    fasteners: [],
    notes,
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}

export function buildWindowHeaderSchema(widthIn: number, depthIn: number, heightIn: number): PanelComponentSchema {
  const peakCount = computeTrussWebPeakCount(widthIn, headerWebRiseIn(heightIn));
  const notes: PanelComponentSchema["notes"] = [
    {
      type: "deviation",
      text:
        "Height shown is an illustrative default, not a real rough-opening-to-top-plate height — headers don't " +
        "have their own tracked height or placement mechanism yet (same gap as the Plywood Jack Stud). Chord/brace " +
        "angle-cut ends are simplified to straight tilted boxes, not true beveled geometry.",
    },
    {
      type: "warning",
      text: `${peakCount} truss web peak${peakCount === 1 ? "" : "s"} at this opening's width/height, chosen so every web segment stays at or above the ${TRUSS_WEB_MIN_ANGLE_DEG}deg minimum bracing angle.`,
    },
  ];
  const angle = angleNote(widthIn, heightIn, peakCount);
  if (angle) notes.push(angle);
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "window_header",
    displayName: "Window Header (Long Header)",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildWindowHeaderMembers(widthIn, depthIn, heightIn),
    fasteners: [],
    notes,
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
