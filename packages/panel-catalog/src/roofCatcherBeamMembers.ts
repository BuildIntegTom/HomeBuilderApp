import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { LUMBER_SPECIES_GRADE } from "./panelMemberHelpers";

/**
 * Roof-catcher beam for the structural-panel roof system (Tommy: "spawn in
 * 3 2x12 dimensional lumber pieces that span a maximum of 12'") — a 3-ply
 * built-up 2x12 beam, on edge, running between the two Gable End Panels'
 * Column Panels. Actual depth (11.25in) matches DEFAULT_GABLE_COLUMN_HEIGHT_
 * OFFSET_IN in columnPanelMembers.ts, so the beam's own top face sits flush
 * with the gable peak once it bears on the (shorter) column below.
 */
export const ROOF_CATCHER_BEAM_PLY_COUNT = 3;
export const ROOF_CATCHER_BEAM_NOMINAL_SIZE = "2x12";
export const ROOF_CATCHER_BEAM_PLY_THICKNESS_IN = 1.5; // one 2x's actual thickness
export const ROOF_CATCHER_BEAM_DEPTH_IN = 11.25; // one 2x12's actual depth ("on edge")
export const ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN = ROOF_CATCHER_BEAM_PLY_COUNT * ROOF_CATCHER_BEAM_PLY_THICKNESS_IN; // 4.5in

/** Tommy: "span a maximum of 12'" — the longest run a single built-up beam
 * segment covers before a post picks it up. */
export const ROOF_CATCHER_BEAM_MAX_SPAN_IN = 144;

/**
 * The 3 built-up 2x12 plies for one beam segment, stacked side by side (on
 * edge — the 11.25in depth is vertical) along the Y axis, same convention as
 * the two-story Box Beam's LVL webs (see boxBeamMembers.ts).
 */
export function buildRoofCatcherBeamMembers(spanIn: number): PanelMember[] {
  return Array.from({ length: ROOF_CATCHER_BEAM_PLY_COUNT }, (_, i) => ({
    memberId: `roof_catcher_beam_ply_${i + 1}`,
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: ROOF_CATCHER_BEAM_NOMINAL_SIZE,
    actualDimsIn: { thicknessIn: ROOF_CATCHER_BEAM_PLY_THICKNESS_IN, widthIn: ROOF_CATCHER_BEAM_DEPTH_IN, lengthIn: spanIn },
    orientation: "horizontal",
    position: { xIn: 0, yIn: i * ROOF_CATCHER_BEAM_PLY_THICKNESS_IN, zIn: 0, rotationDeg: 0 },
    role: "plate",
    qty: 1,
    notes: `Ply ${i + 1} of ${ROOF_CATCHER_BEAM_PLY_COUNT} — built-up ${ROOF_CATCHER_BEAM_PLY_COUNT}-ply 2x12 roof-catcher beam, on edge.`,
  }));
}

export interface RoofCatcherBeamSegment {
  xStartIn: number;
  xEndIn: number;
  spanIn: number;
}

/**
 * Splits the total run between two Gable End Panels' Column Panels into
 * evenly-sized segments no longer than `maxSpanIn` — same "ceil'd, evenly
 * re-split" rule used everywhere else in this codebase (computeGridBays,
 * computeGableTiledRow, computeJoistLayout), so a run that doesn't divide
 * evenly by the max span still gets a *uniform* span across its whole
 * length instead of one short leftover segment. A run this splits into more
 * than 1 segment needs an intermediate post at each interior boundary (see
 * computeRoofCatcherBeamPostPositions) — the two ends bear on the Column
 * Panels instead.
 */
export function computeRoofCatcherBeamSegments(
  totalRunIn: number,
  maxSpanIn: number = ROOF_CATCHER_BEAM_MAX_SPAN_IN,
): RoofCatcherBeamSegment[] {
  const segmentCount = Math.max(1, Math.ceil(totalRunIn / maxSpanIn));
  const spanIn = totalRunIn / segmentCount;
  return Array.from({ length: segmentCount }, (_, i) => ({
    xStartIn: i * spanIn,
    xEndIn: (i + 1) * spanIn,
    spanIn,
  }));
}

/**
 * Post positions (inches from the run's start) at each interior beam-segment
 * boundary — Tommy: "posts under them that correlate to piers." Only the
 * interior boundaries need a post; the two ends already bear on the Column
 * Panels. The post's own construction (size/material) isn't specified yet —
 * flagged to model later, same as the beam shape options in data.ts.
 */
export function computeRoofCatcherBeamPostPositions(
  totalRunIn: number,
  maxSpanIn: number = ROOF_CATCHER_BEAM_MAX_SPAN_IN,
): number[] {
  const segments = computeRoofCatcherBeamSegments(totalRunIn, maxSpanIn);
  return segments.slice(0, -1).map((s) => s.xEndIn);
}

/**
 * Whether a post position falls on a whole multiple of the pier spacing —
 * Tommy's "ideal scenario": piers at 6ft o.c., a post every other one (12ft).
 * That ideal only lands exactly when the total run is itself a whole
 * multiple of 2x the pier spacing; computeRoofCatcherBeamSegments' own
 * "evenly re-split, never exceed max span" rule (matching every other
 * spacing calc in this codebase) means an odd total run gets shorter,
 * evenly-redistributed segments that may fall between piers instead — this
 * check surfaces that instead of silently assuming every post lands on one.
 */
export function isPostPositionOnPier(postXIn: number, pierSpacingFt: number, toleranceIn = 0.01): boolean {
  if (pierSpacingFt <= 0) return false;
  const spacingIn = pierSpacingFt * 12;
  const remainderIn = postXIn % spacingIn;
  return remainderIn < toleranceIn || spacingIn - remainderIn < toleranceIn;
}

export function buildRoofCatcherBeamSchema(spanIn: number): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "connection_detail",
    id: "roof_catcher_beam",
    displayName: "Roof-Catcher Beam (Structural-Panel Roof)",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: ROOF_CATCHER_BEAM_DEPTH_IN, widthIn: spanIn, depthIn: ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN },
    members: buildRoofCatcherBeamMembers(spanIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "3-ply 2x12 built-up construction and the 12ft max span are Tommy's spec; the intermediate posts' own " +
          "construction (size/material) isn't specified yet and isn't modeled — only their positions are computed " +
          "(see computeRoofCatcherBeamPostPositions).",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
