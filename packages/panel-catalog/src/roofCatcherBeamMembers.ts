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
 * ⚠ **THE TRIANGLE CAP — why the beam's square top was not enough.**
 *
 * > *"The ridge beam should have a triangle cap on it for more bearing for
 * > the ends of roof panels."* — Tommy, 2026-11-20
 *
 * A roof panel arrives at the ridge leaning at the roof's pitch and cut
 * PLUMB at its tall end (his 2026-10-29 rule). The beam's top is flat and
 * square, so the two meet along a LINE — the panel's bottom arris on the
 * beam's top corner — and the bearing area is whatever that line spreads to
 * under load. A triangle whose two faces ARE the roof planes turns that line
 * into full contact across the beam, for both slopes at once.
 *
 * ⚠ **The rise is forced by the pitch and the beam's own width**, not
 * chosen: the cap has to run from the beam's edge up to the ridge centreline
 * at exactly the roof's slope, so `rise = (width / 2) x pitch/12`. On the
 * 4 1/2in built-up beam that is 3/4in at 4:12 and 1 1/2in at 8:12. It is a
 * small part, and that is the right size — a deeper cap would lift the
 * panels off the beam rather than seat them on it.
 *
 * ⚠ **A pitch of zero gets NO cap, and that is not a degenerate case.** A
 * shed roof has no ridge for two slopes to meet over (see `decideRoofForm`,
 * which refuses a catcher beam on a shed), and a zero rise would be a cap of
 * no thickness reaching the cut list as a real part.
 *
 * ⚠ **The stock is `pending-BI-confirmation`.** Which board a shop rips this
 * from is a fabrication choice nobody has stated; what is derived here is the
 * SECTION, and the stock is the smallest nominal that can hold it.
 */
export const ROOF_CATCHER_BEAM_CAP_BASE_IN = ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN;

export interface RoofCatcherBeamCap {
  /** Across the ridge — the beam's own built-up width. */
  baseIn: number;
  /** Height of the apex above the beam's top face. */
  riseIn: number;
  /** The smallest standard board the triangle can be ripped from. */
  nominalSize: string;
}

export function roofCatcherBeamCapGeometry(pitchIn12: number): RoofCatcherBeamCap | null {
  if (!(pitchIn12 > 0)) return null;
  const baseIn = ROOF_CATCHER_BEAM_CAP_BASE_IN;
  const riseIn = (baseIn / 2) * (pitchIn12 / 12);
  /* Ripped from a board lying flat: its THICKNESS has to cover the rise and
     its WIDTH the base. The base never changes (it is the beam), so only the
     rise picks the row. */
  const nominalSize = riseIn <= 1.5 + 1e-9 ? "2x6" : riseIn <= 3.5 + 1e-9 ? "4x6" : "built-up";
  return { baseIn, riseIn, nominalSize };
}

/**
 * The 3 built-up 2x12 plies for one beam segment, stacked side by side (on
 * edge — the 11.25in depth is vertical) along the Y axis, same convention as
 * the two-story Box Beam's LVL webs (see boxBeamMembers.ts) — plus the
 * triangle cap on top, when a pitch is given.
 *
 * ⚠ **`pitchIn12` defaults to 0, which builds the beam EXACTLY as it was
 * built before 2026-11-20.** Every call site has to opt in, so a caller that
 * has not been taught about the cap draws the old beam (a stale picture)
 * rather than a beam capped at some assumed pitch (a wrong one) — the same
 * rule `LEGACY_GIRT_STYLE` follows.
 */
export function buildRoofCatcherBeamMembers(spanIn: number, pitchIn12 = 0): PanelMember[] {
  const plies: PanelMember[] = Array.from({ length: ROOF_CATCHER_BEAM_PLY_COUNT }, (_, i) => ({
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

  const cap = roofCatcherBeamCapGeometry(pitchIn12);
  if (cap === null) return plies;

  /* ⚠ **`sectionCornersIn` is ABSOLUTE in the beam's own space**, not an
     offset from `position` — `memberLocalCornersIn` reads `c.yIn`/`c.zIn`
     straight through and `memberPrism` builds its polygon from the same two.
     So the base sits at the beam's top face, z = its 11.25in depth.

     ⚠ **A TRIANGLE, written as a QUAD with the apex doubled.** `BOX_FACES` is
     an 8-corner table shared by the OBJ exporter and the 3D renderer, so a
     genuine 3-point ring would index past the end of it. The gable peak
     wedge uses the same trick for the same reason. */
  const apexYIn = cap.baseIn / 2;
  const topZIn = ROOF_CATCHER_BEAM_DEPTH_IN;
  const apexZIn = topZIn + cap.riseIn;
  plies.push({
    memberId: "roof_catcher_beam_cap",
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: cap.nominalSize,
    /* ⚠ The BOUNDING BOX of the cut, which is how every other tapered rip in
       this package declares itself (see the gable peak wedge). The triangle
       is half this volume; the board it comes out of is not, and weight and
       price follow the board. */
    actualDimsIn: { thicknessIn: cap.riseIn, widthIn: cap.baseIn, lengthIn: spanIn },
    orientation: "horizontal",
    position: {
      xIn: 0,
      yIn: 0,
      zIn: topZIn,
      rotationDeg: 0,
      sectionCornersIn: [
        { yIn: 0, zIn: topZIn },
        { yIn: apexYIn, zIn: apexZIn },
        { yIn: apexYIn, zIn: apexZIn },
        { yIn: cap.baseIn, zIn: topZIn },
      ],
    },
    role: "plate",
    qty: 1,
    notes:
      `Triangle cap — a tapered rip from a ${cap.nominalSize}, ${cap.baseIn}in across the beam rising ` +
      `${cap.riseIn.toFixed(3)}in to the ridge centreline, both faces cut at the roof's ${pitchIn12}:12. ` +
      `It gives each roof panel's plumb-cut end a full bearing face instead of the line contact a square ` +
      `beam top leaves. ⚠ The stock is the smallest board the section fits in, not a specified one — pending ` +
      `Building Integrity confirmation.`,
  });
  return plies;
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
