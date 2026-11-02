import { decideRoofForm } from "@building-integrity/panel-catalog";
import { gableEndWallIdsFor, ringRoofGableBlockReason, type Footprint } from "@building-integrity/geometry";

/**
 * ⚠ **WHAT A SHAPE CHANGE DOES TO THE ROOF — the decision, on its own, so it
 * can be checked.**
 *
 * > *"When I changed a small shed roof building to 24 x 24, it extended the
 * > shed roof along with one gable end, but the other gable end went to
 * > peaked Gable end style. All the gable ends and roof panels should have
 * > converted to centered ridge beam and two rows of ridge beam resting roof
 * > panels."* — Tommy, 2026-11-01
 *
 * A resize used to change the footprint and nothing else, so a building kept
 * the roof its FIRST shape implied. Two things go stale, and they look like
 * unrelated faults:
 *
 *  1. **Which walls are gable ends** — the short pair. Resize past square and
 *     the short pair is the other two, leaving a gable row on a wall that is
 *     not a gable end any more, wound the way its old wall was. That is the
 *     *"weird short backwards north gable wall"*.
 *  2. **The stored shed profile positions**, which are ABSOLUTE INCHES. A
 *     shed puts its point at `x = 0` on one gable wall and at `x = that
 *     wall's own LENGTH` on the other, because the two are wound in opposite
 *     directions round the footprint. Grow the building and the stored length
 *     is no longer that wall's end — it is somewhere in the middle, which
 *     `resolveAnchors` reads as a PEAK, while the wall that stored 0 still
 *     snaps to a shed. One wall stays a shed and its opposite becomes a
 *     gable, which is exactly what he saw.
 *
 * ⚠ **Two footprint paths still bypass this**, and they are named rather
 * than quietly left: `commitFootprintShapeChange` (adding or removing a
 * COURTYARD, which flips whether gable ends are allowed at all — see
 * `ringRoofGableBlockReason`) and `handleKeepSplitRegion` (splitting a
 * building and keeping one half, which can change the span by any amount).
 * Both re-tile their own slots through a different route, so threading the
 * ridge-column placement through them is its own piece of work. Neither is
 * the resize he reported.
 */

/** The span a roof has to cross: the length of a gable end wall. */
export function gableSpanFt(footprint: Footprint, roofEnabled: boolean): number {
  const ids = gableEndWallIdsFor2(footprint, roofEnabled);
  const wall = footprint.walls.find((w) => ids.includes(w.id));
  if (!wall) return 0;
  const a = footprint.corners.find((c) => c.id === wall.startCorner)?.point;
  const b = footprint.corners.find((c) => c.id === wall.endCorner)?.point;
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function gableEndWallIdsFor2(footprint: Footprint, roofEnabled: boolean): string[] {
  return roofEnabled && ringRoofGableBlockReason(footprint) === null ? gableEndWallIdsFor(footprint) : [];
}

export interface RoofShapeChangeVerdict {
  /** Re-derive the whole roof: gable walls, form, profile, ridge columns. */
  rederive: boolean;
  /** Why, in words, for a Review Log line or a notice. Empty when not. */
  reason: string;
}

/**
 * ⚠ **Re-derive only when the roof is genuinely invalidated**, not on every
 * drag.
 *
 * A two-inch nudge to a wall must not throw away a roofline somebody shaped
 * by hand, so this is deliberately narrow: the gable-end pair changing, or
 * the span crossing the shed/peak limit. Everything else keeps the roof it
 * has and only carries its stored positions onto the new wall lengths (see
 * `remapEndAnchoredPositions`).
 */
export function roofShapeChangeVerdict(
  oldFootprint: Footprint,
  newFootprint: Footprint,
  options: { roofEnabled: boolean; pitchIn12: number },
): RoofShapeChangeVerdict {
  const oldIds = gableEndWallIdsFor2(oldFootprint, options.roofEnabled);
  const newIds = gableEndWallIdsFor2(newFootprint, options.roofEnabled);
  if (oldIds.join("|") !== newIds.join("|")) {
    return {
      rederive: true,
      reason: `The gable end walls changed (${oldIds.join(", ") || "none"} → ${newIds.join(", ") || "none"}), so the roof is re-derived for the new shape.`,
    };
  }

  const formOf = (fp: Footprint) =>
    decideRoofForm({ buildingWidthIn: gableSpanFt(fp, options.roofEnabled) * 12, pitchIn12: options.pitchIn12 }).kind;
  const oldForm = formOf(oldFootprint);
  const newForm = formOf(newFootprint);
  if (oldForm !== newForm) {
    return {
      rederive: true,
      reason: `A ${gableSpanFt(newFootprint, options.roofEnabled).toFixed(1)}ft span no longer takes a ${oldForm} roof, so it is re-derived as ${newForm}.`,
    };
  }
  return { rederive: false, reason: "" };
}

/**
 * ⚠ **Carry an END-ANCHORED profile point onto the new wall length.**
 *
 * A stored position is an absolute inch count, and a shed's means "this end
 * of this wall". Left alone through a resize it stops meaning that: on a
 * longer wall it lands mid-span and reads as a peak. Anything a user dragged
 * into the middle is left exactly where it is — only a point sitting ON an
 * end is moved, and only to the new end.
 */
export function remapEndAnchoredPositions(
  oldFootprint: Footprint,
  newFootprint: Footprint,
  positionsByWallId: Record<string, (number | null)[]>,
): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const [wallId, positions] of Object.entries(positionsByWallId)) {
    const oldLengthIn = (oldFootprint.walls.find((w) => w.id === wallId)?.lengthFt ?? 0) * 12;
    const newLengthIn = (newFootprint.walls.find((w) => w.id === wallId)?.lengthFt ?? 0) * 12;
    out[wallId] = positions.map((x) =>
      x !== null && oldLengthIn > 0 && Math.abs(x - oldLengthIn) < 1e-6 ? newLengthIn : x,
    );
  }
  return out;
}
