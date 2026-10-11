import type { PanelSlot } from "./types";

/**
 * TILE-ONCE, STAGE 3 — dragging a panel along its wall.
 *
 * Tommy, 2026-09-30, proposing the whole tile-once model: *"once the shape is
 * drawn and auto populated, I want the user to be able to drag a panel down
 * the line, switching it's place with each panel it passes."*
 *
 * ## Why this is the important operation
 *
 * A move **permutes the slot array**. The multiset of widths is identical
 * before and after, so **the wall's length is conserved by the nature of the
 * operation** rather than by machinery policing it. Today that invariant —
 * `Σ slot.widthIn === wallFabricationLengthIn(wall)`, exactly, in whole
 * eighths — is enforced across eight exported functions and a 790,440-case
 * sweep, and the 2026-09-29/30 bug list is what happens when one of them
 * slips. A permutation cannot slip: there is no arithmetic in it.
 *
 * ## What cannot move
 *
 * **Corner panels.** Tommy's decision of 2026-10-03, chosen over letting them
 * move and convert: a corner panel **turns the corner**, carrying a return leg
 * onto the adjoining wall, which is why it prices with an extra edge. Its
 * position is not a rule *about* it — **its position is what it is**. Dragged
 * mid-run it would be an L-shape jutting into the room. They are therefore
 * both immovable and impassable: the ends of a run are where a run ends.
 *
 * ⚠ **The safety gap IS movable**, by the same decision ("gap free, corners
 * stuck"). It is a flat sheet of plywood whose position is a *rule* —
 * second-to-last, away from the least-accessible corner — so moving it leaves
 * a perfectly real part with an unsatisfied rule, which is reportable rather
 * than impossible.
 */

/** Slots that cannot move and cannot be moved past. See the note above. */
function isCorner(slot: PanelSlot): boolean {
  return slot.type === "corner" || slot.type === "safety-oct-corner";
}

/**
 * The span of indices a panel may be dragged within — everything between the
 * corner panels at each end.
 *
 * ⚠ Only LEADING and TRAILING corners bound the range. A corner appearing
 * mid-array would be a malformed wall, and treating it as a boundary here
 * would silently split one run into two rather than surfacing the problem.
 */
export function movableRange(slots: readonly PanelSlot[]): { first: number; last: number } | null {
  let first = 0;
  let last = slots.length - 1;
  while (first <= last && isCorner(slots[first]!)) first++;
  while (last >= first && isCorner(slots[last]!)) last--;
  if (first > last) return null; // nothing but corners — a merged-corner wall
  return { first, last };
}

/** Can this slot be picked up at all? */
export function canMovePanel(slots: readonly PanelSlot[], index: number): boolean {
  const range = movableRange(slots);
  if (!range) return false;
  return index >= range.first && index <= range.last;
}

/**
 * Move the panel at `fromIndex` to `toIndex`, sliding everything between it
 * and the destination along by one — which is exactly "switching its place
 * with each panel it passes", applied all at once.
 *
 * `toIndex` is **clamped** into the movable range rather than refused: a user
 * dragging hard toward a corner means "as far as it goes", and refusing the
 * whole gesture because the cursor overshot would be obnoxious. A `fromIndex`
 * that is not movable returns `null`, because that is not an overshoot — it
 * is picking up something that cannot be picked up.
 *
 * Returns `null` for a no-op move too, so a caller can skip a state update
 * rather than re-render the wall for nothing.
 */
export function movePanelWithinWall(
  slots: readonly PanelSlot[],
  fromIndex: number,
  toIndex: number,
): PanelSlot[] | null {
  const range = movableRange(slots);
  if (!range) return null;
  if (fromIndex < range.first || fromIndex > range.last) return null;
  const target = Math.max(range.first, Math.min(range.last, toIndex));
  if (target === fromIndex) return null;

  const next = [...slots];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(target, 0, moved!);
  return next;
}

/**
 * Which index a panel being dragged should now occupy, given how far along
 * the wall the cursor is.
 *
 * ⚠ **Measured in INCHES ALONG THE WALL, not in slot widths**, because panels
 * are not all the same width: stepping "one slot per N pixels" would make a
 * 24in panel and a 48in panel feel completely different to drag through. The
 * dragged panel lands where its own CENTRE has reached.
 *
 * `offsetIn` is the cursor's distance from the wall start. Returns the
 * destination index, already clamped to the movable range.
 */
export function dropIndexForOffset(
  slots: readonly PanelSlot[],
  fromIndex: number,
  offsetIn: number,
): number | null {
  const range = movableRange(slots);
  if (!range) return null;
  if (fromIndex < range.first || fromIndex > range.last) return null;

  // Walk the wall WITHOUT the dragged panel, which is the arrangement the
  // other panels are actually in while it is in the air.
  const others = slots.filter((_, i) => i !== fromIndex);
  let cursorIn = 0;
  let index = 0;
  for (let i = 0; i < others.length; i++) {
    const width = others[i]!.widthIn;
    // Past the midpoint of this panel means the dragged one belongs after it.
    if (offsetIn < cursorIn + width / 2) break;
    cursorIn += width;
    index = i + 1;
  }
  return Math.max(range.first, Math.min(range.last, index));
}
