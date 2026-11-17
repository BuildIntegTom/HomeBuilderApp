import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { COLUMN_TOTAL_WIDTH_IN, buildColumnStyleMembers } from "./columnPanelMembers";
import { LEGACY_GIRT_STYLE, type GirtStyle } from "./panelMemberHelpers";
import { NO_PANEL_PLAN_MITRE, type PanelPlanMitre, hasPanelPlanMitre } from "./panelPlanMitre";

/**
 * A Corner Panel is built exactly like a Column Panel (Tommy: "corner
 * panels are just like this too actually, so let's copy everything over
 * for them too") — same 24in core + 3/4in plywood on both sides + 16in
 * blocking, and `COLUMN_TOTAL_WIDTH_IN` (25.5in) when nothing says otherwise.
 *
 * ### It is NOT locked to 25.5in any more (2026-09-26)
 *
 * This used to be `export const buildCornerPanelMembers = buildColumnPanelMembers`,
 * whose signature has no width at all, so **every corner slot was framed at
 * 25.5in whatever width it really was.** That was wrong wherever the tiler sizes
 * a corner off nominal, which it does routinely:
 *
 * - **corner absorb** widens a pair to share a wall in the 51in-75.5in band, so a
 *   72in wall is two 36in corner panels — 10.5in of missing framing each;
 * - **every octagon 10.5ft to 15ft across** is built entirely out of such
 *   panels;
 * - the merge and clamp rules size a corner DOWN to a short wall's own length;
 * - and a real `5'-1¾"` (61.75in) wall in the Rogers-Sehorn ADU tiles to two
 *   30.875in corners.
 *
 * The visible damage was a wall short by up to 21in in Framed 3D and in the OBJ
 * export — and **a shop fabrication page that described a 25.5in panel for a
 * 36in part, which is a part cut wrong.** Pricing was already correct (it uses
 * the slot's own `widthIn` plus the return-leg edge), so the cut list and the
 * price disagreed with each other.
 *
 * Tommy confirmed the part can be built off nominal, asked directly
 * (2026-09-25): ***"Yes — any width in the 24-48in band."*** `totalWidthIn`
 * defaults to the nominal so every existing caller is byte-identical.
 *
 * Re-exported under its own name rather than aliased directly so callers/detail
 * pages read "corner", not "column", and so the two can diverge later without a
 * breaking rename.
 */
export function buildCornerPanelMembers(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  totalWidthIn: number = COLUMN_TOTAL_WIDTH_IN,
  /** The project's girt style. Defaults to `LEGACY_GIRT_STYLE`, which is what
   * this app built before girts had styles — never to the project default,
   * so an un-taught call site draws a stale panel rather than a wrong one. */
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  /**
   * ⚠ **The 22½° plan mitre, and a CORNER panel is the part that needs it.**
   *
   * A Column Panel stands in the middle of a wall and is never mitred; a
   * Corner Panel sits on the building's corner, which on anything but a right
   * angle means its end face is raked. Forwarded rather than re-derived — see
   * `buildColumnStyleMembers`' own parameter for the measurement.
   */
  planMitreIn: PanelPlanMitre = NO_PANEL_PLAN_MITRE,
) {
  return buildColumnStyleMembers(totalWidthIn, depthIn, heightIn, includeNailer, girtStyle, planMitreIn);
}

export function buildCornerPanelSchema(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  totalWidthIn: number = COLUMN_TOTAL_WIDTH_IN,
  /** The project's girt style. Defaults to `LEGACY_GIRT_STYLE`, which is what
   * this app built before girts had styles — never to the project default,
   * so an un-taught call site draws a stale panel rather than a wrong one. */
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "corner_panel",
    displayName: "Corner Panel",
    status: "draft",
    derivedFrom: "column_panel",
    // The panel's REAL width, not the nominal. A schema that reports 25.5in for
    // a 36in part is the same defect as a shop sheet that does.
    overallDimensions: { heightIn, widthIn: totalWidthIn, depthIn },
    members: buildCornerPanelMembers(depthIn, heightIn, includeNailer, totalWidthIn, girtStyle),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Identical construction to the Column Panel (Tommy) — blocking row count/spacing is an interpretation, not independently confirmed against a shop drawing.",
      },
      {
        type: "deviation",
        text: "Built at the slot's real width: a corner panel off its nominal 25.5in is the same construction with a wider/narrower core (Tommy, 2026-09-25: \"any width in the 24-48in band\"). Widths outside that band can still be produced by the tiler's merge rule and are NOT confirmed — see the spec's Open Items.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}

/**
 * ⚠ **Did the 22½° plan mitre cost this corner panel its girt rows?** — the
 * Review Log's question, answered the way `gableMitreDropsGirtRow` answers it:
 * by building the panel both ways and counting, rather than restating the girt
 * rules a second time where the two copies could drift apart.
 *
 * ⚠ **On the app's own 15½ in corner panel the answer is YES, on all sixteen
 * corner panels of an octagon.** A 14in core less a 6.482in cut leaves a
 * 7.456in girt window and a row needs 10in, so until 2026-11-16 the two bars
 * overlapped each other by 2.482in. The row is given up rather than the cut —
 * what a girt braces is the clear span between the end posts, and here that is
 * 4½ in against the 3ft his own spacing rule is written around.
 *
 * It still has to be SAID: a part quietly built with fewer pieces than its
 * neighbours reads as correct.
 */
export function cornerMitreDropsGirtRow(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  totalWidthIn: number,
  girtStyle: GirtStyle | undefined,
  planMitreIn: PanelPlanMitre,
): boolean {
  if (!hasPanelPlanMitre(planMitreIn)) return false;
  const girtCount = (members: readonly PanelMember[]) =>
    members.filter((m) => m.role === "girt" || m.role === "girt_web").length;
  const square = buildCornerPanelMembers(depthIn, heightIn, includeNailer, totalWidthIn, girtStyle);
  if (girtCount(square) === 0) return false;
  return (
    girtCount(buildCornerPanelMembers(depthIn, heightIn, includeNailer, totalWidthIn, girtStyle, planMitreIn)) === 0
  );
}
