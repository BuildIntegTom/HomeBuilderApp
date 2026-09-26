import { describe, expect, it } from "vitest";
import { fabricationMinPanelWidthIn, squareBalePanel } from "@building-integrity/panel-catalog";
import { findSquareBaleBandWalls, squareBaleCornerRefusal } from "./squareBaleCornerRefusal";
import type { RefusalWallFacts } from "./squareBaleCornerRefusal";

/** Plain inches, so the assertions read as the shop would say them. */
const format = (valueIn: number) => `${valueIn}in`;

const BALE_IN = squareBalePanel.widthIn;
const MIN_IN = fabricationMinPanelWidthIn.value;

const wall = (wallId: string, lengthIn: number, corners: [boolean, boolean] = [true, true]): RefusalWallFacts => ({
  wallId,
  lengthIn,
  hasCornerStart: corners[0],
  hasCornerEnd: corners[1],
});

describe("the catalog values this refusal is stated against", () => {
  it("is measured against the CONFIRMED bale width and fabrication minimum, not local copies", () => {
    // If either of these ever moves, the band moves with it and these tests
    // fail loudly rather than asserting a stale number.
    expect(BALE_IN).toBe(39);
    expect(squareBalePanel.status).toBe("confirmed");
    expect(MIN_IN).toBe(24);
    expect(fabricationMinPanelWidthIn.status).toBe("confirmed");
  });
});

describe("findSquareBaleBandWalls", () => {
  it("finds an 8ft wall — MIN_DIMENSION_FT, the shortest side the app will draw", () => {
    expect(findSquareBaleBandWalls([wall("AB", 96)], BALE_IN)).toEqual([{ wallId: "AB", wallLengthIn: 96, middleIn: 18 }]);
  });

  it("finds a 7ft wall, whose corners absorb would have widened to 42in each", () => {
    expect(findSquareBaleBandWalls([wall("AB", 84)], BALE_IN)).toEqual([{ wallId: "AB", wallLengthIn: 84, middleIn: 6 }]);
  });

  it("is silent at both edges of the moved band", () => {
    // 78in: two nominal bale corners with exactly nothing between them.
    expect(findSquareBaleBandWalls([wall("AB", 78)], BALE_IN)).toEqual([]);
    // 102in: the first legal middle, exactly the 24in floor.
    expect(findSquareBaleBandWalls([wall("AB", 102)], BALE_IN)).toEqual([]);
    expect(findSquareBaleBandWalls([wall("AB", 101.875)], BALE_IN)).toHaveLength(1);
    expect(findSquareBaleBandWalls([wall("AB", 78.125)], BALE_IN)).toHaveLength(1);
  });

  it("is silent on a wall owning only one corner, which is a different defect", () => {
    expect(findSquareBaleBandWalls([wall("AB", 96, [true, false])], BALE_IN)).toEqual([]);
    expect(findSquareBaleBandWalls([wall("AB", 96, [false, false])], BALE_IN)).toEqual([]);
  });

  it("is silent on a wall too short for the bale pair at all — that is the merge case", () => {
    expect(findSquareBaleBandWalls([wall("AB", 60)], BALE_IN)).toEqual([]);
  });

  it("reports every offending wall, in wall order", () => {
    const found = findSquareBaleBandWalls([wall("AB", 96), wall("BC", 240), wall("CD", 84), wall("DA", 240)], BALE_IN);
    expect(found.map((w) => w.wallId)).toEqual(["AB", "CD"]);
  });

  it("finds nothing on an ordinary 20ft x 16ft rectangle, so Square Bale stays available", () => {
    expect(findSquareBaleBandWalls([wall("AB", 240), wall("BC", 192), wall("CD", 240), wall("DA", 192)], BALE_IN)).toEqual([]);
  });
});

describe("squareBaleCornerRefusal", () => {
  it("returns null when no wall is in the band", () => {
    expect(squareBaleCornerRefusal([], BALE_IN, MIN_IN, format)).toBeNull();
  });

  it("quotes the real numbers, names the wall, and says what was not changed", () => {
    const message = squareBaleCornerRefusal(
      findSquareBaleBandWalls([wall("AB", 96)], BALE_IN),
      BALE_IN,
      MIN_IN,
      format,
    )!;
    expect(message).toContain("39in");
    expect(message).toContain("Wall AB");
    expect(message).toContain("96in");
    expect(message).toContain("18in");
    expect(message).toContain("24in");
    expect(message).toContain("no legal Square Bale tiling");
    expect(message).toContain("NOT changed");
  });

  it("never suggests a width that would make it fit — the whole point is that it cannot", () => {
    const message = squareBaleCornerRefusal(
      findSquareBaleBandWalls([wall("AB", 84)], BALE_IN),
      BALE_IN,
      MIN_IN,
      format,
    )!;
    // 42in is the panel absorb would have invented. It must not appear as
    // advice, or as anything else.
    expect(message).not.toContain("42in");
    expect(message).toContain("cannot be built any other width");
  });

  it("counts the other affected walls, singular and plural", () => {
    const one = squareBaleCornerRefusal(
      findSquareBaleBandWalls([wall("AB", 96), wall("CD", 84)], BALE_IN),
      BALE_IN,
      MIN_IN,
      format,
    )!;
    expect(one).toContain("1 other wall on this building is the same.");
    const many = squareBaleCornerRefusal(
      findSquareBaleBandWalls([wall("AB", 96), wall("CD", 84), wall("EF", 90)], BALE_IN),
      BALE_IN,
      MIN_IN,
      format,
    )!;
    expect(many).toContain("2 other walls on this building are the same.");
  });

  it("says nothing about other walls when only one is affected", () => {
    const only = squareBaleCornerRefusal(findSquareBaleBandWalls([wall("AB", 96)], BALE_IN), BALE_IN, MIN_IN, format)!;
    expect(only).not.toContain("other wall");
  });
});
