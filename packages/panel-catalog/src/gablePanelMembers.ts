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
  tiltedMember,
} from "./panelMemberHelpers";

const GABLE_GIRT_ROW_COUNT = 2; // same baseline as the Standard Panel core

/**
 * Rip angle/length for a Gable End Panel's sloped top plate + top skin
 * (Tommy: "the plywood of the top plate should also be called out what
 * angle and length it should be ripped at") — pure trig off the two edge
 * heights, kept independent of the member-geometry builder so a UI can
 * show this callout without building full member geometry first.
 * `leftHeightIn`/`rightHeightIn` are the panel's own real edge heights at
 * local x=0 and x=widthIn respectively — either can be the taller one
 * (see buildGablePanelMembers's own doc comment on why order matters here
 * now). `angleDeg` is signed (positive = rising left-to-right); callers
 * that only want the physical rip magnitude (e.g. a shop-drawing callout,
 * where the cut is the same either way) should take `Math.abs()` of it.
 */
export function computeGableRipCallout(
  widthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
): { angleDeg: number; lengthIn: number } {
  const riseIn = rightHeightIn - leftHeightIn;
  return {
    angleDeg: (Math.atan2(riseIn, widthIn) * 180) / Math.PI,
    lengthIn: Math.hypot(widthIn, riseIn),
  };
}

/** The 4 corner studs, left edge pair + right edge pair, each its own real
 * height (either can be the taller one) — angle-cut top simplified to a
 * plain box (not a true bevel), same "illustrative, not to scale"
 * simplification as the Braced Panel's brace ends. */
function buildGableCornerStuds(widthIn: number, depthIn: number, leftStudSpanIn: number, rightStudSpanIn: number): PanelMember[] {
  const cornerXs: [number, number] = [0, widthIn - PLATE_2X4_THICKNESS_IN]; // [left edge, right edge]
  const cornerYs = [0, depthIn - PLATE_2X4_WIDTH_IN];
  const heights = [leftStudSpanIn, rightStudSpanIn];
  const edgeLabels = ["left", "right"];
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
        notes: `${edgeLabels[side]} edge — bottom is a square cut flush to the bottom plate; top is angle-cut flush to the underside of the sloped top plate (simplified to a plain box top here, not the true bevel).`,
      });
    }
  }
  return members;
}

/**
 * Every physical member of a Gable End Panel (Tommy): a Standard Panel
 * core whose top is cut at the roof pitch instead of flat — trapezoidal
 * envelope, not rectangular. The left/right edge heights are supplied
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
 * Girt rows and the optional nailer use the SHORTER edge's (more
 * conservative) stud span for vertical spacing/length, whichever end that
 * actually is — a real gable panel's taller-edge side may need additional
 * fill rows, not modeled here. Flag for refinement, same as the Braced
 * Panel's own draft status.
 */
/** A Gable End Panel is a short add-on cap sitting above the wall's own
 * eave line, not a full-height wall panel — Tommy: "gable panels...can be
 * up to 8' tall." `leftHeightIn`/`rightHeightIn` are this panel's own real
 * height at local x=0 and x=widthIn respectively — already relative to the
 * eave line (a caller subtracts the roofline's own base height before
 * calling this), and already relative to true world position (a caller
 * placing this panel at a real wall position must NOT reorder these into
 * "low then high" — a tile whose real roofline descends left-to-right
 * (e.g. one to the right of a single peak) needs `leftHeightIn >
 * rightHeightIn` here, or the built panel ends up mirrored: physically
 * correct in isolation, but facing the wrong way once placed in the real
 * scene). Either can be the taller one — there is no ordering
 * requirement. */
export const GABLE_PANEL_MAX_HEIGHT_IN = 96;

export function buildGablePanelMembers(
  widthIn: number,
  depthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
  includeNailer: boolean,
): PanelMember[] {
  const tallerHeightIn = Math.max(leftHeightIn, rightHeightIn);
  if (tallerHeightIn > GABLE_PANEL_MAX_HEIGHT_IN) {
    throw new Error(
      `The taller edge height (${tallerHeightIn}) exceeds the ${GABLE_PANEL_MAX_HEIGHT_IN}in (8ft) max a single Gable End Panel can be built at — this should be the panel's own height above the eave line, not an absolute floor height.`,
    );
  }

  const plateLengthIn = widthIn - 2 * PLATE_END_CLEARANCE_IN;
  const leftStudSpanIn = leftHeightIn - 2 * SKIN_THICKNESS_IN;
  const rightStudSpanIn = rightHeightIn - 2 * SKIN_THICKNESS_IN;
  const shorterStudSpanIn = Math.min(leftStudSpanIn, rightStudSpanIn);
  const { angleDeg: ripAngleDeg, lengthIn: ripLengthIn } = computeGableRipCallout(widthIn, leftHeightIn, rightHeightIn);
  // The top plate 2x4s must run PARALLEL to the top skin (same roof pitch,
  // just a shorter run since they're inset by PLATE_END_CLEARANCE_IN at
  // each end, same as every other plate in this app) — so their own
  // endpoint heights are read off the SAME roofline trend line the skin
  // uses (leftHeightIn -> rightHeightIn over the full widthIn), evaluated
  // at the plate's own inset x positions, not the skin's raw full-width
  // edge heights (Tommy: "the top plate's 2x4's...don't seem to be in
  // parallel with the plywood" — using the raw edge heights at an inset x
  // made the plate's own rise/run steeper than the skin's real pitch).
  const heightAtXIn = (xIn: number) => leftHeightIn + ((rightHeightIn - leftHeightIn) * xIn) / widthIn;
  const platePeakLeftIn = heightAtXIn(PLATE_END_CLEARANCE_IN);
  const platePeakRightIn = heightAtXIn(widthIn - PLATE_END_CLEARANCE_IN);
  const { angleDeg: platePlumbCutAngleDeg, lengthIn: plateRipLengthIn } = computeGableRipCallout(
    plateLengthIn,
    platePeakLeftIn,
    platePeakRightIn,
  );
  // A "plumb cut" at a sloped board's own end (where it butts a vertical
  // corner stud) needs the saw angled by the SAME pitch angle as the rip
  // itself (Tommy: "mitered plumb cut...flush to the studs") — the cut
  // face's own extra length beyond a square cut, measured across the
  // board's thickness, is thicknessIn / cos(angle).
  const plumbCutEdgeLengthIn = (thicknessIn: number) => thicknessIn / Math.cos((ripAngleDeg * Math.PI) / 180);
  /**
   * ⚠ **A PERPENDICULAR THICKNESS IS NOT A VERTICAL ONE**, and the top
   * assembly used to subtract them as if they were.
   *
   * `tiltedMember` takes a CENTRELINE and lays the board's thickness
   * perpendicular to it, so dropping a centreline by half the board's
   * thickness leaves its top face `half x (1/cos - 1)` ABOVE where it was
   * meant to be. Measured at 4:12: the top skin stood 0.020in proud of the
   * edge height it was handed, and the 2x4 plate beneath it ran 0.081in INTO
   * the skin it is supposed to sit under.
   *
   * Small numbers, and exactly the ones that stop a gable's top plate
   * finishing flush with the roof above it — which is what he asked for.
   * Dividing by cos turns a perpendicular offset into the vertical drop that
   * puts the face where it was asked for.
   */
  const verticalForPerpendicularIn = (perpendicularIn: number) => perpendicularIn / Math.cos((ripAngleDeg * Math.PI) / 180);

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
    ...buildGableCornerStuds(widthIn, depthIn, leftStudSpanIn, rightStudSpanIn),
    tiltedMember(
      "top_plate_2x4_ext",
      "dimensional_lumber",
      null,
      "2x4",
      PLATE_2X4_THICKNESS_IN,
      PLATE_2X4_WIDTH_IN,
      PLATE_END_CLEARANCE_IN,
      platePeakLeftIn - verticalForPerpendicularIn(SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN / 2),
      widthIn - PLATE_END_CLEARANCE_IN,
      platePeakRightIn - verticalForPerpendicularIn(SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN / 2),
      PLATE_2X4_WIDTH_IN / 2,
      "plate",
      `exterior-wythe edge — rip parallel to the top skin, at ${platePlumbCutAngleDeg.toFixed(2)}deg, cut to ${plateRipLengthIn.toFixed(2)}in long (point to butt). Ends are plumb-cut (vertical), flush to each corner stud's face — not square to the rip — extending the board's 1.5in thickness to a ${plumbCutEdgeLengthIn(PLATE_2X4_THICKNESS_IN).toFixed(2)}in cut edge.`,
    ),
    tiltedMember(
      "top_plate_2x4_int",
      "dimensional_lumber",
      null,
      "2x4",
      PLATE_2X4_THICKNESS_IN,
      PLATE_2X4_WIDTH_IN,
      PLATE_END_CLEARANCE_IN,
      platePeakLeftIn - verticalForPerpendicularIn(SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN / 2),
      widthIn - PLATE_END_CLEARANCE_IN,
      platePeakRightIn - verticalForPerpendicularIn(SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN / 2),
      depthIn - PLATE_2X4_WIDTH_IN / 2,
      "plate",
      `interior-wythe edge — rip parallel to the top skin, at ${platePlumbCutAngleDeg.toFixed(2)}deg, cut to ${plateRipLengthIn.toFixed(2)}in long (point to butt). Ends are plumb-cut (vertical), flush to each corner stud's face — not square to the rip — extending the board's 1.5in thickness to a ${plumbCutEdgeLengthIn(PLATE_2X4_THICKNESS_IN).toFixed(2)}in cut edge.`,
    ),
    tiltedMember(
      "top_plate_skin",
      "plywood",
      SKIN_PLY_SPEC,
      null,
      SKIN_THICKNESS_IN,
      depthIn,
      0,
      leftHeightIn - verticalForPerpendicularIn(SKIN_THICKNESS_IN / 2),
      widthIn,
      rightHeightIn - verticalForPerpendicularIn(SKIN_THICKNESS_IN / 2),
      depthIn / 2,
      "skin",
      `Rip at ${ripAngleDeg.toFixed(2)}deg, cut to ${ripLengthIn.toFixed(2)}in long (point to butt). Panel-width edges are plumb-cut (vertical), flush to each corner stud's face — not square to the rip — extending the sheet's 0.75in thickness to a ${plumbCutEdgeLengthIn(SKIN_THICKNESS_IN).toFixed(2)}in cut edge.`,
    ),
    ...buildGirtRows(GABLE_GIRT_ROW_COUNT, widthIn, depthIn, shorterStudSpanIn),
  ];
  if (includeNailer) members.push(buildNailer(widthIn, Math.min(leftHeightIn, rightHeightIn)));
  return members;
}

/**
 * Wraps `buildGablePanelMembers` in the full shared component schema —
 * see `buildStandardPanelSchema`'s doc comment for the same rationale.
 * `overallDimensions.heightIn` is the TALLER edge height (whichever side
 * that is) — the envelope is trapezoidal, not a uniform rectangle.
 */
export function buildGablePanelSchema(
  widthIn: number,
  depthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
  includeNailer: boolean,
): PanelComponentSchema {
  const { angleDeg: ripAngleDeg, lengthIn: ripLengthIn } = computeGableRipCallout(widthIn, leftHeightIn, rightHeightIn);
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "gable_panel",
    displayName: "Gable End Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn: Math.max(leftHeightIn, rightHeightIn), widthIn, depthIn },
    members: buildGablePanelMembers(widthIn, depthIn, leftHeightIn, rightHeightIn, includeNailer),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Trapezoidal envelope — edge stud angle cuts are simplified to plain boxes, not true beveled geometry. " +
          "Girt rows/nailer use the shorter edge's stud span for vertical spacing, not the full slope. No diagonal " +
          "bracing — standard panel with an inclined top only, for the default construction.",
      },
      {
        type: "warning",
        text: `Top skin rip: ${Math.abs(ripAngleDeg).toFixed(2)}deg, ${ripLengthIn.toFixed(2)}in long. Left/right edge heights are ` +
          "supplied manually — no roof/ridge system exists yet to derive them automatically.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
