import { describe, expect, it } from "vitest";
import { buildOctagonFootprint } from "./octagon";
import {
  octagonBoxOf,
  octagonMeasures,
  octagonWallGroupOf,
  setFlatToFlat,
  setMiteredWall,
  setRegularFlatToFlat,
  setRegularPointToPoint,
  setStraightWall,
  type OctagonBox,
} from "./octagonSize";

/** An eighth of an inch, in feet — the grid the rest of the app works on, and
 * the only tolerance worth asserting on a shape whose diagonals are
 * irrational (see `buildOctagonFootprint`'s own note). */
const EIGHTH_FT = 1 / 8 / 12;
const near = (a: number, b: number) => Math.abs(a - b) < EIGHTH_FT;

/** Build the shape and read the group lengths back off the REAL footprint,
 * so these tests measure what the editor would draw, not what the arithmetic
 * intended. */
function builtLengths(box: OctagonBox) {
  const fp = buildOctagonFootprint(box.widthFt, box.depthFt);
  const of = (id: string) => fp.walls.find((w) => w.id === id)!.lengthFt;
  return { straightWidth: of("01"), straightDepth: of("23"), mitered: of("70"), fp };
}

describe("⚠ the defect this module exists for, measured on the old path", () => {
  /** What `handleEditWallLength` did until 2026-10-20: take `clip` off the OLD
   * shape and add it to the typed length. Kept here as a CONTROL — without it
   * the tests below only prove the new code agrees with itself. */
  function oldWay(box: OctagonBox, group: "straightWidth" | "straightDepth", lengthFt: number): OctagonBox {
    const clipFt = Math.min(box.widthFt, box.depthFt) * (1 - 1 / Math.SQRT2);
    return group === "straightWidth"
      ? { widthFt: lengthFt + 2 * clipFt, depthFt: box.depthFt }
      : { widthFt: box.widthFt, depthFt: lengthFt + 2 * clipFt };
  }

  it("typing 16 into a 40x24 octagon's side wall used to give 12.458", () => {
    const box = { widthFt: 40, depthFt: 24 };
    const was = builtLengths(oldWay(box, "straightDepth", 16));
    /* About 12.45ft for a typed 16 — stated as a BAND rather than a decimal,
       because the exact figure depends on where `quantizeFootprint` lands and
       pinning it would make this a test of the grid rather than of the bug. */
    expect(was.straightDepth).toBeGreaterThan(12);
    expect(was.straightDepth).toBeLessThan(13);
    expect(16 - was.straightDepth).toBeGreaterThan(3); // off by over three feet
    // ...and it moved the wall nobody touched, by about three and a half.
    const untouchedBefore = builtLengths(box).straightWidth;
    expect(untouchedBefore - was.straightWidth).toBeGreaterThan(3);
  });

  it("the same edit now gives exactly 16", () => {
    const out = setStraightWall({ widthFt: 40, depthFt: 24 }, "straightDepth", 16);
    expect(near(builtLengths(out.box).straightDepth, 16)).toBe(true);
  });

  it("⚠ and it still SAYS the other straight group moved, because it did", () => {
    /* The coupling is real: setting the shorter axis moves `clip`, and the
       other straight group with it. What was wrong before was not that it
       moved — it is that the number typed came back different and nothing
       said anything. */
    const out = setStraightWall({ widthFt: 40, depthFt: 24 }, "straightDepth", 16);
    expect(out.alsoMoves).toContain("straightWidth");
    expect(out.alsoMoves).toContain("mitered");
  });

  it("editing the LONGER axis was always fine, and still is — self-contained", () => {
    const out = setStraightWall({ widthFt: 30, depthFt: 20 }, "straightWidth", 20);
    expect(near(builtLengths(out.box).straightWidth, 20)).toBe(true);
    expect(out.alsoMoves).toEqual([]);
  });
});

describe("what you type is what you get, swept rather than spot-checked", () => {
  it("every straight-wall target lands within an eighth, on both axes, either side of the crossover", () => {
    /* ⚠ The crossover matters: the solver has two branches that meet where
       the edited axis becomes the shorter one. A spot check either side of it
       would pass while the seam was broken, so this sweeps across it. */
    for (const box of [
      { widthFt: 40, depthFt: 24 },
      { widthFt: 24, depthFt: 40 },
      { widthFt: 30, depthFt: 30 },
      { widthFt: 60, depthFt: 18 },
    ]) {
      for (let target = 6; target <= 40; target += 0.5) {
        for (const group of ["straightWidth", "straightDepth"] as const) {
          const out = setStraightWall(box, group, target);
          const got = builtLengths(out.box)[group];
          expect({ box, group, target, got: near(got, target) }).toEqual({ box, group, target, got: true });
        }
      }
    }
  });

  it("every mitered target lands within an eighth", () => {
    for (const box of [
      { widthFt: 40, depthFt: 24 },
      { widthFt: 24, depthFt: 40 },
      { widthFt: 30, depthFt: 30 },
    ]) {
      for (let target = 4; target <= 20; target += 0.5) {
        const out = setMiteredWall(box, target);
        expect({ target, got: near(builtLengths(out.box).mitered, target) }).toEqual({ target, got: true });
      }
    }
  });

  it("flat-to-flat is the box, so it is exact by construction", () => {
    const out = setFlatToFlat({ widthFt: 40, depthFt: 24 }, "width", 33);
    expect(out.box.widthFt).toBe(33);
    expect(out.box.depthFt).toBe(24);
  });
});

describe("⚠ the shape has TWO degrees of freedom, and the module says so", () => {
  it("setting the mitered walls always moves a straight group — it cannot not", () => {
    /* `clip` is defined off the shorter axis, so there is no way to change the
       corner walls alone. A control that implied otherwise would be lying. */
    const out = setMiteredWall({ widthFt: 40, depthFt: 24 }, 12);
    expect(out.alsoMoves.length).toBeGreaterThan(0);
  });

  it("a mitered length too big for the other axis makes the octagon REGULAR, and says so", () => {
    // 24ft of mitered wall implies a minimum axis far past the 24ft depth.
    const out = setMiteredWall({ widthFt: 40, depthFt: 24 }, 24);
    expect(out.clamped).toBe(true);
    expect(octagonMeasures(out.box).isRegular).toBe(true);
  });

  it("an ordinary mitered edit is not clamped", () => {
    expect(setMiteredWall({ widthFt: 40, depthFt: 24 }, 8).clamped).toBe(false);
  });
});

describe("the two diameters", () => {
  it("across the flats IS the box, both ways", () => {
    const m = octagonMeasures({ widthFt: 40, depthFt: 24 });
    expect(m.flatToFlatWidthFt).toBe(40);
    expect(m.flatToFlatDepthFt).toBe(24);
  });

  it("⚠ an elongated octagon has TWO across-the-corners diameters, not one", () => {
    const m = octagonMeasures({ widthFt: 40, depthFt: 24 });
    expect(near(m.pointToPointAcrossWidthFt, m.pointToPointAcrossDepthFt)).toBe(false);
  });

  it("a regular octagon has one, and it is flats / cos(22.5°)", () => {
    const m = octagonMeasures({ widthFt: 30, depthFt: 30 });
    expect(near(m.pointToPointAcrossWidthFt, m.pointToPointAcrossDepthFt)).toBe(true);
    expect(m.pointToPointAcrossWidthFt).toBeCloseTo(30 / Math.cos(Math.PI / 8), 6);
  });

  it("setting across-the-corners round-trips, and keeps it regular", () => {
    const out = setRegularPointToPoint(32);
    const m = octagonMeasures(out.box);
    expect(m.isRegular).toBe(true);
    expect(near(m.pointToPointAcrossWidthFt, 32)).toBe(true);
  });

  it("setting across-the-flats keeps it regular and needs no warning", () => {
    const out = setRegularFlatToFlat(28);
    expect(octagonMeasures(out.box).isRegular).toBe(true);
    expect(out.alsoMoves).toEqual([]);
  });
});

describe("a regular octagon really does have eight equal walls", () => {
  it("⚠ all eight agree within a QUARTER INCH — not an eighth, and that is geometry", () => {
    /* ⚠ I wrote this at an eighth first and it failed, correctly. A 45° wall
       between two grid points has an irrational length, so no rounding rule
       makes both the corners and the diagonals exact — `buildOctagonFootprint`
       says so in its own doc comment, and the residual is absorbed at the
       mitered corner joint, which is what the safety/gap panel is there for.

       MEASURED rather than guessed: swept every regular octagon from 10ft to
       60ft in 6in steps, the worst spread between the longest and shortest of
       the eight sides is 0.2032in, at 55ft. A quarter inch is therefore the
       honest tolerance, and asserting it here means a change that made the
       shape WORSE would be caught instead of hidden behind a loose epsilon. */
    for (const flats of [10, 20, 30, 42.5, 55]) {
      const { straightWidth, straightDepth, mitered } = builtLengths({ widthFt: flats, depthFt: flats });
      const spreadIn = (Math.max(straightWidth, straightDepth, mitered) - Math.min(straightWidth, straightDepth, mitered)) * 12;
      expect({ flats, within: spreadIn <= 0.25 }).toEqual({ flats, within: true });
    }
  });

  it("⚠ and an elongated one does NOT — which is why the groups are named separately", () => {
    const { straightWidth, straightDepth } = builtLengths({ widthFt: 40, depthFt: 24 });
    expect(near(straightWidth, straightDepth)).toBe(false);
  });
});

describe("reading an octagon back off what is drawn", () => {
  it("recovers the box from the footprint it built", () => {
    for (const box of [
      { widthFt: 40, depthFt: 24 },
      { widthFt: 30, depthFt: 30 },
      { widthFt: 18, depthFt: 52 },
    ]) {
      const got = octagonBoxOf(buildOctagonFootprint(box.widthFt, box.depthFt))!;
      expect(near(got.widthFt, box.widthFt) && near(got.depthFt, box.depthFt)).toBe(true);
    }
  });

  it("is null for anything that is not one of this app's octagons", () => {
    const fp = buildOctagonFootprint(30, 30);
    expect(octagonBoxOf({ ...fp, corners: fp.corners.slice(0, 4) })).toBeNull();
  });

  it("names each wall's group, and nothing else", () => {
    expect(octagonWallGroupOf("01")).toBe("straightWidth");
    expect(octagonWallGroupOf("45")).toBe("straightWidth");
    expect(octagonWallGroupOf("23")).toBe("straightDepth");
    expect(octagonWallGroupOf("70")).toBe("mitered");
    expect(octagonWallGroupOf("AB")).toBeNull();
  });
});
