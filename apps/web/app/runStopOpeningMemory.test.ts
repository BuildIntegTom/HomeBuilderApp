import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, type RunStopOpeningMemory } from "@building-integrity/geometry";
import { pruneOpeningMemoryToLiveWalls, type OpeningMemoryByStoryAndWallId } from "./runStopOpeningMemory";

const memory = (widthIn: number): RunStopOpeningMemory => ({
  unbuilt: [{ beforeStandardCount: 1, type: "window", widthIn, heightIn: 60, sillHeightIn: 36 }],
  preStop: [
    { beforeStandardCount: 1, withheld: true },
    { beforeStandardCount: 3, withheld: false },
  ],
});

describe("pruneOpeningMemoryToLiveWalls", () => {
  const fp = buildRectangleFootprint(30, 20);

  it("keeps a memory whose wall the footprint still has", () => {
    const before: OpeningMemoryByStoryAndWallId = { ground: { AB: memory(61.5) }, second: {} };
    expect(pruneOpeningMemoryToLiveWalls(before, fp)).toEqual(before);
  });

  /**
   * The defect this exists for. Wall ids are REUSED — every rectangle this app
   * builds is "AB"/"BC"/"CD"/"DA" — so a memory outliving its wall does not sit
   * inert, it attaches to whatever wall next takes the id and puts a window on
   * a wall nobody drew one on.
   */
  it("drops a memory keyed by a wall id the footprint no longer has", () => {
    const before: OpeningMemoryByStoryAndWallId = {
      ground: { AB: memory(61.5), "jog-1": memory(36) },
      second: { "jog-1": memory(48) },
    };
    expect(pruneOpeningMemoryToLiveWalls(before, fp)).toEqual({ ground: { AB: memory(61.5) }, second: {} });
  });

  it("prunes the SECOND story too, not just the ground", () => {
    const before: OpeningMemoryByStoryAndWallId = {
      ground: {},
      second: { BC: memory(61.5), gone: memory(36) },
    };
    expect(pruneOpeningMemoryToLiveWalls(before, fp)).toEqual({ ground: {}, second: { BC: memory(61.5) } });
  });

  /**
   * ⚠ **The blind spot, asserted rather than described.** Drawing a brand-new
   * building reuses the same wall ids, so the old building's memory survives
   * this prune untouched — and the next re-tile then merges a window from a
   * building that no longer exists into the new one. A new footprint therefore
   * has to CLEAR the memory, not prune it; `handleDraw` does, and
   * retile.test.ts pins what happens when it does not.
   */
  it("keeps a stale memory whose id a BRAND-NEW building reuses — which is why handleDraw clears it", () => {
    const newBuilding = buildRectangleFootprint(22, 18);
    const leftOver: OpeningMemoryByStoryAndWallId = { ground: { AB: memory(61.5) }, second: {} };
    expect(pruneOpeningMemoryToLiveWalls(leftOver, newBuilding)).toEqual(leftOver);
  });

  /** Nothing drawn yet is not "every wall deleted". Emptying the memory here
   * would be the data loss the whole feature exists to avoid. */
  it("leaves the memory untouched when there is no footprint at all", () => {
    const before: OpeningMemoryByStoryAndWallId = { ground: { AB: memory(61.5) }, second: {} };
    expect(pruneOpeningMemoryToLiveWalls(before, null)).toBe(before);
  });
});
