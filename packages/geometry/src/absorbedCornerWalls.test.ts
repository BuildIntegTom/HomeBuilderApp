import { describe, expect, it } from "vitest";
import { findAbsorbedCornerWalls } from "./absorbedCornerWalls";
import { tileWall } from "./tiling";
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
    expect(findAbsorbedCornerWalls({ AB: tileWall(75, 40, NOMINAL_IN, "end", true, true).slots }, NOMINAL_IN)).toEqual([]);
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
      expect(reported).toBe(lengthIn > 51 && lengthIn < 75);
    }
  });
});
