import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
  TRUSS_WEB_MIN_ANGLE_DEG,
  buildHeaderTrussWebBraces,
  computeBraceEndCutAngleDeg,
  computeTrussWebAngleDeg,
} from "./panelMemberHelpers";

/**
 * Tommy: "i believe the math with the triangle parts of the headers cannot
 * go outside the range of 30-45 degrees" — TRUSS_WEB_MIN_ANGLE_DEG (30) is
 * shared with the gable/braced-panel bracing; this is the header-specific
 * upper bound. Every header (door AND window — see `buildHeaderMembers`'s
 * own doc comment) is now capped at exactly 1 peak regardless of the angle
 * that produces; a window/door whose single-peak angle falls outside this
 * range doesn't get more peaks added anymore — its own slot auto-upgrades
 * to a Big Header instead (see apps/web/app/bigHeaderAutoUpgrade.ts, which
 * imports this constant directly). Exported so that trigger can reuse the
 * exact same threshold rather than duplicating it.
 */
export const HEADER_MAX_ANGLE_DEG = 45;

/**
 * Top + bottom chord 2x4s, on both wythes (Tommy: "window and door headers
 * have the V framing on interior and exterior"), plus a plywood cap tying
 * each chord's 2 wythes into one rigid plate (Tommy: "we need to add the
 * plywood in the top and bottom plate"). The plywood is the OUTER face of
 * each chord — flush with the header's own top/bottom, the same
 * skin-then-plate layering every other panel type uses (see `buildPlates`:
 * skins outermost, 2x4 plates just inside them) — with the 2x4s just
 * inside it, facing the truss web cavity (Tommy: "for the top plate, the
 * 3/4in plywood should be on top with the 2x4's under... for the header
 * bottom plate, the plywood is on the bottom with the 2x4's facing the
 * middle of the panel" — the previous ordering had this backwards). The
 * truss web braces (see `buildTrussWebBraces`) bear against the 2x4s' own
 * inner faces. Otherwise no skins of its own (like the Plywood Jack Stud,
 * this is a sub-assembly that sits inside a larger wall panel's own rough
 * opening, not a free-standing panel).
 */
function buildHeaderChords(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const members: PanelMember[] = [];
  const bottomPlyZIn = 0;
  const bottom2x4ZIn = SKIN_THICKNESS_IN;
  const topPlyZIn = heightIn - SKIN_THICKNESS_IN;
  const top2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;

  for (const [chord, zIn, otherChord] of [
    ["bottom", bottom2x4ZIn, "top"],
    ["top", top2x4ZIn, "bottom"],
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
        notes: `${chord} chord, ${wythe} wythe — inside the ${chord} plywood cap, facing the cavity; the truss web braces span between this and the ${otherChord} chord.`,
      });
    }
  }

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
      notes: `${chord} plate plywood cap — the header's own outer face, flush with the ${chord === "bottom" ? "RO/jack studs below" : "wall's top plate above"}; ties both wythes' ${chord} chord 2x4s into one rigid plate from the inside.`,
    });
  }
  return members;
}

/**
 * The header's own 2 end caps (Tommy: "headers for doors and windows need
 * to have plywood on the panel thickness side, not the interior and
 * exterior faces" — confirmed against the SketchUp reference render, which
 * shows a solid plywood face on the header's END while the front/ext-int
 * faces stay open, showing the truss web directly) — a full-depth x
 * full-height sheet on each end, thin in width, the same role
 * `buildColumnSidePly` plays for a Column Panel's own two side faces (same
 * axis, just spanning the header's own `widthIn` instead of a fixed column
 * core width). Left at the header's own X=0/X=widthIn extremes rather than
 * insetting the chords/truss web to make room — these end caps slightly
 * overlap the top/bottom chord-ply Z-caps at the 4 corners (both are
 * full-span sheets meeting at 90deg), an illustrative simplification, same
 * class as the corner-overlap `computeStandardPanelStrawVolume` already
 * documents for member volume.
 */
function buildHeaderEndCaps(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return (["left", "right"] as const).map((side) => ({
    memberId: `${side}_end_ply`,
    material: "plywood",
    speciesGrade: null,
    plySpec: SKIN_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: heightIn },
    orientation: "vertical",
    position: { xIn: side === "left" ? 0 : widthIn - SKIN_THICKNESS_IN, yIn: 0, zIn: 0, rotationDeg: 0 },
    role: "skin",
    qty: 1,
    notes: `${side} end — the header's own "panel thickness" face (full depth x full height, thin in width).`,
  }));
}

/** The rise (in) available to the truss web between the chords' plywood-capped facing edges. */
export function headerWebRiseIn(heightIn: number): number {
  return heightIn - 2 * PLATE_2X4_THICKNESS_IN - 2 * SKIN_THICKNESS_IN;
}

/**
 * Shared construction behind both header variants (Tommy: "there are long
 * headers and door headers... door headers just have one upside down V as
 * a brace") — top/bottom chords plus a single-peak W-truss web (see
 * `buildTrussWebBraces`) between them, on both wythes. BOTH door and
 * window headers are now always exactly 1 peak (Tommy: "cap every header
 * at 1 V, auto-upgrade past that") — a window header used to get as many
 * peaks as `computeTrussWebPeakCount` said it needed to keep every web
 * segment at or above the 30deg minimum; a width/height combo that would
 * have needed more than 1 peak to satisfy that (or that pushes the single
 * peak's own angle past HEADER_MAX_ANGLE_DEG) no longer widens the header
 * itself — that opening's own SLOT auto-upgrades to a Big Header instead
 * (see apps/web/app/bigHeaderAutoUpgrade.ts), which reuses the same
 * multi-peak math this function used to have (see bigHeaderMembers.ts).
 */
function buildHeaderMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  // The web bears against each chord's own 2x4 face (see buildHeaderChords
  // — the 2x4 is the inner member, the plywood cap is outer), one skin
  // thickness inboard of the header's own outer face on each side.
  const bottomChordTopZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const topChordBottomZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  const peakCount = 1;

  const members: PanelMember[] = [...buildHeaderChords(widthIn, depthIn, heightIn), ...buildHeaderEndCaps(widthIn, depthIn, heightIn)];
  for (const [wythe, yIn] of [
    ["ext", PLATE_2X4_THICKNESS_IN / 2],
    ["int", depthIn - PLATE_2X4_THICKNESS_IN / 2],
  ] as const) {
    members.push(
      ...buildHeaderTrussWebBraces(peakCount, widthIn, bottomChordTopZIn, topChordBottomZIn, yIn, `truss_brace_${wythe}`),
    );
  }
  return members;
}

/** Door Header: always exactly 1 peak ("one upside down V"), on both wythes. */
export function buildDoorHeaderMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return buildHeaderMembers(widthIn, depthIn, heightIn);
}

/** Window Header: also always exactly 1 peak now — see `buildHeaderMembers`'s own doc comment. */
export function buildWindowHeaderMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return buildHeaderMembers(widthIn, depthIn, heightIn);
}

function angleNote(widthIn: number, heightIn: number, peakCount: number): { type: "warning"; text: string } | null {
  const angleDeg = computeTrussWebAngleDeg(widthIn, headerWebRiseIn(heightIn), peakCount);
  if (angleDeg >= TRUSS_WEB_MIN_ANGLE_DEG && angleDeg <= HEADER_MAX_ANGLE_DEG) return null;
  return {
    type: "warning",
    text: `Resulting web brace angle (${angleDeg.toFixed(1)}deg) falls outside the target ${TRUSS_WEB_MIN_ANGLE_DEG}-${HEADER_MAX_ANGLE_DEG}deg range for this opening's width/height — flagged, not auto-corrected.`,
  };
}

/**
 * The real fabrication cut for every truss web brace's ends (Tommy: "lets
 * come up with a way to really hone in on the math involved with cutting
 * the angles of braced panels" / "Header panels on windows and doors
 * braces need to be trapeziod, have the insides of their long points
 * meet" — later corrected: "there are no plum[b] cuts on headers... the
 * trapezoid has parallel cuts that meet the top and bottom chords") —
 * pulled directly from a real built brace's own `tiltDeg`, not re-derived,
 * so it can never drift out of sync with whatever the actual geometry
 * produces. See `computeBraceEndCutAngleDeg`'s own doc comment for the
 * full derivation. Every brace here shares the same tilt magnitude (a
 * header's top/bottom chords are always flat, so every peak's rise/fall is
 * geometrically identical), so one representative brace's angle describes
 * the whole set. Every brace is now a true beveled trapezoid (see
 * `buildHeaderTrussWebBraces`/`computeHeaderBraceTrapezoidCornersIn`), not
 * a plain tilted box — every end, including internal peaks/feet (Tommy,
 * live in the app, on an earlier miter-based version of this: "each tip
 * of the dimensional lumber edge of the braces should move away from the
 * center until their tips meet... with no space"), is a plain LEVEL cut
 * flush against its own chord (top or bottom), never a plumb cut — a
 * header has no internal vertical member to plumb against.
 */
function braceCutAngleNote(members: PanelMember[]): { type: "deviation"; text: string } | null {
  const brace = members.find((m) => m.role === "brace" && m.position.tiltDeg !== undefined);
  if (!brace) return null;
  const cutAngleDeg = computeBraceEndCutAngleDeg(brace.position.tiltDeg!);
  return {
    type: "deviation",
    text:
      `Each truss web brace tilts ${cutAngleDeg.toFixed(1)}deg off vertical and is a true beveled trapezoid, not a ` +
      "simplified straight box. Every end — the header's own 2 outermost feet, every internal peak, and every " +
      "internal foot (on a multi-peak window header) — is a plain level cut flush against its own chord (top or " +
      "bottom), never a plumb cut; adjacent braces meeting at a peak or internal foot land flush against each " +
      "other with no gap and no overlap (one miter-saw blade-tilt setting per cut, no compound angle).",
  };
}

export function buildDoorHeaderSchema(widthIn: number, depthIn: number, heightIn: number): PanelComponentSchema {
  const members = buildDoorHeaderMembers(widthIn, depthIn, heightIn);
  const notes: PanelComponentSchema["notes"] = [
    {
      type: "deviation",
      text:
        "Height is a real rough-opening-to-top-plate height (wall standard height minus the door's own RO height) " +
        "— see computeHeaderHeightIn.",
    },
  ];
  const cutAngle = braceCutAngleNote(members);
  if (cutAngle) notes.push(cutAngle);
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
    members,
    fasteners: [],
    notes,
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}

export function buildWindowHeaderSchema(widthIn: number, depthIn: number, heightIn: number): PanelComponentSchema {
  const peakCount = 1;
  const members = buildWindowHeaderMembers(widthIn, depthIn, heightIn);
  const notes: PanelComponentSchema["notes"] = [
    {
      type: "deviation",
      text:
        "Height is a real rough-opening-to-top-plate height (wall standard height minus the sill height and the " +
        "selected window height) — see computeHeaderHeightIn.",
    },
    {
      type: "warning",
      text: `${peakCount} truss web peak at this opening's width/height — every header is now capped at 1 peak; a width/height combo that can't stay within ${TRUSS_WEB_MIN_ANGLE_DEG}-${HEADER_MAX_ANGLE_DEG}deg at 1 peak auto-upgrades that opening to a Big Header instead of adding more peaks.`,
    },
  ];
  const cutAngle = braceCutAngleNote(members);
  if (cutAngle) notes.push(cutAngle);
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
    members,
    fasteners: [],
    notes,
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
