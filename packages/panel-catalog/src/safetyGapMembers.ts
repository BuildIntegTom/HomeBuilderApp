import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { GIRT_WEB_PLY_SPEC, SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Safety/Gap panel (Tommy: "get rid of safety panels and instead create a
 * safety gap... instead of a safety panel being a standard panel slightly
 * altered, its actually just a 3/4in piece of plywood that is the panel
 * thickness and panel height") — no studs, plates, or girts at all: just
 * one plywood sheet, spanning the wall's full thickness (depth) and
 * full height.
 *
 * **3/4in is the sheet on a wall RUN over 144in. A run of 144in or less gets
 * `SAFETY_GAP_THIN_THICKNESS_IN` instead** — Tommy, 2026-09-30: *"Can we make
 * it so that once below the threshold (of 12'? If it's somewhere around 10-12'
 * rn that's fine) the safety gap is 1/2"."* The rule itself lives in
 * packages/geometry (`safetyGapWidthForRunIn`), because only the tiler knows a
 * run's length; this file owns the two sheets it resolves to. See
 * `safetyGapPanelRules` in data.ts for the catalog entry carrying his wording.
 *
 * **The reserved wall-run width and this sheet thickness are ONE fact, not
 * two.** The doc comment here used to say the slot's own `widthIn` was
 * "independent of the single fixed-size plywood piece actually built into it",
 * and that was only ever true in the sense that the SHEET did not resize to
 * fill an over-wide slot: the gap IS the plywood, so a run that reserves 3/4in
 * of wall is reserving it for a 3/4in board and a run that reserves 1/2in is
 * reserving it for a 1/2in board. The two constants exist separately only
 * because packages/geometry may not import this package;
 * `apps/web/app/tilerFabricationLimits.test.ts` asserts both pairs agree.
 *
 * Two places still legitimately pass a width this sheet does NOT follow, and
 * both are documented where they happen rather than here: a corner-brace
 * COMBINED slot (standard width + a plywood buffer, see
 * `SAFETY_PLYWOOD_BUFFER_IN`) and the degenerate clamped slot a wall whose
 * openings ate its middle can produce (see `computePlainSizing`).
 */
export const SAFETY_GAP_THICKNESS_IN = 0.75;

/** The thinner sheet, on a wall run of 144in or less — see
 * `SAFETY_GAP_THICKNESS_IN`'s own comment for Tommy's wording and for why the
 * reserved width and the sheet thickness are one fact. Must match
 * packages/geometry's `NARROW_SAFETY_GAP_WIDTH_IN`. */
export const SAFETY_GAP_THIN_THICKNESS_IN = 0.5;

/**
 * Which real sheet spec a safety-gap board of this thickness is.
 *
 * ⚠ **The two specs differ by more than their thickness, and whoever orders
 * sheets needs to know:** `SKIN_PLY_SPEC` is 3/4in **5-ply** CDX,
 * `GIRT_WEB_PLY_SPEC` is 1/2in **3-ply** CDX. Both already existed in this
 * package (the standard panel's skins and its girt webs respectively) — this
 * invents no new sheet.
 *
 * Anything under the 3/4in sheet takes the 1/2in spec, which also catches the
 * degenerate clamped slot (`computePlainSizing`): a slot clamped to 1/4in still
 * carries a whole real sheet of a real spec rather than an invented 1/4in one.
 */
export function safetyGapPlySpecFor(thicknessIn: number): string {
  return thicknessIn >= SAFETY_GAP_THICKNESS_IN ? SKIN_PLY_SPEC : GIRT_WEB_PLY_SPEC;
}

/**
 * Which of the two sheets a gap slot of this RESERVED WALL-RUN WIDTH is built
 * from — the app's bridge from a tiled slot to a real part.
 *
 * It reads the width the tiler already reserved rather than re-deriving the
 * run-length rule, deliberately: the 144in threshold lives in exactly one
 * place (`safetyGapWidthForRunIn` in packages/geometry) and a second copy of
 * it here is how the model and the tiling drift apart. The reserved width IS
 * the thickness — see `SAFETY_GAP_THICKNESS_IN`'s own comment.
 *
 * The two slots whose reserved width is NOT its own thickness both land on the
 * right answer anyway, which is why this reads as a floor rather than an
 * equality:
 *   - a corner-brace COMBINED slot is a standard width plus a 3/4in buffer, so
 *     it is far over the 3/4in floor and takes the 3/4in sheet;
 *   - a slot CLAMPED under 1/2in (openings ate the wall's middle — see
 *     `computePlainSizing`) falls to the 1/2in sheet, the thinner of the two
 *     real specs, rather than to an invented sub-1/2in one.
 */
export function safetyGapSheetThicknessIn(reservedWidthIn: number): number {
  return reservedWidthIn >= SAFETY_GAP_THICKNESS_IN ? SAFETY_GAP_THICKNESS_IN : SAFETY_GAP_THIN_THICKNESS_IN;
}

export function buildSafetyGapMembers(
  depthIn: number,
  heightIn: number,
  thicknessIn: number = SAFETY_GAP_THICKNESS_IN,
): PanelMember[] {
  return [
    {
      memberId: "safety_gap_sheet",
      material: "plywood",
      speciesGrade: null,
      plySpec: safetyGapPlySpecFor(thicknessIn),
      nominalSize: null,
      actualDimsIn: { thicknessIn, widthIn: depthIn, lengthIn: heightIn },
      orientation: "vertical",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: "Dimensional-tolerance buffer — no framing, just this one plywood sheet.",
    },
  ];
}

/**
 * Wraps `buildSafetyGapMembers` in the full shared component schema — see
 * `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildSafetyGapSchema(
  depthIn: number,
  heightIn: number,
  thicknessIn: number = SAFETY_GAP_THICKNESS_IN,
): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "safety_gap",
    displayName: "Safety / Gap Panel",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn, widthIn: thicknessIn, depthIn },
    members: buildSafetyGapMembers(depthIn, heightIn, thicknessIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "No longer modeled as an altered Standard Panel — just this one plywood sheet, as thick as the wall run's " +
          "tiling reserves for it: 3/4in (5-ply CDX) on a run over 12ft, 1/2in (3-ply CDX) on a run of 12ft or less.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
