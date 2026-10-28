import { describe, expect, it } from "vitest";
import {
  defaultTransparentRoofFacing,
  roofNeedsRidgeBeam,
  shedTallWallId,
  simpleRoofPlanes,
} from "./simpleRoofPlanes";
import { wallCompassDirection } from "./wallCompassDirection";
import type { Footprint } from "./types";

function rect(widthFt: number, depthFt: number): Footprint {
  const pts = [
    { x: 0, y: 0 },
    { x: widthFt, y: 0 },
    { x: widthFt, y: depthFt },
    { x: 0, y: depthFt },
  ];
  return {
    corners: pts.map((point, i) => ({ id: `c${i}`, point })),
    walls: pts.map((_, i) => ({ id: `w${i}`, startCorner: `c${i}`, endCorner: `c${(i + 1) % pts.length}` })),
  } as Footprint;
}

const peaked = { form: "peaked" as const, pitchIn12: 4, eaveHeightFt: 10 };
const shed = { form: "shed" as const, pitchIn12: 4, eaveHeightFt: 10 };

describe("where the ridge runs", () => {
  it("⚠ gable ends land on the SHORT walls, so the ridge runs the long way", () => {
    const wide = simpleRoofPlanes(rect(40, 24), peaked);
    expect(wide.ridgeAxis).toBe("x");
    const tall = simpleRoofPlanes(rect(24, 40), peaked);
    expect(tall.ridgeAxis).toBe("y");
  });

  it("⚠ a square ties to east/west gables, so half the roof faces the sun", () => {
    /* "On a square building gable ends should be east and west with half the
       roof facing the sun." There is no short wall to follow, so the tie is
       the rule. */
    const square = simpleRoofPlanes(rect(30, 30), peaked);
    expect(square.ridgeAxis).toBe("x");
    const footprint = rect(30, 30);
    const dirs = square.gableWallIds.map((id) =>
      wallCompassDirection(footprint.walls.find((w) => w.id === id)!, footprint),
    );
    expect(new Set(dirs)).toEqual(new Set(["E", "W"]));
  });

  it("⚠ says so when the short-wall rule costs a south-facing roof", () => {
    /* A building long north-to-south has its short walls east and west, so
       the ridge runs north-south and the planes face EAST and WEST. Both of
       his rules cannot hold at once; the short-wall one wins and this says
       which was given up. */
    const tall = simpleRoofPlanes(rect(24, 40), peaked);
    expect(tall.orientationNote).toContain("EAST and WEST");
    expect(tall.orientationNote).toContain("short walls");
    expect(simpleRoofPlanes(rect(40, 24), peaked).orientationNote).toBeNull();
  });

  it("gable walls are the ones at the ends of the ridge", () => {
    const footprint = rect(40, 24);
    const roof = simpleRoofPlanes(footprint, peaked);
    expect(roof.gableWallIds).toHaveLength(2);
    const dirs = roof.gableWallIds.map((id) =>
      wallCompassDirection(footprint.walls.find((w) => w.id === id)!, footprint),
    );
    expect(new Set(dirs)).toEqual(new Set(["E", "W"]));
  });
});

describe("the planes themselves", () => {
  it("⚠ a peak halves the run, which is the whole reason it exists", () => {
    const roof = simpleRoofPlanes(rect(40, 24), peaked);
    expect(roof.planes).toHaveLength(2);
    // 24ft deep, split at the ridge: 12ft of ground each side.
    for (const p of roof.planes) expect(p.runFt).toBe(12);
    const shedRoof = simpleRoofPlanes(rect(40, 24), shed);
    expect(shedRoof.planes).toHaveLength(1);
    expect(shedRoof.planes[0]!.runFt).toBe(24);
  });

  it("the rise follows the pitch, and the slope follows both", () => {
    const roof = simpleRoofPlanes(rect(40, 24), peaked);
    const p = roof.planes[0]!;
    // 12ft of run at 4:12 rises 4ft.
    expect(p.lowHeightFt).toBe(10);
    expect(p.highHeightFt).toBe(14);
    expect(p.slopeFt).toBeCloseTo(Math.hypot(12, 4), 9);
    // And the panel is longer than the ground it covers, always.
    expect(p.slopeFt).toBeGreaterThan(p.runFt);
  });

  it("both planes of a peak meet on the same ridge line", () => {
    const roof = simpleRoofPlanes(rect(40, 24), peaked);
    const [a, b] = roof.planes;
    expect(a!.highStart).toEqual(b!.highStart);
    expect(a!.highEnd).toEqual(b!.highEnd);
    expect(a!.highHeightFt).toBe(b!.highHeightFt);
  });

  it("a flat roof is a legal roof, and its slope is its run", () => {
    const flat = simpleRoofPlanes(rect(40, 24), { form: "shed", pitchIn12: 0, eaveHeightFt: 10 });
    expect(flat.planes[0]!.highHeightFt).toBe(10);
    expect(flat.planes[0]!.slopeFt).toBe(24);
  });
});

describe("⚠ which way a shed falls", () => {
  it("tall side NORTH by default, so the roof faces south", () => {
    /* "it should auto spawn tall side on the north but have a way to then
       switch it around." North is screen-up — the same simplification
       wallCompassDirection already makes — so the high edge is at minY. */
    const roof = simpleRoofPlanes(rect(40, 24), shed);
    const p = roof.planes[0]!;
    expect(p.highStart.y).toBe(0);
    expect(p.lowStart.y).toBe(24);
  });

  it("and it switches round when asked", () => {
    const roof = simpleRoofPlanes(rect(40, 24), { ...shed, tallSideNorth: false });
    const p = roof.planes[0]!;
    expect(p.highStart.y).toBe(24);
    expect(p.lowStart.y).toBe(0);
  });

  it("⚠ a north-south building's shed cannot face south at all", () => {
    // The ridge runs north-south, so the shed falls east or west. The note
    // above is what tells the user, since the geometry cannot.
    const roof = simpleRoofPlanes(rect(24, 40), shed);
    expect(roof.orientationNote).toContain("EAST and WEST");
    expect(roof.planes[0]!.highStart.x).toBe(0);
  });
});

describe("what it refuses", () => {
  it("a footprint with no extent", () => {
    expect(simpleRoofPlanes(rect(0, 24), peaked).refusal).toContain("no footprint");
  });

  it("a roof with no pitch given at all", () => {
    expect(simpleRoofPlanes(rect(40, 24), { ...peaked, pitchIn12: Number.NaN }).refusal).toContain("needs a pitch");
  });
});

describe("⚠ which half of the roof you can see through", () => {
  it("a plane looks the way its own eave wall looks", () => {
    const roof = simpleRoofPlanes(rect(40, 24), peaked);
    expect(new Set(roof.planes.map((p) => p.facing))).toEqual(new Set(["N", "S"]));
    const tall = simpleRoofPlanes(rect(24, 40), peaked);
    expect(new Set(tall.planes.map((p) => p.facing))).toEqual(new Set(["E", "W"]));
  });

  it("⚠ east when the roof has an east plane, south when it does not", () => {
    /* "east default is transparent or south if n/s>e/w". Only one can ever
       apply, because a wide building's planes face N and S and a tall one's
       face E and W — so this is his sentence read as "whichever of these two
       faces east or south". */
    const tall = simpleRoofPlanes(rect(24, 40), peaked);
    expect(defaultTransparentRoofFacing(tall.planes)).toBe("E");
    const wide = simpleRoofPlanes(rect(40, 24), peaked);
    expect(defaultTransparentRoofFacing(wide.planes)).toBe("S");
  });

  it("a shed has only one plane, and it is that one", () => {
    const roof = simpleRoofPlanes(rect(40, 24), shed);
    expect(roof.planes).toHaveLength(1);
    expect(defaultTransparentRoofFacing(roof.planes)).toBe(roof.planes[0]!.facing);
  });

  it("no planes, nothing to see through", () => {
    expect(defaultTransparentRoofFacing([])).toBeNull();
  });
});

describe("⚠ which roofs have a ridge beam", () => {
  it("a peak does, a shed does not", () => {
    /* "No catcher beam for the shed roof, all the load goes down the walls."
       A shed's panels reach wall to wall, so both ends are already over
       bearing; only a peak leaves panel ends in mid-air. */
    expect(roofNeedsRidgeBeam("peaked")).toBe(true);
    expect(roofNeedsRidgeBeam("shed")).toBe(false);
  });

  it("⚠ and a shed has only ONE plane, which is the same fact twice", () => {
    // Two planes meet at a ridge; one plane has no ridge to meet at.
    expect(simpleRoofPlanes(rect(40, 24), shed).planes).toHaveLength(1);
    expect(simpleRoofPlanes(rect(40, 24), peaked).planes).toHaveLength(2);
  });

  it("no beam means no columns, and nothing follows from them either", () => {
    /* The beam carries the columns, the columns want a path to the
       foundation and extra girts in the floor below. A shed inherits none of
       that, which is the real content of his sentence. */
    const roof = simpleRoofPlanes(rect(40, 24), shed);
    expect(roofNeedsRidgeBeam(roof.form)).toBe(false);
  });
});

describe("⚠ the wall a shed's tall side stands on", () => {
  it("is the wall under the high edge, and it is NOT a gable wall", () => {
    const footprint = rect(40, 24);
    const tallId = shedTallWallId(footprint, shed);
    expect(tallId).not.toBeNull();
    const roof = simpleRoofPlanes(footprint, shed);
    expect(roof.gableWallIds).not.toContain(tallId);
    // Tall side north by default, and north is screen-up.
    const wall = footprint.walls.find((w) => w.id === tallId)!;
    expect(wallCompassDirection(wall, footprint)).toBe("N");
  });

  it("follows the tall side when it is switched round", () => {
    const footprint = rect(40, 24);
    const flipped = shedTallWallId(footprint, { ...shed, tallSideNorth: false });
    const wall = footprint.walls.find((w) => w.id === flipped)!;
    expect(wallCompassDirection(wall, footprint)).toBe("S");
  });

  it("⚠ a peaked roof has no tall side at all", () => {
    // Both its walls are the same height; the ridge is in the middle.
    expect(shedTallWallId(rect(40, 24), peaked)).toBeNull();
  });

  it("⚠ adding it would have made a THIRD gable wall, which is why it is its own set", () => {
    /* The app allows at most two gable walls and insists they be opposite,
       because a catcher beam spans between exactly two. This wall is neither
       — so it gets its own concept rather than a weakened rule. */
    const footprint = rect(40, 24);
    const roof = simpleRoofPlanes(footprint, shed);
    const tallId = shedTallWallId(footprint, shed)!;
    expect(roof.gableWallIds).toHaveLength(2);
    expect([...roof.gableWallIds, tallId]).toHaveLength(3);
  });
});
