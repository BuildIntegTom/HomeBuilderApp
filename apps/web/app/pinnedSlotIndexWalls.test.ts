import { describe, expect, it } from "vitest";
import { pinnedSlotIndexWallIds } from "./pinnedSlotIndexWalls";

describe("pinnedSlotIndexWallIds", () => {
  it("pins nothing for a project with no beams, no headers and no box beam", () => {
    expect(pinnedSlotIndexWallIds({})).toEqual(new Set());
    expect(
      pinnedSlotIndexWallIds({ boxBeamCoverageByWallId: {}, rangesByStoryAndWallId: [{ ground: {}, second: {} }] }),
    ).toEqual(new Set());
  });

  it("pins a wall carrying a roofline Box Beam coverage range", () => {
    expect(
      pinnedSlotIndexWallIds({ boxBeamCoverageByWallId: { "wall-N": { startSlotIndex: 1, endSlotIndex: 4 } } }),
    ).toEqual(new Set(["wall-N"]));
  });

  it("does NOT pin an empty or inverted range — that is how the editor says 'no box beam here'", () => {
    expect(
      pinnedSlotIndexWallIds({
        boxBeamCoverageByWallId: {
          "wall-N": { startSlotIndex: 2, endSlotIndex: 2 },
          "wall-S": { startSlotIndex: 5, endSlotIndex: 1 },
        },
      }),
    ).toEqual(new Set());
  });

  it("unions across BOTH stories and across beams AND headers", () => {
    const beams = {
      ground: { "wall-E": [{ startSlotIndex: 0, endSlotIndex: 2 }] },
      second: { "wall-W": [{ startSlotIndex: 3, endSlotIndex: 5 }] },
    };
    const headers = {
      ground: { "wall-S": [{ startSlotIndex: 1, endSlotIndex: 3 }] },
      second: {},
    };
    expect(pinnedSlotIndexWallIds({ rangesByStoryAndWallId: [beams, headers] })).toEqual(
      new Set(["wall-E", "wall-W", "wall-S"]),
    );
  });

  it("pins a wall if ANY of its several beams covers a real range", () => {
    const beams = {
      ground: {
        "wall-E": [
          { startSlotIndex: 2, endSlotIndex: 2 },
          { startSlotIndex: 4, endSlotIndex: 6 },
        ],
      },
    };
    expect(pinnedSlotIndexWallIds({ rangesByStoryAndWallId: [beams] })).toEqual(new Set(["wall-E"]));
  });

  it("an empty beam ARRAY pins nothing — a wall whose last beam was deleted is free again", () => {
    expect(pinnedSlotIndexWallIds({ rangesByStoryAndWallId: [{ ground: { "wall-E": [] } }] })).toEqual(new Set());
  });
});
