import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
  TRUSS_WEB_MIN_ANGLE_DEG,
  buildHeaderEndStuds,
  buildHeaderTrussWebBraces,
  computeBraceEndCutAngleDeg,
  computeTrussWebAngleDeg,
  computeTrussWebPeakCount,
} from "./panelMemberHelpers";

/**
 * Tommy: *"i believe the math with the triangle parts of the headers cannot
 * go outside the range of 30-45 degrees"*.
 *
 * ⚠ **IT IS A NOTE NOW, NOT A TRIGGER — 2026-11-03.** It used to be the
 * threshold that retyped a panel: every header was capped at exactly 1 peak,
 * and a window or door whose single peak fell outside 30-45deg had its whole
 * SLOT auto-upgraded to a Big Header. Two things were wrong with that.
 *
 * > *"Headers can have more than one peak. Big headers and window headers are
 * > really the same thing."* — Tommy, 2026-11-03
 *
 * First, **more peaks is the actual answer to a shallow web**, and the math
 * for it never went away — `computeTrussWebPeakCount` adds peaks until every
 * segment clears the 30deg floor, which is what a wide header has always
 * needed and what a Big Header was already doing.
 *
 * Second, **the ceiling could not be satisfied by peaks at all, and that is
 * the direction the app's own defaults hit.** Measured 2026-11-03: a 120in
 * wall with a 32in sill and a 48in rough opening leaves a 40in-deep header,
 * whose single web runs at **56deg**. Adding peaks makes a web STEEPER, never
 * shallower, so no peak count rescues it — and the auto-upgrade therefore
 * fired on every ordinary window the user touched. Asked which gave way,
 * Tommy chose to **drop the ceiling and keep the floor**: a deep header is a
 * steep truss, which is stiffer rather than weaker.
 *
 * So this is still reported on the fabrication sheet, and a web past it is
 * still worth his engineer's eye. It no longer changes what gets built.
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

/** The rise (in) available to the truss web between the chords' plywood-capped facing edges. */
export function headerWebRiseIn(heightIn: number): number {
  return heightIn - 2 * PLATE_2X4_THICKNESS_IN - 2 * SKIN_THICKNESS_IN;
}

/**
 * Shared construction behind every header (Tommy: "there are long headers and
 * door headers... door headers just have one upside down V as a brace") —
 * top/bottom chords plus a W-truss web (see `buildTrussWebBraces`) between
 * them, on both wythes.
 *
 * ⚠ **The peak count is derived again, not forced to 1** (2026-11-03 —
 * *"Headers can have more than one peak"*). `computeTrussWebPeakCount` adds
 * peaks until every web segment clears `TRUSS_WEB_MIN_ANGLE_DEG`, which is
 * the same call `buildBigHeaderMembers` has been making all along: that is
 * what *"big headers and window headers are really the same thing"* means
 * here, and it is why the Big Header auto-upgrade could be deleted outright.
 *
 * A door header still comes back with exactly one peak at any ordinary size —
 * a 36in opening under a 15in-deep header needs 1 — so *"door headers just
 * have one upside down V"* is still what gets built; it is now a consequence
 * of the rule rather than an exception carved out of it.
 *
 * ⚠ What still differs between this and `buildBigHeaderMembers`: its chords
 * are rotated 90deg (a 3.5in face in elevation) and it carries its own jack
 * studs. Both are deliberate and separately specified; neither was part of
 * the "same thing".
 */
function buildHeaderMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  // The web bears against each chord's own 2x4 face (see buildHeaderChords
  // — the 2x4 is the inner member, the plywood cap is outer), one skin
  // thickness inboard of the header's own outer face on each side.
  const bottomChordTopZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const topChordBottomZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  const peakCount = headerPeakCount(widthIn, heightIn);

  const members: PanelMember[] = [
    ...buildHeaderChords(widthIn, depthIn, heightIn),
    /* ⚠ Its two ends, framed like a standard panel's — see
       `buildHeaderEndStuds`, which every header-like assembly shares. */
    ...buildHeaderEndStuds(widthIn, depthIn, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN, headerWebRiseIn(heightIn)),
  ];
  for (const [wythe, yIn] of [
    ["ext", PLATE_2X4_THICKNESS_IN / 2],
    ["int", depthIn - PLATE_2X4_THICKNESS_IN / 2],
  ] as const) {
    members.push(
      /* ⚠ The feet stop at the 2x4 end stud's inner face, not at a 3/4in
         sheet's — his *"this may bring that tip and angle of the diagonal
         towards the center of the header panel a little bit."* */
      ...buildHeaderTrussWebBraces(
        peakCount,
        widthIn,
        bottomChordTopZIn,
        topChordBottomZIn,
        yIn,
        `truss_brace_${wythe}`,
        PLATE_2X4_THICKNESS_IN,
      ),
    );
  }
  return members;
}

/** Door Header: one upside-down V at any ordinary door size, more peaks if a
 *  wide one would otherwise leave its webs under 30deg. */
export function buildDoorHeaderMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return buildHeaderMembers(widthIn, depthIn, heightIn);
}

/** Window Header: the same assembly and the same rule — see
 *  `buildHeaderMembers`'s own doc comment. */
export function buildWindowHeaderMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return buildHeaderMembers(widthIn, depthIn, heightIn);
}

/**
 * How many peaks this header's web gets. **The single place that decides it**,
 * so the members, the peak-count note and the angle note can never describe
 * three different trusses.
 */
export function headerPeakCount(widthIn: number, heightIn: number): number {
  return computeTrussWebPeakCount(widthIn, headerWebRiseIn(heightIn));
}

/** The web angle this header actually gets built at. */
export function headerWebAngleDeg(widthIn: number, heightIn: number): number {
  return computeTrussWebAngleDeg(widthIn, headerWebRiseIn(heightIn), headerPeakCount(widthIn, heightIn));
}

/**
 * ⚠ **Reports, never corrects, and since 2026-11-03 only the STEEP side can
 * reach it.** `computeTrussWebPeakCount` adds peaks until every web clears
 * `TRUSS_WEB_MIN_ANGLE_DEG`, so a shallow web is now fixed rather than
 * flagged; a web past `HEADER_MAX_ANGLE_DEG` is a deep header, which no peak
 * count can shallow out, and which Tommy chose to build rather than refuse.
 */
function angleNote(widthIn: number, heightIn: number, peakCount: number): { type: "warning"; text: string } | null {
  const angleDeg = computeTrussWebAngleDeg(widthIn, headerWebRiseIn(heightIn), peakCount);
  if (angleDeg >= TRUSS_WEB_MIN_ANGLE_DEG && angleDeg <= HEADER_MAX_ANGLE_DEG) return null;
  const which =
    angleDeg > HEADER_MAX_ANGLE_DEG
      ? `steeper than the ${HEADER_MAX_ANGLE_DEG}deg top of the target range — this header is deep for its width, and adding peaks would only steepen it further`
      : `shallower than the ${TRUSS_WEB_MIN_ANGLE_DEG}deg floor of the target range, which should not be reachable: the peak count is solved for exactly that floor`;
  return {
    type: "warning",
    text: `Web brace angle ${angleDeg.toFixed(1)}deg at ${peakCount} peak${peakCount === 1 ? "" : "s"} — ${which}. Reported, not auto-corrected.`,
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
  const doorPeaks = headerPeakCount(widthIn, heightIn);
  notes.push({
    type: "deviation",
    text: `${doorPeaks} truss web peak${doorPeaks === 1 ? "" : "s"} — solved so every web segment clears ${TRUSS_WEB_MIN_ANGLE_DEG}deg (see computeTrussWebPeakCount). A door at any ordinary width comes back with the single upside-down V.`,
  });
  const cutAngle = braceCutAngleNote(members);
  if (cutAngle) notes.push(cutAngle);
  const angle = angleNote(widthIn, heightIn, doorPeaks);
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
  const peakCount = headerPeakCount(widthIn, heightIn);
  const members = buildWindowHeaderMembers(widthIn, depthIn, heightIn);
  const notes: PanelComponentSchema["notes"] = [
    {
      type: "deviation",
      text:
        "Height is a real rough-opening-to-top-plate height (wall standard height minus the sill height and the " +
        "selected window height) — see computeHeaderHeightIn.",
    },
    {
      type: "deviation",
      text: `${peakCount} truss web peak${peakCount === 1 ? "" : "s"} at this opening's width/height — solved so every web segment clears ${TRUSS_WEB_MIN_ANGLE_DEG}deg (see computeTrussWebPeakCount). This is the same rule a Big Header uses; the two are the same assembly.`,
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
