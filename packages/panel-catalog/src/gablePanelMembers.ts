import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  PLATE_END_CLEARANCE_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
  buildGirtRows,
  buildNailer,
} from "./panelMemberHelpers";

const GABLE_GIRT_ROW_COUNT = 2; // same baseline as the Standard Panel core

/**
 * Rip angle/length for a Gable End Panel's sloped top plate + top skin
 * (Tommy: "the plywood of the top plate should also be called out what
 * angle and length it should be ripped at") — pure trig off the two edge
 * heights, kept independent of the member-geometry builder so a UI can
 * show this callout without building full member geometry first.
 */
export function computeGableRipCallout(
  widthIn: number,
  lowEdgeHeightIn: number,
  highEdgeHeightIn: number,
): { angleDeg: number; lengthIn: number } {
  const riseIn = highEdgeHeightIn - lowEdgeHeightIn;
  return {
    angleDeg: (Math.atan2(riseIn, widthIn) * 180) / Math.PI,
    lengthIn: Math.hypot(widthIn, riseIn),
  };
}

/**
 * A tilted member running from (x1,z1) to (x2,z2) in the panel's own
 * width-height plane — reuses the exact same "diagonal" orientation +
 * tiltDeg convention as the Braced Panel's brace (see
 * `buildDiagonalBraces` in bracedPanelMembers.ts), so the 3D renderer and
 * OBJ exporter handle a gable's sloped top plate/skin identically to a
 * brace, with no new geometry primitive needed.
 */
function tiltedMember(
  memberId: string,
  material: PanelMember["material"],
  plySpec: string | null,
  nominalSize: string | null,
  thicknessIn: number,
  crossWidthIn: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  yIn: number,
  role: PanelMember["role"],
  notes: string,
): PanelMember {
  const centerX = (x1 + x2) / 2;
  const centerZ = (z1 + z2) / 2;
  const lengthIn = Math.hypot(x2 - x1, z2 - z1);
  const tiltDeg = (Math.atan2(-(x1 - centerX), z1 - centerZ) * 180) / Math.PI;
  return {
    memberId,
    material,
    speciesGrade: material === "dimensional_lumber" ? LUMBER_SPECIES_GRADE : null,
    plySpec,
    nominalSize,
    actualDimsIn: { thicknessIn, widthIn: crossWidthIn, lengthIn },
    orientation: "diagonal",
    position: { xIn: centerX, yIn, zIn: centerZ, rotationDeg: 0, tiltDeg },
    role,
    qty: 1,
    notes,
  };
}

/** The 4 corner studs, low edge pair + high edge pair, each its own
 * height — angle-cut top simplified to a plain box (not a true bevel),
 * same "illustrative, not to scale" simplification as the Braced Panel's
 * brace ends. */
function buildGableCornerStuds(widthIn: number, depthIn: number, lowStudSpanIn: number, highStudSpanIn: number): PanelMember[] {
  const cornerXs: [number, number] = [0, widthIn - PLATE_2X4_THICKNESS_IN]; // [low edge, high edge]
  const cornerYs = [0, depthIn - PLATE_2X4_WIDTH_IN];
  const heights = [lowStudSpanIn, highStudSpanIn];
  const edgeLabels = ["low", "high"];
  const members: PanelMember[] = [];
  let idx = 0;
  for (const yIn of cornerYs) {
    for (let side = 0; side < 2; side++) {
      idx++;
      members.push({
        memberId: `stud_corner_${idx}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: heights[side]! },
        orientation: "vertical",
        position: { xIn: cornerXs[side]!, yIn, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
        role: "stud",
        qty: 1,
        notes: `${edgeLabels[side]} edge — angle-cut top (simplified to a plain box top, not the true bevel).`,
      });
    }
  }
  return members;
}

/**
 * Every physical member of a Gable End Panel (Tommy): a Standard Panel
 * core whose top is cut at the roof pitch instead of flat — trapezoidal
 * envelope, not rectangular. The low/high edge heights are supplied
 * directly per instance; no roof/ridge system exists yet to derive them
 * from automatically (see the gable-multistory-roof-strategy memory —
 * that auto-derivation from a roof pitch + bottom-of-truss height is the
 * long-term target).
 *
 * Bottom skin/plates are flat and unchanged from a Standard Panel. The 2
 * edge stud pairs each get their own height with an angle-cut top
 * (simplified to a plain box, not true beveled geometry). The top plate
 * 2x4s and top skin run the full sloped rip length, modeled as tilted
 * ("diagonal") members using the same convention as the Braced Panel's
 * brace.
 *
 * Girt rows and the optional nailer use the LOW edge's (shorter, more
 * conservative) stud span for vertical spacing/length — a real gable
 * panel's high-edge side may need additional fill rows, not modeled here.
 * Flag for refinement, same as the Braced Panel's own draft status.
 */
export function buildGablePanelMembers(
  widthIn: number,
  depthIn: number,
  lowEdgeHeightIn: number,
  highEdgeHeightIn: number,
  includeNailer: boolean,
): PanelMember[] {
  if (highEdgeHeightIn < lowEdgeHeightIn) {
    throw new Error("highEdgeHeightIn must be >= lowEdgeHeightIn — swap ends if the ridge is on the opposite side.");
  }

  const plateLengthIn = widthIn - 2 * PLATE_END_CLEARANCE_IN;
  const lowStudSpanIn = lowEdgeHeightIn - 2 * SKIN_THICKNESS_IN;
  const highStudSpanIn = highEdgeHeightIn - 2 * SKIN_THICKNESS_IN;
  const { angleDeg: ripAngleDeg, lengthIn: ripLengthIn } = computeGableRipCallout(widthIn, lowEdgeHeightIn, highEdgeHeightIn);

  const members: PanelMember[] = [
    {
      memberId: "bottom_plate_skin",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
    },
    {
      memberId: "bottom_plate_2x4_ext",
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: plateLengthIn },
      orientation: "flat",
      position: { xIn: PLATE_END_CLEARANCE_IN, yIn: 0, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "exterior-wythe edge",
    },
    {
      memberId: "bottom_plate_2x4_int",
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: plateLengthIn },
      orientation: "flat",
      position: { xIn: PLATE_END_CLEARANCE_IN, yIn: depthIn - PLATE_2X4_WIDTH_IN, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "interior-wythe edge",
    },
    ...buildGableCornerStuds(widthIn, depthIn, lowStudSpanIn, highStudSpanIn),
    tiltedMember(
      "top_plate_2x4_ext",
      "dimensional_lumber",
      null,
      "2x4",
      PLATE_2X4_THICKNESS_IN,
      PLATE_2X4_WIDTH_IN,
      PLATE_END_CLEARANCE_IN,
      lowEdgeHeightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN / 2,
      widthIn - PLATE_END_CLEARANCE_IN,
      highEdgeHeightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN / 2,
      PLATE_2X4_WIDTH_IN / 2,
      "plate",
      "exterior-wythe edge — mitered to match the roof pitch, face-fastened to the top skin.",
    ),
    tiltedMember(
      "top_plate_2x4_int",
      "dimensional_lumber",
      null,
      "2x4",
      PLATE_2X4_THICKNESS_IN,
      PLATE_2X4_WIDTH_IN,
      PLATE_END_CLEARANCE_IN,
      lowEdgeHeightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN / 2,
      widthIn - PLATE_END_CLEARANCE_IN,
      highEdgeHeightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN / 2,
      depthIn - PLATE_2X4_WIDTH_IN / 2,
      "plate",
      "interior-wythe edge — mitered to match the roof pitch, face-fastened to the top skin.",
    ),
    tiltedMember(
      "top_plate_skin",
      "plywood",
      SKIN_PLY_SPEC,
      null,
      SKIN_THICKNESS_IN,
      depthIn,
      0,
      lowEdgeHeightIn - SKIN_THICKNESS_IN / 2,
      widthIn,
      highEdgeHeightIn - SKIN_THICKNESS_IN / 2,
      depthIn / 2,
      "skin",
      `Rip at ${ripAngleDeg.toFixed(2)}deg, cut to ${ripLengthIn.toFixed(2)}in long.`,
    ),
    ...buildGirtRows(GABLE_GIRT_ROW_COUNT, widthIn, depthIn, lowStudSpanIn),
  ];
  if (includeNailer) members.push(buildNailer(widthIn, lowEdgeHeightIn));
  return members;
}

/**
 * Wraps `buildGablePanelMembers` in the full shared component schema —
 * see `buildStandardPanelSchema`'s doc comment for the same rationale.
 * `overallDimensions.heightIn` is the HIGH edge height (the tallest
 * point) — the envelope is trapezoidal, not a uniform rectangle.
 */
export function buildGablePanelSchema(
  widthIn: number,
  depthIn: number,
  lowEdgeHeightIn: number,
  highEdgeHeightIn: number,
  includeNailer: boolean,
): PanelComponentSchema {
  const { angleDeg: ripAngleDeg, lengthIn: ripLengthIn } = computeGableRipCallout(widthIn, lowEdgeHeightIn, highEdgeHeightIn);
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "gable_panel",
    displayName: "Gable End Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn: highEdgeHeightIn, widthIn, depthIn },
    members: buildGablePanelMembers(widthIn, depthIn, lowEdgeHeightIn, highEdgeHeightIn, includeNailer),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Trapezoidal envelope — edge stud angle cuts are simplified to plain boxes, not true beveled geometry. " +
          "Girt rows/nailer use the low edge's stud span for vertical spacing, not the full slope.",
      },
      {
        type: "warning",
        text: `Top skin rip: ${ripAngleDeg.toFixed(2)}deg, ${ripLengthIn.toFixed(2)}in long. Low/high edge heights are ` +
          "supplied manually — no roof/ridge system exists yet to derive them automatically.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
