import { describe, expect, it } from "vitest";
import {
  chunkIntoStacks,
  computePanelsPerStack,
  computeTruckLoads,
  packRowsByWidth,
  type PanelGroup,
  type PanelStack,
  type StackablePanelRef,
  type TruckDims,
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

describe("packRowsByWidth", () => {
  const bufferIn = 3;
  const truckWidthIn = 98;

  function stackOf(id: string, widthIn: number): PanelStack {
    return { panelIds: [id], widthIn, heightIn: 120, thicknessIn: 15.5 };
  }

  it("puts 2+ narrow stacks side by side in one row when they both fit", () => {
    // 40 + 3 + 40 + 3(leading) = 86in, well within 98in — should share a row.
    const rows = packRowsByWidth([stackOf("A", 40), stackOf("B", 40)], truckWidthIn, bufferIn);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.map((s) => s.panelIds[0])).toEqual(["A", "B"]);
  });

  it("wraps to a new row once the next stack no longer fits", () => {
    // 68.25 + 3 + 68.25 + 3 = 142.5in > 98in — the 2nd 68.25in stack can't share row 1.
    const rows = packRowsByWidth([stackOf("A", 68.25), stackOf("B", 68.25)], truckWidthIn, bufferIn);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.map((s) => s.panelIds[0])).toEqual(["A"]);
    expect(rows[1]!.map((s) => s.panelIds[0])).toEqual(["B"]);
  });

  it("preserves given stack order even across a wrap (never reorders for a tighter pack)", () => {
    // A wide stack sits between 2 narrow ones — order must still be A, B, C.
    const rows = packRowsByWidth([stackOf("A", 40), stackOf("B", 68.25), stackOf("C", 40)], truckWidthIn, bufferIn);
    const flat = rows.flatMap((r) => r.map((s) => s.panelIds[0]));
    expect(flat).toEqual(["A", "B", "C"]);
  });

  it("still places a single stack wider than the trailer itself, alone in its own row", () => {
    const rows = packRowsByWidth([stackOf("A", 500)], truckWidthIn, bufferIn);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.map((s) => s.panelIds[0])).toEqual(["A"]);
  });

  it("returns no rows for an empty stack list", () => {
    expect(packRowsByWidth([], truckWidthIn, bufferIn)).toEqual([]);
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
    // 12 panels, 6 per stack -> 2 stacks, each 40in wide -> both fit in 1 row (40+3+40+3=86 <= 98).
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
    const allStackIds = loads.flatMap((l) => l.rows.flatMap((r) => r.map((s) => s.panelIds)));
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
    const ids = loads.flatMap((l) => l.rows.flatMap((r) => r.flatMap((s) => s.panelIds)));
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
    const stacks = loads.flatMap((l) => l.rows.flat());
    const jackStudStack = stacks.find((s) => s.panelIds.includes("JS-1"));
    expect(jackStudStack?.thicknessIn).toBe(1.5);
    expect(stacks.find((s) => s.panelIds.includes("N-1"))?.thicknessIn).toBe(panelThicknessIn);
  });
});
