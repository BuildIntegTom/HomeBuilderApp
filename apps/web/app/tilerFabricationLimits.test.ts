import { describe, expect, it } from "vitest";
import {
  NARROW_SAFETY_GAP_WIDTH_IN,
  safetyGapWidthForRunIn,
  SAFETY_GAP_NARROW_MAX_RUN_LENGTH_IN,
  TILER_MAX_PANEL_WIDTH_IN,
  TILER_MIN_PANEL_WIDTH_IN,
  WIDE_SAFETY_GAP_WIDTH_IN,
} from "@building-integrity/geometry";
import {
  fabricationMinPanelWidthIn,
  panelWidthInRange,
  SAFETY_GAP_THICKNESS_IN,
  SAFETY_GAP_THIN_THICKNESS_IN,
  safetyGapNarrowMaxRunLengthIn,
  safetyGapTwoTierRule,
} from "@building-integrity/panel-catalog";

/**
 * The tiler's absorb rule needs two catalog numbers, and it cannot import
 * them: `packages/geometry` deliberately has no dependency on
 * `packages/panel-catalog` (see `WIDE_SAFETY_GAP_WIDTH_IN`'s own note in
 * tiling.ts, which duplicates the two safety-gap widths for the same reason). So
 * `tiling.ts` carries its own copies.
 *
 * **A duplicated number defended only by a comment is a number that drifts.**
 * `apps/web` is the one place in the repo that imports both packages, so this
 * is where the duplication is actually checked. If someone changes the
 * fabrication minimum in the catalog and not in the tiler, this fails — which
 * matters more than usual here, because the tiler would then keep absorbing
 * against a stale floor and hand the shop panels it cannot build, silently.
 */
describe("the tiler's duplicated fabrication limits agree with the catalog", () => {
  it("TILER_MIN_PANEL_WIDTH_IN is fabricationMinPanelWidthIn", () => {
    expect(TILER_MIN_PANEL_WIDTH_IN).toBe(fabricationMinPanelWidthIn.value);
  });

  it("TILER_MAX_PANEL_WIDTH_IN is panelWidthInRange.maxIn", () => {
    expect(TILER_MAX_PANEL_WIDTH_IN).toBe(panelWidthInRange.maxIn);
  });

  it("and the coupling the absorb policy rests on still holds on the tiler's own copies", () => {
    // The same assertion data.test.ts makes about the catalog, repeated here
    // against the numbers the tiler actually uses. Both have to be true: the
    // catalog pair could be fine while the tiler's copies are not.
    expect(TILER_MAX_PANEL_WIDTH_IN).toBeGreaterThanOrEqual(2 * TILER_MIN_PANEL_WIDTH_IN);
  });
});

/**
 * The two-tier safety gap duplicates THREE numbers across the same package
 * boundary, for the same reason and with the same risk: the gap width the TILER
 * reserves and the sheet thickness the CATALOG builds are one physical fact (the
 * gap IS the plywood), so a drift between them puts a board into a slot it does
 * not fit. Checked here because this is the one place both packages are visible.
 */
describe("the two-tier safety gap agrees across both packages", () => {
  it("the wide tier is the catalog sheet thickness", () => {
    expect(WIDE_SAFETY_GAP_WIDTH_IN).toBe(SAFETY_GAP_THICKNESS_IN);
  });

  it("the narrow tier is the catalog thin sheet thickness", () => {
    expect(NARROW_SAFETY_GAP_WIDTH_IN).toBe(SAFETY_GAP_THIN_THICKNESS_IN);
  });

  it("the run threshold matches the catalog entry that carries Tommy's hedge, and the thicknesses the one that carries his numbers", () => {
    // ⚠ TWO catalog entries since the 2026-10-01 split, not one: the thicknesses
    // are `confirmed` and the threshold is `pending-BI-confirmation`, because his
    // one sentence stated the first and hedged the second. This is the only place
    // in the repo where the geometry constants and the catalog are both visible,
    // so it is where they are held to each other.
    expect(SAFETY_GAP_NARROW_MAX_RUN_LENGTH_IN).toBe(safetyGapNarrowMaxRunLengthIn.value);
    expect(safetyGapNarrowMaxRunLengthIn.status).toBe("pending-BI-confirmation");
    expect(safetyGapTwoTierRule.wideThicknessIn).toBe(WIDE_SAFETY_GAP_WIDTH_IN);
    expect(safetyGapTwoTierRule.narrowThicknessIn).toBe(NARROW_SAFETY_GAP_WIDTH_IN);
    expect(safetyGapTwoTierRule.status).toBe("confirmed");
  });

  it("and the tiler decides the tier on the threshold, at the eighth either side of it", () => {
    expect(safetyGapWidthForRunIn(SAFETY_GAP_NARROW_MAX_RUN_LENGTH_IN)).toBe(NARROW_SAFETY_GAP_WIDTH_IN);
    expect(safetyGapWidthForRunIn(SAFETY_GAP_NARROW_MAX_RUN_LENGTH_IN + 0.125)).toBe(WIDE_SAFETY_GAP_WIDTH_IN);
    // Every run gets one: there is no length that returns nothing.
    for (const runLengthIn of [0, 1, 24, 100, 144, 360, 10_000]) {
      expect(safetyGapWidthForRunIn(runLengthIn)).toBeGreaterThan(0);
    }
  });
});
