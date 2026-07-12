import type { MemberRole, PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  buildTrussWebBraces,
  computeTrussWebPeakCount,
} from "./panelMemberHelpers";
import { ROOF_CATCHER_BEAM_DEPTH_IN, buildRoofCatcherBeamMembers } from "./roofCatcherBeamMembers";

/**
 * Classic roof truss profiles (Tommy: "model out some classic truss
 * examples... say this is a basic outline and estimate - refer to truss
 * manufacturer for more details") — 6 illustrative, single-plane truss
 * shapes (King Post, Queen Post, Fink/W, Howe, Pratt, Scissor), shown at a
 * representative span/pitch each. These are NOT tied to any project's own
 * roof (see roofSystemTypes/trussPlateMembers.ts for the actual truss
 * BEARING member this app models) — a real truss's member sizes/spacing
 * are span-, load-, and species-specific engineering output a truss
 * manufacturer's software produces, not something this app calculates.
 * Every chord/web here is a straight member with simplified (non-beveled)
 * square-cut ends, same simplification as every other diagonal brace in
 * this codebase (see buildDiagonalBraces/buildTrussWebBraces).
 */

const CHORD_NOMINAL_SIZE = "2x6";
const CHORD_DIMS = { thicknessIn: 1.5, widthIn: 5.5 };
const WEB_NOMINAL_SIZE = "2x4";
const WEB_DIMS = { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN };

/** Default rise-per-12in-run pitch for every gable-topped truss type below
 * (King Post/Queen Post/Fink/Howe/Pratt) — a common, recognizable
 * residential pitch, not derived from any real span table. */
export const CLASSIC_TRUSS_DEFAULT_PITCH_IN12 = 6;

/**
 * One member from (x1,z1) to (x2,z2) in the truss's own flat profile plane
 * — mirrors buildDiagonalBraces/buildTrussWebBraces's local `makeBrace`
 * helper (same length/tilt math), generalized to take its own dims/
 * nominalSize/role. rotationDeg is always 90 (not the diagonal default 0)
 * so every member's WIDE face (5.5in chord / 3.5in web) lies in-plane and
 * its 1.5in THIN face is what extends into the truss's own depth axis —
 * a real truss is one flat, ~1.5in-thick fabricated unit, so every member
 * (chord or web) shares that same thin depth regardless of its own
 * width, same convention `buildTrussWebBraces` already uses for headers/
 * gable bracing.
 */
function makeTrussMember(
  memberId: string,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  dims: { thicknessIn: number; widthIn: number },
  nominalSize: string,
  role: MemberRole,
  notes: string,
): PanelMember {
  const centerX = (x1 + x2) / 2;
  const centerZ = (z1 + z2) / 2;
  const lengthIn = Math.hypot(x2 - x1, z2 - z1);
  const tiltDeg = (Math.atan2(-(x1 - centerX), z1 - centerZ) * 180) / Math.PI;
  return {
    memberId,
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize,
    actualDimsIn: { thicknessIn: dims.thicknessIn, widthIn: dims.widthIn, lengthIn },
    orientation: "diagonal",
    position: { xIn: centerX, yIn: 0, zIn: centerZ, rotationDeg: 90, tiltDeg },
    role,
    qty: 1,
    notes,
  };
}

/** Bottom chord (flat, full span) + 2 sloped top-chord halves meeting at a
 * single ridge peak at mid-span — the shared silhouette behind King Post,
 * Queen Post's outer slopes, Fink, Howe, and Pratt. */
function buildPeakedChords(spanIn: number, pitchIn12: number): PanelMember[] {
  const peakZIn = (spanIn / 2) * (pitchIn12 / 12);
  return [
    makeTrussMember("bottom_chord", 0, 0, spanIn, 0, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Bottom chord (tie beam), full span."),
    makeTrussMember("top_chord_left", 0, 0, spanIn / 2, peakZIn, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, left slope, heel to ridge."),
    makeTrussMember("top_chord_right", spanIn / 2, peakZIn, spanIn, 0, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, right slope, ridge to heel."),
  ];
}

export const KING_POST_DEFAULT_SPAN_IN = 16 * 12;

/** King Post Truss — the simplest classic form: bottom chord, 2 sloped top
 * chords, and a single vertical "king post" from mid-span up to the
 * ridge. Historically used for short spans (~16-24ft). */
export function buildKingPostTrussMembers(
  spanIn: number = KING_POST_DEFAULT_SPAN_IN,
  pitchIn12: number = CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
): PanelMember[] {
  const peakZIn = (spanIn / 2) * (pitchIn12 / 12);
  return [
    ...buildPeakedChords(spanIn, pitchIn12),
    makeTrussMember("king_post", spanIn / 2, 0, spanIn / 2, peakZIn, WEB_DIMS, WEB_NOMINAL_SIZE, "stud", "King post — vertical, bottom-chord mid-span up to the ridge."),
  ];
}

export const QUEEN_POST_DEFAULT_SPAN_IN = 24 * 12;

/** Queen Post Truss — 2 vertical posts at the 1/3 and 2/3 span points,
 * joined by a horizontal "straining beam" at their tops (a flat-topped
 * trapezoid, not a single ridge peak) — spans further than a King Post
 * without needing a longer single top-chord run. */
export function buildQueenPostTrussMembers(
  spanIn: number = QUEEN_POST_DEFAULT_SPAN_IN,
  pitchIn12: number = CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
): PanelMember[] {
  const postXLeftIn = spanIn / 3;
  const postXRightIn = (2 * spanIn) / 3;
  const postZIn = postXLeftIn * (pitchIn12 / 12);
  return [
    makeTrussMember("bottom_chord", 0, 0, spanIn, 0, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Bottom chord (tie beam), full span."),
    makeTrussMember("top_chord_left", 0, 0, postXLeftIn, postZIn, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, left slope, heel to left queen post."),
    makeTrussMember("straining_beam", postXLeftIn, postZIn, postXRightIn, postZIn, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Straining beam — horizontal, connects the tops of both queen posts."),
    makeTrussMember("top_chord_right", postXRightIn, postZIn, spanIn, 0, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, right slope, right queen post to heel."),
    makeTrussMember("queen_post_left", postXLeftIn, 0, postXLeftIn, postZIn, WEB_DIMS, WEB_NOMINAL_SIZE, "stud", "Left queen post — vertical."),
    makeTrussMember("queen_post_right", postXRightIn, 0, postXRightIn, postZIn, WEB_DIMS, WEB_NOMINAL_SIZE, "stud", "Right queen post — vertical."),
  ];
}

export const FINK_TRUSS_DEFAULT_SPAN_IN = 30 * 12;

/** Fink ("W") Truss — the common residential prefab shape: a repeating
 * zigzag "W" web (reusing `buildTrussWebBraces`, the same helper the gable
 * bracing/headers use) between the bottom chord and the sloped top
 * chords, however many peaks keep every web segment at/above the 30deg
 * minimum bracing angle. */
export function buildFinkTrussMembers(
  spanIn: number = FINK_TRUSS_DEFAULT_SPAN_IN,
  pitchIn12: number = CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
): PanelMember[] {
  const peakZIn = (spanIn / 2) * (pitchIn12 / 12);
  const topChordZAt = (xIn: number) => (xIn <= spanIn / 2 ? xIn : spanIn - xIn) * (pitchIn12 / 12);
  const peakCount = computeTrussWebPeakCount(spanIn, peakZIn);
  return [...buildPeakedChords(spanIn, pitchIn12), ...buildTrussWebBraces(peakCount, spanIn, 0, topChordZAt, 0, "fink_web")];
}

const HOWE_PRATT_PANELS_PER_HALF = 3;

/** Shared Howe/Pratt web builder — `panelsPerHalf` evenly-spaced panel
 * points per half-span, a vertical post at each INTERIOR point, and one
 * diagonal per bay. Howe's diagonals lean from the bottom chord (nearer
 * the heel) up toward the top chord (nearer the ridge) — compression
 * diagonals, tension verticals. Pratt is the mirror image: diagonals lean
 * from the top chord (nearer the ridge) down toward the bottom chord
 * (nearer the heel) — tension diagonals, compression verticals. Both
 * halves are built from the same left-side panel-point math, mirrored via
 * `xIn -> spanIn - xIn` for the right half. */
function buildHoweOrPrattWebs(spanIn: number, pitchIn12: number, isPratt: boolean): PanelMember[] {
  const topChordZAt = (xIn: number) => (xIn <= spanIn / 2 ? xIn : spanIn - xIn) * (pitchIn12 / 12);
  const panelWidthIn = spanIn / 2 / HOWE_PRATT_PANELS_PER_HALF;
  const leftPanelXsIn = Array.from({ length: HOWE_PRATT_PANELS_PER_HALF + 1 }, (_, i) => i * panelWidthIn);

  const members: PanelMember[] = [];
  for (const mirror of [false, true] as const) {
    const sidePrefix = mirror ? "right" : "left";
    const at = (xIn: number) => (mirror ? spanIn - xIn : xIn);
    const trussName = isPratt ? "Pratt" : "Howe";

    for (let i = 1; i < HOWE_PRATT_PANELS_PER_HALF; i++) {
      const xIn = at(leftPanelXsIn[i]!);
      members.push(
        makeTrussMember(
          `${sidePrefix}_post_${i}`,
          xIn,
          0,
          xIn,
          topChordZAt(xIn),
          WEB_DIMS,
          WEB_NOMINAL_SIZE,
          "stud",
          `Vertical web post, panel point ${i} of ${HOWE_PRATT_PANELS_PER_HALF} (${sidePrefix} half).`,
        ),
      );
    }

    for (let i = 0; i < HOWE_PRATT_PANELS_PER_HALF; i++) {
      const heelSideXIn = leftPanelXsIn[i]!;
      const ridgeSideXIn = leftPanelXsIn[i + 1]!;
      // Howe: bottom end nearer the heel, top end nearer the ridge. Pratt: swapped.
      const [bottomLocalIn, topLocalIn] = isPratt ? [ridgeSideXIn, heelSideXIn] : [heelSideXIn, ridgeSideXIn];
      const xBottomIn = at(bottomLocalIn);
      const xTopIn = at(topLocalIn);
      members.push(
        makeTrussMember(
          `${sidePrefix}_diagonal_${i + 1}`,
          xBottomIn,
          0,
          xTopIn,
          topChordZAt(xTopIn),
          WEB_DIMS,
          WEB_NOMINAL_SIZE,
          "brace",
          `Diagonal web, bay ${i + 1} of ${HOWE_PRATT_PANELS_PER_HALF} (${sidePrefix} half) — ${trussName} diagonal.`,
        ),
      );
    }
  }
  return members;
}

export const HOWE_TRUSS_DEFAULT_SPAN_IN = 30 * 12;

/** Howe Truss — vertical web posts in tension, diagonal webs in
 * compression leaning toward the ridge from each panel point. */
export function buildHoweTrussMembers(
  spanIn: number = HOWE_TRUSS_DEFAULT_SPAN_IN,
  pitchIn12: number = CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
): PanelMember[] {
  return [...buildPeakedChords(spanIn, pitchIn12), ...buildHoweOrPrattWebs(spanIn, pitchIn12, false)];
}

export const PRATT_TRUSS_DEFAULT_SPAN_IN = 30 * 12;

/** Pratt Truss — the Howe truss's mirror image: diagonal webs in tension
 * leaning toward the supports, vertical web posts in compression. */
export function buildPrattTrussMembers(
  spanIn: number = PRATT_TRUSS_DEFAULT_SPAN_IN,
  pitchIn12: number = CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
): PanelMember[] {
  return [...buildPeakedChords(spanIn, pitchIn12), ...buildHoweOrPrattWebs(spanIn, pitchIn12, true)];
}

export const SCISSOR_TRUSS_DEFAULT_SPAN_IN = 28 * 12;
export const SCISSOR_TRUSS_DEFAULT_TOP_PITCH_IN12 = 8;
export const SCISSOR_TRUSS_DEFAULT_BOTTOM_PITCH_IN12 = 3;

/** Scissor Truss — a vaulted-ceiling profile: the top chord is a normal
 * gable peak, but the "bottom chord" is really 2 shallower-pitched ties,
 * each rising from one heel and crossing the OTHER tie near mid-span
 * before landing on the OPPOSITE top chord (not the far heel — a shallow
 * line run the full span would poke past the far top chord, which drops
 * back to 0 there). That landing point is wherever the two lines
 * (bottomPitch from this heel, topPitch from the far heel) actually
 * intersect — solved directly, not an arbitrary cutoff fraction. A short
 * vertical strut ties the true crossing point up to the ridge. */
export function buildScissorTrussMembers(
  spanIn: number = SCISSOR_TRUSS_DEFAULT_SPAN_IN,
  topPitchIn12: number = SCISSOR_TRUSS_DEFAULT_TOP_PITCH_IN12,
  bottomPitchIn12: number = SCISSOR_TRUSS_DEFAULT_BOTTOM_PITCH_IN12,
): PanelMember[] {
  const topPeakZIn = (spanIn / 2) * (topPitchIn12 / 12);
  const meetXIn = (spanIn * topPitchIn12) / (topPitchIn12 + bottomPitchIn12);
  const meetZIn = meetXIn * (bottomPitchIn12 / 12);
  const crossXIn = spanIn / 2;
  const crossZIn = crossXIn * (bottomPitchIn12 / 12);

  return [
    makeTrussMember("top_chord_left", 0, 0, spanIn / 2, topPeakZIn, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, left slope, heel to ridge."),
    makeTrussMember("top_chord_right", spanIn / 2, topPeakZIn, spanIn, 0, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, right slope, ridge to heel."),
    makeTrussMember(
      "bottom_chord_a",
      0,
      0,
      meetXIn,
      meetZIn,
      CHORD_DIMS,
      CHORD_NOMINAL_SIZE,
      "plate",
      "Bottom chord A — rises from the left heel at a shallower pitch than the top chord, crossing bottom chord B near mid-span and landing on the right top chord (the vaulted-ceiling 'scissor').",
    ),
    makeTrussMember(
      "bottom_chord_b",
      spanIn,
      0,
      spanIn - meetXIn,
      meetZIn,
      CHORD_DIMS,
      CHORD_NOMINAL_SIZE,
      "plate",
      "Bottom chord B — mirror image of bottom chord A, rising from the right heel and landing on the left top chord.",
    ),
    makeTrussMember(
      "center_strut",
      crossXIn,
      crossZIn,
      crossXIn,
      topPeakZIn,
      WEB_DIMS,
      WEB_NOMINAL_SIZE,
      "stud",
      "Vertical strut, the bottom chords' crossing point up to the ridge.",
    ),
  ];
}

export type ClassicTrussTypeId = "king-post" | "queen-post" | "fink" | "howe" | "pratt" | "scissor";

export interface ClassicTrussTypeDef {
  id: ClassicTrussTypeId;
  label: string;
  description: string;
  defaultSpanIn: number;
  /** Ridge (or, for Queen Post, straining-beam) height at the default
   * span/pitch — just for `overallDimensions`/camera framing, not fed back
   * into the geometry itself (each builder derives its own peak height
   * from spanIn/pitchIn12 directly). */
  peakHeightIn: number;
  build: () => PanelMember[];
}

/** The 6 classic truss types this reference gallery shows — id/label/
 * description/default-span metadata alongside each type's own member
 * builder, so the app's Roof tab can list and preview them without
 * needing a parallel switch statement elsewhere. */
export const CLASSIC_TRUSS_TYPES: ClassicTrussTypeDef[] = [
  {
    id: "king-post",
    label: "King Post",
    description: "The simplest classic truss — a single vertical post from mid-span up to the ridge. Short spans, historically ~16-24ft.",
    defaultSpanIn: KING_POST_DEFAULT_SPAN_IN,
    peakHeightIn: (KING_POST_DEFAULT_SPAN_IN / 2) * (CLASSIC_TRUSS_DEFAULT_PITCH_IN12 / 12),
    build: () => buildKingPostTrussMembers(),
  },
  {
    id: "queen-post",
    label: "Queen Post",
    description: "Two vertical posts joined by a flat straining beam (a trapezoid, not a single peak) — spans further than a King Post.",
    defaultSpanIn: QUEEN_POST_DEFAULT_SPAN_IN,
    peakHeightIn: (QUEEN_POST_DEFAULT_SPAN_IN / 3) * (CLASSIC_TRUSS_DEFAULT_PITCH_IN12 / 12),
    build: () => buildQueenPostTrussMembers(),
  },
  {
    id: "fink",
    label: "Fink (W-Truss)",
    description: "The common residential prefab shape — a repeating zigzag \"W\" web between the chords.",
    defaultSpanIn: FINK_TRUSS_DEFAULT_SPAN_IN,
    peakHeightIn: (FINK_TRUSS_DEFAULT_SPAN_IN / 2) * (CLASSIC_TRUSS_DEFAULT_PITCH_IN12 / 12),
    build: () => buildFinkTrussMembers(),
  },
  {
    id: "howe",
    label: "Howe",
    description: "Vertical web posts in tension, diagonal webs in compression leaning toward the ridge.",
    defaultSpanIn: HOWE_TRUSS_DEFAULT_SPAN_IN,
    peakHeightIn: (HOWE_TRUSS_DEFAULT_SPAN_IN / 2) * (CLASSIC_TRUSS_DEFAULT_PITCH_IN12 / 12),
    build: () => buildHoweTrussMembers(),
  },
  {
    id: "pratt",
    label: "Pratt",
    description: "Howe's mirror image — diagonal webs in tension leaning toward the supports, vertical posts in compression.",
    defaultSpanIn: PRATT_TRUSS_DEFAULT_SPAN_IN,
    peakHeightIn: (PRATT_TRUSS_DEFAULT_SPAN_IN / 2) * (CLASSIC_TRUSS_DEFAULT_PITCH_IN12 / 12),
    build: () => buildPrattTrussMembers(),
  },
  {
    id: "scissor",
    label: "Scissor",
    description: "A vaulted-ceiling profile — the bottom chord is 2 shallower-pitched ties that cross each other near mid-span.",
    defaultSpanIn: SCISSOR_TRUSS_DEFAULT_SPAN_IN,
    peakHeightIn: (SCISSOR_TRUSS_DEFAULT_SPAN_IN / 2) * (SCISSOR_TRUSS_DEFAULT_TOP_PITCH_IN12 / 12),
    build: () => buildScissorTrussMembers(),
  },
];

export const CLASSIC_TRUSS_DISCLAIMER =
  "This is a basic outline and estimate only — a simplified, illustrative member layout at a representative span/pitch, " +
  "not an engineered truss design. Real truss member sizes, spacing, plate connectors, and bracing are span-, load-, " +
  "species-, and code-specific engineering output. Refer to a licensed truss manufacturer for an actual engineered " +
  "truss package before fabricating or building anything shown here.";

export function buildClassicTrussSchema(trussType: ClassicTrussTypeDef): PanelComponentSchema {
  const members = trussType.build();
  return {
    schemaVersion: "0.1",
    componentType: "connection_detail",
    id: `classic_truss_${trussType.id}`,
    displayName: `${trussType.label} Truss (Classic Reference)`,
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: trussType.peakHeightIn, widthIn: trussType.defaultSpanIn, depthIn: CHORD_DIMS.thicknessIn },
    members,
    fasteners: [],
    notes: [
      { type: "deviation", text: CLASSIC_TRUSS_DISCLAIMER },
      {
        type: "deviation",
        text: "Every chord/web angle-cut end is simplified to a straight tilted box, not true beveled geometry or metal plate connectors — same simplification as every other diagonal brace in this app.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}

// --- High-performance trusses (Tommy: "designing for a high performance
// house here with no details left at least as options") --------------------
//
// Unlike the 6 fixed-parameter classic profiles above, these 2 truss types
// are meant to be actually configured per project: adjustable pitch (2/12
// to 12/12) and a selectable 18in/24in insulation cavity depth with a big
// raised ("energy") heel — the real point of a raised heel is holding the
// FULL cavity depth uncompressed all the way out to the wall line, instead
// of tapering to nothing the way a conventional truss's heel does (see
// APA's "Raised-Heel Trusses" guidance and the Building Science /DOE
// raised-heel explainer researched for this feature). Both bear on this
// app's own existing 5.5in-inset truss bearing member (see
// trussPlateInsetDefaultIn/bearingEdgeReferenceOptions in data.ts) —
// `buildHighPerfTrussBearingMembers` below composes either the existing
// 3-ply 2x12 roof-catcher beam or a single 1-3/4in x 14in LVL underneath
// the truss for the 3D preview, matching Tommy's "have them sit on the
// 2x12's that are up there (or 14in LVL)".

export const HIGH_PERF_TRUSS_MIN_PITCH_IN12 = 2;
export const HIGH_PERF_TRUSS_MAX_PITCH_IN12 = 12;
export const HIGH_PERF_TRUSS_CAVITY_DEPTH_OPTIONS_IN = [18, 24] as const;
export type HighPerfTrussCavityDepthIn = (typeof HIGH_PERF_TRUSS_CAVITY_DEPTH_OPTIONS_IN)[number];
export const HIGH_PERF_TRUSS_DEFAULT_SPAN_IN = 30 * 12;

/** Clamped to the 2/12-12/12 range Tommy specified — every builder below
 * applies this rather than trusting the caller, so a UI slider/input can't
 * silently produce an out-of-range roof. */
export function clampHighPerfTrussPitchIn12(pitchIn12: number): number {
  return Math.min(HIGH_PERF_TRUSS_MAX_PITCH_IN12, Math.max(HIGH_PERF_TRUSS_MIN_PITCH_IN12, pitchIn12));
}

/**
 * Like `buildTrussWebBraces` (see panelMemberHelpers.ts), but for two
 * PARALLEL sloped chords — both `bottomZAt`/`topZAt` vary with x, instead
 * of one flat chord + one possibly-sloped chord. Needed for the
 * parallel-chord truss below, where both chords share the same pitch and
 * differ only by the constant vertical offset `cavityDepthIn`.
 */
function buildParallelWebZigzag(
  peakCount: number,
  spanIn: number,
  bottomZAt: (xIn: number) => number,
  topZAt: (xIn: number) => number,
  idPrefix: string,
): PanelMember[] {
  const members: PanelMember[] = [];
  const segWidthIn = spanIn / peakCount;

  for (let i = 0; i < peakCount; i++) {
    const footLeftXIn = i * segWidthIn;
    const footRightXIn = (i + 1) * segWidthIn;
    const peakXIn = footLeftXIn + segWidthIn / 2;
    members.push(
      makeTrussMember(
        `${idPrefix}_${i + 1}_rise`,
        footLeftXIn,
        bottomZAt(footLeftXIn),
        peakXIn,
        topZAt(peakXIn),
        WEB_DIMS,
        WEB_NOMINAL_SIZE,
        "brace",
        `web ${i + 1} of ${peakCount}, rising from the bottom chord to the top chord.`,
      ),
      makeTrussMember(
        `${idPrefix}_${i + 1}_fall`,
        peakXIn,
        topZAt(peakXIn),
        footRightXIn,
        bottomZAt(footRightXIn),
        WEB_DIMS,
        WEB_NOMINAL_SIZE,
        "brace",
        `web ${i + 1} of ${peakCount}, falling from the top chord back to the bottom chord.`,
      ),
    );
  }
  return members;
}

/**
 * Energy-Heel (raised-heel) Truss — a conventional peaked truss with the
 * whole top chord shifted up by `cavityDepthIn` at the heel, held up by a
 * vertical heel post at each end, so the truss holds its full cavity depth
 * all the way out to the wall line instead of tapering to nothing. A real,
 * known tradeoff: the ridge ends up `cavityDepthIn` taller than a
 * conventional (non-raised-heel) truss at the same span/pitch — not
 * something a real design can avoid, so this geometry doesn't hide it.
 */
export function buildEnergyHeelTrussMembers(
  spanIn: number = HIGH_PERF_TRUSS_DEFAULT_SPAN_IN,
  pitchIn12: number = CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
  cavityDepthIn: HighPerfTrussCavityDepthIn = 18,
): PanelMember[] {
  const clampedPitchIn12 = clampHighPerfTrussPitchIn12(pitchIn12);
  const topChordZAt = (xIn: number) => cavityDepthIn + (xIn <= spanIn / 2 ? xIn : spanIn - xIn) * (clampedPitchIn12 / 12);
  const peakZIn = topChordZAt(spanIn / 2);
  const peakCount = computeTrussWebPeakCount(spanIn, peakZIn - cavityDepthIn);

  return [
    makeTrussMember("bottom_chord", 0, 0, spanIn, 0, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Bottom chord (ceiling/attic-floor line), full span."),
    makeTrussMember(
      "heel_post_left",
      0,
      0,
      0,
      cavityDepthIn,
      WEB_DIMS,
      WEB_NOMINAL_SIZE,
      "stud",
      `Left raised heel — holds the full ${cavityDepthIn}in insulation cavity out to the wall line.`,
    ),
    makeTrussMember(
      "heel_post_right",
      spanIn,
      0,
      spanIn,
      cavityDepthIn,
      WEB_DIMS,
      WEB_NOMINAL_SIZE,
      "stud",
      `Right raised heel — holds the full ${cavityDepthIn}in insulation cavity out to the wall line.`,
    ),
    makeTrussMember("top_chord_left", 0, cavityDepthIn, spanIn / 2, peakZIn, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, left slope, heel to ridge."),
    makeTrussMember("top_chord_right", spanIn / 2, peakZIn, spanIn, cavityDepthIn, CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, right slope, ridge to heel."),
    ...buildTrussWebBraces(peakCount, spanIn, 0, topChordZAt, 0, "energy_heel_web"),
  ];
}

/**
 * Parallel Chord Truss — both chords share the same pitch, offset by a
 * constant `cavityDepthIn` (a Warren-style zigzag web between them) — the
 * classic shape for a shed roof's single, unbroken slope, still holding a
 * full uncompressed insulation cavity at both ends via the same raised
 * end-post idea as the Energy-Heel truss above.
 */
export function buildParallelChordTrussMembers(
  spanIn: number = HIGH_PERF_TRUSS_DEFAULT_SPAN_IN,
  pitchIn12: number = CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
  cavityDepthIn: HighPerfTrussCavityDepthIn = 18,
): PanelMember[] {
  const clampedPitchIn12 = clampHighPerfTrussPitchIn12(pitchIn12);
  const bottomChordZAt = (xIn: number) => xIn * (clampedPitchIn12 / 12);
  const topChordZAt = (xIn: number) => bottomChordZAt(xIn) + cavityDepthIn;
  const peakCount = computeTrussWebPeakCount(spanIn, cavityDepthIn);

  return [
    makeTrussMember(
      "bottom_chord",
      0,
      bottomChordZAt(0),
      spanIn,
      bottomChordZAt(spanIn),
      CHORD_DIMS,
      CHORD_NOMINAL_SIZE,
      "plate",
      "Bottom chord, sloped parallel to the top chord (shed-roof pitch), full span.",
    ),
    makeTrussMember("top_chord", 0, topChordZAt(0), spanIn, topChordZAt(spanIn), CHORD_DIMS, CHORD_NOMINAL_SIZE, "plate", "Top chord, sloped parallel to the bottom chord, full span."),
    makeTrussMember(
      "heel_post_left",
      0,
      bottomChordZAt(0),
      0,
      topChordZAt(0),
      WEB_DIMS,
      WEB_NOMINAL_SIZE,
      "stud",
      `Left end post — holds the full ${cavityDepthIn}in depth out to the wall line.`,
    ),
    makeTrussMember(
      "heel_post_right",
      spanIn,
      bottomChordZAt(spanIn),
      spanIn,
      topChordZAt(spanIn),
      WEB_DIMS,
      WEB_NOMINAL_SIZE,
      "stud",
      `Right end post — holds the full ${cavityDepthIn}in depth out to the wall line.`,
    ),
    ...buildParallelWebZigzag(peakCount, spanIn, bottomChordZAt, topChordZAt, "parallel_web"),
  ];
}

export type HighPerfTrussBearingShapeId = "built-up-3ply-2x12" | "lvl-14in";

export interface HighPerfTrussBearingShapeDef {
  id: HighPerfTrussBearingShapeId;
  label: string;
  depthIn: number;
}

/** The 2 bearing-member options Tommy asked for ("have them sit on the
 * 2x12's that are up there (or 14in LVL)") — `depthIn` is how far the
 * bearing member's own top surface sits below the truss's local Z=0 origin
 * once composed in a 3D preview (see TrussPreview.tsx). */
export const HIGH_PERF_TRUSS_BEARING_SHAPES: HighPerfTrussBearingShapeDef[] = [
  { id: "built-up-3ply-2x12", label: "Built-up 3-ply 2x12", depthIn: ROOF_CATCHER_BEAM_DEPTH_IN },
  { id: "lvl-14in", label: "LVL 1-3/4in x 14in", depthIn: 14 },
];

export function buildHighPerfTrussBearingMembers(spanIn: number, shapeId: HighPerfTrussBearingShapeId): PanelMember[] {
  if (shapeId === "built-up-3ply-2x12") return buildRoofCatcherBeamMembers(spanIn);
  return [
    {
      memberId: "bearing_lvl",
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "LVL 1-3/4in x 14in",
      actualDimsIn: { thicknessIn: 1.75, widthIn: 14, lengthIn: spanIn },
      orientation: "horizontal",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Single-ply 1-3/4in x 14in LVL bearing member, on edge — an alternative to the built-up 3-ply 2x12.",
    },
  ];
}

function highPerfTrussNotes(clampedPitchIn12: number, cavityDepthIn: HighPerfTrussCavityDepthIn, bearingShapeId: HighPerfTrussBearingShapeId): PanelComponentSchema["notes"] {
  const bearing = HIGH_PERF_TRUSS_BEARING_SHAPES.find((b) => b.id === bearingShapeId)!;
  return [
    { type: "deviation", text: CLASSIC_TRUSS_DISCLAIMER },
    {
      type: "deviation",
      text: `${clampedPitchIn12}/12 pitch (adjustable ${HIGH_PERF_TRUSS_MIN_PITCH_IN12}/12-${HIGH_PERF_TRUSS_MAX_PITCH_IN12}/12), ${cavityDepthIn}in raised-heel insulation cavity — the ridge sits ${cavityDepthIn}in taller than a conventional (non-raised-heel) truss at the same span/pitch would, a real tradeoff of this design, not an oversight.`,
    },
    {
      type: "deviation",
      text: `Bears on a ${bearing.label} (${bearing.depthIn}in deep) at this app's existing 5.5in truss-bearing inset (see the Roof tab's Bottom edge reference) — the other bearing-member shape remains a label-only alternative here, same as roofCatcherBeamShapeOptions.`,
    },
    {
      type: "deviation",
      text: "Every chord/web angle-cut end is simplified to a straight tilted box, not true beveled geometry or metal plate connectors.",
    },
  ];
}

export function buildEnergyHeelTrussSchema(
  spanIn: number,
  pitchIn12: number,
  cavityDepthIn: HighPerfTrussCavityDepthIn,
  bearingShapeId: HighPerfTrussBearingShapeId,
): PanelComponentSchema {
  const clampedPitchIn12 = clampHighPerfTrussPitchIn12(pitchIn12);
  const peakZIn = cavityDepthIn + (spanIn / 2) * (clampedPitchIn12 / 12);
  return {
    schemaVersion: "0.1",
    componentType: "connection_detail",
    id: "energy_heel_truss",
    displayName: `Energy-Heel Truss (${clampedPitchIn12}/12 pitch, ${cavityDepthIn}in cavity)`,
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: peakZIn, widthIn: spanIn, depthIn: CHORD_DIMS.thicknessIn },
    members: buildEnergyHeelTrussMembers(spanIn, pitchIn12, cavityDepthIn),
    fasteners: [],
    notes: highPerfTrussNotes(clampedPitchIn12, cavityDepthIn, bearingShapeId),
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}

export function buildParallelChordTrussSchema(
  spanIn: number,
  pitchIn12: number,
  cavityDepthIn: HighPerfTrussCavityDepthIn,
  bearingShapeId: HighPerfTrussBearingShapeId,
): PanelComponentSchema {
  const clampedPitchIn12 = clampHighPerfTrussPitchIn12(pitchIn12);
  const topEndZIn = cavityDepthIn + spanIn * (clampedPitchIn12 / 12);
  return {
    schemaVersion: "0.1",
    componentType: "connection_detail",
    id: "parallel_chord_truss",
    displayName: `Parallel Chord Truss (${clampedPitchIn12}/12 pitch, ${cavityDepthIn}in deep, shed roof)`,
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: topEndZIn, widthIn: spanIn, depthIn: CHORD_DIMS.thicknessIn },
    members: buildParallelChordTrussMembers(spanIn, pitchIn12, cavityDepthIn),
    fasteners: [],
    notes: highPerfTrussNotes(clampedPitchIn12, cavityDepthIn, bearingShapeId),
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
