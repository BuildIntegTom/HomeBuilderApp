import { describe, expect, it } from "vitest";
import { PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";
import {
  planRoofZigzag,
  ROOF_ZIGZAG_GIRT_THICKNESS_IN,
  ROOF_ZIGZAG_MAX_ANGLE_DEG,
  ROOF_ZIGZAG_MAX_BAY_IN,
  ROOF_ZIGZAG_MIN_ANGLE_DEG,
} from "./roofZigzagBracing";

/**
 * THE ZIGZAG'S OWN GEOMETRY, with no panel around it.
 *
 * ⚠ These are the properties the whole design rests on, and every one of them
 * is a claim that was wrong at least once while it was being built: that an
 * odd traverse count leaves the chain on the far joist, that the girts land on
 * the bay boundaries, and — the one that cost the most — that a board's
 * CORNERS stay off the girt, not just its centreline.
 */

const FIELD = { clearXFromIn: 1.5, clearXToIn: 22.5 };
const EDGE = { clearXFromIn: 1.5, clearXToIn: 14 };
const BAND = { regionFromIn: 5.87, regionToIn: 140.78 };

const plan = (over: Partial<Parameters<typeof planRoofZigzag>[0]> = {}) =>
  planRoofZigzag({ ...FIELD, ...BAND, ...over });

describe("one chain, bay by bay", () => {
  it("cuts every bay into the same ODD number of traverses", () => {
    const z = plan();
    expect(z.refusal).toBeNull();
    expect(z.traversesPerBay % 2).toBe(1);
    expect(z.pieces).toHaveLength(z.bayCount * z.traversesPerBay);
  });

  /* ⚠ **THE WHOLE TRICK.** Odd means a bay's chain leaves on the joist
     opposite the one it entered on, so the next bay carries straight on and
     no board ever has to die into a girt mid-span. */
  it("leaves each bay on the joist opposite the one it entered", () => {
    const z = plan();
    for (let bay = 0; bay < z.bayCount; bay++) {
      const inBay = z.pieces.filter((p) => p.bayIndex === bay);
      const first = inBay[0]!;
      const last = inBay[inBay.length - 1]!;
      expect(last.x2In, `bay ${bay}`).not.toBeCloseTo(first.x1In, 9);
    }
  });

  /* ⚠ **IT IS NOT A SHARED POINT — Tommy's rule, 2026-11-22.** *"if another
     diagonal is a node with it, the edge/tip of one should meet the edge/tip
     of the other - varying distances depending on angle."* Two boards whose
     CENTRELINES met would overlap in a rhombus, because each is 3 1/2in
     across. So consecutive traverses land on the same joist a full end face
     apart — `width / cos(angle)` — which puts their corners exactly in
     contact and their bodies nowhere near each other. */
  it("steps a full end face at each node, so corners touch and nothing laps", () => {
    const z = plan();
    const faceIn = PLATE_2X4_WIDTH_IN / Math.cos((z.angleDeg * Math.PI) / 180);
    expect(z.stepIn).toBeCloseTo(faceIn, 9);
    for (let i = 1; i < z.pieces.length; i++) {
      const prev = z.pieces[i - 1]!;
      const here = z.pieces[i]!;
      if (here.bayIndex !== prev.bayIndex) continue;
      /* Same joist, stepped along the span by exactly one end face. */
      expect(here.x1In).toBeCloseTo(prev.x2In, 9);
      expect(here.y1In - prev.y2In).toBeCloseTo(faceIn, 9);
    }
  });

  it("spans the full clear width every time, at one single angle", () => {
    const z = plan();
    const widthIn = FIELD.clearXToIn - FIELD.clearXFromIn;
    for (const p of z.pieces) {
      expect(Math.abs(p.x2In - p.x1In)).toBeCloseTo(widthIn, 9);
      const deg = (Math.atan(Math.abs(p.y2In - p.y1In) / widthIn) * 180) / Math.PI;
      expect(deg).toBeCloseTo(z.angleDeg, 9);
    }
  });
});

describe("the girts the chain is built around", () => {
  it("puts a girt on every bay boundary and nowhere else", () => {
    const z = plan();
    expect(z.girtStationsIn).toHaveLength(z.bayCount - 1);
    const pitchIn = z.bayHeightIn + ROOF_ZIGZAG_GIRT_THICKNESS_IN;
    z.girtStationsIn.forEach((station, j) => {
      expect(station).toBeCloseTo(BAND.regionFromIn + j * pitchIn + z.bayHeightIn, 9);
    });
  });

  it("keeps every bay equal and under his 5ft maximum", () => {
    for (const regionToIn of [60, 90, 140.78, 200, 260, 330]) {
      const z = plan({ regionToIn });
      if (z.refusal !== null) continue;
      expect(z.bayHeightIn, `${regionToIn}`).toBeLessThanOrEqual(ROOF_ZIGZAG_MAX_BAY_IN);
      /* Equal by construction: the bays plus the girts between them fill the
         band exactly, so a ragged tail bay cannot exist. */
      const filled = z.bayCount * z.bayHeightIn + (z.bayCount - 1) * ROOF_ZIGZAG_GIRT_THICKNESS_IN;
      expect(filled, `${regionToIn}`).toBeCloseTo(regionToIn - BAND.regionFromIn, 9);
    }
  });

  /**
   * ⚠ **A BOARD'S CORNERS, NOT ITS CENTRELINE — this is the one that was
   * wrong.** A piece is centred on its line and `PLATE_2X4_WIDTH_IN` across
   * it, so each end's corners run `(width/2)/cos(angle)` further along the
   * span than the endpoint does. Laying the chain flush to the bay's floor
   * and ceiling therefore drove a board that far into the girt: 24
   * brace-against-girt pairs per group on the Tank, every one of them
   * invisible to a centreline test.
   */
  it("holds the boards off the bay's ends by exactly a corner's reach", () => {
    for (const where of [FIELD, EDGE]) {
      const z = planRoofZigzag({ ...where, ...BAND });
      expect(z.refusal).toBeNull();
      const reachIn = PLATE_2X4_WIDTH_IN / 2 / Math.cos((z.angleDeg * Math.PI) / 180);
      expect(z.insetIn).toBeCloseTo(reachIn, 9);

      const pitchIn = z.bayHeightIn + ROOF_ZIGZAG_GIRT_THICKNESS_IN;
      for (let bay = 0; bay < z.bayCount; bay++) {
        const inBay = z.pieces.filter((p) => p.bayIndex === bay);
        const lowestIn = Math.min(...inBay.map((p) => Math.min(p.y1In, p.y2In)));
        const highestIn = Math.max(...inBay.map((p) => Math.max(p.y1In, p.y2In)));
        /* The corner reach either side lands exactly on the bay's own ends. */
        expect(lowestIn - reachIn).toBeCloseTo(bay * pitchIn, 9);
        expect(highestIn + reachIn).toBeCloseTo(bay * pitchIn + z.bayHeightIn, 9);
      }
    }
  });
});

describe("the angle his band asks for", () => {
  /* ⚠ **THE BAND IS A PREFERENCE AND A MISS IS REPORTED, NOT REFUSED** — his
     *"where possible"*. Once the corner-to-corner step existed, a 24in field
     panel's three traverses came out at 28.3deg rather than 36, and he chose
     that over doubling the girts to chase the band. So what this pins is that
     a miss is SMALL and HONEST: `bandMissDeg` says exactly how far out, and
     nothing drifts far. */
  it("stays near the band, and says exactly how far out when it is not", () => {
    let checked = 0;
    let inBand = 0;
    let worstMissDeg = 0;
    for (const clearXToIn of [14, 17.5, 22.5, 25.5]) {
      for (let bandIn = 40; bandIn <= 340; bandIn += 7.5) {
        const z = planRoofZigzag({
          clearXFromIn: 1.5,
          clearXToIn,
          regionFromIn: 5.87,
          regionToIn: 5.87 + bandIn,
        });
        if (z.refusal !== null) continue;
        const label = `clear ${clearXToIn - 1.5}in, band ${bandIn}in`;
        const miss =
          z.angleDeg > ROOF_ZIGZAG_MAX_ANGLE_DEG
            ? z.angleDeg - ROOF_ZIGZAG_MAX_ANGLE_DEG
            : Math.max(0, ROOF_ZIGZAG_MIN_ANGLE_DEG - z.angleDeg);
        expect(z.bandMissDeg, label).toBeCloseTo(miss, 9);
        if (miss === 0) inBand += 1;
        worstMissDeg = Math.max(worstMissDeg, miss);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
    /* ⚠ **THE WORST MISSES ARE ALL SHORT BANDS, AND NO ROOF HAS ONE.** The
       sweep runs down to a 40in band for coverage; the worst it finds is
       about 8.7deg, on bays around 34in where one traverse is too steep and
       three too shallow with the steps taken out. A 70in band is a 7ft
       rafter run — shorter than anything this app draws. */
    expect(worstMissDeg).toBeLessThan(9);
    expect(inBand / checked).toBeGreaterThan(0.5);
  });

  /* ⚠ **ON A BAND A REAL ROOF ACTUALLY HAS, THE MISS REACHES 5.5deg — more
     than the 1.7deg Tommy was shown when he chose this.** The shortest run
     the app draws is 10ft, a band near 117in; sweeping every 5in from there
     up, the worst any real band gives is just under 5.5deg. The nine Home
     templates happen to land better than that — their worst is 3.2deg, the
     Tank's 26.8deg — but a building between those sizes can hit 5.5. Stated
     here rather than rounded away, because it is a number he has not agreed
     to and the Review Log is what has to carry it to him. */
  it("stays within 5.5deg on every band a real roof run produces", () => {
    let worstMissDeg = 0;
    let checked = 0;
    for (const clearXToIn of [14, 22.5]) {
      for (let bandIn = 110; bandIn <= 340; bandIn += 5) {
        const z = planRoofZigzag({
          clearXFromIn: 1.5,
          clearXToIn,
          regionFromIn: 5.87,
          regionToIn: 5.87 + bandIn,
        });
        if (z.refusal !== null) continue;
        worstMissDeg = Math.max(worstMissDeg, z.bandMissDeg);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(80);
    expect(worstMissDeg).toBeLessThan(5.5);
  });

  /* ⚠ The SMALLEST odd count inside the band is taken, which is the
     shallowest angle on offer and so the fewest, longest boards. */
  it("takes the fewest traverses it can, not the first that fits", () => {
    const z = plan();
    const widthIn = FIELD.clearXToIn - FIELD.clearXFromIn;
    for (let n = 1; n < z.traversesPerBay; n += 2) {
      const usableIn = z.bayHeightIn - 2 * z.insetIn;
      const deg = (Math.atan(usableIn / (n * widthIn)) * 180) / Math.PI;
      expect(deg, `${n} traverses`).toBeGreaterThan(ROOF_ZIGZAG_MAX_ANGLE_DEG);
    }
  });
});

describe("it refuses in words rather than throwing", () => {
  it("says so when the joists leave no clear width", () => {
    const z = planRoofZigzag({ ...BAND, clearXFromIn: 12, clearXToIn: 12 });
    expect(z.refusal).toMatch(/no clear width/);
    expect(z.pieces).toEqual([]);
    expect(z.girtStationsIn).toEqual([]);
  });

  it("says so when the end lids leave no band", () => {
    const z = plan({ regionToIn: BAND.regionFromIn });
    expect(z.refusal).toMatch(/no clear band/);
    expect(z.pieces).toEqual([]);
  });

  /* A panel far wider than it is long cannot hold a diagonal in his band at
     any odd count, and says which two angles it was choosing between. */
  /* ⚠ A bay shorter than one board's end face has no rise left for a
     diagonal at all — the two half reaches alone fill it. That is the only
     thing the planner refuses on now, since the angle band stopped being a
     gate. */
  it("says so when a bay is too short to hold a board at all", () => {
    const z = planRoofZigzag({
      clearXFromIn: 1.5,
      clearXToIn: 22.5,
      regionFromIn: 0,
      regionToIn: 3,
    });
    expect(z.refusal).toMatch(/NOT braced/);
    expect(z.refusal).toMatch(/end faces alone fill the bay/);
    expect(z.pieces).toEqual([]);
  });
});
