/** A trailer's usable cargo envelope — front-to-back, side-to-side,
 * floor-to-ceiling (see `truckBedTypes` in panel-catalog's data.ts). */
export interface TruckDims {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

/** Header/sill vs everything else (Tommy: "header and sills for window
 * RO's... should not be the bottom of a stack") — the only distinction
 * `chunkIntoStacksSmart`'s stacking rules care about. `"other"` covers every
 * main/corner/column/etc. panel, and is also what an unset `kind` resolves
 * to (see `StackablePanelRef.kind`), so every pre-existing caller that never
 * sets it keeps today's exact stacking behavior. */
export type StackablePanelKind = "header" | "sill" | "other";

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
  /** Undefined resolves to `"other"` everywhere this is read — see
   * `StackablePanelKind`. */
  kind?: StackablePanelKind;
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

/** What used to be one `PanelStack` slot in a row, generalized to hold 2+
 * stacks packed one behind another in depth (Tommy: "utilize the full
 * space" — a shallow header/sill stack sharing a row with a full-height
 * main-panel stack used to waste all the leftover depth behind it). Almost
 * always length 1 — depth-backfill (`packLanesWithLookahead`) is what grows
 * it. */
export interface PanelLane {
  /** Front-to-back within this lane — index 0 nearest the trailer's own
   * front/nose. */
  stacks: PanelStack[];
  /** The widest stack this lane holds — same "widest member" convention
   * `PanelStack.widthIn` already uses, one level up. */
  widthIn: number;
  /** This lane's own total single-file depth: every stack's own `heightIn`
   * summed, plus one `bufferIn` gap between each consecutive pair — NOT the
   * row's own depth (a row's depth is the deepest lane in it; see
   * `computeTruckLoads`). */
  depthIn: number;
}

export interface TruckLoad {
  /** Rows packed left-to-right across the trailer's own width, each row
   * holding as many lanes (in the given order — Tommy's load-order
   * sequencing must survive packing) as actually fit by their own real
   * width, then front-to-back along the trailer's length (Tommy: "its very
   * very handy to be able to have 2 rows of panels"). Each lane can itself
   * hold 2+ stacks packed one behind another (see `PanelLane`). */
  rows: PanelLane[][];
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

export const STANDARD_WIDTH_TOLERANCE_RATIO = 0.1;

function isValidDimension(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** Symmetric ±10% width band (Tommy: "panels that are within 10% of the
 * width of the panelization standard panel dimension can be stacked on or
 * below other panels") — distinct from `canSupport`'s own one-directional
 * "not more than 10% smaller" rule below. Two widths are compatible when
 * NEITHER is more than `toleranceRatio` bigger than the other (order
 * doesn't matter). Shared by 3 unrelated-looking callers that are all
 * really the same tolerance concept: classifying a panel as "standard-tier"
 * against the project's own `standardWidthIn`, the relaxed header/sill
 * support check (`canSupport`), and routing a long header out of the main
 * run (`partitionLongHeaders`). Fails closed on non-positive/NaN input,
 * same convention as `canSupport`. */
export function isWidthCompatible(aWidthIn: number, bWidthIn: number, toleranceRatio: number = STANDARD_WIDTH_TOLERANCE_RATIO): boolean {
  if (!isValidDimension(aWidthIn) || !isValidDimension(bWidthIn)) return false;
  const lo = Math.min(aWidthIn, bWidthIn);
  const hi = Math.max(aWidthIn, bWidthIn);
  return lo >= hi * (1 - toleranceRatio);
}

interface StackBottom {
  widthIn: number;
  heightIn: number;
  kind: StackablePanelKind;
}

/** True if `candidate` is safe to place as the new physical bottom of a
 * stack currently topped by `bottom` (Tommy: "smaller panels can always be
 * on top of bigger panels, just not under"). One-directional for 2 "other"
 * (main/corner/etc.) panels: a panel can be arbitrarily LARGER than what
 * it's going under (always safe — no overhang), but can't be more than 10%
 * SMALLER in either width or height (would leave the panel above
 * unsupported).
 *
 * If EITHER side is a header/sill, the height leg is skipped entirely
 * (Tommy: "full sized panels [can go] above or below" a header/sill) —
 * headers/sills sit on dunnage that bridges any height mismatch, so only
 * width-compatibility (the ±10% band above, checked BOTH ways, unlike the
 * one-directional "other" rule) gates whether they can join a stack in
 * either direction. Any non-positive/NaN dimension on either side fails
 * closed (never a valid bottom, never a valid candidate) rather than
 * becoming a universal "anything fits" magnet for corrupt data. */
function canSupport(candidate: StackBottom, bottom: StackBottom): boolean {
  if (!isValidDimension(candidate.widthIn) || !isValidDimension(candidate.heightIn)) return false;
  if (!isValidDimension(bottom.widthIn) || !isValidDimension(bottom.heightIn)) return false;
  if (candidate.kind !== "other" || bottom.kind !== "other") return isWidthCompatible(candidate.widthIn, bottom.widthIn);
  return candidate.widthIn >= bottom.widthIn * STACK_SAFETY_TOLERANCE && candidate.heightIn >= bottom.heightIn * STACK_SAFETY_TOLERANCE;
}

interface OpenStack {
  /** Only COMMITTED panels — a pending header/sill run (see `pending`)
   * doesn't land here until something caps it. */
  stack: PanelStack;
  /** The notional current bottom's own dims/kind — whichever panel was
   * most recently accepted, committed or still-pending. */
  bottomWidthIn: number;
  bottomHeightIn: number;
  bottomKind: StackablePanelKind;
  /** A header/sill run not yet flushed into `stack.panelIds` (Tommy:
   * "header and sills... should not be the bottom of a stack") — held here
   * until a compatible `"other"` panel arrives to cap it from below, at
   * which point both are flushed together (see `capWith`). Only ever
   * flushed as-is, uncapped, in 2 unavoidable cases — see
   * `chunkIntoStacksSmart`'s own doc comment. */
  pending: StackablePanelRef[];
}

/** Real face-to-face thickness this `OpenStack` would occupy if flushed
 * right now, including one `dunnageGapIn` between every consecutive PAIR of
 * pending header/sill panels (never between a header/sill and a full panel,
 * and never between 2 full panels — Tommy: "stacked together with a small
 * gap"). */
function occupiedThicknessIn(open: OpenStack, thicknessIn: number, dunnageGapIn: number): number {
  const count = open.stack.panelIds.length + open.pending.length;
  const gapCount = Math.max(0, open.pending.length - 1);
  return count * thicknessIn + gapCount * dunnageGapIn;
}

/** Flushes `open`'s pending header/sill run (if any) into `stack.panelIds`
 * in order, then appends `panel` too, and clears `pending` — the "a full
 * panel caps a header/sill run from below" event (Tommy: "full sized
 * panels above or below it"). */
function capWith(open: OpenStack, panel: StackablePanelRef, widthIn: number, heightIn: number) {
  for (const p of open.pending) open.stack.panelIds.push(p.id);
  open.stack.panelIds.push(panel.id);
  open.stack.widthIn = Math.max(open.stack.widthIn, widthIn, ...open.pending.map((p) => p.widthIn));
  open.stack.heightIn = Math.max(open.stack.heightIn, heightIn, ...open.pending.map((p) => p.heightIn ?? open.stack.heightIn));
  open.pending = [];
  open.bottomWidthIn = widthIn;
  open.bottomHeightIn = heightIn;
  open.bottomKind = "other";
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
 * A header/sill panel (`kind: "header" | "sill"`) is never left as a
 * stack's own physical bottom if it can be avoided (Tommy: "headers and
 * sills... should not be the bottom of a stack") — it's held in that
 * stack's own `pending` buffer, not committed to `panelIds`, until a
 * compatible `"other"` panel arrives to cap it. A header/sill is only
 * accepted into `pending` when doing so still leaves room (both by count
 * AND by real thickness, including `dunnageGapIn` between consecutive
 * pending items) to reserve a slot for an eventual capper — otherwise it's
 * diverted, exactly like a `canSupport` failure. The ONE exception is a
 * brand-new, still-completely-empty stack: its very first panel is always
 * accepted unconditionally (mirrors the pre-existing "seed with no
 * comparison" behavior) — without this, a header/sill that can never
 * reserve a capper's worth of room (e.g. `panelsPerStack` of 1) would have
 * nowhere it could ever be placed.
 *
 * Because of the reserve check above, a header/sill only ends up as a
 * stack's TRUE bottom in 2 narrow, unavoidable cases, both left as pending
 * panels simply flushed as-is once nothing more is coming: (1) it's the
 * very last panel in the entire input, with nothing left to pair with; or
 * (2) it was diverted into its own side-stack and that side-stack got
 * sealed (main stack resumed, or hit capacity) before a capper ever
 * arrived — an isolated single-panel stack has nothing else to be "under",
 * so it's trivially its own bottom. Both are genuinely unavoidable — this
 * rule is a best effort, same "soft, not a hard boundary" spirit as the
 * safety-tolerance rule above, not a guarantee that can always be kept.
 *
 * Every stack is appended to the output array at the moment it's
 * CREATED, then only ever mutated in place afterward — never moved or
 * reordered — which is what guarantees every side-stack always lands
 * immediately adjacent, in the returned list, to the main-stack segment
 * it interrupted. `packLanesWithLookahead` (unchanged by any of the above)
 * then naturally keeps those side-stacks in the same or very next row/lane,
 * with no awareness of where they came from needed.
 */
export function chunkIntoStacksSmart(
  panels: StackablePanelRef[],
  panelsPerStack: number,
  defaultHeightIn: number,
  thicknessIn: number,
  dunnageGapIn: number = 0,
): PanelStack[] {
  if (panelsPerStack <= 0) return [];

  const budgetIn = panelsPerStack * thicknessIn;
  const output: PanelStack[] = [];
  let mainStack: OpenStack | null = null;
  let sideStacks: OpenStack[] = [];

  const newOpenStack = (): OpenStack => {
    const stack: PanelStack = { panelIds: [], widthIn: 0, heightIn: 0, thicknessIn };
    output.push(stack);
    return { stack, bottomWidthIn: 0, bottomHeightIn: 0, bottomKind: "other", pending: [] };
  };

  const isFull = (open: OpenStack) => open.stack.panelIds.length + open.pending.length >= panelsPerStack;

  /** Tries to place `panel` onto `open` (empty, or already holding
   * something). Empty always succeeds unconditionally. Otherwise: an
   * `"other"` panel must pass `canSupport` against the current bottom (and
   * caps any pending run); a header/sill must ALSO pass the reserve-a-
   * capper's-worth-of-room check. Returns false (no mutation) if `open`
   * can't accept it. */
  const tryPlace = (open: OpenStack, panel: StackablePanelRef, widthIn: number, heightIn: number, kind: StackablePanelKind): boolean => {
    const isEmpty = open.stack.panelIds.length === 0 && open.pending.length === 0;
    if (!isEmpty) {
      if (!canSupport({ widthIn, heightIn, kind }, { widthIn: open.bottomWidthIn, heightIn: open.bottomHeightIn, kind: open.bottomKind })) {
        return false;
      }
      if (kind !== "other") {
        const occupiedIn = occupiedThicknessIn(open, thicknessIn, dunnageGapIn);
        const gapBeforeThisIn = open.pending.length > 0 ? dunnageGapIn : 0;
        const reservedForCapperIn = thicknessIn;
        if (occupiedIn + gapBeforeThisIn + thicknessIn + reservedForCapperIn > budgetIn) return false;
      }
    }
    if (kind === "other") {
      capWith(open, panel, widthIn, heightIn);
    } else {
      open.pending.push(panel);
      open.bottomWidthIn = widthIn;
      open.bottomHeightIn = heightIn;
      open.bottomKind = kind;
    }
    return true;
  };

  /** Flushes an OpenStack's own pending header/sill run as-is, uncapped —
   * used both here (a side-stack sealed mid-run, with nothing having
   * capped it before the seal) and at the very end of the whole function
   * (whatever's still open once input runs out) — the 2 unavoidable
   * never-bottom exceptions this function's own doc comment describes. A
   * no-op when `pending` is already empty. */
  const flushPending = (open: OpenStack) => {
    if (open.pending.length === 0) return;
    for (const p of open.pending) {
      open.stack.panelIds.push(p.id);
      open.stack.widthIn = Math.max(open.stack.widthIn, p.widthIn);
      open.stack.heightIn = Math.max(open.stack.heightIn, p.heightIn ?? defaultHeightIn);
    }
    open.pending = [];
  };

  for (const panel of panels) {
    const widthIn = panel.widthIn;
    const heightIn = panel.heightIn ?? defaultHeightIn;
    const kind = panel.kind ?? "other";

    if (mainStack && isFull(mainStack)) {
      flushPending(mainStack);
      sideStacks.forEach(flushPending);
      mainStack = null;
      sideStacks = [];
    }

    if (!mainStack) {
      mainStack = newOpenStack();
      tryPlace(mainStack, panel, widthIn, heightIn, kind);
      continue;
    }

    if (tryPlace(mainStack, panel, widthIn, heightIn, kind)) {
      sideStacks.forEach(flushPending);
      sideStacks = [];
      continue;
    }

    let joined = false;
    for (let i = sideStacks.length - 1; i >= 0; i--) {
      const candidate = sideStacks[i]!;
      if (!isFull(candidate) && tryPlace(candidate, panel, widthIn, heightIn, kind)) {
        sideStacks.splice(i, 1);
        if (!isFull(candidate)) sideStacks.push(candidate);
        joined = true;
        break;
      }
    }
    if (!joined) {
      const fresh = newOpenStack();
      tryPlace(fresh, panel, widthIn, heightIn, kind);
      sideStacks.push(fresh);
    }
  }

  // Flush whatever's left pending on every still-open stack (main + every
  // side-stack) — the 2nd of the 2 unavoidable never-bottom exceptions
  // described in this function's own doc comment (the 1st — a side-stack
  // sealed mid-run — is handled by the `flushPending` calls above).
  if (mainStack) flushPending(mainStack);
  sideStacks.forEach(flushPending);

  return output;
}

/**
 * Splits a header run out of the main panel sequence (Tommy: "longer
 * headers should probably be stacked separately") — a `"header"`-kind panel
 * whose own width falls OUTSIDE the ±10% standard-width band (see
 * `isWidthCompatible`) against `standardWidthIn` (the project's own
 * "panelization standard panel dimension") never merges into the main run
 * at all, routing instead to its own dedicated group. This also fixes a
 * footprint-bloat problem: `canSupport` has no upper bound on a candidate's
 * own width (a wider base is always "safe" to support something narrower),
 * so a very wide header could otherwise become a stack's own base and
 * balloon that stack's — and its whole row's — width footprint far past
 * what its neighbors actually need.
 *
 * Sills are never routed here regardless of width — only headers, per
 * Tommy's own framing ("longer HEADERS should probably be stacked
 * separately"). Both output lists preserve the given order; a single
 * forward pass, nothing reordered. */
export function partitionLongHeaders(
  panels: StackablePanelRef[],
  standardWidthIn: number,
  toleranceRatio: number = STANDARD_WIDTH_TOLERANCE_RATIO,
): { mainRun: StackablePanelRef[]; longHeaders: StackablePanelRef[] } {
  const mainRun: StackablePanelRef[] = [];
  const longHeaders: StackablePanelRef[] = [];
  for (const panel of panels) {
    if (panel.kind === "header" && !isWidthCompatible(panel.widthIn, standardWidthIn, toleranceRatio)) {
      longHeaders.push(panel);
    } else {
      mainRun.push(panel);
    }
  }
  return { mainRun, longHeaders };
}

export const DEFAULT_LOOKAHEAD_WINDOW = 4; // stacks, not raw panels

/** Scans `[fromIndex, fromIndex + window)` (skipping anything already
 * `consumed`) for the BEST-fitting stack against `refWidthIn`/`budgetIn` —
 * width-compatible (see `isWidthCompatible`) and not exceeding the given
 * budget along `metric`. "Best" = largest metric that still fits (maximizes
 * use of the remaining space), earliest index breaking ties. Returns -1 if
 * nothing in the window qualifies. Shared by `packLanesWithLookahead`'s
 * width pass (row-forming) and depth pass (backfill) — same bounded,
 * deterministic, single-forward-pass shape either way, no backtracking. */
function bestFitAhead(
  stacks: PanelStack[],
  consumed: boolean[],
  fromIndex: number,
  window: number,
  refWidthIn: number,
  budgetIn: number,
  metric: (s: PanelStack) => number,
): number {
  let bestIndex = -1;
  let bestMetric = -Infinity;
  const endIndex = Math.min(stacks.length, fromIndex + window);
  for (let i = fromIndex; i < endIndex; i++) {
    if (consumed[i]) continue;
    const stack = stacks[i]!;
    if (!isWidthCompatible(stack.widthIn, refWidthIn)) continue;
    const value = metric(stack);
    if (value > budgetIn) continue;
    if (value > bestMetric) {
      bestMetric = value;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Packs an ordered list of stacks into rows across the trailer's own width
 * (Tommy: "it usually spawns with a single row, its very very handy to be
 * able to have 2 rows of panels"), same "shelf" concept `packRowsByWidth`
 * used to implement alone — replaced here so the SAME bounded-lookahead
 * primitive (`bestFitAhead`) can also backfill each row's own leftover
 * depth (Tommy: "utilize the full space") instead of leaving it dead.
 *
 * **Width pass (row-forming):** walks the stack list left to right. At each
 * step, looks up to `lookaheadWindow` stacks ahead for one that fits the
 * current row's own remaining width better than the raw next-in-sequence
 * stack would; falls back to the raw next stack when nothing better
 * qualifies, so "a stack wider than the trailer still gets placed alone in
 * its own row" falls out of the SAME code path as before, not a special
 * case. Each pick becomes its own 1-stack `PanelLane`; a new row starts
 * once the next pick no longer fits the current row's own width budget —
 * same wrap rule `packRowsByWidth` used.
 *
 * **Depth-backfill pass (per row, once its lanes are fixed):** a row's own
 * depth is set by its deepest lane (see `computeTruckLoads`) — any
 * shallower lane in that same row has real leftover depth behind it. For
 * each such lane, repeatedly looks ahead — bounded to the SAME window,
 * anchored at wherever the width pass's own pointer sat when this row
 * started forming (so backfill can never reach arbitrarily far into the
 * shipment and disrupt install order, same "close to install-ready" intent
 * as the width pass's own bound) — for a width-compatible stack that still
 * fits the lane's own remaining depth, appends it BEHIND the lane's
 * existing stack(s) instead of opening a new row, and repeats until nothing
 * more fits.
 *
 * Every stack is consumed at most once; the width pass's own
 * raw-next-in-sequence fallback guarantees no stack can ever be starved —
 * worst case, it lands alone in its own row exactly like today.
 */
export function packLanesWithLookahead(
  stacks: PanelStack[],
  truckWidthIn: number,
  bufferIn: number,
  lookaheadWindow: number = DEFAULT_LOOKAHEAD_WINDOW,
): PanelLane[][] {
  const n = stacks.length;
  const consumed: boolean[] = new Array(n).fill(false);

  const backfillRow = (row: PanelLane[], anchorIndex: number) => {
    const rowMaxDepthIn = Math.max(...row.map((lane) => lane.depthIn));
    for (const lane of row) {
      let remainingDepthIn = rowMaxDepthIn - lane.depthIn - bufferIn;
      while (remainingDepthIn > 0) {
        const pickIndex = bestFitAhead(stacks, consumed, anchorIndex, lookaheadWindow, lane.widthIn, remainingDepthIn, (s) => s.heightIn);
        if (pickIndex === -1) break;
        const stack = stacks[pickIndex]!;
        consumed[pickIndex] = true;
        lane.stacks.push(stack);
        lane.widthIn = Math.max(lane.widthIn, stack.widthIn);
        lane.depthIn += stack.heightIn + bufferIn;
        remainingDepthIn = rowMaxDepthIn - lane.depthIn - bufferIn;
      }
    }
  };

  const rows: PanelLane[][] = [];
  let currentRow: PanelLane[] = [];
  let usedWidthIn = bufferIn;
  let rowAnchorIndex = 0; // pointer position when the current row started forming
  let pointer = 0;

  /** Advances `pointer` past anything already consumed, then picks the
   * best-fitting-ahead candidate for the current row's own remaining width
   * (falling back to the raw next-in-sequence stack). Re-derived fresh on
   * every call — never cached across a `backfillRow` call — since backfill
   * can consume stacks inside this same lookahead window, which would
   * otherwise leave a stale pick pointing at an already-placed stack.
   * Compatibility is checked against the CURRENT ROW's own established
   * width (its first lane's width — every lane in it is already mutually
   * compatible by construction) when the row already has something in it,
   * not against the raw next-in-sequence stack's own width — an
   * alternative only helps if it fits what's ALREADY been placed, not
   * whatever happens to be next. Falls back to the raw next stack's own
   * width as the reference when starting a fresh row. */
  const pickNext = (): { pickIndex: number; stack: PanelStack } | null => {
    while (pointer < n && consumed[pointer]) pointer++;
    if (pointer >= n) return null;
    const refWidthIn = currentRow.length > 0 ? currentRow[0]!.widthIn : stacks[pointer]!.widthIn;
    const remainingWidthIn = truckWidthIn - usedWidthIn - bufferIn;
    let pickIndex = bestFitAhead(stacks, consumed, pointer, lookaheadWindow, refWidthIn, Math.max(0, remainingWidthIn), (s) => s.widthIn);
    if (pickIndex === -1) pickIndex = pointer;
    return { pickIndex, stack: stacks[pickIndex]! };
  };

  let next = pickNext();
  while (next) {
    const { pickIndex, stack } = next;
    const neededWidthIn = usedWidthIn + stack.widthIn + bufferIn;
    if (neededWidthIn > truckWidthIn && currentRow.length > 0) {
      backfillRow(currentRow, rowAnchorIndex);
      rows.push(currentRow);
      currentRow = [];
      usedWidthIn = bufferIn;
      rowAnchorIndex = pointer;
      next = pickNext(); // backfill may have consumed candidates in this same window
      continue;
    }
    consumed[pickIndex] = true;
    currentRow.push({ stacks: [stack], widthIn: stack.widthIn, depthIn: stack.heightIn });
    usedWidthIn += stack.widthIn + bufferIn;
    if (pickIndex === pointer) pointer++;
    next = pickNext();
  }
  if (currentRow.length > 0) {
    backfillRow(currentRow, rowAnchorIndex);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * The full stacking plan across however many trucks are needed (Tommy:
 * "how many trucks will be needed to transport this project, how should
 * they be stacked, and how should those stacks be put into the truck") —
 * each `PanelGroup`'s panels should already be given in the intended stack/
 * row order (main + header/sill panels together, in load order — see
 * `computePanelLoadOrder` in panelLoadOrder.ts — then any further groups
 * like loose jack-stud lumber, or a `partitionLongHeaders`-routed long-
 * header group), since groups are chunked and packed in the order given,
 * never reordered (beyond `packLanesWithLookahead`'s own bounded lookahead).
 * A group with `useCompatibilityStacking` set is chunked with
 * `chunkIntoStacksSmart` (Tommy: "we cannot stack panels that are like 10%
 * or more bigger than the top panel") instead of the plain count-based
 * `chunkIntoStacks` — see that function's own doc comment for why
 * headers/sills no longer get pulled into one separate biggest-to-smallest
 * batch at the end, and never end up as a stack's own bottom.
 *
 * Stacks are packed into lanes/rows across the trailer's own width by their
 * own real width, with bounded-lookahead depth-backfill for any lane
 * shallower than its own row's deepest lane (`packLanesWithLookahead`),
 * then rows are packed front-to-back along the trailer's length, each row
 * costing only its own real depth — the deepest LANE in it — rather than
 * one flat uniform depth. This is still a "reference, not a true optimizer"
 * packer (bounded lookahead, no free rotation or true bin-packing)
 * consistent with this app's other geometry helpers.
 */
export function computeTruckLoads(
  groups: PanelGroup[],
  truck: TruckDims,
  bufferIn: number,
  opts: { dunnageGapIn?: number; lookaheadWindow?: number } = {},
): TruckLoad[] {
  const dunnageGapIn = opts.dunnageGapIn ?? 0;
  const allStacks: PanelStack[] = [];
  for (const group of groups) {
    if (group.panels.length === 0) continue;
    const panelsPerStack = computePanelsPerStack(truck.heightIn, group.thicknessIn, bufferIn);
    if (panelsPerStack <= 0) continue; // this group's own thickness doesn't fit at all — skip it, not the whole shipment
    allStacks.push(
      ...(group.useCompatibilityStacking
        ? chunkIntoStacksSmart(group.panels, panelsPerStack, group.defaultHeightIn, group.thicknessIn, dunnageGapIn)
        : chunkIntoStacks(group.panels, panelsPerStack, group.defaultHeightIn, group.thicknessIn)),
    );
  }
  if (allStacks.length === 0) return [];

  const allRows = packLanesWithLookahead(allStacks, truck.widthIn, bufferIn, opts.lookaheadWindow);

  const loads: TruckLoad[] = [];
  let currentLoad: PanelLane[][] = [];
  let usedLengthIn = bufferIn;
  for (const row of allRows) {
    const rowCostIn = Math.max(...row.map((lane) => lane.depthIn)) + bufferIn;
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
