import type { BoxBeamCoverage } from "@building-integrity/geometry";

/**
 * Which walls carry persisted state indexed by SLOT POSITION, and therefore
 * may not have a panel removed from under it.
 *
 * ### The problem this exists to name
 *
 * Three pieces of editor state store a half-open `[startSlotIndex,
 * endSlotIndex)` range into a wall's own `PanelSlot[]`:
 *
 *   * `boxBeamCoverageByWallId` — the roofline Box Beam's coverage;
 *   * `midWallBeamsByStoryAndWallId` — every Mid-Wall Bond Beam / Big Header
 *     beam (`MidWallBeam.startSlotIndex`/`endSlotIndex`);
 *   * `spanningHeadersByStoryAndWallId` — every spanning ("triple") header.
 *
 * None of them is derived and nothing remaps them. `Building3DView.tsx` reads
 * `offsetsIn[header.startSlotIndex] ?? 0` — a **silent fallback to zero**, not
 * an error — so an index that stops pointing at the panel it was drawn against
 * produces a part in the wrong place rather than a complaint.
 *
 * The corner-brace combine (see `applyBracedPlacement`) removes one panel from
 * the run when it fires, which shifts every index at or past it by one. So a
 * wall carrying any of these ranges is **pinned**: the combine is refused
 * there, the wall keeps its visible 3/4in safety gap, and the Review Log says
 * so per wall.
 *
 * ### Why refuse rather than remap
 *
 * Stage 2b already refuses a wall-run stop that would disturb a spanning
 * header (`spanningHeaderRunStopRefusal`) instead of adjusting the header,
 * because a header's fabricated width IS the sum of the panels it spans and
 * silently re-cutting a part already on a shop sheet is not a trade worth
 * making. The same answer, for the same reason, one rule over. Tommy's two
 * decisions of 2026-09-29 point the same way: refuse and explain rather than
 * change something silently.
 *
 * ### What this is deliberately NOT
 *
 * It is **not narrowed to "would this particular combine actually move this
 * particular range"**, though that is computable from the plan. A wall carrying
 * a beam or a header simply does not get the combine. The reason is that a
 * retile re-derives the whole run anyway, so "the range still points at the
 * same panels" is not a property this app can currently promise per-index
 * (see the Stage 2 base-vs-overlay slot-index mismatch in the spec, which is
 * open and has its own blast radius). Refusing on the wall is the coarse
 * answer that cannot be wrong in the direction that matters; narrowing it is
 * only worth doing once that larger question is settled.
 */
export interface SlotIndexRange {
  startSlotIndex: number;
  endSlotIndex: number;
}

/** A range that covers at least one real slot. The empty/inverted case is
 * already how `handleChangeBoxBeamCoverage` says "no box beam on this wall",
 * so it must not pin anything. */
function isRealRange(range: SlotIndexRange): boolean {
  return range.endSlotIndex > range.startSlotIndex;
}

/**
 * The pinned wall ids, unioned across every story — a wall is one wall
 * whatever story the range sits on, and the ground-story run is what
 * `retile`/`retilePreservingOpenings` re-tile.
 *
 * Every argument is optional and absent means "nothing here", so a project
 * with no beams and no headers produces an empty set and the combine behaves
 * exactly as it did before this existed.
 */
export function pinnedSlotIndexWallIds(state: {
  boxBeamCoverageByWallId?: Record<string, BoxBeamCoverage | undefined>;
  /** Both stories' beams, and both stories' headers — pass the whole
   * story-keyed records. */
  rangesByStoryAndWallId?: Record<string, Record<string, readonly SlotIndexRange[] | undefined>>[];
}): Set<string> {
  const pinned = new Set<string>();
  for (const [wallId, coverage] of Object.entries(state.boxBeamCoverageByWallId ?? {})) {
    if (coverage && isRealRange(coverage)) pinned.add(wallId);
  }
  for (const byStory of state.rangesByStoryAndWallId ?? []) {
    for (const byWallId of Object.values(byStory)) {
      for (const [wallId, ranges] of Object.entries(byWallId)) {
        if ((ranges ?? []).some(isRealRange)) pinned.add(wallId);
      }
    }
  }
  return pinned;
}
