import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  HEADER_MIN_HEIGHT_IN,
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_PLY_SPEC,
} from "./panelMemberHelpers";

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
/**
 * ⚠ **THE SHEET IS RIGHT, AND THE 2x4s ARE AN ADDITION TO IT — 2026-11-14.**
 *
 * > *"I misunderstood the plywood. Jack stud question, those are definitely
 * > supposed to be plywood. It would be nice if there was an option to change
 * > or add 2x4s to the jack studs. Perhaps Jack studs should have editable
 * > options to add a 2x4 to the inside and a 2x4 to the outside, making Jack
 * > studs default 3/4 in horizontal elevation view with the option of adding
 * > 2x4s to make them two and a quarter horizontal elevation view length."*
 *
 * His earlier *"I don't think we need plywood skins on either side"* was
 * about a HEADER'S ENDS, which stopped being plywood on 2026-11-01. It never
 * covered these, and reading it as if it did was my mistake.
 *
 * ⚠ **"Inside" and "outside" are the two WYTHES, not two sides along the
 * wall, and that is the only reading under which his 2 1/4in works.** The
 * sheet is panel-depth wide, so it already spans both wythes; a 2x4 added at
 * each wythe sits beside it in the SAME 1 1/2in band of elevation length.
 * 0.75 + 1.5 = 2.25 with one 2x4 or with both. End to end along the wall it
 * would be 3.75in and contradict his own number.
 *
 * `"2x4-stud"` is the pre-existing REPLACE mode (*"change ... 2x4s"*) and is
 * unchanged, so a design drawn with it still builds what it always did.
 */
export type JackStudConfig =
  /** The default: one 3/4in sheet, panel-depth wide. */
  | "plywood"
  /** Studs INSTEAD of the sheet — pre-existing, unchanged. */
  | "2x4-stud"
  | "plywood+ext-2x4"
  | "plywood+int-2x4"
  /** The sheet plus a 2x4 at each wythe — his 2 1/4in. */
  | "plywood+2x4";

export const JACK_STUD_THICKNESS_IN = 0.75;

/** Every configuration, in the order the control offers them: the default
 *  first, then the additions, then the replace mode. */
export const JACK_STUD_CONFIGS: readonly JackStudConfig[] = [
  "plywood",
  "plywood+ext-2x4",
  "plywood+int-2x4",
  "plywood+2x4",
  "2x4-stud",
];

/** Does this configuration include the plywood sheet? */
export function jackStudHasSheet(config: JackStudConfig): boolean {
  return config !== "2x4-stud";
}

/** Which wythes get a 2x4 beside (or instead of) the sheet. */
export function jackStud2x4Wythes(config: JackStudConfig): readonly ("ext" | "int")[] {
  switch (config) {
    case "plywood":
      return [];
    case "plywood+ext-2x4":
      return ["ext"];
    case "plywood+int-2x4":
      return ["int"];
    case "2x4-stud":
    case "plywood+2x4":
      return ["ext", "int"];
  }
}

/**
 * In-plane (along-the-slot) thickness one jack stud eats into the slot's own
 * width. Used by `computeRoughOpeningWidthIn` below — and by a Big Header's
 * chord lengths and its web's end inset, so this number is not cosmetic: a
 * thicker jack takes its difference out of the rough opening on BOTH sides.
 *
 * ⚠ Both wythes' 2x4s occupy the same band, so one or two costs the same
 * 1 1/2in — see `JackStudConfig`'s own note on why that is the reading.
 */
export function jackStudThicknessIn(config: JackStudConfig): number {
  return (
    (jackStudHasSheet(config) ? JACK_STUD_THICKNESS_IN : 0) +
    (jackStud2x4Wythes(config).length > 0 ? PLATE_2X4_THICKNESS_IN : 0)
  );
}

/** What this configuration is called wherever it is shown — the control, the
 *  two Rough Opening detail tables and the fastener notes all read this, so
 *  they cannot describe three different jack studs. */
export function jackStudConfigLabel(config: JackStudConfig): string {
  const sheet = jackStudHasSheet(config) ? "3/4in plywood sheet" : "";
  const wythes = jackStud2x4Wythes(config);
  const studs =
    wythes.length === 0
      ? ""
      : wythes.length === 2
        ? "2x4 at both wythes"
        : `2x4 at the ${wythes[0] === "ext" ? "exterior" : "interior"} wythe`;
  if (sheet && studs) return `${sheet} + ${studs}`;
  return sheet || studs;
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

/**
 * The header's real height (Tommy: "headers should be sized from the RO to
 * the top of the wall panel standard height") — everything above the
 * rough opening's own top, up to the wall's own top plate line, instead of
 * the old flat illustrative default. `roTopZIn` is the RO's top elevation
 * measured from the floor — a door's is just its own RO height (it starts
 * at the floor); a window's is the sill height plus the window's own
 * selected RO height (it starts on top of the sill) — see
 * `standardWindowHeightsIn`/`standardWindowHeightDefaultIn` in data.ts.
 */
export function computeHeaderHeightIn(wallHeightIn: number, roTopZIn: number): number {
  const rawIn = wallHeightIn - roTopZIn;
  /* ⚠ Zero still means NO HEADER, and that is a different answer from a thin
     one. An opening as tall as its wall (or taller) has nowhere for a header
     to go, which is its own reading in the Review Log and is deliberately
     left as it was. */
  if (!(rawIn > 0)) return 0;
  /* ⚠ **FLOORED AT ITS OWN LAYER SUM — his call, 2026-11-14.** A derived
     height can land under 4.5in, and under 4.5in the two chords are drawn
     through each other: the assembly is thinner than the boards in it.
     `computeOpeningGeometry` drops the rough opening's top by the shortfall
     so the two stay consistent, and reports it. See `HEADER_MIN_HEIGHT_IN`. */
  return Math.max(rawIn, HEADER_MIN_HEIGHT_IN);
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
        /* ⚠ ONE SCHEDULE, 2026-11-19 — Tommy: "might as well just have jack
           studs also get big screws. just the one schedule." Supersedes the
           2x 4in T25 #9 every 6in this note used to carry. */
        "One of a pair (one each side of the rough opening) — screwed to the adjacent wall panel with 4in GRK " +
        "5/16in structural screws on the panel-to-panel schedule: 16in o.c. to the exterior face, 24in o.c. to the interior.",
    },
  ];
}

/**
 * ⚠ **`xIn` is where they start, and it is NOT always 0.** Beside a sheet
 * they stand INBOARD of it, toward the rough opening, because the sheet is
 * the piece screwed to the adjacent wall panel — so the order across the
 * slot edge is wall panel, sheet, 2x4, then the opening. Without the sheet
 * they take its place at the edge, which is the pre-existing behaviour.
 */
function build2x4JackStuds(
  depthIn: number,
  heightIn: number,
  wythes: readonly ("ext" | "int")[],
  xIn: number,
): PanelMember[] {
  return wythes.map((wythe) => ({
    memberId: `jack_stud_2x4_${wythe}`,
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: heightIn },
    orientation: "vertical",
    position: { xIn, yIn: wythe === "ext" ? 0 : depthIn - PLATE_2X4_WIDTH_IN, zIn: 0, rotationDeg: 0 },
    role: "jack_stud",
    qty: 1,
    notes:
      `${wythe}-wythe jack stud, one side of a pair (one each side of the rough opening) — ` +
      (xIn > 0
        ? "standing inboard of the 3/4in jack sheet, against its inside face, so the sheet still lands on the adjacent wall panel."
        : "positioned flush with the adjacent wall panel's own corner/standard stud, right at the slot's perimeter."),
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
  const hasSheet = jackStudHasSheet(config);
  return [
    ...(hasSheet ? buildPlywoodJackStud(depthIn, heightIn) : []),
    ...build2x4JackStuds(depthIn, heightIn, jackStud2x4Wythes(config), hasSheet ? JACK_STUD_THICKNESS_IN : 0),
  ];
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
    overallDimensions: { heightIn, widthIn: jackStudThicknessIn(config), depthIn },
    members: buildJackStudMembers(depthIn, heightIn, config),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Height shown is the rough-opening-to-header span passed in by the caller — headers/sills/jack studs " +
          "don't have their own tracked placement mechanism yet, so a real design's actual sill-top-to-header-" +
          "bottom height isn't independently confirmed here." +
          (jackStud2x4Wythes(config).length > 0
            ? " The 2x4 jack stud(s) are shown at their real positions but not connected by any modeled blocking between them."
            : ""),
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
