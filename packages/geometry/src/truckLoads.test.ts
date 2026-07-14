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
    const stacks = chunkIntoStacks(panels, 2);
    expect(stacks).toHaveLength(3); // 2, 2, 1
    expect(stacks[0]!.panelIds).toEqual(["N-1", "N-2"]);
    expect(stacks[1]!.panelIds).toEqual(["N-3", "N-4"]);
    expect(stacks[2]!.panelIds).toEqual(["N-5"]);
  });

  it("uses the widest panel in each stack as that stack's own footprint width", () => {
    const stacks = chunkIntoStacks(panels, 2);
    expect(stacks[1]!.widthIn).toBe(40); // max(25.5, 40)
  });

  it("returns an empty list for a non-positive stack size", () => {
    expect(chunkIntoStacks(panels, 0)).toEqual([]);
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
});
