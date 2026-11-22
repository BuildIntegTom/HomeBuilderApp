import { describe, expect, it } from "vitest";
import {
  ANTI_TWIST_SPACING_IN,
  ANTI_TWIST_WEB_THICKNESS_IN,
  BLOCKING_SPACING_IN,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  planFloorRoofGirtStationsIn,
  type FloorRoofGirtStationContext,
} from "./index";

/**
 * GIRTS THAT DODGE THE BRACING — his 2026-11-21 ask, as arithmetic.
 *
 * > *"can we continue to keep the hard rule of girts must be placed every 3 ft
 * > or less, but also place them in away where they do not interfere with the
 * > braces"*
 *
 * ⚠ **BOTH HALVES ARE ASSERTED SEPARATELY, because they pull against each
 * other.** The spacing rule is the hard one, so the dodge may only ever move a
 * girt EARLIER; and when a brace leaves nowhere clear, the rule wins and the
 * crossing is reported rather than the girt being dropped. A test that only
 * counted crossings would pass on a build that quietly stretched the spacing.
 */

const ANTI_TWIST_THICKNESS_IN = ANTI_TWIST_WEB_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;

const ctx = (over: Partial<FloorRoofGirtStationContext> = {}): FloorRoofGirtStationContext => ({
  datumIn: 2.25,
  lidStartsAtIn: 200,
  dropBandsIn: [],
  shiftBandsIn: [],
  ...over,
});

/** Every interval along the span, datum included. */
const intervalsIn = (datumIn: number, zs: readonly number[]): number[] => {
  const out: number[] = [];
  let prev = datumIn;
  for (const z of zs) {
    out.push(z - prev);
    prev = z;
  }
  return out;
};

describe("⚠ with nothing to dodge it is the fixed stride it replaced", () => {
  it("puts every station on datum + k x spacing", () => {
    const plan = planFloorRoofGirtStationsIn(ANTI_TWIST_SPACING_IN, ANTI_TWIST_THICKNESS_IN, ctx());
    expect(plan.stations.map((s) => s.zIn)).toEqual([62.25, 122.25, 182.25]);
    expect(plan.stations.every((s) => s.shiftedIn === 0)).toBe(true);
    expect(plan.stations.every((s) => s.crossesBrace === false)).toBe(true);
    expect(plan.droppedCount).toBe(0);
  });

  it("stops where the WHOLE member no longer clears the far lid", () => {
    /* 182.25 + 2.125 = 184.375, inside a 200in bound; the next would be
       242.25. The bound is on the member, not on its near face — the lesson
       the 2026-11-16 length sweep left in the builder. */
    const plan = planFloorRoofGirtStationsIn(ANTI_TWIST_SPACING_IN, ANTI_TWIST_THICKNESS_IN, ctx({ lidStartsAtIn: 184 }));
    expect(plan.stations.map((s) => s.zIn)).toEqual([62.25, 122.25]);
  });

  it("holds for BLOCKING's 3ft spacing and its 3 1/2in face too", () => {
    const plan = planFloorRoofGirtStationsIn(BLOCKING_SPACING_IN, PLATE_2X4_WIDTH_IN, ctx({ lidStartsAtIn: 120 }));
    expect(plan.stations.map((s) => s.zIn)).toEqual([38.25, 74.25, 110.25]);
    expect(110.25 + PLATE_2X4_WIDTH_IN).toBeLessThanOrEqual(120);
  });
});

describe("⚠ a girt only ever moves EARLIER, and the rule stays true", () => {
  it("pulls back to just clear the band, on the 1/8in grid", () => {
    /* A band across the first station. Clearing it means the girt's FAR face
       sitting on the band's start: 50.3 - 2.125 = 48.175, floored to 48.125. */
    const plan = planFloorRoofGirtStationsIn(
      ANTI_TWIST_SPACING_IN,
      ANTI_TWIST_THICKNESS_IN,
      ctx({ shiftBandsIn: [[50.3, 80]] }),
    );
    const first = plan.stations[0]!;
    expect(first.targetIn).toBe(62.25);
    expect(first.zIn).toBe(48.125);
    expect(first.zIn + ANTI_TWIST_THICKNESS_IN).toBeLessThanOrEqual(50.3);
    expect(first.shiftedIn).toBeCloseTo(14.125, 9);
    expect(first.crossesBrace).toBe(false);
    /* On the grid, which the band it dodged is not. */
    expect(first.zIn * 8).toBe(Math.round(first.zIn * 8));
  });

  it("⚠ RE-DATUMS from where the girt really landed, so no interval grows", () => {
    /* This is the whole reason the dodge is safe, and it is also what makes
       the dodge cost girts: the next target is measured from 48.125, not from
       62.25, so one more station fits before the lid. */
    const plan = planFloorRoofGirtStationsIn(
      ANTI_TWIST_SPACING_IN,
      ANTI_TWIST_THICKNESS_IN,
      ctx({ shiftBandsIn: [[50.3, 80]] }),
    );
    expect(plan.stations.map((s) => s.zIn)).toEqual([48.125, 108.125, 168.125]);
    for (const gap of intervalsIn(2.25, plan.stations.map((s) => s.zIn))) {
      expect(gap).toBeLessThanOrEqual(ANTI_TWIST_SPACING_IN + 1e-9);
    }
  });

  it("⚠ never places a girt LATER than the spacing rule's station", () => {
    /* A pushed station would break the hard rule, and a band that ends just
       past a target is exactly the shape that would tempt it. */
    for (const from of [40, 50, 55, 60, 61, 62]) {
      const plan = planFloorRoofGirtStationsIn(
        ANTI_TWIST_SPACING_IN,
        ANTI_TWIST_THICKNESS_IN,
        ctx({ shiftBandsIn: [[from, from + 25]] }),
      );
      for (const s of plan.stations) expect(s.zIn, `band from ${from}`).toBeLessThanOrEqual(s.targetIn + 1e-9);
    }
  });

  it("⚠ no interval ever exceeds the spacing, swept across band positions", () => {
    /* The sweep is the point: a single fixture cannot tell a correct walk from
       one that happens to work where it was measured. */
    for (let from = 5; from <= 190; from += 0.5) {
      for (const widthIn of [4, 18, 40]) {
        const plan = planFloorRoofGirtStationsIn(
          ANTI_TWIST_SPACING_IN,
          ANTI_TWIST_THICKNESS_IN,
          ctx({ shiftBandsIn: [[from, from + widthIn]] }),
        );
        const gaps = intervalsIn(2.25, plan.stations.map((s) => s.zIn));
        expect(Math.max(0, ...gaps), `band ${from}-${from + widthIn}`).toBeLessThanOrEqual(
          ANTI_TWIST_SPACING_IN + 1e-9,
        );
        /* And a girt that claims to be clear really is. */
        for (const s of plan.stations) {
          if (s.crossesBrace) continue;
          const clear = s.zIn + ANTI_TWIST_THICKNESS_IN <= from + 1e-9 || s.zIn >= from + widthIn - 1e-9;
          expect(clear, `band ${from}-${from + widthIn}, girt at ${s.zIn}`).toBe(true);
        }
      }
    }
  });
});

describe("⚠ the pull-back is the smallest one that works", () => {
  it("⚠ pulls back as LITTLE as it can — the station is the latest clear one", () => {
    /* A mutation run found this gap: picking the EARLIEST blocking band
       instead of the latest still produces a clear, legal station, so every
       other assertion here passed while the girt sat further from its rule
       station than it had to — and the further it sits, the more girts the
       re-datum adds. Maximality is the property, so it is the one asserted:
       no eighth-inch position between where the girt went and its target is
       clear. */
    const clearAt = (zIn: number, bands: readonly (readonly [number, number])[]) =>
      bands.every(([aIn, bIn]) => zIn + ANTI_TWIST_THICKNESS_IN <= aIn + 1e-9 || zIn >= bIn - 1e-9);

    for (let from = 10; from <= 120; from += 0.125) {
      const bands = [
        [from, from + 14],
        [from + 22, from + 31],
      ] as const;
      const plan = planFloorRoofGirtStationsIn(ANTI_TWIST_SPACING_IN, ANTI_TWIST_THICKNESS_IN, {
        datumIn: 2.25,
        lidStartsAtIn: 200,
        dropBandsIn: [],
        shiftBandsIn: bands,
      });
      for (const [i, station] of plan.stations.entries()) {
        if (station.crossesBrace || station.shiftedIn === 0) continue;
        const lowerBoundIn = plan.stations[i - 1]?.zIn ?? 2.25;
        for (let zIn = station.zIn + 0.125; zIn <= station.targetIn + 1e-9; zIn += 0.125) {
          if (zIn <= lowerBoundIn) continue;
          expect(
            clearAt(zIn, bands),
            `bands at ${from}: girt went to ${station.zIn}, but ${zIn} was free`,
          ).toBe(false);
        }
      }
    }
  });
});

describe("⚠ when there is nowhere clear, the RULE wins and says so", () => {
  it("leaves the girt on its target and flags the crossing", () => {
    /* A band wide enough to swallow the whole reach behind the target. */
    const plan = planFloorRoofGirtStationsIn(
      ANTI_TWIST_SPACING_IN,
      ANTI_TWIST_THICKNESS_IN,
      ctx({ shiftBandsIn: [[0, 70]] }),
    );
    const first = plan.stations[0]!;
    expect(first.zIn).toBe(first.targetIn);
    expect(first.crossesBrace).toBe(true);
    expect(first.shiftedIn).toBe(0);
    /* The girt still EXISTS — it is not dropped, because nothing else is
       doing its job and his spacing rule is hard. */
    expect(plan.stations.length).toBeGreaterThan(0);
    expect(plan.droppedCount).toBe(0);
  });

  it("⚠ a span tiled gap to gap by the figure puts EVERY girt across a brace", () => {
    /* The real case, measured on a 288in plane: panel R6 sits at a bay's
       centre and carries all four pieces, whose bands overlap end to end from
       2.5in to 141.7in. There is no gap to find, and pretending otherwise
       would mean either a dropped girt or a stretched spacing. */
    const plan = planFloorRoofGirtStationsIn(
      ANTI_TWIST_SPACING_IN,
      ANTI_TWIST_THICKNESS_IN,
      ctx({
        lidStartsAtIn: 141.7,
        shiftBandsIn: [
          [2.5, 28.8],
          [26.9, 73.0],
          [71.2, 117.4],
          [115.5, 141.7],
        ],
      }),
    );
    expect(plan.stations.map((s) => s.zIn)).toEqual([62.25, 122.25]);
    expect(plan.stations.every((s) => s.crossesBrace)).toBe(true);
  });
});

describe("⚠ a structural girt still DROPS a station rather than moving it", () => {
  it("drops it, and the stride carries on from the rule's station", () => {
    /* Unchanged behaviour, and deliberately different from a brace: a
       structural girt IS blocking at that station, and it is carrying a wall
       besides. The stride must not re-datum, or dropping one station would
       move every station after it. */
    const plan = planFloorRoofGirtStationsIn(
      ANTI_TWIST_SPACING_IN,
      ANTI_TWIST_THICKNESS_IN,
      ctx({ dropBandsIn: [[61, 64]] }),
    );
    expect(plan.droppedCount).toBe(1);
    expect(plan.stations.map((s) => s.zIn)).toEqual([122.25, 182.25]);
  });

  it("⚠ a brace dodge never lands a girt on a structural girt", () => {
    /* The two kinds of band are handled differently, which is exactly the
       shape that could put a dodged girt inside a dropped one's place. */
    for (let girtAtIn = 20; girtAtIn <= 60; girtAtIn += 0.25) {
      const plan = planFloorRoofGirtStationsIn(ANTI_TWIST_SPACING_IN, ANTI_TWIST_THICKNESS_IN, {
        datumIn: 2.25,
        lidStartsAtIn: 200,
        dropBandsIn: [[girtAtIn, girtAtIn + 2.25]],
        shiftBandsIn: [[50.3, 80]],
      });
      for (const s of plan.stations) {
        if (s.crossesBrace) continue;
        const clear = s.zIn + ANTI_TWIST_THICKNESS_IN <= girtAtIn + 1e-9 || s.zIn >= girtAtIn + 2.25 - 1e-9;
        expect(clear, `structural girt at ${girtAtIn}, girt at ${s.zIn}`).toBe(true);
      }
    }
  });
});
