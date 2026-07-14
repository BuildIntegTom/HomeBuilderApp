import { describe, expect, it } from "vitest";
import {
  chunkIntoStacks,
  computePanelsPerStack,
  computeRowsAlongLength,
  computeStacksAcrossWidth,
  computeStacksPerTruck,
  computeTruckLoads,
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

describe("computeStacksAcrossWidth / computeRowsAlongLength", () => {
  it("matches computeStacksPerTruck's own product of the two factors", () => {
    expect(computeStacksAcrossWidth(98, 40, 3)).toBe(2); // floor(95/43)
    expect(computeRowsAlongLength(636, 120, 3)).toBe(5); // floor(633/123)
  });
});

describe("computeStacksPerTruck", () => {
  const truck: TruckDims = { lengthIn: 636, widthIn: 98, heightIn: 100 };

  it("multiplies stacks-across-width by rows-along-length", () => {
    // width: floor((98-3)/(40+3)) = floor(95/43) = 2 stacks across.
    // length: floor((636-3)/(120+3)) = floor(633/123) = 5 rows.
    expect(computeStacksPerTruck(truck, 40, 120, 3)).toBe(2 * 5);
  });

  it("returns 0 when a single stack's own width doesn't fit at all", () => {
    expect(computeStacksPerTruck(truck, 500, 120, 3)).toBe(0);
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
    const stacks = chunkIntoStacks(panels, 2, 120);
    expect(stacks).toHaveLength(3); // 2, 2, 1
    expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2"]);
    expect(stacks[1]!.panelIds).toEqual(["N-3", "N-4"]);
    expect(stacks[2]!.panelIds).toEqual(["N-5"]);
  });

  it("uses the widest panel in each stack as that stack's own footprint width", () => {
    const stacks = chunkIntoStacks(panels, 2, 120);
    expect(stacks[1]!.widthIn).toBe(40); // max(25.5, 40)
  });

  it("returns an empty list for a non-positive stack size", () => {
    expect(chunkIntoStacks(panels, 0, 120)).toEqual([]);
  });

  it("falls back to the given default height for panels with no heightIn of their own", () => {
    const stacks = chunkIntoStacks(panels, 2, 120);
    expect(stacks[0]!.heightIn).toBe(120);
  });

  it("uses the tallest panel's own real heightIn when panels specify one", () => {
    const shortPanels: StackablePanelRef[] = [
      { id: "header-1", widthIn: 60, heightIn: 18 },
      { id: "sill-1", widthIn: 36, heightIn: 32 },
    ];
    const stacks = chunkIntoStacks(shortPanels, 2, 120);
    expect(stacks[0]!.heightIn).toBe(32); // max(18, 32), not the 120in default
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

  it("returns no loads when there are no panels at all", () => {
    expect(computeTruckLoads([], [], truck, panelThicknessIn, panelHeightIn, bufferIn)).toEqual([]);
  });

  it("fits everything into 1 truck when the panel count is well under capacity", () => {
    const loads = computeTruckLoads(panelsNamed("N", 6), [], truck, panelThicknessIn, panelHeightIn, bufferIn);
    expect(loads).toHaveLength(1);
    expect(loads[0]!.stacks).toHaveLength(1); // 6 panels, 6 per stack -> exactly 1 stack
  });

  it("spills into a 2nd truck once total stacks exceed one truck's own capacity", () => {
    // panelsPerStack=6, stacksPerTruck=10 (2 across x 5 rows) -> 60 panels/truck.
    const loads = computeTruckLoads(panelsNamed("N", 61), [], truck, panelThicknessIn, panelHeightIn, bufferIn);
    expect(loads).toHaveLength(2);
    expect(loads[0]!.stacks).toHaveLength(10);
    expect(loads[1]!.stacks).toHaveLength(1);
  });

  it("keeps main-panel stacks in their given (load) order and appends header/sill stacks after them", () => {
    const main = panelsNamed("N", 3);
    const headerSill = [{ id: "header-1", widthIn: 60 }, { id: "sill-1", widthIn: 36 }];
    const loads = computeTruckLoads(main, headerSill, truck, panelThicknessIn, panelHeightIn, bufferIn);
    const allStackIds = loads.flatMap((l) => l.stacks.map((s) => s.panelIds));
    expect(allStackIds[0]).toEqual(["N-1", "N-2", "N-3"]);
    expect(allStackIds[1]).toEqual(["header-1", "sill-1"]);
  });

  it("returns no loads when panelThicknessIn makes even 1 panel not fit", () => {
    expect(computeTruckLoads(panelsNamed("N", 3), [], truck, 0, panelHeightIn, bufferIn)).toEqual([]);
  });

  it("packs short header/sill stacks using their own real height, not the main panels' uniform height", () => {
    // Each header/sill stack is only 20in tall (its own heightIn), far
    // shorter than the 120in main-panel default — a uniform-height packer
    // would only fit 5 rows total (see the "spills into a 2nd truck" case
    // above); giving these their own height should let many more of them
    // share the same truck length instead of being forced into extra rows
    // at the 120in default.
    const shortHeaderSill: StackablePanelRef[] = Array.from({ length: 20 }, (_, i) => ({
      id: `header-${i + 1}`,
      widthIn: 40,
      heightIn: 20,
    }));
    const loads = computeTruckLoads([], shortHeaderSill, truck, panelThicknessIn, panelHeightIn, bufferIn);
    // panelsPerStack=6 -> 20 panels chunk into 4 stacks of 6/6/6/2, 2 across
    // -> 2 rows, each row costing 20+3=23in -> well within the 636in truck,
    // so everything fits in 1 truck (a uniform 120in assumption would still
    // fit here too, but the point is confirming the row cost is really 23in
    // per row, not 123in — checked below via a tighter truck).
    expect(loads).toHaveLength(1);
    expect(loads[0]!.stacks).toHaveLength(4);

    // With a truck barely long enough for 1 row at the old 120in/row
    // assumption (126in) but easily long enough for many 23in rows, a
    // correct per-panel-height packer should still fit all 4 stacks (2
    // rows) into 1 truck, whereas the old uniform-height code would have
    // read this truck as only fitting 1 row (1 rowsAlongLength) and forced
    // a 2nd truck.
    const tightTruck: TruckDims = { lengthIn: 130, widthIn: 98, heightIn: 100 };
    const tightLoads = computeTruckLoads([], shortHeaderSill, tightTruck, panelThicknessIn, panelHeightIn, bufferIn);
    expect(tightLoads).toHaveLength(1);
    expect(tightLoads[0]!.stacks).toHaveLength(4);
  });
});
