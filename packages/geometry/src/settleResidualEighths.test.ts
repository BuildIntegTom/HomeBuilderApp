import { describe, expect, it } from "vitest";
import { settleResidualEighths } from "./settleResidualEighths";
import type { PanelSlot } from "./types";

// The helper this file covers was `bracedPlacement.ts`'s private function until
// 2026-09-30, when `planLockedWidthReforce` needed the same discipline and the
// import would have been circular. It was already covered INDIRECTLY, through
// the corner-brace combine's 790,440-case product sweep; these are the first
// direct tests of it, and they exist because it now has two callers and a
// behaviour change for one of them must fail here rather than in one sweep only.

const std = (widthIn: number): PanelSlot => ({ type: "standard", widthIn });

describe("settleResidualEighths", () => {
  it("hands a surplus back to the first candidate that has room", () => {
    const slots = [std(30), std(30)];
    expect(settleResidualEighths(slots, [1], 8 * 6)).toEqual(new Map([[1, 8 * 36]]));
  });

  it("spreads a surplus across candidates in order when one cannot take it all", () => {
    const slots = [std(44), std(30)];
    // +10in of surplus: slot 0 can only grow 4in (to the 48in ceiling), so 6in
    // goes to slot 1.
    expect(settleResidualEighths(slots, [0, 1], 8 * 10)).toEqual(
      new Map([
        [0, 8 * 48],
        [1, 8 * 36],
      ]),
    );
  });

  it("takes a shortfall out of candidates without any of them going under the floor", () => {
    const slots = [std(30), std(40)];
    // -12in: slot 0 can only give 6in before hitting 24in, slot 1 gives the rest.
    expect(settleResidualEighths(slots, [0, 1], -8 * 12)).toEqual(
      new Map([
        [0, 8 * 24],
        [1, 8 * 34],
      ]),
    );
  });

  it("refuses with null rather than overshooting a bound", () => {
    // Two panels at the floor cannot give up anything at all.
    expect(settleResidualEighths([std(24), std(24)], [0, 1], -8)).toBeNull();
    // Two at the ceiling cannot take anything.
    expect(settleResidualEighths([std(48), std(48)], [0, 1], 8)).toBeNull();
  });

  it("refuses when there are no candidates and anything at all is owed", () => {
    expect(settleResidualEighths([std(40)], [], 8)).toBeNull();
    expect(settleResidualEighths([std(40)], [], -8)).toBeNull();
    // Nothing owed settles vacuously, which is what makes a zero-delta
    // re-force a no-op rather than a refusal.
    expect(settleResidualEighths([std(40)], [], 0)).toEqual(new Map());
  });

  it("leaves a panel the tiler already left out of bounds alone in the direction that would make it worse", () => {
    // A 20in panel (under the floor) may not be shrunk further...
    expect(settleResidualEighths([std(20), std(40)], [0, 1], -8 * 2)).toEqual(new Map([[1, 8 * 38]]));
    // ...nor is it repaired when there IS a surplus going spare: it grows by
    // the surplus and no more, stopping wherever that lands.
    expect(settleResidualEighths([std(20)], [0], 8 * 2)).toEqual(new Map([[0, 8 * 22]]));
  });

  it("settles to EXACTLY zero or not at all, over every residual a 3-panel run can be asked for", () => {
    const slots = [std(30), std(36), std(42)];
    const candidates = [0, 1, 2];
    const startEighths = slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0);
    for (let residual = -8 * 40; residual <= 8 * 40; residual++) {
      const settled = settleResidualEighths(slots, candidates, residual);
      if (!settled) continue;
      let after = startEighths;
      for (const [i, next] of settled) after += next - Math.round(slots[i]!.widthIn * 8);
      expect(after).toBe(startEighths + residual);
      for (const next of settled.values()) {
        expect(next).toBeGreaterThanOrEqual(8 * 24);
        expect(next).toBeLessThanOrEqual(8 * 48);
      }
    }
  });
});
