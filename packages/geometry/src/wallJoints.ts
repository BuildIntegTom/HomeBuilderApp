import { roundToEighthIn } from "./eighths";
import type { Footprint, PanelSlot, Point } from "./types";

/**
 * WHERE A NEW WALL IS ALLOWED TO LAND ON AN EXISTING ONE.
 *
 * Tommy, 2026-10-20, describing the draw-wall tool:
 *
 * > *"We could have a draw new wall tool that snaps to corners or snaps to the
 * > edge at each intersection of panels."*
 *
 * ⚠ **Landing on a joint means NO PANEL IS CUT. It does not mean the wall is
 * left untouched, and I claimed it did.** The slots before the joint belong to
 * one half and the slots after it to the other, exactly as they already are —
 * that part holds, and it is why a joint is the right target: land anywhere
 * else and a panel is cut in two, leaving two pieces nobody ordered.
 *
 * ⚠ **But the remnant can still need re-tiling, because of what happens at
 * its FAR corner.** Measured on a 40ft x 24ft rectangle, cutting wall AB at a
 * joint 8'8" along:
 *
 *   the remnant is 8.667ft, its panels total 104.00in,
 *   and its RUN is 88.50in — 15.5in short, exactly one wall thickness.
 *
 * Nothing happened at the joint. What happened is at the other end: AB was
 * 40ft and ran through the corner it shared with the 24ft wall DA, under the
 * app's own rule that THE LONGER WALL RUNS THROUGH. The remnant is 8.667ft,
 * which is shorter than DA, so DA now runs through and the remnant is inset by
 * a thickness. Its panels no longer fit the run.
 *
 * So the honest statement is: a joint landing costs no CUT PANEL, and the half
 * that keeps its far corner keeps its panels exactly. The half that loses one
 * is re-tiled at that end like any other wall whose run changed — which
 * `retilePreservingOpenings` already does, carrying the openings across.
 *
 * His butt-joint answer still governs the NEW corner, and it is the reason
 * that end costs nothing. Tommy, 2026-10-21, asked which panel gives up the
 * width a new corner needs: *"The new corner panel just gets flush with the
 * wall that's there... tying it together with GRKs to the old panel would
 * really hold it structurally."* Measured on the same case, the remnant does
 * own the new joint corner (`hasCornerEnd` true, `endInsetIn` 0), so the joint
 * end behaves exactly as he described.
 */

export interface WallJoint {
  wallId: string;
  /** Distance from the wall's TRUE start corner, in feet — the same origin
   * `wallGeometryFor`'s `runStartOffsetIn` is measured from. */
  offsetFt: number;
  /** The slot that STARTS here: everything before this index belongs to the
   * first half, everything from it to the second. */
  slotIndex: number;
  /** Where it is, for drawing a target and for inserting a corner. */
  point: Point;
}

/** Below this, a leftover piece of wall is not a wall anyone can build, so a
 * joint that close to a corner is not offered. Deliberately generous: this is
 * about not offering a nonsense target, not about fabrication limits, which
 * the tiler enforces on its own. */
export const MIN_SPLIT_REMNANT_FT = 2;

/**
 * Every joint between panels on one wall, as somewhere a new wall may land.
 *
 * ⚠ The two ENDS are deliberately absent. They are the wall's own corners,
 * which the draw-wall tool already offers, and returning them here would give
 * the same point two different identities — one as a corner and one as a
 * zero-length split.
 *
 * @param runStartOffsetIn Where this wall's panel run begins, in inches from
 *   its true start corner — `wallGeometryFor(...).runStartOffsetIn`. Passed in
 *   rather than recomputed because the caller already has it and the two must
 *   not disagree: a joint measured from a different origin than the panels are
 *   drawn from is a target that does not sit where it looks.
 */
export function wallPanelJoints(
  footprint: Footprint,
  wallId: string,
  slots: readonly PanelSlot[],
  runStartOffsetIn: number,
): WallJoint[] {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall || slots.length < 2) return [];
  const start = footprint.corners.find((c) => c.id === wall.startCorner)?.point;
  const end = footprint.corners.find((c) => c.id === wall.endCorner)?.point;
  if (!start || !end) return [];

  const lengthFt = Math.hypot(end.x - start.x, end.y - start.y);
  if (lengthFt <= 0) return [];
  const dir = { x: (end.x - start.x) / lengthFt, y: (end.y - start.y) / lengthFt };

  const out: WallJoint[] = [];
  let alongIn = runStartOffsetIn;
  for (let i = 0; i < slots.length - 1; i++) {
    alongIn = roundToEighthIn(alongIn + slots[i]!.widthIn);
    const offsetFt = alongIn / 12;
    // Not so close to either corner that what is left cannot be a wall.
    if (offsetFt < MIN_SPLIT_REMNANT_FT) continue;
    if (lengthFt - offsetFt < MIN_SPLIT_REMNANT_FT) continue;
    out.push({
      wallId,
      offsetFt,
      slotIndex: i + 1,
      point: { x: start.x + dir.x * offsetFt, y: start.y + dir.y * offsetFt },
    });
  }
  return out;
}

/** Every joint on every wall, for drawing the targets. */
export function allWallPanelJoints(
  footprint: Footprint,
  slotsByWallId: Record<string, PanelSlot[]>,
  runStartOffsetInByWallId: Record<string, number>,
): WallJoint[] {
  return footprint.walls.flatMap((wall) =>
    wallPanelJoints(footprint, wall.id, slotsByWallId[wall.id] ?? [], runStartOffsetInByWallId[wall.id] ?? 0),
  );
}

/**
 * Divide one wall's panels at a joint: everything before the joint, everything
 * from it on.
 *
 * ⚠ **Nothing is cut, resized or re-tiled, and that is the whole point.** The
 * two lists together are the original list, in order, with no slot touched.
 * A test asserts exactly that rather than trusting this sentence.
 */
export function splitSlotsAtJoint(
  slots: readonly PanelSlot[],
  slotIndex: number,
): { before: PanelSlot[]; after: PanelSlot[] } {
  return { before: slots.slice(0, slotIndex).map((s) => ({ ...s })), after: slots.slice(slotIndex).map((s) => ({ ...s })) };
}

/**
 * Insert a corner part-way along a wall, splitting it into two.
 *
 * The host wall's id disappears and two new ones take its place. Corner ids
 * are NOT renumbered here — the new corner gets a fresh id and every existing
 * id survives, which keeps this composable with `splitFootprintByChord`, whose
 * own renumbering happens afterwards and only once.
 *
 * @returns the new footprint, the id of the corner that was inserted, and the
 *   two wall ids that replaced the host — `before` runs from the host's start
 *   to the new corner, `after` from the new corner to the host's end.
 */
export function insertCornerAtWallOffset(
  footprint: Footprint,
  wallId: string,
  offsetFt: number,
): { footprint: Footprint; cornerId: string; beforeWallId: string; afterWallId: string } | null {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const start = footprint.corners.find((c) => c.id === wall.startCorner)?.point;
  const end = footprint.corners.find((c) => c.id === wall.endCorner)?.point;
  if (!start || !end) return null;
  const lengthFt = Math.hypot(end.x - start.x, end.y - start.y);
  if (offsetFt <= 0 || offsetFt >= lengthFt) return null;

  /* A fresh id that cannot collide with an existing one, however the shape has
     been renumbered before now. Not "0".."n-1" — that renumbering belongs to
     whoever finishes the edit, and doing it here would break the caller's own
     correlation map before it could be built. */
  let cornerId = `j${footprint.corners.length}`;
  while (footprint.corners.some((c) => c.id === cornerId)) cornerId = `${cornerId}x`;

  const dir = { x: (end.x - start.x) / lengthFt, y: (end.y - start.y) / lengthFt };
  const point = { x: start.x + dir.x * offsetFt, y: start.y + dir.y * offsetFt };

  const corners = [...footprint.corners];
  const startIndex = corners.findIndex((c) => c.id === wall.startCorner);
  corners.splice(startIndex + 1, 0, { id: cornerId, point });

  const beforeWallId = `${wall.startCorner}${cornerId}`;
  const afterWallId = `${cornerId}${wall.endCorner}`;
  const walls = footprint.walls.flatMap((w) =>
    w.id !== wallId
      ? [w]
      : [
          { id: beforeWallId, startCorner: w.startCorner, endCorner: cornerId, lengthFt: offsetFt },
          { id: afterWallId, startCorner: cornerId, endCorner: w.endCorner, lengthFt: lengthFt - offsetFt },
        ],
  );
  return { footprint: { corners, walls }, cornerId, beforeWallId, afterWallId };
}
