import { describe, expect, it } from "vitest";
import {
  defaultTransparentRoofFacing,
  gableEndWallIdsFor,
  ridgeBearingWallFor,
  roofNeedsRidgeBeam,
  roofRidgeAxis,
  shedTallWallId,
  simpleRoofPlanes,
} from "./simpleRoofPlanes";
import { buildMultiplexFootprint } from "./multiplex";
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
    expect(roofNeedsRidgeBeam("peaked", rect(40, 24))).toBe(true);
    expect(roofNeedsRidgeBeam("shed", rect(40, 24))).toBe(false);
  });

  it("\u26a0 and a peak whose ridge lands on a WALL does not \u2014 B34 stride 3", () => {
    /* > "All the loads of everything transfer down the center row of diving
       >  wall panels." \u2014 Tommy, 2026-11-16

       His own shed argument, from the other direction: a beam catches panel
       ends that are over nothing, and a wall under the ridge already catches
       them. A beam there would be a second load path, a part nobody builds,
       and ridge posts standing inside a wall that already reaches the
       foundation. */
    const multiplex = buildMultiplexFootprint({ widthFt: 36, depthFt: 36, wallThicknessIn: 15.5 });
    expect(ridgeBearingWallFor(multiplex)).toEqual({ wallId: "CTR", axis: "y" });
    expect(roofNeedsRidgeBeam("peaked", multiplex)).toBe(false);
    /* The SAME 36x36 with no dividing wall still wants its beam \u2014 so this is
       the wall doing the work, not the shape. */
    expect(roofNeedsRidgeBeam("peaked", rect(36, 36))).toBe(true);
  });

  it("\u26a0 the ridge FOLLOWS the wall, overriding the short-wall rule", () => {
    /* \u26a0 **Measured before this existed: the ridge ran EAST-WEST, from
       `(0,18)` to `(36,18)` \u2014 square across a centre wall running
       north-south.** `roofRidgeAxis` ties a square to X so the gables land
       east and west, and the wall he said was *"acting as the ridge beam"*
       carried nothing while a roof plane crossed it at 90 degrees.

       His answer settles the precedence: the ridge follows the wall. */
    const multiplex = buildMultiplexFootprint({ widthFt: 36, depthFt: 36, wallThicknessIn: 15.5 });
    expect(roofRidgeAxis(rect(36, 36))).toBe("x"); // the square's own tie, untouched
    expect(roofRidgeAxis(multiplex)).toBe("y");

    const roof = simpleRoofPlanes(multiplex, { form: "peaked", pitchIn12: 8, eaveHeightFt: 10 });
    const plane = roof.planes[0]!;
    /* The ridge line sits exactly on the wall's own x, which is what "under
       the ridge" has to mean to be worth anything. */
    const centre = multiplex.interiorWalls![0]!;
    expect(plane.highStart.x).toBeCloseTo(centre.start.x, 9);
    expect(plane.highEnd.x).toBeCloseTo(centre.end.x, 9);
    expect(plane.highStart.y).not.toBeCloseTo(plane.highEnd.y, 3);

    /* And the gable ends move with it: the ridge's two ENDS are the north and
       south walls now, not the east and west ones. */
    const gables = gableEndWallIdsFor(multiplex).map(
      (id) => wallCompassDirection(multiplex.walls.find((w) => w.id === id)!, multiplex),
    );
    expect(gables.sort()).toEqual(["N", "S"]);

    /* \u26a0 The note names the WALL as the reason, not the dimensions \u2014 a
       square is not "longer north-to-south" and saying so would be a lie the
       user could act on by turning the building. */
    expect(roof.orientationNote).toContain("CTR");
    expect(roof.orientationNote).not.toContain("longer north-to-south");
  });

  it("\u26a0 refuses an OFF-CENTRE or diagonal wall rather than hanging the ridge beside it", () => {
    /* `simpleRoofPlanes` puts the ridge at the midline and nowhere else, so an
       off-centre wall would be drawn with the planes meeting somewhere the
       load path is not. An asymmetric peak is a real building and nothing
       models one yet, so this returns null and the app says so. */
    const base = rect(36, 36);
    const withWall = (start: { x: number; y: number }, end: { x: number; y: number }) => ({
      ...base,
      interiorWalls: [{ id: "CTR", start, end, lengthFt: Math.hypot(end.x - start.x, end.y - start.y) }],
    });
    expect(ridgeBearingWallFor(withWall({ x: 12, y: 1 }, { x: 12, y: 35 }))).toBeNull(); // off centre
    expect(ridgeBearingWallFor(withWall({ x: 1, y: 1 }, { x: 35, y: 35 }))).toBeNull(); // diagonal
    /* ⚠ **A diagonal that STARTS on the midline and leans away — and this
       case is here because a mutation survived without it.** Dropping the
       off-axis guard left the centred test doing the work, and the centred
       test reads `start.x`, which is only the wall's x if the wall is
       vertical. This one starts exactly at x = 18 and ends at x = 30, so it
       passed every surviving check and would have been given the ridge. */
    expect(ridgeBearingWallFor(withWall({ x: 18, y: 1 }, { x: 30, y: 35 }))).toBeNull();
    expect(ridgeBearingWallFor(withWall({ x: 1, y: 18 }, { x: 35, y: 30 }))).toBeNull();
    /* An E-W wall on the midline carries it too, and the ridge then runs
       east-west \u2014 the axis is the WALL's, not a constant. */
    expect(ridgeBearingWallFor(withWall({ x: 1, y: 18 }, { x: 35, y: 18 }))).toEqual({ wallId: "CTR", axis: "x" });

    /* \u26a0 TWO candidates is null as well. A roof has one ridge; picking one
       silently would put a plane straight through the other wall. */
    const twoWalls = {
      ...base,
      interiorWalls: [
        { id: "CTR", start: { x: 18, y: 1 }, end: { x: 18, y: 35 }, lengthFt: 34 },
        { id: "CTR2", start: { x: 1, y: 18 }, end: { x: 35, y: 18 }, lengthFt: 34 },
      ],
    };
    expect(ridgeBearingWallFor(twoWalls)).toBeNull();
    expect(roofNeedsRidgeBeam("peaked", twoWalls)).toBe(true);
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
    expect(roofNeedsRidgeBeam(roof.form, rect(40, 24))).toBe(false);
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
