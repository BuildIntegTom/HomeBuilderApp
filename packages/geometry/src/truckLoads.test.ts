import { describe, expect, it } from "vitest";
import {
  chunkIntoStacks,
  chunkIntoStacksSmart,
  computePanelsPerStack,
  computeTruckLoads,
  isWidthCompatible,
  packLanesWithLookahead,
  partitionLongHeaders,
  type PanelGroup,
  type PanelLane,
  type PanelStack,
  type StackablePanelRef,
  type TruckDims,
  type TruckLoad,
} from "./truckLoads";

describe("computePanelsPerStack", () => {
  it("divides the trailer's ceiling height (minus a buffer on each side) by the panel thickness", () => {
    // 108in tall trailer, 3in buffer each side -> 102in usable / 15.5in thick -> 6 panels (93in), 7 would be 108.5in.
    expect(computePanelsPerStack(108, 15.5, 3)).toBe(6);
  });

  it("returns 0 for a nonsensical (zero/negative) panel thickness", () => {
    expect(computePanelsPerStack(108, 0, 3)).toBe(0);
  });

  it("never goes negative when the buffer alone exceeds the trailer height", () => {
    expect(computePanelsPerStack(4, 15.5, 3)).toBe(0);
  });
});

describe("chunkIntoStacks", () => {
  const panels: StackablePanelRef[] = [
    { id: "N-1", widthIn: 40 },
    { id: "N-2", widthIn: 40 },
    { id: "N-3", widthIn: 25.5 },
    { id: "N-4", widthIn: 40 },
    { id: "N-5", widthIn: 40 },
  ];

  it("groups panels into stacks of the given size, preserving order", () => {
    const stacks = chunkIntoStacks(panels, 2, 120, 15.5);
    expect(stacks).toHaveLength(3); // 2, 2, 1
    expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2"]);
    expect(stacks[1]!.panelIds).toEqual(["N-3", "N-4"]);
    expect(stacks[2]!.panelIds).toEqual(["N-5"]);
  });

  it("uses the widest panel in each stack as that stack's own footprint width", () => {
    const stacks = chunkIntoStacks(panels, 2, 120, 15.5);
    expect(stacks[1]!.widthIn).toBe(40); // max(25.5, 40)
  });

  it("returns an empty list for a non-positive stack size", () => {
    expect(chunkIntoStacks(panels, 0, 120, 15.5)).toEqual([]);
  });

  it("falls back to the given default height for panels with no heightIn of their own", () => {
    const stacks = chunkIntoStacks(panels, 2, 120, 15.5);
    expect(stacks[0]!.heightIn).toBe(120);
  });

  it("uses the tallest panel's own real heightIn when panels specify one", () => {
    const shortPanels: StackablePanelRef[] = [
      { id: "header-1", widthIn: 60, heightIn: 18 },
      { id: "sill-1", widthIn: 36, heightIn: 32 },
    ];
    const stacks = chunkIntoStacks(shortPanels, 2, 120, 15.5);
    expect(stacks[0]!.heightIn).toBe(32); // max(18, 32), not the 120in default
  });

  it("stamps every stack with the group's own real thicknessIn", () => {
    const stacks = chunkIntoStacks(panels, 2, 120, 0.75);
    expect(stacks.every((s) => s.thicknessIn === 0.75)).toBe(true);
  });
});

describe("isWidthCompatible", () => {
  it("is true for identical widths", () => {
    expect(isWidthCompatible(40, 40)).toBe(true);
  });

  it("is true exactly at the 10% boundary (inclusive)", () => {
    // 90 is exactly 10% smaller than 100.
    expect(isWidthCompatible(90, 100)).toBe(true);
  });

  it("is false just past the 10% boundary", () => {
    expect(isWidthCompatible(89, 100)).toBe(false);
  });

  it("is order-independent", () => {
    expect(isWidthCompatible(100, 90)).toBe(isWidthCompatible(90, 100));
    expect(isWidthCompatible(100, 89)).toBe(isWidthCompatible(89, 100));
  });

  it("respects a custom tolerance ratio", () => {
    // 80 is exactly 20% smaller than 100 -> compatible only at a 0.2 tolerance.
    expect(isWidthCompatible(80, 100, 0.2)).toBe(true);
    expect(isWidthCompatible(80, 100, 0.1)).toBe(false);
  });

  it("fails closed for non-positive or NaN input", () => {
    expect(isWidthCompatible(NaN, 100)).toBe(false);
    expect(isWidthCompatible(0, 100)).toBe(false);
    expect(isWidthCompatible(100, -5)).toBe(false);
  });
});

describe("chunkIntoStacksSmart", () => {
  const MAIN_W = 40;
  const MAIN_H = 120;
  const THICK = 15.5;

  it("behaves exactly like plain chunking when every panel is mutually compatible", () => {
    const panels: StackablePanelRef[] = [
      { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "N-3", widthIn: MAIN_W, heightIn: MAIN_H },
    ];
    const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2", "N-3"]);
  });

  it("diverts a panel that can't support the main stack's current bottom into its own side-stack, then resumes the main run", () => {
    // A header (40w x 20h) is >10% shorter than the 120h main panel above
    // it (N-2) would need to support — diverts instead of forcing an
    // unsafe/oversized combination. N-3 (back to 120h) is still compatible
    // with N-2 (the main stack's bottom never changed), so it extends the
    // SAME main stack rather than starting a new one. No `kind` is set on
    // "header-1" here (it resolves to "other"), so the strict, symmetric
    // height check still applies — this is the pre-existing behavior for
    // any dimensionally-short "other" panel, unrelated to the new
    // kind-aware header/sill rules exercised further down this file.
    const panels: StackablePanelRef[] = [
      { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "header-1", widthIn: MAIN_W, heightIn: 20 },
      { id: "N-3", widthIn: MAIN_W, heightIn: MAIN_H },
    ];
    const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
    expect(stacks).toHaveLength(2);
    expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2", "N-3"]); // main run, uninterrupted
    expect(stacks[1]!.panelIds).toEqual(["header-1"]); // diverted, adjacent to the main run it interrupted
  });

  it("combines a diverted header with its wall's sills into ONE side-stack when the sills are big enough to support it — the 'N4 and N5 sills' case, no type-based special-casing needed", () => {
    // header-3 (20h) diverts off the 120h main run. sill-4 and sill-5
    // (32h each) are BIGGER than header-3, so both safely stack UNDER it
    // in the same side-stack (Tommy: "smaller panels can always be
    // on top of bigger panels, just not under") — the dimensional rule
    // alone produces this grouping, with no header-vs-sill type
    // distinction anywhere in the algorithm.
    const panels: StackablePanelRef[] = [
      { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "header-3", widthIn: MAIN_W, heightIn: 20 },
      { id: "sill-4", widthIn: 36, heightIn: 32 },
      { id: "sill-5", widthIn: 35, heightIn: 31 },
      { id: "N-6", widthIn: MAIN_W, heightIn: MAIN_H },
    ];
    const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
    expect(stacks).toHaveLength(2);
    expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2", "N-6"]); // main run continues past the whole diversion
    expect(stacks[1]!.panelIds).toEqual(["header-3", "sill-4", "sill-5"]); // one side-stack, safely ordered top-to-bottom
  });

  it("keeps a panel that's too small to SUPPORT what's already on top of a side-stack from joining it (the reverse ordering)", () => {
    // sill-2 (32h) diverts off main. header-3 (20h) can't safely support
    // the sill above it (20 < 32*0.9=28.8) -> opens its own separate
    // side-stack instead of joining sill-2's — this is the genuinely
    // incompatible direction, unlike the header-then-sills case above.
    const panels: StackablePanelRef[] = [
      { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "sill-2", widthIn: 36, heightIn: 32 },
      { id: "header-3", widthIn: MAIN_W, heightIn: 20 },
    ];
    const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
    expect(stacks).toHaveLength(3);
    expect(stacks[0]!.panelIds).toEqual(["N-1"]);
    expect(stacks[1]!.panelIds).toEqual(["sill-2"]);
    expect(stacks[2]!.panelIds).toEqual(["header-3"]); // too small to support sill-2, gets its own stack
  });

  it("clears open side-stacks the moment the main stack resumes, so a later diversion never rejoins an earlier one", () => {
    const panels: StackablePanelRef[] = [
      { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "header-a", widthIn: MAIN_W, heightIn: 20 }, // diverts, opens side-stack A
      { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H }, // resumes main -> side-stack A is sealed
      { id: "header-b", widthIn: MAIN_W, heightIn: 20 }, // dimensionally identical to header-a, but must open a NEW side-stack
    ];
    const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
    expect(stacks).toHaveLength(3);
    expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2"]);
    expect(stacks[1]!.panelIds).toEqual(["header-a"]);
    expect(stacks[2]!.panelIds).toEqual(["header-b"]); // NOT merged with header-a
  });

  it("respects panelsPerStack capacity — a full main chunk starts a fresh one even for an otherwise-compatible next panel", () => {
    const panels: StackablePanelRef[] = [
      { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H }, // fills a 2-per-stack cap
      { id: "N-3", widthIn: MAIN_W, heightIn: MAIN_H }, // compatible, but the previous chunk is already full
    ];
    const stacks = chunkIntoStacksSmart(panels, 2, MAIN_H, THICK);
    expect(stacks).toHaveLength(2);
    expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2"]);
    expect(stacks[1]!.panelIds).toEqual(["N-3"]);
  });

  it("isolates a panel with corrupt (zero/NaN) dimensions into its own stack, rather than letting it become a universal 'anything fits' magnet", () => {
    const panels: StackablePanelRef[] = [
      { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "bad", widthIn: NaN, heightIn: 20 }, // diverts (can't support/be supported), opens a corrupt side-stack
      { id: "sill-a", widthIn: 30, heightIn: 20 }, // would trivially "fit" a corrupt bottom — must NOT join it
      { id: "sill-b", widthIn: 29, heightIn: 19 }, // compatible with sill-a instead
    ];
    const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
    expect(stacks).toHaveLength(3);
    expect(stacks[0]!.panelIds).toEqual(["N-1"]); // never extended — sill-a/b are too short for a 120h bottom
    expect(stacks[1]!.panelIds).toEqual(["bad"]); // isolated, alone forever
    expect(stacks[2]!.panelIds).toEqual(["sill-a", "sill-b"]); // grouped with each other, not with "bad"
  });

  it("returns an empty list for a non-positive panelsPerStack, matching chunkIntoStacks", () => {
    const panels: StackablePanelRef[] = [{ id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H }];
    expect(chunkIntoStacksSmart(panels, 0, MAIN_H, THICK)).toEqual([]);
    expect(chunkIntoStacksSmart(panels, -1, MAIN_H, THICK)).toEqual([]);
  });

  it("always accepts the very first panel as a fresh stack's seed, with no comparison performed", () => {
    // Even a 0-width panel is accepted as a seed (only panels joining an
    // EXISTING stack need to pass canSupport) — the seed just starts alone.
    const stacks = chunkIntoStacksSmart([{ id: "odd", widthIn: 0, heightIn: 0 }], 6, MAIN_H, THICK);
    expect(stacks).toEqual([{ panelIds: ["odd"], widthIn: 0, heightIn: 0, thicknessIn: THICK }]);
  });

  it("still returns a side-stack that's left open at the very end of the list — no separate flush step needed", () => {
    const panels: StackablePanelRef[] = [
      { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
      { id: "header-1", widthIn: MAIN_W, heightIn: 20 },
    ];
    const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
    expect(stacks.map((s) => s.panelIds)).toEqual([["N-1"], ["header-1"]]);
  });

  it("rolls up each stack's own widthIn/heightIn to its widest/tallest member, same convention as chunkIntoStacks", () => {
    const panels: StackablePanelRef[] = [
      { id: "corner-1", widthIn: 25.5, heightIn: MAIN_H },
      { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H }, // wider than corner-1, still compatible (smaller-on-bigger is always fine)
    ];
    const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.widthIn).toBe(40); // max(25.5, 40)
  });

  describe("kind-aware header/sill rules", () => {
    it("lets a header join (not divert from) the main stack despite a big height mismatch, once its own kind is set and width is compatible", () => {
      // Same shape as the "diverts a panel that can't support" test above,
      // but header-1 is now genuinely typed — the strict height check no
      // longer applies to it, only width-compatibility does, so it joins
      // as a pending member instead of diverting, and gets capped by N-3.
      const panels: StackablePanelRef[] = [
        { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "header-1", widthIn: MAIN_W, heightIn: 20, kind: "header" },
        { id: "N-3", widthIn: MAIN_W, heightIn: MAIN_H },
      ];
      const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
      expect(stacks).toHaveLength(1);
      expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2", "header-1", "N-3"]);
    });

    it("still diverts a header whose own width is incompatible, even though height no longer matters", () => {
      const panels: StackablePanelRef[] = [
        { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "header-1", widthIn: 70, heightIn: 20, kind: "header" }, // 70 vs 40 -> not within 10%
      ];
      const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
      expect(stacks).toHaveLength(2);
      expect(stacks[0]!.panelIds).toEqual(["N-1"]);
      expect(stacks[1]!.panelIds).toEqual(["header-1"]);
    });

    it("caps a single pending header with the next compatible full panel, never leaving the header at the bottom", () => {
      const panels: StackablePanelRef[] = [
        { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "header-1", widthIn: MAIN_W, heightIn: 20, kind: "header" },
        { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H },
      ];
      const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
      expect(stacks).toHaveLength(1);
      expect(stacks[0]!.panelIds).toEqual(["N-1", "header-1", "N-2"]);
    });

    it("flushes 3 consecutive pending headers together once a full panel finally caps them", () => {
      const panels: StackablePanelRef[] = [
        { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "header-a", widthIn: MAIN_W, heightIn: 20, kind: "header" },
        { id: "header-b", widthIn: MAIN_W, heightIn: 18, kind: "header" },
        { id: "header-c", widthIn: MAIN_W, heightIn: 22, kind: "header" },
        { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H },
      ];
      const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
      expect(stacks).toHaveLength(1);
      expect(stacks[0]!.panelIds).toEqual(["N-1", "header-a", "header-b", "header-c", "N-2"]);
    });

    it("the one documented exception: a header/sill that's the very last panel in the whole input, with nothing left to pair with, does end up as the stack's own bottom", () => {
      const panels: StackablePanelRef[] = [
        { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "header-end", widthIn: MAIN_W, heightIn: 20, kind: "header" },
      ];
      const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
      expect(stacks).toHaveLength(1);
      expect(stacks[0]!.panelIds).toEqual(["N-1", "header-end"]);
      expect(stacks[0]!.panelIds.at(-1)).toBe("header-end"); // explicitly asserted, not just tolerated
    });

    it("the other unavoidable exception: a header diverted into its own side-stack ends up alone (and thus its own bottom) once that side-stack is sealed by the main run resuming, with nothing ever arriving to cap it", () => {
      // header-a's width (70) is incompatible with N-1's (40), so it
      // diverts and seeds its own side-stack (accepted unconditionally, as
      // any fresh seed is). N-2 then resumes the main stack, which seals
      // (clears) every open side-stack per the pre-existing "resume clears
      // side-stacks" rule — header-a's own side-stack is flushed as-is,
      // alone, since nothing else ever joined it first.
      const panels: StackablePanelRef[] = [
        { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "header-a", widthIn: 70, heightIn: 20, kind: "header" },
        { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H },
      ];
      const stacks = chunkIntoStacksSmart(panels, 6, MAIN_H, THICK);
      expect(stacks).toHaveLength(2);
      expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2"]);
      expect(stacks[1]!.panelIds).toEqual(["header-a"]);
    });

    it("diverts a header that would leave no room for a future capper (reserve-capacity check), rather than overfilling the current stack", () => {
      // panelsPerStack=3, thickness=15.5 -> budget=46.5in. After N-1,N-2
      // (2 committed, 31in used), accepting header-1 would need
      // 31+15.5(itself)+15.5(reserved capper)=62in > 46.5in budget -> the
      // reserve check fails, so it diverts to its own fresh stack instead
      // of overfilling (or silently becoming an uncapped bottom).
      const panels: StackablePanelRef[] = [
        { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "N-2", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "header-1", widthIn: MAIN_W, heightIn: 20, kind: "header" },
      ];
      const stacks = chunkIntoStacksSmart(panels, 3, MAIN_H, THICK);
      expect(stacks).toHaveLength(2);
      expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2"]);
      expect(stacks[1]!.panelIds).toEqual(["header-1"]);
    });

    it("adds a dunnage gap between 2 pending headers' own thickness accounting, causing an EARLIER seal than the same scenario with no gap", () => {
      // panelsPerStack=4, thickness=10 -> budget=40in. header-b's reserve
      // check: occupied (N-1 + header-a) = 20in, +8in gap (since pending is
      // non-empty) +10in (itself) +10in (reserved capper) = 48in > 40in ->
      // fails, diverts. With dunnageGapIn=0 the same scenario is
      // 20+0+10+10=40in <= 40in -> fits, stays in the main stack.
      const panels: StackablePanelRef[] = [
        { id: "N-1", widthIn: MAIN_W, heightIn: MAIN_H },
        { id: "header-a", widthIn: MAIN_W, heightIn: 20, kind: "header" },
        { id: "header-b", widthIn: MAIN_W, heightIn: 18, kind: "header" },
      ];
      const withGap = chunkIntoStacksSmart(panels, 4, MAIN_H, 10, 8);
      expect(withGap).toHaveLength(2);
      expect(withGap[0]!.panelIds).toEqual(["N-1", "header-a"]);
      expect(withGap[1]!.panelIds).toEqual(["header-b"]);

      const noGap = chunkIntoStacksSmart(panels, 4, MAIN_H, 10, 0);
      expect(noGap).toHaveLength(1);
      expect(noGap[0]!.panelIds).toEqual(["N-1", "header-a", "header-b"]);

      // Omitting the param entirely defaults to 0 — identical to explicit 0.
      const defaulted = chunkIntoStacksSmart(panels, 4, MAIN_H, 10);
      expect(defaulted).toEqual(noGap);
    });
  });
});

describe("partitionLongHeaders", () => {
  const STANDARD_W = 40;

  it("keeps an in-band header in mainRun", () => {
    const panels: StackablePanelRef[] = [{ id: "header-1", widthIn: 42, kind: "header" }]; // within 10% of 40
    expect(partitionLongHeaders(panels, STANDARD_W)).toEqual({ mainRun: panels, longHeaders: [] });
  });

  it("routes an out-of-band header to longHeaders", () => {
    const wide: StackablePanelRef = { id: "header-1", widthIn: 72, kind: "header" };
    expect(partitionLongHeaders([wide], STANDARD_W)).toEqual({ mainRun: [], longHeaders: [wide] });
  });

  it("never routes a sill to longHeaders, regardless of width", () => {
    const wideSill: StackablePanelRef = { id: "sill-1", widthIn: 72, kind: "sill" };
    expect(partitionLongHeaders([wideSill], STANDARD_W)).toEqual({ mainRun: [wideSill], longHeaders: [] });
  });

  it("never routes an 'other'-kind panel to longHeaders, regardless of width", () => {
    const wideOther: StackablePanelRef = { id: "N-1", widthIn: 72, kind: "other" };
    expect(partitionLongHeaders([wideOther], STANDARD_W)).toEqual({ mainRun: [wideOther], longHeaders: [] });
  });

  it("preserves order within both output lists", () => {
    const panels: StackablePanelRef[] = [
      { id: "header-long-1", widthIn: 90, kind: "header" },
      { id: "N-1", widthIn: 40, kind: "other" },
      { id: "header-long-2", widthIn: 95, kind: "header" },
      { id: "header-short", widthIn: 41, kind: "header" },
    ];
    const { mainRun, longHeaders } = partitionLongHeaders(panels, STANDARD_W);
    expect(mainRun.map((p) => p.id)).toEqual(["N-1", "header-short"]);
    expect(longHeaders.map((p) => p.id)).toEqual(["header-long-1", "header-long-2"]);
  });

  it("returns 2 empty lists for empty input", () => {
    expect(partitionLongHeaders([], STANDARD_W)).toEqual({ mainRun: [], longHeaders: [] });
  });
});

describe("packLanesWithLookahead", () => {
  const bufferIn = 3;
  const truckWidthIn = 98;

  function stackOf(id: string, widthIn: number, heightIn = 120): PanelStack {
    return { panelIds: [id], widthIn, heightIn, thicknessIn: 15.5 };
  }

  function laneIds(rows: PanelLane[][]): string[][] {
    return rows.map((row) => row.flatMap((lane) => lane.stacks.map((s) => s.panelIds[0]!)));
  }

  describe("regression parity with the old shelf-pack shape (no lookahead candidates available)", () => {
    it("puts 2+ narrow stacks side by side in one row when they both fit", () => {
      const rows = packLanesWithLookahead([stackOf("A", 40), stackOf("B", 40)], truckWidthIn, bufferIn);
      expect(laneIds(rows)).toEqual([["A", "B"]]);
    });

    it("wraps to a new row once the next stack no longer fits", () => {
      const rows = packLanesWithLookahead([stackOf("A", 68.25), stackOf("B", 68.25)], truckWidthIn, bufferIn);
      expect(laneIds(rows)).toEqual([["A"], ["B"]]);
    });

    it("preserves given order when nothing in the window is mutually width-compatible (no reordering opportunity exists)", () => {
      // 3 pairwise width-incompatible stacks -> bestFitAhead can never find
      // an alternative to the raw next-in-sequence one, so order falls out
      // unchanged, same as the old shelf-packer's own behavior.
      const rows = packLanesWithLookahead([stackOf("A", 20), stackOf("B", 45), stackOf("C", 80)], truckWidthIn, bufferIn);
      expect(laneIds(rows).flat()).toEqual(["A", "B", "C"]);
    });

    it("still places a single stack wider than the trailer itself, alone in its own row", () => {
      const rows = packLanesWithLookahead([stackOf("A", 500)], truckWidthIn, bufferIn);
      expect(laneIds(rows)).toEqual([["A"]]);
    });

    it("returns no rows for an empty stack list", () => {
      expect(packLanesWithLookahead([], truckWidthIn, bufferIn)).toEqual([]);
    });
  });

  describe("depth-backfill", () => {
    it("backfills a shallow lane with a later, width-compatible, still-unconsumed stack instead of leaving the row's own leftover depth dead", () => {
      // A(w40,depth100) and B(w40,depth20) share row 1 (both width 40).
      // C(w40,depth15) can't join row 1 by WIDTH (no room left), so the
      // width pass would push it to its own row 2 — but before that
      // happens, row 1's own backfill pass notices B's lane has 100-20-3
      // =77in of leftover depth and pulls C in behind it instead.
      const rows = packLanesWithLookahead([stackOf("A", 40, 100), stackOf("B", 40, 20), stackOf("C", 40, 15)], truckWidthIn, bufferIn);
      expect(rows).toHaveLength(1); // C got backfilled, not given its own row
      const [row] = rows;
      const laneA = row!.find((lane) => lane.stacks[0]!.panelIds[0] === "A")!;
      const laneB = row!.find((lane) => lane.stacks[0]!.panelIds[0] === "B")!;
      expect(laneA.stacks.map((s) => s.panelIds[0])).toEqual(["A"]);
      expect(laneB.stacks.map((s) => s.panelIds[0])).toEqual(["B", "C"]);
      expect(laneB.depthIn).toBe(20 + 15 + bufferIn); // 38
    });

    it("never overflows the row's own frozen max depth while backfilling", () => {
      // B's lane has 100-20-3=77in of room; C(depth=80) doesn't fit (>77) -> skipped.
      const rows = packLanesWithLookahead([stackOf("A", 40, 100), stackOf("B", 40, 20), stackOf("C", 40, 80)], truckWidthIn, bufferIn);
      expect(rows).toHaveLength(2); // C couldn't backfill, falls into its own row
      const laneB = rows[0]!.find((lane) => lane.stacks[0]!.panelIds[0] === "B")!;
      expect(laneB.stacks.map((s) => s.panelIds[0])).toEqual(["B"]); // NOT backfilled
    });

    it("does not pull in a compatible backfill candidate that sits outside the lookahead window", () => {
      // Row 1 = [A, B] (B's lane has 77in of room). Filler-1..4 (also
      // width-compatible, depth 15 each) sit between B and C in the
      // sequence, pushing C outside a window of 4 anchored where row 1
      // started forming (index 0) — C should NOT get pulled into B's lane;
      // it stays wherever it naturally lands.
      const stacks = [
        stackOf("A", 40, 100),
        stackOf("B", 40, 20),
        stackOf("Filler-1", 40, 15),
        stackOf("Filler-2", 40, 15),
        stackOf("Filler-3", 40, 15),
        stackOf("Filler-4", 40, 15),
        stackOf("C", 40, 15),
      ];
      const rows = packLanesWithLookahead(stacks, truckWidthIn, bufferIn, 2);
      const laneB = rows[0]!.find((lane) => lane.stacks[0]!.panelIds[0] === "B")!;
      expect(laneB.stacks.some((s) => s.panelIds[0] === "C")).toBe(false);
    });

    it("width pass picks a better-fitting nearby stack over the raw next one when the raw next one doesn't fit at all", () => {
      // Row 1 starts with A(w40). The raw next stack, Wide(w90), can't
      // share the row (40+3+90+3+3=139>98) — but Narrow(w40), one further
      // ahead, both fits the row AND is width-compatible with A, so
      // lookahead picks it instead of immediately wrapping to a new row.
      const rows = packLanesWithLookahead([stackOf("A", 40), stackOf("Wide", 90), stackOf("Narrow", 40)], truckWidthIn, bufferIn, 4);
      expect(laneIds(rows)[0]).toEqual(["A", "Narrow"]);
      expect(laneIds(rows).flat()).toContain("Wide"); // still placed, just in a later row
    });
  });
});

describe("computeTruckLoads", () => {
  const truck: TruckDims = { lengthIn: 636, widthIn: 98, heightIn: 100 };
  const bufferIn = 3;
  const panelThicknessIn = 15.5;
  const panelHeightIn = 120;

  function panelsNamed(prefix: string, count: number, widthIn = 40): StackablePanelRef[] {
    return Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i + 1}`, widthIn }));
  }

  function mainGroup(panels: StackablePanelRef[]): PanelGroup {
    return { panels, thicknessIn: panelThicknessIn, defaultHeightIn: panelHeightIn };
  }

  /** Every real PanelStack in a load, flattened past the row/lane
   * structure — for tests that only care about which panels ended up
   * grouped together, not their row/lane placement. */
  function allStacksIn(load: TruckLoad): PanelStack[] {
    return load.rows.flatMap((row) => row.flatMap((lane) => lane.stacks));
  }

  it("returns no loads when there are no panels at all", () => {
    expect(computeTruckLoads([mainGroup([])], truck, bufferIn)).toEqual([]);
  });

  it("fits everything into 1 truck when the panel count is well under capacity", () => {
    const loads = computeTruckLoads([mainGroup(panelsNamed("N", 6))], truck, bufferIn);
    expect(loads).toHaveLength(1);
    // 6 panels, 6 per stack -> exactly 1 stack, 40in wide -> shares no row (alone), 1 row.
    expect(loads[0]!.rows).toHaveLength(1);
    expect(loads[0]!.rows[0]).toHaveLength(1);
  });

  it("packs 2 narrower stacks side by side into the same row instead of 1 lane each", () => {
    // 12 panels, 6 per stack -> 2 stacks, each 40in wide, same depth (120in
    // default for both) -> both fit in 1 row (40+3+40+3=86 <= 98), nothing
    // left over for either lane to backfill.
    const loads = computeTruckLoads([mainGroup(panelsNamed("N", 12))], truck, bufferIn);
    expect(loads).toHaveLength(1);
    expect(loads[0]!.rows).toHaveLength(1);
    expect(loads[0]!.rows[0]).toHaveLength(2);
  });

  it("spills into a 2nd truck once total rows exceed one truck's own length capacity", () => {
    // panelsPerStack=6, 2 stacks/row (40in each) -> 61 panels -> 11 stacks -> 6 rows (5 full + 1 half).
    // Each row costs 120+3=123in; usedLengthIn starts at 3 -> 5 rows fit (618in), 6th needs 741in > 636in.
    const loads = computeTruckLoads([mainGroup(panelsNamed("N", 61))], truck, bufferIn);
    expect(loads).toHaveLength(2);
    expect(loads[0]!.rows).toHaveLength(5);
    expect(loads[0]!.rows.every((r) => r.length === 2)).toBe(true);
    expect(loads[1]!.rows).toHaveLength(1);
    expect(loads[1]!.rows[0]).toHaveLength(1);
  });

  it("keeps main-panel stacks in their given order and appends header/sill stacks after them", () => {
    const main = panelsNamed("N", 3);
    const headerSill = [
      { id: "header-1", widthIn: 60 },
      { id: "sill-1", widthIn: 36 },
    ];
    const loads = computeTruckLoads(
      [mainGroup(main), { panels: headerSill, thicknessIn: panelThicknessIn, defaultHeightIn: panelHeightIn }],
      truck,
      bufferIn,
    );
    const allStackIds = loads.flatMap((l) => allStacksIn(l).map((s) => s.panelIds));
    expect(allStackIds[0]).toEqual(["N-1", "N-2", "N-3"]);
    expect(allStackIds[1]).toEqual(["header-1", "sill-1"]);
  });

  it("returns no loads when panelThicknessIn makes even 1 panel not fit", () => {
    expect(
      computeTruckLoads([{ panels: panelsNamed("N", 3), thicknessIn: 0, defaultHeightIn: panelHeightIn }], truck, bufferIn),
    ).toEqual([]);
  });

  it("skips only the infeasible group, not the whole shipment, when one group's thickness doesn't fit", () => {
    const feasible = mainGroup(panelsNamed("N", 3));
    const infeasible: PanelGroup = { panels: panelsNamed("X", 3), thicknessIn: 0, defaultHeightIn: panelHeightIn };
    const loads = computeTruckLoads([feasible, infeasible], truck, bufferIn);
    const ids = loads.flatMap((l) => allStacksIn(l).flatMap((s) => s.panelIds));
    expect(ids).toEqual(["N-1", "N-2", "N-3"]);
  });

  it("packs short header/sill stacks using their own real height, not the main panels' uniform height", () => {
    // Each header/sill stack is only 20in tall (its own heightIn), far
    // shorter than the 120in main-panel default — a uniform-height packer
    // would only fit 5 rows total; giving these their own height should
    // let many more of them share the same truck length instead.
    const shortHeaderSill: StackablePanelRef[] = Array.from({ length: 20 }, (_, i) => ({
      id: `header-${i + 1}`,
      widthIn: 40,
      heightIn: 20,
    }));
    const group: PanelGroup = { panels: shortHeaderSill, thicknessIn: panelThicknessIn, defaultHeightIn: panelHeightIn };
    const loads = computeTruckLoads([group], truck, bufferIn);
    // panelsPerStack=6 -> 20 panels chunk into 4 stacks of 6/6/6/2, 2 fit
    // per row (40+3+40+3=86<=98) -> 2 rows, each row costing 20+3=23in ->
    // well within the 636in truck, so everything fits in 1 truck.
    expect(loads).toHaveLength(1);
    expect(loads[0]!.rows).toHaveLength(2);

    // With a truck barely long enough for 1 row at the old 120in/row
    // assumption (126in) but easily long enough for many 23in rows, a
    // correct per-panel-height packer should still fit both rows into 1
    // truck, whereas the old uniform-height code would have forced a 2nd
    // truck.
    const tightTruck: TruckDims = { lengthIn: 60, widthIn: 98, heightIn: 100 };
    const tightLoads = computeTruckLoads([group], tightTruck, bufferIn);
    expect(tightLoads).toHaveLength(1);
    expect(tightLoads[0]!.rows).toHaveLength(2);
  });

  it("gives loose lumber (e.g. jack studs) its own thin stacking thickness, independent of the main panels", () => {
    const main = mainGroup(panelsNamed("N", 3));
    const jackStuds: PanelGroup = {
      panels: [
        { id: "JS-1", widthIn: 3.5, heightIn: 40 },
        { id: "JS-2", widthIn: 3.5, heightIn: 40 },
      ],
      thicknessIn: 1.5, // a 2x4's own thin cross-section, not the wall's 15.5in
      defaultHeightIn: panelHeightIn,
    };
    const loads = computeTruckLoads([main, jackStuds], truck, bufferIn);
    const stacks = loads.flatMap((l) => allStacksIn(l));
    const jackStudStack = stacks.find((s) => s.panelIds.includes("JS-1"));
    expect(jackStudStack?.thicknessIn).toBe(1.5);
    expect(stacks.find((s) => s.panelIds.includes("N-1"))?.thicknessIn).toBe(panelThicknessIn);
  });

  it("dispatches a useCompatibilityStacking group through chunkIntoStacksSmart and a plain group through chunkIntoStacks, in the same call", () => {
    const smart: PanelGroup = {
      panels: [
        { id: "N-1", widthIn: 40, heightIn: panelHeightIn },
        { id: "header-2", widthIn: 40, heightIn: 20 }, // no kind set -> resolves to "other" -> still too short to support N-1 -> diverts
        { id: "N-3", widthIn: 40, heightIn: panelHeightIn },
      ],
      thicknessIn: panelThicknessIn,
      defaultHeightIn: panelHeightIn,
      useCompatibilityStacking: true,
    };
    const legacy = mainGroup(panelsNamed("X", 3)); // no flag -> plain count-based chunking, unaffected by height differences

    const loads = computeTruckLoads([smart, legacy], truck, bufferIn);
    const stacks = loads.flatMap((l) => allStacksIn(l));

    const smartMain = stacks.find((s) => s.panelIds.includes("N-1"));
    expect(smartMain?.panelIds).toEqual(["N-1", "N-3"]); // main run, header diverted out
    const diverted = stacks.find((s) => s.panelIds.includes("header-2"));
    expect(diverted?.panelIds).toEqual(["header-2"]);

    const legacyStack = stacks.find((s) => s.panelIds.includes("X-1"));
    expect(legacyStack?.panelIds).toEqual(["X-1", "X-2", "X-3"]); // untouched — same 3 panels, one chunk
  });

  it("end to end: a real kind-typed header never bottoms a stack, and dunnageGapIn threads through from opts", () => {
    const group: PanelGroup = {
      panels: [
        { id: "N-1", widthIn: 40, heightIn: panelHeightIn, kind: "other" },
        { id: "header-1", widthIn: 40, heightIn: 20, kind: "header" },
        { id: "N-2", widthIn: 40, heightIn: panelHeightIn, kind: "other" },
      ],
      thicknessIn: panelThicknessIn,
      defaultHeightIn: panelHeightIn,
      useCompatibilityStacking: true,
    };
    const loads = computeTruckLoads([group], truck, bufferIn, { dunnageGapIn: 0.75 });
    const stacks = loads.flatMap((l) => allStacksIn(l));
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.panelIds).toEqual(["N-1", "header-1", "N-2"]); // header capped, never the bottom
  });
});
