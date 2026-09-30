import type { Footprint, RunStopOpeningMemory } from "@building-integrity/geometry";

/** Smearforn Stage 3's opening memory, per story per wall — see `ProjectState`'s
 * own doc comment on `unbuiltOpeningsByStoryAndWallId`. */
export type OpeningMemoryByStoryAndWallId = Record<"ground" | "second", Record<string, RunStopOpeningMemory>>;

/**
 * Drops any wall id the footprint no longer has, **at the point the memory is
 * written to state and to the file**.
 *
 * ### Why this one needs a prune when the neighbouring state does not
 *
 * A stale `wallRunStopsByWallId` entry costs a wall its SLOTS, and the next
 * re-tile rebuilds those. A stale entry here is different in kind, and it is
 * the difference between losing derived data and inventing design data:
 *
 * **Wall ids are reused.** `buildRectangleFootprint` always emits "AB", "BC",
 * "CD", "DA"; `buildOctagonFootprint` always emits "0".."7". So a memory left
 * behind by a wall that no longer exists does not sit inert — it attaches to
 * the NEXT wall that happens to reuse the id, and the moment that wall is
 * stopped and un-stopped it hands the tiler a window nobody drew on it. A
 * withheld opening surfacing on an unrelated wall is the same class of defect
 * as a door where a window was: a silently wrong drawing, which is worse than
 * a refusal.
 *
 * ### Why `null` footprint is left alone rather than emptied
 *
 * A null footprint means nothing is drawn yet, not that every wall was
 * deleted. Throwing the memory away on that basis would be exactly the
 * deletion Tommy's "drop them, and remember" decision rules out.
 *
 * ### ⚠ The case this CANNOT close — a brand-new building
 *
 * **Drawing a new footprint is not a prune problem, and treating it as one is
 * how a window from a demolished building ends up on a shop drawing of a
 * different one.** A fresh rectangle's walls are "AB".."DA" again, so every id
 * the old memory is keyed by is LIVE in the new footprint and this function
 * keeps every one of them. It has to: it cannot tell "this wall still exists"
 * from "a different wall took its name".
 *
 * So a new building must CLEAR the memory outright, which `handleDraw` does
 * beside its `setWallRunStopsByWallId({})`. The mechanism is pinned in
 * retile.test.ts ("a leftover memory puts a window on a wall nobody drew one
 * on"): no stop is needed to cash a stale memory in, because `hasStop` in the
 * tiler is true whenever the memory holds anything, so the next re-tile of any
 * kind merges the remembered opening in as a real one.
 *
 * ### The gap this does NOT close, stated rather than left silent
 *
 * A wall with no old counterpart at all — a bump-out or a corner collapse that
 * destroys a wall's run — loses its memory along with its built openings, in
 * the id remap in `handleAddBumpOut` and in the wall drag's collapse branch.
 * That is a genuine deletion inside a feature whose promise is "never
 * deleted", it is deliberate (the wall's old run no longer exists as a run, so
 * there is no basis to measure a remembered opening's position against), and
 * it matches how those same operations already treat the wall's BUILT
 * openings. It is recorded in `retilePreservingOpeningsWithRunStopMemory`'s
 * own doc comment and in the spec's Smearforn Stage 3 entry.
 */
export function pruneOpeningMemoryToLiveWalls(
  memory: OpeningMemoryByStoryAndWallId,
  footprint: Footprint | null,
): OpeningMemoryByStoryAndWallId {
  if (!footprint) return memory;
  const live = new Set(footprint.walls.map((w) => w.id));
  const pruneStory = (byWallId: Record<string, RunStopOpeningMemory>) =>
    Object.fromEntries(Object.entries(byWallId).filter(([wallId]) => live.has(wallId)));
  return { ground: pruneStory(memory.ground), second: pruneStory(memory.second) };
}
