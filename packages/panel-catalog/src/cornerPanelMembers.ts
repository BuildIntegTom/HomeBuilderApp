import type { PanelComponentSchema } from "./componentSchema";
import { COLUMN_TOTAL_WIDTH_IN, buildColumnStyleMembers } from "./columnPanelMembers";

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
 * - **corner absorb** widens a pair to share a wall in the 51in-75in band, so a
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
) {
  return buildColumnStyleMembers(totalWidthIn, depthIn, heightIn, includeNailer);
}

export function buildCornerPanelSchema(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  totalWidthIn: number = COLUMN_TOTAL_WIDTH_IN,
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
    members: buildCornerPanelMembers(depthIn, heightIn, includeNailer, totalWidthIn),
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
