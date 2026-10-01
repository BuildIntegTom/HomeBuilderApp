import { describe, expect, it } from "vitest";

import { findWallsKeepingStoredTiling, preChangeTilingReviewNote, type StoredWallRun } from "./preChangeTilingNotice";

const format = (inches: number) => `${inches}in`;

const wall = (over: Partial<StoredWallRun> = {}): StoredWallRun => ({
  wallId: "AB",
  story: "ground",
  storedTotalIn: 155,
  currentRunIn: 124,
  slotCount: 4,
  ...over,
});

describe("findWallsKeepingStoredTiling", () => {
  it("names a wall whose stored run is the one the OLD corner rule gave it", () => {
    // Tommy's own 241 x 155in rectangle, as a file saved before the flip. The
    // 155in wall owned both corners then and owns neither now, so its stored
    // panels add up to 155in while its run is 124in — 31in, which is exactly the
    // two wall thicknesses it stopped owning.
    expect(findWallsKeepingStoredTiling([wall()]).map((w) => w.wallId)).toEqual(["AB"]);
  });

  it("says nothing about a wall whose stored run is already current", () => {
    expect(findWallsKeepingStoredTiling([wall({ storedTotalIn: 124 })])).toEqual([]);
  });

  it("uses repairStateToEighths' OWN tolerance — one eighth per slot is a repair, not a stale run", () => {
    // The guard this mirrors re-sizes the slots it already has when the residual
    // is at most one eighth per slot, so a wall inside that band was fixed at
    // load and must not be reported. At the boundary it is still a repair; one
    // eighth past it, the stored total was kept.
    expect(findWallsKeepingStoredTiling([wall({ storedTotalIn: 124.5, currentRunIn: 124, slotCount: 4 })])).toEqual([]);
    expect(findWallsKeepingStoredTiling([wall({ storedTotalIn: 124.625, currentRunIn: 124, slotCount: 4 })])).toHaveLength(1);
  });

  it("ignores a wall with no slots at all, which is a run stop rather than a stale tiling", () => {
    // A fully stopped wall builds nothing; there is no stored run to be stale.
    expect(findWallsKeepingStoredTiling([wall({ slotCount: 0, storedTotalIn: 0 })])).toEqual([]);
  });

  it("covers both stories, because a second-story wall is tiled by the same rule", () => {
    expect(
      findWallsKeepingStoredTiling([wall({ wallId: "CD", story: "second" })]).map((w) => w.story),
    ).toEqual(["second"]);
  });
});

describe("preChangeTilingReviewNote", () => {
  it("is null when nothing is stale — every project drawn since the change", () => {
    expect(preChangeTilingReviewNote([wall({ storedTotalIn: 124 })], format)).toBeNull();
    expect(preChangeTilingReviewNote([], format)).toBeNull();
  });

  it("is ONE line naming every affected wall, with both lengths, and promises nothing is lost", () => {
    const note = preChangeTilingReviewNote([wall(), wall({ wallId: "DA", storedTotalIn: 210, currentRunIn: 241 })], format)!;
    expect(note).toContain("2 walls still carry");
    expect(note).toContain("AB (ground, 155in stored vs 124in now)");
    expect(note).toContain("DA (ground, 210in stored vs 241in now)");
    // The two halves of the promise: nothing was rewritten, and it WILL change
    // on the next edit. A note that made only the first half would be the
    // pleasant surprise arriving unannounced.
    expect(note).toContain("Nothing has been rewritten and nothing is lost");
    expect(note).toContain("re-tile to its new run the first time something edits it");
  });

  it("reads as singular for one wall — a part-way-through-editing project", () => {
    const note = preChangeTilingReviewNote([wall()], format)!;
    expect(note).toContain("One wall still carries");
    expect(note).not.toContain("1 walls");
  });
});
