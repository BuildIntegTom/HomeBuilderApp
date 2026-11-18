import { describe, expect, it } from "vitest";
import {
  INTERIOR_WALL_SERIES,
  interiorWallSeries,
  isCompassDirection,
  type CompassDirection,
  type WallSeriesLabel,
} from "./wallCompassDirection";

/** The eight, written out because the type is a union and not a value. */
const COMPASS_DIRECTIONS: readonly CompassDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/* ──────────────────────────────────────────────────────────────────────────
   B36 STRIDE 1 — A SERIES IS ALL LETTERS, A PANEL NUMBER IS ALL DIGITS

   ⚠ Not a style choice. A panel's name is `${series}${panelNumber}`, and that
   string is the KEY both numbering systems are stored against — `panelCodeKey`
   and `installSequenceKey` are byte-identical formulas. A NUMERIC series
   suffix made two different panels produce one key:

       wall "C2" panel 1  ->  C21
       wall "C"  panel 21 ->  C21

   Measured through the real ledger, those two panels took ONE crew code, which
   is the failure `tip4urTimeCsv.ts` warns about in its own comment.
   ────────────────────────────────────────────────────────────────────────── */

/** The name `panelInstances` builds, restated here so the test reasons about
 *  the real string rather than about the series alone. */
const nameOf = (series: string, panelNumber: number) => `${series}${panelNumber}`;

describe("⚠ the collision the numeric suffix caused", () => {
  it("is GONE: no series + number can equal another series + number", () => {
    /* The old rule gave `C2`; the new one gives `CB`. Spelled out first with
       the exact pair that collided. */
    expect(interiorWallSeries(1)).toBe("CB");
    expect(nameOf(interiorWallSeries(1), 1)).toBe("CB1");
    expect(nameOf(INTERIOR_WALL_SERIES, 21)).toBe("C21");
    expect(nameOf(interiorWallSeries(1), 1)).not.toBe(nameOf(INTERIOR_WALL_SERIES, 21));
  });

  it("⚠ swept: every series against every panel number, no two names equal", () => {
    /* The real guarantee, not just the one pair. A name is letters-then-digits
       and parses one way only, so a sweep is a proof rather than a sample. */
    const seriesList: string[] = [...COMPASS_DIRECTIONS];
    for (let i = 0; i < 30; i++) seriesList.push(interiorWallSeries(i));

    const seen = new Map<string, string>();
    for (const series of seriesList) {
      for (let panelNumber = 1; panelNumber <= 60; panelNumber++) {
        const name = nameOf(series, panelNumber);
        const previous = seen.get(name);
        expect(previous, `${name} is both ${previous} and ${series}#${panelNumber}`).toBeUndefined();
        seen.set(name, `${series}#${panelNumber}`);
      }
    }
  });

  it("⚠ the OLD rule fails that same sweep, which is what makes it a real fix", () => {
    /* Reconstructed rather than imported, so deleting the old code cannot make
       this test quietly vacuous. */
    const oldSeries = (i: number) => (i === 0 ? "C" : `C${i + 1}`);
    const seen = new Set<string>();
    let collided = false;
    for (let i = 0; i < 30; i++) {
      for (let panelNumber = 1; panelNumber <= 60; panelNumber++) {
        const name = nameOf(oldSeries(i), panelNumber);
        if (seen.has(name)) collided = true;
        seen.add(name);
      }
    }
    expect(collided).toBe(true);
  });
});

describe("⚠ letters only, because of the stencils", () => {
  it("⚠ no hyphen, no digit — his shop has stencils for neither", () => {
    /* > "I have spray paint stencils in the shop, and there is no huphen
       >  stencil. So let's drop the hyphen." — Tommy, 2026-09-24

       A separator was the obvious fix for the collision and it is ruled out by
       that, so the fix had to live inside the letters-and-digits alphabet. */
    for (let i = 0; i < 30; i++) {
      expect(interiorWallSeries(i)).toMatch(/^C[A-Z]*$/);
    }
  });

  it("runs B, C, D … and doubles up past 26 rather than reaching for a digit", () => {
    expect([0, 1, 2, 3].map(interiorWallSeries)).toEqual(["C", "CB", "CC", "CD"]);
    expect(interiorWallSeries(25)).toBe("CZ");
    expect(interiorWallSeries(26)).toBe("CAA");
  });

  it("a negative or zero index is the plain series, never a crash", () => {
    expect(interiorWallSeries(0)).toBe("C");
    expect(interiorWallSeries(-1)).toBe("C");
  });
});

describe("⚠ an interior series is never mistaken for a compass direction", () => {
  it("every generated series is refused by `isCompassDirection`", () => {
    /* The B35 chip colours by this. A series that slipped through would be
       painted as a direction the wall does not face. */
    for (let i = 0; i < 30; i++) {
      expect(isCompassDirection(interiorWallSeries(i) as WallSeriesLabel), interiorWallSeries(i)).toBe(false);
    }
  });

  it("and every real compass direction is accepted", () => {
    for (const direction of COMPASS_DIRECTIONS) {
      expect(isCompassDirection(direction), direction).toBe(true);
    }
  });

  it("⚠ the two alphabets cannot overlap, because no direction starts with C", () => {
    /* This is the structural reason the test above will keep passing as more
       interior walls become possible, rather than a lucky sample. */
    for (const direction of COMPASS_DIRECTIONS) {
      expect(direction.startsWith(INTERIOR_WALL_SERIES), direction).toBe(false);
    }
  });

  it("⚠ the OLD guard would have let a letter suffix through", () => {
    /* `/^C\d+$/` matched `C2` but not `CB`, so the chip would have coloured an
       interior wall as a compass direction the moment the suffix changed.
       Worth a test because it is the kind of guard nobody re-reads. */
    const oldIsCompass = (label: string) => label !== "C" && !/^C\d+$/.test(label);
    expect(oldIsCompass("C2")).toBe(false);
    expect(oldIsCompass("CB")).toBe(true); // ...which is wrong
    expect(isCompassDirection("CB" as WallSeriesLabel)).toBe(false);
  });
});
