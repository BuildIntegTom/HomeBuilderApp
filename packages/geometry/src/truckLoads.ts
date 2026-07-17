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
   * falls back to the owning group's own `defaultHeightIn` (see
   * `PanelGroup`) — the original, still-supported behavior for a set of
   * panels that genuinely do all share one height, e.g. every main wall
   * panel). */
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
  /** This stack's own real face-to-face stacking thickness, from whichever
   * `PanelGroup` it was chunked from (Tommy: "jack studs can be piled up
   * together... hot dog rotation") — a full wall panel and a loose jack
   * stud stick are wildly different thicknesses, so every stack in a load
   * carries its own, rather than one shipment-wide uniform value. */
  thicknessIn: number;
}

export interface TruckLoad {
  /** Rows packed left-to-right across the trailer's own width, each row
   * holding as many stacks (in the given order — Tommy's load-order
   * sequencing must survive packing) as actually fit by their own real
   * width, then front-to-back along the trailer's length (Tommy: "its very
   * very handy to be able to have 2 rows of panels" — a single shipment-
   * wide grid cell sized to the widest stack anywhere used to force every
   * other, narrower stack into its own lane even when 2+ would easily fit
   * side by side). */
  rows: PanelStack[][];
}

/** A set of panels that all share one real face-to-face stacking
 * thickness and one fallback height (Tommy: "jack studs can be piled up
 * together... hot dog rotation" — loose jack-stud lumber is far thinner
 * than a full wall panel, so it needs its own stacking math entirely
 * independent of the main panels/headers/sills it ships alongside). */
export interface PanelGroup {
  panels: StackablePanelRef[];
  thicknessIn: number;
  defaultHeightIn: number;
  /** Chunk this group with `chunkIntoStacksSmart` (size-safety-aware)
   * instead of the plain count-based `chunkIntoStacks`. Left off (falsy)
   * for groups like loose jack-stud lumber, whose per-opening heights
   * vary too wildly to be meaningfully compared this way and which are
   * already a categorically different, not-a-flat-wall-panel shipment. */
  useCompatibilityStacking?: boolean;
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

/**
 * Groups an ordered list of panels into stacks of up to `panelsPerStack`
 * each, preserving order (Tommy: "it's row stacked under it" — the
 * sequence keeps filling one stack before starting the next). Each
 * panel's own `heightIn` (falling back to `defaultHeightIn` when a panel
 * doesn't specify one) rolls up into that stack's own tallest-member
 * footprint height, mirroring the existing widthIn convention. Every stack
 * produced here shares the one `thicknessIn` passed in (they all came from
 * the same `PanelGroup`).
 */
export function chunkIntoStacks(
  panels: StackablePanelRef[],
  panelsPerStack: number,
  defaultHeightIn: number,
  thicknessIn: number,
): PanelStack[] {
  if (panelsPerStack <= 0) return [];
  const stacks: PanelStack[] = [];
  for (let i = 0; i < panels.length; i += panelsPerStack) {
    const chunk = panels.slice(i, i + panelsPerStack);
    stacks.push({
      panelIds: chunk.map((p) => p.id),
      widthIn: Math.max(...chunk.map((p) => p.widthIn)),
      heightIn: Math.max(...chunk.map((p) => p.heightIn ?? defaultHeightIn)),
      thicknessIn,
    });
  }
  return stacks;
}

const STACK_SAFETY_TOLERANCE = 0.9; // a panel can't support something more than 10% bigger than itself, in either dimension

interface OpenStack {
  stack: PanelStack;
  bottomWidthIn: number;
  bottomHeightIn: number;
}

function isValidDimension(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** True if `candidateWidthIn`/`candidateHeightIn` is safe to place as the
 * new physical bottom of a stack currently topped by
 * `bottomWidthIn`/`bottomHeightIn` (Tommy: "smaller panels can always be
 * on top of bigger panels, just not under"). One-directional: a panel can
 * be arbitrarily LARGER than what it's going under (always safe — no
 * overhang), but can't be more than 10% SMALLER in either width or height
 * (would leave the panel above unsupported). Any non-positive/NaN
 * dimension on either side fails closed (never a valid bottom, never a
 * valid candidate) rather than becoming a universal "anything fits"
 * magnet for corrupt data. */
function canSupport(candidateWidthIn: number, candidateHeightIn: number, bottomWidthIn: number, bottomHeightIn: number): boolean {
  if (!isValidDimension(candidateWidthIn) || !isValidDimension(candidateHeightIn)) return false;
  if (!isValidDimension(bottomWidthIn) || !isValidDimension(bottomHeightIn)) return false;
  return candidateWidthIn >= bottomWidthIn * STACK_SAFETY_TOLERANCE && candidateHeightIn >= bottomHeightIn * STACK_SAFETY_TOLERANCE;
}

/**
 * Same job as `chunkIntoStacks` — groups an ordered panel list into
 * stacks — but safety-aware (Tommy: "we cannot stack panels that are like
 * 10% or more bigger than the top panel... [although] we can put multiple
 * panels in the row to make up for this"): a panel can only become the
 * new bottom of a stack if it can safely support whatever's currently on
 * top of that stack (see `canSupport`). When the next panel in sequence
 * can't extend the main stack, it's diverted into a side-stack instead of
 * forcing an unsafe/oversized combination — and 2+ consecutive diverted
 * panels that ARE compatible with each other (e.g. 2 sills back to back)
 * share one side-stack rather than each getting its own.
 *
 * Side-stacks are tracked most-recently-touched-first and always sealed
 * (stop accepting new panels) the moment the main stack either resumes or
 * hits its own `panelsPerStack` capacity — this keeps a side-stack's
 * lifetime anchored to the single "disruption episode" that created it,
 * rather than letting a header from one wall silently merge with a sill
 * from a totally different, much-later point in the load sequence.
 *
 * Every stack is appended to the output array at the moment it's
 * CREATED, then only ever mutated in place afterward — never moved or
 * reordered — which is what guarantees every side-stack always lands
 * immediately adjacent, in the returned list, to the main-stack segment
 * it interrupted. `packRowsByWidth` (unchanged) then naturally keeps
 * those side-stacks in the same or very next row, with no awareness of
 * where they came from needed.
 */
export function chunkIntoStacksSmart(
  panels: StackablePanelRef[],
  panelsPerStack: number,
  defaultHeightIn: number,
  thicknessIn: number,
): PanelStack[] {
  if (panelsPerStack <= 0) return [];

  const output: PanelStack[] = [];
  let mainStack: OpenStack | null = null;
  let sideStacks: OpenStack[] = [];

  const newOpenStack = (id: string, widthIn: number, heightIn: number): OpenStack => {
    const stack: PanelStack = { panelIds: [id], widthIn, heightIn, thicknessIn };
    output.push(stack);
    return { stack, bottomWidthIn: widthIn, bottomHeightIn: heightIn };
  };

  const appendTo = (entry: OpenStack, id: string, widthIn: number, heightIn: number) => {
    entry.stack.panelIds.push(id);
    entry.stack.widthIn = Math.max(entry.stack.widthIn, widthIn);
    entry.stack.heightIn = Math.max(entry.stack.heightIn, heightIn);
    entry.bottomWidthIn = widthIn;
    entry.bottomHeightIn = heightIn;
  };

  for (const panel of panels) {
    const widthIn = panel.widthIn;
    const heightIn = panel.heightIn ?? defaultHeightIn;

    if (mainStack && mainStack.stack.panelIds.length >= panelsPerStack) {
      mainStack = null;
      sideStacks = [];
    }

    if (!mainStack) {
      mainStack = newOpenStack(panel.id, widthIn, heightIn);
      continue;
    }

    if (canSupport(widthIn, heightIn, mainStack.bottomWidthIn, mainStack.bottomHeightIn)) {
      appendTo(mainStack, panel.id, widthIn, heightIn);
      sideStacks = [];
      continue;
    }

    let joined = false;
    for (let i = sideStacks.length - 1; i >= 0; i--) {
      const candidate = sideStacks[i]!;
      if (
        candidate.stack.panelIds.length < panelsPerStack &&
        canSupport(widthIn, heightIn, candidate.bottomWidthIn, candidate.bottomHeightIn)
      ) {
        appendTo(candidate, panel.id, widthIn, heightIn);
        sideStacks.splice(i, 1);
        if (candidate.stack.panelIds.length < panelsPerStack) sideStacks.push(candidate);
        joined = true;
        break;
      }
    }
    if (!joined) sideStacks.push(newOpenStack(panel.id, widthIn, heightIn));
  }

  return output;
}

/**
 * Wraps an ordered list of stacks into rows across the trailer's own width
 * (Tommy: "it usually spawns with a single row, its very very handy to be
 * able to have 2 rows of panels") — a "shelf"/next-fit pack: keeps adding
 * the next stack (in the given order — never reordered, so load-order
 * sequencing survives) to the current row as long as it still fits within
 * `truckWidthIn`, wrapping to a new row only once it doesn't. This lets 2+
 * narrower stacks share a row's width instead of every stack being forced
 * into a single shipment-wide lane sized to the single widest stack
 * anywhere. A stack wider than the trailer itself still gets placed (alone
 * in an over-width row) rather than silently dropped.
 */
export function packRowsByWidth(stacks: PanelStack[], truckWidthIn: number, bufferIn: number): PanelStack[][] {
  const rows: PanelStack[][] = [];
  let currentRow: PanelStack[] = [];
  let usedWidthIn = bufferIn;
  for (const stack of stacks) {
    const neededWidthIn = usedWidthIn + stack.widthIn + bufferIn;
    if (neededWidthIn > truckWidthIn && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      usedWidthIn = bufferIn;
    }
    currentRow.push(stack);
    usedWidthIn += stack.widthIn + bufferIn;
  }
  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

/**
 * The full stacking plan across however many trucks are needed (Tommy:
 * "how many trucks will be needed to transport this project, how should
 * they be stacked, and how should those stacks be put into the truck") —
 * each `PanelGroup`'s panels should already be given in the intended stack/
 * row order (main + header/sill panels together, in load order — see
 * `computePanelLoadOrder` in panelLoadOrder.ts — then any further groups
 * like loose jack-stud lumber), since groups are chunked and packed in the
 * order given, never reordered. A group with `useCompatibilityStacking` set
 * is chunked with `chunkIntoStacksSmart` (Tommy: "we cannot stack panels
 * that are like 10% or more bigger than the top panel") instead of the
 * plain count-based `chunkIntoStacks` — see that function's own doc
 * comment for why headers/sills no longer get pulled into one separate
 * biggest-to-smallest batch at the end.
 *
 * Stacks are packed into rows across the trailer's own width by their own
 * real width (`packRowsByWidth`), then rows are packed front-to-back along
 * the trailer's length, each row costing only its own real depth — the
 * tallest stack in it — rather than one flat uniform depth (Tommy: "you can
 * orient the panels however you want to make them space efficient"). This
 * is still a "reference, not a true optimizer" packer (shelf-based, no free
 * rotation or true bin-packing) consistent with this app's other geometry
 * helpers.
 */
export function computeTruckLoads(groups: PanelGroup[], truck: TruckDims, bufferIn: number): TruckLoad[] {
  const allStacks: PanelStack[] = [];
  for (const group of groups) {
    if (group.panels.length === 0) continue;
    const panelsPerStack = computePanelsPerStack(truck.heightIn, group.thicknessIn, bufferIn);
    if (panelsPerStack <= 0) continue; // this group's own thickness doesn't fit at all — skip it, not the whole shipment
    allStacks.push(
      ...(group.useCompatibilityStacking
        ? chunkIntoStacksSmart(group.panels, panelsPerStack, group.defaultHeightIn, group.thicknessIn)
        : chunkIntoStacks(group.panels, panelsPerStack, group.defaultHeightIn, group.thicknessIn)),
    );
  }
  if (allStacks.length === 0) return [];

  const allRows = packRowsByWidth(allStacks, truck.widthIn, bufferIn);

  const loads: TruckLoad[] = [];
  let currentLoad: PanelStack[][] = [];
  let usedLengthIn = bufferIn;
  for (const row of allRows) {
    const rowCostIn = Math.max(...row.map((s) => s.heightIn)) + bufferIn;
    if (usedLengthIn + rowCostIn > truck.lengthIn && currentLoad.length > 0) {
      loads.push({ rows: currentLoad });
      currentLoad = [];
      usedLengthIn = bufferIn;
    }
    currentLoad.push(row);
    usedLengthIn += rowCostIn;
  }
  if (currentLoad.length > 0) loads.push({ rows: currentLoad });
  return loads;
}
