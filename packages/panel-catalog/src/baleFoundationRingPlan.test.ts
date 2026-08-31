import { describe, expect, it } from "vitest";
import {
  BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_GAP_DEFAULT_IN,
  BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
  buildDoubledStackPair,
} from "./baleFoundationMembers";
import { BALE_FOUNDATION_RING_WIDTH_IN, baleFoundationRingPlan } from "./baleFoundationRingPlan";
import { looseDensePackThicknessOptionsIn } from "./data";
import { memberLocalCornersIn } from "./panelMemberHelpers";

/** Every wall thickness the app can actually select, read from the catalog
 * rather than restated here — that option set is itself provisional
 * (pending Building Integrity), so a test that hardcoded it would quietly
 * stop covering the real ones. */
const THICKNESS_OPTIONS_IN = looseDensePackThicknessOptionsIn;

/** A doubled ring's real across-the-depth extent, measured off the members
 * `buildDoubledStackPair` actually emits — view space (what
 * `memberLocalCornersIn` returns) puts member depth on Z. */
function doubledPairDepthExtentIn(): { minIn: number; maxIn: number } {
  const members = buildDoubledStackPair(
    "probe",
    120,
    BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
    BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
    BALE_FOUNDATION_GAP_DEFAULT_IN,
  );
  const depths = members.flatMap((m) => memberLocalCornersIn(m).map(([, , z]) => z));
  return { minIn: Math.min(...depths), maxIn: Math.max(...depths) };
}

describe("baleFoundationRingPlan", () => {
  it("derives ringWidthIn from the members buildDoubledStackPair really emits", () => {
    // Not a restatement of `2 * PLATE_2X4_THICKNESS_IN`: if the doubled
    // pair's own geometry ever changes (a gap between the 2 stacks, a
    // different board), this fails rather than letting Ring B silently
    // stop being flush.
    const { minIn, maxIn } = doubledPairDepthExtentIn();
    expect(minIn).toBe(0);
    expect(maxIn - minIn).toBe(BALE_FOUNDATION_RING_WIDTH_IN);
  });

  it("puts Ring A's outboard face on the exterior line and Ring B's inboard face on the interior line", () => {
    for (const thicknessIn of THICKNESS_OPTIONS_IN) {
      const plan = baleFoundationRingPlan(thicknessIn);
      expect(plan.collapsed).toBe(false);
      const [ringA, ringB] = plan.rings;
      // Wall occupies [0, thicknessIn]; a ring occupies
      // [insetIn, insetIn + ringWidthIn].
      expect(ringA!.insetIn).toBe(0);
      expect(ringB!.insetIn + plan.ringWidthIn).toBeCloseTo(thicknessIn, 10);
    }
  });

  it("leaves a clear span between the rings equal to thickness minus both rings", () => {
    for (const thicknessIn of THICKNESS_OPTIONS_IN) {
      const plan = baleFoundationRingPlan(thicknessIn);
      const [ringA, ringB] = plan.rings;
      const clearIn = ringB!.insetIn - (ringA!.insetIn + plan.ringWidthIn);
      expect(clearIn).toBeCloseTo(thicknessIn - 2 * plan.ringWidthIn, 10);
      expect(clearIn).toBeGreaterThan(0);
    }
    expect(baleFoundationRingPlan(15.5).rings[1]!.insetIn).toBe(12.5); // 15.5 - 3
  });

  it("offsets each pair's inner sub-line by exactly one board thickness", () => {
    const plan = baleFoundationRingPlan(15.5);
    for (const ring of plan.rings) {
      expect(ring.innerInsetIn - ring.insetIn).toBe(plan.boardThicknessIn);
    }
    // The inner stack's own inboard face closes out the ring's full width.
    expect(plan.rings[0]!.innerInsetIn + plan.boardThicknessIn).toBe(plan.ringWidthIn);
  });

  it("starts field framing at the wall's interior face, inboard of Ring B", () => {
    for (const thicknessIn of THICKNESS_OPTIONS_IN) {
      const plan = baleFoundationRingPlan(thicknessIn);
      const ringB = plan.rings[1]!;
      expect(plan.fieldInsetIn).toBe(thicknessIn);
      expect(plan.fieldInsetIn).toBeGreaterThanOrEqual(ringB.insetIn + plan.ringWidthIn - 1e-9);
    }
  });

  it("collapses to one centered ring rather than overlapping when the wall is thinner than 2 rings", () => {
    const plan = baleFoundationRingPlan(5);
    expect(plan.collapsed).toBe(true);
    expect(plan.rings).toHaveLength(1);
    // Centered: equal clear either side of the ring.
    const ring = plan.rings[0]!;
    expect(ring.insetIn).toBeCloseTo((5 - plan.ringWidthIn) / 2, 10);
    expect(ring.insetIn + plan.ringWidthIn).toBeLessThanOrEqual(5);
  });

  it("never places a ring outside the exterior line, even for a wall thinner than one ring", () => {
    const plan = baleFoundationRingPlan(2);
    expect(plan.rings[0]!.insetIn).toBe(0);
    expect(plan.fieldInsetIn).toBeGreaterThanOrEqual(plan.ringWidthIn);
  });

  it("is exactly at the collapse boundary when thickness equals 2 rings", () => {
    const boundaryIn = 2 * BALE_FOUNDATION_RING_WIDTH_IN;
    const plan = baleFoundationRingPlan(boundaryIn);
    expect(plan.collapsed).toBe(false);
    expect(plan.rings[0]!.insetIn).toBe(0);
    expect(plan.rings[1]!.insetIn).toBe(plan.ringWidthIn); // rings touch, no overlap
  });
});
