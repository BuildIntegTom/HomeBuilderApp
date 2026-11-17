import { describe, expect, it } from "vitest";
import { buildMultiplexFootprint, buildRectangleFootprint } from "@building-integrity/geometry";
import { computeDeckPanelTakeoff, type DeckPanelTakeoff } from "./deckPanelTakeoff";

/* ──────────────────────────────────────────────────────────────────────────
   B34 STRIDE 3c — THE ROOF OVER AN INTERIOR WALL, AS PANELS

   A plane crossed by an interior wall becomes TWO runs of roof panels, each
   landing on that wall from its own side. The geometry of which walls qualify
   lives in `roofBearingLines.ts` and is tested there; this file is about what
   the takeoff then BUILDS, because nothing else pins where an upper band
   actually sits.
   ────────────────────────────────────────────────────────────────────────── */

const THICKNESS_IN = 15.5;
const PITCH = 8;
const EAVE_FT = 10;

const takeoff = (roofBearingWalls: boolean): DeckPanelTakeoff =>
  computeDeckPanelTakeoff({
    footprint: buildMultiplexFootprint({
      widthFt: 36,
      depthFt: 36,
      wallThicknessIn: THICKNESS_IN,
      roofBearingWalls,
    }),
    depthIn: THICKNESS_IN,
    roofForm: "peaked",
    roofPitchIn12: PITCH,
    roofEaveHeightFt: EAVE_FT,
    roofGableEndInsetIn: THICKNESS_IN,
  });

const roofRuns = (t: DeckPanelTakeoff) => t.runs.filter((r) => r.kind === "roof");

describe("⚠ a plane with a purlin wall under it builds TWO bands", () => {
  it("two planes become four runs, and a plain roof is untouched at two", () => {
    expect(roofRuns(takeoff(false))).toHaveLength(2);
    const bands = roofRuns(takeoff(true));
    expect(bands).toHaveLength(4);
    expect(bands.map((r) => `${r.planeIndex}/${r.slopeBandIndex}`)).toEqual(["0/0", "0/1", "1/0", "1/1"]);
  });

  it("⚠ THE ROOF COVERS EXACTLY THE SAME AREA — the acid test for the split", () => {
    /* Splitting a run must move no material at all. If the bands overlapped,
       left a strip uncovered, or double-counted, this is where it shows: the
       same roof, in two pieces, is the same square footage. 1445.8 sq ft on
       his 36x36 at 8:12, to the tenth. */
    expect(takeoff(true).coverageSqFt.roof).toBeCloseTo(takeoff(false).coverageSqFt.roof, 6);
  });

  it("⚠ the two band spans sum to the one span they replaced", () => {
    const whole = roofRuns(takeoff(false))[0]!.spanIn;
    const [lower, upper] = roofRuns(takeoff(true));
    expect(lower!.spanIn + upper!.spanIn).toBeCloseTo(whole, 6);
    /* And the worst of them is inside an 18ft panel, which is the entire
       reason the walls are there: 21.6ft becomes 11.2ft. */
    expect(whole / 12).toBeCloseTo(21.63, 2);
    expect(Math.max(lower!.spanIn, upper!.spanIn) / 12).toBeCloseTo(11.2, 1);
  });

  it("⚠ the upper band STARTS where the wall is, in plan and in height", () => {
    /* ⚠ **Two separate mistakes are possible here and neither shows up in any
       total**: an upper band left at the plane's own origin sits on top of the
       lower one, and an upper band left at the eave height sits inside the
       building. Both are pinned against the wall's own x and the rise over the
       ground it stands at. */
    const t = takeoff(true);
    const fp = buildMultiplexFootprint({
      widthFt: 36,
      depthFt: 36,
      wallThicknessIn: THICKNESS_IN,
      roofBearingWalls: true,
    });
    const west = fp.interiorWalls!.find((w) => w.id === "BRG-W")!;

    const [lower, upper] = roofRuns(t).filter((r) => r.planeIndex === 0);
    const first = (runIndex: number) => t.instances.find((i) => i.runIndex === runIndex)!;
    const low = first(lower!.index);
    const high = first(upper!.index);

    /* In plan: the lower band starts at the eave (x = 0 on the west plane) and
       the upper band starts at the purlin wall. */
    expect(low.world.anchorX).toBeCloseTo(0, 6);
    expect(high.world.anchorX).toBeCloseTo(west.start.x, 6);

    /* In height: the rise over the ground the wall stands at, at this pitch. */
    const riseFt = (west.start.x * PITCH) / 12;
    expect(high.world.anchorYFt - low.world.anchorYFt).toBeCloseTo(riseFt, 6);
    expect(riseFt).toBeCloseTo(6.215, 3);
  });

  it("⚠ the east plane mirrors it, rather than both bands marching the same way", () => {
    const t = takeoff(true);
    const [lower, upper] = roofRuns(t).filter((r) => r.planeIndex === 1);
    const first = (runIndex: number) => t.instances.find((i) => i.runIndex === runIndex)!;
    expect(first(lower!.index).world.anchorX).toBeCloseTo(36, 6);
    /* 26.677ft, not 9.323ft — the up-slope direction is the plane's own. */
    expect(first(upper!.index).world.anchorX).toBeCloseTo(26.677, 3);
  });

  it("⚠ a band is in the NAME, or two different panels are both called R1 (E)", () => {
    const names = takeoff(true).instances.filter((i) => i.kind === "roof").map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("R1 (W band 1)");
    expect(names).toContain("R1 (W band 2)");
    /* A roof with no bearing wall keeps the name it always had. */
    expect(takeoff(false).instances.filter((i) => i.kind === "roof").map((i) => i.name)).toContain("R1 (W)");
  });

  it("⚠ every panel id is still unique, which the band had to be added to", () => {
    const ids = takeoff(true).instances.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("⚠ NO floor girts for ridge posts that are not built", () => {
    /* ⚠ **A defect this stride introduced and nearly shipped.** Stride 3 stopped
       building the ridge beam and its posts when a wall runs under the ridge,
       but the floor deck kept laying the extra structural girts that go
       UNDERNEATH those posts — his "one under each side of the panel resting
       above it". Reinforcement for a post that does not exist, on every
       Multiplex, in the shop sheets and in the weight.

       It moves no panel COUNT, so nothing on screen changes and no existing
       test could see it. Pinned here by the members themselves: a Multiplex's
       floor panels carry only their two end girts, while a peaked building
       that really does have a beam still gets the extra ones. */
    const floorGirtCount = (t: DeckPanelTakeoff) =>
      t.groups
        .filter((g) => g.kind === "floor")
        .reduce((sum, g) => sum + g.options.extraStructuralGirtsAtIn!.length * g.instances.length, 0);

    expect(floorGirtCount(takeoff(true))).toBe(0);
    expect(floorGirtCount(takeoff(false))).toBe(0);

    /* The control: a peaked roof with no wall under its ridge still reinforces
       the floor under its posts, so this is the WALL doing the work. */
    const withBeam = computeDeckPanelTakeoff({
      footprint: buildRectangleFootprint(24, 48),
      depthIn: THICKNESS_IN,
      roofForm: "peaked",
      roofPitchIn12: 4,
      roofEaveHeightFt: EAVE_FT,
      roofGableEndInsetIn: THICKNESS_IN,
    });
    expect(floorGirtCount(withBeam)).toBeGreaterThan(0);
  });

  it("⚠ a building with no interior wall is byte-identical", () => {
    /* The whole feature has to be invisible to every project ever saved. */
    const plain = (gableInsetIn: number) =>
      computeDeckPanelTakeoff({
        footprint: buildRectangleFootprint(24, 48),
        depthIn: THICKNESS_IN,
        roofForm: "peaked",
        roofPitchIn12: 4,
        roofEaveHeightFt: EAVE_FT,
        roofGableEndInsetIn: gableInsetIn,
      });
    const t = plain(THICKNESS_IN);
    const roof = t.runs.filter((r) => r.kind === "roof");
    expect(roof).toHaveLength(2);
    expect(roof.every((r) => r.slopeBandIndex === 0)).toBe(true);
    /* 24 wide x 48 deep is longer north-to-south, so its short walls are east
       and west and the planes face those ways — the short-wall rule, not the
       south-facing preference, which `orientationNote` says out loud. */
    expect(t.instances.filter((i) => i.kind === "roof").map((i) => i.name)).toContain("R1 (W)");
  });
});
