import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  PLATE_END_CLEARANCE_IN,
  SKIN_THICKNESS_IN,
  buildCornerStuds,
  buildGirtRows,
  buildNailer,
  buildPlates,
  buildSkins,
  shiftTrapezoidCorners,
} from "./panelMemberHelpers";

/**
 * Shared construction behind both the Column Panel and the Corner Panel
 * (Tommy: "corner panels are just like this too actually, so let's copy
 * everything over for them too") — a 24in-wide Standard Panel core with a
 * 3/4in plywood face glued/nailed onto both tall/long (vertical) sides,
 * full height x panel thickness each, making the overall unit 25.5in wide.
 * Tommy: "keeps measurements easy in the shop."
 */
export const COLUMN_CORE_WIDTH_IN = 24;
export const COLUMN_SIDE_PLY_THICKNESS_IN = 0.75;
export const COLUMN_TOTAL_WIDTH_IN = COLUMN_CORE_WIDTH_IN + 2 * COLUMN_SIDE_PLY_THICKNESS_IN; // 25.5
export const COLUMN_SIDE_PLY_SPEC = "3/4in_5ply_CDX";
const COLUMN_GIRT_ROW_COUNT = 2; // same as the Standard Panel core it's built from
const COLUMN_BLOCKING_SPACING_IN = 16; // Tommy: 2x4 blocking every 16in, both sides, in addition to girts

/** Default beam-depth allowance (Tommy) for a Column Panel used as roof-
 * catcher-beam bearing at a Gable End (when the roof is structural panels
 * rather than trusses — see the gable-multistory-roof-strategy memory).
 * Matches a real 2x12's actual depth (11.25in, not the 12in nominal) —
 * Tommy: "spawn in 3 2x12 dimensional lumber pieces" for the roof-catcher
 * beam itself (see buildRoofCatcherBeamMembers), which bears directly on
 * top of the column, its own top face flush with the gable peak. User-
 * toggleable, not a fixed constant baked into the geometry. */
export const DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN = 11.25;

/**
 * Column Panel height when bearing a roof-catcher beam between two Gable
 * End Panels (Tommy: "column panel...11.25in down from the peak (so it can
 * catch a beam)" — shorter than the peak by the beam's own depth). Real
 * geometry now — see WallElevationView.tsx, which spawns a Column Panel
 * centered under the peak whenever a wall has "Add Gable End" on and isn't
 * snapped to a shed roof.
 */
export function computeGableColumnHeightIn(
  gablePeakHeightIn: number,
  offsetIn: number = DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN,
): number {
  return gablePeakHeightIn - offsetIn;
}

/** Shifts every member's X position by `deltaXIn` — used to slide the
 * 24in-wide core over so it sits centered between the two side plywood
 * faces, without needing every helper in panelMemberHelpers.ts to accept
 * an X offset of its own. Also shifts `trapezoidCornersIn` (a true beveled
 * brace's actual rendered geometry, stored as absolute panel-space
 * corners — see memberLocalCornersIn) when present — no diagonal-braced
 * member passes through here today (Column Panels have no bracing), but
 * this mirrors the fix applied to openingAssemblyMembers.ts's own
 * shiftAndPrefix, which shipped exactly this same bug for header braces
 * by only shifting position.xIn/zIn and leaving the corners stale. */
function shiftMembersX(members: PanelMember[], deltaXIn: number): PanelMember[] {
  return members.map((m) => ({
    ...m,
    position: {
      ...m.position,
      xIn: m.position.xIn + deltaXIn,
      trapezoidCornersIn: shiftTrapezoidCorners(m.position.trapezoidCornersIn, deltaXIn, 0),
    },
  }));
}

/** Number of 2x4 blocking rows spaced `COLUMN_BLOCKING_SPACING_IN` apart,
 * starting one spacing up from the bottom of the stud span (matching
 * ordinary "blocking every 16in o.c." framing convention) — an
 * interpretation of Tommy's spec, not independently confirmed against a
 * shop drawing. */
export function computeColumnBlockingRowCount(studSpanIn: number): number {
  return Math.floor(studSpanIn / COLUMN_BLOCKING_SPACING_IN);
}

/** 2x4 blocking between the vertical corner studs, on both the interior
 * and exterior face, stacked every 16in up the stud span — backing/lateral
 * bracing for the side plywood faces, in addition to (not instead of) the
 * core's own girt rows. Tommy: "blocking...need to be on the interior and
 * exterior face - between the studs going the other way (parallel to the
 * primary perimeter line) and are the same length (but on edge rather than
 * flat) as the 2x4 runners of the top and bottom plates." Runs along X
 * (`orientation: "horizontal"`, `rotationDeg: 0` — per `memberBoxSizeIn`'s
 * own vocabulary, "on edge, spanning X": X=length, Y=thickness, Z=width),
 * matching `buildPlates`' own plate-runner orientation exactly, not the
 * old "on edge, spanning Y" (rotationDeg 90) that ran front-to-back at the
 * panel's 2 X-extremes instead of side-to-side between the studs.
 *
 * Length/position reuse `PLATE_END_CLEARANCE_IN` directly — the exact same
 * constant `buildPlates` uses for its own `plateLengthIn` — so blocking's
 * length is guaranteed to track the plate runners' length ("same length...
 * as the runners") rather than an independently-derived formula that could
 * drift from it. `PLATE_END_CLEARANCE_IN` (1.5) happens to numerically
 * equal `PLATE_2X4_THICKNESS_IN` (1.5) for this core, so this also lands
 * exactly on the studs' own inner faces ("same distance between the studs
 * horizontally") — flagged here so an independent future change to either
 * constant doesn't silently break that framing unnoticed. */
function buildColumnBlocking(depthIn: number, studSpanIn: number): PanelMember[] {
  const lengthIn = COLUMN_CORE_WIDTH_IN - 2 * PLATE_END_CLEARANCE_IN;
  const rowCount = computeColumnBlockingRowCount(studSpanIn);
  const members: PanelMember[] = [];
  for (let row = 1; row <= rowCount; row++) {
    const zIn = SKIN_THICKNESS_IN + COLUMN_BLOCKING_SPACING_IN * row;
    for (const [face, yIn] of [
      ["exterior", 0],
      ["interior", depthIn - PLATE_2X4_THICKNESS_IN],
    ] as const) {
      members.push({
        memberId: `blocking_${row}_${face}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
        orientation: "horizontal",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn, zIn, rotationDeg: 0 },
        role: "blocking",
        qty: 1,
        notes: `Blocking row ${row} of ${rowCount}, ${face} face — between the corner studs, on edge, matching the plate runners' own length.`,
      });
    }
  }
  return members;
}

/** 3/4in plywood faces on both tall/long sides, full height x panel
 * thickness — the "safety buffer"-style side cladding that makes the core
 * 25.5in wide overall. */
function buildColumnSidePly(depthIn: number, heightIn: number): PanelMember[] {
  return (["left", "right"] as const).map((side) => ({
    memberId: `side_ply_${side}`,
    material: "plywood",
    speciesGrade: null,
    plySpec: COLUMN_SIDE_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: COLUMN_SIDE_PLY_THICKNESS_IN, widthIn: depthIn, lengthIn: heightIn },
    orientation: "vertical",
    position: {
      xIn: side === "left" ? 0 : COLUMN_CORE_WIDTH_IN + COLUMN_SIDE_PLY_THICKNESS_IN,
      yIn: 0,
      zIn: 0,
      rotationDeg: 0,
    },
    role: "skin",
    qty: 1,
    notes: `${side} face, full height x panel thickness.`,
  }));
}

/**
 * Every physical member of a Column Panel: a 24in-wide Standard Panel core
 * (skins, plate 2x4s, 4 corner studs, 2 girt rows, optional nailer) shifted
 * over by `COLUMN_SIDE_PLY_THICKNESS_IN` so it sits between two 3/4in
 * plywood side faces, plus 2x4 blocking every 16in on both edges. Overall
 * width = `COLUMN_TOTAL_WIDTH_IN` (25.5in), independent of the app's
 * user-selected `standardWidthIn` — a Column Panel is always this size.
 */
export function buildColumnPanelMembers(depthIn: number, heightIn: number, includeNailer: boolean): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const core: PanelMember[] = [
    ...buildSkins(COLUMN_CORE_WIDTH_IN, depthIn, heightIn),
    ...buildPlates(COLUMN_CORE_WIDTH_IN, depthIn, heightIn),
    ...buildCornerStuds(COLUMN_CORE_WIDTH_IN, depthIn, heightIn),
    ...buildGirtRows(COLUMN_GIRT_ROW_COUNT, COLUMN_CORE_WIDTH_IN, depthIn, studSpanIn),
  ];
  if (includeNailer) core.push(buildNailer(COLUMN_CORE_WIDTH_IN, heightIn));

  return [
    ...shiftMembersX(core, COLUMN_SIDE_PLY_THICKNESS_IN),
    ...shiftMembersX(buildColumnBlocking(depthIn, studSpanIn), COLUMN_SIDE_PLY_THICKNESS_IN),
    ...buildColumnSidePly(depthIn, heightIn),
  ];
}

/**
 * Wraps `buildColumnPanelMembers` in the full shared component schema —
 * see `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildColumnPanelSchema(depthIn: number, heightIn: number, includeNailer: boolean): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "column_panel",
    displayName: "Column Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn, widthIn: COLUMN_TOTAL_WIDTH_IN, depthIn },
    members: buildColumnPanelMembers(depthIn, heightIn, includeNailer),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Blocking row count/spacing (every 16in o.c.) is an interpretation of Tommy's spec, not independently confirmed against a shop drawing.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
