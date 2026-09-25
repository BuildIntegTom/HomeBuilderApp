import { describe, expect, it } from "vitest";
import { TILER_MAX_PANEL_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN } from "@building-integrity/geometry";
import { fabricationMinPanelWidthIn, panelWidthInRange } from "@building-integrity/panel-catalog";

/**
 * The tiler's absorb rule needs two catalog numbers, and it cannot import
 * them: `packages/geometry` deliberately has no dependency on
 * `packages/panel-catalog` (see `SAFETY_GAP_WIDTH_IN`'s own note in
 * tiling.ts, which duplicates 0.75in for the same reason). So `tiling.ts`
 * carries its own copies.
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
