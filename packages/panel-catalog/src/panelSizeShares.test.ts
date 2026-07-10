import { describe, expect, it } from "vitest";
import { computePanelSizeShares } from "./panelSizeShares";

describe("computePanelSizeShares", () => {
  it("returns empty for no widths", () => {
    expect(computePanelSizeShares([])).toEqual([]);
  });

  it("gives a single distinct size 100% of the space", () => {
    const shares = computePanelSizeShares([40, 40, 40]);
    expect(shares).toEqual([{ widthIn: 40, count: 3, sharePercent: 100 }]);
  });

  it("splits 2 distinct sizes 50/50, most-recurring first", () => {
    const shares = computePanelSizeShares([40, 40, 40, 24]);
    expect(shares).toEqual([
      { widthIn: 40, count: 3, sharePercent: 50 },
      { widthIn: 24, count: 1, sharePercent: 50 },
    ]);
  });

  it("splits 3 distinct sizes 50/25/25, most-recurring first", () => {
    const shares = computePanelSizeShares([40, 40, 40, 24, 30]);
    expect(shares).toEqual([
      { widthIn: 40, count: 3, sharePercent: 50 },
      { widthIn: 30, count: 1, sharePercent: 25 },
      { widthIn: 24, count: 1, sharePercent: 25 },
    ]);
  });

  it("splits 4+ distinct sizes into equal shares", () => {
    const shares = computePanelSizeShares([40, 24, 30, 36]);
    expect(shares.map((s) => s.sharePercent)).toEqual([25, 25, 25, 25]);

    const fiveShares = computePanelSizeShares([40, 24, 30, 36, 20]);
    expect(fiveShares.map((s) => s.sharePercent)).toEqual([20, 20, 20, 20, 20]);
  });

  it("breaks a most-recurring tie by picking the larger width first", () => {
    const shares = computePanelSizeShares([24, 24, 40, 40]);
    expect(shares[0].widthIn).toBe(40);
    expect(shares[1].widthIn).toBe(24);
  });

  it("orders 3+ distinct sizes among the non-largest count purely by width descending after the most-recurring pick", () => {
    // 40 appears twice (most-recurring); among the remaining ties (1 each),
    // ties fall back to width descending per the same comparator.
    const shares = computePanelSizeShares([40, 40, 24, 30]);
    expect(shares.map((s) => s.widthIn)).toEqual([40, 30, 24]);
  });
});
