import { describe, expect, it } from "vitest";
import { findAbsorbedCornerWalls } from "./absorbedCornerWalls";
import { retileWithOpenings, tileWall } from "./tiling";
import type { PanelSlot } from "./types";

const NOMINAL_IN = 25.5;

describe("findAbsorbedCornerWalls", () => {
  it("reports a wall whose corner pair absorbed a sub-minimum middle", () => {
    const slots = tileWall(61.75, 40, NOMINAL_IN, "end", true, true).slots;
    expect(findAbsorbedCornerWalls({ AB: slots }, NOMINAL_IN)).toEqual([
      { wallId: "AB", cornerWidthsIn: [30.875, 30.875], absorbedIn: 10.75, nominalCornerWidthIn: NOMINAL_IN },
    ]);
  });

  it("reports the absorbed amount as exactly the middle that had nowhere to go", () => {
    // 72in wall: 51in of nominal corners, 21in of middle. That 21in is what
    // the pair took, and the shop can read it straight off the entry.
    const slots = tileWall(72, 40, NOMINAL_IN, "end", true, true).slots;
    const [entry] = findAbsorbedCornerWalls({ CD: slots }, NOMINAL_IN);
    expect(entry!.absorbedIn).toBe(21);
    expect(entry!.cornerWidthsIn).toEqual([36, 36]);
  });

  it("reports the wider corner first when the odd eighth makes them differ", () => {
    const slots = tileWall(74.875, 40, NOMINAL_IN, "end", true, true).slots;
    expect(findAbsorbedCornerWalls({ AB: slots }, NOMINAL_IN)[0]!.cornerWidthsIn).toEqual([37.5, 37.375]);
  });

  it("is silent on an ordinary wall with nominal corners and a real middle", () => {
    // 75½in, not 75in: the band's top edge moved out by the narrow safety gap's
    // own 1/2in on 2026-10-01 (see cornerBandMiddleIn), so a 75in wall is now
    // absorbed and IS reported.
    expect(findAbsorbedCornerWalls({ AB: tileWall(75.5, 40, NOMINAL_IN, "end", true, true).slots }, NOMINAL_IN)).toEqual([]);
    expect(findAbsorbedCornerWalls({ AB: tileWall(360, 40, NOMINAL_IN, "end", true, true).slots }, NOMINAL_IN)).toEqual([]);
    // Exactly 51in: the pair fits at nominal width with a zero middle, so
    // nothing was absorbed and nothing is reported.
    expect(findAbsorbedCornerWalls({ AB: tileWall(51, 40, NOMINAL_IN, "end", true, true).slots }, NOMINAL_IN)).toEqual([]);
  });

  it("is silent on the merged corner, deliberately — that rule predates this one", () => {
    expect(findAbsorbedCornerWalls({ AB: tileWall(48, 40, NOMINAL_IN, "end", true, true).slots }, NOMINAL_IN)).toEqual([]);
  });

  it("is silent on a wall owning only one corner, however short", () => {
    expect(findAbsorbedCornerWalls({ AB: tileWall(40, 40, NOMINAL_IN, "end", true, false).slots }, NOMINAL_IN)).toEqual([]);
  });

  it("still reports a band wall that kept an opening", () => {
    // Corners at 27in each with a 20in window between them — the opening is
    // not a fabricated panel, so it does not disqualify the shape.
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 27 },
      { type: "window", widthIn: 20 },
      { type: "corner", widthIn: 27 },
    ];
    expect(findAbsorbedCornerWalls({ AB: slots }, NOMINAL_IN)).toEqual([
      { wallId: "AB", cornerWidthsIn: [27, 27], absorbedIn: 3, nominalCornerWidthIn: NOMINAL_IN },
    ]);
  });

  it("covers an octagon's safety-oct-corner variant, which is still a corner panel", () => {
    const slots: PanelSlot[] = [
      { type: "safety-oct-corner", widthIn: 30 },
      { type: "corner", widthIn: 30 },
    ];
    expect(findAbsorbedCornerWalls({ "01": slots }, NOMINAL_IN)).toHaveLength(1);
  });

  it("handles an empty or absent slot map without inventing anything", () => {
    expect(findAbsorbedCornerWalls({}, NOMINAL_IN)).toEqual([]);
    expect(findAbsorbedCornerWalls({ AB: [] }, NOMINAL_IN)).toEqual([]);
  });

  it("fires on exactly the band and nowhere else, swept every eighth from 24in to 200in", () => {
    for (let eighths = 24 * 8; eighths <= 200 * 8; eighths++) {
      const lengthIn = eighths / 8;
      const slots = tileWall(lengthIn, 40, NOMINAL_IN, "end", true, true).slots;
      const reported = findAbsorbedCornerWalls({ AB: slots }, NOMINAL_IN).length === 1;
      // Band 51in-75½in since 2026-10-01 — the middle must hold the run's own
      // safety gap AND a legal panel. Was lengthIn < 75.
      expect(reported).toBe(lengthIn > 51 && lengthIn < 75.5);
    }
  });

  it("reports a band wall that kept a COLUMN, which it used to miss entirely", () => {
    // MEASURED on this branch before the fix: a 70in wall carrying a 16.75in
    // column tiles to corner 26.625 | column 16.75 | corner 26.625 — corners
    // widened past nominal, sum exact, and this walk reported NOTHING because
    // `column` sat in the disqualifier list alongside standard/braced. A column
    // is a reservation like a window or a door, not a fabricated plain panel.
    const slots = tileWall(70, 40, NOMINAL_IN, "end", true, true).slots;
    expect(slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 35],
      ["corner", 35],
    ]);
    // The tiler only produces that shape with the column supplied as a
    // reservation, which is how page.tsx tiles a wall carrying one.
    const withColumn = retileWithOpenings(70, 40, NOMINAL_IN, "end", true, true, [
      { beforeStandardCount: 0, type: "column", widthIn: 16.75 },
    ]).slots;
    expect(withColumn.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 26.625],
      ["column", 16.75],
      ["corner", 26.625],
    ]);
    expect(findAbsorbedCornerWalls({ AB: withColumn }, NOMINAL_IN)).toEqual([
      { wallId: "AB", cornerWidthsIn: [26.625, 26.625], absorbedIn: 2.25, nominalCornerWidthIn: NOMINAL_IN },
    ]);
  });

  it("is still silent when a fabricated plain panel sits between the corners", () => {
    // The shape test that has to keep working: wide corners AND a standard
    // panel is not the absorbed shape (and the tiler cannot produce it).
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 30 },
      { type: "standard", widthIn: 40 },
      { type: "corner", widthIn: 30 },
    ];
    expect(findAbsorbedCornerWalls({ AB: slots }, NOMINAL_IN)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // THE 39in SQUARE BALE CORNER (2026-09-26)
  //
  // This file's own doc comment already named Square Bale as the reason
  // `nominalCornerWidthIn` is carried on the record — but no test ever passed
  // 39in, so the value the app really does tile Square Bale corners at was
  // never exercised here. Both halves matter: the record shape works at 39in,
  // AND the tiler must never hand it a widened bale corner to report.
  // -------------------------------------------------------------------------
  const BALE_IN = 39;

  it("measures an absorbed pair against the 39in bale nominal, not against 25.5in", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 42 },
      { type: "corner", widthIn: 42 },
    ];
    expect(findAbsorbedCornerWalls({ AB: slots }, BALE_IN)).toEqual([
      { wallId: "AB", cornerWidthsIn: [42, 42], absorbedIn: 6, nominalCornerWidthIn: BALE_IN },
    ]);
    // Measured against the WRONG nominal the same pair reads as 33in absorbed,
    // which is why the nominal travels on the record instead of being looked up.
    expect(findAbsorbedCornerWalls({ AB: slots }, NOMINAL_IN)[0]!.absorbedIn).toBe(33);
  });

  it("never has anything to report under Square Bale, because bale corners do not widen", () => {
    // `cornerMayWiden: false` — Tommy: "No — refuse instead." Swept across the
    // whole moved 78in-102.5in band: no absorbed pair is ever produced, so this
    // entry never fires and the wall is refused by name instead.
    for (let eighths = 78 * 8; eighths <= 102 * 8; eighths++) {
      const lengthIn = eighths / 8;
      const slots = tileWall(lengthIn, 39, BALE_IN, "end", true, true, true, false).slots;
      expect(findAbsorbedCornerWalls({ AB: slots }, BALE_IN)).toEqual([]);
    }
  });
});
