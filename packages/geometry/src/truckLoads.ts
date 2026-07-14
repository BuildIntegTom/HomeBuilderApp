/** A trailer's usable cargo envelope — front-to-back, side-to-side,
 * floor-to-ceiling (see `truckBedTypes` in panel-catalog's data.ts). */
export interface TruckDims {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

export interface StackablePanelRef {
  id: string;
  widthIn: number;
  /** This panel's own real height/depth along whichever axis lays flat
   * into the truck's length (Tommy: "you can orient the panels however
   * you want to make them space efficient") — a header or sill is far
   * shorter than a full wall panel, so giving it its own real height
   * instead of assuming every panel shares the shipment's one uniform
   * height fits far more of them into the same truck length. Undefined
   * falls back to the caller's own uniform `panelHeightIn` (the original,
   * still-supported behavior for a set of panels that genuinely do all
   * share one height, e.g. every main wall panel). */
  heightIn?: number;
}

export interface PanelStack {
  /** Top to bottom — the first entry is the top of the stack (Tommy: "that
   * panel on the corner is the top of the first stack"). */
  panelIds: string[];
  /** The stack's own footprint width — the widest panel it holds, since a
   * stack's own panels can vary in width (Tommy: "Panel can be creatively
   * stacked in a way to save space") and the stack needs one consistent
   * footprint to grid-pack against its neighbors. */
  widthIn: number;
  /** The stack's own footprint height/depth — the tallest panel it holds
   * (mirrors `widthIn`'s own convention), so a row of short header/sill
   * stacks reserves only as much of the truck's length as its own tallest
   * member actually needs, not a flat uniform assumption. */
  heightIn: number;
}

export interface TruckLoad {
  stacks: PanelStack[];
}

/**
 * How many panels of `panelThicknessIn` stack face-to-face (Tommy: "figure
 * out how many panels can fit (face to face to face...) inside the van
 * height wise") before hitting the trailer's own ceiling, leaving the
 * buffer clear top and bottom of the whole stack (no gap BETWEEN panels
 * within a stack — they bear directly on each other; the buffer is only
 * at the stack's own outer top/bottom face).
 */
export function computePanelsPerStack(truckHeightIn: number, panelThicknessIn: number, bufferIn: number): number {
  if (panelThicknessIn <= 0) return 0;
  return Math.max(0, Math.floor((truckHeightIn - 2 * bufferIn) / panelThicknessIn));
}

/** How many stacks fit side by side across the trailer's own width — see
 * `computeStacksPerTruck`'s doc comment for the full rationale. */
export function computeStacksAcrossWidth(truckWidthIn: number, maxStackWidthIn: number, bufferIn: number): number {
  if (maxStackWidthIn <= 0) return 0;
  return Math.max(0, Math.floor((truckWidthIn - bufferIn) / (maxStackWidthIn + bufferIn)));
}

/** How many rows of stacks fit front-to-back along the trailer's own
 * length — see `computeStacksPerTruck`'s doc comment for the full
 * rationale. */
export function computeRowsAlongLength(truckLengthIn: number, panelHeightIn: number, bufferIn: number): number {
  if (panelHeightIn <= 0) return 0;
  return Math.max(0, Math.floor((truckLengthIn - bufferIn) / (panelHeightIn + bufferIn)));
}

/**
 * How many stacks fit into one truck: side by side across the trailer's
 * width, times rows front-to-back along its length. Each row is one
 * `panelHeightIn` deep — a wall panel's own standard height (120in) is
 * taller than every trailer's own cross-section, so it can only fit lying
 * flat with that dimension running along the trailer's length, not its
 * width or height (see `truckBedTypes`'s own doc comment). The 3in buffer
 * (Tommy) is shared between neighbors — one gap between any two things,
 * stack-to-stack or stack-to-wall, not doubled.
 */
export function computeStacksPerTruck(truck: TruckDims, maxStackWidthIn: number, panelHeightIn: number, bufferIn: number): number {
  return (
    computeStacksAcrossWidth(truck.widthIn, maxStackWidthIn, bufferIn) *
    computeRowsAlongLength(truck.lengthIn, panelHeightIn, bufferIn)
  );
}

/**
 * Groups an ordered list of panels into stacks of up to `panelsPerStack`
 * each, preserving order (Tommy: "it's row stacked under it" — the
 * sequence keeps filling one stack before starting the next). Each
 * panel's own `heightIn` (falling back to `defaultHeightIn` when a panel
 * doesn't specify one) rolls up into that stack's own tallest-member
 * footprint height, mirroring the existing widthIn convention.
 */
export function chunkIntoStacks(panels: StackablePanelRef[], panelsPerStack: number, defaultHeightIn: number): PanelStack[] {
  if (panelsPerStack <= 0) return [];
  const stacks: PanelStack[] = [];
  for (let i = 0; i < panels.length; i += panelsPerStack) {
    const chunk = panels.slice(i, i + panelsPerStack);
    stacks.push({
      panelIds: chunk.map((p) => p.id),
      widthIn: Math.max(...chunk.map((p) => p.widthIn)),
      heightIn: Math.max(...chunk.map((p) => p.heightIn ?? defaultHeightIn)),
    });
  }
  return stacks;
}

/**
 * The full stacking plan across however many trucks are needed (Tommy:
 * "how many trucks will be needed to transport this project, how should
 * they be stacked, and how should those stacks be put into the truck") —
 * `mainPanels` should already be in load order (see `computePanelLoadOrder`
 * in panelLoadOrder.ts) and `headerSillPanels` sorted biggest-to-smallest
 * (Tommy: "no need for headers and sills to be stacked with the main stack
 * if they are different sizes... they can be stacked from biggest to
 * littlest separately"). Header/sill stacks fill in after every main-panel
 * stack, continuing into the same trucks rather than always starting
 * fresh ones. `panelHeightIn` is the fallback/default height for any panel
 * ref that doesn't carry its own `heightIn` (main wall panels typically
 * share one real height, so they can rely on this default; headers/sills
 * should carry their own real per-instance height).
 *
 * Stacks are packed row by row across the truck's width (every stack in a
 * row shares that row's own real depth — the tallest stack in it, Tommy:
 * "you can orient the panels however you want to make them space
 * efficient"), so a run of short header/sill stacks costs far less of the
 * truck's length than a row of full-height wall panels, rather than every
 * row reserving one flat uniform depth. This is still a "reference, not a
 * true optimizer" packer (row-major, no free rotation or true bin-packing)
 * consistent with this app's other geometry helpers.
 */
export function computeTruckLoads(
  mainPanels: StackablePanelRef[],
  headerSillPanels: StackablePanelRef[],
  truck: TruckDims,
  panelThicknessIn: number,
  panelHeightIn: number,
  bufferIn: number,
): TruckLoad[] {
  const allPanels = [...mainPanels, ...headerSillPanels];
  if (allPanels.length === 0) return [];

  const panelsPerStack = computePanelsPerStack(truck.heightIn, panelThicknessIn, bufferIn);
  if (panelsPerStack <= 0) return [];

  const maxWidthIn = Math.max(...allPanels.map((p) => p.widthIn));
  const stacksAcrossWidth = computeStacksAcrossWidth(truck.widthIn, maxWidthIn, bufferIn);
  if (stacksAcrossWidth <= 0) return [];

  const allStacks = [
    ...chunkIntoStacks(mainPanels, panelsPerStack, panelHeightIn),
    ...chunkIntoStacks(headerSillPanels, panelsPerStack, panelHeightIn),
  ];

  const loads: TruckLoad[] = [];
  let currentLoad: PanelStack[] = [];
  let usedLengthIn = bufferIn;
  for (let i = 0; i < allStacks.length; i += stacksAcrossWidth) {
    const row = allStacks.slice(i, i + stacksAcrossWidth);
    const rowCostIn = Math.max(...row.map((s) => s.heightIn)) + bufferIn;
    if (usedLengthIn + rowCostIn > truck.lengthIn && currentLoad.length > 0) {
      loads.push({ stacks: currentLoad });
      currentLoad = [];
      usedLengthIn = bufferIn;
    }
    currentLoad.push(...row);
    usedLengthIn += rowCostIn;
  }
  if (currentLoad.length > 0) loads.push({ stacks: currentLoad });
  return loads;
}
