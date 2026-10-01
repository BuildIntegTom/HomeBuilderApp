import type { Corner, Footprint, PanelSlot, Wall } from "./types";

/**
 * The 1/8in shop grid (Tommy: "make the movement of drawing tools, bump
 * out, panel movers, etc be based on 1/8\"... we must remain absolutely
 * precise on total lengths of wall segments being exactly the same as the
 * addition of all the panels").
 *
 * This is a *precision convention*, not a building dimension — it is not a
 * fastener spacing, a load, a density, or a cost, and it needs nobody's
 * engineering sign-off. Everything the grid rests on was already a whole
 * eighth before this module existed (the safety-gap widths 0.75 and 0.5,
 * cornerPanelWidthIn 25.5, panelWidthInRange 15.75-48, the 40in standard
 * default, Square Bale's 39in, and the 14 / 15.5 / 15.75 thickness
 * options); none of them change here.
 *
 * The load-bearing idea: **the canonical representation of a length is an
 * integer count of eighths.** Anything that has to be exact converts at its
 * own boundary (`toEighths`), does integer arithmetic, and converts back
 * (`fromEighths`). That is what makes "the panels sum to the wall" actually
 * exact rather than "within 1e-9" — `lengthFt * 12` is never bit-exact in
 * binary floating point, and 1/96 ft is not representable at all, so any
 * invariant stated in inches-as-floats is a wish rather than a guarantee.
 *
 * Lives in `packages/geometry` because it is purely numeric/geometric and
 * this package has zero package dependencies — `packages/calc-engine`
 * depends on it (acyclic) so the formatters share this constant instead of
 * keeping a hand-synced copy.
 */
export const EIGHTH_IN = 0.125;

/** Eighths per inch — the multiplier, kept named so the conversions below
 * read as conversions rather than as magic 8s. */
const EIGHTHS_PER_IN = 8;

/** Eighths per foot (96) — the footprint-corner grid, since corner
 * coordinates are stored in feet. */
const EIGHTHS_PER_FT = 96;

/**
 * An inch value as a whole number of eighths, rounded half-up (JS
 * `Math.round` rounds .5 toward +Infinity, which is the same round-half-up
 * rule `formatImperialFractionIn` already uses, so a value and its own
 * displayed form never disagree about which eighth they land on).
 */
export function toEighths(valueIn: number): number {
  return Math.round(valueIn * EIGHTHS_PER_IN);
}

/** The inverse of `toEighths`. Exact: every multiple of 1/8 is exactly
 * representable in binary floating point. */
export function fromEighths(eighths: number): number {
  return eighths / EIGHTHS_PER_IN;
}

/** Snaps an inch value onto the 1/8in grid. */
export function roundToEighthIn(valueIn: number): number {
  return fromEighths(toEighths(valueIn));
}

/**
 * Whether a value already sits exactly on the grid. Deliberately tolerant
 * (1e-9) rather than an `=== roundToEighthIn(v)` identity check: a width
 * that arrived via `hypot`/`* 12` arithmetic can be one ULP off an eighth
 * and is still, for every purpose this app has, that eighth.
 */
export function isWholeEighthIn(valueIn: number): boolean {
  return Math.abs(valueIn * EIGHTHS_PER_IN - Math.round(valueIn * EIGHTHS_PER_IN)) < 1e-9;
}

/**
 * Splits `budgetEighths` into exactly `count` whole-eighth parts that sum
 * back to it exactly. `base = floor(budget / count)` goes to every part and
 * one extra eighth goes to the first `budget mod count` parts, so no two
 * parts differ by more than 1/8in — a difference no shop can read off a cut
 * list, and the reason this replaces the even splits that used to land on
 * sixteenths.
 *
 * **The absorber rule is deliberately arbitrary but fixed:** the extra
 * eighth(s) go to the LOWEST-INDEX parts of the returned array. This was
 * chosen so that a given wall always tiles identically, not because
 * lowest-index is the shop-correct place for the wider panel — nobody has
 * decided that. If Tommy would rather the wider panel always sit nearest
 * the gap panel (or always farthest from it), that is a reorder at the call
 * site, not a change here. See the spec's Open Items.
 *
 * Returns exactly `count` entries, INCLUDING any that come out as 0 —
 * dropping zero-width parts is the caller's decision (see
 * `computeSillRunWidths` in tiling.ts, which drops them to stay consistent with
 * `buildMiddle`'s
 * existing phantom-panel guard). A non-positive budget yields all zeros
 * rather than negatives: a negative width is never a sane panel, and
 * silently emitting one would hide the caller's own bug.
 */
export function distributeEighths(budgetEighths: number, count: number): number[] {
  if (count <= 0) return [];
  const parts = Math.floor(count);
  if (budgetEighths <= 0) return Array.from({ length: parts }, () => 0);
  const budget = Math.round(budgetEighths);
  const base = Math.floor(budget / parts);
  const extras = budget - base * parts;
  return Array.from({ length: parts }, (_, i) => (i < extras ? base + 1 : base));
}

/**
 * The single length accessor tiling and display both read: this wall's
 * length as a whole number of eighths of an inch.
 *
 * For a **rectilinear** wall off a quantized footprint this is a no-op —
 * the corners are already on the grid, so `lengthFt * 12` is already an
 * eighth up to float noise and this just cleans the noise up.
 *
 * For an **octagon's 45deg walls it is not a no-op, and that is a real
 * mathematical exception rather than a bug to be fixed.** A diagonal
 * between two grid corners has an irrational length, so a regular octagon
 * and the 1/8in grid are incompatible — there is no rounding rule that
 * makes both true. The residual is at most 1/16in per diagonal wall; it is
 * a drawing-vs-fabrication difference, not a panel-sum error (the panels
 * still sum exactly to THIS value), and it is precisely the class of
 * tolerance the safety/gap panel exists to absorb at the corner joint. On
 * the plan canvas at 12 px/ft it is 0.06px. Deliberately rejected:
 * distorting the octagon to force grid-exact diagonals (that breaks the
 * equal-side shape `snapOctagonBoxPx` exists to preserve) and exempting
 * mitered shapes from the invariant (that leaves a hole in the one
 * guarantee this whole pass exists to make).
 */
export function wallFabricationLengthIn(wall: Wall): number {
  return roundToEighthIn(wall.lengthFt * 12);
}

/** Snaps one footprint coordinate (stored in FEET) onto the 1/8in grid,
 * i.e. to the nearest 1/96 ft. Note 1/96 is not representable in binary, so
 * the result is only "exact" once it is read back through
 * `wallFabricationLengthIn` — which is the whole reason that accessor
 * exists rather than callers doing `lengthFt * 12` themselves. */
function snapFtToEighthIn(valueFt: number): number {
  return Math.round(valueFt * EIGHTHS_PER_FT) / EIGHTHS_PER_FT;
}

/**
 * Snaps every corner of a footprint onto the 1/8in grid and recomputes each
 * wall's `lengthFt` from the snapped corners. Every footprint-producing
 * operation (`buildRectangleFootprint`, `buildOctagonFootprint`,
 * `insertBumpOut`, `dragWall`/`dragWallBounded`/`collapseNearZeroWalls`,
 * `editWallLength`) returns its result through this, so a wall can only
 * ever be tiled into eighths if its own length is one.
 *
 * Two things it buys beyond the sum invariant: for rectilinear shapes every
 * wall length becomes an exact eighth (so `wallFabricationLengthIn` is a
 * no-op and the displayed wall length is genuinely the sum of the displayed
 * panels), and repeated edits stop accumulating float drift in the corner
 * coordinates.
 *
 * It does NOT make an octagon's diagonals grid-exact — see
 * `wallFabricationLengthIn`. It moves the octagon's clip corners by up to
 * 1/16in, which slightly breaks the exact equality of its eight sides; that
 * is the accepted cost of putting the corners themselves on the grid.
 */
export function quantizeFootprint(footprint: Footprint): Footprint {
  const corners: Corner[] = footprint.corners.map((c) => ({
    ...c,
    point: { x: snapFtToEighthIn(c.point.x), y: snapFtToEighthIn(c.point.y) },
  }));
  const byId = new Map(corners.map((c) => [c.id, c.point]));
  const walls = footprint.walls.map((w) => {
    const start = byId.get(w.startCorner);
    const end = byId.get(w.endCorner);
    // A wall referencing a corner that isn't in the list is malformed input
    // — left exactly as it was rather than silently zeroed.
    if (!start || !end) return w;
    return { ...w, lengthFt: Math.hypot(end.x - start.x, end.y - start.y) };
  });
  return { corners, walls };
}

/** Slot types whose width the tiling engine is free to move — the plain
 * infill. Everything else (corner, safety-gap, window/door/column/
 * big-header) is a fixed-width reservation and keeps whatever it rounds
 * to. Same split `applyUniformPanelization` already uses. */
function isAdjustableSlot(slot: PanelSlot): boolean {
  return slot.type === "standard" || slot.type === "braced";
}

/**
 * Load-time repair for a wall whose stored slot widths aren't on the grid
 * — deliberately NOT a re-tile. Re-tiling would be simpler and would throw
 * away every manual panel-mover adjustment in the file, which is real user
 * work.
 *
 * Rounds each width to eighths independently, then distributes the residual
 * (`wallLengthIn` minus the rounded sum) one eighth at a time, round-robin
 * over the standard/braced slots only, widest first, ties by lowest index.
 * Fixed-width slots are left at their own rounding — they are already
 * eighth-exact in every file this app has ever written, so in practice they
 * never move at all. Each slot therefore shifts by its own rounding
 * (<=1/16in) plus at most ceil(|residual| / k) eighths over k adjustable
 * slots.
 *
 * If a wall has no adjustable slot at all (a merged-corner wall, or one
 * that is nothing but openings) the residual has nowhere to go and is left
 * outstanding rather than being forced into a fixed-width slot — better a
 * visible <=1/16in shortfall than a silently resized corner panel. Same if
 * shedding the residual would drive an adjustable slot negative.
 *
 * Returns the original array by reference when nothing needed changing, so
 * loading an already-quantized file is a true no-op.
 */
export function repairWallToEighths(slots: PanelSlot[], wallLengthIn: number): PanelSlot[] {
  if (slots.length === 0) return slots;
  const targetEighths = toEighths(wallLengthIn);
  const widths = slots.map((s) => Math.max(0, toEighths(s.widthIn)));
  let residual = targetEighths - widths.reduce((sum, w) => sum + w, 0);

  const order = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => isAdjustableSlot(slot))
    .sort((a, b) => (widths[b.index]! - widths[a.index]!) || a.index - b.index)
    .map(({ index }) => index);

  while (residual !== 0 && order.length > 0) {
    let moved = false;
    for (const index of order) {
      if (residual === 0) break;
      if (residual > 0) {
        widths[index]! += 1;
        residual -= 1;
        moved = true;
      } else if (widths[index]! > 0) {
        widths[index]! -= 1;
        residual += 1;
        moved = true;
      }
    }
    if (!moved) break; // nothing left to take from — see the doc comment
  }

  const unchanged = slots.every((s, i) => s.widthIn === fromEighths(widths[i]!) && (s.lockedWidthIn === undefined || isWholeEighthIn(s.lockedWidthIn)));
  if (unchanged) return slots;

  return slots.map((slot, i) => {
    const widthIn = fromEighths(widths[i]!);
    // A user-dragged lock is repaired alongside the width it pins, or the
    // next retile would immediately drag the slot back off the grid.
    if (slot.lockedWidthIn === undefined) return { ...slot, widthIn };
    return { ...slot, widthIn, lockedWidthIn: roundToEighthIn(slot.lockedWidthIn) };
  });
}
